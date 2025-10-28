import { pluginCode } from 'drapcode-constant';
import { replaceValueFromSource, createS3Client, loadPlugin, loadPlugins } from 'drapcode-utility';

export const findInstalledPlugin = async (projectId, code) => {
  return loadPlugin(projectId, code);
};

export const findAllInstalledPlugin = async (projectId) => {
  return loadPlugins(projectId);
};
export const getPlaidExtension = async (projectId) => {
  return await findInstalledPlugin(projectId, pluginCode.PLAID);
};
export const getFluidPayExtension = async (projectId) => {
  return await findInstalledPlugin(projectId, pluginCode.FLUID_PAY);
};

export const loadS3PluginConfig = async (projectId, environment) => {
  const s3Plugin = await findInstalledPlugin(projectId, pluginCode.AWS_S3);

  if (!s3Plugin) {
    const {
      AWS_S3_REGION,
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_S3_BUCKET,
      AWS_S3_ICON_BUCKET_REGION,
      AWS_S3_ICON_BUCKET_ACCESS_KEY_ID,
      AWS_S3_ICON_BUCKET_SECRET_ACCESS_KEY,
      AWS_S3_ICON_BUCKET,
    } = process.env;
    return {
      region: AWS_S3_REGION,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      bucket: AWS_S3_BUCKET,
      publicRegion: AWS_S3_ICON_BUCKET_REGION,
      publicAccessKeyId: AWS_S3_ICON_BUCKET_ACCESS_KEY_ID,
      publicSecretAccessKey: AWS_S3_ICON_BUCKET_SECRET_ACCESS_KEY,
      publicBucket: AWS_S3_ICON_BUCKET,
    };
  }

  let {
    access_key,
    access_secret,
    bucket_name,
    region,
    public_access_key,
    public_access_secret,
    public_region,
    public_bucket_name,
  } = s3Plugin.setting;
  access_key = replaceValueFromSource(access_key, environment, null);
  access_secret = replaceValueFromSource(access_secret, environment, null);
  bucket_name = replaceValueFromSource(bucket_name, environment, null);
  region = replaceValueFromSource(region, environment, null);
  public_access_key =
    replaceValueFromSource(public_access_key, environment, null) ||
    process.env.AWS_S3_ICON_BUCKET_ACCESS_KEY_ID;
  public_access_secret =
    replaceValueFromSource(public_access_secret, environment, null) ||
    process.env.AWS_S3_ICON_BUCKET_SECRET_ACCESS_KEY;
  public_region =
    replaceValueFromSource(public_region, environment, null) ||
    process.env.AWS_S3_ICON_BUCKET_REGION;
  public_bucket_name =
    replaceValueFromSource(public_bucket_name, environment, null) || process.env.AWS_S3_ICON_BUCKET;
  return {
    region,
    bucket: bucket_name,
    accessKeyId: access_key,
    secretAccessKey: access_secret,
    publicRegion: public_region,
    publicAccessKeyId: public_access_key,
    publicSecretAccessKey: public_access_secret,
    publicBucket: public_bucket_name,
  };
};

export const getS3Clients = async (projectId, environment, isPrivate, key) => {
  const s3Plugin = await loadS3PluginConfig(projectId, environment);
  const {
    region,
    accessKeyId,
    secretAccessKey,
    publicRegion,
    publicAccessKeyId,
    publicSecretAccessKey,
    bucket,
    publicBucket,
  } = s3Plugin;

  return {
    s3client: createS3Client({ region, accessKey: accessKeyId, accessSecret: secretAccessKey }),
    publicS3Client: createS3Client({
      region: publicRegion,
      accessKey: publicAccessKeyId,
      accessSecret: publicSecretAccessKey,
    }),
    s3Config: {
      acl: isPrivate ? 'private' : 'public-read',
      key,
      bucket,
      append: true,
    },
    publicS3Config: {
      acl: 'public-read',
      key,
      bucket: publicBucket,
      append: true,
    },
  };
};
export const loadMultiTenantSetting = async (projectId) => {
  const multiTenantPlugin = await findInstalledPlugin(projectId, pluginCode.MULTI_TENANT_SAAS);
  return multiTenantPlugin;
};

export const loadTextractSetting = async (projectId) => {
  const amazonTextractPlugin = await findInstalledPlugin(projectId, pluginCode.AMAZON_TEXTRACT);
  return amazonTextractPlugin;
};

export const loadTypesensePluginConfig = async (projectId, environment) => {
  const typesenseSearchPlugin = await findInstalledPlugin(projectId, pluginCode.TYPESENSE_SEARCH);
  if (!typesenseSearchPlugin) return null;
  const { setting } = typesenseSearchPlugin;
  let { host, port, protocol, apiKey } = setting;
  host = replaceValueFromSource(host, environment, null);
  port = replaceValueFromSource(port, environment, null);
  protocol = replaceValueFromSource(protocol, environment, null);
  apiKey = apiKey
    ? replaceValueFromSource(apiKey, environment, null)
    : process.env.TYPESENSE_API_KEY;
  return { host, port, protocol, apiKey };
};

// Can be used instead of findInstalledPlugin after testing
export const getInstalledPluginValues = async (projectId, code, environment, tenant) => {
  try {
    const installedPlugin = await findInstalledPlugin(projectId, code);
    if (!installedPlugin?.setting) return installedPlugin;

    const updatedSettings = Object.fromEntries(
      Object.entries(installedPlugin.setting).map(([key, value]) => [
        key,
        replaceValueFromSource(value, environment, tenant),
      ]),
    );
    return { ...installedPlugin, setting: updatedSettings };
  } catch (error) {
    console.error('Error in getInstalledPluginValues:', error);
    throw new Error('Failed to retrieve and process plugin settings');
  }
};

export const loadSESPluginConfig = async (projectId, environment, tenant) => {
  const awsSesPlugin = await findInstalledPlugin(projectId, pluginCode.AWS_SES);
  if (!awsSesPlugin) {
    const {
      AWS_SES_SECRET_ACCESS_KEY,
      AWS_SES_SECRET_SECRET_KEY,
      AWS_SES_REGION,
      AWS_SES_ADMIN_FROM_EMAIL_NAME,
    } = process.env;
    const config = {
      region: AWS_SES_REGION,
      Credential: {
        accessKeyId: AWS_SES_SECRET_ACCESS_KEY,
        secretAccessKey: AWS_SES_SECRET_SECRET_KEY,
      },
    };
    return { config, fromEmailAndName: AWS_SES_ADMIN_FROM_EMAIL_NAME, replyTo: '' };
  }
  let { access_key, access_secret, region, from_email, from_name, reply_to } = awsSesPlugin.setting;
  access_key = replaceValueFromSource(access_key, environment, tenant);
  access_secret = replaceValueFromSource(access_secret, environment, tenant);
  region = replaceValueFromSource(region, environment, tenant);
  from_email = replaceValueFromSource(from_email, environment, tenant);
  from_name = replaceValueFromSource(from_name, environment, tenant);
  reply_to = replaceValueFromSource(reply_to, environment, tenant);
  const replyTo = reply_to;
  const fromEmailAndName = `${from_name} <${from_email}>`;
  const config = {
    region,
    credentials: {
      accessKeyId: access_key.trim(),
      secretAccessKey: access_secret.trim(),
    },
  };
  return { config, fromEmailAndName, replyTo };
};
