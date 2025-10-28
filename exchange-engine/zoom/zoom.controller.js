import { prepareRedirectUri } from '../utils/utils';
import {
  createInstantZoomMeetingService,
  handleZoomCallbackService,
  zoomAuthService,
} from './zoom.service';

export const zoomAuth = async (req, res, next) => {
  try {
    const { projectId, body, user } = req;
    const { successRedirectUrl, errorRedirectUrl } = body;
    const redirectUri = prepareRedirectUri(req.get('host'), 'zoom');
    const response = await zoomAuthService(
      projectId,
      user,
      redirectUri,
      successRedirectUrl,
      errorRedirectUrl,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in zoomAuth:', error);
    next(error);
  }
};

export const handleZoomCallback = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, headers, user, query } = req;
    const { code, state } = query;
    const decodedState = decodeURIComponent(state)
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
    const { successRedirectUrl, errorRedirectUrl, userId } = JSON.parse(decodedState);
    const redirectUri = prepareRedirectUri(req.get('host'), 'zoom');
    const response = await handleZoomCallbackService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      headers,
      user,
      redirectUri,
      code,
      userId,
    );
    if ([200, 201].includes(response.code)) {
      return res.redirect(successRedirectUrl);
    }
    return res.redirect(errorRedirectUrl);
  } catch (error) {
    console.error('Error in handleZoomCallback', error);
    next(error);
  }
};

export const createInstantZoomMeet = async (req, res, next) => {
  try {
    const { db, projectId, user, body, environment, enableAuditTrail, headers, project } = req;
    const { collection, summaryField, descriptionField, duration, itemId } = body;
    if (!collection) return res.status(400).send({ code: 400, message: 'Collection is required' });
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item Id is required' });
    const response = await createInstantZoomMeetingService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      user,
      headers,
      collection,
      summaryField,
      descriptionField,
      duration,
      itemId,
      project.timezone,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in create instantZoomMeet', error);
    next(error);
  }
};
