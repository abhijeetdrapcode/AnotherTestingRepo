import { populateProjectSettingOnRequest } from '../project/project.service';
import { logger } from 'drapcode-logger';
import { serverDomains } from './constants';
import { extractEnvironment } from './envUtil';
import { findProjectFromFile } from 'drapcode-utility';
import { createMongoConnection } from './mongoUtil';

let ITEM_DB_HOST = process.env.ITEM_DB_HOST;
let ITEM_DB_USERNAME = process.env.ITEM_DB_USERNAME;
let ITEM_DB_PASSWORD = process.env.ITEM_DB_PASSWORD;
let PROJECT_HOSTNAME = process.env.PROJECT_HOSTNAME;

const EXCHANGE_ENGINE_DOMAIN = process.env.EXCHANGE_ENGINE_DOMAIN;

ITEM_DB_HOST = ITEM_DB_HOST || 'localhost';
ITEM_DB_USERNAME = ITEM_DB_USERNAME || '';
ITEM_DB_PASSWORD = ITEM_DB_PASSWORD || '';

const dbConnection = async (req, res, next) => {
  const { subdomains, headers, originalUrl, hostname } = req;
  logger.info(`PROJECT_HOSTNAME: >> ${PROJECT_HOSTNAME} hostname: >> ${hostname}`);

  let { origin, referer, projectid } = headers;
  logger.info(`referer :>> ${referer} origin :>> ${origin} originalUrl :>> ${originalUrl}`);
  const condition =
    originalUrl.includes('/api/v1/projects/build') ||
    originalUrl.includes('/api/v1/code-export/process');

  if (condition) {
    logger.warn('I am project build related');
    if (!projectid) {
      return res.status(400).json({ message: 'Not a valid project. Please contact Admin' });
    }

    return next();
  }

  let query = {};
  if (hostname.includes(EXCHANGE_ENGINE_DOMAIN)) {
    let projectSeoName = '';
    logger.info(`subdomains:>> ${subdomains}`);
    projectSeoName = serverDomains.includes(subdomains[0]) ? subdomains[2] : subdomains[1];

    if (!projectSeoName || projectSeoName.toLowerCase() === 'undefined') {
      return res.status(400).send('Please use subdomain');
    }

    if (origin) {
      logger.warn('I am inside origin');
      origin = origin.replace(/^https?:\/\//, '').split(':')[0];
      query.or = [{ seoName: projectSeoName }, { domainName: origin }];
    } else {
      query = { seoName: projectSeoName };
    }
  } else {
    query = { apiDomainName: hostname };
  }
  console.log('query ***** I am testing this', query);
  let project = findProjectFromFile(query);

  if (!project) {
    return res.status(404).send('This url does not exist. Please publish again.');
  }
  req.db = null;
  const pDatabase = `project_${project.uuid}`;
  try {
    const connection = await createMongoConnection({
      host: ITEM_DB_HOST,
      database: pDatabase,
      username: ITEM_DB_USERNAME,
      password: ITEM_DB_PASSWORD,
    });

    req.db = connection;
    logger.info('Connected to project DB');

    let currentEnvironment = extractEnvironment(project.environments);
    req.environment = currentEnvironment;

    project = await populateProjectSettingOnRequest(project);
    req.project = project;
    req.projectId = project.uuid;
    req.timezone = project.timezone;
    req.connectorApiKey = project.connectorApiKey;
    req.projectUrl = project.url;
    req.dateFormat = project.dateFormat;
    req.enableProfiling = project.enableProfiling;
    req.debugMode = project.debugMode;
    req.enableAuditTrail = project.enableAuditTrail;
    console.log('Going to next');
    return next();
  } catch (error) {
    if (req.db) {
      req.db.close();
    }
    logger.error(`Failed to Connect Project Database: ${error}`);
    return res.status(500).send('Database connection error.');
  }
};

export default dbConnection;
