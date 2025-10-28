import { findOneCollectionService } from '../collection/collection.service';
import { loadTypesensePluginConfig } from '../install-plugin/installedPlugin.service';
import {
  createTypesenseCollection,
  getTypesenseClient,
  prepareDataForTypesenseIndexing,
  retrieveTypesenseCollection,
  prepareFilterByForTypesense,
  fetchAllResultsForField,
} from './typesenseSearch.utils';
import { getItemCount, list } from '../item/item.service';
import { collectionNotFoundMessage, pluginNotInstalledMessage } from '../utils/appUtils';
import { checkPermissionLevelSecurity } from '../item/item.utils';

export const initializeTypesenseCollectionService = async (
  projectId,
  environment,
  typesenseCollectionName,
) => {
  try {
    const collectionDetails = await findOneCollectionService(projectId, typesenseCollectionName);
    if (!collectionDetails) return collectionNotFoundMessage(typesenseCollectionName);
    const { typesenseMapping } = collectionDetails;
    if (!typesenseMapping.length) {
      return { code: 404, message: 'Typesense mapping not found in the given collection' };
    }
    const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
    if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
    const { host, port, protocol, apiKey } = typesenseSearchPlugin;
    const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
    const exisitingTypesenseCollection = await retrieveTypesenseCollection(
      typesenseClient,
      typesenseCollectionName,
    );
    if (exisitingTypesenseCollection) {
      return {
        code: 200,
        message: 'Typesense Collection already exists!',
        data: exisitingTypesenseCollection,
        collectionDetails,
      };
    }
    const result = await createTypesenseCollection(
      projectId,
      collectionDetails,
      typesenseClient,
      typesenseCollectionName,
      typesenseMapping,
    );
    return result;
  } catch (error) {
    console.error('Error in initializeTypesenseCollectionService:', error.message);
    return { code: 500, message: 'Error initializing Typesense collection', error };
  }
};

export const saveItemInTypesenseCollectionService = async (
  typesenseClient,
  typesenseCollectionName,
  typesenseDocuments,
) => {
  try {
    const result = await typesenseClient
      .collections(typesenseCollectionName)
      .documents()
      .import(typesenseDocuments, { action: 'upsert' });
    return { code: 200, message: 'Document saved to Typesense successfully', data: result };
  } catch (error) {
    console.error('Error in saveItemInTypesenseCollectionService:', error);
    return { code: 500, message: 'Error saving document to Typesense', error };
  }
};

