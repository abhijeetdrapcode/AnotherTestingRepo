import { findOneCollectionService } from '../collection/collection.service';
import { bulkDeleteService } from '../developer/dev.service';
import {
  findOneItemByQuery,
  getItemCount,
  list,
  removeItemById,
  saveBulkDataFromDeveloperAPI,
  saveItem,
  updateItemById,
} from '../item/item.service';

export const saveItemInMetaDataTableService = async ({
  db,
  projectId,
  metaDataCollection,
  targetDataCollection,
  metaDataMapping,
  formCollectionName,
  saveItemResponse,
  enableAuditTrail,
  environment,
  user,
  headers,
  decrypt,
}) => {
  try {
    if (formCollectionName !== targetDataCollection) {
      return { code: 400, message: 'Form Collection and Target Data Collection should be same.' };
    }
    const metaDataCollectionDetails = await findOneCollectionService(projectId, metaDataCollection);
    if (!metaDataCollectionDetails) {
      return { code: 404, message: 'Meta Data Collection Not found.' };
    }
    const mappingDetails = metaDataCollectionDetails.metaDataTableMapping.find(
      (mapping) => mapping.uuid === metaDataMapping,
    );
    if (!mappingDetails) {
      return { code: 404, message: 'Meta Data Mapping Not found.' };
    }
    const mappedData = {};
    if (mappingDetails.primaryKey) {
      const primaryKeyField = mappingDetails.primaryKey;
      mappedData['primary_key'] = saveItemResponse[primaryKeyField] || '';
    }
    for (const {
      metaDataField,
      targetCollectionField,
      referenceCollectionField,
      referenceCollectionName,
    } of mappingDetails.mappings) {
      const fieldValue = saveItemResponse[targetCollectionField];
      if (referenceCollectionField && referenceCollectionName && fieldValue) {
        const referenceItem = await findOneItemByQuery(db, referenceCollectionName, {
          uuid: fieldValue[0],
        });
        mappedData[metaDataField] = referenceItem
          ? referenceItem[referenceCollectionField]
          : fieldValue;
      } else {
        mappedData[metaDataField] = fieldValue;
      }
    }

    const response = await saveItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      metaDataCollectionDetails,
      mappedData,
      null,
      user,
      headers,
      decrypt,
    );
    return response;
  } catch (error) {
    console.error('Error in saveItemInMetaDataTableService', error);
    throw error;
  }
};

export const updateItemInMetaDataTableService = async ({
  db,
  projectId,
  metaDataCollection,
  targetDataCollection,
  metaDataMapping,
  formCollectionName,
  updateItemResponse,
  enableAuditTrail,
  environment,
  user,
  headers,
  decrypt,
}) => {
  try {
    if (formCollectionName !== targetDataCollection) {
      return { code: 400, message: 'Form Collection and Target Data Collection should be same.' };
    }
    const metaDataCollectionDetails = await findOneCollectionService(projectId, metaDataCollection);
    if (!metaDataCollectionDetails) {
      return { code: 404, message: 'Meta Data Collection Not found.' };
    }
    const mappingDetails = metaDataCollectionDetails.metaDataTableMapping.find(
      (mapping) => mapping.uuid === metaDataMapping,
    );
    if (!mappingDetails) {
      return { code: 404, message: 'Meta Data Mapping Not found.' };
    }
    if (!mappingDetails.primaryKey) {
      return { code: 400, message: 'Primary Key is required in the mapping.' };
    }
    const primaryKeyField = mappingDetails.primaryKey;
    const primaryKeyValue = updateItemResponse[primaryKeyField];
    if (!primaryKeyValue) {
      return { code: 400, message: 'Primary Key value is missing in the update response.' };
    }
    const existingItem = await findOneItemByQuery(db, metaDataCollection, {
      primary_key: primaryKeyValue,
    });
    if (!existingItem) {
      return { code: 404, message: 'Item not found in Metadata Collection.' };
    }
    const mappedData = { ...existingItem };
    for (const {
      metaDataField,
      targetCollectionField,
      referenceCollectionField,
      referenceCollectionName,
    } of mappingDetails.mappings) {
      const fieldValue = updateItemResponse[targetCollectionField];
      if (referenceCollectionField && referenceCollectionName && fieldValue) {
        const referenceItem = await findOneItemByQuery(db, referenceCollectionName, {
          uuid: fieldValue[0],
        });
        mappedData[metaDataField] = referenceItem
          ? referenceItem[referenceCollectionField]
          : fieldValue;
      } else {
        mappedData[metaDataField] = fieldValue;
      }
    }
    delete mappedData._id;
    delete mappedData.updatedBy;
    delete mappedData.version;
    const response = await updateItemById(
      db,
      projectId,
      environment,
      enableAuditTrail,
      metaDataCollectionDetails,
      existingItem.uuid,
      mappedData,
      user,
      headers,
      decrypt,
    );
    return response;
  } catch (error) {
    console.error('Error in updateItemInMetaDataTableService', error);
    throw error;
  }
};

