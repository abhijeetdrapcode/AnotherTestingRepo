const EQUALS = 'EQUALS';
const NOT_EQUAL = 'NOT_EQUAL';
import moment from 'moment';
import {
  parseValueFromData,
  capitalize,
  lowerCase,
  upperCase,
  slugify,
  trim,
  titleCase,
  truncate,
  substr,
  markdownToHtml,
  strJoin,
  evaluateCustomSentence,
  addition,
  average,
  multiply,
  substraction,
  divide,
  evaluateExpression,
  evaluateCurrency,
  evaluateJSLogic,
  formatDate,
  dateDifference,
  getSpecialCharectorReplacedExpression,
  parseJsonString,
} from 'drapcode-utility';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import { findMyText } from '../email/email.service';
import {
  AIRTABLE,
  APP_WRITE,
  DIRECTUS,
  SALESFORCE,
  SUPABASE,
  XANO,
  XATA,
  notFieldForExport,
  OptionTypeFields,
  BelongsToReferenceField,
  MYSQL,
} from 'drapcode-constant';
import { filterItemService } from '../item/item.service';
import { findCollection } from '../collection/collection.service';
import { cryptService } from '../middleware/encryption.middleware';
import {
  extractUserSettingFromUserAndTenant,
  getSubTenantById,
  getTenantById,
} from '../middleware/tenant.middleware';
import { prepareS3Url } from './utils';
import { createCanvas } from 'canvas';
const { Chart } = require('chart.js');
const annotationPlugin = require('chartjs-plugin-annotation');
const tinycolor = require('tinycolor2');

Chart.register(annotationPlugin);
export const isNew = { new: true };
export const COLLECTION_NOT_EXIST_MSG = {
  code: 404,
  message: 'Collection not found with provided name',
};

export const collectionNotFoundMessage = (collectionName) => ({
  code: 404,
  message: `${collectionName} Collection not found`,
});

export const pluginNotInstalledMessage = (pluginName) => ({
  code: 400,
  message: `${pluginName} Plugin not Installed`,
});

export const NOT_FIELD_FOR_EXPORT = ['_data_source_rest_api_primary_id', ...notFieldForExport];
export const REQUEST_BODY_JSON_TYPES = [
  'CUSTOM',
  'FORM_DATA',
  'FORM_URL_ENCODED',
  'DEFAULT_FIELDS',
];
export const EXTERNAL_DATA_SOURCE_TYPES = [
  SUPABASE,
  AIRTABLE,
  APP_WRITE,
  DIRECTUS,
  SALESFORCE,
  XANO,
  XATA,
  MYSQL,
];

export const saltingRounds = 10;
export const JWT_SECRET = 'addjsonwebtokensecretherelikeQuiscustodietipsoscustodes';

export const getDerivedFieldData = (
  derivedFieldData,
  item,
  projectConstant,
  environments,
  collectionConstant,
) => {
  const functionDef = JSON.parse(derivedFieldData);
  const { parentFieldName } = functionDef;
  let textContent = '';
  if (parentFieldName) {
    textContent =
      item[parentFieldName] &&
      item[parentFieldName]
        .map((innerItem) => {
          return prepareFunction(
            functionDef,
            innerItem,
            projectConstant,
            environments,
            collectionConstant,
          );
        })
        .join(', ');
  } else {
    textContent = prepareFunction(
      functionDef,
      item,
      projectConstant,
      environments,
      collectionConstant,
    );
  }
  return textContent;
};

