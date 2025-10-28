const initiateDocusign = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    const { parameters } = args;
    const {
      successRedirectUrl = '',
      errorRedirectUrl = '',
      successMessage = '',
      errorMessage = '',
    } = parameters;
    let obj = {
      successRedirectUrl,
      errorRedirectUrl,
      successMessage,
      errorMessage,
    };
    let endpoint = `/auth/docusign`;
    obj = JSON.stringify(obj);
    const params = btoa(obj);
    endpoint = `${endpoint}/?params=${params}`;
    actionCompleted(args);
    window.open(endpoint, '_self');
  } else {
    return disabledActionResponse(args);
  }
};

const sendForEsign = async function (args) {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    const { parameters, targetElement } = args;
    let itemId = targetElement ? targetElement.getAttribute('data-item-id') : '';
    let propagateItemId = '';
    const previousResponse = args.response;
    if (!itemId && previousResponse) {
      const { collectionSaveOrUpdateResponse } = previousResponse;
      if (collectionSaveOrUpdateResponse) {
        const { data: collectionItemData } = collectionSaveOrUpdateResponse;
        itemId = collectionItemData.uuid;
      }
    }
    let previousActionResponse = sessionStorage.getItem('previousActionResponse');
    previousActionResponse = previousActionResponse ? JSON.parse(previousActionResponse) : {};
    if (previousActionResponse) {
      let collectionKey = `parentCollectionToPropagate`;
      if (previousActionResponse[collectionKey]) {
        let collectionName = previousActionResponse[collectionKey].name;
        let collectionItemId = previousActionResponse[collectionKey].uuid;
        propagateItemId = collectionItemId;
      }
    }
    let previousActionFormData = sessionStorage.getItem('previousActionFormData');
    previousActionFormData = previousActionFormData ? JSON.parse(previousActionFormData) : {};
    // Get Browser Storage Data Object
    const browserData = await getBrowserData();
    const formData = {
      itemId: itemId,
      propagateItemId,
      templatesRules: parameters.templatesRules,
      previousActionResponse,
      previousActionFormData,
      ...browserData,
    };
    let response = {};
    let result = {};
    if (parameters) {
      try {
        const endpoint = 'docusign/send-for-esign/';
        result = await unSecuredPostCall(formData, endpoint);
        const resultFlag = result?.data?.[0]?.status;
        if (resultFlag === 'success') {
          toastr.success(`Mail sent successfully.`, 'Success!');
        } else if (resultFlag === 'failure') {
          toastr.error('Failed to sent email', 'Error');
        }
        response.data = { ...previousResponse, ...result };
        response.status = 'success';
      } catch (error) {
        console.log('%c==> Error :>> ', 'color:yellow', error);
        if (error.response) {
          response.data = error.response;
          response.status = 'error';
        }
      }
    }
    actionCompleted(args);
    return response;
  } else {
    return disabledActionResponse(args);
  }
};

const fetchDocusignContractDetails = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    const { parameters, targetElement } = args;
    const { errorMessage, successMessage } = parameters;
    let response = {};
    try {
      const fetchEnvelopeDetailsUrl = 'docusign/fetch-envelope-details';
      const { itemId, collectionId } = await getItemIdForSnippet('', args, targetElement);
      const fetchEnvelopeResponse = await unSecuredPostCall(
        { itemId, collectionId },
        fetchEnvelopeDetailsUrl,
      );
      if (fetchEnvelopeResponse && fetchEnvelopeResponse.status === 200) {
        if (successMessage) toastr.success(successMessage, 'Success');
        response.data = fetchEnvelopeResponse;
        response.status = 'success';
      } else {
        console.error('Error in fetching contract Details', fetchEnvelopeResponse);
        if (errorMessage) toastr.error(errorMessage, 'Error');
        response.data = fetchEnvelopeResponse;
        response.status = 'error';
      }
    } catch (error) {
      console.error('Error in fetchDocusignContractDetails', error);
      if (errorMessage) toastr.error(errorMessage, 'Error');
      response.data = error?.response;
      response.status = 'error';
    } finally {
      actionCompleted(args);
    }
    return response;
  } else {
    return disabledActionResponse(args);
  }
};

const fetchDocusignSigningStatus = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    const { parameters, targetElement } = args;
    const { errorMessage, successMessage, getItemIdFrom } = parameters;
    let response = {};
    try {
      const fetchEnvelopeDetailsUrl = 'docusign/fetch-signers-signing-status';
      const { itemId, collectionId } = await getItemIdForSnippet('', args, targetElement);
      const data = { itemId };
      if (getItemIdFrom === 'default') {
        data.collectionId = collectionId;
      }
      const fetchEnvelopeResponse = await unSecuredPostCall(data, fetchEnvelopeDetailsUrl);
      if (fetchEnvelopeResponse && fetchEnvelopeResponse.status === 200) {
        if (successMessage) toastr.success(successMessage, 'Success');
        response.data = fetchEnvelopeResponse;
        response.status = 'success';
      } else {
        console.error('Error in fetching signing status', fetchEnvelopeResponse);
        if (errorMessage) toastr.error(errorMessage, 'Error');
        response.data = fetchEnvelopeResponse;
        response.status = 'error';
      }
    } catch (error) {
      console.error('Error in fetchDocusignSigningStatus', error);
      if (errorMessage) toastr.error(errorMessage, 'Error');
      response.data = error?.response;
      response.status = 'error';
    } finally {
      actionCompleted(args);
    }
    return response;
  } else {
    return disabledActionResponse(args);
  }
};
