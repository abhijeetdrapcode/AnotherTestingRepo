const anyFileToText = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    const { parameters, targetElement } = args;
    const {
      collection,
      fieldForPdf,
      fieldForText,
      successMessage,
      errorMessage,
      sendItemIdFrom,
      bslCollection,
      browserStorageLocation,
      itemIdBSLKey,
    } = parameters || {};
    const previousResponse = args.response;
    let response = {};
    let previousActionResponse = sessionStorage.getItem('previousActionResponse');
    const parsedJson = previousActionResponse ? JSON.parse(previousActionResponse) : {};
    let finalItemId = '';

    // Handle modern strategy-based routing
    if (sendItemIdFrom) {
      switch (sendItemIdFrom) {
        case URL_STRATEGIES.CURRENT_OBJECT: {
          const { collectionName, itemId, error } = handleCurrentObjectUrl(previousResponse);
          if (error) return { error };
          if (collectionName && itemId) {
            finalItemId = itemId;
          }
          console.log('🚀 ~ anyFileToText ~ CURRENT_OBJECT finalItemId:', finalItemId);
          break;
        }

        case URL_STRATEGIES.PREVIOUS_STEP: {
          const { collectionName, itemId } = handlePreviousStepUrl(
            previousResponse,
            targetElement,
            true,
          );
          if (collectionName && itemId) {
            finalItemId = itemId;
          }
          console.log('🚀 ~ anyFileToText ~ PREVIOUS_STEP finalItemId:', finalItemId);
          break;
        }

        case URL_STRATEGIES.CURRENT_PAGE: {
          let { collectionItemId, collectionId } = extractCollectionAndItemIdFromPath();
          if (collectionId && collectionItemId) {
            finalItemId = collectionItemId;
          }
          console.log('🚀 ~ anyFileToText ~ CURRENT_PAGE finalItemId:', finalItemId);
          break;
        }

        case URL_STRATEGIES.CURRENT_USER: {
          const currentUser = fetchLoggedInUserJson();
          if (currentUser?.uuid) {
            finalItemId = currentUser.uuid;
          }
          console.log('🚀 ~ anyFileToText ~ CURRENT_USER finalItemId:', finalItemId);
          break;
        }

        case URL_STRATEGIES.TARGET_ITEM: {
          const collectionName = targetElement?.getAttribute('data-collection-id');
          const itemId = targetElement?.getAttribute('data-item-id');
          if (collectionName && itemId) {
            finalItemId = itemId;
          }
          console.log('🚀 ~ anyFileToText ~ TARGET_ITEM finalItemId:', finalItemId);
          break;
        }
        case URL_STRATEGIES.BSL_ITEM: {
          const browserStorageData = await getBSLData(browserStorageLocation);
          const bslDataValue =
            browserStorageData && itemIdBSLKey
              ? _.get(browserStorageData, itemIdBSLKey.trim())
              : '';
          if (bslCollection && bslDataValue) {
            finalItemId = bslDataValue;
          }
          console.log('🚀 ~ anyFileToText ~ BSL_ITEM finalItemId:', finalItemId);
          break;
        }
      }
    } else {
      // Handle legacy parameters when there is response data
      finalItemId = targetElement.getAttribute('data-item-id');
      if (
        typeof finalItemId === 'undefined' ||
        ['', 'undefined', 'null', undefined, null].includes(finalItemId)
      ) {
        finalItemId = '';
      }
      if (!finalItemId && previousResponse) {
        const { collectionSaveOrUpdateResponse } = previousResponse;
        if (collectionSaveOrUpdateResponse) {
          const { data: collectionItemData } = collectionSaveOrUpdateResponse;
          finalItemId = collectionItemData.uuid;
        }
      }
      const dynamicKey = Object.keys(parsedJson)[0];
      if (!finalItemId && dynamicKey) {
        const { [dynamicKey]: collectionValue } = parsedJson;
        finalItemId = collectionValue.uuid;
      }
      console.log('🚀 ~ anyFileToText ~ ELSE finalItemId:', finalItemId);
    }
    console.log('🚀 ~ anyFileToText ~ finalItemId:', finalItemId);

    try {
      const endpoint = `open/collection-form/${collection}/items/${finalItemId}/anyfile-to-text/${fieldForPdf}/${fieldForText}`;
      const result = await unSecuredPostCall({}, endpoint);
      if (result.status === 'success')
        toastr.success(successMessage || 'Set Text in Field', 'Success');
      response.data = { ...previousResponse, ...result };
      response.data.collectionSaveOrUpdateResponse = result;
      response.data.pdfTotext = result;
      response.status = 'success';
    } catch (error) {
      if (error.response) {
        response.data = error.response;
        response.status = 'error';
        toastr.error(errorMessage || `Cannot Set Pdf's text now., Error `);
      }
    } finally {
      actionCompleted(args);
    }
    return response;
  } else {
    return disabledActionResponse(args);
  }
};
