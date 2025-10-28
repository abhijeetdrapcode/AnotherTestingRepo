import express from 'express';
import {
  saveItemInMetaDataTable,
  updateItemInMetaDataTable,
  deleteItemInMetaDataTable,
  mapAllDataInMetaDataTable,
} from './metaDataMapping.controller';
import { cryptItemData } from '../middleware/encryption.middleware';
const metaDataMappingRouter = express.Router();

metaDataMappingRouter.post('/save-item', saveItemInMetaDataTable);
metaDataMappingRouter.put('/update-item/:collectionName', cryptItemData, updateItemInMetaDataTable);
metaDataMappingRouter.post('/delete-item', deleteItemInMetaDataTable);
metaDataMappingRouter.post('/map-all-data', mapAllDataInMetaDataTable);

export default metaDataMappingRouter;
