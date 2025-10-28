import express from 'express';
import { sendEmailTemplate, sendDynamicEmail } from './email.controller';

const emailRouter = express.Router();
emailRouter.post('/send/:templateId', sendEmailTemplate);
emailRouter.post('/send-dynamic-mail', sendDynamicEmail);

export default emailRouter;
