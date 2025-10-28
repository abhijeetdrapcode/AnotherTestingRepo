import axios from 'axios';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { pluginCode } from 'drapcode-constant';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { findOneCollectionService } from '../collection/collection.service';
import { findItemById, updateCollectionItem } from '../item/item.service';
import { preparePayloadForCibilRequest } from './cibil.util';
import { cryptService } from '../middleware/encryption.middleware';

export const getConsumerReportService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  headers,
  user,
  collection,
  firstNameField,
  middleNameField,
  lastNameField,
  birthDateField,
  genderField,
  panNumberField,
  telephoneNumberField,
  lineOneField,
  lineTwoField,
  stateField,
  pinCodeField,
  itemId,
  saveResponseField,
  dateFormat,
) => {
  try {
    const cibilPlugin = await findInstalledPlugin(projectId, pluginCode.CIBIL);
    if (!cibilPlugin) return pluginNotInstalledMessage('Transunion CIBIL');
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    const itemResponse = await findItemById(db, projectId, collectionDetails, itemId);
    if (itemResponse.code !== 200) return itemResponse;
    itemResponse.data = await cryptService(
      itemResponse.data,
      projectId,
      collectionDetails,
      true,
      false,
      true,
    );
    const payload = await preparePayloadForCibilRequest(
      itemResponse.data,
      firstNameField,
      middleNameField,
      lastNameField,
      birthDateField,
      genderField,
      panNumberField,
      telephoneNumberField,
      lineOneField,
      lineTwoField,
      stateField,
      pinCodeField,
      cibilPlugin.setting,
      dateFormat,
    );
    if (payload.code) return payload;
    const response = await axios.post('https://cibil.drapcode.in/cibil/consumer-cir', {
      credentials: cibilPlugin.setting,
      payload,
    });
    if (response && response.status === 200 && response.data.data) {
      await updateCollectionItem(
        db,
        projectId,
        environment,
        enableAuditTrail,
        collectionDetails,
        itemId,
        { [saveResponseField]: response.data.data },
        user,
        headers,
      );
      return { code: 200, message: 'Success', data: response.data.data };
    } else {
      return {
        code: response?.status || 500,
        message: 'Unexpected response from CIBIL API',
        error: response?.data || 'No data received',
      };
    }
  } catch (error) {
    console.error('Error in getConsumerReportService:', error);
    return {
      code: error?.response?.data?.code || 500,
      message: error?.response?.data?.message || 'Internal Server Error',
      error: error?.response?.data?.errors || error,
    };
  }
};
