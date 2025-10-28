import { generateToken } from 'drapcode-utility';
import voca from 'voca';
let APP_ENV = process.env.APP_ENV;
const isDevelopment = APP_ENV === 'development' || APP_ENV.toLowerCase().trim().startsWith('dev');
export const cookieConfig = { secure: !isDevelopment, sameSite: 'Lax' };

export const createToken = async (req, res, next) => {
  try {
    const { projectId, url } = req;
    const isIgnore = ignoreUrls(url);
    if (isIgnore) return next();
    let token = await generateToken(projectId, 'surface backend');
    console.log('TOKEN_GEN: createToken');
    // VAPT Cookie Task
    res.cookie('JSESSIONID', token, { maxAge: 1800000, ...cookieConfig });
    // res.cookie('JSESSIONID', token, { maxAge: 1800000 });
    req.token = token;
    return next();
  } catch (error) {
    console.error('Error generating token:', error);
    return res.status(500).json({ error: 'Failed to generate token' });
  }
};

export const ignoreUrls = (url) => {
  const isIgnore = voca.startsWith(url, '/resources/action');
  if (isIgnore) {
    return true;
  }
  const urls = [
    '/resources/drapcode.js.map',
    '/resources/drapcode.body.js.map',
    '/resources/dataLoader.js.map',
    '/resources/drapcode.modal.js.map',
  ];
  return urls.includes(url);
};
