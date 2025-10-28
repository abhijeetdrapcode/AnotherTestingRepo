import { pluginCode } from 'drapcode-constant';
import {
  checkCollectionByName,
  findOneCollectionService,
  userCollectionService,
} from '../collection/collection.service';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import {
  findItemById,
  list,
  saveBulkDataFromDeveloperAPI,
  saveCollectionItem,
  updateItemById,
} from '../item/item.service';
import { cryptService } from '../middleware/encryption.middleware';
import axios from 'axios';
import { replaceValueFromSource } from 'drapcode-utility';
import { mapAccountHolderData } from './signzy.utils';
import { prepareS3Url } from '../utils/utils';
import moment from 'moment';
const { APP_ENV } = process.env;

export const createConsentRequestService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  tenant,
  user,
  headers,
  userMobileField,
  consentType,
  dataItemId,
  redirectUrl,
) => {
  try {
    const isProd = APP_ENV === 'production';
    const config = {
      consentTemplateIds: {
        one_time: isProd
          ? 'ONETIME-single-58160b30-0a12-4303-8e0b-50db0d924d0a'
          : 'ONETIME-single-ecf4bbfc-9044-47e5-a62c-86fb727d4524',
        periodic: isProd
          ? 'Periodic-single-4f6586f4-283f-44c4-9e12-187eb657be9e'
          : 'Periodic-single-54932051-b8ae-4d01-8d7a-1270eb75ce34',
      },
      consentRequestUrl: isProd
        ? 'https://api.signzy.app/api/v3/account-aggregator-switch/consent-request'
        : 'https://api-preproduction.signzy.app/api/v3/account-aggregator-switch/consent-request',
    };
    const userCollection = await userCollectionService(projectId);
    const signzyAccountAggregatorPlugin = await findInstalledPlugin(
      projectId,
      pluginCode.SIGNZY_ACCOUNT_AGGREGATOR,
    );
    if (!signzyAccountAggregatorPlugin) {
      return pluginNotInstalledMessage('Signzy Account Aggregator');
    }
    let { data } = await findItemById(db, projectId, userCollection, dataItemId);
    if (!data) {
      return { code: 404, message: 'Item not found in collection' };
    }
    data = await cryptService(data, projectId, userCollection, true, false, true);
    let mobileNumber = data[userMobileField];
    if (!mobileNumber || !mobileNumber.startsWith('+91')) {
      return { code: 400, message: 'Mobile number must include country code +91' };
    }
    mobileNumber = mobileNumber.replace(/^\+91[\s-]*/, '').replace(/\s+/g, '');
    const { setting } = signzyAccountAggregatorPlugin;
    const { accessToken } = setting;
    const consentTemplateId =
      consentType === 'one_time'
        ? config.consentTemplateIds.one_time
        : config.consentTemplateIds.periodic;
    const signzyData = { mobileNumber, consentTemplateId, redirectUrl };
    const response = await axios.post(config.consentRequestUrl, signzyData, {
      headers: { Authorization: replaceValueFromSource(accessToken, environment, tenant) },
    });
    if (response.status === 200 && response.data && response.data.result) {
      const { requestId, internalId, consentHandle } = response.data.result;
      await updateItemById(
        db,
        projectId,
        environment,
        enableAuditTrail,
        userCollection,
        data.uuid,
        { requestId, internalId, consentHandle },
        user,
        headers,
      );
    }
    return {
      code: response.status,
      data: response?.data?.result,
      message: 'Consent request created successfully',
    };
  } catch (error) {
    console.error('Error in createConsentRequestService:', error);
    if (error.response) {
      return {
        code: error.response.status || 500,
        message: error.response.data?.message || 'Failed to create consent request',
        error: error.response.data || {},
      };
    } else if (error.request) {
      return {
        code: 500,
        message: 'No response from Signzy API',
      };
    } else {
      return {
        code: 500,
        message: error.message || 'An unexpected error occurred',
      };
    }
  }
};

