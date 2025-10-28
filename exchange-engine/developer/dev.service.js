import { pluginCode } from 'drapcode-plugin';
import { createS3Client, validateEmail, validateUuidString, loadDevAPIs } from 'drapcode-utility';
import {
  EQUALS,
  GREATER_THAN,
  GREATER_THAN_EQUALS_TO,
  IN_LIST,
  IS_NOT_NULL,
  IS_NULL,
  LESS_THAN,
  LESS_THAN_EQUALS_TO,
  LIKE,
  NOT_IN_LIST,
} from 'drapcode-constant';

import { findInstalledPlugin, loadS3PluginConfig } from '../install-plugin/installedPlugin.service';
import { sendDynamicEmailService, sendEmailTemplateService } from '../email/email.service';
import { userCollectionName } from '../loginPlugin/loginUtils';
import { findTemplate } from '../email-template/template.service';
import { findOneCollectionService } from '../collection/collection.service';
import {
  checkParams,
  COLLECTION_NOT_EXIST_MSG,
  formatDateFields,
  processQueryResult,
  processSearch,
} from '../utils/appUtils';
import {
  applyRowLevelSecurity,
  authenticateUser,
  findItemById,
  findOneItemByQueryC,
  generateQuery,
  processFinderConditions,
} from '../item/item.service';
import { getProjectEncryption } from '../project/project.service';
import { privateUrl } from '../upload-api/fileUpload.service';
import { createAuditTrail } from '../logs/audit/audit.service';
import {
  extractFirstSubTenantIdFromUserAndTenantId,
  extractUserSettingFromUserAndTenant,
  getSubTenantById,
} from '../middleware/tenant.middleware';

const utilityUrlPaths = [
  '/login',
  '/anyFileToText',
  '/multi-file/anyFileToText',
  '/signup/send-email-otp',
  '/signup/verify-email-otp',
  '/login/send-email-otp',
  '/login/verify-email-otp',
  '/signup/send-sms-otp',
  '/signup/verify-sms-otp',
  '/login/send-sms-otp',
  '/login/verify-sms-otp',
];

export const shouldIncludeUser = async (projectId, otpAuthenticationType, type) => {
  let includeUserObj = true;
  if (otpAuthenticationType && otpAuthenticationType === 'signUp') {
    if (type === 'email') {
      const emailOtpAuthenticatorPlugin = await findInstalledPlugin(
        projectId,
        pluginCode.EMAIL_OTP_AUTHENTICATOR,
      );
      const { loginOnSignup } = emailOtpAuthenticatorPlugin.setting;
      includeUserObj = loginOnSignup;
    } else if (type === 'sms') {
      const smsOtpAuthenticatorPlugin = await findInstalledPlugin(
        projectId,
        pluginCode.SMS_OTP_AUTHENTICATOR,
      );
      const { loginOnSignup } = smsOtpAuthenticatorPlugin.setting;
      includeUserObj = loginOnSignup;
    }
  }
  return includeUserObj;
};

export const bulkDeleteService = async (db, collectionName, query) => {
  const dbCollection = await db.collection(collectionName);
  let result = await dbCollection.deleteMany(query);
  return result;
};

export const sendEmailService = async (req) => {
  const { projectId, params, projectUrl } = req;
  let { sendTo, templateId } = params;
  let templateResponse = await findTemplate(projectId, templateId);
  if (!templateResponse) throw { message: 'Template could not be found.' };
  if (!sendTo) throw { message: 'Please use a Valid email or uuid of the user' };
  if (!validateEmail(sendTo)) {
    if (validateUuidString(sendTo)) {
      const { field, error } = await getEmailFromItem(req, sendTo, userCollectionName);
      if (error) {
        throw { message: error };
      } else sendTo = field;
    } else throw { message: 'Please use a Valid email or uuid of the user' };
  }
  req.headers.origin = req.headers.origin ? req.headers.origin : `https://${projectUrl}`;
  req.body = { sendTo, previousActionResponse: {}, previousActionFormData: {} };
  return await sendEmailTemplateService(req);
};

