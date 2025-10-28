import express from 'express';
import {
  addUserWithProvider,
  loginWithProvider,
  loginUserWithExternalAPI,
  resetPassword,
  changePassword,
  loginUserWithToken,
  addAnonymousUser,
  getTenantByTenantId,
  getUserSettingByUserSettingId,
  updateTenantPermission,
  updateUserPermission,
  loginWithTwoFactor,
  updateUserSettingsPermission,
  loginUserWithOAuth2,
  logoutUser,
  loginUserWithFacebook,
  loginUserWithTwitter,
  verifyEmailOtpAndLogin,
  generateAndSendEmailOTP,
  generateAndSendSmsOTP,
  verifySmsOtpAndLogin,
  forgetPassword,
  refreshLoggedInUser,
  getUserDetails,
  generateEmailOTP,
  generateSmsOTP,
  forceLogoutAllDevices,
} from './user.controller';
import { verifyJwt } from './jwtUtils';
import sessionValidate from '../middleware/sessionValidate.middleware';
import { validatePasswordMiddleware } from './user.service';

const loginPluginRoute = express.Router();

loginPluginRoute.post('/user/:provider?', validatePasswordMiddleware, addUserWithProvider);
loginPluginRoute.post('/logout', logoutUser);
loginPluginRoute.post('/logout-all/:userId', verifyJwt, forceLogoutAllDevices);
loginPluginRoute.post('/anonymous-user', validatePasswordMiddleware, addAnonymousUser);
loginPluginRoute.post('/login/:provider?', loginWithProvider);
loginPluginRoute.post('/two-auth-verification', loginWithTwoFactor);
loginPluginRoute.post(
  '/login/otp/external-api/:collectionItemId?',

  loginUserWithExternalAPI,
);
loginPluginRoute.post('/login-with-token', loginUserWithToken);
loginPluginRoute.post('/forget-password/:templateId', forgetPassword);
loginPluginRoute.post('/reset-password/', verifyJwt, validatePasswordMiddleware, resetPassword);
loginPluginRoute.post('/change-passoword/', verifyJwt, validatePasswordMiddleware, changePassword);
loginPluginRoute.get('/tenant/:tenantId', getTenantByTenantId);
loginPluginRoute.get('/userSetting/:userSettingId', getUserSettingByUserSettingId);
loginPluginRoute.post('/tenant/:tenantId/permissions', verifyJwt, updateTenantPermission);
loginPluginRoute.post('/user/:userId/permissions', verifyJwt, updateUserPermission);
loginPluginRoute.post(
  '/user-settings/:userSettingsId/permissions',
  verifyJwt,
  updateUserSettingsPermission,
);
loginPluginRoute.post('/loginUserWithOAuth2', loginUserWithOAuth2);
loginPluginRoute.post('/loginUserWithFacebook', loginUserWithFacebook);
loginPluginRoute.post('/loginUserWithTwitter', loginUserWithTwitter);
loginPluginRoute.post('/send-email-otp', generateAndSendEmailOTP);
loginPluginRoute.post('/verify-email-otp', verifyEmailOtpAndLogin);
loginPluginRoute.post('/send-sms-otp', generateAndSendSmsOTP);
loginPluginRoute.post('/verify-sms-otp', verifySmsOtpAndLogin);
loginPluginRoute.get('/refresh-user/:itemId', sessionValidate, refreshLoggedInUser);
loginPluginRoute.get('/userDetails/:userUniqueKey', verifyJwt, getUserDetails);
loginPluginRoute.post('/generate-email-otp', generateEmailOTP);
loginPluginRoute.post('/generate-sms-otp', generateSmsOTP);

export default loginPluginRoute;
