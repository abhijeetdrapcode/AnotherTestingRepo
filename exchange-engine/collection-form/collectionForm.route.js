import express from 'express';
import {
  addToItemField,
  bulkUpdate,
  createItem,
  deleteItem,
  importFromCSV,
  pdfToTextField,
  removeFromItemField,
  update,
  anyFileToText,
} from './collectionForm.controller';
import { cryptItemData } from '../middleware/encryption.middleware';
import { bulkDelete } from '../developer/v1/dev1.controller';

const collectionFormRoute = express.Router();
collectionFormRoute.post('/:collectionName/items/', cryptItemData, createItem);
collectionFormRoute.put('/:collectionName/items/:itemId', cryptItemData, update);
collectionFormRoute.post('/import-from-csv/:collectionName', cryptItemData, importFromCSV);
collectionFormRoute.put('/:collectionName/items/bulk/update', bulkUpdate);
collectionFormRoute.delete('/:collectionName/items/:itemId', deleteItem);
collectionFormRoute.post(
  '/:collectionName/items/constructor/:constructorId?',
  cryptItemData,
  createItem,
);
collectionFormRoute.post(
  '/:collectionName/items/:itemId/fields/:collectionFieldId',
  addToItemField,
);
collectionFormRoute.put(
  '/:collectionName/items/:itemId/fields/:collectionFieldId',
  removeFromItemField,
);
collectionFormRoute.post(
  '/:collectionName/items/:itemId/pdf-text/:fieldForPdf/:fieldForText',
  pdfToTextField,
);
collectionFormRoute.post('/:collectionName/items/bulkDelete', bulkDelete);
collectionFormRoute.post(
  '/:collectionName/items/:itemId/anyfile-to-text/:fieldForPdf/:fieldForText',
  anyFileToText,
);
export default collectionFormRoute;
