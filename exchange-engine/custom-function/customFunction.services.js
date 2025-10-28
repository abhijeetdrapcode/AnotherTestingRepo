import { v4 as uuidv4 } from 'uuid';
import openwhisk from 'openwhisk';
import { findProjectByQuery } from '../project/project.service';
import {
  // drapcodeEncryptDecrypt,
  processDataEncryptionDecryption,
  processKMSDecryption,
} from 'drapcode-utility';

export const fetchAndSaveFunctionLogs = async (
  db,
  projectId,
  functionUUID,
  actionName,
  currentEnv,
) => {
  try {
    console.log('Creating openwhisk connection');
    const ow = openwhisk({
      apihost: process.env.OPENWHISK_API_HOST || 'YOUR_API_HOST',
      api_key: process.env.OPENWHISK_API_KEY || 'YOUR_API_KEY',
      namespace: 'guest',
    });
    console.log('Connection Established');
    const [latestActivation] = await ow.activations.list({
      name: actionName,
      limit: 1,
    });

    if (!latestActivation?.activationId) {
      throw new Error('No recent activation found for this function.');
    }
    console.log('We have resent activity');
    const activation = await ow.activations.get({
      activationId: latestActivation.activationId,
    });

    let logs = activation.logs || [];

    console.log('Load Project Detail');
    const projectDetail = await findProjectByQuery(projectId);
    const { encryptions, enableEncryption, encryptionType } = projectDetail;
    if (!enableEncryption) {
      console.warn('Encryption is not enabled. Logs will be stored unencrypted.');
      return await saveCustomFunctionLogs(
        db,
        projectId,
        functionUUID,
        actionName,
        activation,
        logs,
        false,
        currentEnv,
      );
    }

    const encryption = Array.isArray(encryptions)
      ? encryptions.find((enc) => enc.envType === currentEnv)
      : null;

    if (!encryption) {
      return await saveCustomFunctionLogs(
        db,
        projectId,
        functionUUID,
        actionName,
        activation,
        logs,
        false,
        currentEnv,
      );
    }

    console.log('These are the selectedEncryption: ', encryption);
    console.log('I have encryption');

    try {
      //TODO: Commenting this line for now
      //Because we already doing this when publish
      // if (encryption.isDataKeyEncrypted) {
      //   const result = await drapcodeEncryptDecrypt(encryption.dataKey, false);
      //   if (result.status === 'SUCCESS') {
      //     encryption.dataKey = result.data;
      //   } else {
      //     return await saveCustomFunctionLogs(
      //       db,
      //       projectId,
      //       functionUUID,
      //       actionName,
      //       activation,
      //       logs,
      //       false,
      //       currentEnv,
      //     );
      //   }
      // }

      if (encryptionType === 'KMS') {
        const plainTextData = await processKMSDecryption(
          encryption.awsConfig,
          encryption.dataKey,
          {},
        );
        if (plainTextData.status === 'FAILED') {
          return await saveCustomFunctionLogs(
            db,
            projectId,
            functionUUID,
            actionName,
            activation,
            logs,
            false,
            currentEnv,
          );
        }

        encryption.dataKey = plainTextData.data;
        //TODO: Check IV value
        console.log('encryption :>> ', encryption);
      }

      logs = await processDataEncryptionDecryption(logs, encryption, false);
      return await saveCustomFunctionLogs(
        db,
        projectId,
        functionUUID,
        actionName,
        activation,
        logs,
        true,
        currentEnv,
      );
    } catch (encryptionError) {
      console.warn(
        'Encryption was enabled but failed, storing logs without encryption:',
        encryptionError.message,
      );
    }
  } catch (error) {
    console.error('Error in fetchAndSaveFunctionLogs:', error.message);
    throw error;
  }
};

const saveCustomFunctionLogs = async (
  db,
  projectId,
  functionUUID,
  actionName,
  activation,
  logs,
  isEncrypted,
  currentEnv,
) => {
  const logEntry = {
    uuid: uuidv4(),
    functionUUID,
    projectId,
    actionName,
    activationId: activation.activationId,
    logs,
    isEncrypted,
    environment: currentEnv,
    date: new Date(),
  };

  await db.collection('customFunctionLogs').insertOne(logEntry);
  return {
    message: 'Logs saved successfully.',
    logEntry,
  };
};

export const fetchFunctionLogsByUUID = async (projectId, functionUUID, db) => {
  try {
    const logs = await db
      .collection('customFunctionLogs')
      .find({ projectId, functionUUID })
      // .sort({ date: 1 })
      .toArray();
    // console.log('These a re the logs: ', logs);
    return {
      message: 'Logs fetched successfully.',
      count: logs.length,
      logs,
      environment: logs.environment,
    };
  } catch (error) {
    console.error('Error in fetchFunctionLogsByUUID:', error.message);
    throw error;
  }
};