export const deleteItemInMetaDataTableService = async ({
  db,
  projectId,
  metaDataCollection,
  targetDataCollection,
  metaDataMapping,
  formCollectionName,
  deletedItemId,
  enableAuditTrail,
  environment,
}) => {
  try {
    if (formCollectionName !== targetDataCollection) {
      return { code: 400, message: 'Form Collection and Target Data Collection should be same.' };
    }
    const metaDataCollectionDetails = await findOneCollectionService(projectId, metaDataCollection);
    if (!metaDataCollectionDetails) {
      return { code: 404, message: 'Meta Data Collection Not found.' };
    }
    const mappingDetails = metaDataCollectionDetails.metaDataTableMapping.find(
      (mapping) => mapping.uuid === metaDataMapping,
    );
    if (!mappingDetails) {
      return { code: 404, message: 'Meta Data Mapping Not found.' };
    }
    if (!mappingDetails.primaryKey) {
      return { code: 400, message: 'Primary Key is required in the mapping.' };
    }
    const primaryKeyValue = deletedItemId;
    if (!primaryKeyValue) {
      return { code: 400, message: 'Primary Key value is missing in the update response.' };
    }
    const existingItem = await findOneItemByQuery(db, metaDataCollection, {
      primary_key: primaryKeyValue,
    });
    if (!existingItem) {
      return { code: 404, message: 'Item not found in Metadata Collection.' };
    }
    const response = await removeItemById(
      db,
      projectId,
      environment,
      enableAuditTrail,
      metaDataCollection,
      existingItem.uuid,
    );
    return response;
  } catch (error) {
    console.error('Error in deleteItemInMetaDataTableService', error);
    throw error;
  }
};

export const mapAllDataInMetaDataTableService = async ({
  db,
  projectId,
  environment,
  enableAuditTrail,
  metaDataCollection,
  targetDataCollection,
  metaDataMapping,
}) => {
  try {
    const metaDataCollectionDetails = await findOneCollectionService(projectId, metaDataCollection);
    if (!metaDataCollectionDetails) {
      return { code: 404, message: 'Meta Data Collection Not found.' };
    }
    const targetDataCollectionDetails = await findOneCollectionService(
      projectId,
      targetDataCollection,
    );
    if (!targetDataCollectionDetails) {
      return { code: 404, message: 'Target Collection Not found.' };
    }
    const mappingDetails = metaDataCollectionDetails.metaDataTableMapping.find(
      (mapping) => mapping.uuid === metaDataMapping,
    );
    if (!mappingDetails) {
      return { code: 404, message: 'Meta Data Mapping Not found.' };
    }
    await bulkDeleteService(db, metaDataCollection, {});
    const { data: collectionItemCount = 0 } = await getItemCount(db, targetDataCollection);
    if (collectionItemCount === 0) {
      return { code: 204, message: 'No data available to map' };
    }
    const collectionAllData = await list(db, projectId, targetDataCollectionDetails, null, {
      max: collectionItemCount,
    });
    const mappedData = collectionAllData.map((item) => {
      const mappedItem = {};
      if (mappingDetails.primaryKey) {
        const primaryKeyField = mappingDetails.primaryKey;
        mappedItem['primary_key'] = item[primaryKeyField] || '';
      }
      for (const {
        metaDataField,
        targetCollectionField,
        referenceCollectionField,
      } of mappingDetails.mappings) {
        let fieldValue = item[targetCollectionField];

        if (Array.isArray(fieldValue)) {
          mappedItem[metaDataField] =
            fieldValue.length > 0
              ? fieldValue
                  .map((refItem) => refItem[referenceCollectionField])
                  .filter(Boolean)
                  .join(', ')
              : '';
        } else {
          mappedItem[metaDataField] = fieldValue || '';
        }
      }
      return mappedItem;
    });
    const results = await saveBulkDataFromDeveloperAPI(
      db,
      projectId,
      environment,
      enableAuditTrail,
      metaDataCollection,
      mappedData,
      'string',
      true,
    );
    if (results.length) return { code: 200, message: 'Data Mapped Successfully' };
    return { code: 500, message: 'Some Error Occured' };
  } catch (error) {
    console.error('Error in mapAllDataInMetaDataTableService', error);
    throw error;
  }
};
