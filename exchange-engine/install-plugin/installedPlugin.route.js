import express from 'express';
import { findAll } from './installedPlugin.controller';
export const pluginRouter = express.Router();

pluginRouter.get('/', findAll);
