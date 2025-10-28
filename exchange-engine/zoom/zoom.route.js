import express from 'express';
import { createInstantZoomMeet, handleZoomCallback, zoomAuth } from './zoom.controller';

const zoomRouter = express.Router();

zoomRouter.post('/auth', zoomAuth);
zoomRouter.get('/auth/callback', handleZoomCallback);
zoomRouter.post('/create-instant-meeting', createInstantZoomMeet);

export default zoomRouter;
