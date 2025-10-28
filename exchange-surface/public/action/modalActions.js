const showModal = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    return await processOpenModal(args);
  } else {
    return disabledActionResponse(args);
  }
};

const closeModal = (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    let el = args.element;
    let foundParent = false;

    while (el && el.parentNode && !foundParent) {
      el = el.parentNode;
      if (el.classList && el.classList.contains('modal')) {
        foundParent = true;
      }
    }
    if (typeof el.classList !== 'undefined') {
      let clearModalContainer = false;
      resetModalCollectionItemData();

      if (el.classList.contains('show')) {
        clearModalContainer = true;
      }

      el.classList.toggle('show');
      const modalId = el.getAttribute('id');

      if (clearModalContainer) {
        const modalContainer = document.querySelector(`#modal-container-${modalId}`);
        modalContainer.innerHTML = ``;
        modalContainer.remove();
      }
    }
    actionCompleted(args);
    return null;
  } else {
    return disabledActionResponse(args);
  }
};

const displaySubPage = async (args) => {
  const actionEnabled = isActionEnabled(args);
  console.log('🚀 ~ displaySubPage ~ actionEnabled:', actionEnabled);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    const { targetElement, parameters } = args;
    const { pageSubPageComponents, subPage } = parameters;
    const projectId = localStorage.getItem('projectId');

    const subPageElementId = pageSubPageComponents.split(':')[1];
    const subPageElement = document.getElementById(subPageElementId);
    const subPageId = subPage ? subPage : '';
    await loadSubpageComponent(
      projectId,
      subPageId,
      subPageElementId,
      subPageElement,
      targetElement,
      args,
    );
  }
};

