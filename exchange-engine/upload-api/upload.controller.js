import multer from 'multer';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  createS3Client,
  // drapcodeEncryptDecrypt,
  fileUploadToS3,
  processAndRemoveExifDataFromImg,
  processAndRemoveScriptFromSVG,
  processKey,
} from 'drapcode-utility';
import { calculatePageLimit } from 'drapcode-utility';
import { createWriteStream, unlinkSync, existsSync } from 'fs';
import {
  listService,
  privateUrl,
  saveFile,
  saveFileOfs3,
  saveMultiFileOfs3,
} from './fileUpload.service';
import {
  findFieldDetailsFromCollection,
  findOneCollectionService,
} from '../collection/collection.service';
import { findProjectByQuery, getProjectEncryption } from '../project/project.service';
import { getS3Clients, loadS3PluginConfig } from '../install-plugin/installedPlugin.service';
import { findOneItemByQuery } from '../item/item.service';
const path = require('path');
let APP_ENV = process.env.APP_ENV;
const fileFilter = function (req, file, cb) {
  findFieldDetailsFromCollection(req.projectId, req.params.collectionId, req.params.fieldId).then(
    (validation) => {
      const allowedFileTypes = validation['allowedFileTypes'];
      const allowedFileRegex = allowedFileTypes.join('|');
      // Allowed ext
      // const filetypes = /jpeg|jpg|png|gif/;
      let regex = new RegExp(allowedFileRegex);
      // Check ext
      const extname = regex.test(path.extname(file.originalname).toLowerCase());
      // const mimetype = regex1.test(file.mimetype);
      if (extname) {
        return cb(null, true);
      } else {
        return cb(new Error(`Only ${allowedFileTypes.join(', ')} files are allowed!`), false);
      }

      // cb(null, true);
    },
  );
};

/**
 * Type 1: Start
 */
const storageStatic = multer.diskStorage({
  destination: function (req, file, cb) {
    const localFilePath = process.env.FILE_UPLOAD_PATH
      ? process.env.FILE_UPLOAD_PATH
      : '/tmp/drapcode-uploads/';
    return cb(null, localFilePath);
  },
  filename: function (req, file, cb) {
    return cb(null, `${file.originalname}`);
  },
});
const uploadStatic = multer({ storage: storageStatic, fileFilter: fileFilter });
let fileStaticUploadToS3 = uploadStatic.single('file');
let fileStaticMultiUploadToS3 = uploadStatic.array('files');
const uploadStaticWthFilter = multer({ storage: storageStatic });
let fileStaticUploadToS3WthFilter = uploadStaticWthFilter.single('file');
/**
 * Type 2: End
 */

