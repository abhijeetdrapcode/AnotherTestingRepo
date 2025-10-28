import {
  checkCollectionByName,
  findCollection,
  findOneCollectionService,
} from '../../collection/collection.service';
import { findItemById, list, saveItem, updateItemById } from '../../item/item.service';
import { checkPermissionLevelSecurity } from '../../item/item.utils';
import { cryptService } from '../../middleware/encryption.middleware';
import { processFileFieldForURL } from '../../upload-api/fileUpload.service';
import { COLLECTION_NOT_EXIST_MSG } from '../../utils/appUtils';
import { bulkDeleteService, processItemsByFilter } from '../dev.service';

export const createItem = async (req, res, next) => {
  const { params, db, body, user, projectId, enableAuditTrail, environment, headers } = req;
  const { constructorId, collectionName } = params;
  try {
    const collection = await checkCollectionByName(projectId, collectionName);
    if (!collection) {
      return { code: 404, data: `Collection not found with provided name` };
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
    return res.status(response.code).send(response.data);
  } catch (err) {
    next(err);
  }
};

export const findAllItems = async (req, res) => {
  try {
    const { db, params, projectId, decrypt, headers, environment } = req;
    const ids = req.body.ids || req.query.ids;
    const { collectionName } = params;
    const collection = await checkCollectionByName(projectId, collectionName);
    if (!collection) {
      return { code: 404, data: `Collection not found with provided name` };
    }
    const reqQuery = req.query;
    const { authorization } = headers;
    // Check If the req has pagination
    const isPaginated = ['max', 'offset', 'limit', 'page'].some((key) => key in reqQuery);

    console.log('isPaginated :>> ', isPaginated);
    let result = await list(db, projectId, collection, ids, reqQuery, decrypt, isPaginated);

    console.log('result :>> ', result);
    const isResultEmpty =
      (Array.isArray(result) && result.length === 0) ||
      (Array.isArray(result?.result) && result.result.length === 0);
    console.log('isResultEmpty :>> ', isResultEmpty);
    if (isResultEmpty) {
      return res.status(200).send([]);
    }
    const resultData = isPaginated ? result?.result : result;
    console.log('resultData :>> ', resultData);
    const { permissionLevelSecurity = [], fields } = collection;
    let processedData = await processFileFieldForURL(resultData, projectId, environment, fields);
    if (permissionLevelSecurity && permissionLevelSecurity.length) {
      processedData = await checkPermissionLevelSecurity(
        db,
        projectId,
        authorization,
        permissionLevelSecurity,
        processedData,
      );
    }
    if (isPaginated) {
      result.result = processedData;
    } else result = processedData;
    console.log('result :>> ', result);
    return res.status(200).send(result);
  } catch (error) {
    console.log('\n Error in developer api findAllItems ', error);
    res.status(400).json({ message: 'Failed' });
  }
};

export const findItemDetail = async (req, res) => {
  try {
    const { params, db, projectId, decrypt, headers, environment } = req;
    const { collectionName, itemUuid } = params;
    const { authorization } = headers;
    const collection = await findOneCollectionService(projectId, collectionName);
    const result = await findItemById(db, projectId, collection, itemUuid, null);
    if (!result) {
      res.status(404).send({ message: `Record not found with id ${itemUuid}` });
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
          res.status(400).send({ message: encryptedResponse.message });
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
    return res.status(result.code).send(result.data);
  } catch (error) {
    console.error('error :>> ', error);
    res.status(400).json({ message: 'Failed' });
  }
};
export const updateItem = async (req, res) => {
  try {
    const { params, body, user, projectId, db, enableAuditTrail, environment, headers } = req;
    const { collectionName, itemUuid } = params;
    const collectionData = await findOneCollectionService(projectId, collectionName);
    if (!collectionData) {
      return res.status(404).send('Collection not found with provided name');
    }
    const response = await updateItemById(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionData,
      itemUuid,
      body,
      user,
      headers,
    );
    return res.status(response.code).send(response.data);
  } catch (error) {
    res.status(400).json({ message: 'Failed' });
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
      return res.status(404).send('No Collection found');
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
    let response = code != 200 ? { code, message } : result;
    console.log('Developer API filter, finally response sent');
    res.status(code).json(response);
  } catch (error) {
    console.error(error);
    res.status(400).json({ code: 400, message: 'Failed' });
  }
};
export const countItemsByFilter = async (req, res) => {
  const { params, headers, query, projectId, db, project, dateFormat } = req;
  const { collectionName, filterUuid } = params;
  const { authorization } = headers;
  try {
    let collection = await findCollection(projectId, collectionName, filterUuid);
    if (!collection) {
      return res.status(404).send('No Collection found');
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
    let response = code != 200 ? { code, message } : result;
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
    if (!isExist) return res.status(404).send(COLLECTION_NOT_EXIST_MSG);
    if (!ids || !ids.length)
      return res.status(404).send({ code: 404, message: 'Uuids not found in request body' });

    const query = { uuid: { $in: ids } };
    console.log('query :>> ', query);
    let data = await bulkDeleteService(db, collectionName, query);
    let code = 0;
    let resBody = {};
    if (!data || (data.result && !data.result.n)) {
      code = 404;
      resBody = {
        code: 404,
        message: 'Items not found with provided id',
        deletedCount: data?.deletedCount || 0,
      };
    } else {
      code = 200;
      resBody = { message: 'Items Deleted Successfully', deletedCount: data?.deletedCount || 0 };
    }
    console.log('resBody :>> ', resBody);
    res.status(code).json(resBody);
  } catch (error) {
    console.error('\n error :>> ', error);
    res.status(500).json({ message: 'Failed' });
  }
};
