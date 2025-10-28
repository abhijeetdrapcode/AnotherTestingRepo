import express from 'express';
import {
  boxAuth,
  handleBoxCallback,
  uploadFileToBox,
  getBoxFolders,
  saveBoxFolder,
} from './box.controller';

const boxRouter = express.Router();

boxRouter.post('/auth', boxAuth);
boxRouter.get('/auth/callback', handleBoxCallback);
boxRouter.post('/upload', uploadFileToBox);
boxRouter.get('/get-folders', getBoxFolders);
boxRouter.post('/save-folder', saveBoxFolder);

export default boxRouter;