const loadSubpageComponent = async (
  projectId,
  subPageId,
  subPageElementId,
  subPageElement,
  targetElement,
  args = '',
) => {
  const subId = subPageElement.getAttribute('data-subpage-id');
  if (subId !== subPageId) subPageElement.setAttribute('data-subpage-id', subPageId);
  const placeholderItem = createContentPlaceholder(1, subPageElementId, subPageElement.className);
  subPageElement.innerHTML = placeholderItem;
  if (subPageId) {
    const lang = localStorage.getItem('lang');
    const endpoint = `projects/${projectId}/snippet-templates/${subPageId}${
      lang ? `?lang=${lang}` : ''
    }`;
    try {
      const response = await publicGetCall(endpoint);
      if (response && response.status === 200) {
        let scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
        const subPageTemplate = response.data;
        if (!subPageTemplate) return '';
        const { content: subPage } = subPageTemplate;
        let subPageHtml = subPage['nocode-html']
          ? subPage['nocode-html'].replace(scriptRegex, '')
          : '';
        subPageHtml = replaceNbsps(subPageHtml);

        const subPageCss = subPage['nocode-css'];
        const subPageComponents = subPage['nocode-components'];
        const subPageComponentScripts = scriptRegex.exec(subPage['nocode-html']);
        let element = targetElement;
        let elementCollectionId = '';
        let elementItemId = '';
        const itemIdObj = await getItemIdForSnippet(
          subPageTemplate.collectionId,
          args,
          element,
          subPageElement,
        );
        elementCollectionId = itemIdObj.collectionId;
        elementItemId = itemIdObj.itemId;

        const dcMetaExists = document.getElementById('dcmeta') !== null;
        console.log('🚀 ~ loadSubpageComponent ~ dcMetaExists:', dcMetaExists);
        if (!dcMetaExists) {
          await addEventsScriptForSnippet(subPage, subPageElement);
        }
        subPageElement.setAttribute('data-collection-id', elementCollectionId);
        subPageElement.setAttribute('data-item-id', elementItemId);
        subPageElement.innerHTML = '';
        subPageElement.innerHTML += `<style>${subPageCss}</style>`;
        subPageElement.innerHTML += subPageHtml;
        subPageElement.style.height = '';

        const hasCalendarComponent =
          subPageHtml.includes('data-js="calendar"') ||
          subPageHtml.includes('data-js="calendar-timeslot"');
        if (hasCalendarComponent) {
          const fullCalendarJsSrc =
            'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.9/index.global.min.js';
          loadCdnScriptDynamically(fullCalendarJsSrc, subPageElement);
        }

        if (subPageComponentScripts && subPageComponentScripts.length > 0)
          addComponentScriptToElem(subPageComponentScripts[1], subPageElement);

        addModalExternalScriptUrl(subPageTemplate, subPageElement);
        addModalCustomScript(subPageTemplate, subPageElement);
        let compVisibilityDataJson = {};

        const BROWSER_STORAGE_LOCATION_KEY = 'data-bsl';
        let bslElems = subPageElement.querySelectorAll(`[${BROWSER_STORAGE_LOCATION_KEY}]`);
        console.log('🚀 ~ SUBPAGE loadSubpageComponent ~ bslElems:', bslElems);

        if (bslElems && bslElems.length) {
          bslElems.forEach((bslElem) => {
            bslElem.innerHTML = '';
          });
        }
        if (targetElement) {
          const sessionValue = processSubpageItemIdFromSession(
            subPageElementId,
            subPageId,
            elementCollectionId,
            elementItemId,
          );
          elementCollectionId = sessionValue.elementCollectionId;
          elementItemId = sessionValue.elementItemId;
        }
        if (elementCollectionId) {
          // Load Dynamic Data From Session or DB
          const collectionItemData = { collectionId: elementCollectionId, itemId: elementItemId };
          const COLLECTION_DATA_FIELD = `data-${elementCollectionId}`;
          let textContentElements = subPageElement.querySelectorAll(`[${COLLECTION_DATA_FIELD}]`);
          console.log(
            '🚀 ~ SUBPAGE loadSubpageComponent ~ textContentElements:',
            textContentElements,
          );

          if (textContentElements && textContentElements.length) {
            textContentElements.forEach((textContentElement) => {
              textContentElement.innerHTML = '';
            });
          }

          const {
            collectionFrom,
            externalApiId,
            collectionId: snippetCollectionId,
          } = subPageTemplate;
          const modalHasExternalApi =
            collectionFrom && collectionFrom === 'EXTERNAL_API' && externalApiId ? true : false;
          const snippetHasCollection =
            collectionFrom && collectionFrom === 'COLLECTION' && snippetCollectionId ? true : false;
          console.log(
            '🚀 ~ SUBPAGE loadSubpageComponent ~ modalHasExternalApi:',
            modalHasExternalApi,
            'snippetHasCollection:',
            snippetHasCollection,
          );

          let externalApiData = {};
          if (modalHasExternalApi) {
            const externalApiObj = await renderForModalExternalAPI(subPageTemplate, subPageElement);
            populateExternalApiData(externalApiObj, externalApiData, externalApiId);
          }

          const { itemData, collectionId, collectionItemId } = await getModalItemData(
            collectionItemData,
            modalHasExternalApi,
            externalApiData,
          );

          loadDynamicFilterDataIntoElements(true, modalHasExternalApi);

          const dataField = `data-${collectionId}`;
          const dataURLField = `data-url-${collectionId}`;
          const dataImageTag = `data-img-src-${collectionId}`;
          const dataVideoTag = `data-video-src-${collectionId}`;
          const dataAudioTag = `data-audio-src-${collectionId}`;

          if (collectionId && collectionItemId && itemData) {
            setModalCollectionItemData(itemData, true);

            let hyperLinks = subPageElement.querySelectorAll('[data-path-collection-name]');
            let imageElements = subPageElement.querySelectorAll('[' + dataImageTag + ']');
            let videoElements = subPageElement.querySelectorAll('[' + dataVideoTag + ']');
            let audioElements = subPageElement.querySelectorAll('[' + dataAudioTag + ']');
            let textContentElements = subPageElement.querySelectorAll('[' + dataField + ']');
            let urlContentElements = subPageElement.querySelectorAll('[' + dataURLField + ']');
            let allPageButtonsAndLinks = subPageElement.querySelectorAll(' a, button');
            let childDataGroupFile = subPageElement.querySelectorAll(
              '[data-js="child-data-group-file"]',
            );
            const formElements = subPageElement.querySelectorAll('form');
            if (
              (textContentElements ||
                imageElements ||
                hyperLinks ||
                urlContentElements ||
                videoElements ||
                childDataGroupFile ||
                audioElements) &&
              collectionId &&
              collectionItemId
            ) {
              if (itemData) {
                textContentElements.forEach((textElement) => {
                  let fieldName = textElement.getAttribute(dataField);
                  let type = textElement.getAttribute('type');
                  if (fieldName.includes('"') && 'functionType' in JSON.parse(fieldName)) {
                    textElement.innerHTML = getDerivedFieldData(fieldName, itemData);
                  } else {
                    if (type === 'reference' || type === 'belongsTo') {
                      const { nestedFieldName } = JSON.parse(textElement.getAttribute('metaData'));
                      if (!fieldName.includes('.')) {
                        fieldName = fieldName + '.' + nestedFieldName;
                      }
                    }
                    //TODO: testing on bases field type (only for boolean now)
                    const fieldType = textElement.getAttribute('data-field-type');
                    //Override Field name based on Response Mapping for Non-Persistent Data
                    // fieldName = checkAndOverrideFieldForNonPersistentCollection(itemData, fieldName);
                    const value = parseValueFromData(itemData, fieldName) || '';
                    if (htmlRegex.test(value)) {
                      textElement.innerHTML = value;
                    } else if (fieldType === 'boolean') {
                      textElement.textContent = value ? 'Yes' : 'No';
                    } else {
                      textElement.textContent = value;
                    }
                  }
                  textElement.style.display = 'block';
                });
                hyperLinks.forEach((element) => {
                  const fieldName = element.getAttribute('data-path-field-name');
                  if (fieldName) {
                    if (
                      !(
                        element.hasAttribute('data-gjs') &&
                        element.getAttribute('data-gjs') === 'data-table-link'
                      )
                    ) {
                      const href = element.getAttribute('href');
                      let fieldHref = fieldName ? parseValueFromData(itemData, fieldName) : '';

                      if (fieldHref && typeof fieldHref === 'string' && fieldHref.includes(',')) {
                        fieldHref = fieldHref.split(', ');
                        fieldHref = fieldHref[0];
                      }

                      const replaceHref = href.replace(fieldName, fieldHref);
                      element.setAttribute('href', replaceHref);
                    }
                  }
                });
                urlContentElements.forEach((element) => {
                  const fieldType = element.getAttribute('data-field-type');
                  if (fieldType === 'file') {
                    replaceContentOfFileLinkElements(itemData, element, dataURLField);
                  } else {
                    const fieldName = element.getAttribute(dataURLField);
                    let href = element.getAttribute('href');
                    if (!href || href === '#') href = element.getAttribute(dataURLField);
                    const replaceHref = href.replace(
                      fieldName,
                      parseValueFromData(itemData, fieldName),
                    );
                    element.setAttribute('href', replaceHref);
                  }
                });
                imageElements.forEach((imageElement) => {
                  const fieldName = imageElement.getAttribute(dataImageTag);
                  const previewIcon = elementAttribute(imageElement, 'data-preview-icon');
                  let itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                  if (Array.isArray(itemImageData)) {
                    itemImageData = itemImageData[0];
                  }
                  let imageSrcUrl;
                  if (itemImageData) {
                    if (typeof itemImageData === 'object') {
                      const imageKey = itemImageData.key;
                      if (imageKey)
                        imageSrcUrl = previewIcon
                          ? itemImageData[previewIcon]
                          : itemImageData.isPrivate === true
                          ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-img.png`
                          : imageServerUrl() + imageKey;
                    } else if (
                      typeof itemImageData === 'string' &&
                      itemImageData.startsWith('http')
                    ) {
                      imageSrcUrl = itemImageData;
                    }
                    imageElement.src = imageSrcUrl;
                    if (itemImageData.isPrivate === true) {
                      addDownloadAttributeForPrivateFiles(
                        imageElement,
                        itemImageData,
                        itemData.uuid,
                      );
                    }
                  }
                });
                videoElements.forEach((videoElement) => {
                  const fieldName = videoElement.getAttribute(dataVideoTag);
                  const videoType = videoElement.getAttribute('data-video-type');
                  let itemVideoData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                  if (
                    itemVideoData &&
                    ['youtube-nocookie', 'youtube', 'vimeo'].includes(videoType)
                  ) {
                    const iframeVideoSrc = videoElement.getAttribute('src');
                    videoElement.src = iframeVideoSrc
                      ? getIframeVideoUrlForYoutubeOrVimeo(iframeVideoSrc, itemVideoData, videoType)
                      : '';
                  } else if (itemVideoData) {
                    videoElement.src = itemVideoData;
                  } else {
                    videoElement.src = '';
                  }
                });
                audioElements.forEach((audioElement) => {
                  const fieldName = audioElement.getAttribute(dataAudioTag);
                  const audioType = audioElement.getAttribute('data-audio-type');
                  const isAutoplay = audioElement.hasAttribute('autoplay')
                    ? audioElement.getAttribute('autoplay')
                    : false;
                  const itemAudioData = fieldName ? parseValueFromData(itemData, fieldName) : '';

                  if (itemAudioData) {
                    if (audioType === 'file') {
                      audioElement.src =
                        itemAudioData.isPrivate === true
                          ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-audio.png`
                          : imageServerUrl() + itemAudioData.key;

                      if (itemAudioData.isPrivate === true) {
                        addDownloadAttributeForPrivateFiles(
                          audioElement,
                          itemAudioData,
                          itemData.uuid,
                        );
                      }
                    } else {
                      audioElement.src = itemAudioData;
                    }
                    if (isAutoplay) {
                      audioElement.autoplay = true;
                      audioElement.play();
                    }
                  } else {
                    audioElement.src = '';
                  }
                });
                allPageButtonsAndLinks.forEach((element) => {
                  const isParentIsCMS = element.closest(
                    '[data-js="data-table"], [data-js="data-group"], [data-js="child-data-group"], [data-js="data-list"],[data-js="search-form"],[data-js="child-data-group-file"] ',
                  );
                  if (!isParentIsCMS) element.setAttribute('data-item-id', itemData['uuid']);
                });
                childDataGroupFile.forEach((element) => {
                  replaceInnerGroupFile(collectionId, itemData, element, stylesMap);
                });

                /* Initialise the magnificPopup on Images */
                $('.child-data-group-file[data-field-type=image]').each(function () {
                  let imgElement = this;
                  const elementType = imgElement.tagName;
                  if (elementType !== 'IMG') {
                    imgElement = elementSelector(this, 'img');
                  }
                  if (imgElement && imgElement.hasAttribute('data-enable-popup')) {
                    const anchorParentElem = imgElement.closest('A');
                    const hasAnchorParentElem = !!anchorParentElem;
                    if (hasAnchorParentElem) {
                      // the containers for all your galleries
                      $(this).magnificPopup({
                        delegate: 'a', // the selector for gallery item
                        type: 'image',
                        gallery: {
                          enabled: true,
                        },
                      });
                    }
                  }
                });
                // const loggedInUser = isLoggedInUser() ? fetchLoggedInUserJson() : {};
                // const currentTenant = isLoggedInTenant() ? fetchCurrentTenantJson() : {};
                formElements.forEach((elem) => {
                  if (itemData) elem.setAttribute('data-item', JSON.stringify(itemData));
                  if (collectionItemId) elem.setAttribute('data-item-id', collectionItemId);
                  if (collectionId) elem.setAttribute('data-collection-id', collectionId);
                  // TODO: Need to review this and modify this general use case
                  // const check = !elem.closest('[data-js="data-group"]');
                  // if (check) {
                  //   replaceItemAndCollectionInForm(
                  //     elem,
                  //     itemData,
                  //     itemData,
                  //     loggedInUser,
                  //     currentTenant,
                  //   );
                  // }
                });
                setItemToStripePaymentMethodComponent(
                  subPageElement,
                  elementCollectionId,
                  elementItemId,
                  itemData,
                );
              }
            }

            const formEl = subPageElement.querySelector(
              '[data-form-collection=' + collectionId + ']',
            );

            if (formEl) collectionFormDetailForModalUpdate(formEl, itemData);
            //Preparing compVisibilityDataJson with itemData for Component Visbility condition handling
            compVisibilityDataJson = {
              itemData,
            };
          }
          await addDynamicDataIntoFormElements(itemData, false, subPageElement);
        } else {
          resetModalCollectionItemData();
          await addDynamicDataIntoFormElements(null);
        }
        const listComponents = extractModalFormComponents(subPageComponents);
        await checkAndCreateValidationJS(listComponents, subPageElement);
        processVisibilityElements(subPageElement, compVisibilityDataJson, 'Subpage');
        loadSessionDataIntoElements(true, '', '[data-subpage-id]');
        loadPreviousActionResponseDataIntoElements(true, {}, {}, '[data-subpage-id]');
        loadSessionTenantDataIntoElements(true, '', '[data-subpage-id]');
        loadSessionUserSettingsDataIntoElements(true, '', '[data-subpage-id]');
        loadSessionSubTenantDataIntoElements(true, '', '[data-subpage-id]');
        const typesenseSearchElement = subPageElement.querySelectorAll(
          '[data-typesense-search-component]',
        );
        if (typesenseSearchElement && typesenseSearchElement.length > 0) {
          typesenseSearchElement.forEach((component) => {
            renderTypesenseSearch(component);
          });
        }
        //Check for Field Types and Apply modifying functions
        await checkForTextAreaType('[data-subpage-id]');
        checkForDateType('[data-subpage-id]');
        checkForSelectType('[data-subpage-id]');
        checkForTimepickerType('[data-subpage-id]');
        checkForSegregatedDateType('[data-subpage-id]');
        // TODO: Need to remove because we are loading it by default
        await checkForTelType('[data-subpage-id]');
      }
    } catch (e) {
      console.error('Subpage Error: ', e);
    } finally {
      actionCompleted(args);
    }
  }
};

