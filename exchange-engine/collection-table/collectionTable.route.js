import express from 'express';
import {
  collectionTableItems,
  collectionTableFilterItemCount,
  collectionTableFilterItems,
  findOneItem,
  exportFilterItems,
} from './collectionTable.controller';

const collectionTableRoute = express.Router();
collectionTableRoute.get('/:collectionName/items/', collectionTableItems);
collectionTableRoute.post('/:collectionName/itemList', collectionTableItems);
collectionTableRoute.get('/:collectionName/item/:itemId', findOneItem);
collectionTableRoute.get('/:collectionName/finder/:filterId/items/', collectionTableFilterItems);
collectionTableRoute.get(
  '/:collectionName/finder/:filterId/items/count',
  collectionTableFilterItemCount,
);
collectionTableRoute.post('/:collectionName/finder/:filterId/export-data', exportFilterItems);

export default collectionTableRoute;
