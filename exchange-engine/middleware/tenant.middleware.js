import { processItemEncryptDecrypt } from 'drapcode-utility';
import {
  encRefFieldCollections,
  multiTenantCollService,
  subTenantCollService,
  userSettingCollService,
} from '../collection/collection.service';
import { findItemById } from '../item/item.service';
import { getProjectEncryption } from '../project/project.service';

export const tenantMiddleware = async (req, res, next) => {
  try {
    const { headers, user, db, projectId } = req;
    let tenantId;
    tenantId = headers['x-tenant-id'];
    let subTenantId = headers['x-sub-tenant-id'];
    if (!tenantId) tenantId = extractFirstTenantIdFromUser(user);
    if (!subTenantId)
      subTenantId = await extractFirstSubTenantIdFromUserAndTenantId(db, projectId, user, tenantId);
    req.tenant = await getTenantById(db, projectId, tenantId);
    if (subTenantId) {
      req.subTenant = await getSubTenantById(db, projectId, subTenantId);
    }
    next();
  } catch (error) {
    console.error('\n error :>> ', error);
  }
};

export const getTenantById = async (dbConnection, projectId, tenantId) => {
  let tenant = null;
  if (tenantId) {
    const collectionData = await multiTenantCollService(projectId);
    if (collectionData) {
      tenant = await findItemById(dbConnection, projectId, collectionData, tenantId, null);
      tenant = tenant && tenant.data ? tenant.data : '';
      const { enableEncryption, encryption } = await getProjectEncryption(projectId);
      if (enableEncryption && encryption) {
        const collectionFields = collectionData ? collectionData.fields : [];
        const encryptedRefCollections = await encRefFieldCollections(projectId, collectionFields);
        const cryptResponse = await processItemEncryptDecrypt(
          tenant,
          collectionFields,
          encryption,
          true,
          encryptedRefCollections,
        );
        tenant = cryptResponse;
      }
    }
  }
  return tenant;
};

export const getUserSettingById = async (dbConnection, projectId, userSettingId) => {
  let userSetting = null;
  if (userSettingId) {
    const collectionData = await userSettingCollService(projectId);
    if (collectionData) {
      userSetting = await findItemById(
        dbConnection,
        projectId,
        collectionData,
        userSettingId,
        null,
      );
      userSetting = userSetting && userSetting.data ? userSetting.data : '';
      const { enableEncryption, encryption } = await getProjectEncryption(projectId);
      if (enableEncryption && encryption) {
        const collectionFields = collectionData ? collectionData.fields : [];
        const encryptedRefCollections = await encRefFieldCollections(projectId, collectionFields);
        const cryptResponse = await processItemEncryptDecrypt(
          userSetting,
          collectionFields,
          encryption,
          true,
          encryptedRefCollections,
        );
        userSetting = cryptResponse;
      }
    }
  }
  return userSetting;
};

export const getSubTenantById = async (dbConnection, projectId, subTenantId) => {
  let subTenant = null;
  if (subTenantId) {
    const collectionData = await subTenantCollService(projectId);
    if (collectionData) {
      subTenant = await findItemById(dbConnection, projectId, collectionData, subTenantId, null);
      subTenant = subTenant && subTenant.data ? subTenant.data : '';
      const { enableEncryption, encryption } = await getProjectEncryption(projectId);
      if (enableEncryption && encryption) {
        const collectionDataFields = collectionData ? collectionData.fields : [];
        const encryptedRefCollections = await encRefFieldCollections(
          projectId,
          collectionDataFields,
        );
        const cryptResponse = await processItemEncryptDecrypt(
          subTenant,
          collectionDataFields,
          encryption,
          true,
          encryptedRefCollections,
        );
        subTenant = cryptResponse;
      }
    }
  }
  return subTenant;
};

export const extractFirstTenantIdFromUser = (user) => {
  let tenant = '';
  if (user && user?.tenantId) {
    const { tenantId } = user;
    tenant = tenantId.length && tenantId[0].uuid ? tenantId[0].uuid : '';
  }
  return tenant;
};

export const extractFirstUserSettingIdFromUser = (user) => {
  let userSetting = '';
  if (user && user?.userSettingId) {
    const { userSettingId } = user;
    userSetting = userSettingId.length && userSettingId[0].uuid ? userSettingId[0].uuid : '';
  }
  return userSetting;
};

export const extractFirstSubTenantIdFromUserAndTenantId = async (
  dbConnection,
  projectId,
  user,
  currentTenantId,
) => {
  try {
    let subTenant = '';
    const { subTenantId = [] } = user || {};
    const subTenantIds = Array.isArray(subTenantId) ? subTenantId : [subTenantId];
    if (!subTenantIds.length) return '';
    //Handling both cases when tenant is an array of object or just an array of uuids
    const isStringArray = typeof subTenantIds[0] === 'string';
    const subTenants = isStringArray
      ? await Promise.all(
          subTenantIds.map(async (id) => await getSubTenantById(dbConnection, projectId, id)),
        )
      : subTenantIds;
    const filteredSubTenants = subTenants.filter((item) => {
      const tenantIds = item?.tenantId;
      if (!Array.isArray(tenantIds)) return false;
      return tenantIds.some((t) =>
        typeof t === 'string' ? t === currentTenantId : t?.uuid === currentTenantId,
      );
    });
    subTenant = filteredSubTenants.length ? filteredSubTenants[0]?.uuid : '';
    return subTenant;
  } catch (error) {
    console.error('Error in extractFirstSubTenantIdFromUserAndTenantId:', error);
    return '';
  }
};

export const extractUserSettingFromUserAndTenant = async (
  dbConnection,
  projectId,
  user,
  currentTenant,
) => {
  try {
    let userSetting = '';
    const { userSettingId = [], uuid: userId = '' } = user || {};
    const { uuid: tenantId = '' } = currentTenant || {};
    const userSettingIds = Array.isArray(userSettingId) ? userSettingId : [userSettingId];
    if (!userSettingIds.length) return '';
    //Handling both cases when user and tenant is an array of object or just an array of uuids
    const isStringArray = typeof userSettingIds[0] === 'string';
    const userSettings = isStringArray
      ? await Promise.all(
          userSettingIds.map(async (id) => await getUserSettingById(dbConnection, projectId, id)),
        )
      : userSettingIds;
    const filteredUserSettings = userSettings.filter((item) => {
      const tenantIds = item?.tenantId;
      const userIds = item?.userId;
      if (!Array.isArray(tenantIds) || !Array.isArray(userIds)) return false;
      const tenantMatches = tenantIds.some((t) =>
        typeof t === 'string' ? t === tenantId : t?.uuid === tenantId,
      );
      const userMatches = userIds.some((u) =>
        typeof u === 'string' ? u === userId : u?.uuid === userId,
      );
      return tenantMatches && userMatches;
    });
    userSetting = filteredUserSettings.length ? filteredUserSettings[0] : '';
    return userSetting;
  } catch (error) {
    console.error('Error in extractUserSettingFromUserAndTenant:', error);
    return '';
  }
};
