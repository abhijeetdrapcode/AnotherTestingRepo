import { fetchAndSaveFunctionLogs, fetchFunctionLogsByUUID } from './customFunction.services';

export const saveCustomFunctionLogs = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { db, projectId } = req;
    const { actionName, currentEnv } = req.body;

    if (!actionName) {
      return res.status(400).json({ error: 'Missing actionName in request body' });
    }
    console.log('This is also the action Name: ', actionName);
    const result = await fetchAndSaveFunctionLogs(db, projectId, uuid, actionName, currentEnv);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getCustomFunctionLogs = async (req, res) => {
  try {
    const { db, projectId } = req;
    const { functionUUID } = req.params;

    const result = await fetchFunctionLogsByUUID(projectId, functionUUID, db);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching logs:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
