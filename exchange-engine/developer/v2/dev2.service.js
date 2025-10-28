import { userCollectionService } from '../../collection/collection.service';
import { findItemById, findOneItemByQuery } from '../../item/item.service';
import { verifyToken } from '../../loginPlugin/jwtUtils';
import { compareBcryptPassword } from '../../loginPlugin/loginUtils';
import { createAuditTrail } from '../../logs/audit/audit.service';
import { collectionNotFoundMessage } from '../../utils/appUtils';

export const deleteFieldRecordFromItemsService = async (
  db,
  enableAuditTrail,
  collectionName,
  fieldName,
) => {
  const $unset = {};
  $unset[fieldName] = 1;
  //TODO: This will be removed soon.
  // FINAL: START:Audit Trail
  createAuditTrail(db, enableAuditTrail, 'BUILDER', 'update', '', collectionName, '', '', '', {});
  // END:Audit Trail
  return await db.collection(collectionName).updateMany({}, { $unset });
};

export const removeReference = async (db, enableAuditTrail, collectionName, data) => {
  const { belongsToItemId, collectionField, recordId, isMultiSelect } = data;
  const dbCollection = await db.collection(collectionName);

  const finder = { uuid: belongsToItemId };
  if (isMultiSelect) {
    finder[collectionField] = { $size: 0 };
  }
  // FINAL: START:Audit Trail
  const collItem = await dbCollection.findOne(finder);
  createAuditTrail(
    db,
    enableAuditTrail,
    'BUILDER',
    'update',
    '',
    collectionName,
    collItem,
    collItem[collectionField],
  );
  // END:Audit Trail

  const updatedRecord = await dbCollection.findOneAndUpdate(finder, {
    $pull: { [collectionField]: recordId },
  });
  return updatedRecord;
};

export const addReference = async (db, enableAuditTrail, collectionName, data) => {
  const { collectionField, recordId, isMultiSelect } = data;
  let { belongsToItemId } = data;
  const dbCollection = await db.collection(collectionName);
  belongsToItemId = Array.isArray(belongsToItemId) ? belongsToItemId[0] : belongsToItemId;
  const belongsToItem = await findOneItemByQuery(db, collectionName, { uuid: belongsToItemId });
  if (!belongsToItem) {
    return;
  }
  let belongsToField = belongsToItem[collectionField];
  if (belongsToField) {
    if (!belongsToField.includes(recordId)) {
      belongsToField =
        isMultiSelect && Array.isArray(belongsToField) ? [...belongsToField, recordId] : [recordId];
    }
  } else belongsToField = [recordId];
  const finder = { uuid: belongsToItemId };
  // FINAL: START:Audit Trail
  const collItem = await dbCollection.findOne(finder);
  createAuditTrail(
    db,
    enableAuditTrail,
    'BUILDER',
    'update',
    '',
    collectionName,
    { [collectionField]: belongsToField },
    { [collectionField]: collItem[collectionField] },
  );
  // END:Audit Trail

  let res = await dbCollection.findOneAndUpdate(finder, {
    $set: { [collectionField]: belongsToField },
  });
  return res;
};

export const fetchUserDetailsService = async (db, projectId, userName, password, authorization) => {
  try {
    const userCollection = await userCollectionService(projectId);
    if (!userCollection) return collectionNotFoundMessage('User');
    let query;
    if (userName) {
      query = {
        $or: [{ email: userName }, { userName: userName }],
      };
    } else if (authorization) {
      const isValidToken = await verifyToken(authorization);
      if (!isValidToken || !isValidToken.sub) {
        return { code: 403, message: 'Token is Missing/Invalid' };
      }
      query = {
        $or: [
          { email: new RegExp(`^${isValidToken.sub}$`, 'i') },
          { userName: new RegExp(`^${isValidToken.sub}$`, 'i') },
        ],
      };
    }
    const { data: user } = await findItemById(db, projectId, userCollection, null, query);
    if (!user) return { code: 404, message: 'User not found.' };
    if (password) {
      const validPassword = await compareBcryptPassword(password, user.password);
      if (!validPassword) {
        return { code: 401, message: 'Invalid Password.' };
      }
    }
    delete user._id;
    delete user.version;
    delete user.password;
    delete user.__v;
    return { code: 200, message: 'User Details fetched successfully', result: user };
  } catch (error) {
    console.error('Error in fetchUserDetailsService', error);
    return { code: 500, message: 'Internal Server Error', error: error?.message || error };
  }
};
