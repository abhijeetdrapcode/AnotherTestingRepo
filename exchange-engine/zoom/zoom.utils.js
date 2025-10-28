import axios from 'axios';
import { findItemById, updateCollectionItem } from '../item/item.service';
import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { findOneCollectionService } from '../collection/collection.service';

export const handleZoomRefreshTokenProcess = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  zoomTokenCollection,
  token,
  clientId,
  clientSecret,
  hostId,
) => {
  try {
    if (!clientId || !clientSecret) {
      return { code: 400, message: 'Zoom Client ID/Secret missing in plugin configuration' };
    }
    const tokenResponse = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    const newTokens = tokenResponse.data;
    const updatedTokenPayload = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      scope: newTokens.scope,
      token_type: newTokens.token_type,
      expiry_date: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      userId: hostId,
    };
    await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      zoomTokenCollection,
      token.uuid,
      updatedTokenPayload,
      user,
      headers,
    );
    return {
      code: 200,
      message: 'Zoom token refreshed successfully',
      token: updatedTokenPayload,
    };
  } catch (err) {
    console.error('Error refreshing Zoom token:', err.response?.data || err.message);
    return {
      code: 401,
      message: 'Failed to refresh Zoom token. Please re-authenticate.',
      error: err.response?.data || err.message,
    };
  }
};

export const handleZoomScheduledMeeting = async (
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
) => {
  try {
    const zoomPlugin = await findInstalledPlugin(projectId, pluginCode.ZOOM);
    if (!zoomPlugin) return pluginNotInstalledMessage('Zoom');
    const { clientID, clientSecret } = zoomPlugin.setting;
    const zoomTokenCollection = await findOneCollectionService(projectId, 'zoom_oauth_tokens');
    if (!zoomTokenCollection) return collectionNotFoundMessage('Zoom OAuth Tokens');
    const { data: token } = await findItemById(db, projectId, zoomTokenCollection, null, {
      userId: { $in: [hostId] },
    });
    if (!token || !token.access_token) {
      return { code: 400, message: 'Zoom Token not found. Please authenticate.' };
    }
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
        hostId,
      );
      if (refreshTokenResponse.code !== 200) return refreshTokenResponse;
    }
    const zoomMeetingPayload = {
      topic: summary,
      type: 2,
      agenda: description,
      start_time: startDate.toISOString(),
      duration,
      timezone: timeZone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        waiting_room: false,
      },
    };
    const zoomRes = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      zoomMeetingPayload,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return {
      code: 200,
      message: 'Meeting Scheduled',
      zoomJoinUrl: zoomRes.data.join_url,
    };
  } catch (error) {
    console.error('Error in handleZoomScheduledMeeting:', error);
    return {
      code: 500,
      message: 'Failed to create Zoom meeting',
      error: error.response?.data || error.message || error,
    };
  }
};
