import { prepareRedirectUri } from '../utils/utils';
import {
  boxAuthService,
  handleBoxCallbackService,
  uploadFileToBoxService,
  getBoxFoldersService,
  saveBoxFolderService,
} from './box.service';

export const boxAuth = async (req, res, next) => {
  try {
    const { projectId, body, user, tenant } = req;
    const { successRedirectUrl, errorRedirectUrl } = body;
    const redirectUri = prepareRedirectUri(req.get('host'), 'box');
    const response = await boxAuthService(
      projectId,
      user,
      redirectUri,
      successRedirectUrl,
      errorRedirectUrl,
      tenant,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in boxAuth:', error);
    next(error);
  }
};

export const handleBoxCallback = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, headers, user, query } = req;
    const { code, state } = query;
    const decodedState = decodeURIComponent(state)
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
    const { successRedirectUrl, errorRedirectUrl, userId, tenantId } = JSON.parse(decodedState);
    const redirectUri = prepareRedirectUri(req.get('host'), 'box');
    const response = await handleBoxCallbackService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      code,
      redirectUri,
      userId,
      user,
      headers,
      tenantId,
    );
    if ([200, 201].includes(response.code)) {
      return res.redirect(successRedirectUrl);
    }
    return res.redirect(errorRedirectUrl);
  } catch (error) {
    console.error('Error in handleBoxCallback', error);
    next(error);
  }
};

export const uploadFileToBox = async (req, res, next) => {
  try {
    const { db, projectId, body, user, headers, enableAuditTrail, environment, tenant } = req;
    const { fileField, folderField, itemId, collection } = body;
    if (!itemId) return res.status(400).send({ code: 400, message: 'Item ID is required' });
    const response = await uploadFileToBoxService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      user,
      headers,
      fileField,
      folderField,
      itemId,
      collection,
      tenant,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in uploadFileToBox:', error);
    next(error);
  }
};

export const getBoxFolders = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, user, headers, tenant } = req;
    const response = await getBoxFoldersService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      user,
      headers,
      tenant,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in getBoxFolders', error);
    next(error);
  }
};

export const saveBoxFolder = async (req, res, next) => {
  try {
    const { db, projectId, enableAuditTrail, environment, user, headers, tenant, body } = req;
    const { parentFolder } = body;
    if (!parentFolder) {
      return res.status(400).send({ code: 400, message: 'Parent Folder is Required.' });
    }
    const response = await saveBoxFolderService(
      db,
      projectId,
      enableAuditTrail,
      environment,
      user,
      headers,
      tenant,
      parentFolder,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in saveBoxFolder', error);
    next(error);
  }
};
