import express from 'express';
import { generateOTPMiddleware } from '../middleware/otp.middleware';
import {
  generateAndSendEmailOTP,
  generateAndSendSmsOTP,
  loginWithProvider,
} from '../loginPlugin/user.controller';
import verifyToken from '../middleware/verifyToken.middleware';
import devAuthorize from '../middleware/devAuth.middleware';
import { verifyEmailOtpAndLoginDev, verifySmsOtpAndLoginDev } from './dev.controller';
import verifyBuilderKey from '../middleware/verifyBuilder.middleware';
const authDevRouter = express.Router();

/**
 * @openapi
 * /v1/developer/login:
 *  post:
 *      tags: [User]
 *      summary: Login with Username and Password
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
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                userName:
 *                  type: string
 *                  example: userName
 *                password:
 *                  type: string
 *                  example: password
 *      responses:
 *          200:
 *              description: User Logged in Successfully.
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
 *              description: Could not find User.
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
 * /v2/developer/login:
 *  post:
 *      tags: [User]
 *      summary: Login with Username and Password
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
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                userName:
 *                  type: string
 *                  example: userName
 *                password:
 *                  type: string
 *                  example: password
 *      responses:
 *          200:
 *              description: User Logged in Successfully.
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
 *              description: Could not find User.
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
authDevRouter.post('/login', verifyBuilderKey, verifyToken, devAuthorize, loginWithProvider);
/**
 * @openapi
 * /v1/developer/signup/send-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to email for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - email
 *                - templateId
 *                - authType
 *              properties:
 *                email:
 *                  type: string
 *                  format: email
 *                  example: user@example.com
 *                templateId:
 *                  type: string
 *                  example: "65a8b5e1d2c8f3a9b6c7d8e9"
 *      responses:
 *          200:
 *              description: OTP sent successfully.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            sentEmailId:
 *                              type: string
 *                              example: 010001966bb0d9ea-ac02a5ed-0f6c-4300-9392-9aa863da4c3f-000000
 *                            status:
 *                              type: string
 *                              example: success
 *                            code:
 *                              type: number
 *                              example: 200
 *                            emailOtpToken:
 *                              type: string
 *                              example: 1acada43-1391-4b9f-be80-0ac6280e25ec
 *          404:
 *              description: Could not find User.
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
 * /v2/developer/signup/send-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to email for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - email
 *                - templateId
 *                - authType
 *              properties:
 *                email:
 *                  type: string
 *                  format: email
 *                  example: user@example.com
 *                templateId:
 *                  type: string
 *                  example: "65a8b5e1d2c8f3a9b6c7d8e9"
 *      responses:
 *          200:
 *              description: OTP sent successfully.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            sentEmailId:
 *                              type: string
 *                              example: 010001966bb0d9ea-ac02a5ed-0f6c-4300-9392-9aa863da4c3f-000000
 *                            status:
 *                              type: string
 *                              example: success
 *                            code:
 *                              type: number
 *                              example: 200
 *                            emailOtpToken:
 *                              type: string
 *                              example: 1acada43-1391-4b9f-be80-0ac6280e25ec
 *          404:
 *              description: Could not find User.
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
authDevRouter.post(
  '/signup/send-email-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  generateAndSendEmailOTP,
);
/**
 * @openapi
 * /v1/developer/signup/verify-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify the email OTP for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - emailOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1043"
 *                emailOtpToken:
 *                  type: string
 *                  example: "1acada43-1391-4b9f-be80-0ac6280e25ec"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and emailOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/signup/verify-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify the email OTP for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - emailOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1043"
 *                emailOtpToken:
 *                  type: string
 *                  example: "1acada43-1391-4b9f-be80-0ac6280e25ec"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and emailOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/signup/verify-email-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  verifyEmailOtpAndLoginDev,
);
/**
 * @openapi
 * /v1/developer/login/send-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to email for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - email
 *                - templateId
 *                - authType
 *              properties:
 *                email:
 *                  type: string
 *                  format: email
 *                  example: user@example.com
 *                templateId:
 *                  type: string
 *                  example: "65a8b5e1d2c8f3a9b6c7d8e9"
 *      responses:
 *          200:
 *              description: OTP sent successfully.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            sentEmailId:
 *                              type: string
 *                              example: 010001966bb0d9ea-ac02a5ed-0f6c-4300-9392-9aa863da4c3f-000000
 *                            status:
 *                              type: string
 *                              example: success
 *                            code:
 *                              type: number
 *                              example: 200
 *                            emailOtpToken:
 *                              type: string
 *                              example: 1acada43-1391-4b9f-be80-0ac6280e25ec
 *          404:
 *              description: Could not find User.
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
 * /v2/developer/login/send-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to email for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - email
 *                - templateId
 *                - authType
 *              properties:
 *                email:
 *                  type: string
 *                  format: email
 *                  example: user@example.com
 *                templateId:
 *                  type: string
 *                  example: "65a8b5e1d2c8f3a9b6c7d8e9"
 *      responses:
 *          200:
 *              description: OTP sent successfully.
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            sentEmailId:
 *                              type: string
 *                              example: 010001966bb0d9ea-ac02a5ed-0f6c-4300-9392-9aa863da4c3f-000000
 *                            status:
 *                              type: string
 *                              example: success
 *                            code:
 *                              type: number
 *                              example: 200
 *                            emailOtpToken:
 *                              type: string
 *                              example: 1acada43-1391-4b9f-be80-0ac6280e25ec
 *          404:
 *              description: Could not find User.
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
authDevRouter.post(
  '/login/send-email-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  generateAndSendEmailOTP,
);
/**
 * @openapi
 * /v1/developer/login/verify-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify the email OTP for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - emailOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1043"
 *                emailOtpToken:
 *                  type: string
 *                  example: "1acada43-1391-4b9f-be80-0ac6280e25ec"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and emailOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/login/verify-email-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify the email OTP for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - emailOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1043"
 *                emailOtpToken:
 *                  type: string
 *                  example: "1acada43-1391-4b9f-be80-0ac6280e25ec"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and emailOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/login/verify-email-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  verifyEmailOtpAndLoginDev,
);
/**
 * @openapi
 * /v1/developer/signup/send-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to phone via SMS for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - phone_number
 *                - templateId
 *                - authType
 *              properties:
 *                phone_number:
 *                  type: string
 *                  example: "+912343422367"
 *                  description: Phone number in E.164 format with country code
 *                templateId:
 *                  type: string
 *                  example: "84706a64-51fd-438c-bf1a-89b6dbe61f48"
 *                  description: ID of the SMS template to use
 *      responses:
 *          200:
 *              description: OTP sent successfully via SMS
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            message:
 *                              type: array
 *                              example: []
 *                            status:
 *                              type: string
 *                              example: success
 *                            smsOtpToken:
 *                              type: string
 *                              example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *          400:
 *              description: Failed to send SMS
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Failed to send SMS
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: phone_number is required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/signup/send-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Send OTP to phone via SMS for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - phone_number
 *                - templateId
 *                - authType
 *              properties:
 *                phone_number:
 *                  type: string
 *                  example: "+912343422367"
 *                  description: Phone number in E.164 format with country code
 *                templateId:
 *                  type: string
 *                  example: "84706a64-51fd-438c-bf1a-89b6dbe61f48"
 *                  description: ID of the SMS template to use
 *      responses:
 *          200:
 *              description: OTP sent successfully via SMS
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            message:
 *                              type: array
 *                              example: []
 *                            status:
 *                              type: string
 *                              example: success
 *                            smsOtpToken:
 *                              type: string
 *                              example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *          400:
 *              description: Failed to send SMS
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Failed to send SMS
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: phone_number is required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/signup/send-sms-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  generateAndSendSmsOTP,
);
/**
 * @openapi
 * /v1/developer/signup/verify-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify OTP sent to your phone for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - smsOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1735"
 *                smsOtpToken:
 *                  type: string
 *                  example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and smsOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/signup/verify-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify OTP sent to your phone for signup
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - smsOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1735"
 *                smsOtpToken:
 *                  type: string
 *                  example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and smsOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/signup/verify-sms-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  verifySmsOtpAndLoginDev,
);
/**
 * @openapi
 * /v1/developer/login/send-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: OTP will be sent to phone via SMS for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - phone_number
 *                - templateId
 *                - authType
 *              properties:
 *                phone_number:
 *                  type: string
 *                  example: "+912343422367"
 *                  description: Phone number in E.164 format with country code
 *                templateId:
 *                  type: string
 *                  example: "84706a64-51fd-438c-bf1a-89b6dbe61f48"
 *                  description: ID of the SMS template to use
 *      responses:
 *          200:
 *              description: OTP sent successfully via SMS
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            message:
 *                              type: array
 *                              example: []
 *                            status:
 *                              type: string
 *                              example: success
 *                            smsOtpToken:
 *                              type: string
 *                              example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *          400:
 *              description: Failed to send SMS
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Failed to send SMS
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: phone_number is required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/login/send-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: OTP will be sent to phone via SMS for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - phone_number
 *                - templateId
 *                - authType
 *              properties:
 *                phone_number:
 *                  type: string
 *                  example: "+912343422367"
 *                  description: Phone number in E.164 format with country code
 *                templateId:
 *                  type: string
 *                  example: "84706a64-51fd-438c-bf1a-89b6dbe61f48"
 *                  description: ID of the SMS template to use
 *      responses:
 *          200:
 *              description: OTP sent successfully via SMS
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            message:
 *                              type: array
 *                              example: []
 *                            status:
 *                              type: string
 *                              example: success
 *                            smsOtpToken:
 *                              type: string
 *                              example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *          400:
 *              description: Failed to send SMS
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Failed to send SMS
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: phone_number is required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/login/send-sms-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  generateAndSendSmsOTP,
);

/**
 * @openapi
 * /v1/developer/login/verify-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify OTP sent to your phone for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - smsOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1735"
 *                smsOtpToken:
 *                  type: string
 *                  example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and smsOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 * /v2/developer/login/verify-sms-otp:
 *  post:
 *      tags: [User]
 *      summary: Verify OTP sent to your phone for login
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
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - otp
 *                - smsOtpToken
 *              properties:
 *                otp:
 *                  type: string
 *                  example: "1735"
 *                smsOtpToken:
 *                  type: string
 *                  example: "4228fdd6-a497-4e18-b103-4f23b970891a"
 *      responses:
 *          200:
 *              description: OTP Verified Successfully
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object
 *                          properties:
 *                            code:
 *                              type: number
 *                              example: 200
 *                            data:
 *                              type: object
 *                              description: Logged in user object
 *                            message:
 *                              type: string
 *                              example: OTP Verified Successfully
 *          400:
 *              description: Invalid or expired OTP
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: Invalid OTP or token expired
 *                      code:
 *                        type: number
 *                        example: 400
 *          422:
 *              description: Missing required parameters
 *              content:
 *                application/json:
 *                  schema:
 *                    type: object
 *                    properties:
 *                      message:
 *                        type: string
 *                        example: otp and smsOtpToken are required
 *                      code:
 *                        type: number
 *                        example: 422
 */
authDevRouter.post(
  '/login/verify-sms-otp',
  verifyBuilderKey,
  verifyToken,
  devAuthorize,
  generateOTPMiddleware,
  verifySmsOtpAndLoginDev,
);

export default authDevRouter;
