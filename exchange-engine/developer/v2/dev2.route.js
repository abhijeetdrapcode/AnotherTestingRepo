import express from 'express';
import { cryptItemData } from '../../middleware/encryption.middleware';
import { verifyJwtForOpen } from '../../loginPlugin/jwtUtils';
import devAuthorize from '../../middleware/devAuth.middleware';
import {
  addReferenceItem,
  bulkDelete,
  clearItem,
  countItemByField,
  countItemsByFilter,
  createItem,
  deleteFieldRecordFromItems,
  fetchUserDetails,
  findAllItems,
  findItemDetail,
  findItemOnly,
  findItemsByFilter,
  lastItem,
  processCSVData,
  removeReferenceItem,
  validateItem,
} from './dev2.controller';
import verifyToken from '../../middleware/verifyToken.middleware';
import verifyBuilderKey from '../../middleware/verifyBuilder.middleware';
const dev2Router = express.Router();

/**
 * @openapi
 * /v2/developer/collection/{collectionName}/items:
 *  post:
 *      tags: [Collection Item]
 *      summary: Add Item to a collection
 *      description: v2 Active (LTS)
 *      requestBody:
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
 *          400:
 *              description: Validation filed or missing field
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
 *              description: Invalid or missing token
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
 *          409:
 *              description: Unique constraint failed
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
 */
dev2Router.post(
  '/collection/:collectionName/items/',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  cryptItemData,
  createItem,
);
/**
 * @openapi
 * /v2/developer/collection/{collectionName}/items:
 *  get:
 *      tags: [Collection Item]
 *      summary: Return all items
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
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
 *        - in: query
 *          name: query
 *          schema:
 *            type: object
 *            additionalProperties:
 *               offset:
 *                 type: integer
 *                 description: 0
 *               max:
 *                 type: integer
 *                 description: 100
 *            example:
 *               "offset": "0"
 *               "max": "100"
 *               "fieldName1:EQUALS": "value"
 *               "fieldName2:IS_NOT_NULL": "value"
 *               "fieldName3:IS_NULL": "value"
 *               "fieldName4:LIKE": "value"
 *               "fieldName5:LESS_THAN_EQUALS_TO": "value"
 *               "fieldName6:GREATER_THAN_EQUALS_TO": "value"
 *               "fieldName7:LESS_THAN": "value"
 *               "fieldName8:GREATER_THAN": "value"
 *               "fieldName9:IN_LIST": ["value1", "value2"]
 *               "fieldName10:NOT_IN_LIST": ["value1", "value2"]
 *      responses:
 *          200:
 *              description: All Items in this collection
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *          400:
 *              description: Validation filed or missing field
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
 *              description: Invalid or missing token
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
 *          409:
 *              description: Unique constraint failed
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
 */
dev2Router.get(
  '/collection/:collectionName/items',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  findAllItems,
);

/**
 * @openapi
 * /v2/developer/collection/{collectionName}/itemsbyids:
 *  post:
 *      tags: [Collection Item]
 *      summary: Return all items according to ids or query
 *      description: v2 Active (LTS)
 *      requestBody:
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
 *        - in: query
 *          name: ids
 *          type: array
 *          collectionFormat: csv
 *          items:
 *            type: string
 *          required: false
 *          description: Optional send it in query or body
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
 *              description: Count of filtered items
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
 *          400:
 *              description: Validation filed or missing field
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
 *              description: Invalid or missing token
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
 *          409:
 *              description: Unique constraint failed
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
 */
dev2Router.post(
  '/collection/:collectionName/itemsbyids',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  findAllItems,
);

/**
 * @openapi
 * /v2/developer/collection/{collectionName}/item/{itemUuid}:
 *  get:
 *      tags: [Collection Item]
 *      summary: Get Item Details
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
 *              description: Item details
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *          400:
 *              description: Validation filed or missing field
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
 *              description: Invalid or missing token
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
 *          409:
 *              description: Unique constraint failed
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
 */
