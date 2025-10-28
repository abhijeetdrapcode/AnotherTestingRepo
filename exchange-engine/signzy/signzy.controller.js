import {
  createConsentRequestService,
  fetchFiDataService,
  eSignDocumentService,
  eSignCallbackService,
  fetchContractDetailsService,
} from './signzy.service';

export const createConsentRequest = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, tenant, user, headers, enableAuditTrail } = req;
    const { userMobileField, consentType, dataItemId, redirectUrl } = body;
    if (!userMobileField)
      return res.status(400).send({ code: 400, error: 'User mobile field is required' });
    if (!consentType) return res.status(400).send({ code: 400, error: 'Consent type is required' });
    const response = await createConsentRequestService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      tenant,
      user,
      headers,
      userMobileField,
      consentType,
      dataItemId,
      redirectUrl,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in createConsentRequest', error);
    next(error);
  }
};

export const fetchFiData = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, tenant, user, enableAuditTrail, headers } = req;
    const { itemId, collectionName, saveItemId, accountHolderField, fiTransactionsField } = body;
    if (!itemId) return res.status(400).send({ code: 400, error: 'Item ID is required.' });
    const response = await fetchFiDataService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      tenant,
      user,
      headers,
      itemId,
      collectionName,
      saveItemId,
      accountHolderField,
      fiTransactionsField,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in fetchFiData', error);
    next(error);
  }
};

export const eSignDocument = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, tenant, headers, user, enableAuditTrail } = req;
    const { authorization } = headers;
    const signerCallbackUrl = `https://${req.get(
      'host',
    )}/api/v1/signzy/document-signing/esign/callback`;
    const signerCallbackUrlAuthorizationHeader = authorization;
    const response = await eSignDocumentService(
      db,
      projectId,
      environment,
      user,
      tenant,
      enableAuditTrail,
      headers,
      body,
      signerCallbackUrl,
      signerCallbackUrlAuthorizationHeader,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in eSignDocument', error);
    next(error);
  }
};

export const eSignCallback = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, user, headers, enableAuditTrail } = req;
    const result = await eSignCallbackService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      user,
      headers,
      body,
    );
    return res.status(result.code).send(result);
  } catch (error) {
    console.error('Callback Error:', error);
    next(error);
  }
};

export const fetchContractDetails = async (req, res, next) => {
  try {
    const { body, projectId, db, environment, tenant, user, enableAuditTrail, headers } = req;
    const {
      itemId,
      collectionName,
      signerIdentifierField,
      signerIdentifierId,
      contractsField,
      saveItemId,
    } = body;
    if (!itemId && !signerIdentifierId)
      return res.status(400).send({ code: 400, error: 'Item ID is required.' });
    const response = await fetchContractDetailsService(
      db,
      projectId,
      environment,
      enableAuditTrail,
      tenant,
      user,
      headers,
      itemId,
      collectionName,
      signerIdentifierField,
      signerIdentifierId,
      contractsField,
      saveItemId,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    console.error('Error in fetchContractDetails', error);
    next(error);
  }
};
