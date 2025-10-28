import express from 'express';
import {
  initializeTypesenseCollection,
  reindexAllData,
  deleteTypesenseCollection,
  searchTypesenseCollection,
  getAllTypesenseIndexedData,
} from './typesenseSearch.controller';

const typesenseSearchRouter = express.Router();

typesenseSearchRouter.post('/initialize', initializeTypesenseCollection);
typesenseSearchRouter.post('/reindex-data', reindexAllData);
typesenseSearchRouter.delete('/delete-collection/:collectionName', deleteTypesenseCollection);
typesenseSearchRouter.post('/search', searchTypesenseCollection);
typesenseSearchRouter.get(
  '/get-all-indexed-data/:typesenseCollectionName/:filterId?',
  getAllTypesenseIndexedData,
);

export default typesenseSearchRouter;
