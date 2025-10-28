/* eslint-disable no-prototype-builtins */
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import os from 'os';
import path from 'path';
import fs from 'fs';
import PdfParse from 'pdf-parse';
import {
  checkCollectionByName,
  findCollection,
  findOneCollectionService,
  userCollectionService,
} from '../collection/collection.service';
import {
  FieldTypes,
  SelectOptionFields,
  ImageUrlFields,
  BelongsToReferenceField,
  byFields,
} from 'drapcode-constant';
import {
  queryBuilder,
  convertItemToArray,
  parseJsonString,
  isEmptyObject,
  isEntityInCondition,
  // drapcodeEncryptDecrypt,
  processItemEncryptDecrypt,
  formatFieldsOfItem,
  formatProjectDates,
  fillDefaultValues,
  validateData,
  createS3Client,
  getFindQuery,
  getPrimaryFieldNameOfDataSource,
  processKey,
} from 'drapcode-utility';

import _ from 'lodash';
import { convertHashPassword, userCollectionName } from '../loginPlugin/loginUtils';
import { verifyToken } from '../loginPlugin/jwtUtils';
import {
  mergeConstructorAndRequestData,
  removeEmptyFields,
} from '../collection-form/collectionForm.util';
import { customInsertOne, generateNextCustomUuid, generateRandomCustomUuid } from '../utils/utils';
import {
  convertToFindOneAndUpdateQuery,
  filterFieldsForCSVImport,
  processConstructorData,
  processFieldsInclude,
  removeEmptyValues,
} from './item.utils';
import { copyPermissionsInUser, validateUserData } from '../loginPlugin/user.service';
import { addReferenceBuilder } from './item.builder.service';
import { cryptService } from '../middleware/encryption.middleware';
import { findProjectByQuery, getProjectEncryption } from '../project/project.service';
import { privateUrl } from '../upload-api/fileUpload.service';
import { extractUserSettingFromUserAndTenant } from '../middleware/tenant.middleware';
import { compareOldNewValue, createAuditTrail } from '../logs/audit/audit.service';
import {
  checkParams,
  formatDateFields,
  isNew,
  processQueryResult,
  processSearch,
} from '../utils/appUtils';
import { prepareDataForTypesenseIndexing } from '../typesense-search/typesenseSearch.utils';
import { deleteTypesenseDataService } from '../typesense-search/typesenseSearch.service';
import { loadS3PluginConfig } from '../install-plugin/installedPlugin.service';
import { handleSocketCollectionCommunication } from '../socket-io/socketIO.service';
import { dbProfiler } from '../middleware/db-profiler.middleware';
import { genericQuery } from '../developer/dev.service';
import { ErrorObj } from '../utils/errors';

const BulkHasOperations = (b) =>
  b &&
  b.s &&
  b.s.currentBatch &&
  b.s.currentBatch.operations &&
  b.s.currentBatch.operations.length > 0;

const { reference, belongsTo, password, custom_uuid, text, dynamic_option } = FieldTypes;
const USER_COLLECTION = 'user';

export const checkUniqueValidationFromCollection = async (dbConnection, collectionName, query) => {
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  const uniqueCheck = await dbCollection.findOne(query);
  if (uniqueCheck === null) {
    return true;
  }
  return false;
};

export const saveItem = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collection,
  itemData,
  constructorId = null,
  currentUser = {},
  headers = {},
  decrypt,
) => {
  // const collectionData = await checkCollectionByName(projectId, collectionName);
  // if (!collectionData) {
  //   return { code: 404, data: `Collection not found with provided name` };
  // }
  const { constructors, fields, collectionName } = collection;
  const { constructorMetaObj } = itemData ?? '';
  // eslint-disable-next-line no-prototype-builtins
  if (itemData && itemData.hasOwnProperty('constructorMetaObj')) {
    delete itemData['constructorMetaObj'];
  }
  if (constructorId) {
    const constructor = constructors.find(
      (constructor) => constructorId && constructor.uuid === constructorId,
    );
    if (constructor) {
      itemData = await prepareConstructorData(
        projectId,
        collection,
        constructor,
        constructorMetaObj,
        currentUser,
        headers,
        itemData,
        decrypt,
      );
    }
  }
  const validationResult = validateData(fields, itemData);
  if (!validationResult.isValid) {
    return {
      ...ErrorObj.VALIDATION_FAILED,
      message: validationResult.errors[0],
      data: validationResult.errors[0],
      error: validationResult.errors[0],
    };
  }
  const referenceFieldForm = [];
  fields.forEach((field) => {
    if (field.type === reference.id) {
      const { refCollection } = field;
      if (
        refCollection &&
        refCollection !== 'undefined' &&
        refCollection.displayType === 'innerForm'
      ) {
        referenceFieldForm.push(field);
      }
    }
  });
  let errorResponse = null;
  if (referenceFieldForm.length > 0) {
    await Promise.all(
      referenceFieldForm.map(async (field) => {
        const refCollectionName = field.refCollection.collectionName;
        const collection = await checkCollectionByName(projectId, refCollectionName);
        if (collection) {
          const innerItemResponse = await saveItem(
            dbConnection,
            projectId,
            environment,
            enableAuditTrail,
            refCollectionName,
            itemData[field.fieldName],
            null,
            currentUser,
          );

          if (innerItemResponse.code === 201) {
            itemData[field.fieldName] = innerItemResponse.data.uuid;
          } else {
            errorResponse = innerItemResponse;
          }
        }
      }),
    );
  }

  if (errorResponse) return errorResponse;
  if (collectionName && collectionName === USER_COLLECTION) {
    validateUserData(collection, itemData);
  }

  const saveItemResponse = await saveCollectionItem(
    dbConnection,
    projectId,
    enableAuditTrail,
    collection,
    itemData,
    currentUser,
    headers,
    environment,
  );
  return saveItemResponse;
};

const prepareConstructorData = async (
  projectId,
  collectionData,
  constructor,
  constructorMetaObj,
  currentUser,
  headers,
  itemData,
  decrypt,
  isForUpdate,
  isDraft,
) => {
  let { constructorData } = constructor;
  const {
    ipAddress,
    navigator,
    previousActionResponse,
    previousActionFormData,
    sessionStorageData,
    localStorageData,
    cookiesData,
  } = constructorMetaObj;
  const context = {
    headers,
    ipAddress,
    navigator,
    currentUser,
    previousActionResponse,
    previousActionFormData,
    sessionStorageData,
    localStorageData,
    cookiesData,
  };
  constructorData = processConstructorData(constructorData, context);
  if (isForUpdate) {
    removeEmptyFields(constructorData);
  }
  itemData = await mergeConstructorAndRequestData(
    constructorData,
    itemData,
    projectId,
    collectionData,
    decrypt,
  );
  if (isForUpdate) {
    itemData['isDraft'] = isDraft;
  }
  return itemData;
};

export const saveCollectionItem = async (
  db,
  projectId,
  enableAuditTrail,
  collectionData,
  itemData,
  currentUser = {},
  headers,
  environment,
) => {
  const errorJson = await validateItemCollection(db, collectionData, itemData);
  if (Object.keys(errorJson).length !== 0) {
    const { field, isExist } = errorJson;
    if (field === 0)
      return { ...ErrorObj.MISSING_FIELD, data: `${isExist} field does not exist.`, message: {} };

    if (field)
      return {
        ...ErrorObj.FIELD_VALIDATION_FIELD,
        data: field,
      };
  }

  let { fields, collectionName, typesenseMapping = [] } = collectionData ? collectionData : '';
  const hasTenantIdField = fields
    ? !!fields.find((field) => field.fieldName === 'tenantId')
    : false;
  const hasSubTenantIdField = fields
    ? !!fields.find((field) => field.fieldName === 'subTenantId')
    : false;
  itemData = await convertAutoGenerateTypeFields(db, projectId, collectionData, itemData);
  itemData = await convertPasswordTypeFields(db, projectId, collectionData, itemData);
  itemData = await convertStringDataToObject(collectionData, itemData);
  itemData = await convertSingleItemToList(collectionData, itemData);
  itemData.createdAt = new Date();
  itemData.updatedAt = new Date();
  itemData.createdBy = currentUser.uuid;
  const versionField = fields.find((field) => field.fieldName === FieldTypes.version.id);
  const updatedByField = fields.find((field) => field.fieldName === FieldTypes.updatedBy.id);
  if (updatedByField) {
    itemData.updatedBy = currentUser.uuid;
  } else if (itemData.updatedBy) delete itemData.updatedBy;
  if (versionField) {
    itemData.version = 0;
  } else if (itemData.version) delete itemData.version;
  itemData = await fillDefaultValues(collectionData, itemData);
  let hasItemDataTenantIdValue = false;
  if (hasTenantIdField && Array.isArray(itemData.tenantId)) {
    const cleanedItemDataTenantId = itemData.tenantId.filter((item) => item.length !== 0);
    hasItemDataTenantIdValue = !!cleanedItemDataTenantId.length;
  } else if (hasTenantIdField) {
    hasItemDataTenantIdValue = !!itemData.tenantId;
  }
  let hasItemDataSubTenantIdValue = false;
  if (hasSubTenantIdField && Array.isArray(itemData.subTenantId)) {
    const cleanedItemDataSubTenantId = itemData.subTenantId.filter((item) => item.length !== 0);
    hasItemDataSubTenantIdValue = !!cleanedItemDataSubTenantId.length;
  } else if (hasSubTenantIdField) {
    hasItemDataSubTenantIdValue = !!itemData.subTenantId;
  }
  const fileFields = fields.filter((field) => field.type === 'file');
  fileFields.forEach((fileField) => {
    const fieldName = fileField.fieldName;
    if (itemData[fieldName] && !Array.isArray(itemData[fieldName])) {
      itemData[fieldName] = [itemData[fieldName]];
    }
  });

  if (hasTenantIdField && !hasItemDataTenantIdValue && currentUser.tenantId) {
    const tenantId = headers['x-tenant-id'];
    itemData.tenantId = tenantId
      ? [tenantId]
      : Array.isArray(currentUser.tenantId) && currentUser.tenantId.length
      ? [currentUser.tenantId[0]]
      : [];
  }
  if (hasSubTenantIdField && !hasItemDataSubTenantIdValue && currentUser.subTenantId) {
    const subTenantId = headers['x-sub-tenant-id'];
    itemData.subTenantId = subTenantId
      ? [subTenantId]
      : Array.isArray(currentUser.subTenantId) && currentUser.subTenantId.length
      ? [currentUser.subTenantId[0]]
      : [];
  }

  itemData.uuid = uuidv4();
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await db.collection(collectionName);
  // FINAL: START:Audit Trail
  createAuditTrail(db, enableAuditTrail, 'NORMAL', 'create', currentUser, collectionName, itemData);
  // END:Audit Trail
  let savedItem = await customInsertOne(dbCollection, itemData);
  /* save belongs to field flow*/
  const belongsToResult = await saveBelongsToField(
    db,
    projectId,
    enableAuditTrail,
    collectionData,
    itemData,
    savedItem.uuid,
  );

  if (collectionName && collectionName === USER_COLLECTION) {
    await copyPermissionsInUser(db, enableAuditTrail, savedItem);
  }

  if (belongsToResult && belongsToResult[0] && belongsToResult[0].value === null) {
    await removeItemById(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      savedItem.uuid,
    );
    return ErrorObj.UNIQUE_FIELD;
  }
  /*end save belongs to field flow */
  //Saving in Typesense Collection start
  if (typesenseMapping.length) {
    const fullReferenceItem = await findItemById(db, projectId, collectionData, savedItem.uuid);
    await prepareDataForTypesenseIndexing(
      projectId,
      environment,
      collectionName,
      fullReferenceItem?.data,
      typesenseMapping,
    );
  }
  //Saving in Typesense Collection end
  //Socket Communication Start
  await handleSocketCollectionCommunication(
    projectId,
    currentUser,
    headers['x-tenant-id'],
    collectionName,
    'collection-data-add',
    savedItem,
  );
  //Socket Communication End
  return {
    code: 201,
    message: 'Item Created Successfully',
    data: savedItem ? savedItem : {},
    status: 'success',
    error: '',
  };
};

