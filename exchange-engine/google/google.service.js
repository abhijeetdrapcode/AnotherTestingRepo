import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { google } from 'googleapis';
import {
  attendeesForGoogleCalendarEvent,
  checkAvailabilityService,
  getAllCalendarEvents,
  getOauth2Client,
  handleGoogleAuthRefreshTokenProcess,
  hostForGoogleCalendarEvent,
  prepareCalendarResponseDataForSaving,
} from './google.utils';
import { findOneCollectionService } from '../collection/collection.service';
import {
  findItemById,
  saveBulkDataFromDeveloperAPI,
  saveCollectionItem,
  updateCollectionItem,
} from '../item/item.service';
import { bulkDeleteService } from '../developer/dev.service';
import { handleZoomScheduledMeeting } from '../zoom/zoom.utils';

export const googleAuthService = async (
  projectId,
  successRedirectUrl,
  errorRedirectUrl,
  redirectUri,
  user,
  googleService,
) => {
  try {
    const SCOPES = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ];
    let googlePlugin;
    if (googleService === 'calendar') {
      googlePlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
      if (!googlePlugin) return pluginNotInstalledMessage('Google Calendar');
    } else if (googleService === 'meet') {
      googlePlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_MEET);
      if (!googlePlugin) return pluginNotInstalledMessage('Google Meet');
    }
    const { clientID, clientSecret } = googlePlugin.setting;
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: encodeURIComponent(
        JSON.stringify({ successRedirectUrl, errorRedirectUrl, userId: user?.uuid }),
      ),
    });
    return { code: 200, message: 'Auth URL Generated', authUrl };
  } catch (error) {
    console.error('Error in googleAuthService:', error);
    return {
      code: 500,
      message: `An error occurred while initiating Google ${googleService} authentication.`,
      error: error.message || error,
    };
  }
};

export const handleGoogleCallbackService = async (
  db,
  projectId,
  enableAuditTrail,
  environment,
  headers,
  user,
  code,
  redirectUri,
  userId,
  googleService,
) => {
  try {
    let googlePlugin;
    let tokenCollectionName;
    if (googleService === 'calendar') {
      tokenCollectionName = 'google_calendar_oauth_tokens';
      googlePlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
      if (!googlePlugin) return pluginNotInstalledMessage('Google Calendar');
    } else if (googleService === 'meet') {
      tokenCollectionName = 'google_meet_oauth_tokens';
      googlePlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_MEET);
      if (!googlePlugin) return pluginNotInstalledMessage('Google Meet');
    }
    const { clientID, clientSecret } = googlePlugin.setting;
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const googleAuthTokenCollection = await findOneCollectionService(
      projectId,
      tokenCollectionName,
    );
    if (!googleAuthTokenCollection) return collectionNotFoundMessage(tokenCollectionName);
    const { data: existingToken } = await findItemById(
      db,
      projectId,
      googleAuthTokenCollection,
      null,
      { userId: { $in: [userId] } },
    );
    const tokenPayload = {
      ...tokens,
      userId: userId || '',
      ...(tokens.expiry_date ? { expiry_date: new Date(tokens.expiry_date).toISOString() } : {}),
    };
    let result;
    if (existingToken) {
      result = await updateCollectionItem(
        db,
        projectId,
        environment,
        enableAuditTrail,
        googleAuthTokenCollection,
        existingToken.uuid,
        tokenPayload,
        user,
        headers,
      );
    } else {
      result = await saveCollectionItem(
        db,
        projectId,
        enableAuditTrail,
        googleAuthTokenCollection,
        tokenPayload,
        user,
        headers,
        environment,
      );
    }
    return result;
  } catch (error) {
    console.error('Error in handleGoogleCallbackService:', error);
    return { code: 500, message: 'Internal Server Error', error: error.message || error };
  }
};

