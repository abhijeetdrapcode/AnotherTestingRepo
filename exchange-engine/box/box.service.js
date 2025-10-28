import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin, loadS3PluginConfig } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { findOneCollectionService } from '../collection/collection.service';
import { findItemById, saveCollectionItem, updateCollectionItem } from '../item/item.service';
import axios from 'axios';
import { getOrCreateBoxFolder, handleBoxRefreshTokenProcess } from './box.utils';
import { cryptService } from '../middleware/encryption.middleware';
import { privateUrl } from '../upload-api/fileUpload.service';
import { getProjectEncryption } from '../project/project.service';
import { createS3Client } from 'drapcode-utility';
import FormData from 'form-data';

export const boxAuthService = async (
  projectId,
  user,
  redirectUri,
  successRedirectUrl,
  errorRedirectUrl,
  tenant,
) => {
  try {
    const boxPlugin = await findInstalledPlugin(projectId, pluginCode.BOX);
    if (!boxPlugin) return pluginNotInstalledMessage('Box');
    const { clientID } = boxPlugin.setting;
    const state = encodeURIComponent(
      JSON.stringify({
        successRedirectUrl,
        errorRedirectUrl,
        userId: user?.uuid,
        tenantId: tenant?.uuid,
      }),
    );
    const authUrl = `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${clientID}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${state}`;
    return { code: 200, message: 'Box Auth URL Generated', authUrl };
  } catch (error) {
    console.error('🚨 Error in boxAuthService:', error);
    return {
      code: 500,
      message: 'Unexpected error occurred while generating Box auth URL',
      error: error.message || error,
    };
  }
};

export const handleBoxCallbackService = async (
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
) => {
  try {
    const boxPlugin = await findInstalledPlugin(projectId, pluginCode.BOX);
    if (!boxPlugin) return pluginNotInstalledMessage('Box');
    const { clientID, clientSecret } = boxPlugin.setting;
    const tokenRes = await axios.post(
      'https://api.box.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientID,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const tokens = tokenRes.data;
    const boxTokenCollection = await findOneCollectionService(projectId, 'box_oauth_tokens');
    if (!boxTokenCollection) return collectionNotFoundMessage('Box OAuth Tokens');
    let query = { userId: { $in: [userId] } };
    if (tenantId) {
      query = { tenantId: { $in: [tenantId] } };
    }
    const { data: existingToken } = await findItemById(
      db,
      projectId,
      boxTokenCollection,
      null,
      query,
    );
    const now = new Date();
    const expiry_date = new Date(now.getTime() + tokens.expires_in * 1000).toISOString();
    const tokenPayload = {
      ...tokens,
      userId,
      updatedAt: now,
      expiry_date,
      tenantId,
    };
    let result;
    if (existingToken) {
      result = await updateCollectionItem(
        db,
        projectId,
        environment,
        enableAuditTrail,
        boxTokenCollection,
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
        boxTokenCollection,
        tokenPayload,
        user,
        headers,
        environment,
      );
    }
    return { code: 200, message: 'Box tokens saved', data: result };
  } catch (error) {
    console.error('🚨 Error in handleBoxCallbackService:', error.response?.data || error);
    return {
      code: error.response?.status || 500,
      message: 'Failed to handle Box OAuth callback',
      error: error.response?.data || error.message || error,
    };
  }
};

export const uploadFileToBoxService = async (
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
) => {
  try {
    const boxPlugin = await findInstalledPlugin(projectId, pluginCode.BOX);
    if (!boxPlugin) return pluginNotInstalledMessage('Box');
    const { clientID, clientSecret } = boxPlugin.setting;
    const boxTokenCollection = await findOneCollectionService(projectId, 'box_oauth_tokens');
    if (!boxTokenCollection) return collectionNotFoundMessage('Box OAuth Tokens');
    let query = { userId: { $in: [user?.uuid] } };
    if (tenant) {
      query = { tenantId: { $in: [tenant?.uuid] } };
    }
    let { data: tokenItem } = await findItemById(db, projectId, boxTokenCollection, null, query);
    if (!tokenItem || !tokenItem.access_token) {
      return {
        code: 400,
        message: 'Box OAuth tokens not found for the user. Please authenticate first.',
      };
    }
    const { parentFolder = '' } = tokenItem;
    const now = new Date();
    if (new Date(tokenItem.expiry_date) <= now) {
      const refreshTokenResponse = await handleBoxRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        boxTokenCollection,
        tokenItem,
        clientID,
        clientSecret,
        tenant,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
      tokenItem = refreshTokenResponse.token;
    }
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const itemResponse = await findItemById(db, projectId, collectionDetails, itemId);
    if (itemResponse.code !== 200) return itemResponse;
    itemResponse.data = await cryptService(
      itemResponse.data,
      projectId,
      collectionDetails,
      true,
      false,
      true,
    );
    const fileData = itemResponse.data[fileField];
    const folderName = parentFolder
      ? `${parentFolder}/${itemResponse.data[folderField]}`
      : itemResponse.data[folderField];
    if (!fileData || (Array.isArray(fileData) && fileData.length === 0)) {
      return { code: 400, message: 'No files found in the specified file field.' };
    }
    const accessToken = tokenItem.access_token;
    let finalParentId = '0';
    if (folderName) {
      const folderResponse = await getOrCreateBoxFolder(folderName, accessToken);
      if (folderResponse.code !== 200) return folderResponse;
      finalParentId = folderResponse.data.id;
    }
    const filesArray = Array.isArray(fileData) ? fileData : [fileData];
    const uploadResults = [];
    for (const file of filesArray) {
      try {
        const { key, isEncrypted, originalName } = file;
        const { encryption } = await getProjectEncryption(projectId);
        const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
          projectId,
          environment,
        );
        const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
        const s3Client = createS3Client(awsConfig);
        const formData = new FormData();
        const fileBufferData = await privateUrl(key, isEncrypted, encryption, s3Client, bucket);
        formData.append('file', fileBufferData, { filename: originalName });
        formData.append('parent_id', finalParentId);
        const uploadRes = await axios.post(
          'https://upload.box.com/api/2.0/files/content',
          formData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...formData.getHeaders(),
            },
          },
        );
        if (uploadRes.status === 201) {
          uploadResults.push({
            file: originalName,
            status: 'success',
            data: uploadRes.data,
            code: uploadRes.status,
          });
        } else {
          uploadResults.push({
            file: originalName,
            status: 'failed',
            error: uploadRes.data,
            code: uploadRes.status,
          });
        }
      } catch (error) {
        console.error(`Error uploading file ${file.originalName} to Box:`, error);
        uploadResults.push({
          file: file.originalName || 'unknown',
          status: 'failed',
          error: error.response?.data || error.message,
        });
      }
    }
    let finalCode = 200;
    let finalMessage = 'All files uploaded successfully';
    const firstFailed = uploadResults.find((r) => r.status !== 'success');
    if (firstFailed) {
      finalCode = firstFailed.code || 400;
      finalMessage = 'Some files failed to upload';
    }
    return {
      code: finalCode,
      message: finalMessage,
      results: uploadResults,
    };
  } catch (error) {
    console.error('Error in uploadFileToBoxService:', error);
    return {
      code: 500,
      message: 'Unexpected error occurred while uploading file(s) to Box',
      error: error.response?.data || error.message || error,
    };
  }
};

