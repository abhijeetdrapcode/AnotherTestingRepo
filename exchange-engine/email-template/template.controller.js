import { findTemplate, listTemplates } from './template.service';

export const listProjectTemplates = async (req, res, next) => {
  try {
    let { projectId, query } = req;
    let response = null;
    if (!query) {
      response = await listTemplates(projectId, null, 'EMAIL');
    }
    //TODO: Vijay Don't know what will be here
    //Query
    res.status(200).send(response);
  } catch (e) {
    next(e);
  }
};

export const findTemplateById = async (req, res, next) => {
  try {
    const { projectId, params } = req;
    const response = await findTemplate(projectId, params.templateId);
    res.status(200).send(response);
  } catch (e) {
    next(e);
  }
};