export const getGoogleCalendarEventsService = async (
  db,
  projectId,
  enableAuditTrail,
  user,
  headers,
  environment,
  redirectUri,
  collection,
  userIdentifierField,
  fetchOnlyFutureEvents,
  fetchEventsTill,
) => {
  try {
    const googleCalendarPlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
    if (!googleCalendarPlugin) return pluginNotInstalledMessage('Google Calendar');
    const { clientID, clientSecret } = googleCalendarPlugin.setting;
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const googleCalendarAuthTokenCollection = await findOneCollectionService(
      projectId,
      'google_calendar_oauth_tokens',
    );
    if (!googleCalendarAuthTokenCollection)
      return collectionNotFoundMessage('Google Calendar Oauth Tokens');
    const { data: token } = await findItemById(
      db,
      projectId,
      googleCalendarAuthTokenCollection,
      null,
      { userId: { $in: [user?.uuid] } },
    );
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Google Calendar Token not found or expired. Please re-authenticate.',
      };
    }
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
    });
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleGoogleAuthRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        googleCalendarAuthTokenCollection,
        token,
        oauth2Client,
        user?.uuid,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const events = await getAllCalendarEvents(calendar, fetchOnlyFutureEvents, fetchEventsTill);
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { googleCalendarMapping = [], collectionName } = collectionDetails;
    if (!googleCalendarMapping || !googleCalendarMapping.length)
      return { code: 400, message: 'No Google Calendar Mapping found for the given Collection.' };
    if (!events || events.length === 0) {
      return { code: 200, message: 'No events found in Google Calendar', data: [] };
    }
    const mappedItems = prepareCalendarResponseDataForSaving(
      googleCalendarMapping,
      events,
      userIdentifierField,
      user?.uuid,
    );
    await saveBulkDataFromDeveloperAPI(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      mappedItems,
      'string',
      false,
    );
    return {
      code: 200,
      message: 'All Google Calendar events fetched successfully.',
      data: events,
    };
  } catch (error) {
    console.error('Error in getGoogleCalendarEventsService:', error);
    return { code: 500, message: 'Internal Server Error', error: error.message || error };
  }
};

export const syncGoogleCalendarEventsService = async (
  db,
  projectId,
  enableAuditTrail,
  user,
  headers,
  environment,
  redirectUri,
  collection,
  userIdentifierField,
  fetchOnlyFutureEvents,
  fetchEventsTill,
) => {
  try {
    const googleCalendarPlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
    if (!googleCalendarPlugin) return pluginNotInstalledMessage('Google Calendar');
    const { clientID, clientSecret } = googleCalendarPlugin.setting;
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const googleCalendarAuthTokenCollection = await findOneCollectionService(
      projectId,
      'google_calendar_oauth_tokens',
    );
    if (!googleCalendarAuthTokenCollection)
      return collectionNotFoundMessage('Google Calendar Oauth Tokens');
    const { data: token } = await findItemById(
      db,
      projectId,
      googleCalendarAuthTokenCollection,
      null,
      { userId: { $in: [user?.uuid] } },
    );
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Google Calendar Token not found or expired. Please re-authenticate.',
      };
    }
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
    });
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleGoogleAuthRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        googleCalendarAuthTokenCollection,
        token,
        oauth2Client,
        user?.uuid,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { googleCalendarMapping = [], collectionName } = collectionDetails;
    if (!googleCalendarMapping || !googleCalendarMapping.length)
      return { code: 400, message: 'No Google Calendar Mapping found for the given Collection.' };
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const events = await getAllCalendarEvents(calendar, fetchOnlyFutureEvents, fetchEventsTill);
    await bulkDeleteService(db, collectionDetails.collectionName, {
      [userIdentifierField]: { $in: [user?.uuid] },
    });
    if (!events || events.length === 0) {
      return { code: 200, message: 'No events found in Google Calendar', data: [] };
    }
    const mappedItems = prepareCalendarResponseDataForSaving(
      googleCalendarMapping,
      events,
      userIdentifierField,
      user?.uuid,
    );
    await saveBulkDataFromDeveloperAPI(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      mappedItems,
      'string',
      false,
    );
    return {
      code: 200,
      message: 'All Google Calendar events synced successfully.',
      data: events,
    };
  } catch (error) {
    console.error('Error in syncGoogleCalendarEventsService:', error);
    return { code: 500, message: 'Internal Server Error', error: error.message || error };
  }
};

