import {
  createInstantGoogleMeetService,
  deleteCalendarEventService,
  getGoogleCalendarEventsService,
  googleAuthService,
  handleGoogleCallbackService,
  scheduleCalendarEventService,
  syncGoogleCalendarEventsService,
} from './google.service';
import { getGoogleOauthRedirectURI } from './google.utils';

export const googleCalendarAuth = async (req, res, next) => {
  try {
    const { projectId, body, user } = req;
    const { successRedirectUrl, errorRedirectUrl } = body;
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await googleAuthService(
      projectId,
      successRedirectUrl,
      errorRedirectUrl,
      redirectUri,
      user,
      'calendar',
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in googleCalendarAuth:', error);
    next(error);
  }
};

export const handleGoogleCalendarCallback = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, headers, user, query } = req;
    const { code, state } = query;
    const { successRedirectUrl, errorRedirectUrl, userId } = JSON.parse(decodeURIComponent(state));
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await handleGoogleCallbackService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      headers,
      user,
      code,
      redirectUri,
      userId,
      'calendar',
    );
    if ([200, 201].includes(response.code)) {
      return res.redirect(successRedirectUrl);
    }
    return res.redirect(errorRedirectUrl);
  } catch (error) {
    console.error('Error in handleGoogleCalendarCallback:', error);
    next(error);
  }
};

export const getGoogleCalendarEvents = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, user, headers, environment, body } = req;
    const { collection, userIdentifierField, fetchOnlyFutureEvents, fetchEventsTill } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await getGoogleCalendarEventsService(
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
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in  getGoogleCalendarEvents:', error);
    next(error);
  }
};

export const syncGoogleCalendarEvents = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, user, headers, environment, body } = req;
    const { collection, userIdentifierField, fetchOnlyFutureEvents, fetchEventsTill } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await syncGoogleCalendarEventsService(
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
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in syncGoogleCalendarEvents:', error);
    next(error);
  }
};

export const googleMeetAuth = async (req, res, next) => {
  try {
    const { projectId, body, user } = req;
    const { successRedirectUrl, errorRedirectUrl } = body;
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'meet');
    const response = await googleAuthService(
      projectId,
      successRedirectUrl,
      errorRedirectUrl,
      redirectUri,
      user,
      'meet',
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in googleMeetAuth:', error);
    next(error);
  }
};

export const handleGoogleMeetCallback = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, headers, user, query } = req;
    const { code, state } = query;
    const { successRedirectUrl, errorRedirectUrl, userId } = JSON.parse(decodeURIComponent(state));
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'meet');
    const response = await handleGoogleCallbackService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      headers,
      user,
      code,
      redirectUri,
      userId,
      'meet',
    );
    if ([200, 201].includes(response.code)) {
      return res.redirect(successRedirectUrl);
    }
    return res.redirect(errorRedirectUrl);
  } catch (error) {
    console.error('Error in handleGoogleMeetCallback:', error);
    next(error);
  }
};

export const createInstantGoogleMeet = async (req, res, next) => {
  try {
    const { db, projectId, user, body, environment, enableAuditTrail, headers, project } = req;
    const { collection, summaryField, descriptionField, duration, itemId } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item Id is required' });
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'meet');
    const response = await createInstantGoogleMeetService(
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
      project.timezone,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in createInstantGoogleMeet:', error);
    next(error);
  }
};

export const scheduleCalendarEvent = async (req, res, next) => {
  try {
    const { db, projectId, user, body, environment, enableAuditTrail, headers, project } = req;
    const { collection, itemId } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item Id is required' });
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await scheduleCalendarEventService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      user,
      headers,
      redirectUri,
      body,
      project.timezone,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in scheduleCalendarEvent:', error);
    next(error);
  }
};

export const deleteCalendarEvent = async (req, res, next) => {
  try {
    const { db, projectId, body, environment, enableAuditTrail, user, headers } = req;
    const { collection, itemId, eventIdField, sendNotification } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item Id is required' });
    const redirectUri = getGoogleOauthRedirectURI(req.get('host'), 'calendar');
    const response = await deleteCalendarEventService(
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
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in deleteCalendarEvent:', error);
    next(error);
  }
};
