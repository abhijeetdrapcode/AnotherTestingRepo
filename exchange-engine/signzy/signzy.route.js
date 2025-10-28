import express from 'express';
import {
  createConsentRequest,
  fetchFiData,
  eSignDocument,
  eSignCallback,
  fetchContractDetails,
} from './signzy.controller';

const signzyRouter = express.Router();

signzyRouter.post('/account-aggregator/create-consent-request', createConsentRequest);
signzyRouter.post('/account-aggregator/fetch-fi', fetchFiData);
signzyRouter.post('/document-signing/esign-document', eSignDocument);
signzyRouter.post('/document-signing/esign/callback', eSignCallback);
signzyRouter.post('/document-signing/fetch-contract', fetchContractDetails);

export default signzyRouter;
