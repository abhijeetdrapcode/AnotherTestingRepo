import { findTemplate, listTemplates } from '../email-template/template.service';
import {
  findInstalledPlugin,
  loadS3PluginConfig,
  loadSESPluginConfig,
} from '../install-plugin/installedPlugin.service';
import { findItemById, saveCollectionItem } from '../item/item.service';
import { getTokenExpireTime, issueJWTToken } from '../loginPlugin/jwtUtils';
import { userCollectionName } from '../loginPlugin/loginUtils';
import { pluginNotInstalledMessage, prepareFunction } from '../utils/appUtils';
import {
  encRefFieldCollections,
  findOneCollectionService,
  userCollectionService,
} from '../collection/collection.service';
import { FieldTypes, pluginCode } from 'drapcode-constant';
import {
  createS3Client,
  cryptFile,
  parseValueFromData,
  processItemEncryptDecrypt,
  replaceValueFromSource,
} from 'drapcode-utility';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import _ from 'lodash';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getProjectEncryption } from '../project/project.service';
import sgMail from '@sendgrid/mail';
import axios from 'axios';
const fs = require('fs');

export const getSendToUser = async (db, projectId, userCollection, sendTo) => {
  const sendToRegexValue = {
    $regex: new RegExp(`^${sendTo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  };
  const query = { $or: [{ email: sendToRegexValue }, { userName: sendToRegexValue }] };
  let { data } = await findItemById(db, projectId, userCollection, null, query);
  return data;
};
//TODO: Ali -> Handle browserStorageData and remove previousActionResponse,previousActionFormData
export const sendEmailTemplateService = async (req, sendToUser = null) => {
  try {
    const {
      db,
      body,
      params,
      projectId,
      project,
      environment,
      user,
      tenant,
      enableAuditTrail,
      headers,
    } = req;
    const {
      sendTo,
      previousActionResponse,
      previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
      emailServicePlugin = 'AWS_SES',
    } = body;
    const browserStorageDTO = {
      sessionValue: previousActionResponse,
      sessionFormValue: previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
    };
    const { uuid } = user ? user : '';
    const userCollection = await userCollectionService(projectId);
    let currentUser = uuid ? (await findItemById(db, projectId, userCollection, uuid))?.data : {};
    const { templateId } = params;
    let templateResponse = await findTemplate(projectId, templateId);
    let itemDataOfTemplateCollection = {};
    let tenantTemplateResponse = {};
    let tenantTemplates = [];
    let isTenantTemplateOverride = false;
    const siteUrl = req?.headers?.origin;
    itemDataOfTemplateCollection.siteUrl = siteUrl;
    itemDataOfTemplateCollection.projectName = project.projectName;
    const { enableEncryption, encryption } = await getProjectEncryption(projectId);
    if (templateResponse && templateResponse.collectionId === userCollectionName && sendTo) {
      let user = '';
      if (!sendToUser) {
        user = await getSendToUser(db, projectId, userCollection, sendTo);
      } else user = sendToUser;
      if (enableEncryption && encryption) {
        const userFields = userCollection ? userCollection.fields : [];
        const encryptedRefCollections = await encRefFieldCollections(projectId, userFields);
        const cryptResponse = await processItemEncryptDecrypt(
          user,
          userFields,
          encryption,
          true,
          encryptedRefCollections,
        );
        user = cryptResponse;
      }
      let userTenantIds = [];
      if (user && user.tenantId) {
        userTenantIds = user.tenantId.map((tenant) => tenant.uuid);
      }
      tenantTemplates = await listTemplates(projectId, params.templateId);
      tenantTemplates.forEach((tenantTemplate) => {
        if (isTenantTemplateOverride) {
          return;
        }
        const tenantTemplateTenantIds =
          tenantTemplate && tenantTemplate.tenants
            ? tenantTemplate.tenants.map((tenant) => tenant.uuid)
            : [];
        let tenantIds = [];
        if (
          tenantTemplateTenantIds &&
          tenantTemplateTenantIds.length &&
          userTenantIds &&
          userTenantIds.length
        ) {
          tenantIds = tenantTemplateTenantIds.filter((templateTenantId) =>
            userTenantIds.includes(templateTenantId),
          );
        }
        isTenantTemplateOverride = !!(tenantIds && tenantIds.length);
        if (isTenantTemplateOverride) {
          tenantTemplateResponse = tenantTemplate;
          return;
        }
      });
      itemDataOfTemplateCollection = { ...itemDataOfTemplateCollection, ...user };
      const { tokenExpiry, inActivityLimit } = await getTokenExpireTime(projectId, environment);
      let authorizationToken = await issueJWTToken(
        itemDataOfTemplateCollection,
        tokenExpiry,
        inActivityLimit,
      );
      authorizationToken = authorizationToken.token;
      if (authorizationToken && authorizationToken.startsWith('Bearer ')) {
        authorizationToken = authorizationToken.substring(7, authorizationToken.length);
      }
      itemDataOfTemplateCollection.autorizationToken = authorizationToken; //?INFO: To handle typo in Existing Project Email Templates
      itemDataOfTemplateCollection.authorizationToken = authorizationToken;
    }
    if (isTenantTemplateOverride && tenantTemplateResponse) {
      templateResponse = tenantTemplateResponse;
    }
    const templateCollection = await findOneCollectionService(
      projectId,
      templateResponse.collectionId,
    );
    if (enableEncryption && encryption) {
      const userFields = userCollection ? userCollection.fields : [];
      const encryptedRefCollections = await encRefFieldCollections(projectId, userFields);
      const currentUserCryptResponse = await processItemEncryptDecrypt(
        currentUser,
        userFields,
        encryption,
        true,
        encryptedRefCollections,
      );
      currentUser = currentUserCryptResponse;
    }
    const subjectContent = templateResponse.subject;
    const bodyContent = templateResponse.content;
    const emailSubject = replaceFieldsIntoTemplate(
      subjectContent,
      itemDataOfTemplateCollection || {},
      currentUser,
      environment,
      templateCollection,
      userCollection,
      browserStorageDTO,
    );
    const emailBody = replaceFieldsIntoTemplate(
      bodyContent,
      itemDataOfTemplateCollection || {},
      currentUser,
      environment,
      templateCollection,
      userCollection,
      browserStorageDTO,
    );
    const attachmentField = templateResponse.attachmentField;
    let attachmentFiles = itemDataOfTemplateCollection[attachmentField];
    if (attachmentFiles && !Array.isArray(attachmentFiles)) {
      attachmentFiles = [attachmentFiles];
    }
    let ccTo = '';
    let bccTo = '';
    let sendEmailStats;
    let trackerCollectionName;
    let messages = [];
    try {
      if (emailServicePlugin === 'SENDGRID') {
        trackerCollectionName = 'sendgrid_activity_tracker';
        const sendGridPlugin = await findInstalledPlugin(projectId, pluginCode.SENDGRID);
        if (!sendGridPlugin) return pluginNotInstalledMessage('SendGrid');
        const { apiKey, from_email, from_name, reply_to } = sendGridPlugin.setting;
        sendEmailStats = await sendEmailUsingSendGrid(
          replaceValueFromSource(apiKey, environment, tenant),
          sendTo,
          emailSubject,
          emailBody,
          replaceValueFromSource(from_email, environment, tenant),
          replaceValueFromSource(from_name, environment, tenant),
          replaceValueFromSource(reply_to, environment, tenant),
          ccTo,
          bccTo,
          attachmentFiles,
          projectId,
          environment,
          encryption,
        );
      } else if (emailServicePlugin === 'RESEND') {
        trackerCollectionName = 'resend_activity_tracker';
        const resendPlugin = await findInstalledPlugin(projectId, pluginCode.RESEND);
        if (!resendPlugin) return pluginNotInstalledMessage('Resend');
        const { apiKey, from_email, from_name } = resendPlugin.setting;
        sendEmailStats = await sendEmailUsingResend(
          projectId,
          environment,
          encryption,
          replaceValueFromSource(apiKey, environment, tenant),
          replaceValueFromSource(from_name, environment, tenant),
          replaceValueFromSource(from_email, environment, tenant),
          sendTo,
          emailSubject,
          emailBody,
          attachmentFiles,
          ccTo,
          bccTo,
        );
      } else {
        trackerCollectionName = 'aws_ses_activity_tracker';
        const { config, fromEmailAndName, replyTo } = await loadSESPluginConfig(
          projectId,
          environment,
          tenant,
        );
        sendEmailStats = await sendEmailUsingSes(
          config,
          sendTo,
          emailSubject,
          emailBody,
          fromEmailAndName,
          replyTo,
          ccTo,
          bccTo,
          attachmentFiles,
          projectId,
          environment,
          encryption,
        );
      }
      messages.push({
        templateId,
        sender: sendToUser,
        itemId: sendToUser.uuid || '',
        sendTo,
        ccTo,
        bccTo,
        emailSubject,
        emailBody,
        status: 'success',
        emailServicePlugin,
      });
      await handleEmailActivityTrackers(
        db,
        projectId,
        enableAuditTrail,
        headers,
        messages,
        sendToUser,
        emailSubject,
        emailBody,
        trackerCollectionName,
        environment,
      );
      return {
        code: 200,
        success: true,
        message: 'Email sent successfully',
        result: sendEmailStats,
      };
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      messages.push({
        templateId,
        sender: sendToUser,
        itemId: sendToUser.uuid || '',
        sendTo,
        ccTo,
        bccTo,
        emailSubject,
        emailBody,
        status: 'failure',
        emailServicePlugin,
        error: emailError.message,
      });
      await handleEmailActivityTrackers(
        db,
        projectId,
        enableAuditTrail,
        headers,
        messages,
        sendToUser,
        emailSubject,
        emailBody,
        trackerCollectionName,
        environment,
      );
      return {
        code: 500,
        success: false,
        message: 'Failed to send email using ' + emailServicePlugin,
        error: emailError?.message || emailError,
      };
    }
  } catch (error) {
    console.error('Error in sendEmailTemplateService', error);
    return { code: 500, success: false, message: 'Email Failed', error };
  }
};

export const sendEmailUsingSes = async (
  config,
  toEmail,
  subject,
  htmlBody,
  fromEmailAndName = null,
  replyTo = null,
  ccTo = null,
  bccTo = null,
  attachmentFiles,
  projectId,
  environment,
  encryption,
) => {
  fromEmailAndName = fromEmailAndName || process.env.AWS_SES_ADMIN_FROM_EMAIL_NAME;
  const ses = new SESClient(config);
  const destinationSetting = { ToAddresses: Array.isArray(toEmail) ? toEmail : [toEmail] };
  if (ccTo) {
    destinationSetting.CcAddresses = Array.isArray(ccTo) ? ccTo : [ccTo];
  }
  if (bccTo) {
    destinationSetting.BccAddresses = Array.isArray(bccTo) ? bccTo : [bccTo];
  }

  let attachments = [];
  if (attachmentFiles && attachmentFiles.length > 0) {
    attachments = await attachmentHandlingInEmail(
      attachmentFiles,
      projectId,
      environment,
      encryption,
    );
  }

  let rawMessage = `From: ${fromEmailAndName}\n`;
  rawMessage += `To: ${Array.isArray(toEmail) ? toEmail.join(', ') : toEmail}\n`;
  rawMessage += `Subject: ${subject}\n`;

  if (ccTo) {
    rawMessage += `Cc: ${Array.isArray(ccTo) ? ccTo.join(', ') : ccTo}\n`;
  }
  if (bccTo) {
    rawMessage += `Bcc: ${Array.isArray(bccTo) ? bccTo.join(', ') : bccTo}\n`;
  }

  if (replyTo) {
    rawMessage += `Reply-To: ${Array.isArray(replyTo) ? replyTo.join(', ') : replyTo}\n`;
  }

  rawMessage += `Content-Type: multipart/mixed; boundary="boundary12345"\n\n`;

  rawMessage += `--boundary12345\n`;
  rawMessage += `Content-Type: text/html; charset="UTF-8"\n\n`;
  rawMessage += `${htmlBody}\n\n`;

  if (attachments.length > 0) {
    for (const attachment of attachments) {
      rawMessage += `--boundary12345\n`;
      rawMessage += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\n`;
      rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\n`;
      rawMessage += `Content-Transfer-Encoding: ${attachment.encoding}\n\n`;
      rawMessage += `${attachment.content}\n\n`;
    }
  }

  rawMessage += `--boundary12345--`;

  const params = {
    RawMessage: {
      Data: rawMessage,
    },
  };

  try {
    const command = new SendRawEmailCommand(params);
    const result = await ses.send(command);
    return { sentEmailId: result.MessageId, status: 'success', code: 200 };
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return { status: 'failure', error: error.message, code: 500 };
  }
};

export const replaceFieldsIntoTemplate = function (
  emailContent,
  data,
  user,
  environment,
  collection,
  userCollection,
  browserStorageDTO = {},
  projectConstants = {},
  tenant = {},
  tenantCollection = null,
) {
  try {
    if (Object.keys(data).length <= 0) {
      return emailContent;
    }
    const contentList = emailContent.match(/{{(.*?)}}/g)?.map((b) => b.replace(/{{(.*?)}}/g, '$1'));
    contentList?.forEach((prop) => {
      emailContent = replaceProp(
        prop,
        emailContent,
        data,
        user,
        environment,
        collection,
        userCollection,
        browserStorageDTO,
        projectConstants,
        tenant,
        tenantCollection,
      );
    });
    return emailContent;
  } catch (error) {
    console.error('\n error :>> ', error);
  }
};

const replaceProp = (
  prop,
  emailContent,
  data,
  user,
  environment,
  collection,
  userCollection,
  browserStorageDTO = {},
  projectConstants = {},
  tenant = {},
  tenantCollection = null,
) => {
  const {
    sessionValue: previousActionResponse,
    sessionFormValue: previousActionFormData,
    sessionStorageData,
    localStorageData,
    cookiesData,
  } = browserStorageDTO || {};
  const { utilities } = collection;
  const needle = `{{${prop}}}`;
  let dataOfItem = '';
  const { constants } = environment;
  if (prop.startsWith('DF::')) {
    dataOfItem = replaceDerivedFields(utilities, prop, data, user, constants, browserStorageDTO);
  } else if (prop.startsWith('CC::')) {
    // Replacing Collection Constant
    const cleanProp = prop.replace('CC::', '');
    const collectionConstants = collection ? collection.constants : null;
    dataOfItem = collectionConstants.find((constant) => constant.name === cleanProp)?.value;
  } else if (prop.startsWith('PC::')) {
    // Replacing Project Constant
    const cleanProp = prop.replace('PC::', '');
    const projectConstant = projectConstants.find((constant) => constant.name === cleanProp);
    dataOfItem = String(projectConstant?.value);
  } else if (prop.startsWith('RF::')) {
    // Replacing Reference Field
    const cleanProp = prop.replace('RF::', '');
    dataOfItem = parseValueFromData(data, cleanProp);
  } else if (prop.startsWith('current_user.')) {
    if (userCollection) {
      let cleanProp = prop.replace('current_user.', '');
      dataOfItem = replaceMoreProp(
        userCollection,
        cleanProp,
        user,
        user,
        constants,
        browserStorageDTO,
      );
    }
  } else if (prop.startsWith('current_tenant.')) {
    if (tenantCollection) {
      let cleanProp = prop.replace('current_tenant.', '');
      dataOfItem = replaceMoreProp(
        tenantCollection,
        cleanProp,
        tenant,
        user,
        constants,
        browserStorageDTO,
      );
    }
  } else if (prop.startsWith('environment_variable.')) {
    // Replacing Environment Variable
    const cleanProp = prop.replace('environment_variable.', '');
    dataOfItem = environment.constants.find((constant) => constant.name === cleanProp)?.value;
  } else if (prop.startsWith('current_session.')) {
    // Replacing Session Data
    const cleanProp = prop.replace('current_session.', '');
    dataOfItem = parseValueFromData(previousActionResponse, cleanProp);
  } else if (prop.startsWith('form_data_session.')) {
    // Replacing Session Form Data
    const cleanProp = prop.replace('form_data_session.', '');
    dataOfItem = parseValueFromData(previousActionFormData, cleanProp);
  } else if (prop.startsWith('SESSION_STORAGE.')) {
    // Replacing Session Form Data
    const cleanProp = prop.replace('SESSION_STORAGE.', '');
    dataOfItem = _.get(sessionStorageData, cleanProp);
  } else if (prop.startsWith('LOCAL_STORAGE.')) {
    // Replacing Session Form Data
    const cleanProp = prop.replace('LOCAL_STORAGE.', '');
    dataOfItem = _.get(localStorageData, cleanProp);
  } else if (prop.startsWith('COOKIES.')) {
    // Replacing Session Form Data
    const cleanProp = prop.replace('COOKIES.', '');
    dataOfItem = _.get(cookiesData, cleanProp);
  } else {
    // Replacing Item Data
    dataOfItem = parseValueFromData(data, prop);
    const { fields } = collection;
    const field = fields.find((field) => field.fieldName === prop);
    if (field && field.type === 'boolean') {
      dataOfItem = dataOfItem ? 'Yes' : 'No';
    }
  }
  emailContent = findMyText(needle, dataOfItem, emailContent);
  return emailContent;
};

const replaceDerivedFields = (utilities, prop, data, user, constants, browserStorageDTO) => {
  if (!utilities || utilities.length <= 0) {
    return '';
  }

  const cleanProp = prop.replace('DF::', '');
  const derivedField = utilities.find((field) => field.name === cleanProp);
  if (!derivedField) {
    return '';
  }
  return prepareFunction(derivedField, data, user, constants, browserStorageDTO);
};
const replaceMoreProp = (collection, prop, data, user, constants, browserStorageDTO) => {
  const { fields, utilities } = collection;
  let cleanProp = prop.replace('current_user.', '');
  if (cleanProp.startsWith('DF::')) {
    return replaceDerivedFields(utilities, cleanProp, data, user, constants, browserStorageDTO);
  } else {
    let dataOfItem = parseValueFromData(data, cleanProp);
    const field = fields.find((field) => field.fieldName === prop);
    if (field && field.type === 'boolean') {
      dataOfItem = dataOfItem ? 'Yes' : 'No';
    }
    return dataOfItem;
  }
};
const deepReplace = (obj, needle, replacement) => {
  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'object' && item !== null
        ? deepReplace(item, needle, replacement)
        : item === needle
        ? replacement
        : item,
    );
  }

  const result = {};
  for (let key in obj) {
    if (typeof obj[key] === 'string' && obj[key] === needle) {
      result[key] = replacement;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = deepReplace(obj[key], needle, replacement);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
};

export const findMyText = function (needle, replacement, haystackText) {
  replacement = replacement || '';
  const isStaticDynamicField = Array.isArray(replacement) && typeof replacement[0] === 'string';
  if (typeof replacement === 'object' && !isStaticDynamicField) {
    // handling for object and array and type correction
    try {
      const bodyObj = JSON.parse(haystackText);
      const finalBody = deepReplace(bodyObj, needle, replacement);
      return JSON.stringify(finalBody);
    } catch (err) {
      console.error('Invalid JSON input:', err);
      return haystackText;
    }
  } else {
    replacement = replacement.toString();
    const match = new RegExp(needle, 'ig');
    if (replacement && replacement.length > 0) {
      return haystackText.replace(match, replacement);
    } else {
      replacement = ''; //Set empty value
      return haystackText.replace(match, replacement);
    }
  }
};

//TODO: Ali -> Handle browserStorageData and remove previousActionResponse,previousActionFormData
export const sendDynamicEmailService = async (req, isDeveloperApi = false) => {
  const { body, db, projectId, user, project, environment, tenant, headers, enableAuditTrail } =
    req;
  try {
    const {
      templatesRules,
      previousActionResponse,
      previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
      eventItemConfig,
    } = body;
    const browserStorageDTO = {
      sessionValue: previousActionResponse,
      sessionFormValue: previousActionFormData,
      sessionStorageData,
      localStorageData,
      cookiesData,
    };
    if (!templatesRules || !templatesRules.length) {
      return { code: 400, message: 'No Template Rules Provided' };
    }
    let ccTo = '';
    let bccTo = '';
    let sendTo = '';
    let emailSubject = '';
    let emailBody = '';
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

    const siteUrl = req?.headers?.origin;
    const userTenantIds = user ? user.tenantId || [] : [];
    let messages = [];
    for (const templateRule of templatesRules) {
      const {
        templateId,
        emailFields,
        emailCcFields,
        emailBccFields,
        sendToPropagate,
        getItemIdFrom,
        emailServicePlugin = 'AWS_SES',
      } = templateRule;
      let trackerCollectionName;
      try {
        let templateResponse = await findTemplate(projectId, templateId);
        if (!templateResponse) {
          continue;
        }
        const itemIdForTemplate = getItemIdForTemp(getItemIdFrom, eventItemConfig, sendToPropagate);
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
          let templateFields = templateCollection ? templateCollection.fields : [];
          templateFields = templateFields.filter((field) => {
            return !(
              field.type === FieldTypes.file.id ||
              (field.type === FieldTypes.reference.id && field.refCollection?.isFileType)
            );
          });
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
        itemDataOfTemplateCollection.projectName = project.projectName;
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
        emailBody = replaceFieldsIntoTemplate(
          bodyContent,
          itemDataOfTemplateCollection,
          currentUser,
          environment,
          templateCollection,
          userCollection,
          browserStorageDTO,
        );
        const attachmentField = templateResponse.attachmentField;
        let attachmentFiles = itemDataOfTemplateCollection[attachmentField];
        if (attachmentFiles && !Array.isArray(attachmentFiles)) {
          attachmentFiles = [attachmentFiles];
        }
        let ccTo, bccTo;
        if (isDeveloperApi) {
          sendTo = body.sendTo;
          ccTo = body.cc;
          bccTo = body.bcc;
        } else {
          sendTo = getEmailAddressesToSendEmail(
            emailFields,
            itemDataOfTemplateCollection,
            project.constants,
            user,
          );
          if (emailCcFields && emailCcFields.length) {
            ccTo = getEmailAddressesToSendEmail(
              emailCcFields,
              itemDataOfTemplateCollection,
              project.constants,
              user,
            );
          }
          if (emailBccFields && emailBccFields.length) {
            bccTo = getEmailAddressesToSendEmail(
              emailBccFields,
              itemDataOfTemplateCollection,
              project.constants,
              user,
            );
          }
        }
        let sendEmailStats;
        if (emailServicePlugin === 'SENDGRID') {
          trackerCollectionName = 'sendgrid_activity_tracker';
          const sendGridPlugin = await findInstalledPlugin(projectId, pluginCode.SENDGRID);
          if (!sendGridPlugin) return pluginNotInstalledMessage('SendGrid');
          const { apiKey, from_email, from_name, reply_to } = sendGridPlugin.setting;
          sendEmailStats = await sendEmailUsingSendGrid(
            replaceValueFromSource(apiKey, environment, tenant),
            sendTo,
            emailSubject,
            emailBody,
            replaceValueFromSource(from_email, environment, tenant),
            replaceValueFromSource(from_name, environment, tenant),
            replaceValueFromSource(reply_to, environment, tenant),
            ccTo,
            bccTo,
            attachmentFiles,
            projectId,
            environment,
            encryption,
          );
        } else if (emailServicePlugin === 'RESEND') {
          trackerCollectionName = 'resend_activity_tracker';
          const resendPlugin = await findInstalledPlugin(projectId, pluginCode.RESEND);
          if (!resendPlugin) return pluginNotInstalledMessage('Resend');
          const { apiKey, from_email, from_name } = resendPlugin.setting;
          sendEmailStats = await sendEmailUsingResend(
            projectId,
            environment,
            encryption,
            replaceValueFromSource(apiKey, environment, tenant),
            replaceValueFromSource(from_name, environment, tenant),
            replaceValueFromSource(from_email, environment, tenant),
            sendTo,
            emailSubject,
            emailBody,
            attachmentFiles,
            ccTo,
            bccTo,
          );
        } else {
          trackerCollectionName = 'aws_ses_activity_tracker';
          const { config, fromEmailAndName, replyTo } = await loadSESPluginConfig(
            projectId,
            environment,
            tenant,
          );
          sendEmailStats = await sendEmailUsingSes(
            config,
            sendTo,
            emailSubject,
            emailBody,
            fromEmailAndName,
            replyTo,
            ccTo,
            bccTo,
            attachmentFiles,
            projectId,
            environment,
            encryption,
          );
        }
        messages.push({
          templateId,
          sender: user,
          itemId: eventItemConfig?.dataItemId || '',
          sendTo,
          ccTo,
          bccTo,
          emailSubject,
          emailBody,
          status: 'success',
          emailServicePlugin,
          ...sendEmailStats,
        });
      } catch (error) {
        console.error(`Failed to process template rule with ID ${templateId}:`, error.message);
        messages.push({
          templateId,
          sender: user,
          itemId: eventItemConfig?.dataItemId || '',
          sendTo,
          ccTo,
          bccTo,
          emailSubject,
          emailBody,
          status: 'failure',
          emailServicePlugin,
          error: error.message,
        });
      }
      await handleEmailActivityTrackers(
        db,
        projectId,
        enableAuditTrail,
        headers,
        messages,
        user,
        emailSubject,
        emailBody,
        trackerCollectionName,
        environment,
      );
    }
    const allSucceeded = messages.every((msg) => msg.status === 'success');
    if (!allSucceeded) {
      return {
        code: 500,
        status: 'failure',
        message: 'One or more email sends failed.',
        results: messages,
      };
    }
    return {
      code: 200,
      status: 'success',
      message: 'All emails sent successfully.',
      results: messages,
    };
  } catch (error) {
    console.error('Error in sendDynamicEmailService:', error);
    return { code: 500, message: 'Internal Server Error', status: 'failure' };
  }
};

export const getItemIdForTemp = (getItemIdFrom, eventItemConfig, sendToPropagate = false) => {
  let itemIdForTemplate = '';
  const { dataItemId, previousStepId, propagateItemId } = eventItemConfig;
  if (!getItemIdFrom) {
    itemIdForTemplate = sendToPropagate ? propagateItemId : dataItemId;
  } else {
    switch (getItemIdFrom) {
      case 'previousResponse':
        itemIdForTemplate = previousStepId;
        break;
      case 'sendToPropagate':
        itemIdForTemplate = propagateItemId;
        break;
      case 'collectionUuid':
      default:
        itemIdForTemplate = dataItemId ? dataItemId : previousStepId;
        break;
    }
  }
  return itemIdForTemplate;
};

export const getEmailAddressesToSendEmail = (
  emailFields,
  itemDataOfTemplateCollection,
  projectConstants,
  user,
) => {
  let emailAddresses = [];
  emailFields.forEach((field) => {
    const { fieldFrom, fieldName, name } = JSON.parse(field);
    let emailFieldValue = '';
    if (fieldFrom === 'collection') {
      emailFieldValue = parseValueFromData(itemDataOfTemplateCollection, fieldName);
    } else if (fieldFrom === 'projectConstant' && name) {
      const emailConstant = projectConstants ? projectConstants.find((e) => e.name === name) : '';
      emailFieldValue = emailConstant?.value;
    } else if (fieldFrom === 'session' && user) {
      emailFieldValue = parseValueFromData(user, fieldName);
    }

    if (emailFieldValue && typeof emailFieldValue === 'string') {
      emailAddresses.push(emailFieldValue);
    }
  });
  return emailAddresses;
};

const attachmentHandlingInEmail = async (attachmentFiles, projectId, environment, encryption) => {
  try {
    const s3Plugin = await loadS3PluginConfig(projectId, environment);
    const { region, accessKeyId, secretAccessKey, bucket } = s3Plugin;
    const awsConfig = {
      region: region,
      accessKey: accessKeyId,
      accessSecret: secretAccessKey,
    };
    const s3client = createS3Client(awsConfig);
    let attachments = [];
    for (const file of attachmentFiles) {
      const { key, originalName, contentType, isEncrypted } = file;
      try {
        const s3Params = {
          Bucket: bucket,
          Key: key,
        };
        const { Body } = await s3client.send(new GetObjectCommand(s3Params));
        let fileBuffer = await Body.transformToByteArray();
        if (isEncrypted) {
          const keyParts = key.split('/');
          const encryptedFilePath = `${process.env.FILE_UPLOAD_PATH}${
            keyParts[keyParts.length - 1]
          }.enc`;
          await fs.promises.writeFile(encryptedFilePath, fileBuffer);
          const result = await cryptFile(encryptedFilePath, encryption, true);
          fs.unlinkSync(encryptedFilePath);
          const data = await fs.promises.readFile(result);
          if (data) {
            fileBuffer = data;
            fs.unlinkSync(result);
          }
        }
        const attachment = {
          filename: originalName,
          content: Buffer.from(fileBuffer).toString('base64'),
          encoding: 'base64',
          contentType: contentType || 'application/octet-stream',
        };
        attachments.push(attachment);
      } catch (error) {
        console.error(`Error fetching file from S3 (Key: ${key}):`, error.message);
      }
    }
    return attachments;
  } catch (error) {
    console.error('Error in attachmentHandlingInEmail function:', error.message);
    throw new Error('Error processing email attachments.');
  }
};

export const sendEmailUsingSendGrid = async (
  apiKey,
  toEmail,
  subject,
  htmlBody,
  fromEmail,
  fromName,
  replyTo = null,
  ccTo = null,
  bccTo = null,
  attachmentFiles = [],
  projectId,
  environment,
  encryption,
) => {
  try {
    const to = Array.isArray(toEmail) ? toEmail : [toEmail];
    const cc = ccTo ? (Array.isArray(ccTo) ? ccTo : [ccTo]) : undefined;
    const bcc = bccTo ? (Array.isArray(bccTo) ? bccTo : [bccTo]) : undefined;
    sgMail.setApiKey(apiKey);
    let attachments = [];
    if (attachmentFiles && attachmentFiles.length > 0) {
      attachments = await attachmentHandlingInEmail(
        attachmentFiles,
        projectId,
        environment,
        encryption,
      );
    }
    const email = {
      to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject,
      html: htmlBody,
      cc,
      bcc,
      attachments: attachments.map((file) => ({
        content: file.content,
        filename: file.filename,
        type: file.contentType,
        disposition: 'attachment',
      })),
    };
    if (replyTo) {
      email.replyTo = replyTo;
    }
    const [response] = await sgMail.send(email);
    const messageId = response.headers['x-message-id'] || '';
    return { sentEmailId: messageId, status: 'success', code: 200 };
  } catch (error) {
    console.error('Failed to send email via SendGrid:', error.message);
    return { status: 'failure', error: error.message, code: 500 };
  }
};

export const sendEmailUsingResend = async (
  projectId,
  environment,
  encryption,
  apiKey,
  fromName,
  fromEmail,
  to,
  subject,
  content,
  attachmentFiles = [],
  cc = null,
  bcc = null,
) => {
  try {
    let attachments = [];
    if (attachmentFiles && attachmentFiles.length > 0) {
      attachments = await attachmentHandlingInEmail(
        attachmentFiles,
        projectId,
        environment,
        encryption,
      );
    }
    const emailPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: normalizeEmails(to),
      subject,
      html: content,
      attachments: attachments.map(({ filename, content }) => ({
        filename,
        content,
      })),
    };
    const ccList = normalizeEmails(cc);
    if (ccList.length) emailPayload.cc = ccList;
    const bccList = normalizeEmails(bcc);
    if (bccList.length) emailPayload.bcc = bccList;
    const response = await axios.post('https://api.resend.com/emails', emailPayload, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response) {
      if (response.data && response.data.id && response.status === 200) {
        return { sentEmailId: response.data.id, status: 'success', code: 200 };
      } else {
        return {
          status: 'failure',
          error: response?.data?.error || 'Some error occured',
          code: response.status,
        };
      }
    } else {
      return { status: 'failure', error: 'Response not received from Resend', code: 500 };
    }
  } catch (error) {
    console.error('Error in sendEmailUsingResend', error);
    if (error.response) {
      return {
        status: 'failure',
        code: error.response.status,
        error: error.response.data?.message || error.response.data?.error || 'Resend API error',
      };
    }
    if (error.request) {
      return {
        status: 'failure',
        code: 500,
        error: 'No response received from Resend API',
      };
    }
    return {
      status: 'failure',
      code: 500,
      error: `Unexpected error: ${error.message}`,
    };
  }
};

export const normalizeEmails = (emails) => {
  if (!emails) return [];
  return Array.isArray(emails) ? emails : [emails];
};

export const handleEmailActivityTrackers = async (
  db,
  projectId,
  enableAuditTrail,
  headers,
  response,
  user,
  emailSubject,
  emailBody,
  trackerCollectionName,
  environment,
) => {
  response = response[0];
  const collectionData = await findOneCollectionService(projectId, trackerCollectionName);
  if (!collectionData) return;
  const normalizedSendTo = normalizeEmails(response.sendTo);
  const normalizedCcTo = normalizeEmails(response.ccTo);
  const normalizedBccTo = normalizeEmails(response.bccTo);
  const itemData = {
    senderId: user?.uuid || '',
    sender: user?.userName || '',
    receiver: normalizedSendTo.join(','),
    bcc: normalizedBccTo.join(','),
    cc: normalizedCcTo.join(','),
    emailSentStatus: response?.status || '',
    contentLength: emailBody?.length || '',
    errorMessage: response?.error || '',
    templateId: response?.templateId || '',
    subject: emailSubject || '',
  };
  await saveCollectionItem(
    db,
    projectId,
    enableAuditTrail,
    collectionData,
    itemData,
    user,
    headers,
    environment,
  );
};
