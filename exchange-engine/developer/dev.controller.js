import fs from 'fs';
import { checkCollectionByName, findOneCollectionService } from '../collection/collection.service';
import {
  modifiedList,
  removeItemById,
  saveBulkDataFromDeveloperAPI,
  updateItemById,
} from '../item/item.service';
import {
  verifyEmailOtpAndLoginService,
  verifySmsOtpAndLoginService,
} from '../loginPlugin/user.service';
import { COLLECTION_NOT_EXIST_MSG } from '../utils/appUtils';
import {
  dynamicEmailService,
  getFileBufferService,
  sendEmailService,
  shouldIncludeUser,
  updateFileObjectById,
} from './dev.service';
import { processSingleDocument } from '../collection-form/anyfile-to-text/document-processor';
import { processFileFieldForURL } from '../upload-api/fileUpload.service';
import { checkPermissionLevelSecurity } from '../item/item.utils';
import { cryptService } from '../middleware/encryption.middleware';
const multer = require('multer');

const localFilePath = process.env.FILE_UPLOAD_PATH
  ? process.env.FILE_UPLOAD_PATH
  : '/tmp/drapcode-uploads/';
const upload = multer({ dest: localFilePath });
const fileUploadHandler = upload.single('file');
const fileUploadHandlerMulti = upload.array('files');

export const deleteItem = async (req, res) => {
  try {
    const { db, params, projectId, enableAuditTrail, environment, user, headers } = req;
    let { itemUuid, collectionName } = params;
    let isExist = await checkCollectionByName(projectId, collectionName);
    if (!isExist) return res.status(404).send(COLLECTION_NOT_EXIST_MSG);
    let data = await removeItemById(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      itemUuid,
      user,
      headers,
    );
    res.status(data.code || 500).send(data);
  } catch (error) {
    res.status(400).json({ message: 'Failed' });
  }
};

export const verifyEmailOtpAndLoginDev = async (req, res, next) => {
  try {
    const { body, db, projectId, headers, environment, enableAuditTrail, type } = req;
    const { otp, emailOtpToken, otpAuthenticationType } = body;
    let includeUserObj = await shouldIncludeUser(projectId, otpAuthenticationType, type);
    const result = await verifyEmailOtpAndLoginService({
      db,
      projectId,
      enableAuditTrail,
      otp,
      emailOtpToken,
      headers,
      environment,
      includeUserObj,
    });
    return res.status(result.code).send(result);
  } catch (error) {
    console.error('Error during OTP verification and login:', error);
    next(error);
  }
};
export const verifySmsOtpAndLoginDev = async (req, res, next) => {
  try {
    const { body, db, projectId, headers, environment, enableAuditTrail, type } = req;
    const { otp, smsOtpToken, otpAuthenticationType } = body;
    let includeUserObj = await shouldIncludeUser(projectId, otpAuthenticationType, type);
    const result = await verifySmsOtpAndLoginService({
      db,
      projectId,
      enableAuditTrail,
      otp,
      smsOtpToken,
      headers,
      environment,
      includeUserObj,
    });
    return res.status(result.code).send(result);
  } catch (error) {
    console.error('Error during OTP verification and login:', error);
    next(error);
  }
};

export const sendEmail = async (req, res) => {
  try {
    const response = await sendEmailService(req);
    res.status(200).send(response);
  } catch (error) {
    console.error('\n error :>> ', error);
    const message = error.message ? error.message : 'Failed';
    res.status(400).json({ message });
  }
};
export const anyFileToTextSingle = async (req, res, next) => {
  try {
    fileUploadHandler(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer Error:', err);
        return res.status(400).json({ code: 400, message: 'File upload failed' });
      }
      if (!req.file) {
        return res.status(422).json({ code: 422, message: 'File is required' });
      }

      const file = req.file;
      const extractedText = await processSingleDocument(file);
      fs.unlink(req.file.path, () => {});
      res.status(200).json({ extractedText });
    });
  } catch (error) {
    console.error('>>>>>>>>>>>>>:: error in single file upload', error);
    next(error);
  }
};

