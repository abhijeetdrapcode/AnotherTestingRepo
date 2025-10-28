import { findProjectFromFile } from 'drapcode-utility';
import { logger } from 'drapcode-logger';
import { extractEnvironment } from './envUtil';
import { createMongoConnection } from './mongoUtil';

let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;
let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

const globalDBConnection = async () => {
  logger.info(`PROJECT_HOSTNAME ${PROJECT_HOSTNAME}`);
  if (!PROJECT_HOSTNAME) {
    console.log('No Project Associated');
    return;
  }
  let query = { apiDomainName: PROJECT_HOSTNAME };
  let project = findProjectFromFile(query);
  logger.info('globalDBConnection query', query);
  if (!project) {
    logger.error('This url does not exist. Please publish again.');
    return;
  }

  const pDatabase = `project_${project.uuid}`;
  try {
    console.log('Connecting Item Database');
    global.Global_db = await createMongoConnection({
      host: ITEM_DB_HOST,
      database: pDatabase,
      username: ITEM_DB_USERNAME,
      password: ITEM_DB_PASSWORD,
    });
  } catch (error) {
    logger.error(`error Failed to Connect Item Database ${error}`);
    return;
  }

  const itemSet = { host: ITEM_DB_HOST, username: ITEM_DB_USERNAME, password: ITEM_DB_PASSWORD };
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
