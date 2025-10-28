import { customComponentFromRedis } from 'drapcode-redis';
import { loadCustomComponent } from 'drapcode-utility';

export const getCustomComponentConfig = async (req, res, next) => {
  try {
    const { params, projectId } = req;
    const { uuid } = params;
    const redisResult = await customComponentFromRedis(projectId);
    let customComponent = null;
    if (Array.isArray(redisResult) && redisResult.length > 0) {
      customComponent = redisResult.find((item) => item.uuid === uuid);
    }
    if (!customComponent) {
      customComponent = loadCustomComponent(projectId, uuid);
    }
    return res.status(200).send(customComponent);
  } catch (error) {
    console.error('get custom component config ~ error:', error);
    next(error);
  }
};
