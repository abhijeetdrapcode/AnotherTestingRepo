import { v4 as uuidv4 } from 'uuid';
import { findItemById, list, filterItemService } from './item.service';
import {
  createItemFromBuilder,
  findItemForBuilder,
  listForBuilder,
  removeItemBuilder,
  updateItemForBuilder,
  executeQueryBuilder,
  saveItemsImportedFromCSVForBuilderService,
  findItemForBuilderByRegex,
  executeLastRecordBuilder,
} from './item.builder.service';
import {
  checkCollectionByName,
  findCollection,
  findOneCollectionService,
} from '../collection/collection.service';
import { checkPermissionLevelSecurity, createCSVFile } from './item.utils';
import { cryptService } from '../middleware/encryption.middleware';
import { createProfilerService, updateProfilerService } from '../profiling/profiler.service';
import { API, COMPUTING } from '../utils/enums/ProfilerType';
const fs = require('fs');

export const findAllForBuilder = async (req, res, next) => {
  try {
    const { db, params, query, body } = req;
    const { collectionName } = params;
    const { page, size } = query;
    let result = await listForBuilder(db, collectionName, body, page, size);
    if (!result) {
      res.status(200).send([]);
      return;
    }
    res.status(200).send(result);
  } catch (error) {
    console.error(`error`, error);
    next(error);
  }
};

