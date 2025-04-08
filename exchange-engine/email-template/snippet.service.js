import { PREFIX_CONFIG } from '../utils/utils';

export const findTemplate = async (dbConnection, query) => {
  const snippetModel = dbConnection.collection(`${PREFIX_CONFIG}snippets`);
  return await snippetModel.findOne(query);
};
