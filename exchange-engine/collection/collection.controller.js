import { AppError } from 'drapcode-utility';
import { checkUniqueValidationFromCollection } from '../item/item.service';
import { findOneCollectionService } from './collection.service';
import { createProfilerService, updateProfilerService } from '../profiling/profiler.service';
import { v4 as uuidv4 } from 'uuid';
import { API } from '../utils/enums/ProfilerType';
import { collectionFromRedis } from 'drapcode-redis';

export const findByName = async (req, res, next) => {
  const { db, projectId, params, enableProfiling } = req;
  const apiEnterUuid = uuidv4();
  try {
    const { collectionName } = params;
    createProfilerService(
      db,
      projectId,
      enableProfiling,
      apiEnterUuid,
      API,
      `COLLECTION -> findByName`,
      {
        collectionName,
      },
    );

    const redisResult = await collectionFromRedis(projectId);
    let collection = null;
    if (Array.isArray(redisResult) && redisResult.length > 0) {
      collection = redisResult.find((item) => item.collectionName === collectionName);
    }
    if (!collection) {
      collection = await findOneCollectionService(projectId, collectionName);
    }
    if (!collection) {
      return next(new AppError(`No collection data has found for ${collectionName}`, 500));
    }
    updateProfilerService(db, projectId, enableProfiling, apiEnterUuid);
    return res.send(collection);
  } catch (err) {
    next(err);
  }
};

export const findById = async (req, res, next) => {
  const { db, projectId, params, enableProfiling } = req;
  const apiEnterUuid = uuidv4();
  try {
    const { uuid } = params;
    createProfilerService(
      db,
      projectId,
      enableProfiling,
      apiEnterUuid,
      API,
      `COLLECTION -> findById`,
      {
        collectionId: uuid,
      },
    );
    const result = await findOneCollectionService(projectId, uuid);
    updateProfilerService(db, projectId, enableProfiling, apiEnterUuid);
    if (result) {
      return res.send(result);
    } else {
      next(new AppError(`No collection data has found for ${uuid}`, 500));
    }
  } catch (err) {
    next(err);
  }
};

export const checkUniqueValidation = async (req, res) => {
  const { query, db, params } = req;
  const { collectionName } = params;
  const result = await checkUniqueValidationFromCollection(db, collectionName, query);
  res.status(200).send(`${result}`);
};
