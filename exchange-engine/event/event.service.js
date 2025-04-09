import { PREFIX_CONFIG } from '../utils/utils';

export const allListService = async (builderDB, query) => {
  let Event = builderDB.collection(`${PREFIX_CONFIG}events`);
  return await Event.find(query).toArray();
};

export const findOneService = async (builderDB, query) => {
  const Event = builderDB.collection(`${PREFIX_CONFIG}events`);
  return await Event.findOne(query);
};
