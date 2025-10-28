//TODO: whats need of this file delete it if not getting used anywhere
import {
  capitalize,
  lowerCase,
  upperCase,
  slugify,
  trim,
  titleCase,
  truncate,
  markdownToHtml,
  addition,
  average,
  multiply,
  substraction,
  formatDate,
} from 'drapcode-utility';

const moment = require('moment');

export const count = function (subject) {
  return subject ? subject.length : 0;
};

export const prepareFunction = (functionDef, field, timezone, user) => {
  let formatType = '',
    restToLower = '',
    whitespace = '',
    noSplitopt = '',
    type = '',
    length = '',
    endopt = '';
  let args = [];
  console.log('user', user);
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
    }

    let innerArgs = [];
    if (!excludes.includes(name)) {
      if (Array.isArray(key)) {
        key.forEach((k) => {
          if (field) innerArgs.push(field[k]);
        });
        args.push(innerArgs);
      } else {
        if (field) args.push(field[key]);
      }
    }
  });

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
    case 'ADDITION':
      return addition(formatType, { numbers: args[0] });
    case 'AVERAGE':
      return average(formatType, { numbers: args[0] });
    case 'MULTIPLY':
      return multiply(formatType, { numbers: args[0] });
    case 'SUBSTRACTION':
      return substraction(formatType, { numbers1: args[0], numbers2: args[1] });
    case 'FORMAT_DATE':
      if (!timezone) timezone = '(GMT+5:30)';
      // eslint-disable-next-line no-case-declarations
      const str = timezone.substring(4, 10);
      timezone = moment().utcOffset(str).utcOffset();
      return formatDate(formatType, args[0], timezone);
    case 'MARKDOWN_TO_HTML':
      return markdownToHtml(args[0]);
    default:
      return;
  }
};

export const htmlRegex =
  /<(br|basefont|hr|input|source|frame|param|area|meta|!--|col|link|option|base|img|wbr|!DOCTYPE).*?>|<(a|abbr|acronym|address|applet|article|aside|audio|b|bdi|bdo|big|blockquote|body|button|canvas|caption|center|cite|code|colgroup|command|datalist|dd|del|details|dfn|dialog|dir|div|dl|dt|em|embed|fieldset|figcaption|figure|font|footer|form|frameset|head|header|hgroup|h1|h2|h3|h4|h5|h6|html|i|iframe|ins|kbd|keygen|label|legend|li|map|mark|menu|meter|nav|noframes|noscript|object|ol|optgroup|output|p|pre|progress|q|rp|rt|ruby|s|samp|script|section|select|small|span|strike|strong|style|sub|summary|sup|table|tbody|td|textarea|tfoot|th|thead|time|title|tr|track|tt|u|ul|var|video).*?<\/\2>/i;
