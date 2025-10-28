import { BelongsCreatedByRefField } from 'drapcode-constant';
import { getEncryptedReferenceFields, loadCollection } from 'drapcode-utility';
import { userCollectionName } from '../loginPlugin/loginUtils';
import { loadMultiTenantSetting } from '../install-plugin/installedPlugin.service';

export const findOneCollectionService = async (projectId, nameOrUuid) => {
  const result = loadCollection(projectId, nameOrUuid);
  return result;
};

export const checkCollectionByName = async (projectId, collectionName, id = null) => {
  let result = await findOneCollectionService(projectId, collectionName);
  if (id) {
    if (!result) return { code: 404, message: 'Collection not found with provided name' };
    return { code: 200, message: 'success', data: result };
  }
  return result;
};

export const findCollection = async (projectId, nameOrUuid, filterId) => {
  const collection = await findOneCollectionService(projectId, nameOrUuid);
  if (!collection) {
    return null;
  }

  const {
    collectionName,
    fields,
    constants,
    permissionLevelSecurity,
    finders,
    utilities,
    metaDataTableMapping,
  } = collection;
  const result = {
    collectionName,
    fields,
    constants,
    permissionLevelSecurity,
    projectId,
    utilities,
  };
  const finder = finders.find((finder) => finder.uuid === filterId);
  if (!finder) {
    return {
      ...result,
      noOfExternalParams: 0,
      externalParams: [],
      finder: null,
      isPrivate: false,
      enableLookup: false,
      lookups: null,
      refCollectionFields: [],
      metaDataTableMapping,
    };
  }

  const selFields = fields.filter((field) => BelongsCreatedByRefField.includes(field.type));
  const externalParams = [];
  if (finder.noOfExternalParams > 0 && finder.conditions && finder.conditions.length > 0) {
    finder.conditions.forEach((condition) => {
      if (condition.requiredExternal) {
        externalParams.push(condition.query.value);
      }
    });
  }
  return {
    ...result,
    noOfExternalParams: finder.noOfExternalParams,
    externalParams,
    finder,
    isPrivate: finder.isPrivate,
    enableLookup: finder.enableLookup,
    lookups: finder.lookups || null,
    refCollectionFields: selFields,
    metaDataTableMapping,
  };
};

export const encRefFieldCollections = async (projectId, fields) => {
  const collectionNames = getEncryptedReferenceFields(fields);
  const collections = [];
  for (const collectionName of collectionNames) {
    const collection = await findOneCollectionService(projectId, collectionName);
    let selFields = collection ? collection.fields.filter((field) => field.encrypted) : [];
    //Commented below, because all ref field encryption failed
    // selFields = selFields.map((field) => ({ name: field.fieldName, encrypted: field.encrypted }));
    collections.push({ collectionName, fields: selFields });
  }
  return collections;
};

export const findFieldDetailsFromCollection = async (projectId, collectionName, fieldId) => {
  const collection = await findOneCollectionService(projectId, collectionName);
  const field = collection.fields.find((field) => field.fieldName === fieldId);
  return field.validation;
};

export const userCollectionService = async (projectId) => {
  const userCollection = await findOneCollectionService(projectId, userCollectionName);
  return userCollection;
};

export const multiTenantCollService = async (projectId) => {
  const multiTenantPlugin = await loadMultiTenantSetting(projectId);
  if (!multiTenantPlugin) {
    return null;
  }
  const { multiTenantCollection } = multiTenantPlugin.setting;
  if (!multiTenantCollection) {
    return null;
  }
  const collection = await findOneCollectionService(projectId, multiTenantCollection);
  return collection;
};

export const userSettingCollService = async (projectId) => {
  const multiTenantPlugin = await loadMultiTenantSetting(projectId);
  if (!multiTenantPlugin) {
    return null;
  }
  const { userSettingsCollection } = multiTenantPlugin.setting;
  if (!userSettingsCollection) {
    return null;
  }
  const collection = await findOneCollectionService(projectId, userSettingsCollection);
  return collection;
};

export const subTenantCollService = async (projectId) => {
  const multiTenantPlugin = await loadMultiTenantSetting(projectId);
  if (!multiTenantPlugin) {
    return null;
  }
  const { subTenantCollection } = multiTenantPlugin.setting;
  if (!subTenantCollection) {
    return null;
  }
  const collection = await findOneCollectionService(projectId, subTenantCollection);
  return collection;
};
