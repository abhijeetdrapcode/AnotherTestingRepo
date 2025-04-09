import { findProjectByQuery } from '../project/project.service';
import {
  createConnection,
  connectProjectDatabase,
  passProjectDataInGlobally,
  compareMongoSetting,
} from './database.utils';
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

const GlobalDbConnection = async () => {
  if (!PROJECT_HOSTNAME) {
    console.log('No Project Associated');
    return;
  }
  let environment = '';
  let query = { domainName: PROJECT_HOSTNAME };
  console.log('query dbConnection :>> ', query);
  let pDetailDB = null;
  let project;
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
    console.error(`error failed to connect global database :>> ${error}`);
  }
  if (!project) {
    return console.log('This url does not exist. Please make a build again');
  }
  global.Global_db = null;
  global.Global_builderDB = null;
  const pDatabase = `project_${project.uuid}`;
  // const pcDatabase = `project_config_${uuid}`;

  try {
    global.Global_db = await connectProjectDatabase(
      ITEM_DB_HOST,
      pDatabase,
      ITEM_DB_USERNAME,
      ITEM_DB_PASSWORD,
    );
    console.log('db connected');
  } catch (error) {
    return console.error('error Failed to Connect Project Database', error);
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
    try {
      global.Global_builderDB = await connectProjectDatabase(
        CONFIG_DB_HOST,
        pcDatabase,
        CONFIG_DB_USERNAME,
        CONFIG_DB_PASSWORD,
      );
      console.log('db connected');
    } catch (error) {
      return console.error('error Failed to Connect Project Database', error);
    }
  }

  global.Global_projectId = project.uuid;
  passProjectDataInGlobally(project, environment);
};

export default GlobalDbConnection;