const conditionalOpenModal = async (args) => {
  const actionEnabled = isActionEnabled(args);
  console.log('🚀 ~ conditionalOpenModal ~ actionEnabled:', actionEnabled);
  if (actionEnabled) {
    // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
    new Promise(function (resolve, reject) {
      resolve(args);
    });
    const { element, parameters, response } = args ? args : '';
    const { collectionFrom, fieldName, modalOpenRules, collectionName } = parameters;

    let fieldValueOfItem = await getFieldValueOfItem(
      collectionFrom,
      collectionName,
      fieldName,
      element,
      response,
    );
    let applyDefaultModalOpenRule = true;

    await Promise.all(
      modalOpenRules.map(async (modalOpenRule) => {
        // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
        new Promise(function (resolve, reject) {
          resolve(modalOpenRule);
        });
        const { fieldValue, modal } = modalOpenRule;
        if (fieldValue === fieldValueOfItem) {
          applyDefaultModalOpenRule = false;
          const modalParamArgs = {
            modal: modal,
            enableMultiSelect: '',
          };
          const modalArgsParams = { ...args['parameters'], ...modalParamArgs };
          args['parameters'] = { ...modalArgsParams };

          //Call processOpenModal to Open Modal
          await processOpenModal(args);
        }
      }),
    );

    if (applyDefaultModalOpenRule) {
      const defaultModalOpenKeywords = ['null', 'NULL', 'DEFAULT', 'EMPTY'];
      const defaultModalOpenRule =
        modalOpenRules && modalOpenRules.length
          ? modalOpenRules.find((modalOpenRule) =>
              defaultModalOpenKeywords.includes(modalOpenRule.fieldValue.trim()),
            )
          : '';

      if (defaultModalOpenRule) {
        const { modal } = defaultModalOpenRule;
        const modalParamArgs = {
          modal: modal,
          enableMultiSelect: '',
        };
        const modalArgsParams = { ...args['parameters'], ...modalParamArgs };
        args['parameters'] = { ...modalArgsParams };

        //Call processOpenModal to Open Modal
        await processOpenModal(args);
      }
    }
  } else {
    return disabledActionResponse(args);
  }
};

const conditionalOpenSubpage = async (args) => {
  const actionEnabled = isActionEnabled(args);
  console.log('🚀 ~ conditionalOpenSubpage ~ actionEnabled:', actionEnabled);
  if (actionEnabled) {
    try {
      // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
      new Promise(function (resolve, reject) {
        resolve(args);
      });
      const { element, parameters, response, targetElement } = args ? args : '';
      const { collectionFrom, collectionName, fieldName, subpageOpenRules, pageSubPageComponents } =
        parameters;
      const projectId = localStorage.getItem('projectId');
      const subPageElementId = pageSubPageComponents.split(':')[1];
      const subPageElement = document.getElementById(subPageElementId);

      let fieldValueOfItem = await getFieldValueOfItem(
        collectionFrom,
        collectionName,
        fieldName,
        element,
        response,
      );

      let applyDefaultSubpageOpenRule = true;
      await Promise.all(
        subpageOpenRules.map(async (subpageOpenRule) => {
          // Force promise to support Safari browser & fix Unhandled Promise Rejection on IOS device browsers
          new Promise(function (resolve, reject) {
            resolve(subpageOpenRule);
          });
          const { fieldValue, modal: subPage } = subpageOpenRule;
          if (fieldValue === fieldValueOfItem) {
            applyDefaultSubpageOpenRule = false;
            const subPageId = subPage ? subPage : '';
            //Call loadSubpageComponent to Open Modal
            await loadSubpageComponent(
              projectId,
              subPageId,
              subPageElementId,
              subPageElement,
              targetElement,
            );
          }
        }),
      );

      if (applyDefaultSubpageOpenRule) {
        const defaultSubpageOpenKeywords = ['null', 'NULL', 'DEFAULT', 'EMPTY'];
        const defaultSubpageOpenRule =
          subpageOpenRules && subpageOpenRules.length
            ? subpageOpenRules.find((subpageOpenRule) =>
                defaultSubpageOpenKeywords.includes(subpageOpenRule.fieldValue.trim()),
              )
            : '';

        if (defaultSubpageOpenRule) {
          const { modal: subPage } = defaultSubpageOpenRule;
          const subPageId = subPage ? subPage : '';
          //Call loadSubpageComponent to Open Modal
          await loadSubpageComponent(
            projectId,
            subPageId,
            subPageElementId,
            subPageElement,
            targetElement,
          );
        }
      }
    } catch (error) {
      console.log('\n error :>> ', error);
    }
  } else {
    return disabledActionResponse(args);
  }
};

const openFloatingModal = async (args) => {
  const actionEnabled = isActionEnabled(args);
  if (actionEnabled) {
    return await processFloatingModal(args);
  } else {
    return disabledActionResponse(args);
  }
};

const getFieldValueOfItem = async (
  collectionFrom,
  collectionName,
  fieldName,
  element,
  response,
) => {
  const form = element && element.tagName === 'FORM' ? element : '';
  let collectionItem = element.dataset.collectionItem
    ? JSON.parse(element.dataset.collectionItem)
    : {};
  let itemDataForFieldValue = {};
  if (collectionFrom === 'collections') {
    if ((!collectionItem || !Object.keys(collectionItem).length) && form) {
      const submitBtnElem = form.querySelector('button[type=submit]');
      const collectionItemId = submitBtnElem ? submitBtnElem.getAttribute('data-item-id') : '';
      if (collectionItemId) {
        const collectionItemData = await getCollectionItemById(collectionName, collectionItemId);
        if (collectionItemData) {
          collectionItem = { ...collectionItemData };
        }
      }
    }
    itemDataForFieldValue = collectionItem;
  } else if (collectionFrom === 'collectionForm') {
    collectionItem =
      response && response.collectionSaveOrUpdateResponse
        ? response.collectionSaveOrUpdateResponse.data
        : {};
    itemDataForFieldValue = collectionItem;
  } else if (collectionFrom === 'page') {
    const { itemData } = await getPageItemData();
    itemDataForFieldValue = itemData;
  } else if (collectionFrom === 'session') {
    const loggedInUser = fetchLoggedInUserJson();
    itemDataForFieldValue = loggedInUser || {};
  }

  let fieldValueOfItem = '';
  if (collectionFrom === 'sessionActionResponse') {
    fieldValueOfItem = parseSessionObject(fieldName);
    if (fieldValueOfItem) {
      fieldValueOfItem = fieldValueOfItem.toString();
    }
  } else {
    fieldValueOfItem = parseValueFromData(itemDataForFieldValue, fieldName);
  }
  return fieldValueOfItem;
};

