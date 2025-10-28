import responseTime from 'response-time';

export const requestLogger = responseTime((req, res, time) => {
  console.log(
    JSON.stringify({
      type: 'request',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${time.toFixed(2)}ms`,
    }),
  );
});
