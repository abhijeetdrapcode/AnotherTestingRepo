import {
  checkCollectionByName,
  findCollection,
  findOneCollectionService,
} from '../../collection/collection.service';
import { findItemForBuilder } from '../../item/item.builder.service';
import {
  countByQueryOther,
  findItemById,
  findLastItem,
  list2,
  processCSVItems,
  saveItem,
  validateItemCollection,
} from '../../item/item.service';
import { checkPermissionLevelSecurity } from '../../item/item.utils';
import { cryptService } from '../../middleware/encryption.middleware';
import { processFileFieldForURL } from '../../upload-api/fileUpload.service';
import { bulkDeleteService, processItemsByFilter } from '../dev.service';
import { ErrorObj } from '../../utils/errors';
import {
  addReference,
  deleteFieldRecordFromItemsService,
  fetchUserDetailsService,
  removeReference,
} from './dev2.service';

export const createItem = async (req, res, next) => {
  const { params, db, body, user, projectId, enableAuditTrail, environment, headers } = req;
  const { constructorId, collectionName } = params;
  try {
    const collection = await checkCollectionByName(projectId, collectionName);

    if (!collection) {
      return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    }

    const response = await saveItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collection,
      body,
      constructorId,
      user,
      headers,
    );

    // if (response?.code !== 201) {
    return res.status(response.code).json(response);
    // }

    // return res.status(response.code).json(response.data);
  } catch (err) {
    next(err);
  }
};

export const findAllItems = async (req, res) => {
  try {
    const { db, params, projectId, decrypt, headers, environment } = req;
    const ids = req.body.ids || req.query.ids;
    const { collectionName } = params;
    const reqQuery = req.query;
    const { authorization } = headers;
    let reqFromDeveloperController = true;
    const collection = await checkCollectionByName(projectId, collectionName);
    if (!collection) {
      return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    }

    let result = await list2(
      db,
      projectId,
      collection,
      ids,
      reqQuery,
      decrypt,
      reqFromDeveloperController,
    );

    if (result.code !== 200) {
      return res.status(result.code).json(result);
    }

    const { permissionLevelSecurity = [], fields } = collection;
    let resultAfterFile = await processFileFieldForURL(
      result.result,
      projectId,
      environment,
      fields,
    );

    if (permissionLevelSecurity && permissionLevelSecurity.length) {
      resultAfterFile = await checkPermissionLevelSecurity(
        db,
        projectId,
        authorization,
        permissionLevelSecurity,
        resultAfterFile,
      );
    }
    result.result = resultAfterFile;
    return res.status(200).json(result);
  } catch (error) {
    console.log('error :>> ', error);
    res.status(400).json({ message: 'Failed' });
  }
};
export const findItemDetail = async (req, res) => {
  try {
    const { params, db, projectId, decrypt, headers, environment } = req;
    const { collectionName, itemUuid } = params;
    const { authorization } = headers;
    const collection = await findOneCollectionService(projectId, collectionName);
    if (!collection) {
      return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    }

    const result = await findItemById(db, projectId, collection, itemUuid, null);
    if (!result || result.code === 404) {
      res.status(404).send({
        code: 404,
        message: `Record not found with id ${itemUuid}`,
        error: `Record not found with id ${itemUuid}`,
        status: 'error',
      });
      return;
    }
    if (decrypt) {
      let encryptedResponse;
      if (result && result.data) {
        encryptedResponse = await cryptService(
          result.data,
          projectId,
          collection,
          true,
          false,
          decrypt,
        );
      }
      if (encryptedResponse) {
        if (encryptedResponse.status === 'FAILED') {
          res.status(400).json({
            code: 400,
            message: encryptedResponse.message,
            error: encryptedResponse.message,
            data: '',
            status: 'error',
          });
        } else {
          result.data = encryptedResponse;
        }
      }
    }
    const { permissionLevelSecurity = [], fields } = collection;
    result.data = await processFileFieldForURL(result.data, projectId, environment, fields);
    if (permissionLevelSecurity && permissionLevelSecurity.length) {
      result.data = await checkPermissionLevelSecurity(
        db,
        projectId,
        authorization,
        permissionLevelSecurity,
        result.data,
      );
    }
    if (result.code !== 200) {
      return res.status(result.code).json(result);
    }
    return res
      .status(result.code)
      .json({ code: result.code, data: result.data, error: '', message: '', status: 'success' });
  } catch (error) {
    console.error('error :>> ', error);
    res.status(400).json({ message: 'Failed' });
  }
};

