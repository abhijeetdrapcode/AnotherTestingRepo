import { sendEmailTemplateService, sendDynamicEmailService } from './email.service';

export const sendEmailTemplate = async (req, res, next) => {
  try {
    const result = await sendEmailTemplateService(req);
    res.status(result.code).send(result);
  } catch (error) {
    console.error('errror::', error);
    next(error);
  }
};

export const sendDynamicEmail = async (req, res, next) => {
  try {
    const result = await sendDynamicEmailService(req);
    res.status(result.code).send(result);
  } catch (error) {
    next(error);
  }
};
