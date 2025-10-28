import { loadPlugins, loadPlugin, loadCollection } from 'drapcode-utility';
const { prepareFunction } = require('../utils/util');

export const findOneItem = async (projectId, db, collectionId, itemId, page, timezone, user) => {
  collectionId = collectionId.toString().toLowerCase();
  const { titleTag } = page;
  let collection = loadCollection(projectId, collectionId);

  collection = collection ? collection.utilities : null;
  let result = await db.collection(collectionId).findOne({ uuid: itemId });
  if (!result) return;

  if (collection) {
    let deriveField = collection.find((field) => field.name === titleTag);
    if (deriveField) return { [titleTag]: prepareFunction(deriveField, result, timezone, user) };
  }
  return result;
};

export const findAllInstalledPlugin = async (projectId) => {
  return loadPlugins(projectId);
};

export const findOneInstalledPlugin = async (projectId, code) => {
  return loadPlugin(projectId, code);
};

export const findCollectionByUuid = async (projectId, collectionId) => {
  let collection = loadCollection(projectId, collectionId);
  return collection;
};
