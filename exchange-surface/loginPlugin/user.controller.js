import passport from 'passport';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { pluginCode } from 'drapcode-constant';
import { existsSync, createReadStream } from 'fs';
import { loadEvent } from 'drapcode-utility';
// import { getCookieToken, isValidPasswordResetToken } from '../apiService/user.service';
import { isValidPasswordResetToken } from '../apiService/user.service';
import {
  findAllInstalledPlugin,
  findOneInstalledPlugin,
} from '../install-plugin/installedPlugin.service';
import {
  COLLECTION_ROLE,
  COLLECTION_USER,
  fetchCollectionItemDataForPage,
  fetchCollectionItemsForPage,
  fetchEmailOTPUserData,
  fetchSmsOTPUserData,
  refreshAndFetchUserData,
  refreshUserTOTPData,
  resetUserTOTPData,
  updateUserTOTPData,
} from '../apiService/collection.service';
import {
  FACEBOOK_LOADING_PAGE_ENDPOINT,
  OAUTH_LODDING_PAGE_ENDPOINT,
  TWITTER_LOADING_PAGE_ENDPOINT,
} from '../apiService/endpoints';
import { logoutUserToken } from '../apiService/user.service';
import { extractUserSettingFromUserAndTenant } from '../apiService/multiTenant.service';

const MFA_PREFIX_SIZE = 3;
const MFA_SUFFIX_SIZE = 7;