export const convertSingleItemToList = async (collection, itemData) => {
  const arrayOptionFields = collection.fields.filter((field) => {
    const { type } = field;
    return SelectOptionFields.includes(type);
  });
  if (!arrayOptionFields || arrayOptionFields.length <= 0) {
    return itemData;
  }
  const fieldsInItemData = Object.keys(itemData);

  await Promise.all(
    arrayOptionFields.map(async (field) => {
      if (fieldsInItemData.includes(field.fieldName))
        itemData[field.fieldName] = itemData[field.fieldName]
          ? convertItemToArray(itemData[field.fieldName])
          : [];
    }),
  );

  return itemData;
};

export const saveBelongsToField = async (
  dbConnection,
  projectId,
  enableAuditTrail,
  collection,
  itemData,
  recordId,
) => {
  const belongsToFields = collection.fields.filter((field) => field.type === belongsTo.id);
  if (!belongsToFields || belongsToFields.length === 0) {
    return [];
  }
  return await Promise.all(
    belongsToFields.map(async (field) => {
      const collectionName = field.refCollection.collectionName;
      const collectionField = field.refCollection.parentCollectionField;
      const belongsToItemId = itemData[field.fieldName];
      if (belongsToItemId) {
        const updateItem = await addItemToReferenceItemField(
          dbConnection,
          projectId,
          enableAuditTrail,
          belongsToItemId,
          recordId,
          collectionName,
          collectionField,
        );
        return updateItem;
      }
    }),
  );
};

const addItemToReferenceItemField = async (
  dbConnection,
  projectId,
  enableAuditTrail,
  belongsToItemId,
  recordId,
  collectionName,
  collectionField,
) => {
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 422, data: `Collection not found with provided name` };
  }
  const refFieldOfBelongsTo = collectionData.fields.find((e) => e.fieldName === collectionField);
  collectionName = collectionName.toString();
  const data = {
    belongsToItemId,
    collectionField,
    recordId,
    isMultiSelect: refFieldOfBelongsTo?.isMultiSelect,
  };
  return await addReferenceBuilder(dbConnection, enableAuditTrail, collectionName, data);
};

export const convertAutoGenerateTypeFields = async (
  dbConnection,
  projectId,
  collection,
  itemData,
  itemId = null,
) => {
  const { fields, collectionName } = collection;
  const autogeneratedFields = fields.filter((field) => field.type === custom_uuid.id);
  if (!autogeneratedFields || autogeneratedFields.length === 0) {
    return itemData;
  }

  let existingItem = null;
  if (itemId) {
    existingItem = await findItemById(dbConnection, projectId, collection, itemId, null);
    if (existingItem.message === 'success') {
      existingItem = existingItem.data;
    } else {
      existingItem = null;
    }
  }

  const lastItem = await findLastItem(dbConnection, collectionName);

  autogeneratedFields.forEach((field) => {
    const { extraFieldSetting, fieldName } = field;
    if (!existingItem || !existingItem[fieldName] || existingItem[fieldName].length === 0) {
      const value = itemData[fieldName];

      if (value && (value !== undefined || value !== 'undefined')) {
        console.log('Already have value from form so skip.');
      } else {
        /** Remove this if else in case not worked. */
        /** Don't assign/generate value, if already given */
        let algorithm = '',
          prepend = '',
          append = '',
          minLength = 1;
        if (extraFieldSetting instanceof Map) {
          algorithm = extraFieldSetting.get('algorithm');
          prepend = extraFieldSetting.get('prepend');
          append = extraFieldSetting.get('append');
          minLength = extraFieldSetting.get('minLength');
        } else {
          algorithm = extraFieldSetting.algorithm;
          prepend = extraFieldSetting.prepend;
          append = extraFieldSetting.append;
          minLength = extraFieldSetting.minLength;
        }
        if (['randomAlphanumeric', 'randomNumeric', 'randomAlphabet'].includes(algorithm)) {
          itemData[fieldName] = generateRandomCustomUuid(prepend, minLength, append, algorithm);
        } else {
          itemData[fieldName] = generateNextCustomUuid(
            lastItem && lastItem[fieldName] ? lastItem[fieldName] : '',
            prepend,
            minLength,
            append,
            algorithm,
          );
        }
      }
    }
  });
  return itemData;
};

export const convertAutoGenerateTypeFieldsForCSV = async (dbConnection, collection, items) => {
  const { fields, collectionName } = collection;
  const autogeneratedFields = fields.filter((field) => field.type === custom_uuid.id);
  if (!autogeneratedFields || autogeneratedFields.length === 0) {
    return items;
  }
  let newItems = [];
  const lastItem = await findLastItem(dbConnection, collectionName);
  autogeneratedFields.map((field) => {
    const { extraFieldSetting, fieldName } = field;

    let algorithm = '',
      prepend = '',
      append = '',
      minLength = 1;

    if (extraFieldSetting instanceof Map) {
      algorithm = extraFieldSetting.get('algorithm');
      prepend = extraFieldSetting.get('prepend');
      append = extraFieldSetting.get('append');
      minLength = extraFieldSetting.get('minLength');
    } else {
      algorithm = extraFieldSetting.algorithm;
      prepend = extraFieldSetting.prepend;
      append = extraFieldSetting.append;
      minLength = extraFieldSetting.minLength;
    }

    newItems = items.map((itemData) => {
      if (['randomAlphanumeric', 'randomNumeric', 'randomAlphabet'].includes(algorithm)) {
        itemData[fieldName] = itemData[fieldName]
          ? itemData[fieldName]
          : generateRandomCustomUuid(prepend, minLength, append, algorithm);
      } else {
        itemData[fieldName] = itemData[fieldName]
          ? itemData[fieldName]
          : generateNextCustomUuid(
              lastItem && lastItem.data && lastItem.data[fieldName] ? lastItem.data[fieldName] : '',
              prepend,
              minLength,
              append,
              algorithm,
            );
      }
      return itemData;
    });
  });
  return newItems;
};

export const convertPasswordTypeFields = async (
  dbConnection,
  projectId,
  collection,
  itemData,
  itemId = null,
) => {
  const { fields } = collection;
  const passwordFields = fields.filter((field) => field.type === password.id);
  if (!passwordFields || passwordFields.length <= 0) {
    return itemData;
  }
  try {
    let existingItem = null;
    if (itemId) {
      const { code, data } = await findItemById(dbConnection, projectId, collection, itemId, null);
      if (code === 200) existingItem = data;
    }
    await Promise.all(
      passwordFields.map(async (field) => {
        const { fieldName } = field;
        let value = itemData[fieldName];
        const shouldHash = value && (!existingItem || existingItem[fieldName] !== value);
        if (shouldHash) itemData[fieldName] = await convertHashPassword(value);
      }),
    );
  } catch (error) {
    console.error('\n Error in convertPasswordTypeFields', error);
  }
  return itemData;
};

export const convertStringDataToObject = async (collection, itemData) => {
  const fileUploadFields = collection.fields.filter((field) => ImageUrlFields.includes(field.type));
  if (!fileUploadFields || fileUploadFields.length <= 0) {
    return itemData;
  }
  await Promise.all(
    fileUploadFields.map(async (field) => {
      const fieldValue = itemData[field.fieldName];
      if (fieldValue && typeof fieldValue === 'string') {
        itemData[field.fieldName] = parseJsonString(fieldValue);
      }
    }),
  );
  return itemData;
};

async function filter(arr, callback) {
  const fail = Symbol();
  return (
    await Promise.all(arr.map(async (item) => ((await callback(item)) ? item : fail)))
  ).filter((i) => i !== fail);
}

const validateUniqueFieldsKeyData = async (
  dbConnection,
  collection,
  itemData,
  itemId,
  isNewPhoneSignUp,
) => {
  const { fields, collectionName } = collection;
  const isUserCollection = collectionName === userCollectionName;
  let errorJson = {};
  const uniqueFields = fields.filter((field) => field.unique);
  let errors = '';
  try {
    errors = await filter(uniqueFields, async (field) => {
      let isNewPhone = isNewPhoneSignUp;
      if (typeof isNewPhone === 'undefined') isNewPhone = field.type === 'tel';
      return (
        (await countByQueryOther(
          dbConnection,
          collectionName,
          field.fieldName,
          itemData[[field.fieldName]],
          itemId,
          isNewPhone,
        )) > 0
      );
    });
  } catch (error) {
    console.error('\n ==error', error);
    return error;
  }
  console.error('errors', errors);
  errors.some((field) => {
    if (field) {
      errorJson.message = `This ${getErrorFieldTitle(field, isUserCollection)} already exists`;
      return true;
    }
  });
  console.error('errorJson', errorJson);
  return errorJson;
};

const getErrorFieldTitle = (field, isUserCollection) => {
  if (isUserCollection && field && ['userName', 'email'].includes(field.fieldName)) return 'User';
  return field && field.fieldTitle ? field.fieldTitle.en : field;
};

