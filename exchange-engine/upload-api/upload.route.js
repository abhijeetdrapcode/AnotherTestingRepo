import express from 'express';
import {
  createFile,
  fileUploadToServer,
  findAllFile,
  multiFileUploadToServer,
  fileUploadToServerWithoutCollectionId,
  fileUploadToServerFileSystem,
  fetchFile,
} from './upload.controller';
import { findOneFileService } from './fileUpload.service';
import { verifyJwtForOpen } from '../loginPlugin/jwtUtils';

const uploadRoute = express.Router();

uploadRoute.post('/upload/:collectionId/:fieldId', verifyJwtForOpen, fileUploadToServer);
uploadRoute.post('/multi-upload/:collectionId/:fieldId', verifyJwtForOpen, multiFileUploadToServer);
uploadRoute.post('/fetch', fetchFile);
uploadRoute.get('/', findAllFile);
uploadRoute.post('/', createFile);
uploadRoute.get('/:fileId', findOneFileService);
uploadRoute.post('/editor', fileUploadToServerWithoutCollectionId);
uploadRoute.post('/upload/local', fileUploadToServerFileSystem);

export default uploadRoute;
