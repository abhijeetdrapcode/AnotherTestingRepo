import Typesense from 'typesense';
import {
  findInstalledPlugin,
  loadTypesensePluginConfig,
} from '../install-plugin/installedPlugin.service';
import {
  BelongsCreatedByRefField,
  CURRENT_SETTINGS,
  CURRENT_SUB_TENANT,
  CURRENT_TENANT,
  CURRENT_USER,
  MultiSelectOptionFields,
  pluginCode,
} from 'drapcode-constant';
import { saveItemInTypesenseCollectionService } from './typesenseSearch.service';
import { extractUserSettingFromUserAndTenant } from '../middleware/tenant.middleware';
import { findOneItemByQuery } from '../item/item.service';
import { cryptService } from '../middleware/encryption.middleware';
import { findOneCollectionService } from '../collection/collection.service';
import { collectionNotFoundMessage } from '../utils/appUtils';

export const getTypesenseClient = (host, port, protocol, apiKey) => {
  const typesenseClient = new Typesense.Client({
    nodes: [
      {
        host,
        port,
        protocol,
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 120, //2 minutes
  });
  return typesenseClient;
};

export const generateTypesenseSchema = async (
  projectId,
  typesenseCollectionName,
  typesenseMapping,
) => {
  const multiTenantPlugin = await findInstalledPlugin(projectId, pluginCode.MULTI_TENANT_SAAS);
  const predefinedFields = new Set(['id', 'priority', 'projectId', 'createdBy', 'updatedBy']);
  if (multiTenantPlugin) {
    predefinedFields.add('tenantId');
  }
  const dynamicFields = [];
  for (const mapping of typesenseMapping) {
    const {
      fieldName,
      fieldType,
      allowedReferenceFields,
      maxLinkedItems = 1,
      nestedReferenceFields,
      fileReferenceFields,
    } = mapping;
    if (predefinedFields.has(fieldName)) continue;
    const maxItems = Number(maxLinkedItems) || 1;
    if ([...BelongsCreatedByRefField, ...MultiSelectOptionFields].includes(fieldType)) {
      dynamicFields.push({
        name: fieldName,
        type: typeMapping[fieldType] || 'string',
        optional: true,
        infix: true,
      });
    }
    if (
      [...BelongsCreatedByRefField, ...MultiSelectOptionFields].includes(fieldType) &&
      Array.isArray(allowedReferenceFields)
    ) {
      for (let i = 0; i < maxLinkedItems; i++) {
        for (const refField of allowedReferenceFields) {
          if (
            Array.isArray(fileReferenceFields) &&
            fileReferenceFields.length &&
            fileReferenceFields.includes(refField)
          ) {
            for (let j = 0; j < maxLinkedItems; j++) {
              for (const metaKey of fileMetaKeys) {
                dynamicFields.push({
                  name: `${fieldName}_${i}_${refField}_${j}_${metaKey}`,
                  type: 'string',
                  optional: true,
                  infix: true,
                });
              }
            }
          } else if (
            Array.isArray(nestedReferenceFields) &&
            nestedReferenceFields.length &&
            nestedReferenceFields.includes(refField)
          ) {
            for (let j = 0; j < maxLinkedItems; j++) {
              dynamicFields.push({
                name: `${fieldName}_${i}_${refField}_${j}_uuid`,
                type: 'string',
                optional: true,
                infix: true,
              });
            }
          } else {
            dynamicFields.push({
              name: `${fieldName}_${i}_${refField}`,
              type: 'string',
              optional: true,
              infix: true,
            });
          }
        }
      }
    } else if (fieldType === 'file') {
      for (let i = 0; i < maxItems; i++) {
        for (const key of fileMetaKeys) {
          dynamicFields.push({
            name: `${fieldName}_${i}_${key}`,
            type: 'string',
            optional: true,
            infix: true,
          });
        }
      }
    } else {
      dynamicFields.push({
        name: fieldName,
        type: typeMapping[fieldType] || 'string',
        optional: true,
        infix: true,
      });
    }
  }
  const baseFields = [...predefinedFields].map((name) => ({
    name,
    type: name === 'priority' ? 'int32' : name === 'tenantId' ? 'string[]' : 'string',
    optional: name === 'updatedBy' ? true : false,
    infix: true,
  }));
  return {
    name: typesenseCollectionName,
    fields: [...baseFields, ...dynamicFields],
    default_sorting_field: 'priority',
  };
};

export const retrieveTypesenseCollection = async (typesenseClient, typesenseCollectionName) => {
  try {
    return await typesenseClient.collections(typesenseCollectionName).retrieve();
  } catch (error) {
    if (error.httpStatus === 404) {
      return null;
    }
    console.error('Unexpected error while checking collection:', error);
    throw error;
  }
};

export const createTypesenseCollection = async (
  projectId,
  collectionDetails,
  typesenseClient,
  typesenseCollectionName,
  typesenseMapping,
) => {
  try {
    const typesenseSchema = await generateTypesenseSchema(
      projectId,
      typesenseCollectionName,
      typesenseMapping,
    );
    if (!typesenseSchema || !typesenseSchema.name || !typesenseSchema.fields) {
      throw new Error('Invalid Typesense schema: Missing required properties.');
    }
    const result = await typesenseClient.collections().create(typesenseSchema);
    return {
      code: 200,
      message: 'Collection created successfully.',
      data: result,
      collectionDetails,
    };
  } catch (error) {
    if (error.httpStatus === 400 && error.message.includes('already exists')) {
      return { code: 400, message: 'Collection already exists.', error };
    }
    console.error('Error creating Typesense collection:', error);
    return { code: 500, message: 'Failed to create Typesense collection.', error };
  }
};

export const prepareDataForTypesenseIndexing = async (
  projectId,
  environment,
  typesenseCollectionName,
  data,
  typesenseMapping,
) => {
  const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
  if (!typesenseSearchPlugin) {
    return { code: 404, message: 'Typesense search plugin not installed' };
  }
  const { host, port, protocol, apiKey } = typesenseSearchPlugin;
  const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
  const existingCollection = await retrieveTypesenseCollection(
    typesenseClient,
    typesenseCollectionName,
  );
  if (!existingCollection) {
    return { code: 404, message: 'Collection does not exist.' };
  }
  const collectionDetails = await findOneCollectionService(projectId, typesenseCollectionName);
  if (!collectionDetails) return collectionNotFoundMessage(typesenseCollectionName);
  data = Array.isArray(data) ? data : [data];
  let decryptedResponse = await cryptService(data, projectId, collectionDetails, true, false, true);
  if (decryptedResponse) {
    if (decryptedResponse.status === 'FAILED') {
      return null;
    } else {
      data = decryptedResponse;
    }
  }
  const typesenseData = data.map((item) => {
    const formattedDocument = {};
    typesenseMapping.forEach((mapping) => {
      const {
        fieldName,
        fieldType,
        priority,
        allowedReferenceFields = [],
        maxLinkedItems,
        nestedReferenceFields = [],
        fileReferenceFields = [],
      } = mapping;

      let value = item[fieldName] ?? '';
      const referenceFieldsToUse =
        allowedReferenceFields?.length > 0 ? allowedReferenceFields : ['uuid'];
      const processReference = (refObj, i, path = fieldName) => {
        if (!refObj || typeof refObj !== 'object') return;
        referenceFieldsToUse.forEach((key) => {
          if (!nestedReferenceFields.includes(key) && !fileReferenceFields.includes(key)) {
            if (refObj[key]) {
              formattedDocument[`${path}_${i}_${key}`] = String(refObj[key]);
            }
          }
        });
        nestedReferenceFields.forEach((nestedField) => {
          const nestedValue = refObj[nestedField];
          if (Array.isArray(nestedValue)) {
            const maxItemsNested = Number.isInteger(maxLinkedItems) ? maxLinkedItems : 1;
            for (let j = 0; j < nestedValue.length && j < maxItemsNested; j++) {
              processReference(nestedValue[j], j, `${path}_${i}_${nestedField}`);
            }
          } else if (nestedValue && typeof nestedValue === 'object') {
            processReference(nestedValue, 0, `${path}_${i}_${nestedField}`);
          }
        });
        fileReferenceFields.forEach((fileField) => {
          const fileData = refObj[fileField];
          if (Array.isArray(fileData)) {
            const maxFiles = Number.isInteger(maxLinkedItems) ? maxLinkedItems : 1;
            for (let j = 0; j < fileData.length && j < maxFiles; j++) {
              const f = fileData[j];
              if (typeof f === 'object' && f !== null) {
                fileMetaKeys.forEach((fk) => {
                  if (f[fk] !== undefined && f[fk] !== null) {
                    formattedDocument[`${path}_${i}_${fileField}_${j}_${fk}`] = String(f[fk]);
                  }
                });
              }
            }
          } else if (fileData && typeof fileData === 'object') {
            fileMetaKeys.forEach((fk) => {
              if (fileData[fk]) {
                formattedDocument[`${path}_${i}_${fileField}_0_${fk}`] = String(fileData[fk]);
              }
            });
          }
        });
      };
      if ([...BelongsCreatedByRefField, ...MultiSelectOptionFields].includes(fieldType)) {
        if (!value) value = [];
        if (Array.isArray(value)) {
          if (
            value.every(
              (refObj) => typeof refObj === 'object' && refObj !== null && 'uuid' in refObj,
            )
          ) {
            formattedDocument[fieldName] = value
              .map((refObj) => String(refObj.uuid))
              .filter(Boolean);
          } else {
            formattedDocument[fieldName] = value.filter(
              (v) => typeof v === 'string' && v.trim() !== '',
            );
          }
        } else if (typeof value === 'object' && value !== null && 'uuid' in value) {
          formattedDocument[fieldName] = [String(value.uuid)];
        } else if (typeof value === 'string') {
          formattedDocument[fieldName] = [value];
        } else {
          formattedDocument[fieldName] = [];
        }
        if (Array.isArray(value)) {
          const maxItems = Number.isInteger(maxLinkedItems) ? maxLinkedItems : 1;
          for (let i = 0; i < value.length && i < maxItems; i++) {
            processReference(value[i], i);
          }
        } else {
          processReference(value, 0);
        }
      } else if (fieldType === 'file') {
        if (Array.isArray(value)) {
          const limitedFiles = maxLinkedItems ? value.slice(0, maxLinkedItems) : value;
          limitedFiles.forEach((fileObj, index) => {
            if (typeof fileObj === 'object' && fileObj !== null) {
              fileMetaKeys.forEach((k) => {
                if (fileObj[k]) {
                  formattedDocument[`${fieldName}_${index}_${k}`] = String(fileObj[k]);
                }
              });
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          fileMetaKeys.forEach((k) => {
            if (value[k]) {
              formattedDocument[`${fieldName}_0_${k}`] = String(value[k]);
            }
          });
        }
      } else if (['createdAt', 'updatedAt', 'date'].includes(fieldType)) {
        formattedDocument[fieldName] = value ? Math.floor(new Date(value).getTime() / 1000) : 0;
      } else if (fieldType === 'number') {
        formattedDocument[fieldName] = isNaN(value) ? 0 : Number(value);
      } else if (Array.isArray(value)) {
        formattedDocument[fieldName] = value.map(String);
      } else {
        formattedDocument[fieldName] = String(value);
      }
      formattedDocument.priority = priority;
    });
    formattedDocument.id = item.uuid || '';
    formattedDocument.projectId = projectId;
    formattedDocument.tenantId = Array.isArray(item?.tenantId)
      ? item.tenantId.every((t) => typeof t === 'object' && t !== null && 'uuid' in t)
        ? item.tenantId.map((t) => t.uuid)
        : [item.tenantId[0]]
      : [];
    if (typeof item?.createdBy === 'string') {
      formattedDocument.createdBy = item.createdBy;
    } else if (Array.isArray(item?.createdBy)) {
      const first = item.createdBy[0];
      if (typeof first === 'object' && first !== null && 'uuid' in first) {
        formattedDocument.createdBy = String(first.uuid);
      } else if (typeof first === 'string') {
        formattedDocument.createdBy = first;
      } else {
        formattedDocument.createdBy = '';
      }
    } else {
      formattedDocument.createdBy = '';
    }
    if (typeof item?.updatedBy === 'string') {
      formattedDocument.updatedBy = item.updatedBy;
    } else if (Array.isArray(item?.updatedBy)) {
      const first = item.updatedBy[0];
      if (typeof first === 'object' && first !== null && 'uuid' in first) {
        formattedDocument.updatedBy = String(first.uuid);
      } else if (typeof first === 'string') {
        formattedDocument.updatedBy = first;
      } else {
        formattedDocument.updatedBy = '';
      }
    } else {
      formattedDocument.updatedBy = '';
    }
    return formattedDocument;
  });

  if (typesenseData.length === 0) {
    return { code: 200, message: 'No data to reindex in Typesense' };
  }
  const result = await saveItemInTypesenseCollectionService(
    typesenseClient,
    typesenseCollectionName,
    typesenseData,
  );
  return result;
};

export const prepareFilterByForTypesense = async (
  dbConnection,
  selectedFilter,
  projectId,
  user = {},
  tenant = {},
  subTenant = {},
  typesenseMapping,
  urlParams = {},
) => {
  const consumedKeys = []; // track used keys
  if (
    selectedFilter.finder === 'FIND_ALL' &&
    !selectedFilter.conditions.length &&
    selectedFilter.name === 'All Items'
  ) {
    return { filter: `projectId:=${projectId}`, consumedKeys };
  }
  if (
    !selectedFilter ||
    !Array.isArray(selectedFilter.conditions) ||
    selectedFilter.conditions.length === 0
  ) {
    return { filter: `uuid:="nonexistent-value"`, consumedKeys }; //to return no results
  }
  const userSetting = await extractUserSettingFromUserAndTenant(
    dbConnection,
    projectId,
    user,
    tenant,
  );
  const filterConditions = await Promise.all(
    selectedFilter.conditions.map(async (condition) => {
      let {
        conjunctionType,
        requiredExternal,
        query: { field, key, value, fieldType, refField, refCollection },
      } = condition;
      const isExcludedField = ['tenantId', 'createdBy'].includes(field);
      if (!isExcludedField) {
        const isFieldInMapping = typesenseMapping.some((schema) => schema.fieldName === field);
        if (!isFieldInMapping) {
          console.error(`${field} is not present in Typesense schema.`);
          return null;
        }
      }
      let filterValue = value;
      if (requiredExternal && urlParams[value]) {
        consumedKeys.push(value);
        if (fieldType === 'reference' || fieldType === 'belongsTo') {
          filterValue = Array.isArray(urlParams[value]) ? urlParams[value] : [urlParams[value]];
        } else filterValue = urlParams[value];
      }
      if (typeof filterValue === 'string' && filterValue.includes('::')) {
        const [source, fieldKey] = filterValue.split('::');
        if (source === 'CURRENT_TENANT' && tenant[fieldKey] !== undefined) {
          filterValue = tenant[fieldKey];
        } else if (source === 'CURRENT_USER' && user[fieldKey] !== undefined) {
          filterValue = user[fieldKey];
        } else if (source === 'CURRENT_SETTINGS' && userSetting[fieldKey] !== undefined) {
          filterValue = userSetting[fieldKey];
        } else if (source === 'CURRENT_SUB_TENANT' && subTenant[fieldKey] !== undefined) {
          filterValue = subTenant[fieldKey];
        }
      }
      if (field === 'createdBy' && filterValue === CURRENT_USER) {
        filterValue = user?.uuid || '';
      }
      if (
        (fieldType === 'reference' || fieldType === 'belongsTo') &&
        refField &&
        refCollection &&
        !requiredExternal
      ) {
        try {
          if (refCollection === CURRENT_USER) {
            if (refField === 'tenantId') {
              const allTenantIds = user[refField];
              const currentTenantId =
                allTenantIds.length === 1
                  ? allTenantIds[0]
                  : allTenantIds.find((t) => t === tenant.uuid);
              filterValue = currentTenantId;
            } else if (refField === 'userSettingId') {
              const allUserSettingIds = user[refField];
              const currentUserSettingId =
                allUserSettingIds.length === 1
                  ? allUserSettingIds[0]
                  : allUserSettingIds.find((setting) => setting === userSetting.uuid);
              filterValue = currentUserSettingId;
            } else if (refField === 'subTenantId') {
              const allSubTenants = user[refField];
              const currentSubTenant =
                allSubTenants.length === 1
                  ? allSubTenants[0]
                  : allSubTenants.find((sub) => sub === subTenant.uuid);
              filterValue = currentSubTenant;
            } else filterValue = user[refField];
          } else if (refCollection === CURRENT_TENANT) {
            filterValue = tenant[refField];
          } else if (refCollection === CURRENT_SETTINGS) {
            filterValue = userSetting[refField];
          } else if (refCollection === CURRENT_SUB_TENANT) {
            filterValue = subTenant[refField];
          } else {
            const valueArray = Array.isArray(value) ? value : [value];
            const refDataArray = await Promise.all(
              valueArray.map(async (val) => {
                return await findOneItemByQuery(dbConnection, refCollection, { [refField]: val });
              }),
            );
            const uuidArray = refDataArray
              .filter((item) => item && item.uuid !== undefined)
              .map((item) => item.uuid);
            if (uuidArray.length > 0) {
              filterValue = uuidArray.length === 1 ? uuidArray[0] : uuidArray;
            } else {
              return null;
            }
          }
        } catch (error) {
          console.error(`Error fetching reference field from ${refCollection}:`, error);
          return null;
        }
      }
      if (filterValue === null || filterValue === undefined || filterValue === '') {
        console.warn(`Skipping filter: ${field} has an empty value.`);
        return null;
      }
      if (key === 'IN_LIST' || key === 'NOT_IN_LIST') {
        const valueArray = Array.isArray(filterValue) ? filterValue : filterValue.split(',');
        filterValue = `[${valueArray.map((v) => `"${v}"`).join(', ')}]`;
      }
      const operatorMap = {
        EQUALS: ':=',
        NOT_EQUALS: ':!=',
        GREATER_THAN: ':>',
        GREATER_THAN_OR_EQUALS: ':>=',
        LESS_THAN: ':<',
        LESS_THAN_OR_EQUALS: ':<=',
        IN_LIST: ':=',
        NOT_IN_LIST: ':!=',
      };
      const typesenseOperator = operatorMap[key] || ':=';
      const filterExpression = ['IN_LIST', 'NOT_IN_LIST'].includes(key)
        ? `${field}${typesenseOperator}${filterValue}`
        : `${field}${typesenseOperator}"${filterValue}"`;
      const conjunction = conjunctionType === 'AND' ? '&&' : '||';
      return { filterExpression, conjunction };
    }),
  );
  const validFilters = filterConditions.filter(Boolean);
  if (validFilters.length === 0) {
    return `uuid:="nonexistent-value"`; //to return no results
  }
  const finalFilterQuery = validFilters
    .map((condition, index) => {
      if (index > 0) {
        return `${condition.conjunction} ${condition.filterExpression}`;
      }
      return condition.filterExpression;
    })
    .join(' ');
  return { filter: `${finalFilterQuery} && projectId:=${projectId}`, consumedKeys };
};

const typeMapping = {
  reference: 'string[]',
  belongsTo: 'string[]',
  static_option: 'string[]',
  dynamic_option: 'string[]',
  file: 'string[]',
  createdAt: 'int32',
  updatedAt: 'int32',
  number: 'float',
  unix_timestamp: 'int32',
  date: 'int32',
};

const fileMetaKeys = [
  'uuid',
  'originalName',
  'contentType',
  'mimeType',
  'size',
  'collectionName',
  'collectionField',
  'projectId',
  'key',
  'isEncrypted',
  'isPrivate',
  'smallIcon',
  'mediumIcon',
  'largeIcon',
];

export const fetchAllResultsForField = async (
  typesenseClient,
  collection,
  key,
  value,
  filterBy,
  sortBy,
  sortOrder,
) => {
  let allHits = [];
  let page = 1;
  const perPage = 250;
  let hasMore = true;
  while (hasMore) {
    const multiSearchResults = await typesenseClient.multiSearch.perform({
      searches: [
        {
          collection,
          q: String(value).trim().replace(/['"]/g, ''),
          query_by: key,
          filter_by: filterBy,
          per_page: perPage,
          page,
          sort_by: `${sortBy}:${sortOrder}`,
          infix: 'always',
        },
      ],
    });
    const result = multiSearchResults.results[0];
    allHits = allHits.concat(result.hits);
    hasMore = result.hits.length === perPage;
    page++;
  }
  return allHits;
};
