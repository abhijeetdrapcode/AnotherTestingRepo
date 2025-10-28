const prepareDefinition = (hostname) => {
  const previewHostName = hostname.replace('api.', 'api.preview.');
  const betaHostName = hostname.replace('api.', 'api.sandbox.');
  const alphaHostName = hostname.replace('api.', 'api.uat.');

  const APP_ENV = process.env.APP_ENV || 'DEV';
  const APP_PORT = process.env.APP_PORT || '6002';
  let afterHost = '';
  let protocol = 'https';
  if (APP_ENV === 'development' || APP_ENV.toLowerCase().trim().startsWith('dev')) {
    // To handle development env
    afterHost = `:${APP_PORT}/api`;
    protocol = 'http';
  } else {
    afterHost = `/api`;
  }

  return {
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'Drapcode API with Swagger',
        version: '1.1.0',
        description: `Developer API (v1 & v2) for project actions.`,
        contact: {
          name: 'Drapcode',
          url: 'https://drapcode.com',
          email: 'info@drapcode.com',
        },
      },
      servers: [
        {
          url: `${protocol}://${hostname}${afterHost}`,
          description: 'Production',
        },
        {
          url: `${protocol}://${previewHostName}${afterHost}`,
          description: 'Preview',
        },
        {
          url: `${protocol}://${betaHostName}${afterHost}`,
          description: 'Sandbox/Beta',
        },
        {
          url: `${protocol}://${alphaHostName}${afterHost}`,
          description: 'UAT/Alpha',
        },
      ],
    },
    apis: [
      './developer/dev.route.js',
      './developer/auth.route.js',
      './developer/email.route.js',
      './developer/utility.route.js',
      './developer/v1/dev1.route.js',
      './developer/v2/dev2.route.js',
    ],
  };
};

export default prepareDefinition;
