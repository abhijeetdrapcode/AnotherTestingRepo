import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { errorLogger } from 'drapcode-utility';
import collectionFormRoute from './collection-form/collectionForm.route';
import collectionFormOpenRoute from './collection-form/collectionFormOpen.route';
import collectionTableRoute from './collection-table/collectionTable.route';
import loginPluginRoute from './loginPlugin/loginPlugin.route';
import { verifyJwt, verifyJwtForOpen } from './loginPlugin/jwtUtils';
import uploadRoute from './upload-api/upload.route';
import itemRouter from './item/item.route';
import eventRouter from './event/event.route';
import emailRouter from './email/email.route';

import externalApiRouter from './external-api/external-api.route';
import projectRouter from './project/project.route';
import collectionRouter from './collection/collection.route';
import externalApiMiddlewareRoute from './external-api-middleware/external.api.mddleware.route';
import { pluginRouter } from './install-plugin/installedPlugin.route';


import docusignRouter from './docusign/docusign.route';
import {
  AUTH_ROUTE,
  COLLECTION_DETAIL_ROUTE,
  COLLECTION_FORM_AUTH,
  COLLECTION_FORM_OPEN,
  COLLECTION_ITEMS_ROUTE,
  EMAIL_ROUTE,
  EVENT_ROUTE,
  ITEM_ROUTE,
  
  
  PROJECT_ROUTE,
  
  UPLOAD_ROUTE,
  EXTERNAL_API_ROUTE,
  EXTERNAL_API_MIDDLEWARE_ROUTE,
  
  DOCS_API,
  
  
  
  PLUGIN_ROUTE,
  CUSTOM_COMPONENT_ROUTE,
  
  CUSTOM_DATA_MAPPING,
  PROFILER_API,
  
  
  
  
  
  
  
  
  
  
  STRIPE_PAYMENT_METHODS,
  DOCUSIGN_ROUTE,
  
  AUDIT_LOGS_API,
  TYPESENSE_SEARCH_ROUTE,
  META_DATA_MAPPING_ROUTE,
  CUSTOM_FUNCTION_ROUTE,
  SOCKET_IO_ROUTE,
  SIGNZY_ROUTE,
  GOOGLE_ROUTE,
  GITHUB_PUBLISH_ROUTE,
  PINECONE_ROUTE,
  ZOOM_ROUTE,
  CIBIL_ROUTE,
  BOX_ROUTE,
  QR_ROUTE,
} from './route-constants';
import dbConnection from './config/database';

import stripePaymentMethodsRouter from './stripe-payment-methods/stripePaymentMethod.route';



import profilerRouter from './profiling/profiler.routes';

import { tenantMiddleware } from './middleware/tenant.middleware';
import customComponentRoute from './custom-component/customComponent.route';

import customDataMappingRoute from './custom-mapping/customMapping.route';








import sessionValidate from './middleware/sessionValidate.middleware';
import { swaggerMiddleware } from './middleware/swagger.middleware';


import auditLogRouter from './logs/audit/audit.route';
import typesenseSearchRouter from './typesense-search/typesenseSearch.route';
import { closeAllConnections } from './config/mongoUtil';
import metaDataMappingRouter from './meta-data-mapping/metaDataMapping.route';
import customFunctionRoute from './custom-function/customFunction.route';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketWithRedis } from './socket-io/socketManager';
import socketIoRouter from './socket-io/socketIO.route';
import signzyRouter from './signzy/signzy.route';
import googleRouter from './google/google.route';
import { xssSanitizer } from './middleware/sanitizer.middleware';
import { requestLogger } from './middleware/request.middleware';
import githubPublishRoute from './github-publish/githubPublish.route';
import pineconeRouter from './pinecone/pinecone.route';
import { v1Router, v2Router } from './developer/index.route';
import zoomRouter from './zoom/zoom.route';
import cibilRouter from './cibil/cibil.route';
import boxRouter from './box/box.route';
import qrRouter from './qr/qr.route';

require('./loginPlugin/passport');

let APP_PORT = process.env.APP_PORT;
APP_PORT = APP_PORT || 5001;

const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 6003;

const app = express();
//Socket Handling
const server = createServer(app);
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

global.io = io;
setupSocketWithRedis(io);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.raw({ limit: '500mb' }));

const ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION === 'true';
if (ENABLE_COMPRESSION) {
  app.use(compression());
} else {
  // eslint-disable-next-line no-unused-vars
  app.use(compression({ filter: (req, res) => false }));
}

app.use('/', express.static('public'));
app.use(requestLogger);