async function processOpenModal(args) {
  const { targetElement, parameters } = args || {};
  const { modal: modalData, enableMultiSelect } = parameters || {};
  const CUSTOM_MODAL_SEPARATOR = '!@#$#@!';

  const modalIdList = modalData.split(CUSTOM_MODAL_SEPARATOR);
  const modalId = modalIdList[0]; // Modal Element ID
  const modalUUID = modalIdList[1]; // Snippet Modal UUID

  // Handling Bulk Update Feature
  let selectedCollectionItems = [];

  if (enableMultiSelect) {
    const parentTableDiv = targetElement.closest('[data-js="data-table"]');
    const parentTable = parentTableDiv.querySelector('table');
    const itemCheckboxes = parentTable.querySelectorAll('[data-gjs=' + 'dt-item-check' + ']');

    for (let index = 0; index < itemCheckboxes.length; index++) {
      if (itemCheckboxes[index].type == 'checkbox' && itemCheckboxes[index].checked) {
        if (itemCheckboxes[index]) {
          selectedCollectionItems.push(itemCheckboxes[index].getAttribute('data-item-id'));
        }
      }
    }
  }
  const lang = localStorage.getItem('lang');
  const endpoint = `projects/snippet-templates/${modalUUID}${lang ? `?lang=${lang}` : ''}`;

  try {
    const response = await publicGetCall(endpoint);
    if (response && response.status === 200) {
      let scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
      const modal = response.data;
      let modalHtml = modal.content['nocode-html']
        ? modal.content['nocode-html'].replace(scriptRegex, '')
        : '';
      modalHtml = replaceNbsps(modalHtml);

      const modalCss = modal.content['nocode-css'];
      const modalComponents = modal.content['nocode-components'];
      const modalComponentScripts = scriptRegex.exec(modal.content['nocode-html']);
      const defaultFormExist = checkComponents(modalComponents);
      const modalContainer = document.createElement('div');
      let element = targetElement;
      let elementCollectionId = '';
      let elementItemId = '';
      const itemIdObj = await getItemIdForSnippet(modal.collectionId, args, element);
      elementCollectionId = itemIdObj.collectionId;
      elementItemId = itemIdObj.itemId;
      if (modal.collectionId) {
        if (elementCollectionId) {
          modalContainer.setAttribute('data-collection-id', elementCollectionId);
        } else {
          modalContainer.setAttribute('data-collection-id', modal.collectionId);
        }
        modalContainer.setAttribute('data-item-id', elementItemId);
      } else {
        elementCollectionId = '';
        elementItemId = '';
      }
      modalContainer.id = `modal-container-${modalId}`;
      modalContainer.innerHTML = `<style>${modalCss}</style>`;
      modalContainer.innerHTML += modalHtml;

      const hasCalendarComponent =
        modalHtml.includes('data-js="calendar"') ||
        modalHtml.includes('data-js="calendar-timeslot"');
      if (hasCalendarComponent) {
        const fullCalendarJsSrc =
          'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.9/index.global.min.js';
        loadCdnScriptDynamically(fullCalendarJsSrc, modalContainer);
      }

      if (modalComponentScripts && modalComponentScripts.length > 0) {
        addComponentScriptToElem(modalComponentScripts[1], modalContainer);
        resetModalCollectionItemData();
      }

      const calendarEventElem = args.element;
      let isCalenderEventElem = calendarEventElem
        ? calendarEventElem.classList.contains('fc-event') ||
          calendarEventElem.classList.contains('fc-event-title') ||
          calendarEventElem.classList.contains('fc-event-time') ||
          calendarEventElem.classList.contains('fc-event-title-container') ||
          calendarEventElem.classList.contains('fc-event-main-frame')
        : '';

      const isCalenderInListView = targetElement
        ? targetElement.classList.contains('fc-listWeek-view')
        : '';

      if (isCalenderEventElem || isCalenderInListView) {
        let selectedCalenderEventElem =
          calendarEventElem.tagName !== 'A' ? calendarEventElem.closest(`a`) : calendarEventElem;

        /**
         * Second pass to get Calendar Event Element from List View
         */
        if (
          !selectedCalenderEventElem ||
          (selectedCalenderEventElem &&
            !selectedCalenderEventElem.hasAttribute('data-collection-id') &&
            !selectedCalenderEventElem.hasAttribute('data-item-id'))
        ) {
          selectedCalenderEventElem = calendarEventElem.closest(`tr`);
        }

        if (
          selectedCalenderEventElem &&
          selectedCalenderEventElem.hasAttribute('data-collection-id') &&
          selectedCalenderEventElem.hasAttribute('data-item-id')
        ) {
          //Extract Collection & Item ID from Calender Event
          elementCollectionId = selectedCalenderEventElem
            ? selectedCalenderEventElem.getAttribute('data-collection-id')
            : '';
          elementItemId = selectedCalenderEventElem
            ? selectedCalenderEventElem.getAttribute('data-item-id')
            : '';
        }
      }

      if (defaultFormExist && !elementCollectionId) {
        if (modal.collectionId) {
          //Extract Collection ID from Modal Collection
          elementCollectionId = modal.collectionId;
        } else {
          //Extract Collection ID from Modal Collection Form
          const modalContainerId = modalContainer.getAttribute('id');
          const modalFormElems = extractModalFormComponent(modalContainerId);
          const modalFormElem = modalFormElems ? modalFormElems[0] : '';
          const dataFormCollection = modalFormElem
            ? modalFormElem.getAttribute('data-form-collection')
            : '';

          elementCollectionId = dataFormCollection;
        }
      }

      /**
       * ?INFO -> Append Modal Container to Page Body
       * when modal doesn't have a Collection
       * */
      if (!elementCollectionId) {
        document.body.appendChild(modalContainer); // Append Dynamic Modal Container to Page Body
        const listComponents = extractModalFormComponents(modalComponents);
        await checkAndCreateValidationJS(listComponents, modalContainer);
      }
      const dcMetaExists = document.getElementById('dcmeta') !== null;
      console.log('🚀 ~ processOpenModal ~ dcMetaExists:', dcMetaExists);
      if (!dcMetaExists) {
        addEventsScriptForSnippet(modal.content, modalContainer); //INFO: Loading Events in case of Build/Publish case
      }
      addModalExternalScriptUrl(modal, modalContainer);
      addModalCustomScript(modal, modalContainer);

      const { constants: projectConstant, environments } = await getProjectDetail();
      const { collectionFrom, externalApiId } = modal;
      const modalHasExternalApi =
        collectionFrom && collectionFrom === 'EXTERNAL_API' && externalApiId ? true : false;

      let externalApiData = {};
      if (modalHasExternalApi) {
        const externalApiObj = await renderForModalExternalAPI(modal, modalContainer);
        populateExternalApiData(externalApiObj, externalApiData, externalApiId);
      }
      let compVisibilityDataJson = {};
      if (elementCollectionId) {
        // Load Dynamic Data From Session or DB
        const collectionItemData = { collectionId: elementCollectionId, itemId: elementItemId };

        //Clear Item Data from Session Storage on each Modal Open
        removeCollectionItemSessionKey(elementCollectionId, elementItemId);

        const { itemData, collectionId, collectionItemId } = await getModalItemData(
          collectionItemData,
          modalHasExternalApi,
          externalApiData,
        );

        console.log('==> Going to remove __ssr_dm_ keys from session storage via modal...');
        Object.keys(sessionStorage).map((sst) => {
          if (sst.startsWith('__ssr_dm_')) {
            sessionStorage.removeItem(sst);
          }
        });

        if (collectionId && collectionItemId && itemData) {
          console.log('==> Setting __ssr_dm_ keys in session storage...');
          const sessionStorageKey = `__ssr_dm_colItem_${collectionId}_${collectionItemId}`;
          const sessionStorageKeyCollection = `__ssr_dm_colId`;
          const sessionStorageKeyItem = `__ssr_dm_colItemId`;
          Object.keys(sessionStorage).map((sst) => {
            if (sst.startsWith('__ssr_dm_')) {
              sessionStorage.removeItem(sessionStorageKey);
            }
          });
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(itemData));
          sessionStorage.setItem(sessionStorageKeyCollection, collectionId);
          sessionStorage.setItem(sessionStorageKeyItem, collectionItemId);
        }

        /**
         * ?INFO -> Append Modal Container to Page Body
         * when modal have a Collection to use ItemData in Component scripts
         * */
        document.body.appendChild(modalContainer); // Append Dynamic Modal Container to Page Body

        const listComponents = extractModalFormComponents(modalComponents);
        await checkAndCreateValidationJS(listComponents, modalContainer);
        await loadDynamicFilterDataIntoElements(true, modalHasExternalApi);

        const dataField = `data-${collectionId}`;
        const dataURLField = `data-url-${collectionId}`;
        const dataImageTag = `data-img-src-${collectionId}`;
        const dataVideoTag = `data-video-src-${collectionId}`;
        const dataAudioTag = `data-audio-src-${collectionId}`;

        if (collectionId && collectionItemId && itemData) {
          setModalCollectionItemData(itemData, true);

          let hyperLinks = modalContainer.querySelectorAll(
            '[id^=modal-container] [data-path-collection-name]',
          );
          let imageElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataImageTag + ']',
          );
          let videoElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataVideoTag + ']',
          );
          let audioElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataAudioTag + ']',
          );
          let textContentElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataField + ']',
          );
          let urlContentElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataURLField + ']',
          );
          let allPageButtonsAndLinks = modalContainer.querySelectorAll(
            '[id^=modal-container] a, [id^=modal-container] button',
          );
          let childDataGroupFile = modalContainer.querySelectorAll(
            '[data-js="child-data-group-file"]',
          );
          const formElements = modalContainer.querySelectorAll('form');
          const pdfViewerElement = modalContainer.querySelectorAll('[data-pdf-viewer-component]');

          if (
            (textContentElements ||
              imageElements ||
              hyperLinks ||
              urlContentElements ||
              videoElements ||
              audioElements ||
              childDataGroupFile ||
              pdfViewerElement) &&
            collectionId &&
            collectionItemId
          ) {
            if (itemData) {
              textContentElements.forEach((textElement) => {
                let fieldName = textElement.getAttribute(dataField);
                let type = textElement.getAttribute('type');
                if (fieldName.includes('"') && 'functionType' in JSON.parse(fieldName)) {
                  textElement.innerHTML = getDerivedFieldData(fieldName, itemData);
                } else {
                  if (type === 'reference' || type === 'belongsTo') {
                    const { nestedFieldName } = JSON.parse(textElement.getAttribute('metaData'));
                    if (!fieldName.includes('.')) {
                      fieldName = fieldName + '.' + nestedFieldName;
                    }
                  }
                  //TODO: testing on bases field type (only for boolean now)
                  const fieldType = textElement.getAttribute('data-field-type');
                  //Override Field name based on Response Mapping for Non-Persistent Data
                  // fieldName = checkAndOverrideFieldForNonPersistentCollection(itemData, fieldName);
                  const value = parseValueFromData(itemData, fieldName) || '';
                  if (htmlRegex.test(value)) {
                    textElement.innerHTML = value;
                  } else if (fieldType === 'boolean') {
                    textElement.textContent = value ? 'Yes' : 'No';
                  } else {
                    textElement.textContent = value;
                  }
                }
                textElement.style.display = 'block';
              });
              hyperLinks.forEach((element) => {
                const fieldName = element.getAttribute('data-path-field-name');
                if (fieldName) {
                  if (
                    !(
                      element.hasAttribute('data-gjs') &&
                      element.getAttribute('data-gjs') === 'data-table-link'
                    )
                  ) {
                    const href = element.getAttribute('href');
                    let fieldHref = fieldName ? parseValueFromData(itemData, fieldName) : '';

                    if (fieldHref && typeof fieldHref === 'string' && fieldHref.includes(',')) {
                      fieldHref = fieldHref.split(', ');
                      fieldHref = fieldHref[0];
                    }

                    const replaceHref = href.replace(fieldName, fieldHref);
                    element.setAttribute('href', replaceHref);
                  }
                }
              });
              urlContentElements.forEach((element) => {
                const fieldType = element.getAttribute('data-field-type');
                if (fieldType === 'file') {
                  replaceContentOfFileLinkElements(itemData, element, dataURLField);
                } else {
                  const fieldName = element.getAttribute(dataURLField);
                  let href = element.getAttribute('href');
                  if (!href || href === '#') href = element.getAttribute(dataURLField);
                  const replaceHref = href.replace(
                    fieldName,
                    parseValueFromData(itemData, fieldName),
                  );
                  element.setAttribute('href', replaceHref);
                }
              });
              imageElements.forEach((imageElement) => {
                const fieldName = imageElement.getAttribute(dataImageTag);
                const previewIcon = elementAttribute(imageElement, 'data-preview-icon');
                let itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                if (Array.isArray(itemImageData)) {
                  itemImageData = itemImageData[0];
                }
                let imageSrcUrl;
                if (itemImageData) {
                  if (typeof itemImageData === 'object') {
                    const imageKey = itemImageData.key;
                    if (imageKey)
                      imageSrcUrl = previewIcon
                        ? itemImageData[previewIcon]
                        : itemImageData.isPrivate === true
                        ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-img.png`
                        : imageServerUrl() + imageKey;
                  } else if (
                    typeof itemImageData === 'string' &&
                    itemImageData.startsWith('http')
                  ) {
                    imageSrcUrl = itemImageData;
                  }
                  imageElement.src = imageSrcUrl;
                  if (itemImageData.isPrivate === true) {
                    addDownloadAttributeForPrivateFiles(imageElement, itemImageData, itemData.uuid);
                  }
                }
              });
              videoElements.forEach((videoElement) => {
                const fieldName = videoElement.getAttribute(dataVideoTag);
                const videoType = videoElement.getAttribute('data-video-type');
                let itemVideoData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                if (itemVideoData && ['youtube-nocookie', 'youtube', 'vimeo'].includes(videoType)) {
                  const iframeVideoSrc = videoElement.getAttribute('src');
                  videoElement.src = iframeVideoSrc
                    ? getIframeVideoUrlForYoutubeOrVimeo(iframeVideoSrc, itemVideoData, videoType)
                    : '';
                } else if (itemVideoData) {
                  videoElement.src = itemVideoData;
                } else {
                  videoElement.src = '';
                }
              });
              audioElements.forEach((audioElement) => {
                const fieldName = audioElement.getAttribute(dataAudioTag);
                const audioType = audioElement.getAttribute('data-audio-type');
                const isAutoplay = audioElement.hasAttribute('autoplay')
                  ? audioElement.getAttribute('autoplay')
                  : false;
                const itemAudioData = fieldName ? parseValueFromData(itemData, fieldName) : '';

                if (itemAudioData) {
                  if (audioType === 'file') {
                    audioElement.src =
                      itemAudioData.isPrivate === true
                        ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-audio.png`
                        : imageServerUrl() + itemAudioData.key;

                    if (itemAudioData.isPrivate === true) {
                      addDownloadAttributeForPrivateFiles(
                        audioElement,
                        itemAudioData,
                        itemData.uuid,
                      );
                    }
                  } else {
                    audioElement.src = itemAudioData;
                  }
                  if (isAutoplay) {
                    audioElement.autoplay = true;
                    audioElement.play();
                  }
                } else {
                  audioElement.src = '';
                }
              });
              allPageButtonsAndLinks.forEach((element) => {
                const isParentIsCMS = element.closest(
                  '[data-js="data-table"], [data-js="data-group"], [data-js="child-data-group"], [data-js="data-list"],[data-js="search-form"], [data-js="child-data-group-file"] ',
                );
                if (!isParentIsCMS) {
                  let itemIdField = 'uuid';
                  if (element.hasAttribute('data-path-field-name')) {
                    itemIdField = element.getAttribute('data-path-field-name');
                    let itemCollectionId = '';
                    if (element.hasAttribute('data-path-collection-name')) {
                      itemCollectionId = element.getAttribute('data-path-collection-name');
                    }
                    if (itemIdField.includes('.')) {
                      let itemIdFieldParts = itemIdField.split('.');
                      itemCollectionId = itemIdFieldParts[0];
                      itemIdField = itemIdFieldParts[1];
                    }
                  }
                  element.setAttribute('data-item-id', itemData[itemIdField]);
                }
              });
              pdfViewerElement.forEach((element) => {
                const fieldName = element.getAttribute('data-pdf-viewer-field');
                const itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                renderPdfViewerElements(element, itemImageData, itemData?.uuid);
              });
              // const loggedInUser = isLoggedInUser() ? fetchLoggedInUserJson() : {};
              // const currentTenant = isLoggedInTenant() ? fetchCurrentTenantJson() : {};
              formElements.forEach((elem) => {
                if (itemData) elem.setAttribute('data-item', JSON.stringify(itemData));
                if (collectionItemId) elem.setAttribute('data-item-id', collectionItemId);
                if (collectionId) elem.setAttribute('data-collection-id', collectionId);
                // TODO: Need to review this and modify this general use case
                // const check = !elem.closest('[data-js="data-group"]');
                // if (check) {
                //   replaceItemAndCollectionInForm(
                //     elem,
                //     itemData,
                //     itemData,
                //     loggedInUser,
                //     currentTenant,
                //   );
                // }
              });
              childDataGroupFile.forEach((element) => {
                replaceInnerGroupFile(collectionId, itemData, element, stylesMap);
              });

              /* Initialise the magnificPopup on Images */
              $('.child-data-group-file[data-field-type=image]').each(function () {
                let imgElement = this;
                const elementType = imgElement.tagName;
                if (elementType !== 'IMG') {
                  imgElement = elementSelector(this, 'img');
                }
                if (imgElement && imgElement.hasAttribute('data-enable-popup')) {
                  const anchorParentElem = imgElement.closest('A');
                  const hasAnchorParentElem = !!anchorParentElem;
                  if (hasAnchorParentElem) {
                    // the containers for all your galleries
                    $(this).magnificPopup({
                      delegate: 'a', // the selector for gallery item
                      type: 'image',
                      gallery: {
                        enabled: true,
                      },
                    });
                  }
                }
              });
              setItemToStripePaymentMethodComponent(
                modalContainer,
                elementCollectionId,
                elementItemId,
                itemData,
              );
            }
          }

          const formEl = modalContainer.querySelector(
            '[id^=modal-container] [data-form-collection=' + collectionId + ']',
          );

          if (formEl) {
            collectionFormDetailForModalUpdate(formEl, itemData);
          }

          //Preparing compVisibilityDataJson with itemData for Component Visbility condition handling
          compVisibilityDataJson = {
            itemData,
          };
        } else {
          const formEl = modalContainer.querySelector(
            '[id^=modal-container] [data-form-collection=' + elementCollectionId + ']',
          );

          if (formEl) {
            if (enableMultiSelect) {
              const selectedItemsInputElem = document.createElement('input');
              selectedItemsInputElem.type = 'hidden';
              selectedItemsInputElem.id = 'selectedItemsIds';
              selectedItemsInputElem.name = 'selectedItemsIds';
              selectedItemsInputElem.value = selectedCollectionItems;
              formEl.appendChild(selectedItemsInputElem);
            }
          }
        }
        await addDynamicDataIntoFormElements(itemData, true);
      } else {
        resetModalCollectionItemData();
        await addDynamicDataIntoFormElements(null, true);
      }
      processVisibilityElements(modalContainer, compVisibilityDataJson);
      loadSessionDataIntoElements(true);
      loadHyperLinkFromBSL(true);
      loadPreviousActionResponseDataIntoElements(true, projectConstant, environments);
      loadSessionTenantDataIntoElements(true);
      loadSessionUserSettingsDataIntoElements(true);
      loadSessionSubTenantDataIntoElements(true);
      const typesenseSearchElement = modalContainer.querySelectorAll(
        '[data-typesense-search-component]',
      );
      if (typesenseSearchElement && typesenseSearchElement.length > 0) {
        typesenseSearchElement.forEach((component) => {
          renderTypesenseSearch(component);
        });
      }
      //Check for Field Types and Apply modifying functions
      await checkForTextAreaType('[id^=modal-container]');
      checkForDateType('[id^=modal-container]');
      checkForSelectType('[id^=modal-container]');
      checkForTimepickerType('[id^=modal-container]');
      checkForSegregatedDateType('[id^=modal-container]');
      // TODO: Need to remove because we are loading it by default
      await checkForTelType('[id^=modal-container]');

      const modalDiv = document.getElementById(modalId);
      modalDiv.classList.remove('show');
      modalDiv.classList.add('show');
    }
  } catch (e) {
    console.error('Modal Error: ', e);
    console.log('Error Response: ', e.response);
  } finally {
    actionCompleted(args);
  }
  return null;
}