const getEmailFromItem = async (req, sendTo, collectionName, sendToField) => {
  const { db, projectId } = req;
  let field = '';
  const collection = await findOneCollectionService(projectId, collectionName);
  if (!collection) return { field, error: `${collectionName} Collection does not exist.` };
  const { data } = await findItemById(db, projectId, collection, null, {
    uuid: sendTo,
  });
  if (!data || (data && !Object.keys(data).length))
    return { field, error: 'User does not exist with this id.' };
  let emailFieldName = sendToField ? sendToField : 'email';
  const emailFieldValue = data?.[emailFieldName];
  if (emailFieldValue) {
    field = emailFieldValue;
  } else {
    field = data?.['userName'];
  }
  if (field) {
    // if (validateEmail(field)) {
    return { field, error: '' };
    // } else return { field, error: 'User does not a Valid Email.' };
  } else return { field, error: 'Email or Username field does not exist.' };
};
export const getFileBufferService = async (
  db,
  projectId,
  environment,
  collectionName,
  itemUuid,
  fileObjectUuid,
  fieldName,
) => {
  try {
    const collection = await db.collection(collectionName?.toString().toLowerCase());
    if (!collection) {
      return COLLECTION_NOT_EXIST_MSG;
    }
    const item = await findOneItemByQueryC(collection, collectionName, { uuid: itemUuid });
    if (!item) {
      return { code: 404, error: 'Item does not exist' };
    }
    const fileArray = item[fieldName];
    if (!Array.isArray(fileArray) || fileArray.length === 0) {
      return { code: 404, error: 'No files exist in the given field' };
    }
    const file = fileArray.find((f) => f.uuid === fileObjectUuid);
    if (!file) {
      return { code: 404, error: 'No file found with the given UUID' };
    }
    const { key, isEncrypted } = file;
    const encryptionConfig = await getProjectEncryption(projectId);
    const s3Config = await loadS3PluginConfig(projectId, environment);
    const awsConfig = {
      region: s3Config.region,
      accessKey: s3Config.accessKeyId,
      accessSecret: s3Config.secretAccessKey,
    };
    const s3Client = createS3Client(awsConfig);
    if (!s3Client) {
      return { code: 500, error: 'Failed to initialize S3 client' };
    }
    const fileBuffer = await privateUrl(
      key,
      isEncrypted,
      encryptionConfig.encryption,
      s3Client,
      s3Config.bucket,
      false,
    );
    return {
      code: 200,
      message: 'File buffer fetched successfully',
      data: fileBuffer,
    };
  } catch (error) {
    console.error('Error in getFileBufferService:', error);
    return { code: 500, error: 'Internal Server Error' };
  }
};

