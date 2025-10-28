const sendEmail = async function (args) {
  const { element, parameters } = args;
  const { sendTo, emailTemplate } = parameters;
  let toEmailAddress = element.elements[sendTo].value;
  const previousActionResponse = args.response;
  const emailTemplateData = previousActionResponse ? previousActionResponse.data : {};
  toEmailAddress = previousActionResponse ? previousActionResponse.data[sendTo] : toEmailAddress;
  let previousActionRes = sessionStorage.getItem('previousActionResponse');
  previousActionRes = previousActionRes ? JSON.parse(previousActionRes) : {};
  let previousActionFormData = sessionStorage.getItem('previousActionFormData');
  previousActionFormData = previousActionFormData ? JSON.parse(previousActionFormData) : {};
  // Get Browser Storage Data Object
  const browserData = await getBrowserData();
  const formData = {
    sendTo: toEmailAddress,
    templateData: emailTemplateData,
    previousActionResponse: previousActionRes,
    previousActionFormData,
    ...browserData,
  };
  if (toEmailAddress && emailTemplate) {
    const endpoint = 'email/send/' + emailTemplate;
    const response = await publicPostCall(formData, endpoint);
    return response;
  } else {
    console.error('Please provide email address and email template');
  }
  return null;
};

const sendDynamicEmail = async function (args) {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    const { parameters, targetElement } = args;
    const { templatesRules } = parameters;
    const eventItemConfig = { dataItemId: '', previousStepId: '', propagateItemId: '' };
    let itemId = targetElement ? targetElement.getAttribute('data-item-id') : '';
    eventItemConfig['dataItemId'] = itemId || '';
    const previousResponse = args.response;
    if (previousResponse) {
      const { collectionSaveOrUpdateResponse } = previousResponse;
      if (collectionSaveOrUpdateResponse) {
        const { data: collectionItemData } = collectionSaveOrUpdateResponse;
        eventItemConfig['previousStepId'] = collectionItemData?.uuid || '';
      }
    }
    let previousActionResponse = sessionStorage.getItem('previousActionResponse');
    previousActionResponse = previousActionResponse ? JSON.parse(previousActionResponse) : {};
    if (previousActionResponse) {
      let collectionKey = `parentCollectionToPropagate`;
      if (previousActionResponse[collectionKey]) {
        let collectionItemId = previousActionResponse[collectionKey].uuid;
        eventItemConfig['propagateItemId'] = collectionItemId;
      }
    }
    let previousActionFormData = sessionStorage.getItem('previousActionFormData');
    previousActionFormData = previousActionFormData ? JSON.parse(previousActionFormData) : {};
    // Get Browser Storage Data Object
    const browserData = await getBrowserData();
    const formData = {
      eventItemConfig,
      templatesRules,
      previousActionResponse,
      previousActionFormData,
      ...browserData,
    };
    let response = {};
    let result = {};
    if (parameters) {
      try {
        const endpoint = 'email/send-dynamic-mail/';
        result = await unSecuredPostCall(formData, endpoint);
        response.data = { ...previousResponse, ...result };
        response.status = 'success';
      } catch (error) {
        console.error('%c==>sendDynamicEmail Error :>> ', 'color:yellow', error);
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

const sendResetPasswordEmail = async function (args) {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    const { element, parameters } = args;
    const { sendTo, emailTemplate, emailServicePlugin = 'AWS_SES' } = parameters;
    const toEmailAddress = element.elements[sendTo].value;
    let alertMessageDiv = element.getElementsByClassName('alert-message')[0];
    let successMessageDiv = element.getElementsByClassName('success-message')[0];
    let emailResponse = null;
    // Get Browser Storage Data Object
    const browserData = await getBrowserData();
    try {
      const emailApiEndpoint = 'auth/forget-password/' + emailTemplate;
      const emailFormData = {
        sendTo: toEmailAddress,
        emailServicePlugin,
        ...browserData,
      };
      emailResponse = await publicPostCall(emailFormData, emailApiEndpoint);
      if (emailResponse.status === 200) {
        element.reset();
        successMessageDiv.innerHTML = 'An email has been sent to this ' + toEmailAddress;
        successMessageDiv.style.display = 'block';
        alertMessageDiv.style.display = 'none';
        return emailResponse;
      }
    } catch (e) {
      console.error(e.response);
      alertMessageDiv.innerHTML = e.response.data['message'];
      alertMessageDiv.style.display = 'block';
      successMessageDiv.style.display = 'none';
      throw e;
    } finally {
      actionCompleted(args);
    }
  } else {
    return disabledActionResponse(args);
  }
};
