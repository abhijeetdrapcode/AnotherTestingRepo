import { loadTemplate, loadTemplates } from 'drapcode-utility';
export const findTemplate = async (projectId, templateId) => {
  return loadTemplate(projectId, templateId);
};
export const listTemplates = async (projectId, parentId, type = '') => {
  let templates = loadTemplates(projectId);
  if (!templates) {
    return [];
  }
  if (parentId) {
    templates = templates.filter((template) => template.parentTemplateId === parentId);
    return templates;
  }
  if (type) {
    templates = templates.filter(
      (template) => template.templateType === type && !template.parentTemplateId,
    );
    return templates;
  }
};
