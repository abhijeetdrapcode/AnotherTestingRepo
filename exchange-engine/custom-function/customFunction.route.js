import express from 'express';
import { saveCustomFunctionLogs, getCustomFunctionLogs } from './customFunction.controller';

const customFunctionRoute = express.Router();

customFunctionRoute.post('/:uuid', saveCustomFunctionLogs);
customFunctionRoute.get('/logs/:functionUUID', getCustomFunctionLogs);

export default customFunctionRoute;
