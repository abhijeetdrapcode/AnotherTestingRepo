import { pluginCode } from 'drapcode-constant';
import { getPageByUrl } from '../page/page.service';
import { countByCode } from '../install-plugin/installedPlugin.service';
import { ignoreUrls } from '../middleware/token';
import { PREFIX_CONFIG } from '../utils/util';

export const authentication = async function (req, res, next) {
  const { builderDB, params, projectId, url } = req;
  const isIgnore = ignoreUrls(url);
  if (isIgnore) {
    return next();
  }
  let { pageId } = params;
  if (pageId === 'lib' || pageId === 'js') {
    console.log('***** Since it is for lib then do not check *****');
    return next();
  }
  let page = await await getPageByUrl(builderDB, projectId, pageId);
  if (!page) {
    return next();
  }
  console.log('Page', page.name, page.access);

  // TODO: Checking login plugin every time from Database
  const isLoginPluginCount = await countByCode(builderDB, pluginCode.LOGIN);
  if (isLoginPluginCount > 0 && !page.access.includes('PERMIT_ALL')) {
    checkAuthenticated(req, res, next, page);
  } else {
    console.error('hello skipping validate token');
    return next();
  }
};

const checkAuthenticated = (req, res, next, page) => {
  if (req.isAuthenticated()) {
    const { params, user } = req;
    let { pageId } = params;

    const pageRoles = page.access;
    const userRoles = user.userRoles;

    if (!pageRoles || pageRoles.length === 0) {
      console.log('No need to check page authentication');
      return next();
    }

    if (!userRoles || userRoles === 'undefined') {
      res.status(403).redirect('/login');
      return;
    }
    console.log('checkAuthenticated userRoles', userRoles);
    console.log('checkAuthenticated pageRoles', pageRoles);
    if (userRoles[0] === 'TWO_FACTOR_VERIFY') {
      console.log('Since this role is for two factor verification so redirect it');
      if (page.slug === 'verification-step') {
        return next();
      }
      res.redirect('/verification-step');
      return;
    } else {
      if (pageId === 'verification-step') {
        return res.send('You already have verified code.');
      }
      if (pageRoles.length === 1 && pageRoles[0] === 'AUTHENTICATED') {
        console.log('This page is only authenticated');
        return next();
      }

      if (pageRoles.length === 1 && userRoles.length === 1 && pageRoles[0] === userRoles[0]) {
        return next();
      } else if (pageRoles.length > 1) {
        /**
         * Page has multiple roles
         * Check if user has multiple roles too
         * and page contains any of them
         */
        if (userRoles.length === 1 && pageRoles.includes(userRoles[0])) {
          return next();
        }
      } else {
        /**
         * User has multiple roles
         * Check if page has multiple roles too
         * and user contains any one of them
         */
        if (pageRoles.length === 1 && userRoles.includes(pageRoles[0])) {
          return next();
        }
      }
      return res.send('You are not authorized to view this page');
    }
  }
  console.log('************************');
  console.log('************************');
  console.log('************************');
  console.log('************************');
  console.log('************************');
  console.log('Not authenticated');
  res.redirect('/login');
  return;
};

export const localization = async (req, res, next) => {
  try {
    let {
      builderDB,
      projectId,
      session,
      query: { lang },
    } = req;
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>> Inside Localization middleware');
    const Localization = builderDB.collection(`${PREFIX_CONFIG}localization`);
    const projection = { language: 1, isDefault: 1 };

    if (!session.lang) {
      const query = {
        projectId,
        isDefault: true,
      };

      const defaultLocalization = await Localization.findOne(query, { projection });
      if (!defaultLocalization)
        throw new Error('Please publish the project to view it Localization.');

      console.log('\n Default Language: ', defaultLocalization.language);
      session.lang = defaultLocalization.language;

      next();
      return;
    }
    console.error('\n session ang: ', session.lang);
    req.language = session.lang;
    if (!lang) {
      return next();
    }

    const localization = await Localization.findOne({ projectId, language: lang }, { projection });
    console.log('localization :>> ', localization);

    if (localization) {
      session.lang = lang;
      req.language = session.lang;
    } else {
      console.log('Requested language not found, using default:', session.lang);
    }
    next();
  } catch (error) {
    console.error('error', error);
    next(error);
  }
};