export const findAllByRegexForBuilder = async (req, res, next) => {
  try {
    const { db, params, body } = req;
    const { collectionName } = params;
    const result = await findItemForBuilderByRegex(db, collectionName, body);
    if (!result) {
      res.status(200).send([]);
      return;
    }
    res.status(200).send(result);
  } catch (error) {
    console.error(`error`, error);
    next(error);
  }
};
export const addItemFromBuilder = async (req, res, next) => {
  try {
    const { db, params, body, enableAuditTrail } = req;
    const { collectionName } = params;
    const result = await createItemFromBuilder(db, enableAuditTrail, collectionName, body);
    res.status(200).send(result);
  } catch (error) {
    console.error(`error`, error);
    next(error);
  }
};
export const findOneItemForBuilder = async (req, res, next) => {
  try {
    const { db, params } = req;
    const { collectionName, itemId } = params;
    const result = await findItemForBuilder(db, collectionName, itemId);
    if (!result) {
      res.status(404).send({ message: `Record not found with id ${itemId}` });
      return;
    }
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const findUpdateItemForBuilder = async (req, res, next) => {
  try {
    const { db, params, body, enableAuditTrail, projectId } = req;
    const { collectionName, itemId } = params;
    const result = await updateItemForBuilder(
      db,
      projectId,
      enableAuditTrail,
      collectionName,
      itemId,
      body,
    );
    if (!result) {
      res.status(404).send({ message: `Record not found with id ${itemId}` });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error(`error`, error);
    next(error);
  }
};
export const executeQueryFromBuilder = async (req, res, next) => {
  try {
    const { projectId, db, body, params, query, decrypt } = req;
    const { collectionName } = params;
    const { decryptFields } = query;
    const result = await executeQueryBuilder(db, collectionName, body);
    if (decryptFields && result[0]) {
      const collection = await findOneCollectionService(projectId, collectionName);
      let encryptedResponse;
      if (result[0]) {
        encryptedResponse = await cryptService(
          result[0],
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
          result[0] = encryptedResponse;
        }
      }
    }
    res.json(result);
  } catch (error) {
    console.warn('\n ====error ', error);
    next(error);
  }
};
export const fetchLastRecord = async (req, res, next) => {
  try {
    const { db, params } = req;
    const { collectionName } = params;
    const result = await executeLastRecordBuilder(db, collectionName);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
export const removeItemFromBuilder = async (req, res, next) => {
  try {
    const { db, params, enableAuditTrail } = req;
    const { collectionName, itemId } = params;
    const result = await removeItemBuilder(db, enableAuditTrail, collectionName, itemId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
export const removeAllItemFromBuilder = async (req, res, next) => {
  try {
    const { db, params } = req;
    const { collectionName } = params;
    await db.dropCollection(collectionName);
    res.json({ msg: 'Collection has been cleared' });
  } catch (error) {
    next(error);
  }
};

export const saveItemsImportedFromCSVForBuilder = async (req, res, next) => {
  try {
    const { db, body, params, enableAuditTrail } = req;
    const { collectionName } = params;
    const result = await saveItemsImportedFromCSVForBuilderService(
      db,
      enableAuditTrail,
      collectionName,
      body,
    );
    return res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};
export const findAll = async (req, res, next) => {
  try {
    const { db, params, projectId } = req;
    const collection = await checkCollectionByName(projectId, params.collectionName);
    if (!collection) {
      return { code: 404, data: `Collection not found with provided name` };
    }
    let result = await list(db, projectId, params.collectionName);
    if (!result) {
      return res.status(200).send([]);
    }
    return res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const findOne = async (req, res, next) => {
  try {
    const result = await findOneItemService(req);
    res.status(result.code).send(result.data);
  } catch (error) {
    console.error('findOne Error', error);
    next(error);
  }
};

export const collectionTableFilterItems = async (req, res, next) => {
  const apiEnterUuid = uuidv4();
  try {
    const { db, params, headers, query, projectId, project, dateFormat, enableProfiling, decrypt } =
      req;
    const { collectionName, finderId } = params;
    createProfilerService(
      db,
      projectId,
      enableProfiling,
      apiEnterUuid,
      API,
      `ITEM -> Collection Items`,
      {
        collectionName,
      },
    );
    const { authorization } = headers;
    let collection = await findCollection(projectId, collectionName, finderId);
    if (!collection) {
      return { code: 200, message: 'success', result: 0, count: 0 };
    }

    const { permissionLevelSecurity = [] } = collection;
    let { code, result, message } = await filterItemService(
      db,
      projectId,
      collection,
      finderId,
      query,
      authorization,
      project.timezone,
      headers,
      0,
      1,
      false,
      dateFormat,
    );
    const cryptEnterUuid = uuidv4();
    createProfilerService(
      db,
      projectId,
      enableProfiling,
      cryptEnterUuid,
      COMPUTING,
      `ITEM -> Collection Items Crypt Service`,
      { collectionName },
    );
    let encryptedResponse;
    if (result) {
      encryptedResponse = await cryptService(result, projectId, collection, true, false, decrypt);
    }
    if (encryptedResponse) {
      if (encryptedResponse.status === 'FAILED') {
        return { code: 400, message: encryptedResponse.message, result: 0, count: 0 };
      } else {
        result = encryptedResponse;
      }
    }
    if (permissionLevelSecurity && permissionLevelSecurity.length) {
      result = await checkPermissionLevelSecurity(
        db,
        projectId,
        authorization,
        permissionLevelSecurity,
        result,
      );
    }
    updateProfilerService(db, projectId, enableProfiling, cryptEnterUuid);
    let resp = code != 200 ? message : result;
    updateProfilerService(db, projectId, enableProfiling, apiEnterUuid);
    return res.status(code || 500).send(resp || []);
  } catch (err) {
    next(err);
  }
};

export const exportFilterItems = async (req, res, next) => {
  try {
    const { db, params, headers, query, projectId, project, dateFormat, decrypt } = req;
    const { collectionName, finderId } = params;
    const { authorization } = headers;
    let collection = await findCollection(projectId, collectionName, finderId);
    if (!collection) {
      return { code: 200, message: 'success', result: 0, count: 0 };
    }

    let { code, result, message } = await filterItemService(
      db,
      projectId,
      collection,
      finderId,
      query,
      authorization,
      project.timezone,
      headers,
      0,
      1,
      false,
      dateFormat,
    );
    if (code !== 200) {
      return res.status(code).send(message);
    }
    let encryptedResponse;
    if (result) {
      encryptedResponse = await cryptService(result, projectId, collection, true, false, decrypt);
    }
    if (encryptedResponse) {
      if (encryptedResponse.status === 'FAILED') {
        return { code: 400, message: encryptedResponse.message, result: 0, count: 0 };
      } else {
        result = encryptedResponse;
      }
    }

    let fileName = uuidv4();
    let localFilePath = process.env.FILE_UPLOAD_PATH || '/tmp/drapcode-uploads/';
    localFilePath += `${collectionName}_${fileName}.csv`;
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    await createCSVFile(collection, localFilePath, result);
    return res.status(200).json({ msg: localFilePath });
  } catch (err) {
    console.error('err', err);
    next(err);
  }
};

export const findOneItemService = async (req) => {
  const { db, params, projectId, headers } = req;
  const { collectionName, itemId } = params;
  const { authorization } = headers;
  const collection = await findOneCollectionService(projectId, collectionName);
  const result = await findItemById(db, projectId, collection, itemId, null);
  if (!result) return { code: 404, data: { message: `Record not found with id ${params.itemId}` } };

  const { permissionLevelSecurity = [] } = collection;
  let encryptedResponse;
  if (result.data) {
    encryptedResponse = await cryptService(result.data, projectId, collection, true, false, true);
  }
  if (encryptedResponse) {
    if (encryptedResponse.status === 'FAILED') {
      return { code: 400, data: { message: encryptedResponse.message } };
    } else {
      result.data = encryptedResponse;
    }
  }
  if (permissionLevelSecurity && permissionLevelSecurity.length) {
    result.data = await checkPermissionLevelSecurity(
      db,
      projectId,
      authorization,
      permissionLevelSecurity,
      result.data,
    );
  }
  return result;
};