export const fetchFiDataService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  tenant,
  user,
  headers,
  itemId,
  collectionName,
  saveItemId,
  accountHolderField,
  fiTransactionsField,
) => {
  try {
    const signzyAccountAggregatorPlugin = await findInstalledPlugin(
      projectId,
      pluginCode.SIGNZY_ACCOUNT_AGGREGATOR,
    );
    if (!signzyAccountAggregatorPlugin) {
      return pluginNotInstalledMessage('Signzy Account Aggregator');
    }
    const { setting } = signzyAccountAggregatorPlugin;
    const { accessToken } = setting;
    let collectionDetails;
    if (collectionName) {
      collectionDetails = await findOneCollectionService(projectId, collectionName);
    } else {
      collectionDetails = await userCollectionService(projectId);
    }
    if (!collectionDetails) return collectionNotFoundMessage(collectionName || 'User');
    let { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) {
      return { code: 404, message: 'Item not found in collection' };
    }
    data = await cryptService(data, projectId, collectionDetails, true, false, true);
    const { requestId = '' } = data;
    if (!requestId) {
      return { code: 404, message: 'Request Id not found in item' };
    }
    const signzyData = { requestId };
    const fetchFiDataUrl =
      APP_ENV === 'production'
        ? 'https://api.signzy.app/api/v3/account-aggregator-switch/fi-fetch'
        : 'https://api-preproduction.signzy.app/api/v3/account-aggregator-switch/fi-fetch';
    const response = await axios.post(fetchFiDataUrl, signzyData, {
      headers: { Authorization: replaceValueFromSource(accessToken, environment, tenant) },
    });
    const { status, data: responseData } = response;
    if (status === 200) {
      const fiDataArray = responseData?.result?.data?.[0]?.fiData;
      if (Array.isArray(fiDataArray) && fiDataArray.length) {
        const accountAggregatorAccountHoldersCollection = await findOneCollectionService(
          projectId,
          'account_aggregator_account_holders',
        );
        for (const fiData of fiDataArray) {
          const profileHolder = fiData?.profile?.holders?.holder;
          const summary = fiData?.summary;
          const holderType = fiData?.profile?.holders?.type;
          const linkedAccRef = fiData?.linkedAccRef || '';
          const maskedAccNumber = fiData?.maskedAccNumber || '';
          let accountHolderId;
          if (profileHolder || summary) {
            const accountHolderPayload = mapAccountHolderData(profileHolder, summary, {
              requestId,
              holderType,
              userId: user?.uuid,
              linkedAccRef,
              maskedAccNumber,
            });
            accountHolderPayload[accountHolderField] = saveItemId;
            if (accountHolderPayload && accountAggregatorAccountHoldersCollection) {
              const accountHolderReponse = await saveCollectionItem(
                db,
                projectId,
                enableAuditTrail,
                accountAggregatorAccountHoldersCollection,
                accountHolderPayload,
                user,
                headers,
                environment,
              );
              accountHolderId = accountHolderReponse?.data?.uuid;
            }
          }
          const transactions = fiData?.transactions?.transactions;
          if (Array.isArray(transactions) && transactions.length) {
            const transactionsWithRequestId = transactions.map((txn) => ({
              ...txn,
              requestId,
              tenantId: tenant?.uuid || '',
              userId: user?.uuid || '',
              accountHolder: accountHolderId || '',
              [fiTransactionsField]: saveItemId,
            }));
            await saveBulkDataFromDeveloperAPI(
              db,
              projectId,
              environment,
              enableAuditTrail,
              'account_aggregator_fi_transactions',
              transactionsWithRequestId,
              'string',
              false,
            );
          }
        }
      }
    } else {
      return {
        code: status || 500,
        message: responseData?.message || 'No FI Data found in response',
      };
    }
    return {
      code: status,
      data: responseData?.result,
      message: 'FI Data fetched successfully',
    };
  } catch (error) {
    console.error('Error in fetchFiDataService:', error);
    if (error.response) {
      return {
        code: error.response.status || 500,
        message: error.response.data?.message || 'Failed to fetch FI Data',
        error: error.response.data || {},
      };
    } else if (error.request) {
      return {
        code: 500,
        message: 'No response from Signzy API',
      };
    } else {
      return {
        code: 500,
        message: error.message || 'An unexpected error occurred',
      };
    }
  }
};