app.use(
  cors({
    exposedHeaders: ['Content-Disposition', 'jsessionid'],
  }),
);


app.use(dbConnection);

app.use(DOCS_API, swaggerUi.serve, swaggerMiddleware, (req, res) => {
  swaggerUi.setup(req.swaggerSpec, { explorer: true })(req, res);
});
// Cleaning xss value
app.use(xssSanitizer);



app.use(PROJECT_ROUTE, projectRouter);
app.use(AUDIT_LOGS_API, auditLogRouter);

app.use(AUTH_ROUTE, sessionValidate, loginPluginRoute);
app.use(EVENT_ROUTE, eventRouter);
app.use(EMAIL_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, emailRouter);
app.use(ITEM_ROUTE, itemRouter); //Remain
app.use(COLLECTION_ITEMS_ROUTE, sessionValidate, tenantMiddleware, collectionTableRoute);
app.use(EXTERNAL_API_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, externalApiRouter);
app.use(UPLOAD_ROUTE, sessionValidate, uploadRoute);
app.use(COLLECTION_DETAIL_ROUTE, sessionValidate, collectionRouter);
app.use(EXTERNAL_API_MIDDLEWARE_ROUTE, sessionValidate, externalApiMiddlewareRoute);




app.use('/api/v1/developer', tenantMiddleware, v1Router);
app.use('/api/v2/developer', tenantMiddleware, v2Router);
app.use(PLUGIN_ROUTE, sessionValidate, pluginRouter);
app.use(CUSTOM_COMPONENT_ROUTE, customComponentRoute);
app.use(CUSTOM_DATA_MAPPING, verifyJwtForOpen, tenantMiddleware, customDataMappingRoute);
app.use(CUSTOM_FUNCTION_ROUTE, customFunctionRoute);
app.use(PROFILER_API, profilerRouter);


app.use(DOCUSIGN_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, docusignRouter);

app.use(GITHUB_PUBLISH_ROUTE, githubPublishRoute);
app.use(PINECONE_ROUTE, sessionValidate, verifyJwt, tenantMiddleware, pineconeRouter);
/*
Above this will be public API(not authenticated)
Below this all will be authenticated
*/
app.use(
  STRIPE_PAYMENT_METHODS,
  sessionValidate,
  verifyJwtForOpen,
  tenantMiddleware,
  stripePaymentMethodsRouter,
);
app.use(
  COLLECTION_FORM_OPEN,
  sessionValidate,
  verifyJwtForOpen,
  tenantMiddleware,
  collectionFormOpenRoute,
);


app.use(COLLECTION_FORM_AUTH, sessionValidate, verifyJwt, tenantMiddleware, collectionFormRoute);






app.use(
  USER_CONSENT_OTP_ROUTE,
  sessionValidate,
  verifyJwtForOpen,
  tenantMiddleware,
  userConsentOTPRouter,
);
app.use(
  TYPESENSE_SEARCH_ROUTE,
  sessionValidate,
  verifyJwtForOpen,
  tenantMiddleware,
  typesenseSearchRouter,
);
app.use(
  META_DATA_MAPPING_ROUTE,
  sessionValidate,
  verifyJwtForOpen,
  tenantMiddleware,
  metaDataMappingRouter,
);
app.use(SOCKET_IO_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, socketIoRouter);
app.use(SIGNZY_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, signzyRouter);
app.use(GOOGLE_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, googleRouter);
app.use(ZOOM_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, zoomRouter);
app.use(CIBIL_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, cibilRouter);
app.use(BOX_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, boxRouter);
app.use(QR_ROUTE, sessionValidate, verifyJwtForOpen, tenantMiddleware, qrRouter);
app.use(errorLogger);

// define a simple route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to exchange application' });
});

app.all('*', (err, req, res, next) => {
  next(err);
});

app.listen(APP_PORT, () => {
  console.log(`Server is listening on port ${APP_PORT}`);
});

server.listen(WEBSOCKET_PORT, () => {
  console.log(`Websockets Server is listening on port ${WEBSOCKET_PORT}`);
});

mongoose.connection.on('error', (err) => {
  console.error('********** $$$$$$ ********');
  console.error('Connection Broke from Database');
  console.error('Connection Err :>> ', err);
  process.exit(1);
});
mongoose.connection.on('disconnected', function () {
  console.log('Mongoose connection disconnected');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  console.error('Stack Trace:', reason?.stack);
});

// Gracefully handle process termination
process.on('SIGINT', async () => {
  console.log('SIGINT received: Closing MongoDB connections...');
  await closeAllConnections(); // Close DB connections
  process.exit(0); // Exit process
});