async function processFloatingModal(args) {
  const { targetElement, parameters, response } = args || {};
  const { floatingModalId } = parameters || {};
  const enableMultiSelect = false; // Not yet used in Floating Modal
  const invokingElemId = targetElement.getAttribute('id');
  console.log('🚀 ~ processFloatingModal ~ invokingElemId:', invokingElemId);

  const lang = localStorage.getItem('lang');
  const endpoint = `projects/snippet-templates/${floatingModalId}${lang ? `?lang=${lang}` : ''}`;

  try {
    const response = await publicGetCall(endpoint);
    if (response && response.status === 200) {
      let scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
      const modal = response.data;
      let modalHtml = modal.content['nocode-html']
        ? modal.content['nocode-html'].replace(scriptRegex, '')
        : '';
      modalHtml = replaceNbsps(modalHtml);

      const modalCss = modal.content['nocode-css'];
      const modalComponents = modal.content['nocode-components'];
      const modalComponentScripts = scriptRegex.exec(modal.content['nocode-html']);
      const defaultFormExist = checkComponents(modalComponents);
      const modalContainer = document.createElement('div');
      let element = targetElement;
      let elementCollectionId = '';
      let elementItemId = '';
      modalContainer.id = `modal-container-${floatingModalId}-${uuidv4(6)}`;
      const modalName = modal.name ? modal.name : 'Floating Modal';
      const itemIdObj = await getItemIdForSnippet(modal.collectionId, args, element);
      elementCollectionId = itemIdObj.collectionId;
      elementItemId = itemIdObj.itemId;
      if (modal.collectionId) {
        if (elementCollectionId) {
          modalContainer.setAttribute('data-collection-id', elementCollectionId);
        } else {
          modalContainer.setAttribute('data-collection-id', modal.collectionId);
        }
        modalContainer.setAttribute('data-item-id', elementItemId);
      } else {
        elementCollectionId = '';
        elementItemId = '';
      }
      modalContainer.innerHTML = `<style>${modalCss}</style>`;
      modalContainer.innerHTML += modalHtml;

      const hasCalendarComponent =
        modalHtml.includes('data-js="calendar"') ||
        modalHtml.includes('data-js="calendar-timeslot"');
      if (hasCalendarComponent) {
        const fullCalendarJsSrc =
          'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.9/index.global.min.js';
        loadCdnScriptDynamically(fullCalendarJsSrc, modalContainer);
      }

      if (modalComponentScripts && modalComponentScripts.length > 0) {
        addComponentScriptToElem(modalComponentScripts[1], modalContainer);
        resetModalCollectionItemData();
      }

      const calendarEventElem = args.element;
      let isCalenderEventElem = calendarEventElem
        ? calendarEventElem.classList.contains('fc-event') ||
          calendarEventElem.classList.contains('fc-event-title') ||
          calendarEventElem.classList.contains('fc-event-time') ||
          calendarEventElem.classList.contains('fc-event-title-container') ||
          calendarEventElem.classList.contains('fc-event-main-frame')
        : '';

      const isCalenderInListView = targetElement
        ? targetElement.classList.contains('fc-listWeek-view')
        : '';

      if (isCalenderEventElem || isCalenderInListView) {
        let selectedCalenderEventElem =
          calendarEventElem.tagName !== 'A' ? calendarEventElem.closest(`a`) : calendarEventElem;

        /**
         * Second pass to get Calendar Event Element from List View
         */
        if (
          !selectedCalenderEventElem ||
          (selectedCalenderEventElem &&
            !selectedCalenderEventElem.hasAttribute('data-collection-id') &&
            !selectedCalenderEventElem.hasAttribute('data-item-id'))
        ) {
          selectedCalenderEventElem = calendarEventElem.closest(`tr`);
        }

        if (
          selectedCalenderEventElem &&
          selectedCalenderEventElem.hasAttribute('data-collection-id') &&
          selectedCalenderEventElem.hasAttribute('data-item-id')
        ) {
          //Extract Collection & Item ID from Calender Event
          elementCollectionId = selectedCalenderEventElem
            ? selectedCalenderEventElem.getAttribute('data-collection-id')
            : '';
          elementItemId = selectedCalenderEventElem
            ? selectedCalenderEventElem.getAttribute('data-item-id')
            : '';
        }
      }

      if (defaultFormExist && !elementCollectionId) {
        if (modal.collectionId) {
          //Extract Collection ID from Modal Collection
          elementCollectionId = modal.collectionId;
        } else {
          //Extract Collection ID from Modal Collection Form
          const modalContainerId = modalContainer.getAttribute('id');
          const modalFormElems = extractModalFormComponent(modalContainerId);
          const modalFormElem = modalFormElems ? modalFormElems[0] : '';
          const dataFormCollection = modalFormElem
            ? modalFormElem.getAttribute('data-form-collection')
            : '';

          elementCollectionId = dataFormCollection;
        }
      }

      /**
       * ?INFO -> Append Modal Container to Page Body
       * when modal doesn't have a Collection
       * */
      if (!elementCollectionId) {
        document.body.appendChild(modalContainer); // Append Dynamic Modal Container to Page Body
        const listComponents = extractModalFormComponents(modalComponents);
        await checkAndCreateValidationJS(listComponents, modalContainer);
      }
      const dcMetaExists = document.getElementById('dcmeta') !== null;
      console.log('🚀 ~ processFloatingModal ~ dcMetaExists:', dcMetaExists);
      if (!dcMetaExists) {
        addEventsScriptForSnippet(modal.content, modalContainer); //INFO: Loading Events in case of Build/Publish case
      }
      addModalExternalScriptUrl(modal, modalContainer);
      addModalCustomScript(modal, modalContainer);

      const { constants: projectConstant, environments } = await getProjectDetail();
      const { collectionFrom, externalApiId } = modal;
      const modalHasExternalApi =
        collectionFrom && collectionFrom === 'EXTERNAL_API' && externalApiId ? true : false;

      let externalApiData = {};
      if (modalHasExternalApi) {
        const externalApiObj = await renderForModalExternalAPI(modal, modalContainer);
        populateExternalApiData(externalApiObj, externalApiData, externalApiId);
      }
      let compVisibilityDataJson = {};
      if (elementCollectionId) {
        // Load Dynamic Data From Session or DB
        const collectionItemData = { collectionId: elementCollectionId, itemId: elementItemId };

        //Clear Item Data from Session Storage on each Modal Open
        removeCollectionItemSessionKey(elementCollectionId, elementItemId);

        const { itemData, collectionId, collectionItemId } = await getModalItemData(
          collectionItemData,
          modalHasExternalApi,
          externalApiData,
        );

        console.log(
          '==> Going to remove __ssr_dm_ keys from session storage via floating modal...',
        );
        Object.keys(sessionStorage).map((sst) => {
          if (sst.startsWith('__ssr_dm_')) {
            sessionStorage.removeItem(sst);
          }
        });

        if (collectionId && collectionItemId && itemData) {
          console.log('==> Setting __ssr_dm_ keys in session storage via floating modal...');
          const sessionStorageKey = `__ssr_dm_colItem_${collectionId}_${collectionItemId}`;
          const sessionStorageKeyCollection = `__ssr_dm_colId`;
          const sessionStorageKeyItem = `__ssr_dm_colItemId`;
          Object.keys(sessionStorage).map((sst) => {
            if (sst.startsWith('__ssr_dm_')) {
              sessionStorage.removeItem(sessionStorageKey);
            }
          });
          sessionStorage.setItem(sessionStorageKey, JSON.stringify(itemData));
          sessionStorage.setItem(sessionStorageKeyCollection, collectionId);
          sessionStorage.setItem(sessionStorageKeyItem, collectionItemId);
        }

        /**
         * ?INFO -> Append Modal Container to Page Body
         * when modal have a Collection to use ItemData in Component scripts
         * */
        document.body.appendChild(modalContainer); // Append Dynamic Modal Container to Page Body

        const listComponents = extractModalFormComponents(modalComponents);
        await checkAndCreateValidationJS(listComponents, modalContainer);
        await loadDynamicFilterDataIntoElements(true, modalHasExternalApi);

        const dataField = `data-${collectionId}`;
        const dataURLField = `data-url-${collectionId}`;
        const dataImageTag = `data-img-src-${collectionId}`;
        const dataVideoTag = `data-video-src-${collectionId}`;
        const dataAudioTag = `data-audio-src-${collectionId}`;

        if (collectionId && collectionItemId && itemData) {
          setModalCollectionItemData(itemData, true);

          let hyperLinks = modalContainer.querySelectorAll(
            '[id^=modal-container] [data-path-collection-name]',
          );
          let imageElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataImageTag + ']',
          );
          let videoElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataVideoTag + ']',
          );
          let audioElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataAudioTag + ']',
          );
          let textContentElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataField + ']',
          );
          let urlContentElements = modalContainer.querySelectorAll(
            '[id^=modal-container] [' + dataURLField + ']',
          );
          let allPageButtonsAndLinks = modalContainer.querySelectorAll(
            '[id^=modal-container] a, [id^=modal-container] button',
          );
          let childDataGroupFile = modalContainer.querySelectorAll(
            '[data-js="child-data-group-file"]',
          );
          const formElements = modalContainer.querySelectorAll('form');
          console.log('🚀 ~ processFloatingModal ~ formElements:', formElements);
          const pdfViewerElement = modalContainer.querySelectorAll('[data-pdf-viewer-component]');

          if (
            (textContentElements ||
              imageElements ||
              hyperLinks ||
              urlContentElements ||
              videoElements ||
              audioElements ||
              childDataGroupFile ||
              pdfViewerElement) &&
            collectionId &&
            collectionItemId
          ) {
            if (itemData) {
              textContentElements.forEach((textElement) => {
                let fieldName = textElement.getAttribute(dataField);
                let type = textElement.getAttribute('type');
                if (fieldName.includes('"') && 'functionType' in JSON.parse(fieldName)) {
                  textElement.innerHTML = getDerivedFieldData(fieldName, itemData);
                } else {
                  if (type === 'reference' || type === 'belongsTo') {
                    const { nestedFieldName } = JSON.parse(textElement.getAttribute('metaData'));
                    if (!fieldName.includes('.')) {
                      fieldName = fieldName + '.' + nestedFieldName;
                    }
                  }
                  const fieldType = textElement.getAttribute('data-field-type');
                  const value = parseValueFromData(itemData, fieldName) || '';
                  if (htmlRegex.test(value)) {
                    textElement.innerHTML = value;
                  } else if (fieldType === 'boolean') {
                    textElement.textContent = value ? 'Yes' : 'No';
                  } else {
                    textElement.textContent = value;
                  }
                }
                textElement.style.display = 'block';
              });
              hyperLinks.forEach((element) => {
                const fieldName = element.getAttribute('data-path-field-name');
                if (fieldName) {
                  if (
                    !(
                      element.hasAttribute('data-gjs') &&
                      element.getAttribute('data-gjs') === 'data-table-link'
                    )
                  ) {
                    const href = element.getAttribute('href');
                    let fieldHref = fieldName ? parseValueFromData(itemData, fieldName) : '';

                    if (fieldHref && typeof fieldHref === 'string' && fieldHref.includes(',')) {
                      fieldHref = fieldHref.split(', ');
                      fieldHref = fieldHref[0];
                    }

                    const replaceHref = href.replace(fieldName, fieldHref);
                    element.setAttribute('href', replaceHref);
                  }
                }
              });
              urlContentElements.forEach((element) => {
                const fieldType = element.getAttribute('data-field-type');
                if (fieldType === 'file') {
                  replaceContentOfFileLinkElements(itemData, element, dataURLField);
                } else {
                  const fieldName = element.getAttribute(dataURLField);
                  let href = element.getAttribute('href');
                  if (!href || href === '#') href = element.getAttribute(dataURLField);
                  const replaceHref = href.replace(
                    fieldName,
                    parseValueFromData(itemData, fieldName),
                  );
                  element.setAttribute('href', replaceHref);
                }
              });
              imageElements.forEach((imageElement) => {
                const fieldName = imageElement.getAttribute(dataImageTag);
                const previewIcon = elementAttribute(imageElement, 'data-preview-icon');
                let itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                if (Array.isArray(itemImageData)) {
                  itemImageData = itemImageData[0];
                }
                let imageSrcUrl;
                if (itemImageData) {
                  if (typeof itemImageData === 'object') {
                    const imageKey = itemImageData.key;
                    if (imageKey)
                      imageSrcUrl = previewIcon
                        ? itemImageData[previewIcon]
                        : itemImageData.isPrivate === true
                        ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-img.png`
                        : imageServerUrl() + imageKey;
                  } else if (
                    typeof itemImageData === 'string' &&
                    itemImageData.startsWith('http')
                  ) {
                    imageSrcUrl = itemImageData;
                  }
                  imageElement.src = imageSrcUrl;
                  if (itemImageData.isPrivate === true) {
                    addDownloadAttributeForPrivateFiles(imageElement, itemImageData, itemData.uuid);
                  }
                }
              });
              videoElements.forEach((videoElement) => {
                const fieldName = videoElement.getAttribute(dataVideoTag);
                const videoType = videoElement.getAttribute('data-video-type');
                let itemVideoData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                if (itemVideoData && ['youtube-nocookie', 'youtube', 'vimeo'].includes(videoType)) {
                  const iframeVideoSrc = videoElement.getAttribute('src');
                  videoElement.src = iframeVideoSrc
                    ? getIframeVideoUrlForYoutubeOrVimeo(iframeVideoSrc, itemVideoData, videoType)
                    : '';
                } else if (itemVideoData) {
                  videoElement.src = itemVideoData;
                } else {
                  videoElement.src = '';
                }
              });
              audioElements.forEach((audioElement) => {
                const fieldName = audioElement.getAttribute(dataAudioTag);
                const audioType = audioElement.getAttribute('data-audio-type');
                const isAutoplay = audioElement.hasAttribute('autoplay')
                  ? audioElement.getAttribute('autoplay')
                  : false;
                const itemAudioData = fieldName ? parseValueFromData(itemData, fieldName) : '';

                if (itemAudioData) {
                  if (audioType === 'file') {
                    audioElement.src =
                      itemAudioData.isPrivate === true
                        ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-audio.png`
                        : imageServerUrl() + itemAudioData.key;

                    if (itemAudioData.isPrivate === true) {
                      addDownloadAttributeForPrivateFiles(
                        audioElement,
                        itemAudioData,
                        itemData.uuid,
                      );
                    }
                  } else {
                    audioElement.src = itemAudioData;
                  }
                  if (isAutoplay) {
                    audioElement.autoplay = true;
                    audioElement.play();
                  }
                } else {
                  audioElement.src = '';
                }
              });
              allPageButtonsAndLinks.forEach((element) => {
                const isParentIsCMS = element.closest(
                  '[data-js="data-table"], [data-js="data-group"], [data-js="child-data-group"], [data-js="data-list"],[data-js="search-form"], [data-js="child-data-group-file"] ',
                );
                if (!isParentIsCMS) {
                  let itemIdField = 'uuid';
                  if (element.hasAttribute('data-path-field-name')) {
                    itemIdField = element.getAttribute('data-path-field-name');
                    let itemCollectionId = '';
                    if (element.hasAttribute('data-path-collection-name')) {
                      itemCollectionId = element.getAttribute('data-path-collection-name');
                    }
                    if (itemIdField.includes('.')) {
                      let itemIdFieldParts = itemIdField.split('.');
                      itemCollectionId = itemIdFieldParts[0];
                      itemIdField = itemIdFieldParts[1];
                    }
                  }
                  element.setAttribute('data-item-id', itemData[itemIdField]);
                }
              });
              pdfViewerElement.forEach((element) => {
                const fieldName = element.getAttribute('data-pdf-viewer-field');
                const itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
                renderPdfViewerElements(element, itemImageData, itemData?.uuid);
              });
              formElements.forEach((elem) => {
                if (itemData) elem.setAttribute('data-item', JSON.stringify(itemData));
                if (collectionItemId) elem.setAttribute('data-item-id', collectionItemId);
                if (collectionId) elem.setAttribute('data-collection-id', collectionId);
              });
              childDataGroupFile.forEach((element) => {
                replaceInnerGroupFile(collectionId, itemData, element, stylesMap);
              });

              /* Initialise the magnificPopup on Images */
              $('.child-data-group-file[data-field-type=image]').each(function () {
                let imgElement = this;
                const elementType = imgElement.tagName;
                if (elementType !== 'IMG') {
                  imgElement = elementSelector(this, 'img');
                }
                if (imgElement && imgElement.hasAttribute('data-enable-popup')) {
                  const anchorParentElem = imgElement.closest('A');
                  const hasAnchorParentElem = !!anchorParentElem;
                  if (hasAnchorParentElem) {
                    // the containers for all your galleries
                    $(this).magnificPopup({
                      delegate: 'a', // the selector for gallery item
                      type: 'image',
                      gallery: {
                        enabled: true,
                      },
                    });
                  }
                }
              });
              setItemToStripePaymentMethodComponent(
                modalContainer,
                elementCollectionId,
                elementItemId,
                itemData,
              );
            }
          }

          const formEl = modalContainer.querySelector(
            '[id^=modal-container] [data-form-collection=' + collectionId + ']',
          );
          console.log('🚀 ~ processFloatingModal ~ IF formEl:', formEl);

          if (formEl) {
            collectionFormDetailForModalUpdate(formEl, itemData);
          }

          //Preparing compVisibilityDataJson with itemData for Component Visbility condition handling
          compVisibilityDataJson = {
            itemData,
          };
        } else {
          const formEl = modalContainer.querySelector(
            '[id^=modal-container] [data-form-collection=' + elementCollectionId + ']',
          );
          console.log('🚀 ~ processFloatingModal ~ ELSE formEl:', formEl);

          if (formEl) {
            if (enableMultiSelect) {
              const selectedItemsInputElem = document.createElement('input');
              selectedItemsInputElem.type = 'hidden';
              selectedItemsInputElem.id = 'selectedItemsIds';
              selectedItemsInputElem.name = 'selectedItemsIds';
              selectedItemsInputElem.value = selectedCollectionItems;
              formEl.appendChild(selectedItemsInputElem);
            }
          }
        }
        await addDynamicDataIntoFormElements(itemData, true, modalContainer);
      } else {
        resetModalCollectionItemData();
        await addDynamicDataIntoFormElements(null, true, modalContainer);
      }
      processVisibilityElements(modalContainer, compVisibilityDataJson);
      loadSessionDataIntoElements(true);
      loadHyperLinkFromBSL(true);
      loadPreviousActionResponseDataIntoElements(true, projectConstant, environments);
      loadSessionTenantDataIntoElements(true);
      loadSessionUserSettingsDataIntoElements(true);
      loadSessionSubTenantDataIntoElements(true);
      const typesenseSearchElement = modalContainer.querySelectorAll(
        '[data-typesense-search-component]',
      );
      if (typesenseSearchElement && typesenseSearchElement.length > 0) {
        typesenseSearchElement.forEach((component) => {
          renderTypesenseSearch(component);
        });
      }
      //Check for Field Types and Apply modifying functions
      await checkForTextAreaType('[id^=modal-container]');
      checkForDateType('[id^=modal-container]');
      checkForSelectType('[id^=modal-container]');
      checkForTimepickerType('[id^=modal-container]');
      checkForSegregatedDateType('[id^=modal-container]');
      // TODO: Need to remove because we are loading it by default
      await checkForTelType('[id^=modal-container]');

      const modalDiv = document.getElementById(modalContainer.getAttribute('id'));
      try {
        makeFloatingModal(modalName, modalContainer, modalDiv, parameters);
      } catch (e) {
        console.error('makeFloatingModal Error: ', e);
      }
    }
  } catch (error) {
    console.error('processFloatingModal Error: ', error);
  } finally {
    actionCompleted(args);
  }
  return response || null;
}

