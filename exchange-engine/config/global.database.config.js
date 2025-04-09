import { findProjectByQuery } from '../project/project.service';
import { logger } from 'drapcode-logger';
import { extractEnvironment } from './envUtil';
import { compareMongoSetting, connectProjectDatabase, createConnection } from './mongoUtil';
let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;

let CONFIG_DB_HOST = process.env.CONFIG_DB_HOST;
let CONFIG_DB_USERNAME = process.env.CONFIG_DB_USERNAME;
let CONFIG_DB_PASSWORD = process.env.CONFIG_DB_PASSWORD;

let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

CONFIG_DB_HOST = CONFIG_DB_HOST || 'localhost';
CONFIG_DB_USERNAME = CONFIG_DB_USERNAME || '';
CONFIG_DB_PASSWORD = CONFIG_DB_PASSWORD || '';

const globalDBConnection = async () => {
  logger.info(`PROJECT_HOSTNAME ${PROJECT_HOSTNAME}`);
  if (!PROJECT_HOSTNAME) {
    console.log('No Project Associated');
    return;
  }
  let project = null;
  let pDetailDB = null;
  let query = { apiDomainName: PROJECT_HOSTNAME };
  logger.info('globalDBConnection query', query);
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
    logger.error(`error failed to connect global database :>> ${error}`);
    logger.info(`This url does not exist. Failed to connect to database.`);
    return;
  }

  if (!project) {
    logger.error('This url does not exist. Please publish again.');
    return;
  }
  global.Global_db = null;
  global.Global_builderDB = null;
  const pDatabase = `project_${project.uuid}`;
  // const pcDatabase = `project_config_${project.uuid}`;
  try {
    console.log('Connecting Item Database');
    global.Global_db = await connectProjectDatabase(
      ITEM_DB_HOST,
      pDatabase,
      ITEM_DB_USERNAME,
      ITEM_DB_PASSWORD,
    );
  } catch (error) {
    logger.error(`error Failed to Connect Item Database ${error}`);
    return;
  }
  const itemSet = { host: ITEM_DB_HOST, username: ITEM_DB_USERNAME, password: ITEM_DB_PASSWORD };
  const configSet = {
    host: CONFIG_DB_HOST,
    username: CONFIG_DB_USERNAME,
    password: CONFIG_DB_PASSWORD,
  };

  const isSameSetting = compareMongoSetting(itemSet, configSet);
  if (isSameSetting) {
    console.log('GLOBAL: We are using same config so use same connection');
    global.Global_builderDB = global.Global_db;
  } else {
    console.log('GLOBAL: We are not using same config so create new connection');
    try {
      console.log('Connecting Project Config Database');
      global.Global_builderDB = await connectProjectDatabase(
        CONFIG_DB_HOST,
        pDatabase,
        CONFIG_DB_USERNAME,
        CONFIG_DB_PASSWORD,
      );
    } catch (error) {
      logger.error(`error Failed to Connect Project Config Database ${error}`);
      return;
    }
  }

  console.log('I am setting project ID in global');
  let currentEnvironment = extractEnvironment(project.environments);
  global.Global_projectId = project.uuid;
  global.Global_projectName = project.name;
  global.Global_projectCreatedAt = project.createdAt;
  global.Global_projectConstants = project.constants;
  global.Global_key = project.environments;
  global.Global_timezone = project.timezone;
  global.Global_environment = currentEnvironment;
  global.Global_connectorApiKey = project.connectorApiKey;
  global.Global_projectUrl = project.url;
  global.Global_dateFormat = project.dateFormat;
  global.Global_enableProfiling = project.enableProfiling;
  global.Global_debugMode = project.debugMode;
  global.Global_enableAuditTrail = project.enableAuditTrail;
};

export default globalDBConnection;
