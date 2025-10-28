import express from 'express';
import { deleteProfiler, listProfiler } from './profiler.controller';
const profilerRoute = express.Router();

profilerRoute.post('/delete', deleteProfiler);
profilerRoute.get('/list', listProfiler);

export default profilerRoute;
