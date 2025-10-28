import _ from 'lodash';
import { saltingRounds } from '../utils/appUtils';
import { findOneItemByQuery } from '../item/item.service';
export const userCollectionName = 'user';
export const roleCollectionName = 'role';

const bcrypt = require('bcrypt');
export const convertHashPassword = function (password) {
  return bcrypt.hash(password, saltingRounds);
};
export const compareBcryptPassword = function (password, dbPassword) {
  return bcrypt.compare(password, dbPassword);
};

export const updatePermissions = (oldPermissions, newPermissions) => {
  Object.keys(newPermissions).forEach((permission) => {
    if (newPermissions[permission]) {
      if (!oldPermissions.includes(permission)) oldPermissions.push(permission);
    } else {
      _.remove(oldPermissions, (tPermission) => tPermission === permission);
    }
  });
  return oldPermissions;
};

export const handleMultiTenantLoginProcess = async (
  db,
  userDetails,
  role,
  tenant,
  subTenant,
  userSetting,
) => {
  delete tenant._id;
  if (subTenant) delete subTenant._id;
  if (!userSetting) return;
  delete userSetting._id;
  if (!userSetting.userRoles || !userSetting.userRoles.length) return;
  const userTenantRoleName = userSetting.userRoles[0];
  if (!userTenantRoleName) return;
  const userTenantRole = await findOneItemByQuery(db, roleCollectionName, {
    name: userTenantRoleName,
  });
  if (!userTenantRole) return;
  role = userTenantRole.uuid;
  userDetails.role = userTenantRole.uuid;
  userDetails.userRoles = [userTenantRoleName];
};

export const processUserWithPLS = (permissionLevelSecurity, userDetails) => {
  if (permissionLevelSecurity && permissionLevelSecurity.length > 0) {
    const plsMap = permissionLevelSecurity.reduce((acc, field) => {
      acc[field.fieldName] = field;
      return acc;
    }, {});

    userDetails = Object.keys(userDetails)
      .filter((key) => {
        const field = plsMap[key];
        return (
          field &&
          ['allowed', 'restricted'].includes(field.permission) &&
          field.allowedPermissions.length === 0
        );
      })
      .reduce((obj, key) => {
        const field = plsMap[key];
        if (
          field.permission === 'restricted' &&
          Array.isArray(field.allowedReferenceFields) &&
          field.allowedReferenceFields.length > 0 &&
          Array.isArray(userDetails[key])
        ) {
          // Only include allowed reference fields
          obj[key] = userDetails[key].map((refField) => {
            return field.allowedReferenceFields.reduce((acc, refKey) => {
              if (refField[refKey] !== undefined) {
                acc[refKey] = refField[refKey];
              }
              return acc;
            }, {});
          });
        } else {
          obj[key] = userDetails[key];
        }
        return obj;
      }, {});
  }
  return userDetails;
};
