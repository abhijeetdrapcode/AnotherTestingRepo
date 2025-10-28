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
  nlpAnonymization,
  customTermsAnonymization,
} from './collectionForm.controller';
import { cryptItemData } from '../middleware/encryption.middleware';
import { bulkDelete } from '../developer/v1/dev1.controller';

const collectionFormOpenRoute = express.Router();
collectionFormOpenRoute.post('/:collectionName/items', cryptItemData, createItem);
collectionFormOpenRoute.post('/import-from-csv/:collectionName', cryptItemData, importFromCSV);
collectionFormOpenRoute.put('/:collectionName/items/:itemId', cryptItemData, update);
collectionFormOpenRoute.put('/:collectionName/items/bulk/update', bulkUpdate);
collectionFormOpenRoute.delete('/:collectionName/items/:itemId', deleteItem);
collectionFormOpenRoute.post(
  '/:collectionName/items/constructor/:constructorId?',
  cryptItemData,
  createItem,
);
collectionFormOpenRoute.post(
  '/:collectionName/items/:itemId/fields/:collectionFieldId',
  addToItemField,
);
collectionFormOpenRoute.put(
  '/:collectionName/items/:itemId/fields/:collectionFieldId',
  removeFromItemField,
);
collectionFormOpenRoute.post(
  '/:collectionName/items/:itemId/pdf-text/:fieldForPdf/:fieldForText',
  pdfToTextField,
);
collectionFormOpenRoute.post('/:collectionName/items/bulkDelete', bulkDelete);
collectionFormOpenRoute.post(
  '/:collectionName/items/:itemId/anyfile-to-text/:fieldForPdf/:fieldForText',
  anyFileToText,
);
collectionFormOpenRoute.post(
  '/:collectionName/items/:itemId/nlp_anonymization/:fieldForSourceText/:fieldForAnonymizedText',
  nlpAnonymization,
);
collectionFormOpenRoute.post(
  '/:collectionName/items/:itemId/custom_terms_anonymization/:fieldForSourceText/:fieldForCustomTerms/:fieldForAnonymizedText',
  customTermsAnonymization,
);
export default collectionFormOpenRoute;
