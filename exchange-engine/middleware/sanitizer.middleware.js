import { cleanXssValuesFromData } from 'drapcode-utility';

// Middleware
export const xssSanitizer = (req, res, next) => {
  const ENABLE_XSS_SANITIZER = process.env.ENABLE_XSS_SANITIZER || true;
  if (ENABLE_XSS_SANITIZER === false || ENABLE_XSS_SANITIZER === 'false') return next();
  try {
    if (req.params && Object.keys(req.params)) req.params = cleanXssValuesFromData(req.params);
    if (req.query && Object.keys(req.query)) req.query = cleanXssValuesFromData(req.query);
    if (req.headers && Object.keys(req.headers)) req.headers = cleanXssValuesFromData(req.headers);
  } catch (error) {
    console.log('\n error :>> ', error);
  }
  next();
};