export const validateItemCollection = async (
  db,
  collection,
  itemData,
  itemId = null,
  isValidateFields = true,
  isUpdate = false,
  isNewPhoneSignUp,
) => {
  let { fields } = collection;
  let arr = Object.keys(itemData);
  let isExist = false;
  if (isValidateFields) {
    for (let obj of arr) {
      let find = fields.find((field) => field.fieldName === obj);
      if (!find && obj !== 'isDraft') {
        delete itemData[obj];
      }
    }
  }

  if (isExist) return { field: 0, isExist };
  const requireFields = fields.filter((field) => field.required);
  if (isUpdate) {
    for (const field of requireFields) {
      if (
        Object.prototype.hasOwnProperty.call(itemData, `${field.fieldName}`) &&
        !itemData[`${field.fieldName}`]
      ) {
        return { field: field.fieldTitle.en + ' field is required' };
      }
    }
  } else {
    for (const field of requireFields) {
      if (!itemData[`${field.fieldName}`]) {
        return { field: `${field.fieldTitle.en} field is required` };
      }
    }
  }
  //Checking if data has unique data for unique fields
  let errorResponse = await validateUniqueFieldsKeyData(
    db,
    collection,
    itemData,
    itemId,
    isNewPhoneSignUp,
  );
  if (isEmptyObject(errorResponse)) {
    //Checking if data of composite keys have unique data
    errorResponse = await validateCompositeKeyData(db, collection, itemData, itemId);
  }
  return !isEmptyObject(errorResponse)
    ? { field: errorResponse ? errorResponse.message : errorResponse }
    : {};
};

export const list2 = async (
  dbConnection,
  projectId,
  collection,
  ids = null,
  reqQuery = {},
  decrypt,
  reqFromSdk,
) => {
  let query = [];
  if (ids) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    query.push({ $match: { uuid: { $in: ids } } });
  }
  let { fields, collectionName } = collection;
  query = [...query, ...genericQuery(reqQuery, fields)];

  if (fields.length) {
    fields = fields.filter((field) => BelongsToReferenceField.includes(field.type));
    if (fields && fields.length) {
      await Promise.all(
        fields.map((field) => {
          const { refCollection, fieldName } = field;
          let collectionName = refCollection ? refCollection.collectionName : null;
          if (collectionName) {
            query.push({
              $lookup: {
                from: `${collectionName}`,
                localField: fieldName,
                foreignField: 'uuid',
                as: field.fieldName,
              },
            });
          }
        }),
      );
    }
  }
  let dbCollection = await dbConnection.collection(collectionName);
  let result = await dbCollection.aggregate(query).toArray();
  if (!result) {
    return { code: 200, result: [] };
  }
  let encryptedResponse = await cryptService(result, projectId, collection, true, false, decrypt);
  if (encryptedResponse) {
    if (encryptedResponse.status === 'FAILED') {
      return { code: 200, result: [] };
    } else {
      result = encryptedResponse;
    }
  }
  const limit = Math.max(1, Number(reqQuery.limit) || 25);
  const matchFilter = query[0]?.$match || {};
  const totalItems = await dbCollection.countDocuments(matchFilter);
  const totalPages = Math.ceil(totalItems / limit);
  return reqFromSdk ? { code: 200, result, totalItems, totalPages } : result;
};
// TODO: Raj, We can remove or merge this code with your code in staging.
export const list = async (
  dbConnection,
  projectId,
  collection,
  ids = null,
  reqQuery = {},
  decrypt,
  isPaginated = false,
) => {
  const limit = reqQuery?.limit || reqQuery?.max || 100;
  let query = [];
  if (ids) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    query.push({ $match: { uuid: { $in: ids } } });
  }
  let { collectionName, fields } = collection;
  const generatedQuery = genericQuery(reqQuery, fields);
  query = [...query, ...generatedQuery];
  if (fields.length) {
    fields = fields.filter((field) => BelongsToReferenceField.includes(field.type));
    if (fields && fields.length) {
      await Promise.all(
        fields.map((field) => {
          const { refCollection, fieldName } = field;
          let collectionName = refCollection ? refCollection.collectionName : null;
          if (collectionName) {
            query.push({
              $lookup: {
                from: `${collectionName}`,
                localField: fieldName,
                foreignField: 'uuid',
                as: field.fieldName,
              },
            });
          }
        }),
      );
    }
  }

  let dbCollection = await dbConnection.collection(collectionName);
  let result = await dbCollection.aggregate(query).toArray();
  if (!result) {
    return result;
  }
  let encryptedResponse = await cryptService(result, projectId, collection, true, false, decrypt);
  if (encryptedResponse) {
    if (encryptedResponse.status === 'FAILED') {
      return null;
    } else {
      result = encryptedResponse;
    }
  }
  if (isPaginated) result = await addCountAndPagesToResult(dbCollection, result, query, limit);
  return result;
};
// TODO: Raj, We can remove or merge this code with your code in staging.
const addCountAndPagesToResult = async (dbCollection, data, query, limit) => {
  const countPipeline = query.filter((stage) => !('$skip' in stage || '$limit' in stage));
  countPipeline.push({ $count: 'total' });
  const countResult = await dbCollection.aggregate(countPipeline).toArray();
  const totalItems = countResult[0]?.total || 0;
  const size = parseInt(limit);
  const totalPages = Math.ceil(totalItems / size);
  return { result: data, totalItems, totalPages };
};

export const modifiedList = async (
  dbConnection,
  projectId,
  collectionName,
  ids = null,
  reqQuery = {},
) => {
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 404, data: `Collection not found with provided name` };
  }
  let query = [];
  if (ids) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    query.push({ $match: { uuid: { $in: ids } } });
  }
  const { fields } = collectionData;
  if (fields.length) {
    await Promise.all(
      fields.map((field) => {
        if (reference.id === field.type) {
          let collectionName = field.refCollection ? field.refCollection.collectionName : null;
          if (collectionName) {
            query.push({
              $lookup: {
                from: `${collectionName}`,
                localField: field.fieldName,
                foreignField: 'uuid',
                as: field.fieldName,
              },
            });
          }
        }
      }),
    );
  }

  if (reqQuery?.date) {
    query.push({ $match: { updatedAt: { $gte: reqQuery.date } } }, { $sort: { updatedAt: 1 } });
  }
  if (reqQuery?.offset) {
    query.push({ $skip: parseInt(reqQuery.offset) || 0 });
  }
  if (reqQuery?.max) {
    query.push({ $limit: parseInt(reqQuery.max) || 100 });
  }

  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  let result = await dbCollection.aggregate(query).toArray();
  return result;
};

export const updateCollectionItem = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  collectionData,
  itemId,
  itemData,
  currentUser = {},
  headers = {},
  sendDecryptedResponse,
) => {
  const filteredFieldsAndData = filterFieldsToBeSaved(collectionData, itemData);
  itemData = filteredFieldsAndData.itemData;
  const errorJson = await validateItemCollection(db, collectionData, itemData, itemId, true, true);
  if (Object.keys(errorJson).length !== 0) {
    if (errorJson.field === 0) {
      return { code: 404, message: `${errorJson.isExist} field does not exist.`, data: {} };
    }
    if (errorJson.field)
      return {
        code: 409,
        message: 'validation failed',
        data: errorJson.field,
      };
  } else {
    delete itemData.uuid; // if user is trying to pass uuid for update;
    itemData = await convertAutoGenerateTypeFields(db, projectId, collectionData, itemData, itemId);
    itemData = await convertPasswordTypeFields(db, projectId, collectionData, itemData, itemId);
    itemData = await convertStringDataToObject(collectionData, itemData);
    itemData = await convertSingleItemToList(collectionData, itemData);
    itemData.updatedAt = new Date();

    let { collectionName, fields, typesenseMapping = [] } = collectionData;
    const query = { uuid: itemId };
    let newValues = { $set: itemData };
    const versionField = fields.find((field) => field.fieldName === FieldTypes.version.id);
    const updatedByField = fields.find((field) => field.fieldName === FieldTypes.updatedBy.id);
    if (updatedByField && currentUser) itemData['updatedBy'] = currentUser.uuid;
    if (versionField) {
      if (itemData.version || itemData.version === 0) delete itemData.version;
      newValues = { $set: { ...newValues['$set'], version: 'INC' } };
    }
    if (filteredFieldsAndData && Object.keys(filteredFieldsAndData.fieldsToBeDeleted).length > 0) {
      newValues['$unset'] = filteredFieldsAndData.fieldsToBeDeleted;
    }
    collectionName = collectionName.toString().toLowerCase();
    let dbCollection = await db.collection(collectionName);
    // START:Audit Trail
    // Encryption/Decryption required, updating multiple field
    const collItem = await dbCollection.findOne(query);
    const { oldValues, newValues: nValues } = await compareOldNewValue(
      projectId,
      collItem,
      itemData,
      collectionData,
    );
    createAuditTrail(
      db,
      enableAuditTrail,
      'NORMAL',
      'update',
      currentUser,
      collectionName,
      nValues,
      oldValues,
    );
    // END:Audit Trail
    newValues = convertToFindOneAndUpdateQuery(newValues);
    let data = await dbCollection.findOneAndUpdate(query, newValues, isNew);
    if (!data || (data.lastErrorObject && !data.lastErrorObject.updatedExisting)) {
      return { code: 404, message: 'Item not found with provided id', data: {} };
    }
    /* save belongs to field flow*/
    const belongsToResult = await saveBelongsToField(
      db,
      projectId,
      enableAuditTrail,
      collectionData,
      itemData,
      data?.value?.uuid,
    );
    if (belongsToResult && belongsToResult[0] && belongsToResult[0].value === null) {
      await removeItemById(
        db,
        projectId,
        environment,
        enableAuditTrail,
        collectionName,
        data?.value?.uuid,
      );
      return {
        code: 400,
        message: `Can't save more than one if reference field is not multi selected`,
        data: `Can't save more than one item if Child Of field Reference field is not multi select`,
      };
    }
    if (typesenseMapping.length) {
      const fullReferenceItem = await findItemById(db, projectId, collectionData, itemId);
      await prepareDataForTypesenseIndexing(
        projectId,
        environment,
        collectionName,
        fullReferenceItem?.data,
        typesenseMapping,
      );
    }
    //For getting decrypted response in update case
    if (sendDecryptedResponse) {
      let decryptedResponse;
      if (itemData) {
        decryptedResponse = await cryptService(
          itemData,
          projectId,
          collectionData,
          true,
          false,
          sendDecryptedResponse,
        );
      }
      if (decryptedResponse.status !== 'FAILED') {
        itemData = decryptedResponse;
      }
    }
    //Socket Communication Start
    await handleSocketCollectionCommunication(
      projectId,
      currentUser,
      headers['x-tenant-id'],
      collectionName,
      'collection-data-update',
      { ...itemData, uuid: itemId },
    );
    //Socket Communication End
    return {
      code: 200,
      message: 'Item Updated Successfully',
      data: Object.assign(data?.value, { ...itemData, uuid: itemId }),
    };
  }
};

