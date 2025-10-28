import {
  sendForEsignService,
  saveDocusignTokens,
  docusignTokenGen,
  fetchEnvelopeDetailsService,
  fetchSigningStatusService,
} from './docusign.services.js';
export const sendForEsign = async (req, res, next) => {
  try {
    const {
      projectId,
      db,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
      body,
      project,
    } = req;

    const tokenGenerationResponse = await docusignTokenGen(
      projectId,
      db,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
    );
    if (tokenGenerationResponse.code !== 200) return tokenGenerationResponse;
    const { tokens, docusignPlugin } = tokenGenerationResponse;
    const result = await sendForEsignService(
      body,
      db,
      projectId,
      enableAuditTrail,
      user,
      project.projectConstants,
      environment,
      project.projectName,
      tenant,
      tokens,
      headers,
      docusignPlugin,
    );
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};

export const saveDocusignTokensControllers = async (req, res, next) => {
  try {
    const { projectId, db, body, user, decrypt, enableAuditTrail, environment, headers } = req;
    const finalData = await saveDocusignTokens(
      projectId,
      db,
      body,
      user,
      decrypt,
      enableAuditTrail,
      environment,
      headers,
    );
    res.status(200).json(finalData);
  } catch (error) {
    next(error);
  }
};

export const fetchEnvelopeDetails = async (req, res, next) => {
  try {
    const { db, projectId, body, user, decrypt, environment, tenant, enableAuditTrail, headers } =
      req;
    const { itemId, collectionId } = body;
    if (!itemId) return res.status(400).send({ message: 'itemId is required' });
    const response = await fetchEnvelopeDetailsService(
      db,
      projectId,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
      itemId,
      collectionId,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in fetchEnvelopeDetails controller:', error);
    next(error);
  }
};

export const fetchSigningStatus = async (req, res, next) => {
  try {
    const { db, projectId, body, user, decrypt, environment, tenant, enableAuditTrail, headers } =
      req;
    const { itemId, collectionId } = body;
    if (!itemId) return res.status(400).send({ message: 'itemId is required' });
    const response = await fetchSigningStatusService(
      db,
      projectId,
      user,
      decrypt,
      environment,
      tenant,
      enableAuditTrail,
      headers,
      itemId,
      collectionId,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in fetchSigningStatus controller:', error);
    next(error);
  }
};
