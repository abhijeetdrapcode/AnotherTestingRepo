import { findProjectByQuery } from '../project/project.service';
import { serverDomains, uatEnvs } from './constants';
import {
  createConnection,
  connectProjectDatabase,
  passProjectDataFromGloballyToReq,
  passProjectDataInReq,
  compareMongoSetting,
} from './database.utils';
require('./global.database.config');
let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;

let CONFIG_DB_HOST = process.env.CONFIG_DB_HOST;
let CONFIG_DB_USERNAME = process.env.CONFIG_DB_USERNAME;
let CONFIG_DB_PASSWORD = process.env.CONFIG_DB_PASSWORD;

let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

const EXCHANGE_SURFACE_DOMAIN = process.env.EXCHANGE_SURFACE_DOMAIN;

ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

CONFIG_DB_HOST = CONFIG_DB_HOST || 'localhost';
CONFIG_DB_USERNAME = CONFIG_DB_USERNAME || '';
CONFIG_DB_PASSWORD = CONFIG_DB_PASSWORD || '';

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
  let isGlobalUsed = false;
  if (PROJECT_HOSTNAME === hostname) {
    isGlobalUsed = true;
  }
  if (isGlobalUsed) {
    req.projectId = Global_projectId;
    req.db = Global_db;
    req.builderDB = Global_builderDB;
    passProjectDataFromGloballyToReq(req);
    return next();
  }

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
  let pDetailDB = null;
  let project = null;
  try {
    pDetailDB = await createConnection(
      CONFIG_DB_HOST,
      'project_detail',
      CONFIG_DB_USERNAME,
      CONFIG_DB_PASSWORD,
    );
    project = await findProjectByQuery(pDetailDB, query);
    pDetailDB.close();
  } catch (error) {
    if (pDetailDB) {
      pDetailDB.close();
    }
    console.error(`Error fetching project details: ${error}`);
    return res.status(404).send('This url does not exist. Please publish again.');
  }

  if (!project) {
    return res.status(404).send('This url does not exist. Please publish again.');
  }

  req.db = null;
  req.builderDB = null;

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
  const configSet = {
    host: CONFIG_DB_HOST,
    username: CONFIG_DB_USERNAME,
    password: CONFIG_DB_PASSWORD,
  };
  const isSameSetting = compareMongoSetting(itemSet, configSet);
  if (isSameSetting) {
    console.log('We are using same config so use same connection');
    req.builderDB = req.db;
  } else {
    try {
      req.builderDB = await connectProjectDatabase(
        CONFIG_DB_HOST,
        pDatabase,
        CONFIG_DB_USERNAME,
        CONFIG_DB_PASSWORD,
      );
    } catch (error) {
      if (req.builderDB) {
        req.builderDB.close();
      }
      console.error('error Failed to Connect Project Database', error);
      return res.status(404).send('This url does not exist');
    }
  }

  req.projectId = project.uuid;
  passProjectDataInReq(req, project, environment);
  return next();
};

export default dbConnection;