function makeFloatingModal(modalName = '', modalContainer, modalDiv, parameters) {
  console.log('🚀 ~ makeFloatingModal ~ modalDiv:', modalDiv, '~ modalName:', modalName);

  const { fmPosition, fmDraggable, fmResizable, fmClosable, fmMinimizable, fmHeight, fmWidth } =
    parameters || {};

  Modal(modalDiv, {
    // title: modalName,
    title: '',
    width: fmWidth || 500,
    height: fmHeight || 500,
    position: fmPosition || 'center',
    draggable: fmDraggable || false,
    closable: fmClosable || false,
    minimizable: fmMinimizable || false,
    resizable: fmResizable || false,
    maximizable: true,
    overflow: true,
    onopen: function (el, instance) {
      console.log('🚀 ~ makeFloatingModal ~ opened el:', el, 'instance:', instance);
    },
    onclose: function (el, instance) {
      console.log('🚀 ~ makeFloatingModal ~ closed el:', el, 'instance:', instance);
      console.log('🚀 ~ makeFloatingModal closed ~ modalContainer:', modalContainer);
      if (modalContainer) {
        modalContainer.remove();
      }
      // Remove all session storage keys related to this modal
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(`__ssr_dm_`)) {
          sessionStorage.removeItem(key);
        }
      });
      // Reset the modal item data
      resetModalCollectionItemData();
    },
  });
}