export const updateItemById = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionData,
  itemId,
  itemData,
  currentUser = {},
  headers = {},
  decrypt,
) => {
  const { constructors, fields } = collectionData;
  const { constructorMetaObj } = itemData ?? '';

  let isDraft = false;
  let sendDecryptedResponse = false;
  if (itemData && itemData.hasOwnProperty('constructorMetaObj')) {
    delete itemData['constructorMetaObj'];
  }

  if (itemData && itemData.hasOwnProperty('isDraft')) {
    isDraft = itemData['isDraft'];
  }

  if (itemData && itemData.hasOwnProperty('sendDecryptedResponse')) {
    sendDecryptedResponse = itemData['sendDecryptedResponse'];
  }

  if (constructorMetaObj && Object.keys(constructorMetaObj).length) {
    const { constructorId } = constructorMetaObj;
    const constructor = constructors.find(
      (constructor) => constructorId && constructor.uuid === constructorId,
    );
    if (constructor) {
      itemData = await prepareConstructorData(
        projectId,
        collectionData,
        constructor,
        constructorMetaObj,
        currentUser,
        headers,
        itemData,
        decrypt,
        true,
        isDraft,
      );
    }
  }

  const validationResult = validateData(fields, itemData);
  if (!validationResult.isValid) {
    return {
      code: 400,
      status: 'error',
      type: 'Validation failed',
      message: validationResult.errors[0],
      data: validationResult.errors[0],
    };
  }
  const referenceFieldForm = fields.filter(
    (field) => field.type === reference.id && field.refCollection.displayType === 'innerForm',
  );
  let errorResponse = null;
  if (referenceFieldForm.length > 0) {
    await Promise.all(
      referenceFieldForm.map(async (field) => {
        const { fieldName, refCollection } = field;
        const refCollectionData = await findOneCollectionService(
          projectId,
          refCollection.collectionName,
        );
        if (refCollectionData) {
          const innerItemResponse = await updateItemById(
            dbConnection,
            projectId,
            environment,
            enableAuditTrail,
            refCollectionData,
            itemData[fieldName].uuid,
            itemData[fieldName],
            currentUser,
            headers,
            decrypt,
          );
          if (innerItemResponse.code === 200) {
            itemData[fieldName] = innerItemResponse.data.uuid;
          } else {
            errorResponse = innerItemResponse;
          }
        }
      }),
    );
  }
  if (errorResponse) return errorResponse;
  return await updateCollectionItem(
    dbConnection,
    projectId,
    environment,
    enableAuditTrail,
    collectionData,
    itemId,
    itemData,
    currentUser,
    headers,
    sendDecryptedResponse,
  );
};
/**
 * TODO: This method is getting collection detail from DB
 * and collection details are getting again from wherever it get calls
 * @returns
 */

export const findItemById = async (
  dbConnection,
  projectId,
  collection,
  itemId,
  initialQuery = null,
) => {
  let query = [{ $match: initialQuery ? initialQuery : { uuid: itemId } }];
  const { fields, collectionName } = collection;
  const belongsToFields = fields.filter((field) => field.type === belongsTo.id);
  const userGeneratedFields = fields.filter((field) => byFields.has(field.type));
  const referenceFields = fields.filter((field) => reference.id === field.type);

  if (belongsToFields && belongsToFields.length > 0) {
    belongsToFields.forEach((field) => {
      const { refCollection, fieldName } = field;
      let refCollectionName = refCollection ? refCollection.collectionName : null;
      if (refCollectionName) {
        query.push({
          $lookup: {
            from: refCollectionName,
            localField: fieldName,
            foreignField: 'uuid',
            as: fieldName,
          },
        });
      }
    });
  }
  if (userGeneratedFields && userGeneratedFields.length > 0) {
    userGeneratedFields.forEach((field) => {
      const { fieldName } = field;
      query.push({
        $lookup: {
          from: 'user',
          let: { [`${fieldName}`]: `$${fieldName}` },
          pipeline: [
            { $match: { $expr: { $eq: ['$uuid', `$$${fieldName}`] } } },
            { $project: { _id: 0, password: 0 } },
          ],
          as: fieldName,
        },
      });
    });
  }
  if (referenceFields && referenceFields.length > 0) {
    await Promise.all(
      referenceFields.map(async (field) => {
        const { fieldName, refCollection } = field;
        let refCollectionName = refCollection ? refCollection.collectionName : null;
        if (refCollectionName) {
          let lookupPipeline = [
            {
              $match: {
                $expr: {
                  $in: [
                    '$uuid',
                    {
                      $cond: {
                        if: { $isArray: `$$${fieldName}` },
                        then: { $ifNull: [`$$${fieldName}`, []] },
                        else: { $ifNull: [[`$$${fieldName}`], []] },
                      },
                    },
                  ],
                },
              },
            },
          ];
          if (collectionName === 'user') {
            const level2Coll = await findOneCollectionService(projectId, refCollectionName);

            if (level2Coll) {
              const level2CollFields = level2Coll.fields;
              if (level2CollFields && level2CollFields.length > 0) {
                let thirdLevelQuery = await getThirdLevelCollectionQuery(level2CollFields);
                lookupPipeline.push(...thirdLevelQuery);
              }
            }
          }

          lookupPipeline.push({
            $lookup: {
              from: userCollectionName,
              let: { createdBy: '$createdBy' },
              pipeline: [
                { $match: { $expr: { $eq: ['$uuid', '$$createdBy'] } } },
                { $project: { _id: 0, password: 0 } },
              ],
              as: 'createdBy',
            },
          });
          lookupPipeline.push({
            $lookup: {
              from: userCollectionName,
              let: { updatedBy: '$updatedBy' },
              pipeline: [
                { $match: { $expr: { $eq: ['$uuid', '$$updatedBy'] } } },
                { $project: { _id: 0, password: 0 } },
              ],
              as: 'updatedBy',
            },
          });

          query.push({
            $lookup: {
              from: refCollectionName,
              let: { [`${field.fieldName}`]: `$${field.fieldName}` },
              pipeline: lookupPipeline,
              as: field.fieldName,
            },
          });
        }
      }),
    );
  }
  let dbCollection = await dbConnection.collection(collectionName);
  let result = await dbCollection.aggregate(query).toArray();
  if (!result.length) {
    return { code: 404, message: 'Item not found with provided id' };
  }
  return { code: 200, message: 'success', data: result[0] };
};

const getThirdLevelCollectionQuery = async (fields) => {
  let query = [];
  const referenceFields = fields.filter((field) => reference.id === field.type);
  if (!referenceFields || referenceFields.length == 0) {
    return [];
  }
  await Promise.all(
    referenceFields.map(async (field) => {
      const { refCollection, fieldName } = field;
      let refCollectionName = refCollection ? refCollection.collectionName : null;
      if (refCollectionName) {
        query.push({
          $lookup: {
            from: refCollectionName,
            let: { [`${fieldName}`]: `$${fieldName}` },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      '$uuid',
                      {
                        $cond: {
                          if: { $isArray: `$$${fieldName}` },
                          then: { $ifNull: [`$$${fieldName}`, []] },
                          else: { $ifNull: [[`$$${fieldName}`], []] },
                        },
                      },
                    ],
                  },
                },
              },
            ],
            as: fieldName,
          },
        });
      }
    }),
  );
  return query;
};

export const findOneItemByQuery = async (dbConnection, collectionName, query) => {
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  const res = await dbCollection.findOne(query);
  return res;
};

export const findOneItemByQueryC = async (dbCollection, collectionName, query) => {
  const res = await dbCollection.findOne(query);
  return res;
};

export const findLastItem = async (dbConnection, collectionName) => {
  let dbCollection = await dbConnection.collection(collectionName);
  let res = await dbCollection.find().sort({ _id: -1 }).limit(1).toArray();
  return res[0];
};

const validateCompositeKeyData = async (dbConnection, collection, itemData, itemId) => {
  let errorJson = {};
  const { fields, constraints } = collection;
  const constraintsFields = constraints.find(
    (constraint) => constraint.constraintType === 'COMPOSITE',
  );
  if (constraintsFields) {
    const compositeFieldName = constraintsFields.fields.map((field) => field.value);
    let query = { project: {}, match: {} };
    if (itemId) {
      query.project['uuid'] = '$uuid';
      query.match['uuid'] = { $ne: itemId };
    }
    compositeFieldName.map((fieldName) => {
      const field = fields.find((field) => field.fieldName === fieldName);
      let fieldValue = itemData[fieldName];
      if (SelectOptionFields.includes(field.type)) {
        if (!Array.isArray(fieldValue)) {
          fieldValue = [fieldValue];
        }
        query.project[fieldName] = `$${fieldName}`;
        query.match[fieldName] = { $in: fieldValue ? fieldValue : [] };
      } else {
        // query.project[fieldName] = { $toLower: `$${fieldName}` };
        // query.match[fieldName] = { $eq: fieldValue ? fieldValue.toString() : fieldValue };
        query.project[fieldName] = 1;
        if (field.type === text.id) {
          query.match[fieldName] = { $regex: `^${fieldValue}$`, $options: 'i' }; //Case Insensitive
        } else {
          query.match[fieldName] = { $eq: fieldValue };
        }
      }
    });
    try {
      const countResponse = await countByMultipleQuery(
        dbConnection,
        collection.collectionName,
        query,
      );
      if (countResponse > 0) {
        errorJson['message'] =
          'Already present data of these ' +
          constraintsFields.fields.map((field) => field.label).join(', ') +
          ' fields.';
      }
    } catch (e) {
      console.error('errr', e);
      // next(e)
    }
  }
  return errorJson;
};

export const countByMultipleQuery = async (dbConnection, collectionName, queryData) => {
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);

  let query = [
    {
      $project: queryData.project,
    },
    {
      $match: queryData.match,
    },
    { $group: { _id: null, count: { $sum: 1 } } },
  ];
  let data = await dbCollection.aggregate(query).toArray();
  if (data.length) return data[0].count;
  return;
};

