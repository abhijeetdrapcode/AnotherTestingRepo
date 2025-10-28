import express from 'express';
import { sendDynamicSocket } from './socketIO.controller';

const socketIoRouter = express.Router();
socketIoRouter.post('/send-dynamic-socket', sendDynamicSocket);

export default socketIoRouter;
