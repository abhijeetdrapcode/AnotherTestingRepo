import { findTemplate, listTemplates } from '../email-template/template.service';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { findItemById, updateItemById } from '../item/item.service';
import { getTokenExpireTime, issueJWTToken } from '../loginPlugin/jwtUtils';
import { userCollectionName } from '../loginPlugin/loginUtils';
import {
  checkCollectionByName,
  encRefFieldCollections,
  findOneCollectionService,
  userCollectionService,
} from '../collection/collection.service';
import { processItemEncryptDecrypt, replaceValueFromSource } from 'drapcode-utility';
import axios from 'axios';
import { Buffer } from 'buffer';
import { saveItem } from '../item/item.service';
import { atob } from 'buffer';
import { list } from '../item/item.service';
import { pluginCode } from 'drapcode-constant';
import { replaceFieldsIntoTemplate, getEmailAddressesToSendEmail } from '../email/email.service';
import { executeLastRecordBuilder } from '../item/item.builder.service';
import { getProjectEncryption } from '../project/project.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import {
  flattenRecipientsResponse,
  getNameToSendEmail,
  handleDocusignActivityTrackers,
  htmlToPdf,
  mapRecipientsToRecords,
} from './docusign.utils';

const sendForEsignUsingDocusign = async (
  db,
  projectId,
  environment,
  enableAuditTrail,
  user,
  headers,
  name,
  sendTo,
  ccTo,
  bccTo,
  emailSubject,
  agreementTemplateBody,
  accessToken,
  accountId,
  baseUrl,
) => {
  const documentBase64 = await htmlToPdf(agreementTemplateBody);
  const documentId = 1;

  const createRecipient = (
    email,
    name,
    recipientId,
    routingOrder,
    roleName,
    accessCode = null,
    phoneNumber = null,
    secondaryDeliveryMethod = null,
  ) => {
    const recipient = {
      email,
      name,
      recipientId,
      routingOrder,
      roleName,
    };
    if (accessCode) recipient.accessCode = accessCode;
    if (phoneNumber) recipient.recipientPhoneNumber = phoneNumber;
    if (secondaryDeliveryMethod) recipient.secondaryDeliveryMethod = secondaryDeliveryMethod;
    return recipient;
  };
  const signers = (sendTo || []).map((email, index) =>
    createRecipient(
      email,
      Array.isArray(name) ? name[index] || `Signer ${index + 1}` : name,
      `${index + 1}`,
      '1',
      'Signer',
      null,
      null,
      null,
    ),
  );
  const carbonCopies = (ccTo || []).map((email, index) =>
    createRecipient(
      email,
      `CC Recipient ${index + 1}`,
      `${(sendTo || []).length + index + 1}`,
      '2',
      'Carbon Copy',
      null,
      null,
      null,
    ),
  );
  const certifiedDeliveries = (bccTo || []).map((email, index) =>
    createRecipient(
      email,
      `BCC Recipient ${index + 1}`,
      `${(sendTo || []).length + (ccTo || []).length + index + 1}`,
      '3',
      'Certified Delivery',
      null,
      null,
      null,
    ),
  );
  const recipients = {
    signers,
    carbonCopies,
    certifiedDeliveries,
  };
  const data = {
    documents: [
      {
        documentBase64: documentBase64,
        documentId: documentId,
        fileExtension: 'pdf',
        name: 'document',
      },
    ],
    emailSubject: emailSubject,
    recipients: recipients,
    status: 'sent',
  };
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${baseUrl}/v2.1/accounts/${accountId}/envelopes`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    data: data,
  };
  try {
    const response = await axios.request(config);
    const envelopeId = response?.data?.envelopeId;
    const status = response?.data?.status;
    if (response.status === 201 && response.data) {
      const itemData = mapRecipientsToRecords(recipients, response.data);
      const signersCollection = await findOneCollectionService(projectId, 'docusign_signers');
      if (signersCollection) {
        itemData.forEach(async (item) => {
          await saveItem(
            db,
            projectId,
            environment,
            enableAuditTrail,
            signersCollection,
            item,
            null,
            user,
            headers,
          );
        });
      }
    }
    return { envelopeId, status };
  } catch (error) {
    console.error('Detailed Error:', {
      errorMessage: error.message,
      errorResponse: error.response?.data,
      errorConfig: error.config,
    });
    throw error;
  }
};

export const saveDocusignTokens = async (
  projectId,
  db,
  body,
  user,
  decrypt,
  enableAuditTrail,
  environment,
  headers,
) => {
  const { params, accessToken, refreshToken, profile, collectionName } = body;
  const collection = await checkCollectionByName(projectId, collectionName);
  if (!collection) {
    throw new Error({ code: 404, data: `Collection not found with provided name` });
  }
  let paramsObj = atob(params);
  paramsObj = JSON.parse(paramsObj);
  const { successRedirectUrl, errorRedirectUrl, successMessage, errorMessage } = paramsObj;
  const tokens = {
    authorizationToken: accessToken,
    refreshToken: refreshToken,
  };
  let finalData = {};
  const eventConfig = {
    successRedirectUrl,
    errorRedirectUrl,
    successMessage,
    errorMessage,
  };
  try {
    const lastItem = await executeLastRecordBuilder(db, collectionName);
    if (lastItem?.length) await db.dropCollection(collectionName);

    await saveItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collection,
      tokens,
      user,
      headers,
      decrypt,
    );
    finalData = {
      projectId,
      eventConfig,
      profile,
    };
    return finalData;
  } catch (error) {
    console.error('Error saving token:', error.response ? error.response.data : error.message);
    throw error;
  }
};

export const docusignTokenGen = async (
  projectId,
  db,
  user,
  decrypt,
  environment,
  tenant,
  enableAuditTrail,
  headers,
) => {
  try {
    const docusignPlugin = await findInstalledPlugin(projectId, pluginCode.DOCUSIGN);
    if (!docusignPlugin) return pluginNotInstalledMessage('DocuSign');
    const collection = await checkCollectionByName(projectId, 'docusign_tokens');
    if (!collection) return collectionNotFoundMessage('DocuSign Tokens');
    let result = await list(db, projectId, collection);
    const refreshToken = result?.[0]?.refreshToken;
    if (!refreshToken) return { code: 400, message: 'Please initiate DocuSign first' };
    let { integration_key, secret_key, domain_path } = docusignPlugin.setting;
    integration_key = replaceValueFromSource(integration_key, environment, tenant);
    secret_key = replaceValueFromSource(secret_key, environment, tenant);
    domain_path = replaceValueFromSource(domain_path, environment, tenant);
    const clientID = integration_key ?? '';
    const clientSecret = secret_key ?? '';
    const url = `https://${domain_path}/oauth/token`;
    const basicToken = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    const headersS = {
      Authorization: `Basic ${basicToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();
    const response = await axios.post(url, data, { headers: headersS });
    if (!response.data) throw new Error('Error in getting token');
    const { access_token, refresh_token } = response.data;
    const tokens = {
      authorizationToken: access_token,
      refreshToken: refresh_token,
    };
    const lastItem = await executeLastRecordBuilder(db, 'docusign_tokens');
    if (lastItem?.length) await db.dropCollection('docusign_tokens');
    await saveItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collection,
      tokens,
      user,
      headers,
      decrypt,
    );
    return { code: 200, tokens, docusignPlugin };
  } catch (error) {
    console.warn(error);
    throw error;
  }
};

export const sendForEsignService = async (
  body,
  db,
  projectId,
  enableAuditTrail,
  user,
  projectConstants,
  environment,
  projectName,
  tenant,
  tokens,
  headers,
  docusignPlugin,
  isDeveloperApi = false,
) => {
  try {
    const {
      templatesRules,
      itemId,
      propagateItemId,
      previousActionResponse,
      previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
    } = body;
    const browserStorageDTO = {
      sessionValue: previousActionResponse,
      sessionFormValue: previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
    };
    const { authorizationToken: accessToken } = tokens;
    if (!templatesRules || !templatesRules.length) throw new Error('No template rules provided.');
    let accountId = '';
    let baseUrl = '';
    if (docusignPlugin) {
      let { account_id, base_url } = docusignPlugin.setting;
      accountId = replaceValueFromSource(account_id, environment, tenant);
      baseUrl = replaceValueFromSource(base_url, environment, tenant);
    }
    let name = 'unknown';
    let sendTo = '';
    let ccTo = '';
    let bccTo = '';
    let emailSubject = '';
    let agreementTemplateBody = '';
    let currentUser = {};

    const { enableEncryption, encryption } = await getProjectEncryption(projectId);
    const userCollection = await userCollectionService(projectId);

    if (user && user.uuid) {
      const userData = await findItemById(db, projectId, userCollection, user.uuid, null);
      currentUser = userData?.data || {};

      if (enableEncryption && encryption) {
        const userFields = userCollection ? userCollection.fields : [];
        const encryptedRefCollections = await encRefFieldCollections(projectId, userFields);
        const cryptResponse = await processItemEncryptDecrypt(
          currentUser,
          userFields,
          encryption,
          true,
          encryptedRefCollections,
        );
        currentUser = cryptResponse;
      }
    }

    const siteUrl = headers?.origin;
    const userTenantIds = user ? user.tenantId || [] : [];
    let messages = [];
    for (const templateRule of templatesRules) {
      const {
        templateId,
        nameFields,
        emailFields,
        emailCcFields,
        emailBccFields,
        sendToPropagate,
      } = templateRule;

      try {
        let templateResponse = await findTemplate(projectId, templateId);
        if (!templateResponse) {
          continue;
        }
        const itemIdForTemplate = sendToPropagate ? propagateItemId : itemId;
        const collectionName = templateResponse.collectionId;
        let tenantTemplateResponse = {};
        let isTenantTemplateOverride = false;

        if (userTenantIds.length > 0) {
          const tenantTemplates = await listTemplates(projectId, templateId);
          for (const tenantTemplate of tenantTemplates) {
            const tenantTemplateTenantIds = tenantTemplate?.tenants?.map((t) => t.uuid) || [];
            const tenantIds = tenantTemplateTenantIds.filter((tid) => userTenantIds.includes(tid));
            if (tenantIds.length > 0) {
              tenantTemplateResponse = tenantTemplate;
              isTenantTemplateOverride = true;
              break;
            }
          }
        }

        if (isTenantTemplateOverride && tenantTemplateResponse) {
          templateResponse = tenantTemplateResponse;
        }

        const collection = await findOneCollectionService(projectId, collectionName);
        let itemDataOfTemplateCollection = collectionName
          ? (await findItemById(db, projectId, collection, itemIdForTemplate, null))?.data || {}
          : {};
        if (!Object.keys(itemDataOfTemplateCollection).length) {
          itemDataOfTemplateCollection = {};
        }

        const templateCollection = await findOneCollectionService(
          projectId,
          templateResponse.collectionId,
        );
        if (enableEncryption && encryption) {
          const templateFields = templateCollection ? templateCollection.fields : [];
          const encryptedRefCollections = await encRefFieldCollections(projectId, templateFields);
          const cryptResponse = await processItemEncryptDecrypt(
            itemDataOfTemplateCollection,
            templateFields,
            encryption,
            true,
            encryptedRefCollections,
          );
          itemDataOfTemplateCollection = cryptResponse;
        }

        itemDataOfTemplateCollection.siteUrl = siteUrl;

        if (collectionName === userCollectionName) {
          const { tokenExpiry, inActivityLimit } = await getTokenExpireTime(projectId, environment);
          let authorizationToken = await issueJWTToken(
            itemDataOfTemplateCollection,
            tokenExpiry,
            inActivityLimit,
          );
          authorizationToken = authorizationToken.token;
          if (authorizationToken && authorizationToken.startsWith('Bearer ')) {
            authorizationToken = authorizationToken.substring(7);
          }
          itemDataOfTemplateCollection.authorizationToken = authorizationToken;
          itemDataOfTemplateCollection.autorizationToken = authorizationToken; //?INFO: To handle typo in Existing Project Email Templates
        }

        itemDataOfTemplateCollection.projectName = projectName;
        const subjectContent = templateResponse.subject;
        emailSubject = replaceFieldsIntoTemplate(
          subjectContent,
          itemDataOfTemplateCollection,
          currentUser,
          environment,
          templateCollection,
          userCollection,
          browserStorageDTO,
        );
        if (environment.envType === 'BETA') {
          emailSubject = `[Sandbox] ${emailSubject}`;
        } else if (environment.envType === 'PREVIEW') {
          emailSubject = `[Preview] ${emailSubject}`;
        }
        const bodyContent = templateResponse.content;
        agreementTemplateBody = replaceFieldsIntoTemplate(
          bodyContent,
          itemDataOfTemplateCollection,
          currentUser,
          environment,
          templateCollection,
          userCollection,
          browserStorageDTO,
        );
        let ccTo, bccTo;
        if (isDeveloperApi) {
          name = body.sendTo;
          sendTo = body.sendTo;
          ccTo = body.cc;
          bccTo = body.bcc;
        } else {
          name = getNameToSendEmail(
            nameFields,
            itemDataOfTemplateCollection,
            projectConstants,
            user,
          );
          sendTo = getEmailAddressesToSendEmail(
            emailFields,
            itemDataOfTemplateCollection,
            projectConstants,
            user,
          );
          if (emailCcFields && emailCcFields.length) {
            ccTo = getEmailAddressesToSendEmail(
              emailCcFields,
              itemDataOfTemplateCollection,
              projectConstants,
              user,
            );
          }
          if (emailBccFields && emailBccFields.length) {
            bccTo = getEmailAddressesToSendEmail(
              emailBccFields,
              itemDataOfTemplateCollection,
              projectConstants,
              user,
            );
          }
        }
        const { envelopeId, status } = await sendForEsignUsingDocusign(
          db,
          projectId,
          environment,
          enableAuditTrail,
          user,
          headers,
          name,
          sendTo,
          ccTo,
          bccTo,
          emailSubject,
          agreementTemplateBody,
          accessToken,
          accountId,
          baseUrl,
        );
        messages.push({
          templateId,
          sender: user,
          itemId,
          sendTo,
          ccTo,
          bccTo,
          emailSubject,
          agreementTemplateBody,
          envelopeId,
          envelopeStatus: status,
          status: 'success',
        });
        await handleDocusignActivityTrackers(
          db,
          projectId,
          enableAuditTrail,
          headers,
          messages,
          user,
          emailSubject,
          agreementTemplateBody,
          environment,
          envelopeId,
          status,
        );
      } catch (error) {
        console.error(`Failed to process template rule with ID ${templateId}:`, error.message);
        messages.push({
          templateId,
          sender: user,
          itemId,
          sendTo,
          ccTo,
          bccTo,
          emailSubject,
          agreementTemplateBody,
          status: 'failure',
          error: error.message,
        });
        await handleDocusignActivityTrackers(
          db,
          projectId,
          enableAuditTrail,
          headers,
          messages,
          user,
          emailSubject,
          agreementTemplateBody,
          environment,
          error,
          '',
          'failure',
        );
      }
    }

    return messages;
  } catch (error) {
    console.error('Error in sendForEsignService:', error);
    throw error;
  }
};

export const fetchEnvelopeDetailsService = async (
  db,
  projectId,
  user,
  decrypt,
  environment,
  tenant,
  enableAuditTrail,
  headers,
  itemId,
  collection,
) => {
  try {
    const tokenGenerationResponse = await docusignTokenGen(
      projectId,
      db,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
    );
    if (tokenGenerationResponse.code !== 200) return tokenGenerationResponse;
    const { tokens, docusignPlugin } = tokenGenerationResponse;
    const { authorizationToken } = tokens;
    const { account_id, base_url } = docusignPlugin.setting;
    const contractsCollection = await findOneCollectionService(projectId, 'docusign_contracts');
    if (!contractsCollection) return collectionNotFoundMessage('DocuSign Contracts');
    let envelopeId = itemId;
    if (collection) {
      const collectionDetails = await findOneCollectionService(projectId, collection);
      if (!collectionDetails) return collectionNotFoundMessage(collection);
      const { data } = await findItemById(db, projectId, collectionDetails, itemId);
      if (!data) return { code: 404, message: 'Item not found' };
      envelopeId = data.envelopeId;
    }
    if (!envelopeId) return { code: 400, message: 'Envelope ID not found in the item' };
    const accountId = replaceValueFromSource(account_id, environment, tenant);
    const baseUrl = replaceValueFromSource(base_url, environment, tenant);
    const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`;
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: `Bearer ${authorizationToken}`,
      },
    };
    try {
      const response = await axios.request(config);
      if (response.status === 200 && response.data) {
        const { data: existingContract } = await findItemById(
          db,
          projectId,
          contractsCollection,
          null,
          { envelopeId: response.data?.envelopeId },
        );
        if (existingContract) {
          await updateItemById(
            db,
            projectId,
            environment,
            enableAuditTrail,
            contractsCollection,
            existingContract?.uuid,
            response.data,
            user,
            headers,
          );
        } else {
          await saveItem(
            db,
            projectId,
            environment,
            enableAuditTrail,
            contractsCollection,
            response.data,
            null,
            user,
            headers,
          );
        }
      }
      return { code: response.status, data: response.data };
    } catch (error) {
      console.error('Detailed Error:', {
        errorMessage: error.message,
        errorResponse: error.response?.data,
        errorConfig: error.config,
      });
      return {
        code: error.response?.status || 500,
        error: error.response?.data || 'Error fetching envelope details',
      };
    }
  } catch (error) {
    console.error('Error in fetchEnvelopeDetailsService:', error);
    return { code: 500, message: 'Internal Server Error', error: error?.message || error };
  }
};

