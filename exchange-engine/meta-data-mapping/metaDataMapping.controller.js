import {
  saveItemInMetaDataTableService,
  updateItemInMetaDataTableService,
  deleteItemInMetaDataTableService,
  mapAllDataInMetaDataTableService,
} from './metaDataMapping.service';
import voca from 'voca';

export const saveItemInMetaDataTable = async (req, res, next) => {
  try {
    const { db, body, projectId, user, enableAuditTrail, headers, decrypt, environment } = req;
    const {
      metaDataCollection,
      targetDataCollection,
      metaDataMapping,
      formCollectionName,
      saveItemResponse,
    } = body;
    for (const [key, value] of Object.entries(body)) {
      if (!value) {
        return res
          .status(400)
          .send({ error: `${voca.titleCase(voca.words(key).join(' '))} is required.` });
      }
    }
    const response = await saveItemInMetaDataTableService({
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
    });
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in saveItemInMetaDataTable:', error);
    next(error);
  }
};

export const updateItemInMetaDataTable = async (req, res, next) => {
  try {
    const { db, body, projectId, user, enableAuditTrail, headers, decrypt, environment } = req;
    const {
      metaDataCollection,
      targetDataCollection,
      metaDataMapping,
      formCollectionName,
      items: updateItemResponse,
    } = body;
    for (const [key, value] of Object.entries(body)) {
      if (!value) {
        return res
          .status(400)
          .send({ error: `${voca.titleCase(voca.words(key).join(' '))} is required.` });
      }
    }
    const response = await updateItemInMetaDataTableService({
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
    });
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in updateItemInMetaDataTable:', error);
    next(error);
  }
};

export const deleteItemInMetaDataTable = async (req, res, next) => {
  try {
    const { db, body, projectId, enableAuditTrail, environment } = req;
    const {
      metaDataCollection,
      targetDataCollection,
      metaDataMapping,
      formCollectionName,
      deletedItemId,
    } = body;
    for (const [key, value] of Object.entries(body)) {
      if (!value) {
        return res
          .status(400)
          .send({ error: `${voca.titleCase(voca.words(key).join(' '))} is required.` });
      }
    }
    const response = await deleteItemInMetaDataTableService({
      db,
      projectId,
      metaDataCollection,
      targetDataCollection,
      metaDataMapping,
      formCollectionName,
      deletedItemId,
      enableAuditTrail,
      environment,
    });
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in deleteItemInMetaDataTable:', error);
    next(error);
  }
};

export const mapAllDataInMetaDataTable = async (req, res, next) => {
  try {
    const { db, body, projectId, environment, enableAuditTrail } = req;
    const { metaDataCollection, targetDataCollection, metaDataMapping } = body;
    for (const [key, value] of Object.entries(body)) {
      if (!value) {
        return res
          .status(400)
          .send({ error: `${voca.titleCase(voca.words(key).join(' '))} is required.` });
      }
    }
    const response = await mapAllDataInMetaDataTableService({
      db,
      projectId,
      environment,
      enableAuditTrail,
      metaDataCollection,
      targetDataCollection,
      metaDataMapping,
    });
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in mapAllDataInMetaDataTable:', error);
    next(error);
  }
};
