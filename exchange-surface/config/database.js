import { findProjectFromFile } from 'drapcode-utility';
import { serverDomains, uatEnvs } from './constants';
import {
  createConnection,
  connectProjectDatabase,
  passProjectDataFromGloballyToReq,
  passProjectDataInReq,
  compareMongoSetting,
} from './database.utils';
// require('./global.database.config');
let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;

let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

const EXCHANGE_SURFACE_DOMAIN = process.env.EXCHANGE_SURFACE_DOMAIN;

ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

const dbConnection = async (req, res, next) => {
  const { subdomains, originalUrl, hostname, protocol } = req;
  if (originalUrl.includes('/auth/callback')) {
    return next();
  }

  if (originalUrl === '/favicon.ico') {
    return res.end();
  }
  if (!hostname) {
    return res.send('No Project Associated');
  }
  // let isGlobalUsed = false;
  // if (PROJECT_HOSTNAME === hostname) {
  //   isGlobalUsed = true;
  // }
  // if (isGlobalUsed) {
  //   req.projectId = Global_projectId;
  //   req.db = Global_db;
  //   passProjectDataFromGloballyToReq(req);
  //   return next();
  // }

  let query = {};
  let environment = '';
  if (hostname.includes(EXCHANGE_SURFACE_DOMAIN)) {
    const subdomains = req.subdomains;
    if (serverDomains.includes(subdomains[0])) {
      query = { seoName: subdomains[1] };
      environment = subdomains[0];
      if (!uatEnvs.includes(environment)) {
        environment = '';
      }
    } else {
      query = { seoName: subdomains[0] };
    }
  } else {
    query = { domainName: hostname };
  }
  console.log('query dbConnection :>> ', query, subdomains);
  let project = findProjectFromFile(query);
  if (!project) {
    return res.status(404).send('This url does not exist. Please publish again.');
  }

  req.db = null;

  const pDatabase = `project_${project.uuid}`;
  // const pcDatabase = `project_config_${project.uuid}`;
  try {
    req.db = await connectProjectDatabase(
      ITEM_DB_HOST,
      pDatabase,
      ITEM_DB_USERNAME,
      ITEM_DB_PASSWORD,
    );
  } catch (error) {
    if (req.db) {
      req.db.close();
    }
    console.error('error Failed to Connect Project Database', error);
    return res.status(404).send('This url does not exist');
  }

  const itemSet = { host: ITEM_DB_HOST, username: ITEM_DB_USERNAME, password: ITEM_DB_PASSWORD };

  req.projectId = project.uuid;
  passProjectDataInReq(req, project, environment);
  return next();
};

export default dbConnection;
