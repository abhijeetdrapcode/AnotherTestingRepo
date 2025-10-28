import {
  crypt,
  // drapcodeEncryptDecrypt,
  formatProjectDates,
  formatFieldsOfItem,
  processKey,
} from 'drapcode-utility';
import { FieldTypes } from 'drapcode-constant';
import { encRefFieldCollections, findOneCollectionService } from '../collection/collection.service';
import { findProjectByQuery, getProjectEncryption } from '../project/project.service';
const { file, reference } = FieldTypes;
let APP_ENV = process.env.APP_ENV;
export const cryptItemData = async (req, res, next) => {
  try {
    const {
      body,
      projectId,
      params: { collectionName },
      query: { notEncrypt },
      decrypt,
    } = req;
    if (notEncrypt) return next();

    const collection = await findOneCollectionService(projectId, collectionName);
    if (!collection) {
      return next();
    }
    let bodyData = null;

    if (body.$set) {
      bodyData = req.body.$set;
    } else if (body.items) {
      bodyData = req.body.items;
    } else {
      bodyData = req.body;
    }
    if (bodyData) {
      let encryptedResponse = await cryptService(
        bodyData,
        projectId,
        collection,
        false,
        true,
        decrypt,
      );
      if (encryptedResponse) {
        if (encryptedResponse.status === 'FAILED') {
          return res.status(200).json({
            code: 422,
            message: 'Failed to encrypt data. Please fix issue.',
            data: encryptedResponse,
          });
        } else {
          if (body.$set) {
            req.body.$set = encryptedResponse;
          } else if (body.items) {
            req.body.items = encryptedResponse;
          } else {
            req.body = encryptedResponse;
          }
        }
      }
    }
    next();
  } catch (error) {
    console.error('\n Error: ', error);
    next();
  }
};

export const projectDetailEncryption = async (req, res, next) => {
  try {
    const { projectId } = req;
    const enc = await getProjectEncryption(projectId);
    req.encSetting = enc;
    next();
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Encryption fails.' });
  }
};

export const cryptService = async (
  data,
  projectId,
  collection,
  isFetch = true,
  reverseFormat = false,
  decrypt,
) => {
  try {
    const { enableEncryption, encryptions, dateFormat, encryptionType } = await findProjectByQuery(
      projectId,
    );
    let { fields } = collection;
    if (!isFetch) {
      // Format date and number before save
      data = formatProjectDates(data, dateFormat, fields, reverseFormat);
      data = formatFieldsOfItem(data, fields);
    }
    if (enableEncryption && encryptions) {
      let encryption = encryptions.find(
        (enc) => enc.envType.toLowerCase() === APP_ENV.toLowerCase(),
      );
      if (encryption) {
        //TODO: Commenting this line for now
        //Because we already doing this when publish
        // if (encryption.isDataKeyEncrypted) {
        //   const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
        //   if (result.status === 'SUCCESS') {
        //     encryption.dataKey = result.data;
        //   } else {
        //     return result;
        //   }
        // }
        encryption = await processKey(encryption, encryptionType);
        fields = fields.filter((field) => {
          return !(
            field.type === file.id ||
            (field.type === reference.id && field.refCollection?.isFileType)
          );
        });
        const encryptedRefCollections = await encRefFieldCollections(projectId, fields);

        if (!isFetch || decrypt) {
          const cryptResponse = await crypt(
            data,
            fields,
            encryption,
            isFetch,
            encryptedRefCollections,
          );
          if (cryptResponse.status === 'FAILED') {
            console.error('Decrypting private data key failed', cryptResponse.message);
            return cryptResponse;
          }
          data = cryptResponse;
        }
      }
    }
    //Format date after get
    if (isFetch) data = formatProjectDates(data, dateFormat, fields, reverseFormat);
    return data;
  } catch (error) {
    console.error('\n Error: ', error);
  }
};
