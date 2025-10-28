export const generateOTPMiddleware = async (req, res, next) => {
  try {
    const {
      body: { templateId },
      route: { path },
    } = req;
    // Auth Type
    if (path.includes('signup')) {
      req.body['otpAuthenticationType'] = 'signUp';
    } else if (path.includes('login')) {
      req.body['otpAuthenticationType'] = 'login';
    }
    if (path.includes('email')) {
      req['type'] = 'email';
    } else if (path.includes('sms')) {
      req['type'] = 'sms';
    }
    // Template id
    if (templateId) {
      if (req.type === 'email') {
        req.body['emailTemplate'] = templateId;
      } else if (req.type === 'sms') {
        req.body['smsTemplate'] = templateId;
      }
    }
    next();
  } catch (error) {
    console.error('Error in generateAndSendOTP:', error);
    next(error);
  }
};
