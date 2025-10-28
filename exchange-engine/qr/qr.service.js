import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin, getS3Clients } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { findOneCollectionService } from '../collection/collection.service';
import { findItemById, updateCollectionItem } from '../item/item.service';
import QRCode from 'qrcode';
import { getFieldEncryptionDetails } from '../upload-api/upload.controller';
import { fileUploadToS3, processKey } from 'drapcode-utility';
import { saveFileOfs3 } from '../upload-api/fileUpload.service';
import { findProjectByQuery } from '../project/project.service';
import path from 'path';
import fs from 'fs';
import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

export const generateQRService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  headers,
  user,
  itemId,
  collection,
  dataField,
  saveQRField,
  codeType,
) => {
  try {
    const qrPlugin = await findInstalledPlugin(projectId, pluginCode.QR_GENERATOR);
    if (!qrPlugin) return pluginNotInstalledMessage('QR Generator');
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const itemResponse = await findItemById(db, projectId, collectionDetails, itemId);
    if (itemResponse.code !== 200) return itemResponse;
    const dataForCode = itemResponse.data[dataField];
    if (!dataForCode)
      return { code: 400, message: `No data found in ${dataField} for generating QR` };
    let buffer;
    if (codeType === 'qr') {
      buffer = await QRCode.toBuffer(dataForCode, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } else {
      const canvas = createCanvas(400, 150);
      JsBarcode(canvas, String(dataForCode), { format: 'CODE128' });
      buffer = canvas.toBuffer('image/png');
    }
    const { enableEncryption, encryptions, encryptionType } = await findProjectByQuery(projectId);
    let encryption = encryptions
      ? encryptions.find((enc) => enc.envType.toLowerCase() === process.env.APP_ENV.toLowerCase())
      : null;
    if (enableEncryption && encryption) {
      encryption = await processKey(encryption, encryptionType);
    }
    const field = await getFieldEncryptionDetails(projectId, collection, saveQRField);
    const { isPrivate, encrypted, isGenerateIcons = false } = field;
    const tmpFilePath = path.join('/tmp', `qr-${Date.now()}.png`);
    await fs.promises.writeFile(tmpFilePath, buffer);
    const qrFile = {
      path: tmpFilePath,
      originalname: 'qr.png',
      mimetype: 'image/png',
    };
    const key = `${projectId}/${collection}`;
    const { s3client, s3Config, publicS3Client, publicS3Config } = await getS3Clients(
      projectId,
      environment,
      isPrivate,
      key,
    );
    const fileUploadResponse = await fileUploadToS3(
      qrFile,
      s3client,
      s3Config,
      publicS3Client,
      publicS3Config,
      isGenerateIcons,
      encryption,
      {},
      encrypted,
    );
    const fileObject = await saveFileOfs3(
      db,
      fileUploadResponse,
      isPrivate,
      encrypted,
      saveQRField,
      enableAuditTrail,
      environment,
      user,
      headers,
    );
    const saveQR = await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionDetails,
      itemId,
      { [saveQRField]: fileObject },
      user,
      headers,
    );
    return saveQR;
  } catch (error) {
    console.error('Error in generateQRService:', error);
    return { code: 500, message: 'Internal server error', error: error?.message || error };
  }
};