export const createInstantGoogleMeetService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  redirectUri,
  collection,
  summaryField,
  descriptionField,
  duration,
  itemId,
  timeZone,
) => {
  try {
    const googleMeetPlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_MEET);
    if (!googleMeetPlugin) return pluginNotInstalledMessage('Google Meet');
    const { clientID, clientSecret } = googleMeetPlugin.setting;
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) return { code: 404, message: 'No Data Found with provided item ID' };
    const summary = data[summaryField] || 'Meet';
    const description = data[descriptionField] || 'Description';
    if (!duration) duration = 30;
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const googleMeetAuthTokenCollection = await findOneCollectionService(
      projectId,
      'google_meet_oauth_tokens',
    );
    if (!googleMeetAuthTokenCollection)
      return collectionNotFoundMessage('Google Meet Oauth Tokens');
    const { data: token } = await findItemById(db, projectId, googleMeetAuthTokenCollection, null, {
      userId: { $in: [user?.uuid] },
    });
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Google Calendar Token not found. Please authenticate.',
      };
    }
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
    });
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleGoogleAuthRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        googleMeetAuthTokenCollection,
        token,
        oauth2Client,
        user?.uuid,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = {
      summary,
      description,
      start: {
        dateTime: new Date().toISOString(),
        timeZone,
      },
      end: {
        dateTime: new Date(Date.now() + duration * 60 * 1000).toISOString(),
        timeZone,
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
    });
    const meetLink = response.data?.hangoutLink;
    return {
      code: 200,
      message: 'Google Meet created successfully',
      meetLink,
      eventId: response.data.id,
      event: response.data,
    };
  } catch (error) {
    console.error('Error in createInstantGoogleMeetService:', error);
    return {
      code: 500,
      message: 'Failed to create Google Meet',
      error: error.message || error,
    };
  }
};