export const updateFileObjectById = async (
  body,
  db,
  enableAuditTrail,
  user,
  collectionName,
  itemUuid,
  fileObjectUuid,
  fieldName,
) => {
  try {
    if (itemUuid) {
      const query = { uuid: itemUuid };

      collectionName = collectionName.toString().toLowerCase();
      const dbCollection = await db.collection(collectionName);

      const fieldData = await findOneItemByQueryC(dbCollection, collectionName, query);
      if (fieldData) {
        const collItem = Object.assign({}, fieldData);
        let fileData = fieldData[fieldName];
        if (fileData) {
          const allowedUpdates = ['smallIcon', 'mediumIcon', 'largeIcon', 'originalName'];
          const invalidKeys = Object.keys(body).filter((key) => !allowedUpdates.includes(key));

          if (invalidKeys.length > 0) {
            return {
              code: 400,
              message: `Invalid properties: ${invalidKeys.join(
                ', ',
              )}. Only smallIcon, mediumIcon, largeIcon and originalName can be updated.`,
            };
          }

          let updatedFileData;
          if (Array.isArray(fileData)) {
            updatedFileData = fileData.map((file) =>
              file.uuid === fileObjectUuid ? { ...file, ...body } : file,
            );
          } else if (fileData.uuid === fileObjectUuid) {
            updatedFileData = { ...fileData, ...body };
          } else {
            return { code: 404, message: 'File object not found for the given UUID.' };
          }

          const updatedFieldData = {
            ...fieldData,
            [fieldName]: updatedFileData,
          };

          // FINAL: START:Audit Trail
          createAuditTrail(
            db,
            enableAuditTrail,
            'DEVELOPER_API',
            'update',
            user,
            collectionName,
            { [fieldName]: updatedFieldData },
            { [fieldName]: collItem[fieldName] },
          );
          // END:Audit Trail
          await dbCollection.updateOne(query, { $set: updatedFieldData });
          return { code: 200, message: 'File object updated successfully.' };
        } else {
          return { code: 404, message: 'File data not found for the given collection field.' };
        }
      } else {
        return { code: 404, message: 'Field data not found.' };
      }
    } else {
      return { code: 400, message: 'Item ID is required.' };
    }
  } catch (error) {
    console.error('Error while updating file object', error);
    return { code: 500, message: 'Internal server error.' };
  }
};
export const dynamicEmailService = async (req) => {
  const { projectId, params, projectUrl, body } = req;
  const { templateId, collectionItemId, sendToCollectionName } = params;
  const { sendTo, emailCC, emailBCC, sendToField, emailServicePlugin = 'AWS_SES' } = body;
  let templateResponse = await findTemplate(projectId, templateId);
  if (!templateResponse) throw { message: 'Template could not be found.' };
  if (!sendTo || !sendTo.length) throw { message: 'Please use a Valid email or uuid of the user' };

  const { finalData: finalSendTo, errors: errSendTo } = await validateUserDetailsForEmail(
    req,
    sendTo,
    sendToCollectionName,
    sendToField,
  );
  const { finalData: finalCC, errors: errCC } = await validateUserDetailsForEmail(
    req,
    emailCC,
    sendToCollectionName,
    sendToField,
  );
  const { finalData: finalBCC, errors: errBCC } = await validateUserDetailsForEmail(
    req,
    emailBCC,
    sendToCollectionName,
    sendToField,
  );

  req.headers.origin = req.headers.origin ? req.headers.origin : `https://${projectUrl}`;
  let response = {};
  if (finalSendTo.length) {
    req.body = {
      sendTo: finalSendTo,
      cc: finalCC.length ? finalCC : [],
      bcc: finalBCC.length ? finalBCC : [],
      previousActionResponse: {},
      previousActionFormData: {},
      sessionStorageData: {},
      localStorageData: {},
      cookiesData: {},
      templatesRules: [{ templateId, emailServicePlugin }],
      eventItemConfig: { dataItemId: collectionItemId },
    };
    response = await sendDynamicEmailService(req, true);
  }
  let error = [];
  if (errSendTo) error = [...error, ...errSendTo];
  if (errCC) error = [...error, ...errCC];
  if (errBCC) error = [...error, ...errBCC];
  return { ...response, error };
};
const validateUserDetailsForEmail = async (req, data, collectionName, sendToField) => {
  const finalData = [];
  const errors = [];
  if (data) {
    await Promise.all(
      data.map(async (sendTo) => {
        if (!validateEmail(sendTo)) {
          if (validateUuidString(sendTo)) {
            const { field, error } = await getEmailFromItem(
              req,
              sendTo,
              collectionName,
              sendToField,
            );
            if (error) {
              errors.push({ uuid: sendTo, message: error });
            } else {
              finalData.push(field);
            }
          } else {
            errors.push({ uuid: sendTo, message: 'Please use a Valid email or uuid of the user' });
          }
        } else {
          finalData.push(sendTo);
        }
      }),
    );
  }
  return { finalData, errors };
};

