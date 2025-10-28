import { dataViewLogs } from '../item/item.service';
import {
  initializeTypesenseCollectionService,
  reindexAllDataService,
  deleteTypesenseCollectionService,
  searchTypesenseCollectionService,
  getAllTypesenseIndexedDataService,
} from './typesenseSearch.service';

export const initializeTypesenseCollection = async (req, res, next) => {
  try {
    const { body, projectId, environment } = req;
    const { typesenseCollection } = body;
    if (!typesenseCollection) {
      return res.status(400).send({ message: 'Collection is required' });
    }
    const response = await initializeTypesenseCollectionService(
      projectId,
      environment,
      typesenseCollection,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in initializeTypesenseCollection :>> ', error);
    next(error);
  }
};

export const reindexAllData = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, tenant } = req;
    const { typesenseCollection, reIndexOnTheBasisOfTenant = false } = body;
    if (!typesenseCollection) {
      return res.status(400).send({ message: 'Collection is required' });
    }
    const response = await reindexAllDataService(
      db,
      projectId,
      environment,
      tenant,
      typesenseCollection,
      reIndexOnTheBasisOfTenant,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in reindexAllData :>> ', error);
    next(error);
  }
};

export const deleteTypesenseCollection = async (req, res, next) => {
  try {
    const { params, projectId, environment } = req;
    const { collectionName } = params;
    if (!collectionName) {
      return res.status(400).send({ message: 'Typesense Collection name is required.' });
    }
    const result = await deleteTypesenseCollectionService(projectId, environment, collectionName);
    return res.status(result.code).send(result);
  } catch (error) {
    console.error('Error in deleteTypesenseCollection:', error.message);
    next(error);
  }
};

export const searchTypesenseCollection = async (req, res, next) => {
  try {
    const { body, projectId, user, tenant, db, environment, query, subTenant } = req;
    const {
      typesenseCollection,
      searchQuery,
      typesenseFilter,
      resultsLimit,
      sortBy,
      sortOrder,
      page,
      searchBy,
    } = body;
    if (!typesenseCollection) {
      return res.status(400).send({ message: 'Typesense Collection name is required.' });
    }
    if (!searchQuery) {
      return res.status(400).send({ message: 'Search Query is required.' });
    }
    const searchResponse = await searchTypesenseCollectionService(
      db,
      projectId,
      user,
      tenant,
      subTenant,
      environment,
      typesenseCollection,
      searchQuery,
      typesenseFilter,
      query,
      resultsLimit,
      sortBy,
      sortOrder,
      page,
      searchBy,
    );
    return res.status(searchResponse.code).send(searchResponse);
  } catch (error) {
    console.error('Error in searchTypesenseCollection:', error.message);
    next(error);
  }
};

export const getAllTypesenseIndexedData = async (req, res, next) => {
  try {
    const { db, user, tenant, subTenant, query, params, projectId, environment, headers } = req;
    const { authorization } = headers;
    const { typesenseCollectionName, filterId } = params;
    if (!typesenseCollectionName) {
      return res.status(400).send({ message: 'Typesense Collection name is required.' });
    }
    const result = await getAllTypesenseIndexedDataService(
      db,
      projectId,
      environment,
      authorization,
      user,
      tenant,
      subTenant,
      query,
      typesenseCollectionName,
      filterId,
    );
    if (result.code === 200 && result.data) {
      dataViewLogs(req); //For Data View Activity Tracker Plugin
      return res.status(200).send(result.data); //For data table rendering
    } else return res.status(result.code).send(result);
  } catch (error) {
    console.error('Error in getAllTypesenseIndexedData:', error.message);
    next(error);
  }
};
