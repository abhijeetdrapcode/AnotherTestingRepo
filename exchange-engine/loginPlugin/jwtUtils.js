import { pluginCode } from 'drapcode-constant';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import {
  common_set_method,
  redis_get_method,
  redisClient,
  smembersAsync,
  multiExecAsync,
} from 'drapcode-redis';
import { AppError, replaceValueFromSource } from 'drapcode-utility';
import { userCollectionService } from '../collection/collection.service';
import { findItemById } from '../item/item.service';

const JWT_SECRET_KEY = 'addjsonwebtokensecretherelikeQuiscustodietipsoscustodesNew';
const jwtOptions = {
  expiresIn: '24h',
  algorithm: 'HS256', //default: HS256
};
const USER_IDLE_TIME = 15 * 60;
const ACTIVE = 'ACTIVE';
export const issueJWTToken = async (userData, tokenExpiry = '', inActivityLimit = '') => {
  try {
    if (userData) {
      const payload = {
        sub: userData.username || userData.userName || userData.email,
        // TODO: Causing token not to expire
        // iat: Date.now(),
      };
      let newJwtOptions = { ...jwtOptions };
      if (tokenExpiry) newJwtOptions.expiresIn = tokenExpiry;
      const signedToken = jwt.sign(payload, JWT_SECRET_KEY, newJwtOptions);
      const expiryTime = inActivityLimit ? inActivityLimit : USER_IDLE_TIME;
      common_set_method(signedToken, `${ACTIVE}::${expiryTime}`, expiryTime);
      redisClient.sadd(`user_tokens:${payload.sub}`, signedToken);
      return { token: `Bearer ${signedToken}`, expires: newJwtOptions.expiresIn };
    }
  } catch (error) {
    console.error('\n error :>> ', error);
  }
};
export const verifyToken = async (jwtToken = '') => {
  try {
    if (jwtToken) {
      if (jwtToken.startsWith('Bearer ')) jwtToken = jwtToken.substring(7, jwtToken.length);
      const isInvalidToken = await isTokenBlacklisted(jwtToken);
      if (!isInvalidToken.isValid) throw new AppError(isInvalidToken.message);
      return jwt.verify(jwtToken, JWT_SECRET_KEY, jwtOptions);
    } else throw new AppError('Token is Empty');
  } catch (e) {
    console.error('e: verify token ', e);
    return null;
  }
};

export const logoutUserToken = async (jwtToken = '') => {
  try {
    if (jwtToken) {
      if (jwtToken.startsWith('Bearer ')) jwtToken = jwtToken.substring(7, jwtToken.length);
      const decoded = jwt.decode(jwtToken);
      redisClient.del(jwtToken);
      redisClient.srem(`user_tokens:${decoded.sub}`, jwtToken);
    }
  } catch (e) {
    console.error('e: ====logoutUserToken token ', e);
    return null;
  }
};

export const logoutAllUserToken = async (userSub) => {
  try {
    const tokens = await smembersAsync(`user_tokens:${userSub}`);
    if (!tokens || tokens.length === 0)
      return { code: 404, data: { message: 'No active Tokens Found for User' } };

    const pipeline = redisClient.multi();
    pipeline.del(...tokens);
    pipeline.del(`user_tokens:${userSub}`);
    await multiExecAsync(pipeline);

    return {
      code: 200,
      data: { userSub, message: 'User has been logged out from all devices' },
    };
  } catch (err) {
    console.error('Error in logoutAllUserToken:', err);
    return { code: 500, data: { message: 'Failed to logout all user tokens' } };
  }
};

export const isTokenBlacklisted = async (token) => {
  const result = await redis_get_method(token);
  if (!result) {
    return { isValid: false, message: 'Token is invalid' };
  } else if (result.startsWith(ACTIVE)) {
    const expiryTime = result.split('::')[1];
    redisClient.expire(token, expiryTime);
    return { isValid: true, message: '' };
  }
};

export const getTokenExpireTime = async (projectId, environment) => {
  const loginPlugin = await findInstalledPlugin(projectId, pluginCode.LOGIN);
  return extractLoginPluginSetting(loginPlugin, environment);
};

