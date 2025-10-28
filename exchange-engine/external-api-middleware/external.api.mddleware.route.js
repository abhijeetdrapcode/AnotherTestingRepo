import express from 'express';
import {
  saveExternalApiMiddleware,
  findExternalApiMiddleware,
  getCollectionItemsOfExternalApiMiddleware,
} from './external.api.middleware.controller';

const externalApiMiddlewareRoute = express.Router();

externalApiMiddlewareRoute.get('/:externalApiMiddlewareId', findExternalApiMiddleware);
externalApiMiddlewareRoute.post('/', saveExternalApiMiddleware);
externalApiMiddlewareRoute.get(
  '/:externalApiMiddlewareId/collection-items',
  getCollectionItemsOfExternalApiMiddleware,
);

export default externalApiMiddlewareRoute;