export const loginUser = async (req, res, next) => {
  passport.authenticate('local-login', { session: true }, (err, user, info) => {
    console.log(`local-login passport authenticated`, JSON.stringify({ err, user, info }));
    console.log('err :>> ', err);
    console.log('user :>> ', user);
    console.log('info :>> ', info);

    if (err) {
      return res.status(err.status ? err.status : 500).json(err);
    }
    if (info !== undefined) {
      return res.status(info.status || 200).json({ message: info.message });
    }
    if (user) {
      req.logIn(user.data, { session: true }, async (err) => {
        console.log('err %s :>> ', err);
        if (err) {
          return res.status(500).json(err);
        }
        user.projectId = req.projectId;
        req.user = user.data;
        // console.log('user %s :>> ', user.data);
        // const token = await getCookieToken(req);
        // console.log('TOKEN_GEN: loginUser: getCookieToken');
        // res.header('jsessionid', token);
        res.status(200).json(user.data);
        return;
      });
    } else {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  })(req, res, next);
};

export const loginUserWithExternalAPI = async (req, res, next) => {
  passport.authenticate('external-api-login', { session: true }, (err, user, info) => {
    console.log(`external-api-login loginUserWithExternalAPI`, JSON.stringify({ err, user, info }));
    if (err) {
      return res.status(err.status ? err.status : 500).json(err);
    }
    if (info !== undefined) {
      return res.status(info.status || 200).json({ message: info.message });
    }

    if (user) {
      req.logIn(user.data, { session: true }, async (err) => {
        console.log('loginUserWithExternalAPI err %s% :>> ', err);
        if (err) {
          return res.status(500).json(err);
        }
        user.projectId = req.projectId;
        req.user = user.data;
        // console.log('loginUserWithExternalAPI user ssssss% :>> ', user.data);
        // const token = await getCookieToken(req);
        // console.log('TOKEN_GEN: loginUserWithExternalAPI: getCookieToken');
        // res.header('jsessionid', token);
        return res.status(200).json(user.data);
      });
    } else {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  })(req, res, next);
};

export const loginUserWithToken = async (req, res, next) => {
  passport.authenticate('jwt-login', { session: true }, (err, user, info) => {
    if (err) {
      return res.status(500).json(err);
    }
    if (info !== undefined) {
      return res.status(info.status || 200).json({ message: info.message });
    }
    if (user) {
      req.login(user, { session: true }, async (err) => {
        if (err) {
          return res.status(500).json(err);
        }
        user.projectId = req.projectId;
        // const token = await getCookieToken(req);
        // console.log('TOKEN_GEN: loginUserWithToken: getCookieToken');
        // res.header('jsessionid', token);
        return res.status(200).json(user);
      });
    }
  })(req, res, next);
};

export const magicLinkLogin = async (req, res, next) => {
  const token = req.query.token;
  req.body.token = token;
  req.headers.authorization = `Bearer ${token}`;
  passport.authenticate('jwt-login', { session: true }, (err, user, info) => {
    if (err) {
      return res.redirect('/login');
    }
    if (info !== undefined) {
      return res.redirect('/login');
    }
    if (user) {
      req.login(user, { session: true }, async (err) => {
        if (err) {
          return res.redirect('/login');
        }
        const { projectId } = req;
        try {
          user.projectId = projectId;
          let redirectPage = '/home';
          let tenantData = '';
          let userSettingData = '';
          const installedPlugins = await findAllInstalledPlugin(projectId);
          const magicLinkLoginPlugin = installedPlugins.find(
            (e) => e.code === pluginCode.MAGIC_LINK_LOGIN,
          );
          const multiTenantSaasPlugin = installedPlugins.find(
            (e) => e.code === pluginCode.MULTI_TENANT_SAAS,
          );
          console.log('user.controller.js:117 ~ req.login ~ :', multiTenantSaasPlugin);
          if (magicLinkLoginPlugin) {
            const magicLinkLoginEvent = await loadEvent(
              projectId,
              magicLinkLoginPlugin.setting.eventId,
            );
            const redirectRules = magicLinkLoginEvent
              ? magicLinkLoginEvent.actions
                  .find((e) => e.name === 'loginUser')
                  .parameters.find((e) => e.name === 'redirectRules').value
              : [];
            const { userRoles } = user.userDetails || {};
            if (redirectRules) {
              const redirectUrl = redirectRules.find((redirectRule) => {
                if (Array.isArray(userRoles)) {
                  return userRoles.includes(redirectRule.role);
                } else {
                  return redirectRule.role === userRoles;
                }
              });
              redirectPage = redirectUrl ? redirectUrl.page : '/home';
            }
          }
          if (multiTenantSaasPlugin) {
            const { tenantId } = user.userDetails || {};
            tenantData = tenantId && tenantId.length ? tenantId[0] : '';
            userSettingData = extractUserSettingFromUserAndTenant(user.userDetails, tenantData);
            console.log('🚀 ~ file: user.controller.js:143 ~ req.login ~ tenantData:', tenantData);
            console.log('user.controller.js:173 ~ req.login ~ userSettingData:', userSettingData);
          }
          /**
           * ?INFO: Handling apostrophe in the JSON by replacing it with '##@apos@##'
           * afterwards, replacing '##@apos@##' with single quote again to keep the JSON string valid.
           **/
          res.write(`
              <script>
                (function() {
                  const localStorage = window.localStorage;
            
                  const user = JSON.parse('${JSON.stringify(user.userDetails)
                    .replace(/\\/g, '\\\\')
                    .replace(/'/g, "\\'")
                    .replace(/"/g, '\\"')}');
                  const tenant = ${
                    tenantData
                      ? `JSON.parse('${JSON.stringify(tenantData)
                          .replace(/\\/g, '\\\\')
                          .replace(/'/g, "\\'")
                          .replace(/"/g, '\\"')}')`
                      : 'null'
                  };
                  const userSetting = ${
                    userSettingData
                      ? `JSON.parse('${JSON.stringify(userSettingData)
                          .replace(/\\/g, '\\\\')
                          .replace(/'/g, "\\'")
                          .replace(/"/g, '\\"')}')`
                      : 'null'
                  };
            
                  localStorage.setItem('token', "${user.token}");
                  localStorage.setItem('user', JSON.stringify(user));
                  if (tenant) {
                    localStorage.setItem('tenant', JSON.stringify(tenant));
                  }
                  if (userSetting) {
                    localStorage.setItem('userSetting', JSON.stringify(userSetting));
                  }
                  localStorage.setItem('projectId', "${user.projectId}");
                  localStorage.setItem('role', "${user.role}");
            
                  window.location = '${redirectPage}';
                })();
              </script>
            `);
          // const ctoken = await getCookieToken(req);
          // console.log('TOKEN_GEN: magicLinkLogin: getCookieToken');
          // res.header('jsessionid', ctoken);
          res.end();
        } catch (err) {
          console.log('==> Error :>> ', err);
          res.redirect('/login');
        }
      });
    }
  })(req, res, next);
};

export const logoutUser = async (req, res) => {
  await logoutUserToken(req);
  req.logout();
  res.status(200).send({ message: 'successfully logout' });
};

export const resetPasswordOptimize = async (req, res, next) => {
  try {
    const userResponse = await isValidPasswordResetToken(req);
    if (userResponse.data) {
      const pageId = 'reset-password';
      let pageKey = `${req.projectId}/${pageId}/${pageId}`;
      const pagePath = `${process.env.BUILD_FOLDER}views/${pageKey}.hbs`;
      if (existsSync(pagePath)) {
        let pageContent = '';
        var readerStream = createReadStream(pagePath);
        readerStream.setEncoding('UTF8');

        readerStream.on('data', (chunk) => {
          pageContent += chunk.toString();
        });

        readerStream.on('error', () => {
          return res.write(
            'There is some issue reading your build. Please publish the project to view it.',
          );
        });

        readerStream.on('end', () => {
          return res.send(pageContent);
        });
      }
    }
  } catch (error) {
    if (error.response.status === 401) {
      res.send(error.response.data);
    }
    next(error);
  }
};

export const refreshLoggedInUser = async (req, res) => {
  console.log('*** Going to refresh Current LoggedIn User...:');
  if (req.user && Object.keys(req.user).length) {
    const { user } = req;
    let userDataResponse = await refreshAndFetchUserData(req, res, user);
    if (userDataResponse) {
      const updatedUserData = {
        userDetails: userDataResponse,
        role: user.role,
        token: userDataResponse.token,
      };
      console.log('*** Refreshing Current LoggedIn User...:');
      req.logIn(updatedUserData, { session: true }, async (err) => {
        if (err) {
          return res.status(500).json(err);
        }
        req.user.projectId = req.projectId;
        req.user = updatedUserData;
        // const ctoken = await getCookieToken(req);
        // console.log('TOKEN_GEN: refreshLoggedInUser: getCookieToken');
        // res.header('jsessionid', ctoken);
        return res.status(200).json(req.user);
      });
      res.end();
    } else {
      return res.status(404).json(req.user);
    }
  }
};

export const refreshTenantAndLoggedInUser = async (req, res) => {
  console.log('*** Going to refresh Tenant & Current LoggedIn User...:');
  if (req.user && Object.keys(req.user).length) {
    const { user, params } = req;
    let userDataResponse = await fetchCollectionItemDataForPage(
      req,
      res,
      COLLECTION_USER,
      user.uuid,
      user,
    );
    if (userDataResponse) {
      const updatedUserData = {
        userDetails: userDataResponse,
        role: user.role,
        token: user.token,
      };
      console.log('*** Refreshing Tenant & Current LoggedIn User...:');
      req.logIn(updatedUserData, { session: true }, async (err) => {
        if (err) {
          return res.status(500).json(err);
        }

        if (params && params.tenantId) {
          const { tenantId: paramTenantId } = params;
          // eslint-disable-next-line no-prototype-builtins
          if (userDataResponse.hasOwnProperty('tenantId') && userDataResponse.tenantId.length) {
            const { tenantId: tenants, userSettingId: userSettings } = userDataResponse;
            const currentTenant = tenants.find((tenant) => tenant.uuid === paramTenantId);
            if (currentTenant) {
              updatedUserData['tenant'] = currentTenant;
            }
            if (userSettings && userSettings.length) {
              const currentUserSetting = userSettings.find(
                (setting) =>
                  setting?.tenantId[0]?.uuid === paramTenantId &&
                  setting?.userId[0]?.uuid === userDataResponse.uuid,
              );
              if (currentUserSetting) {
                updatedUserData['userSetting'] = currentUserSetting;
              }
            } else {
              if (req.params && req.params.userSettingId) {
                const { userSettingId: paramUserSettingId } = req.params;
                if (
                  // eslint-disable-next-line no-prototype-builtins
                  userDataResponse.hasOwnProperty('userSettingId') &&
                  userDataResponse.userSettingId.length
                ) {
                  const { userSettingId: userSettings } = userDataResponse;
                  const currentSetting = userSettings.find(
                    (userSetting) => userSetting.uuid === paramUserSettingId,
                  );
                  if (currentSetting) {
                    updatedUserData['userSetting'] = currentSetting;
                  }
                }
              }
            }
          }
        }

        req.user.projectId = req.projectId;
        req.user = updatedUserData;
        // const ctoken = await getCookieToken(req);
        // res.header('jsessionid', ctoken);
        return res.status(200).json(req.user);
      });
      res.end();
    } else {
      return res.status(404).json(req.user);
    }
  }
};

export const switchTenant = async (req, res) => {
  console.log('*** Going to switch Tenant...:');
  if (req.user && Object.keys(req.user).length) {
    const { user, params } = req;
    let userDataResponse = await fetchCollectionItemDataForPage(
      req,
      res,
      COLLECTION_USER,
      user.uuid,
      user,
    );
    if (userDataResponse) {
      console.log('switchTenant ~ userDataResponse:', userDataResponse);
      const userToken = user.token;
      let userRole = user.role;
      let tenantUserSetting = '';
      let subTenant = '';

      if (params && params.tenantId) {
        const { tenantId: paramTenantId } = params;
        console.log('switchTenant ~ paramTenantId:', paramTenantId);
        if (
          // eslint-disable-next-line no-prototype-builtins
          userDataResponse.hasOwnProperty('userSettingId') &&
          userDataResponse.userSettingId.length
        ) {
          const { userSettingId: userSettings } = userDataResponse;
          const currentUserSetting = userSettings.find(
            (setting) =>
              setting?.tenantId[0]?.uuid === paramTenantId &&
              setting?.userId[0]?.uuid === userDataResponse.uuid,
          );
          console.log('currentUserSetting', currentUserSetting);
          if (currentUserSetting) {
            tenantUserSetting = currentUserSetting;
            userDataResponse['userSetting'] = currentUserSetting;
          }
        }
        if (tenantUserSetting.userRoles && tenantUserSetting.userRoles.length) {
          const tenantRoleName = tenantUserSetting?.userRoles?.[0];
          let roleItems = await fetchCollectionItemsForPage(req, res, COLLECTION_ROLE);
          if (tenantRoleName && roleItems && roleItems.length) {
            const tenantRole = roleItems.find((role) => role.name === tenantRoleName);
            console.log('switchTenant ~ tenantRole:', tenantRole);
            if (tenantRole) {
              userDataResponse['userRoles'] = [tenantRoleName];
              userRole = tenantRole.uuid;
            }
          }
        }
        if (tenantUserSetting.subTenantId && tenantUserSetting.subTenantId.length) {
          const subTenantIds = tenantUserSetting.subTenantId.filter(
            (subTenant) =>
              subTenant.tenantId?.[0]?.uuid === paramTenantId ||
              subTenant.tenantId[0] === paramTenantId,
          );
          const userSubTenantIds = userDataResponse.subTenantId.filter(
            (subTenant) =>
              subTenant.tenantId?.[0]?.uuid === paramTenantId ||
              subTenant.tenantId[0] === paramTenantId,
          );
          console.log('userSubTenantIds', userSubTenantIds);
          const commonSubTenants = subTenantIds.filter((subTenant) =>
            userSubTenantIds.some((userSubTenant) => userSubTenant.uuid === subTenant.uuid),
          );
          subTenant = commonSubTenants[0] || '';
          console.log('commonSubTenants', subTenant);
        }
      }

      const updatedUserData = {
        userDetails: userDataResponse,
        role: userRole,
        token: userToken,
        userSetting: tenantUserSetting,
        subTenant,
      };

      if (params && params.tenantId) {
        const { tenantId: paramTenantId } = params;
        // eslint-disable-next-line no-prototype-builtins
        if (userDataResponse.hasOwnProperty('tenantId') && userDataResponse.tenantId.length) {
          const { tenantId: tenants } = userDataResponse;
          const currentTenant = tenants.find((tenant) => tenant.uuid === paramTenantId);
          if (currentTenant) {
            updatedUserData['tenant'] = currentTenant;
            userDataResponse['tenant'] = currentTenant;
          }
        }
        if (
          userDataResponse &&
          userDataResponse.subTenantId &&
          userDataResponse.subTenantId.length &&
          !subTenant
        ) {
          const { subTenantId: subTenants } = userDataResponse;
          subTenant = subTenants.find(
            (subTenant) =>
              subTenant?.tenantId[0]?.uuid === paramTenantId ||
              subTenant?.tenantId[0] === paramTenantId,
          );
          if (subTenant) {
            updatedUserData['subTenant'] = subTenant;
            userDataResponse['subTenant'] = subTenant;
          }
        }
      }

      console.log('*** Switching Tenant...:');
      req.logIn(updatedUserData, { session: true }, async (err) => {
        if (err) {
          return res.status(500).json(err);
        }
        req.user.projectId = req.projectId;
        req.user = updatedUserData;
        // const ctoken = await getCookieToken(req);
        // console.log('TOKEN_GEN: switchTenant: getCookieToken');
        // res.header('jsessionid', ctoken);
        return res.status(200).json(req.user);
      });
      res.end();
    } else {
      return res.status(404).json(req.user);
    }
  }
};

export const generateSecretCode = async (req, res) => {
  if (!req.user || Object.keys(req.user).length === 0) {
    return;
  }
  const { projectId, projectName, user } = req;
  const { is_secret_code_verify, userName } = user;
  if (is_secret_code_verify) {
    return res.status(404).json(req.user);
  }

  const twoAuthPlugin = await findOneInstalledPlugin(
    projectId,
    pluginCode.TWO_FACTOR_AUTHENTICATION,
  );
  if (!twoAuthPlugin) {
    return res.status(404).json(req.user);
  }
  let appName = projectName;
  if (twoAuthPlugin.setting.name) {
    appName = twoAuthPlugin.setting.name;
  }
  const secret_code = authenticator.generateSecret();
  user.secret_code = encodeSecretCode(secret_code);

  const email = userName;
  const url = await QRCode.toDataURL(authenticator.keyuri(email, appName, secret_code));

  const updatedUserData = {
    userDetails: user,
    role: user.role,
    token: user.token,
  };
  console.log('*** Refreshing Current LoggedIn User...:');
  req.logIn(updatedUserData, { session: true }, async (err) => {
    if (err) {
      return res.status(500).json(err);
    }
    req.user.projectId = req.projectId;
    console.log('updatedUserData', updatedUserData);
    req.user = updatedUserData;
    // const ctoken = await getCookieToken(req);
    // console.log('TOKEN_GEN: generateSecretCode: getCookieToken');
    // res.header('jsessionid', ctoken);
    return res.status(200).json({ user: req.user, url });
  });
  res.end();
};

export const verifySecretCode = async (req, res) => {
  if (!req.user || Object.keys(req.user).length === 0) {
    return;
  }
  const { projectId, projectName, user, body } = req;
  console.log('1: verifySecretCode user', user);
  let { userName, secret_code } = user;
  secret_code = decodeSecretCode(secret_code);
  const { code } = body;
  if (!authenticator.check(code, secret_code)) {
    console.log('Code is not verified');
    const twoAuthPlugin = await findOneInstalledPlugin(
      projectId,
      pluginCode.TWO_FACTOR_AUTHENTICATION,
    );
    if (!twoAuthPlugin) {
      return res.status(404).json(req.user);
    }
    let appName = projectName;
    if (twoAuthPlugin.setting.name) {
      appName = twoAuthPlugin.setting.name;
    }

    secret_code = authenticator.generateSecret();
    user.secret_code = encodeSecretCode(secret_code);
    const email = userName;
    const url = await QRCode.toDataURL(authenticator.keyuri(email, appName, secret_code));

    const updatedUserData = {
      userDetails: user,
      role: user.role,
      token: user.token,
    };
    console.log('2: updatedUserData', JSON.stringify(updatedUserData));

    console.log('*** Token Not Verified, refreshing user with new secret...:');
    req.logIn(updatedUserData, { session: true }, async (err) => {
      if (err) {
        return res.status(500).json(err);
      }
      req.user.projectId = req.projectId;
      req.user = updatedUserData;
      // const ctoken = await getCookieToken(req);
      // console.log('TOKEN_GEN: verifySecretCode: getCookieToken');
      // res.header('jsessionid', ctoken);
      return res.status(200).json({ success: false, user: req.user, url });
    });
  } else {
    console.log('Code is verified');
    const updatedUser = await updateUserTOTPData(req, res, { secret_code: user.secret_code });
    console.log('3: updatedUser', JSON.stringify(updatedUser));
    const updatedUserData = {
      userDetails: updatedUser,
      role: user.role,
      token: user.token,
    };

    console.log('*** Refreshing Current LoggedIn User...:');
    req.logIn(updatedUserData, { session: true }, async (err) => {
      if (err) {
        return res.status(500).json(err);
      }
      req.user.projectId = req.projectId;
      req.user = updatedUserData;
      // const ctoken = await getCookieToken(req);
      // console.log('TOKEN_GEN: verifySecretCode: getCookieToken');
      // res.header('jsessionid', ctoken);
      return res.status(200).json({ user: req.user, success: true });
    });
  }
};

export const resetSecretCode = async (req, res) => {
  if (!req.user || Object.keys(req.user).length === 0) {
    return;
  }
  const { projectId, projectName, user } = req;
  const updatedUser = await resetUserTOTPData(req, res);
  console.log('resetSecretCode updatedUser', updatedUser);
  const twoAuthPlugin = await findOneInstalledPlugin(
    projectId,
    pluginCode.TWO_FACTOR_AUTHENTICATION,
  );
  let appName = projectName;
  if (twoAuthPlugin.setting.name) {
    appName = twoAuthPlugin.setting.name;
  }
  const secret_code = authenticator.generateSecret();
  updatedUser.secret_code = encodeSecretCode(secret_code);

  const email = updatedUser.userName;
  const url = await QRCode.toDataURL(authenticator.keyuri(email, appName, secret_code));

  const updatedUserData = {
    userDetails: updatedUser,
    role: user.role,
    token: user.token,
  };

  console.log('*** Refreshing Current LoggedIn User...:');
  req.logIn(updatedUserData, { session: true }, async (err) => {
    if (err) {
      return res.status(500).json(err);
    }
    req.user.projectId = req.projectId;
    req.user = updatedUserData;
    console.log('*****************************');
    // const ctoken = await getCookieToken(req);
    // console.log('TOKEN_GEN: resetSecretCode: getCookieToken');
    // res.header('jsessionid', ctoken);
    return res.status(200).json({ user: req.user, success: true, url });
  });
  console.log('*************dd****************');
};

export const authorizeSecretCode = async (req, res) => {
  if (!req.user || Object.keys(req.user).length === 0) {
    return;
  }
  const { user, body } = req;
  let { secret_code, uuid } = user;
  secret_code = decodeSecretCode(secret_code);
  const { verify_code } = body;
  if (!authenticator.check(verify_code, secret_code)) {
    res.status(403).json({ success: false });
  } else {
    const user = await refreshUserTOTPData(req, res, { uuid });
    console.log('user in refreshUserTOTPData', user);
    req.logIn(user, { session: true }, async (err) => {
      if (err) {
        return res.status(500).json(err);
      }
      req.user.projectId = req.projectId;
      req.user = user;
      // const ctoken = await getCookieToken(req);
      // console.log('TOKEN_GEN: authorizeSecretCode: getCookieToken');
      // res.header('jsessionid', ctoken);
      return res.status(200).json(req.user);
    });
  }
};

function generateRandomHex(size) {
  let hex = '';
  for (let i = 0; i < size; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

export const encodeSecretCode = (secret_code) => {
  const prefix = generateRandomHex(MFA_PREFIX_SIZE);
  const suffix = generateRandomHex(MFA_SUFFIX_SIZE);
  secret_code = `${prefix}${secret_code}${suffix}`;
  secret_code = Buffer.from(secret_code, 'utf8').toString('base64');
  return secret_code;
};

export const decodeSecretCode = (secret_code) => {
  secret_code = Buffer.from(secret_code, 'base64').toString('utf8');
  secret_code = secret_code.slice(MFA_PREFIX_SIZE, secret_code.length - MFA_SUFFIX_SIZE);
  return secret_code;
};

export const loginWithOAuth2 = async (req, res, next) => {
  try {
    passport.authenticate('oauth2')(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};
export const oAuth2Callback = async (req, res, next) => {
  try {
    passport.authenticate('oauth2', { session: true }, (err, user, info) => {
      console.log('\n info :>> ', info);
      console.log('\n err :>> ', err);
      console.log('\n user :>> ', user);
      if (err) {
        const error = packer({ error: err.message, status: err.status });
        res.redirect(`${OAUTH_LODDING_PAGE_ENDPOINT}?error=${error}`);
      }
      if (user) {
        req.logIn(user, { session: true }, async (err) => {
          console.log('err ************ :>> ', err, user);
          if (err) {
            const error = packer({ error: err.message, status: err.status });
            res.redirect(`${OAUTH_LODDING_PAGE_ENDPOINT}?error=${error}`);
          }
          req.user = user;
          const info = packer({ data: user, status: 200 });
          res.redirect(`${OAUTH_LODDING_PAGE_ENDPOINT}?info=${info}`);
        });
      }
    })(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};

const packer = (obj) => {
  const str = JSON.stringify(obj);
  const buff = new Buffer.from(str);
  const mess = buff.toString('base64');
  return mess.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ',');
};

export const loginWithFacebook = async (req, res, next) => {
  try {
    passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};

export const facebookCallback = async (req, res, next) => {
  try {
    passport.authenticate('facebook', { session: false }, (err, user, info) => {
      console.log('\n info :>> ', info);
      console.log('\n err :>> ', err);
      console.log('\n user :>> ', user);
      if (err) {
        const error = packer({ error: err.message, status: err.status });
        res.redirect(`${FACEBOOK_LOADING_PAGE_ENDPOINT}?error=${error}`);
      }
      if (user) {
        req.login(user, { session: false }, async (err) => {
          console.log('err ************ :>> ', err, user);
          if (err) {
            const error = packer({ error: err.message, status: err.status });
            res.redirect(`${FACEBOOK_LOADING_PAGE_ENDPOINT}?error=${error}`);
          }
          const info = packer({ data: user });
          res.redirect(`${FACEBOOK_LOADING_PAGE_ENDPOINT}?info=${info}`);
        });
      }
    })(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};

export const loginWithTwitter = async (req, res, next) => {
  try {
    passport.authenticate('twitter')(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};

export const twitterCallback = async (req, res, next) => {
  try {
    passport.authenticate('twitter', { session: false }, (err, user, info) => {
      console.log('\n info :>> ', info);
      console.log('\n err :>> ', err);
      console.log('\n user :>> ', user);
      if (err) {
        const error = packer({ error: err.message, status: err.status });
        res.redirect(`${TWITTER_LOADING_PAGE_ENDPOINT}?error=${error}`);
      }
      if (user) {
        req.login(user, { session: false }, async (err) => {
          console.log('err ************ :>> ', err, user);
          if (err) {
            const error = packer({ error: err.message, status: err.status });
            res.redirect(`${TWITTER_LOADING_PAGE_ENDPOINT}?error=${error}`);
          }
          const info = packer({ data: user });
          res.redirect(`${TWITTER_LOADING_PAGE_ENDPOINT}?info=${info}`);
        });
      }
    })(req, res, next);
  } catch (error) {
    console.log('\n error :>> ', error);
    next();
  }
};
export const authorizeEmailOTPCode = async (req, res) => {
  const { body } = req;
  const user = await fetchEmailOTPUserData(req, res, body);
  req.logIn(user, { session: true }, async (err) => {
    if (err) {
      return res.status(500).json(err);
    }
    req.user.projectId = req.projectId;
    req.user = user;
    return res.status(200).json(user);
  });
};
export const authorizeSmsOTPCode = async (req, res) => {
  const { body } = req;
  const user = await fetchSmsOTPUserData(req, res, body);
  req.logIn(user, { session: true }, async (err) => {
    if (err) {
      return res.status(500).json(err);
    }
    req.user.projectId = req.projectId;
    req.user = user;
    return res.status(200).json(user);
  });
};

export const switchSubTenant = async (req, res) => {
  console.log('*** Going to switch Sub Tenant...:');
  if (req.user && Object.keys(req.user).length) {
    const { user, params } = req;
    let userDataResponse = await fetchCollectionItemDataForPage(
      req,
      res,
      COLLECTION_USER,
      user.uuid,
      user,
    );
    if (userDataResponse) {
      console.log('switchSubTenant ~ userDataResponse:', userDataResponse);
      const userToken = user.token;
      let userRole = user.role;
      let tenantUserSetting = '';
      let tenant = '';
      let subTenant = '';

      if (params && params.subTenantId) {
        const { subTenantId: paramSubTenantId } = params;
        console.log('switchSubTenant ~ paramSubTenantId:', paramSubTenantId);
        // eslint-disable-next-line no-prototype-builtins
        if (userDataResponse.hasOwnProperty('subTenantId') && userDataResponse.subTenantId.length) {
          const { subTenantId: subTenants } = userDataResponse;
          const currentSubTenant = subTenants.find(
            (subTenant) => subTenant.uuid === paramSubTenantId,
          );
          if (currentSubTenant) {
            subTenant = currentSubTenant;
            userDataResponse['subTenant'] = currentSubTenant;
          }
        }
        if (
          // eslint-disable-next-line no-prototype-builtins
          userDataResponse.hasOwnProperty('tenantId') &&
          userDataResponse.tenantId.length &&
          subTenant
        ) {
          const { tenantId: tenants } = userDataResponse;
          const currentTenant = tenants.find(
            (tenant) => tenant?.uuid === subTenant?.tenantId[0]?.uuid,
          );
          if (currentTenant) {
            tenant = currentTenant;
            userDataResponse['tenant'] = currentTenant;
          }
        }
        if (
          // eslint-disable-next-line no-prototype-builtins
          userDataResponse.hasOwnProperty('userSettingId') &&
          userDataResponse.userSettingId.length &&
          subTenant
        ) {
          const { userSettingId: userSettings } = userDataResponse;
          const currentUserSetting = userSettings.find(
            (setting) =>
              setting?.tenantId[0]?.uuid === subTenant?.tenantId[0]?.uuid &&
              setting?.userId[0]?.uuid === userDataResponse.uuid,
          );
          if (currentUserSetting) {
            tenantUserSetting = currentUserSetting;
            userDataResponse['userSetting'] = currentUserSetting;
          }
        }
        if (
          tenantUserSetting &&
          tenantUserSetting.userRoles &&
          tenantUserSetting.userRoles.length
        ) {
          const tenantRoleName = tenantUserSetting?.userRoles?.[0];
          let roleItems = await fetchCollectionItemsForPage(req, res, COLLECTION_ROLE);
          if (tenantRoleName && roleItems && roleItems.length) {
            const tenantRole = roleItems.find((role) => role.name === tenantRoleName);
            console.log('switchTenant ~ tenantRole:', tenantRole);
            if (tenantRole) {
              userDataResponse['userRoles'] = [tenantRoleName];
              userRole = tenantRole.uuid;
            }
          }
        }
      }

      const updatedUserData = {
        userDetails: userDataResponse,
        role: userRole,
        token: userToken,
        userSetting: tenantUserSetting,
        tenant,
        subTenant,
      };
      console.log('*** Switching Sub Tenant...:');
      req.logIn(updatedUserData, { session: true }, async (err) => {
        if (err) {
          return res.status(500).json(err);
        }
        req.user.projectId = req.projectId;
        req.user = updatedUserData;
        return res.status(200).json(req.user);
      });
      res.end();
    } else {
      return res.status(404).json(req.user);
    }
  }
};