export const countByQueryOther = async (
  dbConnection,
  collectionName,
  fieldName,
  fieldValue,
  itemId,
  isNewPhoneSignUp,
) => {
  if (!fieldValue) return;
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  let match;
  if (typeof fieldValue === 'string' && !isNewPhoneSignUp) {
    match = {
      [fieldName]: {
        $regex: `^${fieldValue}$` || '',
        $options: 'i',
      },
    };
  } else {
    match = {
      [fieldName]: { $eq: fieldValue },
    };
  }
  let query = [
    {
      $project: {
        [fieldName]: { $toLower: `$${fieldName}` },
      },
    },
    {
      $match: match,
    },
    { $group: { _id: null, count: { $sum: 1 } } },
  ];
  if (itemId) {
    match.uuid = { $ne: itemId };
    query = [
      {
        $project: {
          [fieldName]: { $toLower: `$${fieldName}` },
          uuid: '$uuid',
        },
      },
      {
        $match: match,
      },
      { $group: { _id: null, count: { $sum: 1 } } },
    ];
  }
  let data = await dbCollection.aggregate(query).toArray();
  if (data.length) return data[0].count;
  return;
};

export const removeItemById = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  itemId,
  currentUser = {},
  headers = {},
) => {
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  const query = { uuid: itemId };
  let result = await dbCollection.deleteOne(query);

  if (!result || (result.result && !result.result.n)) {
    return { code: 404, message: 'Item not found with provided id', data: {} };
  }
  // FINAL: START:Audit Trail
  createAuditTrail(
    dbConnection,
    enableAuditTrail,
    'NORMAL',
    'delete',
    '',
    collectionName,
    '',
    '',
    false,
    query,
  );
  // END:Audit Trail
  await deleteTypesenseDataService(projectId, environment, collectionName, itemId);
  //Socket Communication Start
  await handleSocketCollectionCommunication(
    projectId,
    currentUser,
    headers['x-tenant-id'],
    collectionName,
    'collection-data-delete',
    { message: 'Data Deleted' },
  );
  //Socket Communication End
  return { code: 200, message: 'Item Deleted Successfully', data: {} };
};

export const getItemCount = async (dbConnection, collectionName, query = {}) => {
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);
  let result = await dbCollection.countDocuments(query);
  return { code: 200, message: 'success', data: result };
};
export const innerFilterResult = async (
  dbConnection,
  projectId,
  refCollection,
  filterId,
  queryData = {},
  headerToken,
  timezone,
  headers,
  dateFormat,
) => {
  let newQueryData = { ...queryData, pagination: 'false' };
  let collection = await findCollection(projectId, refCollection, filterId);
  if (!collection) {
    return [];
  }
  const result = await filterItemService(
    dbConnection,
    projectId,
    collection,
    filterId,
    newQueryData,
    headerToken,
    timezone,
    headers,
    0,
    0,
    true,
    dateFormat,
  );
  let value = [];
  if (result && result.code == 200) {
    const { count, result: data } = result;
    if (count) value = [result];
    else value = await data.map(({ uuid }) => uuid);
  }
  return value;
};

export const refCollectionResult = async (
  dbConnection,
  refCollection,
  finder = {},
  queryData = {},
  constants,
  currentUser,
  timezone,
  condition = {},
  refField,
  currentTenant,
  currentUserSettings,
  currentSubTenant,
  lookupConfig,
) => {
  if (!condition.query) return [];
  condition.query.field = refField;
  finder = { ...finder };
  finder.conditions = [condition];

  finder.finder = 'FIND_ALL';
  queryData.pagination = 'false';

  try {
    let mongoBuilder = await queryBuilder(
      refCollection,
      finder,
      constants,
      queryData,
      {
        user: currentUser,
        tenant: currentTenant,
        setting: currentUserSettings,
        subTenant: currentSubTenant,
      },
      timezone,
      null,
      null,
      {},
      lookupConfig,
    );

    let dbCollection = dbConnection.collection(refCollection);
    let result = await dbCollection
      .aggregate(JSON.parse(JSON.stringify(mongoBuilder)), {
        collation: { locale: 'en' },
        allowDiskUse: true,
      })
      .toArray();

    queryData.pagination = true;
    return await result.map(({ uuid }) => uuid);
  } catch (error) {
    console.error('error refCollectionResult :>> ', error);
    return [];
  }
};

// Authenticate user via token
export const authenticateUser = async (dbConnection, projectId, headerToken) => {
  if (!headerToken) return null;
  const isValidToken = await verifyToken(headerToken);
  if (!isValidToken || !isValidToken.sub) return null;

  const query = {
    $or: [
      { email: new RegExp(`^${isValidToken.sub}$`, 'i') },
      { userName: new RegExp(`^${isValidToken.sub}$`, 'i') },
    ],
  };

  const userCollection = await userCollectionService(projectId);
  const user = await findItemById(dbConnection, projectId, userCollection, null, query);

  return user?.data || null;
};

// Apply Row-Level Security (RLS)
export const applyRowLevelSecurity = async (
  dbConnection,
  projectId,
  finder,
  rowLevelSecurityFilter,
  context,
) => {
  if (!finder.enableRls) return null;
  const rlsConfig = rowLevelSecurityFilter.find((filter) => filter.uuid === finder.rlsFilter);
  if (rlsConfig?.conditions.length) {
    await Promise.all(
      rlsConfig.conditions.map(async (condition) => {
        await replaceValuesInFilterConditions(
          dbConnection,
          projectId,
          condition,
          rlsConfig,
          context,
        );
      }),
    );
  }

  return rlsConfig;
};

// Process finder conditions
export const processFinderConditions = async (dbConnection, projectId, finder, context) => {
  if (!finder?.conditions.length) return;
  await Promise.all(
    finder.conditions.map(async (condition) => {
      await replaceValuesInFilterConditions(dbConnection, projectId, condition, finder, context);
    }),
  );
};

// Generate query dynamically
export const generateQuery = async (
  collectionName,
  finder,
  constants,
  queryData,
  currentUser,
  timezone,
  searchObj,
  refCollectionFields,
  searchQueryTypeObj,
  lookupConfig,
  rlsConfig,
  currentTenant,
  currentUserSettings,
  currentSubTenant,
) => {
  const mongoBuilder = await queryBuilder(
    collectionName,
    finder,
    constants,
    queryData,
    {
      user: currentUser,
      tenant: currentTenant,
      setting: currentUserSettings,
      subTenant: currentSubTenant,
    },
    timezone,
    searchObj,
    refCollectionFields,
    searchQueryTypeObj,
    lookupConfig,
    rlsConfig,
  );
  // const mongoQuery = await queryParser(
  //   collectionName,
  //   finder,
  //   constants,
  //   queryData,
  //   currentUser,
  //   timezone,
  //   searchObj,
  //   refCollectionFields,
  //   searchQueryTypeObj,
  //   currentTenant,
  //   currentUserSettings,
  //   currentSubTenant,
  //   lookupConfig,
  //   rlsConfig,
  // );
  return mongoBuilder;
};

export const filterItemService = async (
  dbConnection,
  projectId,
  collection,
  filterId,
  queryData = {},
  headerToken,
  timezone,
  headers,
  count = 0,
  search = 0,
  stopNestedFilter = false,
  dateFormat,
  currentTenant,
  currentSubTenant,
) => {
  const { collectionName, constants, finder, fields, lookups, enableLookup, noOfExternalParams } =
    collection;
  // Format date fields
  formatDateFields(queryData, dateFormat, fields);
  let { isPrivate, externalParams, refCollectionFields, rowLevelSecurityFilter } = collection;
  const lookupConfig = { enableLookup, lookups };
  let currentUser = null;
  isPrivate = `${isPrivate}`;
  if (isPrivate === 'true') {
    currentUser = await authenticateUser(dbConnection, projectId, headerToken);
    if (!currentUser)
      return { code: 401, message: 'Unauthorized', result: count ? '0' : [], count };
  }

  if (stopNestedFilter) finder.fieldsInclude = ['uuid']; // select uuid field from inner filter query

  if (noOfExternalParams != 0) {
    const result = checkParams(externalParams, queryData);
    if (!result) {
      return {
        code: 422,
        message: `External params should be in [${externalParams}]`,
        result: [],
        count,
      };
    }
  }
  // Handle search filters
  const { searchObj, searchQueryTypeObj } = processSearch(
    queryData,
    fields,
    externalParams,
    search,
  );

  const currentUserSettings = await extractUserSettingFromUserAndTenant(
    dbConnection,
    projectId,
    currentUser,
    currentTenant,
  );
  const commonSetting = {
    stopNestedFilter,
    queryData,
    searchObj,
    headers,
    currentUser,
    currentTenant,
    headerToken,
    timezone,
    dateFormat,
    lookupConfig,
    constants,
    currentUserSettings,
    currentSubTenant,
  };
  // Apply Row-Level Security (RLS)
  let rlsConfig = await applyRowLevelSecurity(
    dbConnection,
    projectId,
    finder,
    rowLevelSecurityFilter,
    commonSetting,
  );
  // Process finder conditions
  await processFinderConditions(dbConnection, projectId, finder, commonSetting);

  if (count) finder.finder = 'COUNT';

  try {
    const query = await generateQuery(
      collectionName,
      finder,
      constants,
      queryData,
      currentUser,
      timezone,
      searchObj,
      refCollectionFields,
      searchQueryTypeObj,
      lookupConfig,
      rlsConfig,
      currentTenant,
      currentUserSettings,
      currentSubTenant,
    );

    let dbCollection = dbConnection.collection(collectionName);
    dbCollection = dbProfiler(dbCollection);
    let result = await dbCollection
      .aggregate(JSON.parse(JSON.stringify(query)), {
        collation: { locale: 'en' },
        allowDiskUse: true,
      })
      .toArray();

    // Process results based on finder type
    result = processQueryResult(finder.finder, result, queryData);

    result = processFieldsInclude(finder, result, currentUser);
    return { code: 200, message: 'success', result, count };
  } catch (error) {
    console.error('error filterItemService :>> ', error);
    return { code: 400, message: error.message };
  }
};
export const addItemToField = async (
  dbConnection,
  projectId,
  enableAuditTrail,
  collection,
  itemData,
) => {
  const refFields = collection.fields.filter((field) => field.type === reference.id);
  const collectionName = collection.collectionName;

  return await Promise.all(
    refFields.map(async (field) => {
      const collectionField = field.fieldName;
      const refItemIds = itemData[field.fieldName];
      if (refItemIds) {
        refItemIds.map(async (refItemId) => {
          const updateItem = await addItemToReferenceItemField(
            dbConnection,
            projectId,
            enableAuditTrail,
            itemData.itemId,
            refItemId,
            collectionName,
            collectionField,
          );
          return updateItem;
        });
      }
    }),
  );
};

