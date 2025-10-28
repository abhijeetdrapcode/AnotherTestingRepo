import passport from 'passport';
import { pluginCode } from 'drapcode-constant';
import { validateEmail } from 'drapcode-utility';
import { findOneItemByQuery, findItemById } from '../item/item.service';
import {
  compareBcryptPassword,
  convertHashPassword,
  roleCollectionName,
  userCollectionName,
} from './loginUtils';
import {
  checkUserLoginAttempts,
  generateTemporaryPassword,
  saveUser,
  updateUserLoginAttemptDetails,
} from './user.service';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { PROVIDER_TYPE, signInWithXano } from './authProviderUtil';
import { executeExternalApiAndProcess } from '../external-api/external-api.service';
import { replaceValueFromSource } from 'drapcode-utility';
import { isTokenBlacklisted } from './jwtUtils';
import { userCollectionService } from '../collection/collection.service';
import { createAuditTrail } from '../logs/audit/audit.service';
import { isNew } from '../utils/appUtils';
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'addjsonwebtokensecretherelikeQuiscustodietipsoscustodesNew',
  algorithms: ['HS256'],
  passReqToCallback: true,
};

const localOptions = {
  usernameField: 'userName',
  passwordField: 'password',
  passReqToCallback: true,
};

const authenticateUser = async (req, userName, password, done) => {
  const { db, projectId, body, query: reqQuery, enableAuditTrail } = req;
  const { authType } = reqQuery;

  let emailFieldValue = userName;
  if (body['email']) {
    emailFieldValue = body['email'];
  }
  let phoneNumberValue = userName;
  if (body['phone_number']) {
    phoneNumberValue = body['phone_number'];
    userName = '';
    emailFieldValue = '';
  }
  let query = {};
  const emailQuery = { email: { $regex: `^${emailFieldValue}$`, $options: 'i' } };
  const usernameQuery = { userName: { $regex: `^${userName}$`, $options: 'i' } };
  const phoneNumberQuery = { phone_number: phoneNumberValue };
  if (body['email']) {
    if (body['queryType'] && body['queryType'] === 'OR') {
      query = { $or: [emailQuery, usernameQuery] };
    } else {
      query = { $and: [emailQuery, usernameQuery] };
    }
  } else if (body['phone_number']) {
    if (body['queryType'] && body['queryType'] === 'OR') {
      query = { $or: [usernameQuery, phoneNumberQuery] };
    } else {
      query = { $and: [usernameQuery, phoneNumberQuery] };
    }
  } else {
    query = { $or: [emailQuery, usernameQuery, phoneNumberQuery] };
  }

  const userCollection = await userCollectionService(projectId);
  let { data: user } = await findItemById(db, projectId, userCollection, null, query);

  try {
    if (!user) {
      return done(null, false, {
        message: 'This user does not exists.',
        status: 404,
      });
    }

    const isUserLockOut = checkUserLoginAttempts(user);
    if (isUserLockOut.error) {
      return done(null, false, {
        message: isUserLockOut.error,
        status: 403,
      });
    } else user = isUserLockOut.user;

    const loginPlugin = await findInstalledPlugin(projectId, pluginCode.LOGIN);
    if (authType !== 'anonymous' && loginPlugin?.setting) {
      const { is_email_verified, is_enabled } = loginPlugin.setting;
      if (is_email_verified && !user.is_email_verified) {
        return done(null, false, { message: 'Please verify email first.', status: 401 });
      }
      if (is_enabled && !user.is_enabled) {
        return done(null, false, { message: 'Account is not active.', status: 401 });
      }
    }

    const validPassword = await compareBcryptPassword(password, user.password);
    user = await updateUserLoginAttemptDetails(db, user, validPassword);
    if (!validPassword) {
      return done(null, false, {
        message: 'Username or password does not match. Please try again',
        status: 401,
      });
    }

    if (authType && authType === 'anonymous') {
      user.password = await convertHashPassword(generateTemporaryPassword());
      if (user._id) {
        delete user._id;
      }
      const newValues = { $set: { password: user.password } };
      const result = await db.collection(userCollectionName);
      // FINAL: START:Audit Trail
      createAuditTrail(
        db,
        enableAuditTrail,
        'SYSTEM',
        'update',
        '',
        userCollectionName,
        '',
        '',
        false,
        '',
        'Password is changed',
      );
      // END:Audit Trail
      await result.findOneAndUpdate(query, newValues, isNew);
    }
    const twoFactorPlugin = await findInstalledPlugin(
      projectId,
      pluginCode.TWO_FACTOR_AUTHENTICATION,
    );
    let role = '';
    const { is_secret_code_verify } = user;
    let redirectToVerify = false;
    let redirectToRegister = false;
    if (twoFactorPlugin) {
      if (is_secret_code_verify) {
        redirectToVerify = true;
      } else if (twoFactorPlugin && twoFactorPlugin.setting.forceEnable) {
        redirectToRegister = true;
      }
    }

    if (!redirectToVerify) {
      if (user.userRoles && user.userRoles.length > 0) {
        role = await findOneItemByQuery(db, roleCollectionName, {
          name: user.userRoles[0],
        });
      }
      if (!role || role.length === 0) {
        return done(null, false, {
          message: 'The provided role does not exist. Please verify and try again.',
          status: 401,
        });
      }
      if (!redirectToRegister) {
        return done(null, { ...user, role: role.uuid });
      } else {
        return done(
          null,
          { ...user, role: role.uuid },
          { message: 'REDIRECT_TO_REGISTER', status: 403 },
        );
      }
    } else {
      role = 'TWO_FACTOR_VERIFY';
      user.userRoles = [role];
      return done(null, { ...user, role: role }, { message: 'REDIRECT_TO_VERIFY', status: 403 });
    }
  } catch (error) {
    console.error('error passport :>> ', error);
    done(error);
  }
};

