import { eventFromRedis } from 'drapcode-redis';
import { allEvents, findEvent } from './event.service';

export const findAllEvent = async (req, res, next) => {
  try {
    const { projectId } = req;
    const redisResult = await eventFromRedis();
    if (redisResult && redisResult.length > 0) {
      console.log(`*** Found in redis! Returning events for project: ${projectId}`);
      return res.status(200).send(redisResult);
    } else {
      const result = await allEvents(projectId);
      return res.status(200).send(result);
    }
  } catch (err) {
    next(err);
  }
};

export const findOneEvent = async (req, res, next) => {
  const { params, projectId } = req;
  try {
    const redisResult = await eventFromRedis();
    let redisEvent = null;
    if (Array.isArray(redisResult) && redisResult.length > 0) {
      redisEvent = redisResult.find((item) => item.uuid === params.eventId);
    }
    if (redisEvent) {
      console.log(`*** Found in redis! Returning event: ${params.eventId}`);
      return res.send(redisEvent);
    } else {
      const result = await findEvent(projectId, params.eventId);
      return res.status(200).send(result);
    }
  } catch (err) {
    return next(err);
  }
};
