import axios from 'axios';
import { existsSync, createReadStream } from 'fs';
import { pluginCode, ERROR_404_PAGE } from 'drapcode-constant';
import { replaceValueFromSource } from 'drapcode-utility';
import {
  addProjectEnvOnPage,
  getPageByUrl,
  jsDomClearVisibilityAttr,
  jsDomDetailPageContent,
  jsDomPageContent,
} from '../page/page.service';
import {
  findOneItem,
  findOneInstalledPlugin,
  findAllInstalledPlugin,
} from '../install-plugin/installedPlugin.service';
import { validateSnipcartItem } from '../apiService/collection.service';
import { loadMultiTenantPluginScript } from '../apiService/multiTenant.service';
import { cookieConfig, ignoreUrls } from '../middleware/token';

export const getFirstOptimizePage = async (req, res, next) => {
  try {
    const {
      projectId,
      params,
      projectUrl,
      apiDomainName,
      environment,
      pEnvironment,
      language,
      url,
    } = req;
    const isIgnore = ignoreUrls(url);
    console.log('This is the url: ', url);
    if (isIgnore) {
      return next();
    }
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    let { pageId, itemId, collectionName } = params;
    if (pageId === 'lib' || pageId === 'js') {
      console.log('***** Since it is for lib then do not check *****');
      return next();
    }
    console.log('projectId :>> ', projectId);
    console.log('pageId :>> ', pageId);
    let pageResponse = await getPageByUrl(projectId, pageId);
    if (!pageResponse) {
      /**
       * Get Error 404 page.
       */
      pageResponse = await getPageByUrl(projectId, ERROR_404_PAGE);
      /**
       * Fallback when no Error 404 page found.
       */
      if (!pageResponse) {
        res.send('Error Page');
        return;
      }
    }
    pageId = pageResponse.slug;
    const pageKey = `${projectId}/${language}/${pageId}/${pageId}`;
    const pagePath = `${process.env.BUILD_FOLDER}views/${pageKey}.hbs`;
    console.log('Thisi is the page path: ', pagePath);
    if (itemId && itemId.includes('_')) {
      itemId = itemId.split('_')[1];
    }
    if (!existsSync(pagePath)) {
      return res.send('Please publish the project to view it.');
    }

    let pageContent = '';
    let readerStream = createReadStream(pagePath);
    readerStream.setEncoding('UTF8');
    readerStream.on('data', (chunk) => {
      pageContent += chunk.toString();
    });

    readerStream.on('error', (err) => {
      console.error('err.stack :>> ', err.stack);
      return res.write(
        'There is some issue reading your build. Please publish the project to view it.',
      );
    });

    readerStream.on('end', async () => {
      const installedPlugins = await findAllInstalledPlugin(projectId);
      let s3Url = await prepareS3Url(installedPlugins, pEnvironment);
      if (itemId && collectionName && pageResponse) {
        let { isDescriptionFromCollection, isTitleFromCollection, isPageImageFromCollection } =
          pageResponse;
        if (
          collectionName &&
          (isDescriptionFromCollection || isTitleFromCollection || isPageImageFromCollection)
        ) {
          pageContent = await getDynamicTitle(req, itemId, pageResponse, pageContent, s3Url);
        }
      }
      pageContent = addMetaURL(pageContent, pageId, fullUrl);
      pageContent = await jsDomPageContent(req, pageContent);
      pageContent = addProjectEnvOnPage(req, pageContent);
      pageContent = await loadMultiTenantPluginScript(
        req,
        res,
        pageId,
        pageContent,
        installedPlugins,
      );

      pageContent = await jsDomDetailPageContent(req, res, pageResponse, pageContent, s3Url);
      pageContent = jsDomClearVisibilityAttr(pageContent);
      // VAPT Cookie Task
      res.cookie('projectSeoName', projectUrl, cookieConfig);
      res.cookie('apiDomainName', apiDomainName, cookieConfig);
      res.cookie('environment', environment, cookieConfig);
      res.cookie('S3URL', s3Url, cookieConfig);
      // res.cookie('projectSeoName', projectUrl);
      // res.cookie('apiDomainName', apiDomainName);
      // res.cookie('environment', environment);
      // res.cookie('S3URL', s3Url);
      return res.send(pageContent);
    });
  } catch (error) {
    console.error('error :>> ', error);
    next(error);
  }
};

