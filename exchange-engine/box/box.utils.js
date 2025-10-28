import axios from 'axios';
import { updateCollectionItem } from '../item/item.service';

export const handleBoxRefreshTokenProcess = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  boxTokenCollection,
  token,
  clientId,
  clientSecret,
  tenant,
) => {
  try {
    const tokenResponse = await axios.post(
      'https://api.box.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    const newTokens = tokenResponse.data;
    const updatedTokenPayload = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      token_type: newTokens.token_type,
      expiry_date: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      userId: user?.uuid,
      tenantId: tenant?.uuid,
    };
    await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      boxTokenCollection,
      token.uuid,
      updatedTokenPayload,
      user,
      headers,
    );
    return {
      code: 200,
      message: 'Box token refreshed successfully',
      token: updatedTokenPayload,
    };
  } catch (err) {
    console.error('Error refreshing Box token:', err.response?.data || err.message);
    return {
      code: 401,
      message: 'Failed to refresh Box token. Please re-authenticate.',
      error: err.response?.data || err.message,
    };
  }
};

export const getOrCreateBoxFolder = async (folderPath, accessToken) => {
  try {
    const folders = folderPath
      .split('/')
      .map((f) => f.trim())
      .filter(Boolean);
    let currentParentId = '0';
    for (const folderName of folders) {
      const searchRes = await axios.get(
        `https://api.box.com/2.0/folders/${currentParentId}/items?fields=id,name&type=folder&limit=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      let existingFolder = searchRes.data.entries.find(
        (f) => f.type === 'folder' && f.name === folderName,
      );
      if (!existingFolder) {
        const createRes = await axios.post(
          `https://api.box.com/2.0/folders`,
          { name: folderName, parent: { id: currentParentId } },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        existingFolder = { id: createRes.data.id };
      }
      currentParentId = existingFolder.id;
    }
    return {
      code: 200,
      message: `Folder path '${folderPath}' created or already exists`,
      data: { id: currentParentId },
    };
  } catch (err) {
    console.error(
      `Error in getOrCreateBoxFolder (${folderPath}):`,
      err.response?.data || err.message,
    );
    return {
      code: err.response?.status || 500,
      message: `Failed to get or create folder path '${folderPath}'`,
      error: err.response?.data || err.message,
    };
  }
};