export const fetchSigningStatusService = async (
  db,
  projectId,
  user,
  decrypt,
  environment,
  tenant,
  enableAuditTrail,
  headers,
  itemId,
  collection,
) => {
  try {
    const tokenGenerationResponse = await docusignTokenGen(
      projectId,
      db,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
    );
    if (tokenGenerationResponse.code !== 200) return tokenGenerationResponse;
    const { tokens, docusignPlugin } = tokenGenerationResponse;
    const { authorizationToken } = tokens;
    const { account_id, base_url } = docusignPlugin.setting;
    const signersCollection = await findOneCollectionService(projectId, 'docusign_signers');
    if (!signersCollection) return collectionNotFoundMessage('DocuSign Signers');
    let envelopeId = itemId;
    if (collection) {
      const collectionDetails = await findOneCollectionService(projectId, collection);
      if (!collectionDetails) return collectionNotFoundMessage(collection);
      const { data } = await findItemById(db, projectId, collectionDetails, itemId);
      if (!data) return { code: 404, message: 'Item not found' };
      envelopeId = data.envelopeId;
    }
    if (!envelopeId) return { code: 400, message: 'Envelope ID not found in the item' };
    const accountId = replaceValueFromSource(account_id, environment, tenant);
    const baseUrl = replaceValueFromSource(base_url, environment, tenant);
    const url = `${baseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`;
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: url,
      headers: {
        Authorization: `Bearer ${authorizationToken}`,
      },
    };
    try {
      const response = await axios.request(config);
      if (response.status === 200 && response.data) {
        const envelopeSigners = await list(
          db,
          projectId,
          signersCollection,
          null,
          { ['envelopeId:EQUALS']: envelopeId },
          true,
        );
        if (!envelopeSigners || !envelopeSigners.length) {
          return { code: 400, message: 'No Signers for the given Envelope ID' };
        }
        const itemData = flattenRecipientsResponse(response.data, envelopeId);
        for (const signer of envelopeSigners) {
          delete signer._id;
          const updated = itemData.find(
            (i) => i.email?.toLowerCase() === signer.email?.toLowerCase(),
          );
          if (updated) {
            await updateItemById(
              db,
              projectId,
              environment,
              enableAuditTrail,
              signersCollection,
              signer.uuid,
              updated,
              user,
              headers,
            );
          }
        }
      }
      return { code: response.status, data: response.data };
    } catch (error) {
      console.error('Detailed Error:', {
        errorMessage: error.message,
        errorResponse: error.response?.data,
        errorConfig: error.config,
      });
      return {
        code: error.response?.status || 500,
        error: error.response?.data || 'Error fetching signing status',
      };
    }
  } catch (error) {
    console.error('Error in fetchSigningStatusService:', error);
    return { code: 500, message: 'Internal Server Error', error: error?.message || error };
  }
};