export const eSignDocumentService = async (
  db,
  projectId,
  environment,
  user,
  tenant,
  enableAuditTrail,
  headers,
  body,
  signerCallbackUrl,
  signerCallbackUrlAuthorizationHeader,
) => {
  try {
    const signzyDocumentSigningPlugin = await findInstalledPlugin(
      projectId,
      pluginCode.SIGNZY_DIGITAL_DOCUMENT_SIGNING,
    );
    if (!signzyDocumentSigningPlugin) {
      return pluginNotInstalledMessage('Signzy Digital Document Signing');
    }
    const { setting } = signzyDocumentSigningPlugin;
    const { accessToken } = setting;
    const {
      collection,
      itemId,
      pdfField,
      contractExecuterName,
      contractTtl,
      signerIdentifierField,
      signerIdentifierId,
      signaturePosition,
      signaturePageNo,
      successRedirectUrl,
      failureRedirectUrl,
    } = body;
    const collectionDetails = await findOneCollectionService(projectId, collection);
    if (!collectionDetails) return collectionNotFoundMessage(collection);
    let { data } = await findItemById(db, projectId, collectionDetails, itemId);
    if (!data) {
      return { code: 404, message: 'Item not found in collection' };
    }
    data = await cryptService(data, projectId, collectionDetails, true, false, true);
    let file = data[pdfField];
    if (file && !Array.isArray(file)) {
      file = [file];
    }
    if (!file || !file[0]) {
      return { code: 400, message: 'No PDF file found in the specified field' };
    }
    const s3Url = await prepareS3Url(projectId, environment);
    const pdf = s3Url + file[0].key;
    const contractName = file[0].originalName;
    const ddssCollection = await checkCollectionByName(
      projectId,
      'digital_document_signing_signers',
    );
    if (!ddssCollection) {
      return { code: 404, data: `Collection not found with provided name` };
    }
    const signers = await list(db, projectId, ddssCollection, null, {
      [`${signerIdentifierField}:IN_LIST`]: signerIdentifierId,
    });
    if (!signers || !signers.length) return { code: 400, message: 'No Signers Found' };
    const signerdetail = signers.map((signer) => ({
      signerName: signer.signerName,
      signerGender: signer.signerGender,
      uidLastFourDigits: signer.uidLastFourDigits?.slice(-4),
      pincode: signer.pincode,
      signerYearOfBirth: signer.signerYearOfBirth,
      signerUniqueId: signer.uuid,
      signatureType: 'AADHAARESIGN-OTP',
      signatures: [
        {
          pageNo: [signaturePageNo],
          signaturePosition: [signaturePosition],
        },
      ],
    }));
    const itemData = {
      pdf,
      contractName,
      contractExecuterName,
      successRedirectUrl,
      failureRedirectUrl,
      contractTtl,
      signerCallbackUrl,
      signerCallbackUrlAuthorizationHeader,
      signerdetail,
      allowSignerGenderMatch: true,
      allowSignerYOBMatch: true,
      allowUidLastFourDigitsMatch: true,
      allowPincodeMatch: true,
    };
    const eSignurl =
      APP_ENV === 'production'
        ? 'https://api.signzy.app/api/v3/contract/initiate'
        : 'https://api-preproduction.signzy.app/api/v3/contract/initiate';
    const response = await axios.post(eSignurl, itemData, {
      headers: {
        Authorization: replaceValueFromSource(accessToken, environment, tenant),
      },
    });
    if (
      response &&
      response.data &&
      Array.isArray(response.data.signerdetail) &&
      response.data.signerdetail.length
    ) {
      const signersCollection = await findOneCollectionService(
        projectId,
        'digital_document_signing_signers',
      );
      for (const signer of response.data.signerdetail) {
        const signerUuid = signer.signerUniqueId;
        if (!signerUuid) continue;
        await updateItemById(
          db,
          projectId,
          environment,
          enableAuditTrail,
          signersCollection,
          signerUuid,
          signer,
          user,
          headers,
        );
      }
    }
    return {
      code: response.status,
      data: response.data,
      message: 'E-Sign URLs Generated for all signers',
    };
  } catch (err) {
    console.error('Error in eSignDocumentService:', err);
    if (err.response) {
      return {
        code: err.response.status || 500,
        message: err.response.data?.message || 'Signzy API Error',
        error: err.response.data,
      };
    }
    return {
      code: 500,
      message: 'Internal Server Error in eSignDocumentService',
      error: err.message || err,
    };
  }
};

export const eSignCallbackService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  body,
) => {
  try {
    const signerCollection = await findOneCollectionService(
      projectId,
      'digital_document_signing_signers',
    );
    if (!signerCollection) return collectionNotFoundMessage('Digital Document Signing Signers');
    body.userId = user?.uuid || '';
    const { signerUniqueId } = body;
    let result;
    const { data: exisitngSigner } = await findItemById(
      db,
      projectId,
      signerCollection,
      signerUniqueId,
    );
    if (exisitngSigner) {
      result = await updateItemById(
        db,
        projectId,
        environment,
        enableAuditTrail,
        signerCollection,
        signerUniqueId,
        body,
        user,
        headers,
      );
    } else {
      result = await saveCollectionItem(
        db,
        projectId,
        enableAuditTrail,
        signerCollection,
        body,
        user,
        headers,
        environment,
      );
    }
    if (user) {
      const userCollection = await userCollectionService(projectId);
      const { contractId } = body;
      if (user?.uuid) {
        await updateItemById(
          db,
          projectId,
          environment,
          enableAuditTrail,
          userCollection,
          user?.uuid,
          { contractId },
          user,
          headers,
        );
      }
    }
    return result;
  } catch (error) {
    console.error('Error in eSignCallbackService:', error);
    return { code: 500, message: 'Internal Server Error' };
  }
};