export const findItemOnly = async (req, res) => {
  const { db, params } = req;
  const { collectionName, itemUuid } = params;
  const result = await findItemForBuilder(db, collectionName, itemUuid);
  if (!result) {
    res.status(404).send({ message: `Record not found with id ${itemUuid}` });
    return;
  }
  res.status(200).send(result);
};
export const countItemByField = async (req, res) => {
  const { db, params, body } = req;
  const { collectionName } = params;
  const { fieldName, fieldValue } = body;
  const result = await countByQueryOther(db, collectionName, fieldName, fieldValue);
  res.status(200).send(result);
};

export const processCSVData = async (req, res) => {
  const { db, params, body, projectId, user } = req;
  const { collectionName } = params;
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
  }

  const { items } = body;
  const response = await processCSVItems(db, projectId, collectionData, items, user, null);

  res.status(response.code).json(response);
};

export const validateItem = async (req, res) => {
  const { db, params, projectId, body } = req;
  const { collectionName } = params;
  const { itemData } = body;
  const collectionData = await checkCollectionByName(projectId, collectionName);
  if (!collectionData) {
    return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
  }
  const errorJson = await validateItemCollection(db, collectionData, itemData);
  if (Object.keys(errorJson).length !== 0) {
    const { field, isExist } = errorJson;
    if (field === 0) {
      return res.status(422).json({
        code: 422,
        data: `${isExist} field does not exist.`,
        message: `${isExist} field does not exist.`,
        status: 'FAILED',
      });
    }
    if (field)
      return res.status(409).json({
        code: 409,
        message: 'Validation Failed',
        data: field,
        status: 'FAILED',
      });
  }
  return { code: 201, data: {}, message: 'Validated', status: 'SUCCESS' };
};

export const lastItem = async (req, res) => {
  const { params, db } = req;
  const { collectionName } = params;
  const lastItem = await findLastItem(db, collectionName);
  return res.status(200).json(lastItem);
};

export const clearItem = async (req, res) => {
  const { params, db } = req;
  const { collectionName } = params;
  await db.dropCollection(collectionName);
  return res.status(200).json({});
};

export const deleteFieldRecordFromItems = async (req, res, next) => {
  try {
    const {
      db,
      params: { collectionName, fieldName },
      enableAuditTrail,
    } = req;
    await deleteFieldRecordFromItemsService(db, enableAuditTrail, collectionName, fieldName);
    res.status(200).send({ message: `${fieldName} field deleted from ${collectionName}` });
  } catch (error) {
    next(error);
  }
};

export const removeReferenceItem = async (req, res, next) => {
  try {
    const { db, body, params, enableAuditTrail } = req;
    const { collectionName } = params;
    const result = await removeReference(db, enableAuditTrail, collectionName, body);
    res.status(200).json({ code: 200, data: result });
  } catch (error) {
    next(error);
  }
};

export const addReferenceItem = async (req, res, next) => {
  try {
    const { db, body, params, enableAuditTrail } = req;
    const { collectionName } = params;
    const result = await addReference(db, enableAuditTrail, collectionName, body);
    res.status(200).json({ code: 200, data: result });
  } catch (error) {
    next(error);
  }
};

