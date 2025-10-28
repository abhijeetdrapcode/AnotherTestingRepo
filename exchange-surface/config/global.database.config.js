// import { findProjectFromFile } from 'drapcode-utility';
// import {
//   createConnection,
//   connectProjectDatabase,
//   passProjectDataInGlobally,
//   compareMongoSetting,
// } from './database.utils';
// let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
// let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
// let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;

// let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

// ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
// ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
// ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

// const GlobalDbConnection = async () => {
//   if (!PROJECT_HOSTNAME) {
//     console.log('No Project Associated');
//     return;
//   }
//   let environment = '';
//   let query = { domainName: PROJECT_HOSTNAME };
//   console.log('query dbConnection :>> ', query);
//   let pDetailDB = null;
//   let project = findProjectFromFile(query);
//   if (!project) {
//     return console.log('This url does not exist. Please make a build again');
//   }
//   global.Global_db = null;
//   global.Global_builderDB = null;
//   const pDatabase = `project_${project.uuid}`;
//   // const pcDatabase = `project_config_${uuid}`;

//   try {
//     global.Global_db = await connectProjectDatabase(
//       ITEM_DB_HOST,
//       pDatabase,
//       ITEM_DB_USERNAME,
//       ITEM_DB_PASSWORD,
//     );
//     console.log('db connected');
//   } catch (error) {
//     return console.error('error Failed to Connect Project Database', error);
//   }

//   const itemSet = { host: ITEM_DB_HOST, username: ITEM_DB_USERNAME, password: ITEM_DB_PASSWORD };

//   global.Global_projectId = project.uuid;
//   passProjectDataInGlobally(project, environment);
// };

// export default GlobalDbConnection;