//TODO: Ali -> Handle browserStorageData and remove previousActionResponse,previousActionFormData
export const prepareFunction = (
  functionDef,
  field,
  user,
  envConstants,
  browserStorageData = {},
) => {
  let formatType,
    restToLower,
    whitespace,
    noSplitopt,
    type,
    length,
    endopt,
    startLength,
    endLength,
    startString,
    endString,
    separator,
    refField,
    unixType,
    currency,
    maxFraction,
    index,
    match,
    refFieldType,
    condition,
    position,
    expression,
    indexNum,
    tableStyle,
    theadStyle,
    tbodyStyle,
    trStyle,
    tdStyle,
    thStyle,
    tableRefernceFields,
    unitToAdd,
    unitTypeToAdd = '';
  let offset = false;
  let args = [];
  functionDef.args.forEach((element) => {
    const { name, key } = element;
    const excludes = [
      'formatType',
      'restToLower',
      'whitespace',
      'type',
      'noSplitopt',
      'length',
      'endopt',
      'startLength',
      'endLength',
      'startString',
      'endString',
      'separator',
      'expression',
      'refField',
      'index',
      'match',
      'refFieldType',
      'condition',
      'unixType',
      'currency',
      'maxFraction',
      'position',
      'indexNum',
      'tableStyle',
      'theadStyle',
      'tbodyStyle',
      'trStyle',
      'tdStyle',
      'thStyle',
      'tableRefernceFields',
      'unitToAdd',
      'unitTypeToAdd',
    ];

    if (name === 'formatType') {
      formatType = key;
    } else if (name === 'restToLower') {
      restToLower = key;
    } else if (name === 'whitespace') {
      whitespace = key;
    } else if (name === 'type') {
      type = key;
    } else if (name === 'noSplitopt') {
      noSplitopt = key;
    } else if (name === 'length') {
      length = key;
    } else if (name === 'endopt') {
      endopt = key;
    } else if (name === 'startLength') {
      startLength = key;
    } else if (name === 'endLength') {
      endLength = key;
    } else if (name === 'startString') {
      startString = key;
    } else if (name === 'endString') {
      endString = key;
    } else if (name === 'separator') {
      separator = key;
    } else if (name === 'expression') {
      expression = key;
    } else if (name === 'refField') {
      refField = key;
    } else if (name === 'index') {
      index = key;
    } else if (name === 'match') {
      match = key;
    } else if (name === 'refFieldType') {
      refFieldType = key;
    } else if (name === 'condition') {
      condition = key;
    } else if (name === 'unixType') {
      unixType = key;
    } else if (name === 'currency') {
      currency = key;
    } else if (name === 'maxFraction') {
      maxFraction = key;
    } else if (name === 'position') {
      position = key;
    } else if (name === 'indexNum') {
      indexNum = key;
    } else if (name === 'tableRefernceFields') {
      tableRefernceFields = key;
    } else if (name === 'tableStyle') {
      tableStyle = key;
    } else if (name === 'theadStyle') {
      theadStyle = key;
    } else if (name === 'tbodyStyle') {
      tbodyStyle = key;
    } else if (name === 'trStyle') {
      trStyle = key;
    } else if (name === 'tdStyle') {
      tdStyle = key;
    } else if (name === 'thStyle') {
      thStyle = key;
    } else if (name === 'unitToAdd') {
      unitToAdd = key;
    } else if (name === 'unitTypeToAdd') {
      unitTypeToAdd = key;
    }

    let innerArgs = [];
    if (!excludes.includes(name)) {
      if (Array.isArray(key)) {
        key.forEach((k) => {
          let value = '';
          value = k.includes('.')
            ? getArgsFromKey(k, field, user, {}, envConstants, {}, browserStorageData)
            : field[k];
          innerArgs.push(value);
        });
        args.push(innerArgs);
      } else if (key === 'CURRENT_DATE_TIME') {
        args.push(key);
      } else if (key.includes('.')) {
        const value = getArgsFromKey(key, field, user, {}, envConstants, {}, browserStorageData);
        args.push(value);
      } else {
        if (['updatedAt', 'createdAt'].includes(key)) offset = true;
        args.push(field[key]);
      }
    }
  });
  const timezone = 0;
  switch (functionDef.functionType) {
    case 'CAPITALIZE':
      return capitalize(args[0], restToLower);
    case 'LOWER_CASE':
      return lowerCase(args[0]);
    case 'UPPER_CASE':
      return upperCase(args[0]);
    case 'SLUGIFY':
      return slugify(args[0]);
    case 'TRIM':
      return trim(args[0], whitespace, type);
    case 'TITLE_CASE':
      return titleCase(args[0], noSplitopt);
    case 'TRUNCATE':
      return truncate(args[0], length, endopt);
    case 'SUB_STRING':
      return substr(args[0], startLength, endLength);
    case 'STRING_JOIN':
      return strJoin(args[0], separator, startString, endString);
    case 'SPLIT_STRING':
      return splitString(args[0], separator, index, indexNum);
    case 'CUSTOM_SENTENCE':
      return evaluateCustomSentence(expression, field, user, envConstants);
    case 'ADDITION':
      return addition(formatType, { numbers: args[0] });
    case 'AVERAGE':
      return average(formatType, { numbers: args[0] });
    case 'MULTIPLY':
      return multiply(formatType, { numbers: args[0] });
    case 'DIVIDE':
      return divide(formatType, { number1: args[0], number2: args[1] });
    case 'CUSTOM_CALCULATION':
      return evaluateExpression(expression, field, user, formatType, envConstants);
    case 'CUSTOM_JS_LOGIC':
      return evaluateJSLogic(expression, field, user, envConstants);
    case 'SUBSTRACTION':
      return substraction(formatType, { numbers1: args[0], numbers2: args[1] });
    case 'COUNT':
      return count(args[0], condition, refField, match, refFieldType);
    case 'FIND_RECORD':
      return findRecord(args[0], refField, index);
    case 'FORMAT_DATE':
      return formatDate(formatType, args[0], timezone, unixType, offset);
    case 'DATE_DIFFERENCE':
      return dateDifference(formatType, args[0], args[1], timezone);
    case 'DATE_ADD':
      return dateAdd(args[0], unitToAdd, unitTypeToAdd, formatType);
    case 'CURRENCY_FORMAT':
      return evaluateCurrency(formatType, args[0], currency, position, maxFraction);
    case 'MARKDOWN_TO_HTML':
      return markdownToHtml(args[0]);
    case 'TABLE_FORMAT':
      return formatDataOnTable(
        args[0],
        tableStyle,
        theadStyle,
        tbodyStyle,
        trStyle,
        tdStyle,
        thStyle,
        tableRefernceFields,
      );
    default:
      return '';
  }
};

const count = function (subject, condition, refField, match, refFieldType) {
  switch (condition) {
    case EQUALS:
      subject = subject.filter((sub) => {
        if (OptionTypeFields.includes(refFieldType)) {
          return sub[refField].includes(match);
        } else return false;
      });
      break;
    case NOT_EQUAL:
      subject = subject.filter((sub) => {
        if (OptionTypeFields.includes(refFieldType)) {
          return !sub[refField].includes(match);
        } else return false;
      });
      break;
  }
  return subject.length;
};

