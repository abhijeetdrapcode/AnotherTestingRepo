import express from 'express';
import devAuthorize from '../middleware/devAuth.middleware';
import verifyToken from '../middleware/verifyToken.middleware';
import verifyBuilderKey from '../middleware/verifyBuilder.middleware';
import { verifyJwtForOpen } from '../loginPlugin/jwtUtils';
import {
  createBulkItem,
  deleteItem,
  findAllUpdatedItems,
  getFileBuffer,
  updateFileObject,
  updateItem,
} from './dev.controller';
import { fileUploadToServer } from '../upload-api/upload.controller';
import { cryptItemData } from '../middleware/encryption.middleware';
import { getAllTypesenseIndexedData } from '../typesense-search/typesenseSearch.controller';
const commonDevRouter = express.Router();

/**
 * @openapi
 * /v1/developer/collection/{collectionName}/item/{itemUuid}:
 *  delete:
 *      tags: [Collection Item]
 *      summary: Deletes a record from the collection identified by its item UUID.
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: itemUuid
 *          type: string
 *          required: true
 *          description: Item unique id to get details
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been deleted
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 * /v2/developer/collection/{collectionName}/item/{itemUuid}:
 *  delete:
 *      tags: [Collection Item]
 *      summary: Deletes a record from the collection identified by its item UUID.
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: itemUuid
 *          type: string
 *          required: true
 *          description: Item unique id to get details
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been deleted
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 */
commonDevRouter.delete(
  '/collection/:collectionName/item/:itemUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  deleteItem,
);

/**
 *
 * Extras
 */

commonDevRouter.get(
  '/get-file-buffer/:collectionName/:fileObjectUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  getFileBuffer,
);
commonDevRouter.get(
  '/typesense-search/get-all-indexed-data/:typesenseCollectionName/:filterId?',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  getAllTypesenseIndexedData,
);

commonDevRouter.put(
  '/updateFileObject/:collectionName/:fileObjectUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  updateFileObject,
);

/**
 * @openapi
 * /v1/developer/upload/{collectionName}/{fieldId}:
 *  post:
 *      tags: [Collection Item]
 *      summary: Uploads a file to the specified field in the collection.
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      requestBody:
 *         required: true
 *         content:
 *            multipart/form-data:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection.
 *        - in: path
 *          name: fieldId
 *          type: string
 *          required: true
 *          description: Name of Collection Field.
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been created
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 * /v2/developer/upload/{collectionName}/{fieldId}:
 *  post:
 *      tags: [Collection Item]
 *      summary: Uploads a file to the specified field in the collection.
 *      description: v2 Active (LTS)
 *      requestBody:
 *         required: true
 *         content:
 *            multipart/form-data:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection.
 *        - in: path
 *          name: fieldId
 *          type: string
 *          required: true
 *          description: Name of Collection Field.
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been created
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 */
commonDevRouter.post(
  '/upload/:collectionId/:fieldId',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  fileUploadToServer,
);
commonDevRouter.get(
  '/collection/:collectionName/updated-items',
  verifyBuilderKey,
  verifyToken,
  findAllUpdatedItems,
);

/**
 * @openapi
 * /v1/developer/collection/{collectionName}/item/{itemUuid}:
 *  put:
 *      tags: [Collection Item]
 *      summary: Update an item of a collection.
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   ids:
 *                     type: string
 *                 example:
 *                     ids: 8bf7f496-9aac-4075-9961-fab035ff90e1
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: itemUuid
 *          type: string
 *          required: true
 *          description: Item unique id to get details
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been updated
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 * /v2/developer/collection/{collectionName}/item/{itemUuid}:
 *  put:
 *      tags: [Collection Item]
 *      summary: Update an item of a collection.
 *      description: v2 Active (LTS)
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   ids:
 *                     type: string
 *                 example:
 *                     ids: 8bf7f496-9aac-4075-9961-fab035ff90e1
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: itemUuid
 *          type: string
 *          required: true
 *          description: Item unique id to get details
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Item has been updated
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 */
commonDevRouter.put(
  '/collection/:collectionName/item/:itemUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  cryptItemData,
  updateItem,
);

/**
 * @openapi
 * /v1/developer/collection/{collectionName}/bulk/:
 *  post:
 *      tags: [Collection Item]
 *      summary: Create bulk record in a collection
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      requestBody:
 *         required: true
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: body
 *          name: items
 *          description: Send items in body
 *          schema:
 *            type: object
 *            required:
 *              - items
 *              - primaryKey
 *            properties:
 *              items:
 *                type: array
 *                items:
 *                  type: object
 *              primaryKey:
 *                type: string
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Items have been created
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 * /v2/developer/collection/{collectionName}/bulk/:
 *  post:
 *      tags: [Collection Item]
 *      summary: Create bulk record in a collection
 *      description: v2 Active (LTS)
 *      requestBody:
 *         required: true
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: body
 *          name: items
 *          description: Send items in body
 *          schema:
 *            type: object
 *            required:
 *              - items
 *              - primaryKey
 *            properties:
 *              items:
 *                type: array
 *                items:
 *                  type: object
 *              primaryKey:
 *                type: string
 *        - in: header
 *          name: x-api-key
 *          description: Developer API Key generated from Project Setting
 *          required: false
 *          type: string
 *          value: A7E34-4E41-4591-9ED4
 *        - in: header
 *          name: Authorization
 *          description: User authentication/authorization token generated after user login
 *          required: false
 *          type: string
 *          value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
 *      responses:
 *          200:
 *              description: Items have been created
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *                          properties:
 *                            code:
 *                              type: number
 *                            data:
 *                              type: object
 *          404:
 *              description: No Collection Found
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          401:
 *              description: Not a valid token.
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          422:
 *              description: Required Params is missing
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 *          403:
 *              description: Not Authorized to perform this action
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                      code:
 *                        type: number
 */
commonDevRouter.post(
  '/collection/:collectionName/bulk/',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  createBulkItem,
);
commonDevRouter.get('/status', (req, res) => {
  const baseUrl = req.baseUrl; // e.g. "/api/v1/developer"
  const versionMatch = baseUrl.match(/\/api\/(v\d+)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  if (version === 'v1') {
    // Old behavior
    return res.json({
      status: 'ok',
      message: 'Developer API (legacy v1)',
      service: 'developer-api',
      timestamp: Date.now(),
    });
  }

  if (version === 'v2') {
    // New behavior (breaking change)
    return res.json({
      status: 'ok',
      message: 'Developer API (LTS)',
      service: 'developer-api',
      version: '2.0',
      uptime: process.uptime(),
    });
  }

  // fallback for unknown versions
  return res.status(400).json({ error: 'Unsupported API version' });
});
export default commonDevRouter;