export const reindexAllDataService = async (
  db,
  projectId,
  environment,
  tenant,
  typesenseCollection,
  reIndexOnTheBasisOfTenant,
) => {
  try {
    const collectionDetails = await findOneCollectionService(projectId, typesenseCollection);
    if (!collectionDetails) return collectionNotFoundMessage(typesenseCollection);
    const { collectionName: typesenseCollectionName, typesenseMapping } = collectionDetails;
    if (!typesenseMapping.length) {
      return { code: 404, message: 'Typesense mapping not found in the given collection' };
    }
    const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
    if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
    const { host, port, protocol, apiKey } = typesenseSearchPlugin;
    const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
    let backupData = [];
    const existingCollection = await retrieveTypesenseCollection(
      typesenseClient,
      typesenseCollectionName,
    );
    if (existingCollection && reIndexOnTheBasisOfTenant) {
      try {
        const exportData = await typesenseClient
          .collections(typesenseCollectionName)
          .documents()
          .export();
        if (exportData) {
          backupData = exportData
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line))
            .filter((doc) => {
              return !doc.tenantId || !doc.tenantId.includes(tenant?.uuid);
            });
        }
      } catch (err) {
        console.error('⚠ Failed to backup existing data:', err.message);
      }
    }
    const deleteCollectionResponse = await deleteTypesenseCollectionService(
      projectId,
      environment,
      typesenseCollection,
    );
    if (deleteCollectionResponse.code === 500) return deleteCollectionResponse;
    const createCollectionResponse = await createTypesenseCollection(
      projectId,
      collectionDetails,
      typesenseClient,
      typesenseCollectionName,
      typesenseMapping,
    );
    if (createCollectionResponse.code === 500) return createCollectionResponse;
    const query = reIndexOnTheBasisOfTenant && tenant ? { tenantId: { $in: [tenant?.uuid] } } : {};
    const { data: collectionItemCount = 0 } = await getItemCount(
      db,
      typesenseCollectionName,
      query,
    );
    if (collectionItemCount === 0) {
      return { code: 200, message: 'No data available to reindex in Typesense' };
    }
    const max = 100;
    let batchCount = 0;
    let results = [];
    const listQuery = { max };
    if (reIndexOnTheBasisOfTenant && tenant?.uuid) {
      listQuery['tenantId:IN_LIST'] = tenant.uuid;
    }
    for (let offset = 0; offset < collectionItemCount; offset += max) {
      listQuery.offset = offset;
      batchCount++;
      const batch = await list(db, projectId, collectionDetails, null, listQuery, false);
      if (!batch || !Array.isArray(batch)) {
        console.error(`Failed to fetch batch at offset=${offset}`);
        break;
      }
      const result = await prepareDataForTypesenseIndexing(
        projectId,
        environment,
        typesenseCollectionName,
        batch,
        typesenseMapping,
      );
      results.push({
        batch: batchCount,
        type: reIndexOnTheBasisOfTenant ? 'Tenant Data' : 'All Data',
        details: result,
        code: result.code,
      });
    }
    if (backupData.length > 0 && reIndexOnTheBasisOfTenant) {
      const backupBatchSize = 500;
      let backupBatchCount = 0;
      for (let i = 0; i < backupData.length; i += backupBatchSize) {
        backupBatchCount++;
        const chunk = backupData.slice(i, i + backupBatchSize);
        try {
          const backupResult = await saveItemInTypesenseCollectionService(
            typesenseClient,
            typesenseCollectionName,
            chunk,
          );
          results.push({
            batch: backupBatchCount,
            type: 'Backup Data',
            code: backupResult.code,
            details: backupResult,
          });
        } catch (error) {
          console.error(`⚠ Failed to restore backup batch ${backupBatchCount}:`, error.message);
          results.push({
            batch: backupBatchCount,
            type: 'Backup Data',
            code: 500,
            details: {
              code: 500,
              message: 'Error restoring backup data batch',
              error: error.message,
            },
          });
        }
      }
    }
    const allSuccess = results.every((r) => r.code === 200);
    const finalCode = allSuccess ? 200 : 500;
    return {
      code: finalCode,
      message: allSuccess
        ? 'Reindexing process completed successfully'
        : 'Reindexing completed with some errors',
      summary: {
        newDocs: collectionItemCount,
        backupDocs: backupData.length,
        newDataBatchesProcessed: batchCount,
        backupBatchesProcessed: Math.ceil(backupData.length / 500),
      },
      data: results,
    };
  } catch (error) {
    console.error('Error in reindexAllDataService:', error.message);
    return { code: 500, message: 'Error reindexing data in Typesense', error };
  }
};

export const deleteTypesenseCollectionService = async (
  projectId,
  environment,
  typesenseCollection,
) => {
  try {
    const collectionDetails = await findOneCollectionService(projectId, typesenseCollection);
    if (!collectionDetails) return collectionNotFoundMessage(typesenseCollection);
    const { collectionName: typesenseCollectionName } = collectionDetails;
    const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
    if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
    const { host, port, protocol, apiKey } = typesenseSearchPlugin;
    const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
    const existingCollection = await retrieveTypesenseCollection(
      typesenseClient,
      typesenseCollectionName,
    );
    if (!existingCollection) return { code: 404, message: 'Collection does not exist.' };
    const result = await typesenseClient.collections(typesenseCollectionName).delete();
    return { code: 200, message: 'Collection deleted successfully.', data: result };
  } catch (error) {
    console.error('Error deleting Typesense collection:', error.message);
    return { code: 500, message: 'Failed to delete collection.', error };
  }
};