export const fetchContractDetailsService = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  tenant,
  user,
  headers,
  itemId,
  collectionName,
  signerIdentifierField,
  signerIdentifierId,
  contractsField,
  saveItemId,
) => {
  try {
    const signzyDocumentSigningPlugin = await findInstalledPlugin(
      projectId,
      pluginCode.SIGNZY_DIGITAL_DOCUMENT_SIGNING,
    );
    if (!signzyDocumentSigningPlugin) {
      return pluginNotInstalledMessage('Signzy Digital Document Signing');
    }
    const { setting } = signzyDocumentSigningPlugin;
    const { accessToken } = setting;
    let contractId;
    const ddssCollection = await checkCollectionByName(
      projectId,
      'digital_document_signing_signers',
    );
    if (!ddssCollection) {
      return { code: 404, data: `Collection not found with provided name` };
    }
    if (signerIdentifierField && signerIdentifierId) {
      const signers = await list(db, projectId, ddssCollection, null, {
        [`${signerIdentifierField}:IN_LIST`]: signerIdentifierId,
      });
      if (!signers || !signers.length) return { code: 400, message: 'No Signers Found' };
      contractId = signers?.find((signer) => signer?.contractId)?.contractId || '';
      if (!contractId) {
        return { code: 404, message: 'Contract Id not found' };
      }
    } else {
      let collectionDetails;
      if (collectionName) {
        collectionDetails = await findOneCollectionService(projectId, collectionName);
      } else {
        collectionDetails = await userCollectionService(projectId);
      }
      if (!collectionDetails) return collectionNotFoundMessage(collectionName || 'User');
      let { data } = await findItemById(db, projectId, collectionDetails, itemId);
      if (!data) {
        return { code: 404, message: 'Item not found in collection' };
      }
      data = await cryptService(data, projectId, collectionDetails, true, false, true);
      contractId = data?.contractId || '';
      if (!contractId) {
        return { code: 404, message: 'Contract Id not found' };
      }
    }
    const signzyContractData = { contractId };
    const fetchContractDataUrl =
      APP_ENV === 'production'
        ? 'https://api.signzy.app/api/v3/contract/pullData'
        : 'https://api-preproduction.signzy.app/api/v3/contract/pullData';
    const response = await axios.post(fetchContractDataUrl, signzyContractData, {
      headers: { Authorization: replaceValueFromSource(accessToken, environment, tenant) },
    });
    const { status, data: responseData } = response;
    if (status === 200) {
      const documentSigningContractsCollection = await findOneCollectionService(
        projectId,
        'digital_document_signing_contracts',
      );
      const { contractCreationTime } = responseData;
      const parsedMoment = moment(contractCreationTime, 'DD/MM/YYYY, HH:mm:ss');
      if (parsedMoment.isValid()) {
        const jsDate = parsedMoment.toDate();
        responseData.contractCreationTime = jsDate;
      }
      responseData.userId = user?.uuid || '';
      responseData[contractsField] = saveItemId;
      if (responseData && documentSigningContractsCollection) {
        const { data: existingContract } = await findItemById(
          db,
          projectId,
          documentSigningContractsCollection,
          null,
          { contractId: responseData.contractId },
        );

        if (existingContract) {
          await updateItemById(
            db,
            projectId,
            environment,
            enableAuditTrail,
            documentSigningContractsCollection,
            existingContract?.uuid,
            responseData,
            user,
            headers,
          );
        } else {
          await saveCollectionItem(
            db,
            projectId,
            enableAuditTrail,
            documentSigningContractsCollection,
            responseData,
            user,
            headers,
            environment,
          );
        }
      }
    } else {
      return {
        code: status || 500,
        message: responseData?.message || 'No Contract Data found in response',
      };
    }
    return {
      code: status,
      data: responseData,
      message: 'Contract Data fetched successfully',
    };
  } catch (error) {
    console.error('Error in fetchContractDetailsService:', error);
    if (error.response) {
      return {
        code: error.response?.status || 500,
        message: error.response?.data?.message || 'Failed to fetch Contract Data',
        error: error.response?.data || {},
      };
    } else if (error.request) {
      return {
        code: 500,
        message: 'No response from Signzy API',
      };
    } else {
      return {
        code: 500,
        message: error.message || 'An unexpected error occurred',
      };
    }
  }
};