export const fileUploadToServer = async (req, res, next) => {
  try {
    const { projectId, params, environment, user, enableAuditTrail, headers } = req;
    const { collectionId, fieldId } = params;
    const { enableEncryption, encryptions, encryptionType } = await findProjectByQuery(projectId);
    let encryption = encryptions
      ? encryptions.find((enc) => enc.envType.toLowerCase() === APP_ENV.toLowerCase())
      : null;
    console.log('encryptionType :>> ', encryptionType);
    console.log('enableEncryption :>> ', enableEncryption);
    console.log('encryption :>> ', encryption);
    if (enableEncryption && encryption) {
      //TODO: Commenting this line for now
      //Because we already doing this when publish
      // if(encryption.isDataKeyEncrypted) {
      // const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
      // if (result.status === 'SUCCESS') {
      //   encryption.dataKey = result.data;
      // } else {
      //   return result;
      // }
      // }
      encryption = await processKey(encryption, encryptionType);
    }
    console.log('encryption :>> ', encryption);

    const field = await getFieldEncryptionDetails(projectId, collectionId, fieldId);
    console.log('field :>> ', field);
    const { isPrivate, encrypted, isGenerateIcons = false } = field;
    fileStaticUploadToS3(req, res, async (err) => {
      if (!req.file || err) {
        return res.status(500).json({ message: err.message || 'Unexpected error during upload' });
      }
      const { file } = req;
      const key = `${projectId}/${collectionId}`;
      await processAndRemoveExifDataFromImg(file);
      await processAndRemoveScriptFromSVG(file);

      console.error('4');
      const { s3client, s3Config, publicS3Client, publicS3Config } = await getS3Clients(
        projectId,
        environment,
        isPrivate,
        key,
      );

      fileUploadToS3(
        file,
        s3client,
        s3Config,
        publicS3Client,
        publicS3Config,
        isGenerateIcons,
        encryption,
        {},
        encrypted,
      ).then((uresponse) => {
        saveFileOfs3(
          req.db,
          uresponse,
          isPrivate,
          encrypted,
          fieldId,
          enableAuditTrail,
          environment,
          user,
          headers,
        ).then((response) => {
          return res.status(200).send(response);
        });
      });
    });
  } catch (error) {
    console.error('>>>>>>>>>>>>>:: error in single file upload', error);
    next(error);
  }
};
export const multiFileUploadToServer = async (req, res, next) => {
  try {
    const { projectId, params, environment, enableAuditTrail, user, headers } = req;
    const { collectionId, fieldId } = params;
    const { enableEncryption, encryptions, encryptionType } = await findProjectByQuery(projectId);
    const field = await getFieldEncryptionDetails(projectId, collectionId, fieldId);
    let encryption = encryptions
      ? encryptions.find((enc) => enc.envType.toLowerCase() === APP_ENV.toLowerCase())
      : null;
    if (enableEncryption && encryption) {
      //TODO: Commenting this line for now
      //Because we already doing this when publish
      // if (encryption.isDataKeyEncrypted) {
      // const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
      // if (result.status === 'SUCCESS') {
      //   encryption.dataKey = result.data;
      // } else {
      //   return result;
      // }
      // }
      encryption = await processKey(encryption, encryptionType);
    }

    const { isPrivate, encrypted, isGenerateIcons = false } = field;
    fileStaticMultiUploadToS3(req, res, async (err) => {
      if (!req.files || err) {
        return res.status(500).json({ message: err.message || 'Unexpected error during upload' });
      }
      const { files } = req;
      const key = `${projectId}/${collectionId}`;
      await processAndRemoveExifDataFromImg(files);
      await processAndRemoveScriptFromSVG(files);

      const { s3client, s3Config, publicS3Client, publicS3Config } = await getS3Clients(
        projectId,
        environment,
        isPrivate,
        key,
      );

      fileUploadToS3(
        files,
        s3client,
        s3Config,
        publicS3Client,
        publicS3Config,
        isGenerateIcons,
        encryption,
        {},
        encrypted,
      ).then((uresponse) => {
        saveMultiFileOfs3(
          req.db,
          uresponse,
          isPrivate,
          encrypted,
          fieldId,
          enableAuditTrail,
          environment,
          user,
          headers,
        ).then((response) => {
          return res.status(200).send(response);
        });
      });
    });
  } catch (error) {
    console.error('>>>>>>>>>>>>>:: error in multiple file upload', error);
    next(error);
  }
};

export const getFieldEncryptionDetails = async (projectId, collectionId, fieldId) => {
  const collection = await findOneCollectionService(projectId, collectionId);

  const field = collection.fields.find((f) => f.fieldName === fieldId);
  if (!field) throw new Error('Wrong field selected.');

  if (field.type === 'reference' && field.refCollection?.isFileType) {
    const refCollection = await findOneCollectionService(
      projectId,
      field.refCollection.collectionName,
    );
    const refField = refCollection.fields.find(
      (f) => f.fieldName === field.refCollection.collectionField,
    );
    Object.assign(field, {
      isPrivate: refField?.isPrivate || false,
      encrypted: refField?.encrypted || false,
      isGenerateIcons: refField?.isGenerateIcons || false,
    });
  }

  return field;
};

