import express from 'express';
import verifyToken from '../middleware/verifyToken.middleware';
import { anyFileToTextMulti, anyFileToTextSingle } from './dev.controller';
import verifyBuilderKey from '../middleware/verifyBuilder.middleware';
const utilityDevRouter = express.Router();

/**
 * @openapi
 * /v1/developer/multi-file/anyFileToText:
 *  post:
 *      tags: [Utility]
 *      summary: Convert multiple files to text
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      parameters:
 *        - in: header
 *          name: x-api-key
 *          schema:
 *            type: string
 *          required: false
 *          description: Developer API Key generated from Project Setting
 *      requestBody:
 *        required: true
 *        content:
 *          multipart/form-data:
 *            schema:
 *              type: object
 *              properties:
 *                files:
 *                  type: array
 *                  items:
 *                    type: string
 *                    format: binary
 *      responses:
 *          200:
 *              description: Text extracted from files Successfully.
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
 *              description: Could not find Files.
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
 *              description: Required Params or header is missing
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
 * /v2/developer/multi-file/anyFileToText:
 *  post:
 *      tags: [Utility]
 *      summary: Convert multiple files to text
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: header
 *          name: x-api-key
 *          schema:
 *            type: string
 *          required: false
 *          description: Developer API Key generated from Project Setting
 *      requestBody:
 *        required: true
 *        content:
 *          multipart/form-data:
 *            schema:
 *              type: object
 *              properties:
 *                files:
 *                  type: array
 *                  items:
 *                    type: string
 *                    format: binary
 *      responses:
 *          200:
 *              description: Text extracted from files Successfully.
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
 *              description: Could not find Files.
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
 *              description: Required Params or header is missing
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

utilityDevRouter.post(
  '/multi-file/anyFileToText',
  verifyBuilderKey,
  verifyToken,
  anyFileToTextMulti,
);
/**
 * @openapi
 * /v1/developer/anyFileToText:
 *  post:
 *      tags: [Utility]
 *      summary: Convert multiple files to text
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      parameters:
 *        - in: header
 *          name: x-api-key
 *          schema:
 *            type: string
 *          required: false
 *          description: Developer API Key generated from Project Setting
 *      requestBody:
 *        required: true
 *        content:
 *          multipart/form-data:
 *            schema:
 *              type: object
 *              properties:
 *                file:
 *                  type: string
 *                  format: binary
 *      responses:
 *          200:
 *              description: Text extracted from file Successfully.
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
 *              description: Could not find Files.
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
 *              description: Required Params or header is missing
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
 * /v2/developer/anyFileToText:
 *  post:
 *      tags: [Utility]
 *      summary: Convert multiple files to text
 *      description: v2 Active (LTS)
 *      parameters:
 *        - in: header
 *          name: x-api-key
 *          schema:
 *            type: string
 *          required: false
 *          description: Developer API Key generated from Project Setting
 *      requestBody:
 *        required: true
 *        content:
 *          multipart/form-data:
 *            schema:
 *              type: object
 *              properties:
 *                file:
 *                  type: string
 *                  format: binary
 *      responses:
 *          200:
 *              description: Text extracted from file Successfully.
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
 *              description: Could not find Files.
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
 *              description: Required Params or header is missing
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

utilityDevRouter.post('/anyFileToText', verifyBuilderKey, verifyToken, anyFileToTextSingle);

export default utilityDevRouter;
