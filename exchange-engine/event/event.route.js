import express from 'express';
import { findAllEvent, findOneEvent } from './event.controller';

/**
 * We are not using Redis for Events
 */
const eventRouter = express.Router();
eventRouter.get('/', findAllEvent);
eventRouter.get('/:eventId', findOneEvent);
export default eventRouter;