const authenticateUserWithProvider = async (req, userName, password, done) => {
  const { db, projectId, params, environment, enableAuditTrail } = req;
  const { provider } = params;
  let code = '';
  switch (provider) {
    case PROVIDER_TYPE.XANO:
      code = pluginCode.LOGIN_WITH_XANO;
      break;
    default:
      break;
  }
  const plugin = await findInstalledPlugin(projectId, code);
  if (!plugin) {
    return done({ success: false, status: 401, message: 'No valid provider plugin install' });
  }

  let authResponse = null;
  if (provider === PROVIDER_TYPE.XANO) {
    authResponse = await signInWithXano(environment, plugin.setting, userName, password);
  }

  const { success, data } = authResponse;
  if (!success) {
    return done(authResponse);
  }

  let authEmail = '';
  let uniqueId = '';
  let returnData = {};
  if (provider === PROVIDER_TYPE.XANO) {
    const { authToken, email, id } = data;
    authEmail = email;
    uniqueId = id;
    returnData = {
      token: authToken,
    };
  }
  const emailQuery = { email: { $regex: `^${authEmail}$`, $options: 'i' } };
  const usernameQuery = { userName: { $regex: `^${authEmail}$`, $options: 'i' } };
  const query = { $or: [emailQuery, usernameQuery] };
  // let query = { $or: [{ email: authEmail }, { userName: authEmail }] };
  try {
    let user = await findOneItemByQuery(db, userCollectionName, query);
    if (!user) {
      const newUser = {
        email: validateEmail(authEmail) ? authEmail : '',
        userName: authEmail,
        uuid: uniqueId,
        password: generateTemporaryPassword(),
        userRoles: 'User',
      };
      const userResponse = await saveUser(db, projectId, enableAuditTrail, newUser);
      user = userResponse.data;
    }
    let role = '';
    if (user.userRoles && user.userRoles.length > 0) {
      role = await findOneItemByQuery(db, roleCollectionName, {
        name: user.userRoles[0],
      });
    }
    return done(null, {
      user,
      ...returnData,
      role: role ? role.uuid : '',
    });
  } catch (error) {
    console.error('error :>> ', error);
    done(error);
  }
};

const authenticateUserWithExternalAPI = async (req, userName, password, done) => {
  const { projectId, db, params, body, project, environment, enableProfiling, enableAuditTrail } =
    req;
  const { collectionItemId } = params;
  try {
    let authResponse = await executeExternalApiAndProcess(
      db,
      projectId,
      enableAuditTrail,
      collectionItemId,
      body,
      project.projectConstants,
      null,
      null,
      null,
      null,
      environment,
      enableProfiling,
    );

    const { success, responseData } = authResponse;
    if (!success) {
      return done(authResponse);
    }
    const user = responseData;
    let role = '';
    if (user.userRoles && user.userRoles.length > 0) {
      role = await findOneItemByQuery(db, roleCollectionName, {
        name: user.userRoles[0],
      });
    }
    return done(null, {
      user,
      role: role ? role.uuid : '',
      projectId,
    });
  } catch (error) {
    console.error('error authenticateUserWithExternalAPI :>> ', error);
    done(error);
  }
};

