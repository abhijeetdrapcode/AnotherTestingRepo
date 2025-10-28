import express from 'express';
import { handleGithubPush } from './githubPublish.controller';

const githubPublishRoute = express.Router();

githubPublishRoute.post('/push-to-github', handleGithubPush);

export default githubPublishRoute;