function populateExternalApiData(externalApiObj, externalApiData, externalApiId) {
  if (externalApiObj) {
    externalApiData['id'] = externalApiId;
    const { responseDataMapping, bodyDataFrom, collectionMapping } = externalApiObj
      ? externalApiObj
      : '';
    if (bodyDataFrom && bodyDataFrom === 'NON_PERSISTENT_COLLECTION') {
      externalApiData['dataFrom'] = bodyDataFrom;
    }
    const { selectedMapping } = responseDataMapping ? responseDataMapping : '';
    if (selectedMapping) {
      const uniqueItemKey = selectedMapping['_data_source_rest_api_primary_id']
        ? selectedMapping['_data_source_rest_api_primary_id']
        : '';
      if (uniqueItemKey) {
        externalApiData['uniqueKey'] = uniqueItemKey;
      }
      externalApiData['responseMapping'] = selectedMapping;
    }
    const { itemsPath } = responseDataMapping ? responseDataMapping : '';
    if (itemsPath) {
      externalApiData['itemPath'] = itemsPath;
    }
    if (collectionMapping) {
      externalApiData['requestMapping'] = collectionMapping;
    }
  }
}

function removeCollectionItemSessionKey(elementCollectionId, elementItemId) {
  const collectionItemDataSessionKey = `__dp_colItem_${elementCollectionId}_${elementItemId}`;
  Object.keys(sessionStorage).map((sst) => {
    if (sst === collectionItemDataSessionKey) {
      console.log(
        `==> Removing ${collectionItemDataSessionKey} key from session storage via modal...`,
      );
      sessionStorage.removeItem(sst);
    }
  });
}

