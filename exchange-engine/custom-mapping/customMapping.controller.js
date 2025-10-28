import _ from 'lodash';
import { AppError, loadCustomMapping } from 'drapcode-utility';
import { customMappingFromRedis } from 'drapcode-redis';
import { findCollection } from '../collection/collection.service';
import { filterItemService } from '../item/item.service';
import { cryptService } from '../middleware/encryption.middleware';
import { executeExternalApiAndProcess } from '../external-api/external-api.service';
import { transformDataToMapping } from './customMapping.utils';
import { checkPermissionLevelSecurity } from '../item/item.utils';
import { extractUserSettingFromUserAndTenant } from '../middleware/tenant.middleware';

//TODO: Ali -> Handle browserStorageData and remove sessionValue,sessionFormValue
export const getCustomDataMapping = async (req, res, next) => {
  try {
    const {
      db,
      query,
      params,
      headers,
      dateFormat,
      tenant,
      user,
      project,
      environment,
      enableProfiling,
      body,
      enableAuditTrail,
      projectId,
      subTenant,
    } = req;
    const { uuid } = params;
    const { sessionValue, sessionFormValue, browserStorageDTO } = body;
    const { authorization } = headers;
    let customDataMapping = null;
    const redisResult = await customMappingFromRedis(projectId);
    if (Array.isArray(redisResult) && redisResult.length > 0) {
      customDataMapping = redisResult.find((item) => item.uuid === uuid);
    }
    if (!customDataMapping) {
      customDataMapping = loadCustomMapping(projectId, uuid);
    }
    if (!customDataMapping) throw AppError('Data Mapping with the id does not exist');

    const {
      type,
      collectionName,
      filter,
      externalApi,
      responsePath,
      mapping,
      decrypted,
      refArrayFormat,
    } = customDataMapping;
    const userSetting = await extractUserSettingFromUserAndTenant(db, projectId, user, tenant);
    const browserStorageData = {
      sessionValue,
      sessionFormValue,
      ...browserStorageDTO,
    };
    let finalData = [];
    if (type === 'COLLECTION') {
      let collection = await findCollection(projectId, collectionName, filter);
      if (!collection) throw AppError('Collection does not exist');

      let { result } = await filterItemService(
        db,
        projectId,
        collection,
        filter,
        query,
        authorization,
        project.timezone,
        headers,
        0,
        1,
        false,
        dateFormat,
        tenant,
        subTenant,
      );
      let encryptedResponse;
      if (result) {
        encryptedResponse = await cryptService(
          result,
          projectId,
          collection,
          true,
          false,
          decrypted,
        );
      }
      if (encryptedResponse) {
        if (encryptedResponse.status === 'FAILED') {
          return res.status(400).json(encryptedResponse);
        } else {
          result = encryptedResponse;
        }
      }
      const { permissionLevelSecurity = [] } = collection;
      if (permissionLevelSecurity && permissionLevelSecurity.length) {
        result = await checkPermissionLevelSecurity(
          db,
          projectId,
          authorization,
          permissionLevelSecurity,
          result,
        );
      }

      const collObj = {
        collectionFields: collection.fields,
        collectionDerivedFields: collection.utilities,
        collectionConstants: collection.constants,
      };
      finalData =
        mapping && mapping.length
          ? transformDataToMapping(
              result,
              mapping,
              collObj,
              user,
              tenant,
              userSetting,
              subTenant,
              sessionValue,
              sessionFormValue,
              environment,
              project.projectConstants,
              browserStorageData,
              refArrayFormat,
            )
          : result;
    } else if (type === 'EXTERNAL_API') {
      const bodyData = {
        externalApiId: externalApi,
        data: {},
        userRole: '',
        sessionValue,
        sessionFormValue,
        browserStorageDTO,
      };
      const response = await executeExternalApiAndProcess(
        db,
        projectId,
        enableAuditTrail,
        '',
        bodyData,
        project.projectConstants,
        user,
        tenant,
        userSetting,
        subTenant,
        environment,
        enableProfiling,
        false,
      );
      const { responseData, collection } = response;
      finalData =
        mapping && mapping.length
          ? transformDataToMapping(
              responseData,
              mapping,
              collection,
              user,
              tenant,
              userSetting,
              subTenant,
              sessionValue,
              sessionFormValue,
              environment,
              project.projectConstants,
              browserStorageData,
            )
          : responseData;
    }
    finalData = responsePath ? _.set({}, responsePath, finalData) : finalData;
    res.status(200).send(finalData);
  } catch (error) {
    console.error('get custom data mapping ~ error:', error);
    next(error);
  }
};