export const getBoxFoldersService = async (
  db,
  projectId,
  enableAuditTrail,
  environment,
  user,
  headers,
  tenant,
) => {
  try {
    const boxPlugin = await findInstalledPlugin(projectId, pluginCode.BOX);
    if (!boxPlugin) return pluginNotInstalledMessage('Box');
    const { clientID, clientSecret } = boxPlugin.setting;
    const boxTokenCollection = await findOneCollectionService(projectId, 'box_oauth_tokens');
    if (!boxTokenCollection) return collectionNotFoundMessage('Box OAuth Tokens');
    let query = { userId: { $in: [user?.uuid] } };
    if (tenant) {
      query = { tenantId: { $in: [tenant?.uuid] } };
    }
    let { data: tokenItem } = await findItemById(db, projectId, boxTokenCollection, null, query);
    if (!tokenItem || !tokenItem.access_token) {
      return {
        code: 400,
        message: 'Box OAuth tokens not found for the user. Please authenticate first.',
      };
    }
    const now = new Date();
    if (new Date(tokenItem.expiry_date) <= now) {
      const refreshTokenResponse = await handleBoxRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        boxTokenCollection,
        tokenItem,
        clientID,
        clientSecret,
        tenant,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
      tokenItem = refreshTokenResponse.token;
    }
    const response = await axios.get(`https://api.box.com/2.0/folders/0/items`, {
      headers: { Authorization: `Bearer ${tokenItem.access_token}` },
      params: { fields: 'id,name,type' },
    });
    const folders = response.data.entries.filter((entry) => entry.type === 'folder');
    return { code: 200, message: 'All Box Folders Fetched', data: folders };
  } catch (error) {
    console.error('Error in getBoxFoldersService:', error);
    return {
      code: 500,
      message: 'Internal Server Error',
      error: error.response?.data || error.message || error,
    };
  }
};

export const saveBoxFolderService = async (
  db,
  projectId,
  enableAuditTrail,
  environment,
  user,
  headers,
  tenant,
  parentFolder,
) => {
  try {
    const boxPlugin = await findInstalledPlugin(projectId, pluginCode.BOX);
    if (!boxPlugin) return pluginNotInstalledMessage('Box');
    const boxTokenCollection = await findOneCollectionService(projectId, 'box_oauth_tokens');
    if (!boxTokenCollection) return collectionNotFoundMessage('Box OAuth Tokens');
    let query = { userId: { $in: [user?.uuid] } };
    if (tenant) {
      query = { tenantId: { $in: [tenant?.uuid] } };
    }
    const { data: tokenItem } = await findItemById(db, projectId, boxTokenCollection, null, query);
    if (!tokenItem) return { code: 404, message: 'Token not found' };
    const updatedTokenPayload = {
      access_token: tokenItem.access_token,
      refresh_token: tokenItem.refresh_token,
      token_type: tokenItem.token_type,
      expiry_date: tokenItem.expiry_date,
      userId: user?.uuid,
      tenantId: tenant?.uuid,
      parentFolder: parentFolder,
    };
    const updateToken = await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      boxTokenCollection,
      tokenItem.uuid,
      updatedTokenPayload,
      user,
      headers,
    );
    return updateToken;
  } catch (error) {
    console.error('Error in saveBoxFolderService:', error);
    return {
      code: 500,
      message: 'Internal Server Error',
      error: error.message || error,
    };
  }
};
