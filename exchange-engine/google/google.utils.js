import { updateCollectionItem } from '../item/item.service';
import moment from 'moment';
const { google } = require('googleapis');

export const getOauth2Client = (clientId, clientSecret, redirectUri) => {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client;
};

export const getGoogleOauthRedirectURI = (host, service) => {
  return `https://${host}/api/v1/google/google-${service}/auth/callback`;
};

export const parseTimezoneOffset = (tzString) => {
  const match = tzString.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1].startsWith('-') ? -1 : 1;
  const hours = parseInt(match[1].replace('+', '').replace('-', ''), 10);
  const minutes = parseInt(match[2], 10);

  return sign * (hours * 60 + minutes);
};

export const prepareCalendarResponseDataForSaving = (
  googleCalendarMapping,
  responseData,
  userIdentifierField,
  userUuid,
) => {
  const eventsArray = Array.isArray(responseData) ? responseData : [responseData];
  const result = [];
  for (const event of eventsArray) {
    const itemData = {};
    for (const mapping of googleCalendarMapping) {
      const { collectionField, googleCalendarResponse } = mapping;
      if (!googleCalendarResponse) continue;
      const pathParts = googleCalendarResponse.split('.');
      let value = event;
      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        itemData[collectionField] = value;
      }
    }
    if (userIdentifierField) {
      itemData[userIdentifierField] = userUuid || '';
    }
    result.push(itemData);
  }
  return result;
};

export const attendeesForGoogleCalendarEvent = (attendeesEmailField, attendeesField, data) => {
  let attendees = [];
  if (attendeesEmailField && attendeesField) {
    let referenceObjects = data[attendeesField] || [];
    if (!Array.isArray(referenceObjects)) {
      referenceObjects = [referenceObjects];
    }
    for (const refObj of referenceObjects) {
      const emailValue = refObj?.[attendeesEmailField];
      if (!emailValue) continue;
      if (Array.isArray(emailValue)) {
        attendees.push(...emailValue.map((e) => ({ email: e })));
      } else {
        attendees.push({ email: emailValue });
      }
    }
  } else {
    let rawAttendees = data[attendeesField] || [];
    if (!Array.isArray(rawAttendees)) rawAttendees = [rawAttendees];
    attendees = rawAttendees.map((a) => ({ email: a }));
  }
  return attendees;
};

export const hostForGoogleCalendarEvent = (data, hostField, loggedInUserAsHost, user) => {
  if (loggedInUserAsHost && user?.uuid) {
    return user.uuid;
  }
  let hostIdValue = data[hostField];
  let hostId;
  if (Array.isArray(hostIdValue)) {
    hostId = hostIdValue.length > 0 ? hostIdValue[0]?.uuid : undefined;
  } else if (typeof hostIdValue === 'object' && hostIdValue !== null) {
    hostId = hostIdValue.uuid;
  } else if (typeof hostIdValue === 'string') {
    hostId = hostIdValue;
  } else {
    hostId = undefined;
  }
  return hostId;
};

export const handleGoogleAuthRefreshTokenProcess = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  googleAuthTokenCollection,
  token,
  oauth2Client,
  hostId,
) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: token.refresh_token,
    });
    const { token: newAccessToken, res } = await oauth2Client.getAccessToken();
    if (!newAccessToken) {
      return {
        code: 401,
        message: 'No access token returned by Google during refresh.',
      };
    }
    const rawExpiryDate = res?.data?.expiry_date || Date.now() + 3500 * 1000;
    const isoExpiryDate = new Date(rawExpiryDate).toISOString();
    oauth2Client.setCredentials({
      access_token: newAccessToken,
      refresh_token: token.refresh_token,
      expiry_date: isoExpiryDate,
      token_type: 'Bearer',
      scope: token.scope,
    });
    const updateResult = await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      googleAuthTokenCollection,
      token.uuid,
      {
        access_token: newAccessToken,
        expiry_date: isoExpiryDate,
        token_type: 'Bearer',
        scope: token.scope,
        userId: hostId,
      },
      user,
      headers,
    );
    return updateResult;
  } catch (refreshError) {
    console.error('Error refreshing Google token:', refreshError);
    return {
      code: 401,
      message: 'Google access token expired and refresh failed. Please re-authenticate.',
      error: refreshError.message || refreshError,
    };
  }
};

export const checkAvailabilityService = async (
  auth,
  attendees,
  startTime,
  endTime,
  timeZoneString,
) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const requestBody = {
    timeMin: startTime,
    timeMax: endTime,
    items: attendees.map((email) => ({ id: email.email })),
  };
  const response = await calendar.freebusy.query({ requestBody });
  const calendars = response.data.calendars;
  const conflicts = [];
  const timezoneOffset = parseTimezoneOffset(timeZoneString);
  for (const [email, data] of Object.entries(calendars)) {
    if (data.busy && data.busy.length > 0) {
      const convertedSlots = data.busy.map((slot) => {
        const start = moment
          .utc(slot.start)
          .utcOffset(timezoneOffset)
          .format('YYYY-MM-DD HH:mm:ss');
        const end = moment.utc(slot.end).utcOffset(timezoneOffset).format('YYYY-MM-DD HH:mm:ss');
        return { start, end };
      });
      conflicts.push({ email, busySlots: convertedSlots });
    }
  }
  if (conflicts.length > 0) {
    return { available: false, conflicts };
  }
  return { available: true };
};

export const getAllCalendarEvents = async (
  calendar,
  fetchOnlyFutureEvents = false,
  fetchEventsTill,
) => {
  let allEvents = [];
  let pageToken = null;
  const queryOptions = {
    calendarId: 'primary',
    singleEvents: true,
    orderBy: 'startTime',
    pageToken: undefined,
  };
  if (fetchOnlyFutureEvents) {
    queryOptions.timeMin = new Date().toISOString();
  }
  const timeMax = getTimeMax(fetchEventsTill);
  if (timeMax) {
    queryOptions.timeMax = timeMax;
  }
  do {
    if (pageToken) queryOptions.pageToken = pageToken;
    const response = await calendar.events.list(queryOptions);
    allEvents = allEvents.concat(response.data.items || []);
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return allEvents;
};

export const getTimeMax = (fetchEventsTill) => {
  if (fetchEventsTill === 'all' || !fetchEventsTill) return undefined;
  const now = new Date();
  switch (fetchEventsTill) {
    case '1w':
      now.setDate(now.getDate() + 7);
      break;
    case '2w':
      now.setDate(now.getDate() + 14);
      break;
    case '1m':
      now.setMonth(now.getMonth() + 1);
      break;
    case '3m':
      now.setMonth(now.getMonth() + 3);
      break;
    case '6m':
      now.setMonth(now.getMonth() + 6);
      break;
    case '1y':
      now.setFullYear(now.getFullYear() + 1);
      break;
  }
  return now.toISOString();
};
