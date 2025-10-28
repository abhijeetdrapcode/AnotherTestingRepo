import { logger } from 'drapcode-logger';

const verifyBuilderKey = async (req, res, next) => {
  let { environment, headers } = req;
  const builderKey = headers['builder-key'];
  console.log('builderKey', builderKey)
  if (!builderKey) {
    return next();
  }
  const labelPrint = 'DEVELOPER API::';
  const pBuilderKey = process.env.BUILDER_KEY;
  console.log('pBuilderKey', pBuilderKey)

  if (builderKey === pBuilderKey) {
    logger.info(`${labelPrint} Env builder key matches`);
    req.skipDeveloperChecks = true;
    return next();
  }
  logger.info(`${labelPrint} since builder key not matched with env.`);
  logger.info(`${labelPrint} now check ref key`);
  const { refKey } = environment;
  if (refKey === builderKey) {
    logger.info(`${labelPrint} Ref key and builder key matches`);
    req.skipDeveloperChecks = true;
    return next();
  }
};

export default verifyBuilderKey;