export const extractLoginPluginSetting = (loginPlugin, environment) => {
  if (!loginPlugin)
    return { tokenExpiry: 86400, inActivityLimit: USER_IDLE_TIME, logoutRedirectPage: '/' };
  let tokenExpiry = '';
  let inActivityLimit = '';
  let {
    userSessionTimeOutInSec,
    userMaxIdleTimeInSec,
    tokenExpiryInHrs,
    inactivityTimeoutInMins,
    logoutRedirectPage,
  } = loginPlugin.setting;
  // Old Variable for Fallback
  userSessionTimeOutInSec = replaceValueFromSource(userSessionTimeOutInSec, environment);
  userMaxIdleTimeInSec = replaceValueFromSource(userMaxIdleTimeInSec, environment);
  // Current Variable
  tokenExpiryInHrs = replaceValueFromSource(tokenExpiryInHrs, environment);
  inactivityTimeoutInMins = replaceValueFromSource(inactivityTimeoutInMins, environment);

  tokenExpiry = tokenExpiryInHrs ? parseInt(tokenExpiryInHrs) * 3600 : userSessionTimeOutInSec;
  inActivityLimit = inactivityTimeoutInMins
    ? parseInt(inactivityTimeoutInMins) * 60
    : userMaxIdleTimeInSec;

  return {
    tokenExpiry: tokenExpiry || 86400,
    inActivityLimit: inActivityLimit || USER_IDLE_TIME,
    logoutRedirectPage,
  };
};

export const validateToken = async function (req, res, next) {
  const authorizationHeader = req.headers.authorization;
  let result;
  if (authorizationHeader) {
    const token = req.headers.authorization.split(' ')[1]; // Bearer <token>
    try {
      const payload = await verifyToken(token);
      req.user = payload;
      next();
    } catch (err) {
      throw new Error(err);
    }
  } else {
    result = {
      error: `Authentication error. Token required.`,
      status: 401,
    };
    return res.status(401).send(result);
  }
};

export async function verifyJwt(req, res, next) {
  if (req.originalUrl.includes('finder')) return next(); // if filter api
  let origin = req.get('origin');
  if (origin && origin.includes('admin')) return next();
  /**
   * Check if login plugin installed or not.
   */
  const { headers, projectId, db } = req;
  const loginPlugin = await findInstalledPlugin(projectId, pluginCode.LOGIN);
  if (!loginPlugin) {
    return next();
  }
  if (!headers.authorization) {
    console.log('returning no authorization');
    return res.status(401).send({ code: 401, message: 'No token provided.' });
  }
  console.log('checking');
  passport.authenticate('jwt', { session: false }, async function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      info.code = 403;
      return res.status(403).send(info);
    }
    // const userFromDb = await findOneItemByQuery(db, userCollectionName, {
    //   userName: user.sub,
    // });
    const userCollection = await userCollectionService(projectId);
    let { data: userFromDb } = await findItemById(db, projectId, userCollection, null, {
      userName: user.sub,
    });
    if (!userFromDb) {
      return res.status(401).send({ code: 403, message: 'Invalid token.' });
    }
    req.user = userFromDb; // Forward user information to the next middleware
    next();
  })(req, res, next);
}

export async function verifyJwtForOpen(req, res, next) {
  const { headers, db, projectId } = req;
  const authorizationHeader = headers.authorization;
  if (authorizationHeader) {
    const token = authorizationHeader.split(' ')[1];
    try {
      const payload = await verifyToken(token);
      req.user = payload;
      passport.authenticate('jwt', { session: false }, async function (err, user, info) {
        if (err) {
          return next(err);
        }
        if (!user) {
          info.code = 403;
          return res.status(403).send(info);
        }
        // const userFromDb = await findOneItemByQuery(db, userCollectionName, {
        //   userName: user.sub,
        // });
        const userCollection = await userCollectionService(projectId);
        let { data: userFromDb } = await findItemById(db, projectId, userCollection, null, {
          userName: user.sub,
        });
        if (!userFromDb) {
          return res.status(401).send({ code: 403, message: 'Invalid token.' });
        }
        req.user = userFromDb; // Forward user information to the next middleware
        next();
      })(req, res, next);
    } catch (err) {
      console.error('verifyJwtForOpen err', err);
      throw new Error(err);
    }
  } else {
    next();
  }
}