export const addToCollectionItem = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  itemId,
  itemFieldId,
  itemData,
  currentUser = {},
) => {
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 404, data: `Collection not found with provided name` };
  }
  delete itemData.uuid; // if user is trying to pass uuid for update;
  itemData = await convertPasswordTypeFields(
    dbConnection,
    projectId,
    collectionData,
    itemData,
    itemId,
  );
  itemData = await convertStringDataToObject(collectionData, itemData);
  itemData = await convertSingleItemToList(collectionData, itemData);
  itemData.updatedAt = new Date();
  if (!itemData.createdBy && currentUser) {
    itemData.createdBy = currentUser.uuid;
  }
  const updatedByField = collectionData.fields.find(
    (field) => field.fieldName === FieldTypes.updatedBy.id,
  );
  if (currentUser && updatedByField) itemData['updatedBy'] = currentUser.uuid;
  //TODO: need to check if we need to add version here
  /* save refs to field flow*/
  const refsResult = await addItemToField(
    dbConnection,
    projectId,
    enableAuditTrail,
    collectionData,
    itemData,
    itemFieldId,
    itemId,
  );
  if (refsResult && refsResult[0] && refsResult[0].value === null) {
    await removeItemById(
      dbConnection,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      itemFieldId,
    );
    return {
      code: 400,
      message: `Can't save more than one if reference field is not multi selected`,
      data: `Can't save more than one item if Child Of field Reference field is not multi select`,
    };
  }
  /*end save refs to field flow */
  //fetch update item data
  const collection = await findOneCollectionService(projectId, collectionName);
  const updatedItemData = await findItemById(dbConnection, projectId, collection, itemId, null);
  if (updatedItemData.code === 200) {
    itemData.itemData = updatedItemData.data;
  }
  itemData.uuid = itemId;
  return { code: 200, message: 'Added Successfully', data: itemData };
};

export const addToItemFieldById = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  itemId,
  itemFieldId,
  itemData,
  currentUser = {},
) => {
  if (itemData && !itemData.dataItemId) {
    return { code: 404, data: { error: `Collection item not found!` } };
  }

  return await addToCollectionItem(
    dbConnection,
    projectId,
    environment,
    enableAuditTrail,
    collectionName,
    itemId,
    itemFieldId,
    itemData,
    currentUser,
  );
};

export const removeItemFromField = async (
  dbConnection,
  projectId,
  enableAuditTrail,
  collection,
  itemData,
) => {
  const refFields = collection.fields.filter((field) => field.type === reference.id);
  return await Promise.all(
    refFields.map(async (field) => {
      const { fieldName } = field;
      const refItemIds = itemData[fieldName];
      if (refItemIds) {
        refItemIds.map(async (refItemId) => {
          const updateItem = await removeItemFromReferenceItemField(
            dbConnection,
            projectId,
            enableAuditTrail,
            itemData.itemId,
            refItemId,
            collection,
            fieldName,
          );
          return updateItem;
        });
      }
    }),
  );
};

const getItemForUpdate = (item, keysToExcludeOnUpsert) => {
  delete item[keysToExcludeOnUpsert];
  return item;
};

export const updateBulkData = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  selectedItemsIdsArr,
  body,
  user,
  headers,
  decrypt,
) => {
  let errorResponse = null;
  let responseData = {};

  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return {
      success: false,
      errorResponse: { code: 404, data: `Collection not found with provided name` },
    };
  }
  //Encryption
  let APP_ENV = process.env.APP_ENV;
  const { enableEncryption, encryptions, dateFormat, encryptionType } = await findProjectByQuery(
    projectId,
  );
  let encryption = null;
  if (enableEncryption && encryptions) {
    encryption = encryptions.find((enc) => enc.envType.toLowerCase() === APP_ENV.toLowerCase());
    if (encryption) {
      //TODO: Commenting this line for now
      //Because we already doing this when publish
      // if (encryption.isDataKeyEncrypted) {
      //   const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
      //   if (result.status === 'SUCCESS') {
      //     encryption.dataKey = result.data;
      //   } else {
      //     return result;
      //   }
      // }
      encryption = await processKey(encryption, encryptionType);
    }
  }
  let { fields } = collectionData;
  fields = fields.filter((field) => {
    return !(
      field.type === FieldTypes.file.id ||
      (field.type === FieldTypes.reference.id && field.refCollection?.isFileType)
    );
  });

  if (enableEncryption && encryption) {
    const cryptResponse = await processItemEncryptDecrypt(body, fields, encryption, false);
    body = cryptResponse;
  }
  // remove empty fields from body
  body = removeEmptyValues(body);
  body = formatProjectDates(body, dateFormat, fields, true);
  body = formatFieldsOfItem(body, fields);

  await Promise.all(
    selectedItemsIdsArr.map(async (itemId) => {
      if (!errorResponse) {
        const response = await updateItemById(
          db,
          projectId,
          environment,
          enableAuditTrail,
          collectionData,
          itemId,
          body,
          user,
          headers,
          decrypt,
        );
        if (response.code === 200) {
          responseData[itemId] = response.data;
        } else {
          errorResponse = response;
        }
      }
    }),
  );
  if (errorResponse) {
    return { success: false, errorResponse };
  }
  return { success: true, responseData };
};

export const saveBulkDataFromDeveloperAPI = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  items,
  primaryKey,
  isMetaDataCollection = false,
) => {
  let APP_ENV = process.env.APP_ENV;
  const { enableEncryption, encryptions, dateFormat, encryptionType } = await findProjectByQuery(
    projectId,
  );
  let primeDbConnection = await dbConnection.collection(collectionName);
  let bulk = primeDbConnection.initializeUnorderedBulkOp();
  const collection = await findOneCollectionService(projectId, collectionName);
  let { fields, typesenseMapping = [] } = collection;
  let encryption = null;
  if (enableEncryption && encryptions && !isMetaDataCollection) {
    encryption = encryptions.find((enc) => enc.envType.toLowerCase() === APP_ENV.toLowerCase());
    if (encryption) {
      //TODO: Commenting this line for now
      //Because we already doing this when publish
      // if (encryption.isDataKeyEncrypted) {
      //   const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
      //   if (result.status === 'SUCCESS') {
      //     encryption.dataKey = result.data;
      //   } else {
      //     return result;
      //   }
      // }
      //Now generate client's private key
      encryption = await processKey(encryption, encryptionType);
    }
  }
  fields = fields.filter((field) => {
    return !(
      field.type === FieldTypes.file.id ||
      (field.type === FieldTypes.reference.id && field.refCollection?.isFileType)
    );
  });
  const finalFindQuery = [];
  for (let item of items) {
    if (enableEncryption && encryption) {
      const cryptResponse = await processItemEncryptDecrypt(item, fields, encryption, false);
      item = cryptResponse;
    }
    const itemUuid = item.uuid ? item.uuid : uuidv4();
    item[primaryKey] = item[primaryKey] ? item[primaryKey] : uuidv4();
    const belongsToResult = await saveBelongsToField(
      dbConnection,
      projectId,
      enableAuditTrail,
      collection,
      item,
      itemUuid,
    );

    if (belongsToResult && belongsToResult[0] && belongsToResult[0].value === null) {
      await removeItemById(
        dbConnection,
        projectId,
        environment,
        enableAuditTrail,
        collectionName,
        itemUuid,
      );
      return {
        code: 400,
        message: `Can't save more than one if reference field is not multi selected`,
        data: `Can't save more than one item if Child Of field Reference field is not multi select`,
      };
    }
    item = formatProjectDates(item, dateFormat, fields, true);
    item = formatFieldsOfItem(item, fields);
    item.createdAt = new Date();
    item.updatedAt = new Date();
    const versionField = fields.find((field) => field.fieldName === FieldTypes.version.id);
    if (versionField) {
      item.version = 0;
    } else if (item.version) delete item.version;
    const findQuery = { [primaryKey]: item[primaryKey] };
    finalFindQuery.push(findQuery[primaryKey]);
    bulk
      .find(findQuery)
      .upsert()
      .updateOne({
        $set: item,
        $setOnInsert: { uuid: itemUuid },
      });
  }
  let result = [];
  let fullResponse = [];
  if (BulkHasOperations(bulk)) {
    await bulk.execute();
    result = await primeDbConnection.find({ [primaryKey]: { $in: finalFindQuery } }).toArray();
    fullResponse = result;
    result = result.map((item) => item.uuid);
  }
  //Typesense Handling
  if (typesenseMapping.length) {
    await prepareDataForTypesenseIndexing(
      projectId,
      environment,
      collectionName,
      fullResponse,
      typesenseMapping,
    );
  }
  return result;
};

export const saveBulkDataInDb = async (dbConnection, connectorData, data = []) => {
  const { collectionName, connectorType, customPrimaryKey } = connectorData;
  let primaryKey = customPrimaryKey
    ? customPrimaryKey
    : getPrimaryFieldNameOfDataSource(connectorType);
  if (!Array.isArray(data)) data = [data];
  let primeDbConnection = await dbConnection.collection(collectionName);

  let bulk = primeDbConnection.initializeUnorderedBulkOp();
  const finalFindQuery = [];
  const itemsPrimaryKeyValues = data.map((item) => {
    const itemUuid = item.uuid ? item.uuid : uuidv4();
    item[primaryKey] = item[primaryKey] ? item[primaryKey] : uuidv4();
    const findQuery = getFindQuery(item, customPrimaryKey);
    finalFindQuery.push(findQuery[primaryKey]);
    const itemsToUpdate = getItemForUpdate(item, 'uuid');
    bulk
      .find(findQuery)
      .upsert()
      .updateOne({
        $set: itemsToUpdate,
        $setOnInsert: { uuid: itemUuid },
      });
    return item[primaryKey];
  });
  let result = [];
  if (BulkHasOperations(bulk)) {
    await bulk.execute();
    result = await primeDbConnection.find({ [primaryKey]: { $in: finalFindQuery } }).toArray();
    result = result.map((item) => item.uuid);
  }
  return { primaryKey, itemsPrimaryKeyValues, itemsUuid: result };
};

const removeItemFromReferenceItemField = async (
  db,
  projectId,
  enableAuditTrail,
  belongsToItemId,
  recordId,
  collection,
  field,
) => {
  if (!collection) {
    return { code: 422, data: { error: `Collection not found with provided name` } };
  }
  let { fields, collectionName } = collection;
  const refFieldOfBelongsTo = fields.find((e) => e.fieldName === field);

  collectionName = collectionName.toString();
  let dbCollection = await db.collection(collectionName);

  const query = { uuid: belongsToItemId };
  if (refFieldOfBelongsTo?.isMultiSelect) {
    query[field] = { $size: 0 };
  }
  // FINAL: START:Audit Trail
  const collItem = await dbCollection.findOne(query);

  createAuditTrail(db, enableAuditTrail, 'NORMAL', 'update', '', collectionName, collItem, {
    [field]: collItem[field],
  });
  // END:Audit Trail

  const updatedRecord = await dbCollection.findOneAndUpdate(query, {
    $pull: {
      [field]: recordId,
    },
  });
  return updatedRecord;
};

