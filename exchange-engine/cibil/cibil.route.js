import express from 'express';
import { getConsumerReport } from './cibil.controller';

const cibilRouter = express.Router();

cibilRouter.post('/consumer-report', getConsumerReport);

export default cibilRouter;
