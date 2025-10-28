import express from 'express';
import { generateQR } from './qr.controller';

const qrRouter = express.Router();

qrRouter.post('/generate', generateQR);

export default qrRouter;