const formatDataOnTable = (
  subject,
  tableStyle,
  theadStyle,
  tbodyStyle,
  trStyle,
  tdStyle,
  thStyle,
  tableRefernceFields,
) => {
  if (!subject || !subject.length) return '';
  const jsDom = new JSDOM('', { includeNodeLocations: true });
  const { window } = jsDom;
  const { document } = window;
  tableStyle = tableStyle
    ? getSpecialCharectorReplacedExpression(tableStyle)
    : 'border-collapse: collapse; width: 100%';
  theadStyle = theadStyle
    ? getSpecialCharectorReplacedExpression(theadStyle)
    : 'background-color: #f2f2f2; font-weight: bold;';
  tbodyStyle = tbodyStyle
    ? getSpecialCharectorReplacedExpression(tbodyStyle)
    : 'background-color: #fff;';
  trStyle = trStyle
    ? getSpecialCharectorReplacedExpression(trStyle)
    : 'border-bottom: 1px solid #ddd;';
  tdStyle = tdStyle
    ? getSpecialCharectorReplacedExpression(tdStyle)
    : 'padding: 8px; text-align: left; border: 1px solid #ddd;';
  thStyle = thStyle
    ? getSpecialCharectorReplacedExpression(thStyle)
    : 'padding: 8px; text-align: left; border: 1px solid #ddd;';

  // table element
  const table = document.createElement('table');
  table.style.cssText = tableStyle;

  // table header
  const thead = document.createElement('thead');
  thead.style.cssText = theadStyle;
  const headerRow = document.createElement('tr');
  headerRow.style.cssText = trStyle;

  tableRefernceFields.forEach((item) => {
    const th = document.createElement('th');
    th.style.cssText = thStyle;
    th.innerHTML = item.header;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // table body
  const tbody = document.createElement('tbody');
  tbody.style.cssText = tbodyStyle;

  // Table rowsws
  subject.forEach((obj) => {
    const row = document.createElement('tr');
    row.style.cssText = trStyle;

    tableRefernceFields.forEach((item) => {
      const td = document.createElement('td');
      td.style.cssText = tdStyle;
      td.innerHTML = obj[item.field] || '';
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  return table.outerHTML;
};

const findRecord = function (subject, refField, index) {
  if (index === 'FIRST_RECORD') return subject[0][refField];
  if (index === 'LAST_RECORD') return subject[subject.length - 1][refField];
};

const dateAdd = (datentime1, unitToAdd, unitTypeToAdd, formatType) => {
  let result = '';
  const dateObj = datentime1 === 'CURRENT_DATE_TIME' ? moment() : moment(datentime1);
  result = dateObj.add(unitToAdd, unitTypeToAdd);
  if (formatType === 'FROM_NOW') {
    result = result.fromNow();
  } else result = result.format(formatType);
  return result;
};

const getArgsFromKey = (
  key,
  field,
  loggedInUserData,
  projectConstant = {},
  envConstants,
  collectionConstant = {},
  browserStorageData,
) => {
  const { sessionValue, sessionFormValue, sessionStorageData, localStorageData, cookiesData } =
    browserStorageData || {};
  let value = '';
  if (key.includes('current_user.')) {
    const userKey = key.split('.')[1];
    value = loggedInUserData[userKey];
  } else if (key.includes('current_user_reference_field.')) {
    const [userRefFieldName, newKey] = key.replace('current_user_reference_field.', '').split('.');
    const userRefField = loggedInUserData?.[userRefFieldName];
    value = userRefField ? userRefField[0]?.[newKey] : '';
  } else if (key.includes('createdBy.')) {
    const newKey = key.split('.')[1];
    const createdBy = field?.createdBy;
    value = createdBy[0]?.[newKey];
  } else if (key.includes('environment_variable.')) {
    const envConstantName = key.split('environment_variable.')[1];
    value = envConstants.find((constant) => constant.name === envConstantName).value;
  } else if (key.includes('RF::')) {
    const [refFieldName, newKey] = key.replace('RF::', '').split('.');
    const refField = field?.[refFieldName];
    value = refField[0]?.[newKey];
  } else if (key.includes('PC::')) {
    console.log('projectConstant :>> ', projectConstant);
    value = '';
  } else if (key.includes('CC::')) {
    console.log('collectionConstant :>> ', collectionConstant);
    value = '';
  } else if (key.includes('current_session.')) {
    const sessionKey = key.split('.')[1];
    value = sessionValue?.[sessionKey];
  } else if (key.includes('form_data_session.')) {
    const sessionKey = key.split('.')[1];
    value = sessionFormValue?.[sessionKey];
  } else if (key.includes('SESSION_STORAGE.')) {
    const sessionKey = key.split('.')[1];
    value = sessionStorageData?.[sessionKey];
  } else if (key.includes('LOCAL_STORAGE.')) {
    const sessionKey = key.split('.')[1];
    value = localStorageData?.[sessionKey];
  } else if (key.includes('COOKIES.')) {
    const sessionKey = key.split('.')[1];
    value = cookiesData?.[sessionKey];
  } else {
    value = '';
  }
  return value;
};

const splitString = (subject, separator, index, indexNum) => {
  if (!subject) return '';
  separator = separator ? separator.replace(/##@@##@@##/g, ' ') : ' ';
  const stringArr = subject.split(separator);
  if (index === 'FIRST_ITEM') {
    indexNum = 0;
  } else if (index === 'LAST_ITEM') {
    indexNum = stringArr.length - 1;
  } else if (index === 'NTH_ITEM') {
    indexNum = indexNum - 1;
  }
  return stringArr[indexNum];
};

export const isJsonStringOfArray = (bodyJSON, wrapJsonDataInArray) => {
  let jsonString = bodyJSON ?? '';
  if (jsonString) {
    let bodyJsonString = '';
    if (jsonString && jsonString.includes("'")) {
      bodyJsonString = jsonString.replaceAll("'", '"');
      bodyJsonString = JSON.stringify(bodyJsonString);
    } else {
      bodyJsonString = JSON.stringify(jsonString);
    }

    // Fix JSON to Parsable JSON String
    const parsableJsonString = bodyJsonString ? fixDynamicNeedleJsonString(bodyJsonString) : '';
    let bodyJsonObj = parsableJsonString ? parseJsonString(parsableJsonString) : '';
    try {
      bodyJsonObj = bodyJsonObj ? parseJsonString(bodyJsonObj) : {};
    } catch (error) {
      console.log('🚀 ~ isJsonStringOfArray ~ error:', error);
    }
    wrapJsonDataInArray = bodyJsonObj ? Array.isArray(bodyJsonObj) : false;
  }
  return wrapJsonDataInArray;
};

export const addDynamicDataIntoElement = async (
  content,
  css,
  collectionName,
  itemId,
  itemData,
  db,
  headers,
  projectId,
  timezone,
  dateFormat,
  tenant,
  user,
  environment,
  format,
  subTenant,
) => {
  const htmlRegex =
    /<(br|basefont|hr|input|source|frame|param|area|meta|!--|col|link|option|base|img|wbr|!DOCTYPE).*?>|<(a|abbr|acronym|address|applet|article|aside|audio|b|bdi|bdo|big|blockquote|body|button|canvas|caption|center|cite|code|colgroup|command|datalist|dd|del|details|dfn|dialog|dir|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|frameset|head|header|hgroup|h1|h2|h3|h4|h5|h6|html|i|iframe|ins|kbd|keygen|label|legend|li|map|mark|menu|meter|nav|noframes|noscript|object|ol|optgroup|output|p|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|small|span|strike|strong|style|sub|summary|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video).*?<\/\2>/i;
  const s3Url = await prepareS3Url(projectId, environment);
  const jsDom = new JSDOM(content, { includeNodeLocations: true });
  const { window } = jsDom;
  const { document } = window;
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.appendChild(style);

  const dataField = `data-${collectionName}`;
  const dataURLField = `data-url-${collectionName}`;
  const dataImageTag = `data-img-src-${collectionName}`;

  if (collectionName && itemId && itemData) {
    let hyperLinks = document.querySelectorAll('[data-path-collection-name]');
    let imageElements = document.querySelectorAll('[' + dataImageTag + ']');
    let textContentElements = document.querySelectorAll('[' + dataField + ']');
    let urlContentElements = document.querySelectorAll('[' + dataURLField + ']');
    let chartElements = document.querySelectorAll('[data-series]');
    if (textContentElements || imageElements || hyperLinks || urlContentElements || chartElements) {
      // Text
      textContentElements.forEach((textElement) => {
        let fieldName = textElement.getAttribute(dataField);
        let type = textElement.getAttribute('type');
        if (fieldName.includes('"') && 'functionType' in JSON.parse(fieldName)) {
          textElement.innerHTML = getDerivedFieldData(fieldName, itemData);
        } else {
          if (BelongsToReferenceField.includes(type)) {
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
      // Links
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
      // URL
      urlContentElements.forEach((element) => {
        const fieldType = element.getAttribute('data-field-type');
        if (fieldType !== 'file') {
          const fieldName = element.getAttribute(dataURLField);
          const href = element.getAttribute(dataURLField);
          const replaceHref = href.replace(fieldName, parseValueFromData(itemData, fieldName));
          element.setAttribute('href', replaceHref);
        }
      });
      // Image
      imageElements.forEach((imageElement) => {
        const fieldName = imageElement.getAttribute(dataImageTag);
        const previewIcon = imageElement.getAttribute('data-preview-icon');
        let itemImageData = fieldName ? parseValueFromData(itemData, fieldName) : '';
        if (Array.isArray(itemImageData)) {
          itemImageData = itemImageData[0];
        }
        let imageSrcUrl;
        if (itemImageData) {
          if (typeof itemImageData === 'object') {
            const imageKey = itemImageData.key;
            if (imageKey)
              if (imageKey)
                imageSrcUrl = previewIcon
                  ? itemImageData[previewIcon]
                  : itemImageData.isPrivate === true
                  ? `https://drapcode-static.s3.amazonaws.com/img/placeholder-img.png`
                  : s3Url + imageKey;
          } else if (typeof itemImageData === 'string' && itemImageData.startsWith('http')) {
            imageSrcUrl = itemImageData;
          }
          imageElement.src = imageSrcUrl;
        }
      });
      // Charts
      for (const chartElement of chartElements) {
        let chartImageBuffer;
        let chartHeight = 350;
        let errorMessage = null;
        try {
          chartImageBuffer = await createChartImage(
            chartElement,
            db,
            headers,
            itemData,
            projectId,
            timezone,
            dateFormat,
            tenant,
            format,
            subTenant,
          );
          if (!chartImageBuffer) {
            chartImageBuffer = null;
          }
          const userHeight = chartElement.getAttribute('data-chart-height');
          if (userHeight) chartHeight = parseInt(userHeight);
        } catch (error) {
          console.error(`Error rendering chart for element: ${chartElement}`, error);
          chartImageBuffer = null;
          errorMessage = error.message;
        }
        const chartImageHtml = chartImageBuffer
          ? `<img src="data:image/png;base64,${chartImageBuffer.toString(
              'base64',
            )}" width="100%" height="${chartHeight}" alt="Chart Image" />`
          : `<p>Chart rendering failed: ${errorMessage || 'Unknown error'}</p>`;
        chartElement.outerHTML = chartImageHtml;
      }
    }
  }
  // User
  loadLoggedInUserDataIntoElements(window, user, s3Url);
  // Tenant
  await loadLoggedInUserTenantDataIntoElements(window, user, tenant, db, projectId, s3Url);
  // User Settings
  await loadLoggedInUserSettingsDataIntoElements(db, projectId, window, user, tenant, s3Url);
  await loadLoggedInSubTenantDataIntoElements(
    db,
    projectId,
    window,
    user,
    tenant,
    subTenant,
    s3Url,
  );
  content = jsDom.serialize();
  return content;
};

export const convertHtmlToPdf = async (html, options) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });
  // Inject global CSS to control page breaks
  await page.addStyleTag({
    content: `
      h1, h2, h3, p, img, table {
        break-inside: avoid;
        page-break-inside: avoid; /* Ensure compatibility */
      }
      .page-break {
        page-break-before: always;
      }
      div, section {
        break-inside: avoid;
      }
        `,
  });
  await page.emulateMediaType('screen');
  const pdfBuffer = await page.pdf(options);
  await browser.close();
  return pdfBuffer;
};

export const fixDynamicNeedleJsonString = (
  jsonString,
  returnNeedlesArray = false,
  nonStringNeedles,
) => {
  const regExp = new RegExp('(?<needle>(?:(?<!"){{[a-zA-Z0-9-_:.]*}}))'); // Match the pattern: {{key}}
  let newJsonString = jsonString;
  if (newJsonString) {
    let matchValue = newJsonString.match(regExp);
    if (matchValue) {
      const { groups } = matchValue || '';
      const { needle } = groups || '';
      if (returnNeedlesArray) {
        nonStringNeedles.push(needle);
      }
      if (typeof newJsonString === 'string' && newJsonString.includes('\\"')) {
        newJsonString = newJsonString.replace(regExp, `\\"$1\\"`);
      } else {
        newJsonString = newJsonString.replace(regExp, '"$1"');
      }
      return fixDynamicNeedleJsonString(newJsonString, returnNeedlesArray, nonStringNeedles);
    }
  }
  return newJsonString;
};

export const replaceNonStringValue = function (needle, replacement, haystackText) {
  const match = new RegExp(needle, 'ig');
  if (replacement && replacement.length > 0) {
    return haystackText.replace(match, replacement);
  } else {
    if (typeof replacement === 'undefined') {
      replacement = null;
    }
    return haystackText.replace(match, replacement);
  }
};

export const replaceNeedleValueForNewData = (needle, newData, dataOfItem) => {
  const { dtoExternalApiType, dtoNonStringNeedles } = DTO_EXTERNAL_API || '';
  if (EXTERNAL_DATA_SOURCE_TYPES.includes(dtoExternalApiType)) {
    if (dtoExternalApiType === MYSQL) {
      newData = replaceNonStringValue(needle, dataOfItem, newData);
    } else if (dtoNonStringNeedles.includes(needle)) {
      newData = replaceNonStringValue(needle, dataOfItem, newData);
    } else {
      newData = findMyText(needle, dataOfItem, newData);
    }
  } else {
    newData = findMyText(needle, dataOfItem, newData);
  }
  return newData;
};

export const extractNeedlesFromString = (jsonString, isNotStringNeedles = false) => {
  let needleList = [];
  if (jsonString) {
    if (isNotStringNeedles) {
      needleList = jsonString.match(/(?:(?<!"){{[a-zA-Z0-9-_:.]*}})/gm)?.map((needle) => needle); // Extract all Non-String needles with pattern {{needle}}
    } else {
      needleList = jsonString.match(/(?:(?<="){{[a-zA-Z0-9-_:.]*}})/gm)?.map((needle) => needle); // Extract all String needles with pattern "{{needle}}"
    }
  }
  return needleList;
};

/**
 * DTOs
 */
export const DTO_EXTERNAL_API = {
  dtoExternalApiType: '',
  dtoIsExternalSource: false,
  dtoNonStringNeedles: [],
  dtoCollectionFields: [],
  dtoCollectionDerivedFields: [],
  dtoExternalDbId: '',
  dtoExternalDb: null,
  dtoSearchString: '',
};

export const prepareCurrentUserParamsValue = (currentUserParams, currentUser) => {
  //Write Code to Extract value and pass it for further processing
  currentUserParams.forEach((param) => {
    param.value = currentUser[param.key];
  });
};

export const addParams = (url, params, currentUserParams, collectionParamsValue) => {
  currentUserParams.forEach((param) => {
    if (url.includes(`${param.key}`)) {
      url = url.replace(`${param.key}`, param.value);
    }
  });
  if (Array.isArray(collectionParamsValue)) {
    collectionParamsValue.forEach((param) => {
      if (url.includes(`{{${param.key}}}`)) {
        url = url.replace(`{{${param.key}}}`, param.value);
      }
    });
  } else if (Object.keys(collectionParamsValue).length > 0) {
    Object.entries(collectionParamsValue).forEach(([key, value]) => {
      if (url.includes(`{{${key}}}`)) {
        url = url.replace(`{{${key}}}`, value);
      }
    });
  }
  let paramString = '';
  for (let i = 0; i < params.length; i++) {
    const currParam = params[i];
    if (currParam.key && currParam.key != '' && currParam.value && currParam.value != '') {
      const paramValue = extractValue(currParam.value, currentUserParams);
      if (paramValue) {
        currParam.value = paramValue;
      }
      if (paramString !== '' || url.includes('?')) {
        paramString += `&${currParam.key}=${currParam.value}`;
      } else {
        paramString = `?${currParam.key}=${currParam.value}`;
      }
    }
  }

  url += paramString;
  return url;
};

export const addHeaderValue = (objHeader, headers, currentUserParams) => {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const paramValue = extractValue(header.value, currentUserParams);
    if (paramValue) {
      header.value = paramValue;
    }
    objHeader[header.key] = header.value;
  }
};

export const extractValue = (key, currentUserParams) => {
  const paramObj = currentUserParams.find((obj) => {
    return `${obj.key}` === key;
  });
  return paramObj ? paramObj.value : '';
};

export const startsWithOne = (string, values) => {
  return values.some((element) => {
    return string.startsWith(element);
  });
};

export const clearObject = (data) => {
  if (data && Object.keys(data).length > 0) {
    Object.keys(data).map((key) => {
      delete data[key];
    });
  }
};

export const populateDataObjWithNewData = (newDataJSON, data, skipNullOrEmpty = false) => {
  if (newDataJSON && Object.keys(newDataJSON).length > 0) {
    Object.keys(newDataJSON).map((key) => {
      if (skipNullOrEmpty) {
        switch (typeof newDataJSON[key]) {
          case 'string':
            if (newDataJSON[key] && newDataJSON[key].toLowerCase() !== 'null') {
              data[key] = newDataJSON[key];
            }
            break;
          case 'boolean':
            data[key] = newDataJSON[key];
            break;
          case 'number':
            data[key] = newDataJSON[key];
            break;
          case 'object':
            data[key] = newDataJSON[key];
            break;
          default:
            break;
        }
      } else {
        data[key] = newDataJSON[key];
      }
    });
  }
};

export const dataCleanupForNonPersistentCollection = (data) => {
  if (data && data.externalApiItem) {
    delete data.externalApiItem;
  }
};

export const createChartImage = async (
  element,
  db,
  headers,
  itemData,
  projectId,
  timezone,
  dateFormat,
  tenant,
  format,
  subTenant,
) => {
  try {
    if (!element || !element.getAttribute) {
      throw new Error('Invalid element provided. Missing necessary attributes.');
    }
    const filterId = element.getAttribute('data-finder-id');
    const collectionName = element.getAttribute('data-collection-id');
    const seriesDataField = element.getAttribute('data-series');
    const xAxisDataField = element.getAttribute('data-xaxis');
    let externalQueryParamKeys = element.getAttribute('externalQueryParamKeys');
    if (externalQueryParamKeys) externalQueryParamKeys = externalQueryParamKeys.split(',');
    if (!filterId || !collectionName || !seriesDataField || !xAxisDataField) {
      throw new Error(
        'Missing required attributes (data-finder-id, data-collection-id, data-series, or data-xaxis).',
      );
    }
    let collection = await findCollection(projectId, collectionName, filterId);
    if (!collection) {
      throw new Error(`Collection not found for filterId: ${filterId}`);
    }

    const { authorization } = headers;
    let query = {};
    if (itemData) {
      query = prepareExternalQueryParamsAsObject(externalQueryParamKeys, itemData, element);
    }
    let { result, code, message } = await filterItemService(
      db,
      projectId,
      collection,
      filterId,
      query,
      authorization,
      timezone,
      headers,
      0,
      1,
      false,
      dateFormat,
      tenant,
      subTenant,
    );
    if (code !== 200 || !result || result.length === 0) {
      if (code === 200 && (!result || result.length === 0)) {
        throw new Error(`No data found for the filter with ID: ${filterId}`);
      } else {
        throw new Error(`Error fetching result: ${message} (Code: ${code})`);
      }
    }
    let decryptedResponse;
    if (result) {
      decryptedResponse = await cryptService(result, projectId, collection, true, false, true);
    }
    if (decryptedResponse) {
      if (decryptedResponse.status === 'FAILED') {
        throw new Error(`Decryption of Data Failed.`);
      } else {
        result = decryptedResponse;
      }
    }
    const seriesData = [];
    const xAxisData = [];
    result.forEach((item) => {
      if (item[seriesDataField] !== undefined && item[xAxisDataField] !== undefined) {
        seriesData.push(item[seriesDataField]);
        xAxisData.push(item[xAxisDataField]);
      } else {
        console.warn('Missing data for item:', item);
      }
    });
    if (seriesData.length === 0 || xAxisData.length === 0) {
      throw new Error('No valid data found for the chart.');
    }
    const chartOptions = getChartOptions(element, seriesData, xAxisData);
    const chartImageBuffer = await renderChart(element, chartOptions, format);
    if (!chartImageBuffer) {
      throw new Error('Failed to render chart image.');
    }
    return chartImageBuffer;
  } catch (error) {
    console.error('Error in createChartImage:', error.message);
    throw error;
  }
};

const renderChart = async (element, chartOptions, format) => {
  const formatConfig = paperFormat[format] || { widthInPixels: 744 };
  const { widthInPixels: width } = formatConfig;
  const height = parseInt(element.getAttribute('data-chart-height')) || 350;
  const canvas = createCanvas(width, height);
  new Chart(canvas, chartOptions);
  return canvas.toBuffer();
};

const getChartOptions = (element, seriesData, xAxisData) => {
  let type = element.getAttribute('data-chart-type')?.toLowerCase();
  const strokeCurve = element.getAttribute('data-stroke-curve')?.toLowerCase();
  const isAreaChart = type === 'area';
  type = isAreaChart ? 'line' : type;
  const yAxisMin = element.getAttribute('data-y-axis-min');
  const yAxisMax = element.getAttribute('data-y-axis-max');
  const xAxisLabelRotate = element.getAttribute('data-x-axis-label-rotate');
  const range1 = element.getAttribute('data-y-axis-range1');
  const range2 = element.getAttribute('data-y-axis-range2');
  const colorRange1 = element.getAttribute('data-background-color-range1');
  const colorRange2 = element.getAttribute('data-background-color-range2');
  const backgroundColorRange1 = convertColorForChartJs(colorRange1);
  const backgroundColorRange2 = convertColorForChartJs(colorRange2);
  const parsedRange1 = parseRangeForChart(range1);
  const parsedRange2 = parseRangeForChart(range2);
  const chartOptions = {
    type: type,
    data: {
      labels: xAxisData,
      datasets: [
        {
          label: element.getAttribute('data-chart-title') || 'Data',
          data: seriesData,
          fill: isAreaChart,
          borderColor: 'blue',
          backgroundColor: isAreaChart ? 'rgba(0, 0, 255, 0.2)' : null,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: element.getAttribute('data-chart-title') || 'Chart',
        },
        legend: { display: false },
        annotation: {
          annotations: {
            box1: {
              type: 'box',
              yMin: parsedRange1?.min,
              yMax: parsedRange1?.max,
              backgroundColor: backgroundColorRange1 || 'rgba(255, 255, 255 ,0.3)',
              borderWidth: 0,
            },
            box2: {
              type: 'box',
              yMin: parsedRange2?.min,
              yMax: parsedRange2?.max,
              backgroundColor: backgroundColorRange2 || 'rgba(255, 255, 255 ,0.3)',
              borderWidth: 0,
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: element.getAttribute('data-x-axis-title') || '',
          },
          ticks: {
            maxRotation: xAxisLabelRotate ? -parseInt(xAxisLabelRotate) : 0, // negating it to make it similar to apex
            minRotation: xAxisLabelRotate ? -parseInt(xAxisLabelRotate) : 0, // negating it to make it similar to apex
          },
        },
        y: {
          position: isAreaChart ? 'right' : 'left',
          title: {
            display: true,
            text: element.getAttribute('data-y-axis-title') || '',
          },
          min: yAxisMin ? parseFloat(yAxisMin) : 0,
          max: yAxisMax ? parseFloat(yAxisMax) : undefined,
        },
      },
    },
  };
  let strokeOptions = {};
  switch (strokeCurve) {
    case 'smooth':
    case 'spline':
      strokeOptions = {
        tension: 0.4,
        stepped: false,
      };
      break;
    case 'straight':
      strokeOptions = {
        tension: 0,
        stepped: false,
      };
      break;
    case 'stepline':
      strokeOptions = {
        tension: 0,
        stepped: 'middle',
      };
      break;
    default:
      strokeOptions = {
        tension: 0.4,
        stepped: false,
      };
      break;
  }
  chartOptions.data.datasets[0] = {
    ...chartOptions.data.datasets[0],
    ...strokeOptions,
  };
  return chartOptions;
};

const loadLoggedInUserDataIntoElements = (window, user, s3Url) => {
  const { document } = window;
  let sessionAttributes = document.querySelectorAll('[data-session]');
  if (sessionAttributes) {
    if (user && user !== 'undefined') {
      const loggedInUser = user;
      sessionAttributes.forEach((element) => {
        const fieldName = element.getAttribute('data-session');
        loadDataIntoElements(element, fieldName, loggedInUser, s3Url);
      });
    }
  }
};

const loadLoggedInUserTenantDataIntoElements = async (
  window,
  user,
  tenant,
  db,
  projectId,
  s3Url,
) => {
  const { document } = window;
  let sessionAttributes = document.querySelectorAll('[data-session-tenant]');
  if (sessionAttributes) {
    let loggedInUserTenant;
    if (tenant && tenant !== 'undefined') {
      loggedInUserTenant = tenant;
    } else if (user && user !== 'undefined' && user.tenantId && user.tenantId.length) {
      const loggedInUserTenants = user.tenantId;
      const loggedInUserTenantId =
        loggedInUserTenants && loggedInUserTenants.length > 0 ? loggedInUserTenants[0] : '';
      loggedInUserTenant = await getTenantById(db, projectId, loggedInUserTenantId);
    }
    sessionAttributes.forEach((element) => {
      const fieldName = element.getAttribute('data-session-tenant');
      loadDataIntoElements(element, fieldName, loggedInUserTenant, s3Url);
    });
  }
};

const loadLoggedInUserSettingsDataIntoElements = async (
  db,
  projectId,
  window,
  user,
  tenant,
  s3Url,
) => {
  const { document } = window;
  let sessionAttributes = document.querySelectorAll('[data-session-user-settings]');
  if (sessionAttributes) {
    if (user && user !== 'undefined' && user.userSettingId && user.userSettingId.length) {
      const loggedInUserSetting = await extractUserSettingFromUserAndTenant(
        db,
        projectId,
        user,
        tenant,
      );
      sessionAttributes.forEach((element) => {
        const fieldName = element.getAttribute('data-session-user-settings');
        loadDataIntoElements(element, fieldName, loggedInUserSetting, s3Url);
      });
    }
  }
};

const loadLoggedInSubTenantDataIntoElements = async (
  db,
  projectId,
  window,
  user,
  tenant,
  subTenant,
  s3Url,
) => {
  const { document } = window;
  let sessionAttributes = document.querySelectorAll('[data-session-sub-tenant]');
  if (sessionAttributes) {
    let loggedInSubTenant;
    if (subTenant && subTenant !== 'undefined') {
      loggedInSubTenant = subTenant;
    } else if (user && user !== 'undefined' && user.subTenantId && user.subTenantId.length) {
      const loggedInSubTenants = user.subTenantId;
      if (!tenant && user.tenantId && user.tenantId.length) {
        tenant = user.tenantId[0];
      }
      const matchedSubTenant = loggedInSubTenants?.find((sub) => sub.tenantId === tenant.uuid);
      const loggedInSubTenantId = matchedSubTenant?.uuid || '';
      loggedInSubTenant = await getSubTenantById(db, projectId, loggedInSubTenantId);
    }
    sessionAttributes.forEach((element) => {
      const fieldName = element.getAttribute('data-session-sub-tenant');
      loadDataIntoElements(element, fieldName, loggedInSubTenant, s3Url);
    });
  }
};

const loadDataIntoElements = (element, fieldName, data, s3Url) => {
  const fieldType = element.getAttribute('data-field-type');
  const previewIcon = element.getAttribute('data-preview-icon');
  //TODO:need more reliable way to fix this
  if ((fieldType && fieldType === 'file') || element?.tagName === 'IMG') {
    let itemImageData = fieldName ? parseValueFromData(data, fieldName) : '';
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
            : s3Url + imageKey;
      } else if (typeof itemImageData === 'string' && itemImageData.startsWith('http')) {
        imageSrcUrl = itemImageData;
      }
      element.src = imageSrcUrl;
    }
  } else if (
    element?.tagName === 'A' &&
    element.getAttribute('data-path-collection-item-id-from') === 'session'
  ) {
    //TODO: Check if it can be handled with JsDom
    // if (element.id) {
    //   const elementWithHrefWithItemValue = renderLinkColumnData(
    //     window,
    //     loggedInUserTenant,
    //     element,
    //   );
    //   document.getElementById(element.id).replaceWith(elementWithHrefWithItemValue);
    // }
  } else {
    //TODO: this style is temporary solution to show hidden element which we hide on proejct build->
    //default text does not appear on page load
    element.style.display = 'block';
    if (fieldName.includes('"') && 'functionType' in JSON.parse(fieldName)) {
      element.textContent = getDerivedFieldData(fieldName, data);
    } else {
      element.textContent = data ? parseValueFromData(data, fieldName) : '';
    }
  }
};

const prepareExternalQueryParamsAsObject = (externalQueryParamKeys, itemData, element) => {
  const paramsObject = {};
  if (externalQueryParamKeys && externalQueryParamKeys.length > 0) {
    externalQueryParamKeys.forEach((param) => {
      const paramKey = element.getAttribute(param);
      if (paramKey && itemData) {
        const extParamValue = parseValueFromData(itemData, paramKey);
        if (extParamValue) {
          paramsObject[param] = extParamValue;
        }
      }
    });
  }
  return paramsObject;
};

const paperFormat = {
  A0: { widthInPixels: 3980 },
  A1: { widthInPixels: 2807 },
  A2: { widthInPixels: 1984 },
  A3: { widthInPixels: 1053 },
  A4: { widthInPixels: 744 },
  A5: { widthInPixels: 524 },
  A6: { widthInPixels: 372 },
  Letter: { widthInPixels: 764 },
  Legal: { widthInPixels: 764 },
  Tabloid: { widthInPixels: 998 },
  Ledger: { widthInPixels: 1531 },
};

const parseRangeForChart = (range) => {
  if (!range || !range.includes('-')) return null;
  const [min, max] = range.split('-').map(parseFloat);
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
};

function convertColorForChartJs(color) {
  const colorObj = tinycolor(color);
  if (colorObj.isValid()) {
    return colorObj.setAlpha(0.3).toString();
  } else {
    return 'rgba(255, 255, 255 ,0.3)';
  }
}

// Format date fields in query data
export const formatDateFields = (queryData, dateFormat, fields) => {
  // Build a map for quick lookup
  const fieldMap = new Map(fields.map((f) => [f.fieldName, f]));
  for (const [key, value] of Object.entries(queryData)) {
    if ((key.startsWith('start_') || key.startsWith('end_')) && queryData[key].length <= 10) {
      queryData[key] = moment(queryData[key], dateFormat).format('YYYY-MM-DD');
      continue;
    }
    const field = fieldMap.get(key);
    if (field?.type === 'date') {
      queryData[key] = moment(value, dateFormat).format('YYYY-MM-DD');
    }
  }
};

export const checkParams = (externalParams, queryData) => {
  externalParams = externalParams.map((extParam) => extParam.split('---'));
  externalParams = externalParams.flat();
  const reqQueryParams = Object.keys(queryData);
  return externalParams.every((param) => reqQueryParams.includes(param));
};

// Process search filters
export const processSearch = (queryData, fields, externalParams, search) => {
  if (!search) return { searchObj: null, searchQueryTypeObj: {} };

  let searchObj = Object.assign({}, queryData);
  delete searchObj.offset;
  delete searchObj.limit;
  externalParams?.forEach((param) => delete searchObj[param]);

  let searchQueryTypeObj = {};
  Object.keys(searchObj).forEach((field) => {
    let fieldDef = fields.find(
      (x) =>
        x.fieldName === field ||
        field.replace(/^(start_|end_)/, '') === x.fieldName ||
        field.replace(/^(min_|max_)/, '') === x.fieldName,
    );
    if (!fieldDef) delete searchObj[field];
    if (fieldDef) {
      if (
        fieldDef.type === 'date' &&
        fieldDef?.extraFieldSetting?.dateDisplayType === 'datetime-local'
      ) {
        searchQueryTypeObj[field] = 'datetime';
      } else searchQueryTypeObj[field] = fieldDef.type;
    }
  });

  return { searchObj, searchQueryTypeObj };
};

// Process query results
export const processQueryResult = (finderType, result, queryData) => {
  if (['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(finderType)) {
    if (!result?.length) return '0';

    switch (finderType) {
      case 'COUNT':
        return queryData['resetLimit'] ? 1 : `${result[0].count}`;
      case 'SUM':
        return `${result[0].total}`;
      case 'AVG':
        return `${result[0].average}`;
      case 'MIN':
        return `${result[0].minimum}`;
      case 'MAX':
        return `${result[0].maximum}`;
      default:
        return result;
    }
  } else {
    return result;
  }
};