export const findOneByEqualFieldValueAndUpdate = async (
  dbConnection,
  enableAuditTrail,
  collectionName,
  query,
  referenceField,
  childFieldValue,
) => {
  const dbCollection = dbConnection.collection(collectionName);
  // FINAL: START:Audit Trail
  const collItem = await dbCollection.find(query);
  const newValue = collItem[referenceField];
  createAuditTrail(
    dbConnection,
    enableAuditTrail,
    'NORMAL',
    'update',
    '',
    collectionName,
    { [referenceField]: newValue.push(childFieldValue) },
    { [referenceField]: collItem[referenceField] },
  );
  // END:Audit Trail
  return await dbCollection.findOneAndUpdate(
    query,
    { $push: { [referenceField]: childFieldValue } },
    isNew,
  );
};

export const removeFromItemFieldById = async (
  dbConnection,
  projectId,
  environment,
  enableAuditTrail,
  collectionName,
  itemId,
  itemFieldId,
  itemData,
  currentUser = {},
) => {
  if (itemData && !itemData.dataItemId) {
    return { code: 404, data: { error: `Collection item not found!` } };
  }

  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 404, data: { error: `Collection not found with provided name` } };
  }
  delete itemData.uuid; // if user is trying to pass uuid for update;
  itemData = await convertPasswordTypeFields(
    dbConnection,
    projectId,
    collectionData,
    itemData,
    itemId,
  );
  itemData = await convertStringDataToObject(collectionData, itemData);
  itemData = await convertSingleItemToList(collectionData, itemData);
  itemData.updatedAt = new Date();
  if (!itemData.createdBy && currentUser) {
    itemData.createdBy = currentUser.uuid;
  }
  const updatedByField = collectionData.fields.find(
    (field) => field.fieldName === FieldTypes.updatedBy.id,
  );
  if (itemData['updatedBy'] && currentUser && updatedByField)
    itemData['updatedBy'] = currentUser.uuid;
  //TODO: need to check if we need to add version here
  /* save refs to field flow*/
  const refsResult = await removeItemFromField(
    dbConnection,
    projectId,
    enableAuditTrail,
    collectionData,
    itemData,
  );
  if (refsResult && refsResult[0] && refsResult[0].value === null) {
    await removeItemById(
      dbConnection,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      itemFieldId,
    );
    return {
      code: 400,
      message: `Can't save more than one if reference field is not multi selected`,
      data: `Can't save more than one item if Child Of field Reference field is not multi select`,
    };
  }

  const updatedItemData = await findItemById(dbConnection, projectId, collectionData, itemId, null);
  if (updatedItemData.code === 200) {
    itemData.itemData = updatedItemData.data;
  }
  itemData.uuid = itemId;
  return { code: 200, message: 'Removed Successfully', data: itemData };
};

export const getItemsByQueryWithPagination = async (
  dbConnection,
  collectionName,
  projectId,
  initialQuery,
  page,
  size,
) => {
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 404, data: `Collection not found with provided name` };
  }
  let query = [{ $match: initialQuery ? initialQuery : {} }];
  const { fields } = collectionData;
  if (fields.length) {
    await Promise.all(
      fields.map((field) => {
        if (reference.id === field.type) {
          let collectionName = field.refCollection ? field.refCollection.collectionName : null;
          if (collectionName) {
            query.push({
              $lookup: {
                from: `${collectionName}`,
                let: { [`${field.fieldName}`]: `$${field.fieldName}` },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $in: [
                          '$uuid',
                          {
                            $cond: {
                              if: { $in: [`$$${field.fieldName}`, ['', null]] },
                              then: [],
                              else: { $ifNull: [`$$${field.fieldName}`, []] },
                            },
                          },
                        ],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: userCollectionName,
                      let: { createdBy: '$createdBy' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$uuid', '$$createdBy'] } } },
                        { $project: { _id: 0, password: 0 } },
                      ],
                      as: 'createdBy',
                    },
                  },
                  {
                    $lookup: {
                      from: userCollectionName,
                      let: { updatedBy: '$updatedBy' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$uuid', '$$updatedBy'] } } },
                        { $project: { _id: 0, password: 0 } },
                      ],
                      as: 'updatedBy',
                    },
                  },
                ],
                as: field.fieldName,
              },
            });
          }
        }
        if (field.type === belongsTo.id) {
          let collectionName = field.refCollection ? field.refCollection.collectionName : null;
          if (collectionName) {
            query.push({
              $lookup: {
                from: `${collectionName}`,
                localField: field.fieldName,
                foreignField: 'uuid',
                as: field.fieldName,
              },
            });
          }
        }
        if (byFields.has(field.type))
          query.push({
            $lookup: {
              from: `user`,
              let: { [`${field.fieldName}`]: `$${field.fieldName}` },
              pipeline: [
                { $match: { $expr: { $eq: ['$uuid', `$$${field.fieldName}`] } } },
                { $project: { _id: 0, password: 0 } },
              ],
              as: field.fieldName,
            },
          });
      }),
    );
  }
  collectionName = collectionName.toString().toLowerCase();
  let dbCollection = await dbConnection.collection(collectionName);

  if (page && size) {
    query.push({ $sort: { _id: -1 } });
    query.push({ $skip: size * page }, { $limit: +size });
  }
  let result = await dbCollection.aggregate(query).toArray();
  if (!result.length) {
    return { code: 404, message: 'Item not found with provided id' };
  }
  return { code: 200, message: 'success', data: result };
};

export const importItemFromCSV = async (
  db,
  projectId,
  collectionName,
  user = {},
  body,
  tenant = {},
) => {
  let { fields, items } = body;
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return { code: 404, data: `Collection not found with provided name` };
  }
  let { fields: collectionFields } = collectionData;
  collectionFields = filterFieldsForCSVImport(collectionFields);
  let allowedCollectionFieldList = collectionFields.map((element) => element.fieldName);
  if (fields.length > allowedCollectionFieldList.length) {
    allowedCollectionFieldList = allowedCollectionFieldList.filter((key) => fields.includes(key));
  } else {
    allowedCollectionFieldList = fields.filter((key) => allowedCollectionFieldList.includes(key));
  }

  //Intersection of field from collection and CSV
  const finalItems = items.map((record) => {
    const item = {};
    allowedCollectionFieldList.forEach((key) => (item[key] = record[key]));
    return item;
  });
  return await processCSVItems(db, projectId, collectionData, finalItems, user, tenant);
};

export const processCSVItems = async (db, projectId, collectionData, finalItems, user, tenant) => {
  let savedItems = [];
  let errors = [];
  const { collectionName } = collectionData;
  for (let item of finalItems) {
    if (collectionName === 'user') {
      if (!item.password) {
        item.password = uuidv4();
      }
    }
    const processedItem = await prepareCSVItem(db, projectId, collectionData, item, user, tenant);
    if (processedItem.error) {
      errors.push(processedItem.message);
    } else {
      if (processedItem.itemData && Object.keys(processedItem.itemData).length > 0) {
        savedItems.push(processedItem.itemData);
      }
    }
  }
  if (errors && errors.length > 0) {
    errors = [].concat(...errors);
    errors = errors.filter((el, i) => errors.indexOf(el) === i);
  }

  if (!savedItems.length) {
    return {
      code: 422,
      status: 422,
      msg: `Failed to import CSV`,
      errors,
    };
  }
  savedItems = await convertAutoGenerateTypeFieldsForCSV(db, collectionData, savedItems);
  //TODO: Need to handle encryption
  //Below code is from Builder Engine
  /**
   *  const encryptedResponse = await cryptService(
      savedItems,
      projectId,
      version,
      collection,
      environment,
    );
    if (encryptedResponse.status === 'FAILED') {
      return {
        status: 422,
        msg: `Failed to import CSV. Encryption Failed.`,
        errors,
      };
    } else {
      savedItems = encryptedResponse;
    }
   */
  let dbCollection = await db.collection(collectionName);
  const savedRecords = await dbCollection.insertMany(savedItems);
  // const savedRecords = await dbCollection.insertMany(finalItems);
  return { code: 200, status: 200, data: savedRecords, errors };
};

const prepareCSVItem = async (db, projectId, collection, item, user = {}, tenant = {}) => {
  let itemData = await convertSingleItemToList(collection, item);
  const errorJson = await validateItemCollection(db, collection, itemData);
  if (Object.keys(errorJson).length !== 0) {
    const message = Object.keys(errorJson).map((key) => `${key}:${errorJson[key]}`);
    return { error: true, message };
  }
  itemData = await convertStringDataToObject(collection, itemData);
  itemData = await convertPasswordTypeFields(db, projectId, collection, itemData);
  itemData.createdAt = new Date();
  itemData.updatedAt = new Date();
  itemData.uuid = uuidv4();
  const versionField = collection.fields.find((field) => field.fieldName === FieldTypes.version.id);
  const updatedByField = collection.fields.find(
    (field) => field.fieldName === FieldTypes.updatedBy.id,
  );
  if (versionField) {
    itemData.version = 0;
  } else if (itemData.version) delete itemData.version;
  itemData = addUserAndTenantFieldsInItem(itemData, user, tenant, updatedByField);
  return { error: false, itemData };
};

export const addUserAndTenantFieldsInItem = (itemData, user, tenant, updatedByField = false) => {
  if (!itemData.tenantId || (Array.isArray(itemData.tenantId) && itemData.tenantId.length === 0))
    itemData.tenantId = tenant?.uuid ? [tenant.uuid] : [];
  if (!itemData.createdBy || (Array.isArray(itemData.createdBy) && itemData.createdBy.length === 0))
    itemData.createdBy = user?.uuid ? user.uuid : '';
  if (updatedByField) {
    if (
      !itemData.updatedBy ||
      (Array.isArray(itemData.updatedBy) && itemData.updatedBy.length === 0)
    )
      itemData.updatedBy = user?.uuid ? user.uuid : '';
  } else if (itemData.updatedBy) delete itemData.updatedBy;
  return itemData;
};

const filterFieldsToBeSaved = (collection, itemData) => {
  let { fields } = collection;
  let arr = Object.keys(itemData);
  const fieldsToBeDeleted = {};

  for (let obj of arr) {
    let find = fields.find((field) => field.fieldName === obj);
    if (!find && obj !== 'isDraft') {
      fieldsToBeDeleted[obj] = 1;
    }
  }

  if (Object.keys(fieldsToBeDeleted).length > 0) {
    for (let field in fieldsToBeDeleted) {
      delete itemData[field];
    }
  }
  return { fieldsToBeDeleted, itemData };
};