const setItemToStripePaymentMethodComponent = (
  element,
  elementCollectionId,
  elementItemId,
  itemData,
) => {
  const stripePaymentMethodElements = element.querySelectorAll(
    '[data-js="stripe-payment-methods-list"], [id="stripe-payment-method-container"]',
  );
  stripePaymentMethodElements.forEach((elem) => {
    elem.setAttribute('data-collection-id', elementCollectionId);
    elem.setAttribute('data-item-id', elementItemId);
    elem.setAttribute('data-item', JSON.stringify(itemData));
    if (
      elem.hasAttribute('data-js') &&
      elem.getAttribute('data-js') === 'stripe-payment-methods-list'
    ) {
      randerPaymentMethodList(elem);
    }
  });
};

const processSubpageItemIdFromSession = (
  subPageElementId,
  subPageId,
  elementCollectionId,
  elementItemId,
) => {
  let sessionKey = `__sc_${subPageElementId}_${subPageId}`;
  if (elementCollectionId && elementItemId) {
    sessionStorage.setItem(sessionKey, `${elementCollectionId}:${elementItemId}`);
  } else {
    let sessionValue = sessionStorage.getItem(sessionKey);
    if (sessionValue && sessionValue.includes(':')) {
      const [sessionCollectionId, sessionItemId] = sessionValue.split(':');
      elementCollectionId = sessionCollectionId;
      elementItemId = sessionItemId;
    }
  }
  return { elementCollectionId, elementItemId };
};

const getItemIdForSnippet = async (
  snippetCollectionId,
  args = {},
  element,
  snippetElement = '',
  isAccountAggregator = false,
) => {
  let collectionId = snippetCollectionId;
  let itemId = '';

  const getItemIdFrom = isAccountAggregator
    ? args.parameters?.getRequestIdFrom || ''
    : args.parameters?.getItemIdFrom || '';

  switch (getItemIdFrom) {
    case 'sendPreviousStepParentCollectionId':
      const responseObj = handleCurrentObjectUrl(args?.response);
      collectionId = responseObj.collectionName;
      itemId = responseObj.itemId;
      break;
    case 'sendCurrentPageItemId':
      const pathArray = window.location.pathname.split('/');
      collectionId = pathArray[pathArray.length - 2];
      itemId = pathArray[pathArray.length - 1];
      break;
    case 'sendBSLItemId':
      if (isAccountAggregator) {
        const { browserStorageLocationRequest, browserStorageItemIdPathRequest } = args?.parameters;
        const browserStorageData = await getBSLData(browserStorageLocationRequest);
        itemId =
          browserStorageData && browserStorageItemIdPathRequest
            ? _.get(browserStorageData, browserStorageItemIdPathRequest.trim())
            : '';
      } else {
        const { browserStorageLocation, browserStorageItemIdPath } = args?.parameters;
        const browserStorageData = await getBSLData(browserStorageLocation);
        itemId =
          browserStorageData && browserStorageItemIdPath
            ? _.get(browserStorageData, browserStorageItemIdPath.trim())
            : '';
      }
      break;
    case 'loggedInUserId':
      const loggedInUser = fetchLoggedInUserJson();
      itemId = loggedInUser?.uuid || '';
      break;
    default:
      //Extract Collection ID from CMS list Link/Button
      if (element) {
        collectionId = element.getAttribute('data-collection-id');
        itemId = element.getAttribute('data-item-id');
      } else if (snippetElement) {
        const modalParent = findModalParent(snippetElement);
        if (modalParent) {
          collectionId = modalParent ? modalParent.getAttribute('data-collection-id') : '';
          itemId = modalParent ? modalParent.getAttribute('data-item-id') : '';
        } else {
          const pathArray = window.location.pathname.split('/');
          collectionId = pathArray[pathArray.length - 2];
          itemId = pathArray[pathArray.length - 1];
        }
      }
      break;
  }

  console.log('\n getItemIdForSnippet collectionId', collectionId);
  console.log('\n getItemIdForSnippet itemId', itemId);
  return { collectionId, itemId };
};
