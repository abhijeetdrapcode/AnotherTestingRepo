import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { findTemplate } from '../email-template/template.service';
import {
  checkCollectionByName,
  findOneCollectionService,
  userCollectionService,
} from '../collection/collection.service';
import { findItemById, saveCollectionItem } from '../item/item.service';
import { getItemIdForTemp, replaceFieldsIntoTemplate } from '../email/email.service';
import { parseValueFromData } from 'drapcode-utility';
import { emitToTenant, emitToUser } from './socketManager';
import { cryptService } from '../middleware/encryption.middleware';
import { pluginNotInstalledMessage } from '../utils/appUtils';

export const sendDynamicSocketService = async (
  body,
  db,
  projectId,
  enableAuditTrail,
  headers,
  user,
  environment,
) => {
  const trackerCollection = await checkCollectionByName(projectId, 'socket_io_activity_tracker');
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
    const socketPlugin = await findInstalledPlugin(projectId, pluginCode.SOCKET_IO);
    if (!socketPlugin) return pluginNotInstalledMessage('Socket IO');

    if (!templatesRules || !templatesRules.length) {
      return { code: 400, message: 'No templates rules provided' };
    }
    const userCollection = await userCollectionService(projectId);
    let currentUser = {};
    if (user?.uuid) {
      const userData = await findItemById(db, projectId, userCollection, user.uuid, null);
      currentUser = userData?.data || {};
      currentUser = await cryptService(currentUser, projectId, userCollection, true, false, true);
    }
    const results = [];
    for (const templateRule of templatesRules) {
      const { templateId, userIdFields, getItemIdFrom, notificationType } = templateRule;
      try {
        const templateResponse = await findTemplate(projectId, templateId);
        if (!templateResponse) {
          results.push({ templateId, code: 404, message: `Template ${templateId} not found.` });
          continue;
        }
        const collectionName = templateResponse.collectionId;
        if (!collectionName) {
          results.push({
            templateId,
            code: 400,
            message: `Collection name not found for template ${templateId}.`,
          });
          continue;
        }
        const itemIdForTemplate = getItemIdForTemp(getItemIdFrom, eventItemConfig);
        let itemDataOfTemplateCollection = {};
        const templateCollection = await findOneCollectionService(projectId, collectionName);
        if (!templateCollection) {
          results.push({
            templateId,
            code: 404,
            message: `Collection ${collectionName} not found for template ${templateId}.`,
          });
          continue;
        }
        itemDataOfTemplateCollection =
          (await findItemById(db, projectId, templateCollection, itemIdForTemplate, null))?.data ||
          {};
        itemDataOfTemplateCollection = await cryptService(
          itemDataOfTemplateCollection,
          projectId,
          templateCollection,
          true,
          false,
          true,
        );
        let socketIoContent = replaceFieldsIntoTemplate(
          templateResponse?.content,
          itemDataOfTemplateCollection,
          currentUser,
          environment,
          templateCollection,
          userCollection,
          browserStorageDTO,
        );
        socketIoContent = socketIoContent.replace(/(\r?\n)+$/g, '');
        if (notificationType === 'alert') {
          socketIoContent = socketIoContent.replace(/<[^>]*>/g, '');
        }
        const data = { socketIoContent, notificationType };
        const sendTo = getUserIdToSendSocket(userIdFields, itemDataOfTemplateCollection, user);
        if (sendTo?.length) {
          for (const userId of sendTo) {
            try {
              emitToUser(userId, 'socket-message', data);
            } catch (emitError) {
              console.error(`Failed to emit to user ${userId}:`, emitError.message);
            }
          }
          results.push({ templateId, code: 200, message: 'Message sent successfully.' });
          await handleSocketIOActivityTracker(
            db,
            projectId,
            enableAuditTrail,
            headers,
            environment,
            user,
            sendTo.join(','),
            'Success',
            '',
            socketIoContent,
            trackerCollection,
            templateId,
          );
        } else {
          results.push({ templateId, code: 204, message: 'No users to send message to.' });
          await handleSocketIOActivityTracker(
            db,
            projectId,
            enableAuditTrail,
            headers,
            environment,
            user,
            '',
            'No Recipients',
            '',
            socketIoContent,
            trackerCollection,
            templateId,
          );
        }
      } catch (err) {
        console.error(`Error processing templateId ${templateRule.templateId}:`, err.message);
        results.push({
          templateId: templateRule.templateId,
          code: 500,
          message: 'Failed to process template.',
        });
        await handleSocketIOActivityTracker(
          db,
          projectId,
          enableAuditTrail,
          headers,
          environment,
          user,
          '',
          'Failed',
          err.message,
          '',
          trackerCollection,
          templateId,
        );
      }
    }
    const allSuccess = results.every((res) => res.code === 200 || res.code === 204);
    if (allSuccess) {
      return { code: 200, message: 'All Socket IO notifications sent successfully.', results };
    } else {
      const firstError = results.find((res) => res.code !== 200);
      return {
        code: firstError?.code || 500,
        message: 'One or more socket notifications failed.',
        results,
      };
    }
  } catch (error) {
    console.error('Error in sendDynamicSocketService:', error);
    await handleSocketIOActivityTracker(
      db,
      projectId,
      enableAuditTrail,
      headers,
      environment,
      user,
      '',
      'Failed',
      error.message,
      '',
      trackerCollection,
      '',
    );
    return { code: 500, message: 'Internal Server Error' };
  }
};

export const getUserIdToSendSocket = (userIdFields, itemDataOfTemplateCollection, user) => {
  let userIds = [];
  userIdFields.forEach((field) => {
    const { fieldFrom, fieldName } = JSON.parse(field);
    let userIdFieldValue = '';
    if (fieldFrom === 'collection') {
      userIdFieldValue = parseValueFromData(itemDataOfTemplateCollection, fieldName);
    } else if (fieldFrom === 'session' && user) {
      userIdFieldValue = parseValueFromData(user, fieldName);
    }
    if (userIdFieldValue && typeof userIdFieldValue === 'string') {
      userIds.push(userIdFieldValue);
    }
  });
  return userIds;
};

export const handleSocketIOActivityTracker = async (
  db,
  projectId,
  enableAuditTrail,
  headers,
  environment,
  user,
  recipient,
  status,
  error,
  socketIoContent,
  trackerCollection,
  templateId,
) => {
  if (!trackerCollection) return;
  const itemData = {
    senderId: user.uuid,
    sender: user.userName,
    receiver: recipient,
    notificationSentStatus: status,
    notification: socketIoContent,
    errorMessage: error,
    templateId: templateId,
  };
  await saveCollectionItem(
    db,
    projectId,
    enableAuditTrail,
    trackerCollection,
    itemData,
    user,
    headers,
    environment,
  );
};

export const handleSocketCollectionCommunication = async (
  projectId,
  currentUser,
  currentTenantId,
  collectionName,
  event,
  socketData,
) => {
  if (!currentUser) return { code: 400, message: 'No Logged in User' };
  const socketPlugin = await findInstalledPlugin(projectId, pluginCode.SOCKET_IO);
  if (!socketPlugin) return pluginNotInstalledMessage('Socket IO');
  const { socketCollections } = socketPlugin.setting;
  if (!socketCollections.includes(collectionName))
    return { code: 204, message: 'Collection not configured for socket communication' };
  const dataToSend = { collectionName, socketData };
  if (currentTenantId) {
    emitToTenant(currentTenantId, event, dataToSend);
  } else {
    emitToUser(null, event, dataToSend);
  }
  return { code: 200, message: 'Socket event triggered' };
};