export const searchTypesenseCollectionService = async (
  db,
  projectId,
  user,
  tenant,
  subTenant,
  environment,
  typesenseCollectionName,
  query,
  typesenseFilter,
  urlParams,
  resultsLimit,
  sortBy,
  sortOrder,
  page,
  searchBy,
) => {
  try {
    const collectionDetails = await findOneCollectionService(projectId, typesenseCollectionName);
    if (!collectionDetails) return collectionNotFoundMessage(typesenseCollectionName);
    const { typesenseMapping, finders } = collectionDetails;
    if (!typesenseMapping.length) {
      return { code: 404, message: 'Typesense mapping not found in the given collection' };
    }
    const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
    if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
    const { host, port, protocol, apiKey } = typesenseSearchPlugin;
    const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
    const existingCollection = await retrieveTypesenseCollection(
      typesenseClient,
      typesenseCollectionName,
    );
    if (!existingCollection) return { code: 404, message: 'Collection does not exist.' };
    let filterBy = `projectId:=${projectId}`;
    let consumedKeys = [];
    if (typesenseFilter) {
      const selectedFilter = finders.find((finder) => finder.uuid === typesenseFilter);
      if (!selectedFilter) return { code: 404, message: 'Filter not found with provided id.' };
      const { filter, consumedKeys: usedKeys } = await prepareFilterByForTypesense(
        db,
        selectedFilter,
        projectId,
        user,
        tenant,
        subTenant,
        typesenseMapping,
        urlParams,
      );
      filterBy = filter;
      consumedKeys = usedKeys;
    }
    const reservedKeys = ['offset', 'limit', 'filterId'];
    const searchFieldsFromParams = Object.entries(urlParams || {}).filter(
      ([key, value]) =>
        !reservedKeys.includes(key) &&
        !consumedKeys.includes(key) &&
        value !== undefined &&
        value !== null &&
        value !== '',
    );
    if (!sortBy) sortBy = 'priority';
    if (!sortOrder) sortOrder = 'asc';
    let searchResults;
    if (searchFieldsFromParams.length > 1) {
      let allResultsPerField = [];
      for (const [key, value] of searchFieldsFromParams) {
        const hits = await fetchAllResultsForField(
          typesenseClient,
          typesenseCollectionName,
          key,
          value,
          filterBy,
          sortBy,
          sortOrder,
        );
        allResultsPerField.push(new Set(hits.map((h) => h.document.id)));
      }
      const intersection = allResultsPerField.reduce(
        (a, b) => new Set([...a].filter((x) => b.has(x))),
      );
      const allHits = await fetchAllResultsForField(
        typesenseClient,
        typesenseCollectionName,
        searchFieldsFromParams[0][0],
        searchFieldsFromParams[0][1],
        filterBy,
        sortBy,
        sortOrder,
      );
      const filteredHits = allHits.filter((h) => intersection.has(h.document.id));
      searchResults = {
        found: filteredHits.length,
        hits: filteredHits,
      };
    } else {
      const queryByFields =
        searchBy !== 'default'
          ? searchBy
          : typesenseMapping
              .filter(
                ({ fieldType }) =>
                  !['number', 'createdAt', 'updatedAt', 'unix_timestamp', 'date'].includes(
                    fieldType,
                  ),
              )
              .map(({ fieldName }) => fieldName)
              .join(',');
      const searchParams = {
        q: query.trim().replace(/\s+/g, ' ').replace(/["']/g, ''),
        query_by: queryByFields,
        filter_by: filterBy,
        per_page: resultsLimit,
        page,
        sort_by: `${sortBy}:${sortOrder}`,
        prefix: true,
        infix: 'always',
        num_typos: 2,
      };
      const estimatedLength = JSON.stringify(searchParams).length;
      if (estimatedLength < 3500) {
        searchResults = await typesenseClient
          .collections(typesenseCollectionName)
          .documents()
          .search(searchParams);
      } else {
        const multiSearchResults = await typesenseClient.multiSearch.perform({
          searches: [{ collection: typesenseCollectionName, ...searchParams }],
        });
        searchResults = multiSearchResults.results[0];
      }
    }
    if (!searchResults.hits || !searchResults.hits.length) {
      return {
        code: 200,
        message: 'No results found',
        data: [],
        currentPage: page,
        totalPages: 0,
        totalRecords: 0,
      };
    }
    return {
      code: 200,
      message: 'Search successful',
      data: searchResults.hits.map((hit) => hit.document),
      currentPage: page,
      totalPages: Math.ceil(searchResults.found / resultsLimit),
      totalRecords: searchResults.found,
    };
  } catch (error) {
    console.error('Error in searchTypesenseCollectionService:', error.message);
    return { code: error?.httpStatus || 500, message: 'Error searching data in Typesense', error };
  }
};

export const deleteTypesenseDataService = async (
  projectId,
  environment,
  typesenseCollectionName,
  documentId,
) => {
  try {
    const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
    if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
    const { host, port, protocol, apiKey } = typesenseSearchPlugin;
    const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
    const existingCollection = await retrieveTypesenseCollection(
      typesenseClient,
      typesenseCollectionName,
    );
    if (!existingCollection) {
      return { code: 404, message: 'Typesense Collection does not exist.' };
    }
    const result = await typesenseClient
      .collections(typesenseCollectionName)
      .documents(documentId)
      .delete();
    return {
      code: 200,
      message: `Document with ID ${documentId} deleted successfully`,
      data: result,
    };
  } catch (error) {
    console.error('Error in deleteTypesenseDataService:', error.message);
    return { code: 500, message: 'Error deleting item from collection', error };
  }
};

export const getAllTypesenseIndexedDataService = async (
  db,
  projectId,
  environment,
  authorization,
  user,
  tenant,
  subTenant,
  urlParams,
  typesenseCollectionName,
  filterId,
) => {
  const collectionDetails = await findOneCollectionService(projectId, typesenseCollectionName);
  if (!collectionDetails) return collectionNotFoundMessage(typesenseCollectionName);
  const { typesenseMapping, finders, permissionLevelSecurity = [] } = collectionDetails;
  if (!typesenseMapping?.length) {
    return { code: 404, message: 'Typesense mapping not found in the given collection' };
  }
  const typesenseSearchPlugin = await loadTypesensePluginConfig(projectId, environment);
  if (!typesenseSearchPlugin) return pluginNotInstalledMessage('Typesense Search');
  const { host, port, protocol, apiKey } = typesenseSearchPlugin;
  const typesenseClient = getTypesenseClient(host, port, protocol, apiKey);
  const existingCollection = await retrieveTypesenseCollection(
    typesenseClient,
    typesenseCollectionName,
  );
  if (!existingCollection) {
    return { code: 404, message: 'Typesense Collection does not exist.' };
  }
  try {
    const offset = parseInt(urlParams?.offset ?? 0, 10);
    const limit = parseInt(urlParams?.limit ?? 10, 10);
    const page = Math.floor(offset / limit) + 1;
    const perPage = limit;
    let filterBy = `projectId:=${projectId}`;
    let consumedKeys = [];
    if (filterId) {
      const selectedFilter = finders.find((finder) => finder.uuid === filterId);
      if (!selectedFilter) {
        return { code: 404, message: 'Filter not found with provided id.' };
      }
      const { filter, consumedKeys: usedKeys } = await prepareFilterByForTypesense(
        db,
        selectedFilter,
        projectId,
        user,
        tenant,
        subTenant,
        typesenseMapping,
        urlParams,
      );
      filterBy = filter;
      consumedKeys = usedKeys;
      //For Search Capabilities
      const reservedKeys = ['offset', 'limit', 'filterId'];
      Object.entries(urlParams || {}).forEach(([key, value]) => {
        if (
          !reservedKeys.includes(key) &&
          !consumedKeys.includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          if (typeof value === 'string' && value.includes(',')) {
            const conditions = value
              .split(',')
              .map((v) => `${key}:=${v.trim()}`)
              .join(' || ');
            filterBy += ` && (${conditions})`;
          } else {
            filterBy += ` && ${key}:=${value}`;
          }
        }
      });
    }
    const searchParams = {
      q: '*',
      query_by: 'uuid',
      filter_by: filterBy,
      per_page: perPage,
      page: page,
    };
    let searchResults;
    const estimatedLength = JSON.stringify(searchParams).length;
    if (estimatedLength < 3500) {
      searchResults = await typesenseClient
        .collections(typesenseCollectionName)
        .documents()
        .search(searchParams);
    } else {
      const multiSearchResults = await typesenseClient.multiSearch.perform({
        searches: [
          {
            collection: typesenseCollectionName,
            ...searchParams,
          },
        ],
      });
      searchResults = multiSearchResults.results[0];
    }
    const hits = searchResults?.hits || [];
    let result = hits.map((hit) => hit?.document);
    if (result && result.length) {
      if (permissionLevelSecurity && permissionLevelSecurity.length) {
        result = await checkPermissionLevelSecurity(
          db,
          projectId,
          authorization,
          permissionLevelSecurity,
          result,
        );
      }
    }
    return {
      code: 200,
      message: 'Indexed data fetched successfully',
      count: result?.count || 0,
      data: result,
    };
  } catch (error) {
    console.error('Error fetching indexed data from Typesense:', error.message);
    return { code: 500, message: 'Failed to retrieve indexed data', error: error.message };
  }
};