export const processItemsByFilter = async (
  db,
  projectId,
  collection,
  headerToken,
  timezone,
  headers,
  queryData = {},
  count = 0,
  search = 0,
  stopNestedFilter = false,
  dateFormat,
  tenant = null,
  subTenant = null,
) => {
  let {
    collectionName,
    isPrivate,
    constants,
    externalParams,
    finder,
    noOfExternalParams,
    refCollectionFields,
    fields,
    enableLookup,
    lookups,
    rowLevelSecurityFilter,
  } = collection;
  // Format date fields
  formatDateFields(queryData, dateFormat, fields);
  const lookupConfig = { enableLookup, lookups };
  let currentUser;

  isPrivate = `${isPrivate}`;
  if (isPrivate == 'true') {
    currentUser = await authenticateUser(db, projectId, headerToken);
    if (!currentUser) {
      return { code: 401, message: 'Authentication Failed. Please login.' };
    }
  }
  if (stopNestedFilter) finder.fieldsInclude = ['uuid']; // select uuid field from inner filter query

  if (noOfExternalParams != 0) {
    const result = checkParams(externalParams, queryData);
    if (!result) {
      return {
        code: 422,
        message: `External params should be in [${externalParams}]`,
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

  const currentTenant = tenant ? tenant : currentUser?.tenantId?.[0] || '';
  const currentUserSettings = await extractUserSettingFromUserAndTenant(
    db,
    projectId,
    currentUser,
    currentTenant,
  );
  let currentSubTenant = subTenant;
  if (!currentSubTenant && currentTenant) {
    const currentSubTenantId = await extractFirstSubTenantIdFromUserAndTenantId(
      db,
      projectId,
      currentUser,
      currentTenant.uuid,
    );
    currentSubTenant = (await getSubTenantById(db, projectId, currentSubTenantId)) || '';
  }

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
    db,
    projectId,
    finder,
    rowLevelSecurityFilter,
    commonSetting,
  );

  // Process finder conditions
  await processFinderConditions(db, projectId, finder, commonSetting);

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
    let dbCollection = db.collection(collectionName);
    let result = await dbCollection
      .aggregate(JSON.parse(JSON.stringify(query)), {
        collation: { locale: 'en' },
        allowDiskUse: true,
      })
      .toArray();

    // Process results based on finder type
    result = processQueryResult(finder.finder, result, queryData);

    //It is used in item.service but not here, need to verify
    // result = processFieldsInclude(finder, result, currentUser);

    return { code: 200, message: 'success', result, count };
  } catch (error) {
    console.error('error :>> ', error);
    return { code: 400, message: error.message };
  }
};

export const genericQuery = (value, fields) => {
  try {
    /**
     * page and limit/max is used to manage pagintion automatically (page-1*limit)
     * offset and limit/max is used for custom pagination (skip: offset)
     * user will send offset by preparing (page-1*limit)
     */
    const { max = 100, offset, page, limit, searchTerm, sortField, sortOrder } = value;
    ['max', 'offset', 'page', 'limit', 'searchTerm', 'sortField', 'sortOrder', 'ids'].forEach(
      (param) => {
        if (param in value) {
          delete value[param];
        }
      },
    );
    let initialQuery = value;
    let filter = [{ $match: {} }];
    if (searchTerm) {
      let searchConditions = [];
      fields.forEach((field) => {
        searchConditions.push({
          [field.fieldName]: { $regex: new RegExp(searchTerm, 'i') },
        });
      });
      if (searchConditions.length) {
        filter[0].$match.$or = searchConditions;
      }
    }

    for (const property in initialQuery) {
      let fieldName = property.split(':')[0];
      let condition = property.split(':')[1];
      let value = compareFieldsType({
        fieldName,
        value: initialQuery[property],
        fields,
        condition,
      });
      filter[0].$match[fieldName] = checkKey(condition, value);
    }

    if (sortField) {
      const sortOrderValue = sortOrder === 'asc' ? 1 : -1;
      filter.push({ $sort: { [sortField]: sortOrderValue } });
    } else {
      filter.push({ $sort: { _id: -1 } });
    }
    let finalLimit = parseInt(limit) || parseInt(max);
    let skipValue = 0;

    if (page && parseInt(page) >= 1) {
      skipValue = (parseInt(page) - 1) * finalLimit;
    } else if (offset) {
      skipValue = parseInt(offset);
    }
    if (skipValue > 0) {
      filter.push({ $skip: skipValue });
    }
    filter.push({ $limit: finalLimit });
    return filter;
  } catch (error) {
    console.error('Error constructing query:', error.message);
  }
};
const compareFieldsType = ({ fieldName, value, fields, condition }) => {
  let newValue = value;
  const selField = fields.find((_doc) => _doc.fieldName === fieldName);
  if (selField && selField.type === 'number') {
    newValue = +newValue;
  }

  if ([IN_LIST, NOT_IN_LIST].includes(condition) && newValue.includes(',')) {
    newValue = newValue.split(',');
    if (newValue.length) newValue = newValue.filter((val) => val);
  }
  return newValue;
};

const checkKey = (type, value) => {
  switch (type) {
    case IS_NOT_NULL:
      return { $ne: null };
    case IS_NULL:
      return null;
    case EQUALS:
      return { $regex: new RegExp(`^${value}$`, 'i') };
    case IN_LIST:
      if (!Array.isArray(value)) {
        value = [value];
      }
      return { $in: value };
    case NOT_IN_LIST:
      if (!Array.isArray(value)) {
        value = [value];
      }
      return { $nin: value };
    case LIKE:
      return { $regex: value, $options: 'i' };
    case LESS_THAN_EQUALS_TO:
      return { $lte: value };
    case GREATER_THAN_EQUALS_TO:
      return { $gte: value };
    case LESS_THAN:
      return { $lt: value };
    case GREATER_THAN:
      return { $gt: value };
  }
};

export const findOneDevApisService = async (query) => {
  console.log('query :>> ', query);
  const { url, projectId, method } = query;
  const devApis = loadDevAPIs(projectId);
  let fDevApis = [];
  if (utilityUrlPaths.includes(url)) {
    fDevApis = devApis.filter((api) => url === api.url);
  } else {
    // const basePath = url.replace(/\/[^/]*$/, '');
    // const regex = new RegExp(`^${basePath}/[^/]+$`);
    // fDevApis = devApis.filter((api) => regex.test(api.url));

    const normalizePattern = (path) => {
      if (!path) return '';
      let normalized = path.split('?')[0];
      normalized = normalized.replace(/\/+$/, '');

      // Replace UUIDs (standard v4)
      normalized = normalized.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '{id}',
      );

      // Replace any {dynamicValues} or unknown tokens like {itemUuid}
      normalized = normalized.replace(/\{[^}]+\}/g, '{id}');

      return normalized;
    };

    const getBaseAndCollection = (path) => {
      const bases = [
        '/collection/',
        '/updateFileObject/',
        '/get-file-buffer/',
        '/typesense-search/get-all-indexed-data/',
      ];

      for (const base of bases) {
        if (path.startsWith(base)) {
          const parts = path.split('/');
          // ['', 'collection', 'student', 'items']
          const collectionName = parts[2] || '';
          return { base, collectionName };
        }
      }
      return { base: '', collectionName: '' };
    };

    const isMatchingApi = (apiUrl, currentUrl) => {
      const normApi = normalizePattern(apiUrl);
      const normCurrent = normalizePattern(currentUrl);

      // Extract collection info for strict matching
      const { collectionName: apiCollection } = getBaseAndCollection(normApi);
      const { collectionName: currentCollection } = getBaseAndCollection(normCurrent);

      // collection must match exactly
      if (apiCollection && currentCollection && apiCollection !== currentCollection) {
        return false;
      }

      // Now compare normalized URLs ignoring trailing slashes & params
      const regex = new RegExp(`^${normApi.replace(/\{id\}/g, '[^/]+')}$`, 'i');

      return regex.test(normCurrent);
    };

    fDevApis = devApis.filter((api) => isMatchingApi(api.url, url));
  }
  if (!fDevApis || fDevApis.length === 0) {
    return null;
  }
  console.log('fDevApis :>> ', fDevApis);
  return checkMethodType(fDevApis, method);
};

const checkMethodType = (urlRes, method) => {
  if (!urlRes || urlRes.length === 0) return null;
  // Step 1: Prefer exact method match
  let result = urlRes.find((api) => api.method === method);
  if (result) return result;

  // Step 2: Fallback to base method match (e.g. 'POST' from 'POST_BULK_DELETE')
  const baseMethod = method.split('_')[0];
  return urlRes.find((api) => api.method.split('_')[0] === baseMethod && api.url === urlRes[0].url);
};
export const checkIpAddresses = (clientIp, ipAddresses) => {
  if (!ipAddresses || !ipAddresses.length) {
    return true;
  }
  if (typeof clientIp === 'string') {
    clientIp = clientIp.split(',').map((ip) => ip.trim());
  }
  return clientIp.find((ip) => ipAddresses.includes(ip));
};