dev2Router.get(
  '/collection/:collectionName/item/:itemUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  findItemDetail,
);
dev2Router.get(
  '/collection/:collectionName/item-only/:itemUuid',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  findItemOnly,
);
dev2Router.post(
  '/collection/:collectionName/count-by-field',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  countItemByField,
);
dev2Router.post(
  '/collection/:collectionName/csv-items',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  processCSVData,
);
dev2Router.post(
  '/collection/:collectionName/validate-item',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  validateItem,
);
dev2Router.get(
  '/collection/:collectionName/last-item',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  lastItem,
);
dev2Router.delete(
  '/collection/:collectionName/clear-item',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  clearItem,
);
dev2Router.delete(
  '/collection/:collectionName/delete-field-record/:fieldName',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  deleteFieldRecordFromItems,
);
dev2Router.post(
  '/collection/:collectionName/add-reference',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  addReferenceItem,
);
dev2Router.post(
  '/collection/:collectionName/remove-reference',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  removeReferenceItem,
);

/**
 * @openapi
 * /v2/developer/collection/{collectionName}/items/constructor/:constructorId?:
 *  post:
 *      tags: [Collection Item]
 *      summary: Add Item to a collection
 *      description: v2 Active (LTS)
 *      requestBody:
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
 *        - in: path
 *          name: constructorId
 *          type: string
 *          required: false
 *          description: Name of Collection to get record
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
 *                            message:
 *                              type: string
 *                            status:
 *                              type: string
 *                            error:
 *                              type: string
 *          400:
 *              description: Validation filed or missing field
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
 *              description: Invalid or missing token
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
 *          409:
 *              description: Unique constraint failed
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
 */

dev2Router.post(
  '/collection/:collectionName/items/constructor/:constructorId?',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  createItem,
);

/**
 * @openapi
 * /v2/developer/collection/{collectionName}/filter/{filterUuid}/items:
 *  get:
 *      tags: [Collection Item]
 *      summary: Returns the records of a collection items according to the specified filter, identified by UUID.
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: filterUuid
 *          type: string
 *          required: true
 *          description: Unique Id of Collection Filter
 *        - in: query
 *          name: query
 *          schema:
 *            type: object
 *            additionalProperties:
 *               type: string
 *          style: form
 *          explode: true
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
 *              description: Filtered Items
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              code:
 *                                  type: number
 *                              message:
 *                                  type: string
 *                              result:
 *                                  type: object
 *                              count:
 *                                  type: number
 *          400:
 *              description: Failed to Save
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              message:
 *                                  type: string
 *                              code:
 *                                  type: number
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

dev2Router.get(
  '/collection/:collectionName/filter/:filterUuid/items',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  findItemsByFilter,
);
/**
 * @openapi
 * /v2/developer/collection/{collectionName}/filter/{filterUuid}/count:
 *  get:
 *      tags: [Collection Item]
 *      summary: Returns the count of a collection item according to the specified filter, identified by UUID.
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: path
 *          name: collectionName
 *          type: string
 *          required: true
 *          description: Name of Collection to get record
 *        - in: path
 *          name: filterUuid
 *          type: string
 *          required: true
 *          description: Unique Id of Collection Filter
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
 *              description: Count of filtered items
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              code:
 *                                  type: number
 *                              message:
 *                                  type: string
 *                              result:
 *                                  type: object
 *                              count:
 *                                  type: number
 *          400:
 *              description: Failed to Save
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                              message:
 *                                  type: string
 *                              code:
 *                                  type: number
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
dev2Router.get(
  '/collection/:collectionName/filter/:filterUuid/count',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  countItemsByFilter,
);
/**
 * @openapi
 * /v2/developer/collection/{collectionName}/bulkDelete:
 *  post:
 *      tags: [Collection Item]
 *      summary: Deletes multiple records identified by its item UUID, given in body
 *      description: v2 Active (LTS)
 *      requestBody:
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
 *          name: ids
 *          description: Send ids in body
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - ids
 *            properties:
 *              ids:
 *                type: array
 *                items:
 *                  type: string
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
 *              description: Items have been deleted
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: array
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
dev2Router.post(
  '/collection/:collectionName/bulkDelete',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  bulkDelete,
);

dev2Router.post('/user/me', verifyBuilderKey, verifyToken, devAuthorize, fetchUserDetails);

export default dev2Router;