export const findItemsByFilter = async (req, res) => {
  const {
    params,
    headers,
    query,
    projectId,
    db,
    project,
    dateFormat,
    decrypt,
    environment,
    tenant,
    subTenant,
  } = req;
  const { collectionName, filterUuid } = params;
  const { authorization } = headers;

  try {
    let collection = await findCollection(projectId, collectionName, filterUuid);
    if (!collection) {
      return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    }

    let { code, result, message } = await processItemsByFilter(
      db,
      projectId,
      collection,
      authorization,
      project.timezone,
      headers,
      query,
      0,
      1,
      false,
      dateFormat,
      tenant,
      subTenant,
    );
    if (code !== 200) {
      return { code, message, status: 'error', data: [], error: '' };
    }
    if (decrypt) {
      let encryptedResponse;
      if (result) {
        encryptedResponse = await cryptService(result, projectId, collection, true, false, decrypt);
      }
      if (encryptedResponse) {
        if (encryptedResponse.status === 'FAILED') {
          res.status(400).send({ message: encryptedResponse.message });
        } else {
          result = encryptedResponse;
        }
      }
    }
    console.log('Developer API filter checking permission level security');

    const { permissionLevelSecurity = [], fields } = collection;
    result = await processFileFieldForURL(result, projectId, environment, fields);
    if (permissionLevelSecurity && permissionLevelSecurity.length) {
      result = await checkPermissionLevelSecurity(
        db,
        projectId,
        authorization,
        permissionLevelSecurity,
        result,
      );
    }
    console.log('Developer API filter, finally sending response');
    let response = { code, data: result, status: 'success', message: '', error: '' };
    console.log('Developer API filter, finally response sent');
    res.status(code).json(response);
  } catch (error) {
    console.error(error);
    res.status(400).json({ code: 400, message: 'Failed', status: 'error', data: [], error: '' });
  }
};
export const countItemsByFilter = async (req, res) => {
  const { params, headers, query, projectId, db, project, dateFormat } = req;
  const { collectionName, filterUuid } = params;
  const { authorization } = headers;
  try {
    let collection = await findCollection(projectId, collectionName, filterUuid);
    if (!collection) {
      return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    }

    let { code, result, message } = await processItemsByFilter(
      db,
      projectId,
      collection,
      filterUuid,
      authorization,
      project.timezone,
      headers,
      query,
      1,
      1,
      false,
      dateFormat,
    );
    let response = code != 200 ? { code, message } : { code, result };
    res.status(code).json(response);
  } catch (error) {
    console.error('error', error);
    res.status(400).json({ message: 'Failed' });
  }
};

export const bulkDelete = async (req, res) => {
  try {
    const { db, params, projectId, body } = req;
    let { collectionName } = params;
    const { ids } = body;
    let isExist = await checkCollectionByName(projectId, collectionName);
    if (!isExist) return res.status(404).json(ErrorObj.COLLECTION_NOT_FOUND);
    if (!ids || !ids.length) return res.status(400).json(ErrorObj.MISSING_IDS);

    const query = { uuid: { $in: ids } };
    console.log('query :>> ', query);
    let data = await bulkDeleteService(db, collectionName, query);
    let code = 0;
    let resBody = {};
    if (!data || (data.result && !data.result.n)) {
      code = 404;
      resBody = {
        ...ErrorObj.ITEM_NOT_FOUND,
        deletedCount: data?.deletedCount || 0,
      };
    } else {
      code = 200;
      resBody = {
        code: 200,
        status: 'success',
        message: 'Items Deleted Successfully',
        deletedCount: data?.deletedCount || 0,
      };
    }
    res.status(code).json(resBody);
  } catch (error) {
    console.error('\n error :>> ', error);
    res.status(500).json({ message: 'Failed' });
  }
};

export const fetchUserDetails = async (req, res) => {
  try {
    const { db, projectId, body, headers } = req;
    const { userName, password } = body;
    const { authorization } = headers;
    if ((!userName || !password) && !authorization) {
      return res
        .status(400)
        .json({ code: 400, message: 'Username/Password or Authorization Token required.' });
    }
    const response = await fetchUserDetailsService(
      db,
      projectId,
      userName,
      password,
      authorization,
    );
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in fetchUserDetails', error);
    res.status(500).json({ message: 'Failed' });
  }
};
