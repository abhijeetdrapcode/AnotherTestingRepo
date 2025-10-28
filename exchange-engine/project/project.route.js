import express from 'express';
import {
  showTemplateContent,
  findModalTemplate,
  downloadPDFTemplateContent,
  findSnippetById,
  downloadAgreementTemplateContent,
} from '../email-template/snippet.controller';
import { findTemplateById, listProjectTemplates } from '../email-template/template.controller';
import { buildProject, deleteProject, listProjectPages } from './project.controller';
import { projectDetail } from './project.service';
import sessionValidate from '../middleware/sessionValidate.middleware';
import { tenantMiddleware } from '../middleware/tenant.middleware';
import { verifyJwtForOpen } from '../loginPlugin/jwtUtils';

const projectRouter = express.Router();
projectRouter.post('/build/:projectId/version/:version', buildProject);
projectRouter.delete('/deleteProject', deleteProject);
projectRouter.get('/:projectId/snippet-templates/:templateId/content', showTemplateContent);
projectRouter.get('/:projectId/snippet-templates/:templateId', findSnippetById);
projectRouter.get('/snippet-templates/:templateId', findModalTemplate);
projectRouter.get('/detail', sessionValidate, projectDetail);
projectRouter.get('/templates', sessionValidate, listProjectTemplates);
projectRouter.get('/template/:templateId', sessionValidate, findTemplateById);
projectRouter.get('/pages', listProjectPages);
// Download PDF of Snippet
projectRouter.post(
  '/:projectId/pdf-templates/:templateId/download',
  tenantMiddleware,
  verifyJwtForOpen,
  sessionValidate,
  downloadPDFTemplateContent,
);
projectRouter.post(
  '/:projectId/agreement-templates/:templateId/download',
  tenantMiddleware,
  verifyJwtForOpen,
  sessionValidate,
  downloadAgreementTemplateContent,
);

export default projectRouter;