const getDynamicTitle = async (req, itemId, pageResponse, pageContent, s3Url) => {
  const { projectId, db, user, projectDescription, projectLogoKeyName } = req;
  let {
    collectionId,
    titleTag,
    description,
    pageImage,
    isTitleFromCollection,
    isPageImageFromCollection,
    isDescriptionFromCollection,
  } = pageResponse;
  let data = await findOneItem(projectId, db, collectionId, itemId, pageResponse, user);
  if (!data) return pageContent;
  if (isTitleFromCollection && data[`${titleTag}`]) {
    pageContent = pageContent.replace(
      `<title>${titleTag}</title>`,
      `<title>${data[`${titleTag}`]}</title>`,
    );
    pageContent = pageContent.replace(
      `<meta name="title" content="${titleTag}">`,
      `<meta name="title" content="${data[`${titleTag}`]}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="og:title" content="${titleTag}">`,
      `<meta property="og:title" content="${data[`${titleTag}`]}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="twitter:title" content="${titleTag}">`,
      `<meta property="twitter:title" content="${data[`${titleTag}`]}">`,
    );
  }

  const pageDescription = description ? description : projectDescription;

  if (isDescriptionFromCollection && data[description]) {
    pageContent = pageContent.replace(
      `<meta name="description" content="${pageDescription}">`,
      `<meta name="description" content="${data[description]}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="og:description" content="${pageDescription}">`,
      `<meta property="og:description" content="${data[description]}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="twitter:description" content="${pageDescription}">`,
      `<meta property="twitter:description" content="${data[description]}">`,
    );
  }

  let seoImage = 'https://drapcode.com/img/DrapCode-Icon-Dark.png';
  let seoImageToReplace = 'https://drapcode.com/img/DrapCode-Icon-Dark.png';
  if (pageImage) {
    seoImage = `${process.env.S3_BUCKET_URL}/${pageImage}`;
    const pageImageData = data[pageImage];

    if (pageImageData && pageImageData.key) {
      const pageImageDataKey = pageImageData.key;
      seoImageToReplace = `${s3Url}${pageImageDataKey}`;
    } else if (projectLogoKeyName) {
      seoImageToReplace = `${s3Url}${projectLogoKeyName}`;
    }
  }

  if (isPageImageFromCollection && data[pageImage]) {
    pageContent = pageContent.replace(
      `<meta property="og:image" content="${seoImage}">`,
      `<meta property="og:image" content="${seoImageToReplace}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="twitter:image" content="${seoImage}">`,
      `<meta property="twitter:image" content="${seoImageToReplace}">`,
    );
  }

  return pageContent;
};

const addMetaURL = (pageContent, pageId, fullUrl) => {
  if (fullUrl) {
    const secureUrl = fullUrl.startsWith('http://')
      ? fullUrl.replace('http://', 'https://')
      : fullUrl;
    pageContent = pageContent.replace(
      `<meta property="og:url" content="/${pageId}.html">`,
      `<meta property="og:url" content="${secureUrl}">`,
    );
    pageContent = pageContent.replace(
      `<meta property="twitter:url" content="/${pageId}.html">`,
      `<meta property="twitter:url" content="${secureUrl}">`,
    );
  }
  return pageContent;
};

export const getRobotsTxt = async (req, res, next) => {
  try {
    const robotsTxtData = req.robotsTxt;
    res.write(`${robotsTxtData}`);
    res.end();
  } catch (e) {
    next(e);
  }
};

export const getSitemapXml = async (req, res, next) => {
  try {
    const sitemapXmlData = req.sitemapXml;
    if (!sitemapXmlData) {
      return res.status(404).send('Sitemap XML data not found.');
    }
    res.setHeader('Content-Type', 'application/xml');
    res.end(sitemapXmlData);
  } catch (error) {
    next(error);
  }
};