export const anyFileToTextMulti = async (req, res, next) => {
  try {
    fileUploadHandlerMulti(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer Error:', err);
        return res.status(400).json({ code: 400, message: 'File upload failed' });
      }
      if (!req.files) {
        return res.status(422).json({ code: 422, message: 'File is required' });
      }

      const files = req.files;
      const maxConcurrentProcessing = 3;
      const extractedText = [];
      for (let i = 0; i < files.length; i += maxConcurrentProcessing) {
        const batch = files.slice(i, i + maxConcurrentProcessing);
        const batchResults = await Promise.all(
          batch.map(async (file) => {
            const fileName = file.originalname;
            const fileText = await processSingleDocument(file);
            return `${fileName}:\n${fileText}`;
          }),
        );
        extractedText.push(...batchResults);
      }
      files.forEach((file) => {
        fs.unlink(file.path, () => {});
      });
      res.status(200).json({ extractedText });
    });
  } catch (error) {
    console.error('>>>>>>>>>>>>>:: error in single file upload', error);
    next(error);
  }
};
export const getFileBuffer = async (req, res, next) => {
  try {
    const { params, db, environment, projectId, query } = req;
    const { collectionName, fileObjectUuid } = params || {};
    const { itemUuid = '', fieldName = '' } = query || {};
    const missingFields = [];
    if (!collectionName) missingFields.push('Collection Name');
    if (!fileObjectUuid) missingFields.push('File Object Uuid');
    if (!itemUuid) missingFields.push('Item Uuid');
    if (!fieldName) missingFields.push('Field Name');
    if (missingFields.length > 0) {
      return res.status(400).json({
        code: 400,
        message: `Missing required parameter(s): ${missingFields.join(', ')}`,
      });
    }
    const response = await getFileBufferService(
      db,
      projectId,
      environment,
      collectionName,
      itemUuid,
      fileObjectUuid,
      fieldName,
    );
    return res.status(response.code).json(response);
  } catch (error) {
    console.error('Error in getFileBuffer:', error);
    return next(error);
  }
};

export const updateFileObject = async (req, res) => {
  try {
    const { params, body, db, user, enableAuditTrail, query } = req;
    const { collectionName, fileObjectUuid } = params || {};
    const { itemUuid = '', fieldName = '' } = query || {};
    if (!collectionName || !fileObjectUuid) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }
    const response = await updateFileObjectById(
      body,
      db,
      enableAuditTrail,
      user,
      collectionName,
      itemUuid,
      fileObjectUuid,
      fieldName,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error Updating File Object :>>', error);
    return res.status(400).json({ message: error.message ? error.message : 'Failed' });
  }
};
export const sendDynamicEmail = async (req, res) => {
  try {
    const response = await dynamicEmailService(req);
    res.status(200).send(response);
  } catch (error) {
    console.error('\n error :>> ', error);
    const message = error.message ? error.message : 'Failed';
    res.status(400).json({ message });
  }
};
export const findAllUpdatedItems = async (req, res) => {
  try {
    const { db, params, projectId, decrypt, headers, environment } = req;
    const ids = req.body.ids || req.query.ids;
    const { collectionName } = params;
    const { authorization } = headers;
    let result = await modifiedList(db, projectId, collectionName, ids, req.query);
    if (!result) {
      res.status(200).send([]);
      return;
    }
    const collection = await findOneCollectionService(projectId, collectionName);
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
    }
    return res.status(200).send(result);
  } catch (error) {
    console.error('error', error);
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
    return res.status(response.code).send(response);
  } catch (error) {
    res.status(400).json({ message: 'Failed' });
  }
};
export const createBulkItem = async (req, res, next) => {
  const { params, db, body, projectId, environment, enableAuditTrail } = req;
  const { collectionName } = params;
  const { items, primaryKey } = body;
  try {
    const results = await saveBulkDataFromDeveloperAPI(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionName,
      items,
      primaryKey,
      false,
    );
    return res.status(200).send(results);
  } catch (err) {
    next(err);
  }
};
