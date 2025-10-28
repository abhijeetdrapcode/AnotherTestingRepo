import { isEmpty } from 'lodash';
import { isObject } from 'drapcode-utility';
import { cryptService } from '../middleware/encryption.middleware';

export const mergeConstructorAndRequestData = async (
  target = {},
  source,
  projectId,
  collection,
  decrypt,
) => {
  target = target === 'undefined' ? {} : target;
  target = await cryptService(target, projectId, collection, false, true, decrypt);
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      if (!sourceValue) return;
      if (typeof sourceValue === 'object' && sourceValue.length === 0) return;
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else
          output[key] = mergeConstructorAndRequestData(
            target[key],
            source[key],
            projectId,
            collection,
            decrypt,
          );
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
};
export const removeEmptyFields = (data) => {
  if (data && Object.entries(data).length) {
    Object.entries(data).map(([key, value]) => {
      if (Array.isArray(value)) {
        if (!value.length || (value.length && isEmpty(value[0]))) {
          delete data[key];
        }
      } else if (value === undefined || value === 'undefined' || value === null || value === '') {
        delete data[key];
      }
    });
  }
  return data;
};