const authenticateUserWithToken = async (req, jwt_payload, done) => {
  try {
    console.log('\n ==== jwt_payload', jwt_payload);
    const { db, projectId } = req;
    const query = { userName: jwt_payload.sub };
    const userCollection = await userCollectionService(projectId);
    const { data: user } = await findItemById(db, projectId, userCollection, null, query);
    console.log('\n ==== user', user);
    const loginPlugin = await findInstalledPlugin(projectId, pluginCode.LOGIN);
    const { is_email_verified, is_enabled } =
      loginPlugin && loginPlugin.setting ? loginPlugin.setting : {};

    if (user) {
      let role = '';
      if (user.userRoles && user.userRoles.length > 0) {
        role = await findOneItemByQuery(db, roleCollectionName, {
          name: user.userRoles[0],
        });
      }
      if (!role || role.length === 0) {
        return done(null, false, {
          message: 'The provided role does not exist. Please verify and try again.',
          status: 401,
        });
      }
      if (is_email_verified && !user.is_email_verified) {
        return done(null, false, { message: 'Please verify email first.', status: 401 });
      }
      if (is_enabled && !user.is_enabled) {
        return done(null, false, { message: 'Account is not active.', status: 401 });
      }
      return done(null, { ...user, role: role.uuid });
    } else {
      return done(null, false, { message: 'Invalid Token.', status: 404 });
    }
  } catch (error) {
    done(error);
  }
};

const validateJWTToken = async (req, jwt_payload, done) => {
  // Since we are here, the JWT is valid!
  try {
    // Extract token from request
    const token = jwtOptions.jwtFromRequest(req);
    // Check if the token is blacklisted
    const isInvalidToken = await isTokenBlacklisted(token);
    if (!isInvalidToken.isValid) return done(null, false, { message: isInvalidToken.message });
    //Pass the user details to the next middleware
    return done(null, jwt_payload);
  } catch (error) {
    done(error);
  }
};

/**
 * Strategies
 */
const localStrategy = new LocalStrategy(localOptions, authenticateUser);
const authProviderStrategy = new LocalStrategy(localOptions, authenticateUserWithProvider);
const externalAPIStrategy = new LocalStrategy(localOptions, authenticateUserWithExternalAPI);
const jwtStrategy = new JwtStrategy(
  { ...jwtOptions, passReqToCallback: true },
  authenticateUserWithToken,
);

passport.use('login', localStrategy);
passport.use('auth-provider', authProviderStrategy);
passport.use('external-api-login', externalAPIStrategy);
passport.use('jwt-login', jwtStrategy);
passport.use('jwt', new JwtStrategy(jwtOptions, validateJWTToken));

// OAuth2.0
export const getOAuthOptionsFromPlugin = async (req, res) => {
  const { projectId, environment, tenant } = req;
  let pluginOptions = {};
  const oAuth2Plugin = await findInstalledPlugin(projectId, pluginCode.OAUTH_2);
  if (!oAuth2Plugin) {
    return res.status(400).json({ message: 'OAuth 2.0 Plugin is not Installed.' });
  }
  if (oAuth2Plugin.setting) {
    let {
      authorizationURL,
      tokenURL,
      clientID,
      clientSecret,
      scope,
      userInfoUrl,
      userUniqueField,
      defaultRole,
    } = oAuth2Plugin.setting;
    authorizationURL = replaceValueFromSource(authorizationURL, environment, tenant);
    authorizationURL = authorizationURL.trim();
    tokenURL = replaceValueFromSource(tokenURL, environment, tenant);
    tokenURL = tokenURL.trim();
    clientID = replaceValueFromSource(clientID, environment, tenant);
    clientID = clientID.trim();
    clientSecret = replaceValueFromSource(clientSecret, environment, tenant);
    clientSecret = clientSecret.trim();
    scope = replaceValueFromSource(scope, environment, tenant);
    scope = scope.trim();
    userInfoUrl = replaceValueFromSource(userInfoUrl, environment, tenant);
    userInfoUrl = userInfoUrl.trim();
    userUniqueField = replaceValueFromSource(userUniqueField, environment, tenant);
    userUniqueField = userUniqueField.trim();
    defaultRole = replaceValueFromSource(defaultRole, environment, tenant);
    defaultRole = defaultRole.trim();
    scope = scope.split(' ');
    pluginOptions = {
      authorizationURL,
      tokenURL,
      clientID,
      clientSecret,
      scope,
      userInfoUrl,
      userUniqueField,
      defaultRole,
    };
  }
  return pluginOptions;
};
