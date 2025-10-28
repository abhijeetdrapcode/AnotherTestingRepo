import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import axios from 'axios';
import { findOneCollectionService } from '../collection/collection.service';
import { findItemById, saveCollectionItem, updateCollectionItem } from '../item/item.service';
import { handleZoomRefreshTokenProcess } from './zoom.utils';

export const zoomAuthService = async (
  projectId,
  user,
  redirectUri,
  successRedirectUrl,
  errorRedirectUrl,
) => {
  try {
    const zoomPlugin = await findInstalledPlugin(projectId, pluginCode.ZOOM);
    if (!zoomPlugin) return pluginNotInstalledMessage('Zoom');
    const { clientID } = zoomPlugin.setting;
    const state = encodeURIComponent(
      JSON.stringify({ successRedirectUrl, errorRedirectUrl, userId: user?.uuid }),
    );
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientID}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${state}`;
    return { code: 200, message: 'Zoom Auth URL Generated', authUrl };
  } catch (error) {
    console.error('Error in zoomAuthService', error);
    return { code: 500, message: 'Internal Server Error', error: error?.message || error };
  }
};

export const handleZoomCallbackService = async (
  db,
  projectId,
  enableAuditTrail,
  environment,
  headers,
  user,
  redirectUri,
  code,
  userId,
) => {
  try {
    const zoomPlugin = await findInstalledPlugin(projectId, pluginCode.ZOOM);
    if (!zoomPlugin) return pluginNotInstalledMessage('Zoom');
    const { clientID, clientSecret } = zoomPlugin.setting;
    let tokenRes;
    try {
      tokenRes = await axios.post('https://zoom.us/oauth/token', null, {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        },
        auth: { username: clientID, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      console.error('🔴 Zoom Token Exchange Failed:', err.response?.data || err.message);
      const zoomError = err.response?.data || {};
      let errorMessage = 'Failed to exchange authorization code for token.';
      if (zoomError.reason) errorMessage = `Zoom Error: ${zoomError.reason}`;
      if (zoomError.error === 'invalid_client') errorMessage = 'Invalid Zoom Client ID/Secret.';
      if (zoomError.error === 'invalid_grant')
        errorMessage = 'Invalid or expired authorization code.';
      return {
        code: err.response?.status || 500,
        message: errorMessage,
        error: zoomError,
      };
    }
    if (!tokenRes?.data) {
      return { code: 500, message: 'Zoom did not return a token response.' };
    }
    const tokens = tokenRes.data;
    const zoomTokenCollection = await findOneCollectionService(projectId, 'zoom_oauth_tokens');
    if (!zoomTokenCollection) return collectionNotFoundMessage('Zoom OAUTH Tokens');
    const { data: existingToken } = await findItemById(db, projectId, zoomTokenCollection, null, {
      userId: { $in: [userId] },
    });
    const now = new Date();
    const expiry_date = new Date(now.getTime() + tokens.expires_in * 1000).toISOString();
    const tokenPayload = {
      ...tokens,
      userId: userId || '',
      updatedAt: new Date(),
      expiry_date,
    };
    let result;
    if (existingToken) {
      result = await updateCollectionItem(
        db,
        projectId,
        environment,
        enableAuditTrail,
        zoomTokenCollection,
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
        zoomTokenCollection,
        tokenPayload,
        user,
        headers,
        environment,
      );
    }
    return result;
  } catch (error) {
    console.error('Error in handleZoomCallbackService:', error);
    return { code: 500, message: 'Internal Server Error', error: error.message || error };
  }
};

export const createInstantZoomMeetingService = async (
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
  timeZone,
) => {
  try {
    const zoomPlugin = await findInstalledPlugin(projectId, pluginCode.ZOOM);
    if (!zoomPlugin) return pluginNotInstalledMessage('Zoom');
    const { clientID, clientSecret } = zoomPlugin.setting;
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) return { code: 404, message: 'No Data Found with provided item ID' };
    const topic = data[summaryField] || 'Zoom Meeting';
    const agenda = data[descriptionField] || 'Discussion';
    if (!duration) duration = 30;
    const zoomTokenCollection = await findOneCollectionService(projectId, 'zoom_oauth_tokens');
    if (!zoomTokenCollection) return collectionNotFoundMessage('Zoom OAUTH Tokens');
    const { data: token } = await findItemById(db, projectId, zoomTokenCollection, null, {
      userId: { $in: [user?.uuid] },
    });
    if (!token || !token.access_token) {
      return {
        code: 400,
        message: 'Zoom Token not found. Please authenticate.',
      };
    }
    let accessToken = token.access_token;
    if (Date.now() >= new Date(token.expiry_date).getTime()) {
      const refreshTokenResponse = await handleZoomRefreshTokenProcess(
        db,
        projectId,
        environment,
        enableAuditTrail,
        user,
        headers,
        zoomTokenCollection,
        token,
        clientID,
        clientSecret,
        user?.uuid,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
      const { token: updatedToken } = refreshTokenResponse;
      accessToken = updatedToken.access_token;
    }
    const meetingPayload = {
      topic,
      type: 1,
      agenda,
      duration,
      timezone: timeZone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
      },
    };
    const response = await axios.post('https://api.zoom.us/v2/users/me/meetings', meetingPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    return {
      code: 200,
      message: 'Zoom meeting created successfully',
      meetingId: response.data.id,
      joinUrl: response.data.join_url,
      startUrl: response.data.start_url,
      meeting: response.data,
    };
  } catch (error) {
    console.error('Error in createInstantZoomMeetingService:', error);
    return {
      code: 500,
      message: 'Failed to create Zoom meeting',
      error: error.response?.data || error.message || error,
    };
  }
};
