import { sendDynamicSocketService } from './socketIO.service';

export const sendDynamicSocket = async (req, res, next) => {
  try {
    const { body, db, projectId, user, environment, enableAuditTrail, headers } = req;
    const result = await sendDynamicSocketService(
      body,
      db,
      projectId,
      enableAuditTrail,
      headers,
      user,
      environment,
    );
    res.status(result.code).send(result);
  } catch (error) {
    next(error);
  }
};