export const scheduleCalendarEventService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  redirectUri,
  body,
  timeZone,
) => {
  try {
    const {
      collection,
      summaryField,
      descriptionField,
      itemId,
      attendeesField,
      startTimeField,
      sendNotification,
      conferenceProvider,
      checkAvailablity,
      hostField,
      attendeesEmailField,
      loggedInUserAsHost,
    } = body;
    let { duration } = body;
    const googleCalendarPlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
    if (!googleCalendarPlugin) return pluginNotInstalledMessage('Google Calendar');
    const { clientID, clientSecret } = googleCalendarPlugin.setting;
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) return { code: 404, message: 'No Data Found with provided item ID' };
    const attendees = attendeesForGoogleCalendarEvent(attendeesEmailField, attendeesField, data);
    if (!attendees || !attendees.length)
      return { code: 400, message: 'No Attendees found to schedule the event' };
    const hostId = hostForGoogleCalendarEvent(data, hostField, loggedInUserAsHost, user);
    if (!hostId) return { code: 400, message: 'Host ID not found.' };
    const summary = data[summaryField] || 'Meet';
    const description = data[descriptionField] || 'Description';
    const startTime = data[startTimeField];
    if (!duration) duration = 30;
    const startDate = new Date(startTime);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const googleCalendarAuthTokenCollection = await findOneCollectionService(
      projectId,
      'google_calendar_oauth_tokens',
    );
    if (!googleCalendarAuthTokenCollection)
      return collectionNotFoundMessage('Google Calendar Oauth Tokens');
    const { data: token } = await findItemById(
      db,
      projectId,
      googleCalendarAuthTokenCollection,
      null,
      {
        userId: { $in: [hostId] },
      },
    );
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Google Calendar Token not found. Please authenticate.',
      };
    }
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
    });
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleGoogleAuthRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        googleCalendarAuthTokenCollection,
        token,
        oauth2Client,
        hostId,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    if (checkAvailablity) {
      const availability = await checkAvailabilityService(
        oauth2Client,
        attendees,
        startDate,
        endDate,
        timeZone,
      );
      if (!availability.available) {
        return {
          code: 409,
          message: 'Please choose a different time',
          conflicts: availability.conflicts,
        };
      }
    }
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    let event = {
      summary,
      description,
      start: { dateTime: startDate.toISOString(), timeZone },
      end: { dateTime: endDate.toISOString(), timeZone },
      attendees,
    };
    let zoomJoinUrl = null;
    if (conferenceProvider === 'GOOGLE_MEET') {
      event.conferenceData = {
        createRequest: {
          requestId: new Date().getTime().toString(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    } else if (conferenceProvider === 'ZOOM') {
      const zoomMeetingResponse = await handleZoomScheduledMeeting(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        hostId,
        summary,
        description,
        startDate,
        duration,
        timeZone,
      );
      if (zoomMeetingResponse.code !== 200) return zoomMeetingResponse;
      zoomJoinUrl = zoomMeetingResponse?.zoomJoinUrl;
      event.location = zoomMeetingResponse.zoomJoinUrl || null;
    }
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      conferenceDataVersion: 1,
      sendUpdates: sendNotification ? 'all' : 'none',
    });
    if (conferenceProvider === 'ZOOM' && zoomJoinUrl) {
      response.data.hangoutLink = zoomJoinUrl;
    }
    const { googleCalendarMapping = [] } = collectionDetails;
    if (!googleCalendarMapping || !googleCalendarMapping.length)
      return { code: 400, message: 'No Google Calendar Mapping found for the given Collection.' };
    const itemData = prepareCalendarResponseDataForSaving(googleCalendarMapping, response.data);
    await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionDetails,
      itemId,
      itemData[0],
      user,
      headers,
    );
    return {
      code: 200,
      message: 'Event scheduled successfully',
      eventId: response.data.id,
      meetLink: zoomJoinUrl || response.data.hangoutLink || null,
      event: response.data,
    };
  } catch (error) {
    console.error('Error in scheduleCalendarEventService', error);
    return {
      code: 500,
      message: 'Failed to schedule event',
      error: error.message || error,
    };
  }
};

export const deleteCalendarEventService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  redirectUri,
  collection,
  itemId,
  eventIdField,
  sendNotification,
) => {
  try {
    const googleCalendarPlugin = await findInstalledPlugin(projectId, pluginCode.GOOGLE_CALENDAR);
    if (!googleCalendarPlugin) return pluginNotInstalledMessage('Google Calendar');
    const { clientID, clientSecret } = googleCalendarPlugin.setting;
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) return { code: 404, message: 'No Data Found with provided item ID' };
    const eventId = data[eventIdField];
    if (!eventId) return { code: 404, message: 'No Event ID found in the field' };
    const oauth2Client = getOauth2Client(clientID, clientSecret, redirectUri);
    const googleCalendarAuthTokenCollection = await findOneCollectionService(
      projectId,
      'google_calendar_oauth_tokens',
    );
    if (!googleCalendarAuthTokenCollection)
      return collectionNotFoundMessage('Google Calendar Oauth Tokens');
    const { data: token } = await findItemById(
      db,
      projectId,
      googleCalendarAuthTokenCollection,
      null,
      {
        userId: { $in: [user?.uuid] },
      },
    );
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Google Calendar Token not found. Please authenticate.',
      };
    }
    oauth2Client.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      expiry_date: token.expiry_date,
    });
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleGoogleAuthRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        googleCalendarAuthTokenCollection,
        token,
        oauth2Client,
        user?.uuid,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: sendNotification ? 'all' : 'none',
    });
    return { code: 200, message: 'Event Deleted Successfully' };
  } catch (error) {
    console.error('Error in deleteCalendarEventService', error);
    return { code: 500, message: 'Error in Event Deletion', error: error.message || error };
  }
};
