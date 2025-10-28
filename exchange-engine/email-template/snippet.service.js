import { loadSnippet } from 'drapcode-utility';

export const findSnippet = async (projectId, snippetId) => {
  return loadSnippet(projectId, snippetId);
};
