import express from 'express';
const emailDevRouter = express.Router();
import verifyToken from '../middleware/verifyToken.middleware';
import { verifyJwtForOpen } from '../loginPlugin/jwtUtils';
import devAuthorize from '../middleware/devAuth.middleware';
import { sendDynamicEmail, sendEmail } from './dev.controller';
import verifyBuilderKey from '../middleware/verifyBuilder.middleware';
/**
 * @openapi
 * /v1/developer/sendEmail/{templateId}/user/{sendTo}:
 *  post:
 *      tags: [Email]
 *      summary: Sends an email to the user with the specified template, identified by UUID, and the provided recipient.
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: templateId
 *          type: string
 *          required: true
 *          description: Uuid of Email Template.
 *        - in: path
 *          name: sendTo
 *          type: string
 *          required: false
 *          description: Email or Uuid of User to send email to.
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
 *              description: Email has been Sent.
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
 *              description: Could not find the email or template.
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
 * /v2/developer/sendEmail/{templateId}/user/{sendTo}:
 *  post:
 *      tags: [Email]
 *      summary: Sends an email to the user with the specified template, identified by UUID, and the provided recipient.
 *      description: v2 Active (LTS)
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: templateId
 *          type: string
 *          required: true
 *          description: Uuid of Email Template.
 *        - in: path
 *          name: sendTo
 *          type: string
 *          required: false
 *          description: Email or Uuid of User to send email to.
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
 *              description: Email has been Sent.
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
 *              description: Could not find the email or template.
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
emailDevRouter.post(
  '/sendEmail/:templateId/user/:sendTo',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  sendEmail,
);
/**
 * @openapi
 * /v1/developer/sendDynamicEmail/{templateId}/sendToCollection/{sendToCollectionName}/item/{collectionItemId}:
 *  post:
 *      tags: [Email]
 *      summary: Sends an email to the user with the specified template, identified by UUID, and the provided recipient with dynamic data.
 *      description: v1 ⚠️ Deprecated (might be removed in future), use v2 instead.
 *      deprecated: true
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: templateId
 *          type: string
 *          required: true
 *          description: Uuid of Email Template.
 *        - in: path
 *          name: sendToCollectionName
 *          type: string
 *          required: false
 *          description: Send To Collection Name.
 *        - in: path
 *          name: collectionItemId
 *          type: string
 *          required: false
 *          description: Uuid of Collection Item.
 *        - in: body
 *          name: sendTo
 *          description: Email or Uuid of User to send email to.
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - sendTo
 *            properties:
 *              sendTo:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: emailCC
 *          description: Email or Uuid of User for CC
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - emailCC
 *            properties:
 *              emailCC:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: emailBCC
 *          description: Email or Uuid for BCC
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - emailBCC
 *            properties:
 *              emailBCC:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: sendToField
 *          description: Send To Collection Email Field
 *          required: false
 *          schema:
 *            type: object
 *            required:
 *              - sendToField
 *            properties:
 *              sendToField:
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
 *              description: Email has been Sent.
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
 *              description: Could not find the email or template.
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
 * /v2/developer/sendDynamicEmail/{templateId}/sendToCollection/{sendToCollectionName}/item/{collectionItemId}:
 *  post:
 *      tags: [Email]
 *      summary: Sends an email to the user with the specified template, identified by UUID, and the provided recipient with dynamic data.
 *      description: v2 Active (LTS)
 *      requestBody:
 *         content:
 *            application/json:
 *               schema:
 *                  type: object
 *      parameters:
 *        - in: path
 *          name: templateId
 *          type: string
 *          required: true
 *          description: Uuid of Email Template.
 *        - in: path
 *          name: sendToCollectionName
 *          type: string
 *          required: false
 *          description: Send To Collection Name.
 *        - in: path
 *          name: collectionItemId
 *          type: string
 *          required: false
 *          description: Uuid of Collection Item.
 *        - in: body
 *          name: sendTo
 *          description: Email or Uuid of User to send email to.
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - sendTo
 *            properties:
 *              sendTo:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: emailCC
 *          description: Email or Uuid of User for CC
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - emailCC
 *            properties:
 *              emailCC:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: emailBCC
 *          description: Email or Uuid for BCC
 *          required: true
 *          schema:
 *            type: object
 *            required:
 *              - emailBCC
 *            properties:
 *              emailBCC:
 *                type: array
 *                items:
 *                  type: string
 *        - in: body
 *          name: sendToField
 *          description: Send To Collection Email Field
 *          required: false
 *          schema:
 *            type: object
 *            required:
 *              - sendToField
 *            properties:
 *              sendToField:
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
 *              description: Email has been Sent.
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
 *              description: Could not find the email or template.
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
emailDevRouter.post(
  '/sendDynamicEmail/:templateId/sendToCollection/:sendToCollectionName/item/:collectionItemId',
  verifyBuilderKey,
  verifyToken,
  verifyJwtForOpen,
  devAuthorize,
  sendDynamicEmail,
);
export default emailDevRouter;