export const downloadPDF = async (projectId, environment, key, isEncrypted) => {
  try {
    const { encryption } = await getProjectEncryption(projectId);
    const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
      projectId,
      environment,
    );
    const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
    const s3Client = createS3Client(awsConfig);

    const pdfBufferData = await privateUrl(key, isEncrypted, encryption, s3Client, bucket);
    if (!pdfBufferData) {
      console.error('error while fetching pdfBufferData');
    }
    const tempDir = os.tmpdir();
    const pdf_uuid = uuidv4();
    const pdfPath = path.join(tempDir, `${pdf_uuid}.pdf`);
    fs.writeFileSync(pdfPath, pdfBufferData);
    return pdfPath;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
};

// Function to extract text from a PDF file
export const extractTextFromPDF = async (pdfPath) => {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const text = await PdfParse(dataBuffer);
    fs.unlinkSync(pdfPath);
    return text.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return error;
  }
};

export const dataViewLogs = async (req) => {
  try {
    const { db, params, headers, projectId, originalUrl, enableAuditTrail, environment } = req;
    let { collectionName, filterId = '', itemId = '', typesenseCollectionName } = params;
    const { authorization } = headers;
    if (originalUrl.includes('/typesense-search') && typesenseCollectionName) {
      collectionName = typesenseCollectionName;
    }
    const collectionData = await checkCollectionByName(projectId, 'data_view_activity_tracker');
    if (!collectionData) {
      return;
    }
    let currentUser;
    if (authorization) {
      const isValidToken = await verifyToken(authorization);
      const emailQuery = { email: { $regex: `^${isValidToken.sub}$`, $options: 'i' } };
      const usernameQuery = { userName: { $regex: `^${isValidToken.sub}$`, $options: 'i' } };
      const query = { $or: [emailQuery, usernameQuery] };
      const userCollection = await userCollectionService(projectId);
      currentUser = await findItemById(db, projectId, userCollection, null, query);
      currentUser = currentUser.data;
    }
    const data = {
      collName: collectionName,
      userName: currentUser?.userName || '',
      filterId: filterId,
      url: `https://${req.get('host')}${originalUrl}`,
      ipAddress: headers['x-user-ip'] || '',
      itemId: itemId,
    };
    const saveItemResponse = await saveCollectionItem(
      db,
      projectId,
      enableAuditTrail,
      collectionData,
      data,
      currentUser,
      headers,
      environment,
    );
    return saveItemResponse;
  } catch (error) {
    console.error('Error adding data view logs:', error);
    return error;
  }
};

export const replaceValuesInFilterConditions = async (
  db,
  projectId,
  condition,
  finder,
  context,
) => {
  const {
    stopNestedFilter,
    queryData,
    searchObj,
    headers,
    currentUser,
    currentTenant,
    headerToken,
    timezone,
    dateFormat,
    lookupConfig,
    constants,
    currentUserSettings,
    currentSubTenant,
  } = context;
  if (!condition.query) return;
  let {
    fieldType,
    refCollection,
    refField,
    isFilter,
    field,
    value: innerFilterId,
  } = condition.query;
  if (BelongsToReferenceField.includes(fieldType)) {
    if (!refCollection) return;
    let value = [];
    if (isFilter && !stopNestedFilter) {
      value = await innerFilterResult(
        db,
        projectId,
        refCollection,
        innerFilterId,
        queryData,
        headerToken,
        timezone,
        headers,
        dateFormat,
      );
    } else {
      if (refCollection === 'CURRENT_USER') {
        const tenantId = headers['x-tenant-id'];
        value =
          refField && refField === 'tenantId' && tenantId
            ? tenantId
            : currentUser[refField] && currentUser[refField].length
            ? currentUser[refField][0].uuid
            : '';
        //Fallback to get Current User Id
        if (currentUser && !value && _.get(currentUser, refField)) {
          value = currentUser.uuid;
        }
      } else if (refCollection === 'CURRENT_TENANT') {
        if (currentTenant && currentTenant[refField]) {
          const refFieldData = currentTenant[refField];
          if (Array.isArray(refFieldData) && refFieldData.length) {
            value = refFieldData[0]?.uuid ? refFieldData[0].uuid : refFieldData[0];
          } else value = refFieldData;
        }
      } else if (refCollection === 'CURRENT_SETTINGS') {
        if (currentUserSettings && currentUserSettings[refField]) {
          const refFieldData = currentUserSettings[refField];
          if (Array.isArray(refFieldData) && refFieldData.length) {
            value = refFieldData[0]?.uuid ? refFieldData[0].uuid : refFieldData[0];
          } else {
            value = refFieldData;
          }
        }
      } else if (refCollection === 'CURRENT_SUB_TENANT') {
        if (currentSubTenant && currentSubTenant[refField]) {
          const refFieldData = currentSubTenant[refField];
          if (Array.isArray(refFieldData) && refFieldData.length) {
            value = refFieldData[0]?.uuid ? refFieldData[0].uuid : refFieldData[0];
          } else {
            value = refFieldData;
          }
        }
      } else {
        if (isEntityInCondition(innerFilterId)) {
          const key = innerFilterId.replace('ENTITY::', '');
          condition.query.value = queryData[key] ? queryData[key] : '';
          delete searchObj[key];
        }
        value = await refCollectionResult(
          db,
          refCollection,
          finder,
          queryData,
          constants,
          currentUser,
          timezone,
          condition,
          refField,
          currentTenant,
          currentUserSettings,
          currentSubTenant,
          lookupConfig,
        );
      }
      condition.query.field = field;
    }
    if (['undefined', 'null', null, undefined, ''].includes(value)) {
      /*NOTE: In case field is not present in old record then fieldValue is undefined
        we assign some random string to avoid resulting all values
        This is use case in Spot Factor Project, where a new user with blank value able to see all records
      */
      value = `random_string_since_field_not_present_${moment(1318874398806).valueOf()}`;
      condition.query.value = value;
    }
    //NOTE: Reassign value if condition meet
    if (
      (Array.isArray(value) && value.length) ||
      (!Array.isArray(value) && !value.startsWith('random_string_since_field_not_present_'))
    ) {
      condition.query.value = value;
      condition.requiredExternal = false;
    }
  } else if (fieldType === dynamic_option.id) {
    if (!refCollection) return;
    let value = [];
    if (isFilter && !stopNestedFilter) {
      value = await innerFilterResult(
        db,
        projectId,
        refCollection,
        innerFilterId,
        queryData,
        headerToken,
        timezone,
        headers,
        dateFormat,
      );
    } else {
      if (refCollection === 'CURRENT_USER') {
        value = currentUser && currentUser[refField] ? currentUser[refField] : '';
      } else if (refCollection === 'CURRENT_TENANT') {
        value = currentTenant && currentTenant[refField] ? currentTenant[refField] : '';
      } else if (refCollection === 'CURRENT_SETTINGS') {
        value =
          currentUserSettings && currentUserSettings[refField] ? currentUserSettings[refField] : '';
      } else if (refCollection === 'CURRENT_SUB_TENANT') {
        value = currentSubTenant && currentSubTenant[refField] ? currentSubTenant[refField] : '';
      }
    }
    if (['undefined', 'null', null, undefined, ''].includes(value)) {
      /*NOTE: In case field is not present in old record then fieldValue is undefined
        we assign some random string to avoid resulting all values
        This is use case in Spot Factor Project, where a new user with blank value able to see all records
      */
      value = `random_string_since_field_not_present_${moment(1318874398806).valueOf()}`;
    }
    //NOTE: Reassign value if condition meet
    if (
      (Array.isArray(value) && value.length) ||
      (!Array.isArray(value) && !value.startsWith('random_string_since_field_not_present_'))
    ) {
      condition.query.value = value;
      condition.requiredExternal = false;
    }
  }
};

export const getItemToPurchase = async (dbConnection, projectId, collectionName, itemId) => {
  const collection = await findOneCollectionService(projectId, collectionName);
  const productData = await findItemById(dbConnection, projectId, collection, itemId, null);
  if (!productData) {
    return { code: 400, message: 'No Products found', status: 'failed' };
  }
  let product = productData.data;
  // Decrypting Data for Imagine Pay, BNG Payment, Stripe, Fluid
  let encryptedResponse;
  if (product) {
    encryptedResponse = await cryptService(product, projectId, collection, true, false, true);
  }
  if (encryptedResponse) {
    if (encryptedResponse.status === 'FAILED') {
      return { code: 400, message: encryptedResponse.message, status: 'failed' };
    } else {
      product = encryptedResponse;
    }
  }

  return product;
};
export const getReferenceCollectionFieldData = async (
  fullNameParts,
  selectedCollectionData,
  productToPurchase,
) => {
  let refFieldName = fullNameParts[0];
  let refCollectionData = selectedCollectionData
    ? JSON.parse(selectedCollectionData).filter((cd) => cd.fieldName === refFieldName)[0]
    : '';
  // const refCollectionName = refCollectionData ? refCollectionData.refCollection.collectionName : '';
  let refCollectionField = fullNameParts[1];
  if (!refCollectionField) {
    refCollectionField = refCollectionData ? refCollectionData.refCollection.collectionField : '';
  }
  const refCollectionValue = productToPurchase[refFieldName][0];

  if (!refCollectionValue) {
    return { code: 400, message: 'Reference Collection Item not found', status: 'failed' };
  }
  return refCollectionValue[refCollectionField];
};

export const downloadFile = async (document, environment) => {
  try {
    const { key, originalName, mimeType, size, isEncrypted, projectId } = document;
    const { encryption } = await getProjectEncryption(projectId);
    const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
      projectId,
      environment,
    );
    const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
    const s3Client = createS3Client(awsConfig);

    const fileBufferData = await privateUrl(key, isEncrypted, encryption, s3Client, bucket);
    if (!fileBufferData) {
      console.error('Error while fetching fileBufferData');
      throw new Error('No data returned from privateUrl');
    }
    const extension = path.extname(originalName) || '';
    const baseName = path.basename(originalName, extension);
    const uniqueFileName = `${baseName}-${uuidv4()}${extension}`;
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, uniqueFileName);
    fs.writeFileSync(filePath, fileBufferData);
    return {
      fieldname: '',
      originalname: originalName,
      encoding: 'binary',
      mimetype: mimeType || 'application/octet-stream',
      destination: tempDir,
      filename: uniqueFileName,
      path: filePath,
      size: size,
    };
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
};
