import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { cryptFile, createS3Client } from 'drapcode-utility';
import { getProjectEncryption } from '../project/project.service';
import { findInstalledPlugin, loadS3PluginConfig } from '../install-plugin/installedPlugin.service';
import { pluginCode } from 'drapcode-constant';
import { saveCollectionItem } from '../item/item.service';
import { findOneCollectionService } from '../collection/collection.service';
require('./fileUpload.model');
const path = require('path');
const fs = require('fs');
export const saveFile = async (dbConnection, fileData) => {
  let FileUpload = dbConnection.model('FileUploads');
  const file = new FileUpload(fileData);
  return file.save();
};

export const saveFileOfs3 = async (
  dbConnection,
  fileData,
  isPrivate,
  isEncrypted,
  fieldId,
  enableAuditTrail,
  environment,
  currentUser,
  headers,
) => {
  const { originalname, mimetype, contentType, size, key, smallIcon, mediumIcon, largeIcon } =
    fileData;
  const keyList = key.split('/');
  const fileJson = {
    uuid: keyList[2],
    originalName: originalname,
    contentType: contentType,
    mimeType: mimetype,
    size: size,
    collectionName: keyList[1],
    collectionField: fieldId,
    projectId: keyList[0],
    key: key,
    isEncrypted: isEncrypted,
    isPrivate: isPrivate,
    smallIcon: smallIcon,
    mediumIcon: mediumIcon,
    largeIcon: largeIcon,
  };
  if (isPrivate) {
    await handleUploadFileActivityTracker(
      dbConnection,
      keyList[0],
      originalname,
      keyList[1],
      fieldId,
      headers,
      currentUser,
      enableAuditTrail,
      environment,
    );
  }
  return await saveFile(dbConnection, fileJson);
};

export const saveMultiFileOfs3 = async (
  dbConnection,
  files,
  isPrivate,
  isEncrypted,
  fieldId,
  enableAuditTrail,
  environment,
  currentUser,
  headers,
) => {
  let filesResponse = files.map(async (file) => {
    return await saveFileOfs3(
      dbConnection,
      file,
      isPrivate,
      isEncrypted,
      fieldId,
      enableAuditTrail,
      environment,
      currentUser,
      headers,
    );
  });
  return await Promise.all(filesResponse);
};

export const listService = async (dbConnection, query, perPage, page) => {
  let FileUpload = dbConnection.model('FileUploads');
  return await FileUpload.find(query)
    .limit(perPage)
    .skip(perPage * page)
    .exec();
};

export const findOneFileService = async (dbConnection, query) => {
  let FileUpload = dbConnection.model('FileUploads');
  return FileUpload.findOne(query);
};

export const downloadFileFromUrl = async (url) => {
  let fileName = path.basename(url);
  let localFilePath = process.env.FILE_UPLOAD_PATH || '/tmp/drapcode-uploads/';
  localFilePath += fileName;
  if (fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }
  const writer = fs.createWriteStream(localFilePath);
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
    });

    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve(localFilePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('error', error);
  }
};

export const privateUrl = async (key, isEncrypted, encryption, s3Client, bucket, isSignedUrl) => {
  try {
    //TODO: Use common method from project service
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    if (isSignedUrl) {
      return signedUrl;
    }
    const response = await axios.get(signedUrl, { responseType: 'arraybuffer' });
    if (!isEncrypted) {
      return response.data;
    }
    const keyParts = key.split('/');
    const encryptedFilePath = `${process.env.FILE_UPLOAD_PATH}${keyParts[keyParts.length - 1]}.enc`;
    await fs.promises.writeFile(encryptedFilePath, response.data);
    const result = await cryptFile(encryptedFilePath, encryption, true);
    fs.unlinkSync(encryptedFilePath);
    const data = await fs.promises.readFile(result);
    if (data) {
      fs.unlinkSync(result);
    }
    return data;
  } catch (error) {
    console.error('Error fetching file:', error);
    throw error;
  }
};

export const processFileFieldForURL = async (response, projectId, environment, fields) => {
  try {
    const fileFields = fields.filter((field) => field.type === 'file');
    if (!fileFields.length) return response;

    const isObject = !Array.isArray(response);
    if (isObject) response = [response];

    const { encryption } = await getProjectEncryption(projectId);
    const { region, accessKeyId, secretAccessKey, bucket } = await loadS3PluginConfig(
      projectId,
      environment,
    );
    const awsConfig = { region, accessKey: accessKeyId, accessSecret: secretAccessKey };
    const s3Client = createS3Client(awsConfig);

    const processedResponse = await Promise.all(
      response.map(async (item) => {
        try {
          const hasProcessableFileField = fileFields.some(
            (field) => item[field.fieldName] && !field.encrypted,
          );
          if (!hasProcessableFileField) return item;

          for (const field of fileFields) {
            const { fieldName, encrypted, isGenerateURL } = field;
            const fieldValue = item[fieldName];
            if (fieldValue && !encrypted) {
              item[fieldName] = await addUrlInFileObject(
                projectId,
                environment,
                encryption,
                fieldValue,
                isGenerateURL,
                s3Client,
                bucket,
                region,
              );
            }
          }
          return item;
        } catch (error) {
          console.error('Error processing file field for item:', error);
          return item; // Return the original item if an error occurs
        }
      }),
    );
    return isObject ? processedResponse[0] : processedResponse;
  } catch (error) {
    console.error('Error in processFileFieldForURL:', error);
    return response; // Return the original response in case of error
  }
};

const addUrlInFileObject = async (
  projectId,
  environment,
  encryption,
  fileData,
  isGenerateURL,
  s3Client,
  bucket,
  region,
) => {
  try {
    if (!fileData) return fileData;

    if (!Array.isArray(fileData)) fileData = [fileData];

    return await Promise.all(
      fileData.map(async (file) => {
        try {
          let url = null;
          if (file.isPrivate && isGenerateURL) {
            url = await privateUrl(file.key, file.isEncrypted, encryption, s3Client, bucket, true);
          } else if (!file.isPrivate) {
            url = `https://${bucket}${
              region === 'us-east-1' ? '' : `.${region}`
            }.s3.amazonaws.com/${file.key}`;
          }
          return url ? { ...file, url } : file;
        } catch (error) {
          console.error('Error generating file URL:', error);
          return file; // Return the original file object if an error occurs
        }
      }),
    );
  } catch (error) {
    console.error('Error in addUrlInFileObject:', error);
    return fileData; // Return the original fileData in case of error
  }
};

export const handleUploadFileActivityTracker = async (
  dbConnection,
  projectId,
  fileName,
  collName,
  collField,
  headers,
  currentUser,
  enableAuditTrail,
  environment,
) => {
  const fileActivityTrackerPlugin = await findInstalledPlugin(
    projectId,
    pluginCode.FILE_ACTIVITY_TRACKER,
  );
  if (fileActivityTrackerPlugin) {
    const trackerCollection = await findOneCollectionService(projectId, 'file_activity_tracker');
    if (trackerCollection) {
      const itemData = {
        fileName,
        activity: 'Upload',
        collName,
        collField,
        ipAddress: headers?.['x-user-ip'] || '',
        userId: currentUser?.userName || '',
      };
      const trackingResult = await saveCollectionItem(
        dbConnection,
        projectId,
        enableAuditTrail,
        trackerCollection,
        itemData,
        currentUser,
        headers,
        environment,
      );
      if (trackingResult.code !== 201) {
        console.error('Error saving file activity tracker:', trackingResult.message);
      }
    }
  }
};
