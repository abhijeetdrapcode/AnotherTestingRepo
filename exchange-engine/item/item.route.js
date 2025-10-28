import express from 'express';
import {
  findAll,
  findOne,
  addItemFromBuilder,
  executeQueryFromBuilder,
  findAllForBuilder,
  findOneItemForBuilder,
  findUpdateItemForBuilder,
  removeAllItemFromBuilder,
  removeItemFromBuilder,
  saveItemsImportedFromCSVForBuilder,
  findAllByRegexForBuilder,
  fetchLastRecord,
  collectionTableFilterItems,
  exportFilterItems,
} from './item.controller';
import { validateBuilderAPI } from '../middleware/restrictBuilder.middleware';
import sessionValidate from '../middleware/sessionValidate.middleware';
const itemRouter = express.Router();

itemRouter.get('/:collectionName/collection', sessionValidate, findAll);
itemRouter.get('/:collectionName/item/:itemId', sessionValidate, findOne);

/**
 * Used in
 * Builder Engine
 */
itemRouter.get(
  '/builder/:collectionName/:finderId',
  validateBuilderAPI,
  collectionTableFilterItems,
);
itemRouter.post('/builder/:collectionName/collection/list', validateBuilderAPI, findAllForBuilder);
itemRouter.post('/builder/:collectionName/collection', addItemFromBuilder);
itemRouter.get(
  '/builder/:collectionName/collection/:itemId/item',
  validateBuilderAPI,
  findOneItemForBuilder,
);
itemRouter.post(
  '/builder/:collectionName/collection/last-record',
  validateBuilderAPI,
  fetchLastRecord,
);
itemRouter.post(
  '/builder/:collectionName/collection/query',
  validateBuilderAPI,
  executeQueryFromBuilder,
);
itemRouter.delete(
  '/builder/:collectionName/collection/:itemId/remove-item',
  validateBuilderAPI,
  removeItemFromBuilder,
);

itemRouter.put(
  '/builder/:collectionName/collection/:itemId/item',
  validateBuilderAPI,
  findUpdateItemForBuilder,
);
itemRouter.delete(
  '/builder/:collectionName/collection/clear-collection',
  validateBuilderAPI,
  removeAllItemFromBuilder,
);
itemRouter.post(
  '/builder/:collectionName/collection/import-from-csv',
  saveItemsImportedFromCSVForBuilder,
);

/**
 * Used in
 * Exchange Build Surface
 */
itemRouter.post(
  '/builder/:collectionName/collection/regex',
  sessionValidate,
  findAllByRegexForBuilder,
);
//TODO: Not used, find usage
itemRouter.get(
  '/builder/:collectionName/:finderId/export-data',
  validateBuilderAPI,
  exportFilterItems,
);

export default itemRouter;