export const validateSnipcartProduct = async (req, res, next) => {
  try {
    const { db, projectId, params } = req;
    const { collectionName, itemId, itemPrice } = params;
    const snipcartPlugin = await findOneInstalledPlugin(projectId, pluginCode.SNIPCART);
    if (snipcartPlugin) {
      const data = await validateSnipcartItem(db, projectId, collectionName, itemId);
      if (data) {
        res.json({
          id: itemId,
          price: Number(itemPrice),
        });
      } else {
        res.status(404).json({ code: 404, message: 'Item not found with provided id' });
      }
    } else {
      res.status(404).json({ code: 404, message: 'Snipcart plugin is not installed.' });
    }
  } catch (e) {
    next(e);
  }
};

export const getManifestJson = async (req, res, next) => {
  console.log('==> ########### getManifestJson  :>> ');
  const {
    projectName,
    projectDescription,
    faviconKeyName,
    projectId,
    projectPwaConfig,
    pEnvironment,
  } = req;
  const { name, shortName, description, icon } = projectPwaConfig ? projectPwaConfig : '';

  //Load plugin
  let s3Url = await prepareS3Url(null, pEnvironment, true);

  try {
    let manifest = {
      name: name ? name : projectName ? projectName : 'DrapCode | Build Awesome Web Applications',
      short_name: shortName ? shortName : projectName ? projectName : 'DrapCode',
      description: description
        ? description
        : projectDescription
        ? projectDescription
        : projectName
        ? projectName
        : 'DrapCode | Build Awesome Web Applications',
      icons: [
        {
          src: icon
            ? `${s3Url}${icon.key}`
            : faviconKeyName
            ? `${s3Url}${faviconKeyName}`
            : 'https://asset.drapcode.com/img/drapcode-icon-192x192.png',
          sizes: '192x192',
          type: icon ? icon.mimeType : 'image/png',
        },
      ],
      id: projectId,
      start_url: '/',
      display: 'fullscreen',
    };
    res.write(`${JSON.stringify(manifest)}`);
    res.end();
  } catch (e) {
    next(e);
  }
};
export const prepareS3Url = async (installedPlugins, environment, isDefault = false) => {
  // Use default S3 bucket URL
  const defaultS3Url = ensureTrailingSlash(process.env.S3_BUCKET_URL);
  if (isDefault) return defaultS3Url;

  // Try to find AWS S3 plugin configuration
  const s3Plugin = installedPlugins.find((plugin) => plugin.code === pluginCode.AWS_S3);

  // Fallback to default URL if plugin config is missing
  if (!s3Plugin) return defaultS3Url;

  // Extract bucket name and region from plugin settings
  let { bucket_name, region } = s3Plugin.setting;

  // Replace placeholders using the environment context
  bucket_name = replaceValueFromSource(bucket_name, environment, null);
  region = replaceValueFromSource(region, environment, null);
  // Build the base S3 URL
  const isDefaultRegion = region === 'us-east-1';
  const regionSuffix = isDefaultRegion ? '' : `.${region}`;
  const s3Url = `https://${bucket_name}${regionSuffix}.s3.amazonaws.com`;

  return ensureTrailingSlash(s3Url);
};

// console.log('This is the url: ', url);
const ensureTrailingSlash = (url) => (url?.endsWith('/') ? url : `${url}/`);

export const proxyImages = async (req, res) => {
  const { body } = req;
  const { imageUrls } = body;
  if (!Array.isArray(imageUrls)) {
    return res.status(400).send('Invalid request: imageUrls must be an array');
  }

  try {
    const images = await Promise.all(
      imageUrls.map(async (url) => {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const base64 = `data:${response.headers['content-type']};base64,${Buffer.from(
          response.data,
        ).toString('base64')}`;
        return { url, base64 };
      }),
    );

    res.status(200).send(images);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching images');
  }
};