export const fetchFile = async (req, res, next) => {
  try {
    const { db, projectId, body, environment } = req;
    const { itemId, fileId, collectionName, collectionField, isSignedUrl } = body;
    if (itemId) {
      const fieldData = await findOneItemByQuery(db, collectionName, {
        uuid: itemId,
      });
      if (fieldData) {
        let fileData = fieldData[collectionField];
        if (fileData) {
          if (Array.isArray(fileData)) {
            fileData = fileData.find((file) => file.uuid === fileId);
          }
          const { encryption } = await getProjectEncryption(projectId);
          const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
            projectId,
            environment,
          );
          const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
          const s3Client = createS3Client(awsConfig);
          const { isEncrypted, key } = fileData;
          const result = await privateUrl(
            key,
            isEncrypted,
            encryption,
            s3Client,
            bucket,
            isSignedUrl,
          );
          return res.status(200).send(result);
        } else {
          return res
            .status(404)
            .send({ message: 'File data not found for the given collection field.' });
        }
      } else {
        return res.status(404).send({ message: 'Field data not found.' });
      }
    } else {
      return res.status(400).send({ message: 'Item ID is required.' });
    }
  } catch (err) {
    console.error('error in fetch file', err);
    return next(err);
  }
};

// mongodb
export const createFile = async (req, res) => {
  try {
    const result = await saveFile(req.db, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      message: err.message,
    });
  }
};

export const findAllFile = async (req, res) => {
  const limitPage = calculatePageLimit(req.query.limit, req.query.page);
  try {
    const result = await listService(req.db, {}, limitPage.limit, limitPage.page);
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send({
      message: err.message || 'Some error occurred while retrieving events.',
    });
  }
};

export const fileUploadToServerWithoutCollectionId = async (req, res) => {
  const { projectId, environment } = req;
  fileStaticUploadToS3WthFilter(req, res, async (err) => {
    if (!req.files || err) {
      return res.status(500).json({ message: err.message || 'Unexpected error during upload' });
    }

    const { file } = req;
    const key = `${projectId}`;
    await processAndRemoveExifDataFromImg(file);
    await processAndRemoveScriptFromSVG(file);

    const { s3client, s3Config, publicS3Client, publicS3Config } = await getS3Clients(
      projectId,
      environment,
      false,
      key,
    );
    fileUploadToS3(
      file,
      s3client,
      s3Config,
      publicS3Client,
      publicS3Config,
      false,
      null,
      {},
      false,
    ).then((uresponse) => {
      saveFileOfs3(req.db, uresponse).then((response) => {
        return res.status(200).send(response);
      });
    });
  });
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const localFilePath = process.env.FILE_UPLOAD_PATH
      ? process.env.FILE_UPLOAD_PATH
      : '/tmp/drapcode-uploads/';
    cb(null, localFilePath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });
let fileCreateToServerFileSystem = upload.single('file');
// file upload wala code

export const fileUploadToServerFileSystem = (req, res) => {
  fileCreateToServerFileSystem(req, res, async (err) => {
    if (!req.file) {
      return res.status(500).send(err ? err.message : 'File not found!');
    } else if (err instanceof multer.MulterError) {
      return res.status(500).send(err.message);
    } else if (err) {
      return res.status(500).send(err.message);
    }
    await processAndRemoveExifDataFromImg(req.file);
    await processAndRemoveScriptFromSVG(req.file);
    return res.status(200).send(req.file);
  });
};

export const downloadFileContent = async (projectId, environment, fileName, key) => {
  try {
    const localFilePath = process.env.FILE_UPLOAD_PATH || '/tmp/drapcode-uploads/';
    const filePath = `${localFilePath}${fileName}`;

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
      projectId,
      environment,
    );
    const params = { Bucket: bucket, Key: key };
    const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
    const s3client = createS3Client(awsConfig);
    const response = s3client.send(new GetObjectCommand(params));

    const readStream = response.Body;
    const writeStream = createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      readStream.on('error', (e) => {
        console.error(e);
        reject(null);
      });
      writeStream.once('finish', () => {
        resolve(filePath);
      });
      readStream.pipe(writeStream);
    });

    return filePath;
  } catch (error) {
    console.error('error in downloadFileContent', error);
    return null;
  }
};
