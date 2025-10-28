import { pluginCode } from 'drapcode-constant';
import { findInstalledPlugin } from '../install-plugin/installedPlugin.service';
import { findOneCollectionService } from '../collection/collection.service';
import {
  downloadFile,
  findItemById,
  findOneItemByQuery,
  saveItem,
  updateCollectionItem,
} from '../item/item.service';
import { COLLECTION_NOT_EXIST_MSG } from '../utils/appUtils';
import { processSingleDocument } from '../collection-form/anyfile-to-text/document-processor';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { OpenAIEmbeddings } from '@langchain/openai';
import { logger } from 'drapcode-logger';
import { callOpenAiLLM, getProvider } from './pinecone.utils';
import { v4 as uuidv4 } from 'uuid';

export const addDataKnowledgeBaseService = async (req) => {
  try {
    const { db, body, projectId, environment, user, tenant } = req;

    if (!db || !body || !environment || !projectId) {
      throw new Error('Invalid request: db, body and environment are required');
    }

    const { setting } = await findInstalledPlugin(projectId, pluginCode.PINECONE);
    if (!setting) {
      throw new Error('Pinecone Config is not Found');
    }
    let files = [];
    const { collection, fieldForDoc, itemId } = body;
    let collectionData = await findOneCollectionService(projectId, collection);
    if (!collectionData) {
      throw new Error(COLLECTION_NOT_EXIST_MSG);
    }
    const itemByQuery = await findOneItemByQuery(db, collection, {
      uuid: itemId,
    });
    if (!itemByQuery) {
      throw new Error('Item not found With this ItemId');
    }
    const documents = itemByQuery[fieldForDoc];
    let text = '';

    if (!documents || (Array.isArray(documents) && documents.length === 0)) {
      logger.warn('No documents found!');
      throw new Error('No document found for this itemId');
    }

    if (documents) {
      let documents_array = Array.isArray(documents) ? documents : [documents];
      const filePromises = documents_array.map(async (document) => {
        try {
          const file = await downloadFile(document, environment);
          return file;
        } catch (error) {
          logger.error(`Error downloading file for key ${document}:`, error);
          return { error: new Error(`Download failed for document ${document}`) };
        }
      });
      files = await Promise.all(filePromises);
      files = files.filter((f) => f && !f.error);

      if (files.length === 0) {
        logger.error('All file downloads failed');
        throw new Error('No valid documents to process');
      }

      const results = [];
      const maxConcurrentProcessing = 3;
      const totalDocs = files?.length;
      if (totalDocs && totalDocs === 1) {
        const file = files?.[0];
        const fileText = await processSingleDocument(file);
        results.push(fileText);
      } else {
        for (let i = 0; i < files.length; i += maxConcurrentProcessing) {
          const batch = files.slice(i, i + maxConcurrentProcessing);
          const batchResults = await Promise.all(
            batch.map(async (file) => {
              const fileName = file.originalname;
              const fileText = await processSingleDocument(file);
              return `${fileName}:\n${fileText}`;
            }),
          );
          results.push(...batchResults);
        }
      }
      text = results.filter(Boolean).join('\n\n');
      if (!text) {
        logger.error(`Unable to extract your PDF`);
        throw new Error('Unable to extract your Document');
      }
    } else {
      logger.warn('No document found!');
      throw new Error('No document found for this itemId');
    }
    const { index, pinecone_api_key, dimension, embedding_model, secret_key, namespace } = setting;
    if (
      !index ||
      !pinecone_api_key ||
      !dimension ||
      !embedding_model ||
      !secret_key ||
      !namespace
    ) {
      throw new Error('All config is Required for Upload in knowledge base ');
    }
    let namespaceId = '';
    if (namespace === 'tenant') {
      namespaceId = tenant?.uuid || '';
    } else {
      namespaceId = user?.uuid || '';
    }
    const pinecone = new Pinecone({ apiKey: pinecone_api_key });
    const pineconeIndex = pinecone.Index(index);
    const response = await addDataToVectorStore(
      text,
      pineconeIndex,
      embedding_model,
      secret_key,
      dimension,
      namespaceId,
      user,
      itemId,
    );
    return {
      code: 200,
      message: 'Data uploaded successfully to the Knowledge Base',
      data: response,
    };
  } catch (error) {
    logger.error(`Error In addDataKnowledgeBaseService Service : >> ${error}`);
    return {
      code: 500,
      message: 'An error occurred while Upload Data In Knowledge Base',
      error: error.message || error,
    };
  }
};

const addDataToVectorStore = async (
  documentText,
  pineconeIndex,
  embeddingModel,
  secret_key,
  dimension,
  namespaceId,
  user,
  itemId,
) => {
  try {
    const embeddings = await generateEmbeddings(embeddingModel, secret_key, dimension);
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
      namespace: namespaceId,
    });
    const contentBlob = new Blob([documentText], { type: 'text/plain' });
    const loader = new TextLoader(contentBlob);
    const document = await loader.load();
    const documentWithMetadata = document.map((doc) => ({
      ...doc,
      metadata: {
        userId: user?.uuid || '',
        itemId: itemId || '',
        ...doc.metadata,
      },
    }));

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 10000,
      chunkOverlap: 200,
    });
    const splitDocs = await textSplitter.splitDocuments(documentWithMetadata);
    const result = await vectorStore.addDocuments(splitDocs);
    return result;
  } catch (error) {
    logger.error(`Error In addDataToVectorStore Service: >> ${error}`);
    throw error;
  }
};

const generateEmbeddings = async (embeddingModel, apiKey, dimension) => {
  try {
    const embeddings = new OpenAIEmbeddings({
      model: embeddingModel,
      openAIApiKey: apiKey,
      dimensions: dimension,
    });
    return embeddings;
  } catch (error) {
    logger.error(`Error In generateEmbeddings Service:>> ${error}`);
    throw error;
  }
};

export const queryFromKnowledgeBaseService = async (req) => {
  try {
    const { db, body, projectId, user, tenant, environment, enableAuditTrail, headers } = req;
    if (!db || !body || !environment || !projectId) {
      throw new Error('Invalid request: db, body and environment are required');
    }
    const { setting } = await findInstalledPlugin(projectId, pluginCode.PINECONE);
    if (!setting) {
      throw new Error('Pinecone Config is not Found');
    }
    const { collection, fieldForQuery, fieldForContext, itemId } = body;
    let collectionData = await findOneCollectionService(projectId, collection);
    if (!collectionData) {
      throw new Error(COLLECTION_NOT_EXIST_MSG);
    }
    const itemByQuery = await findOneItemByQuery(db, collection, {
      uuid: itemId,
    });
    if (!itemByQuery) {
      throw new Error('Item not found With ItemId');
    }
    const query = itemByQuery[fieldForQuery];
    if (!query) {
      logger.warn('questions not found for query from knowledge base in vector database');
    }
    const { index, pinecone_api_key, dimension, embedding_model, secret_key, namespace } = setting;
    if (
      !index ||
      !pinecone_api_key ||
      !dimension ||
      !embedding_model ||
      !secret_key ||
      !namespace
    ) {
      throw new Error('All config is Required for Upload in knowledge base ');
    }

    let namespaceId = '';
    if (namespace === 'tenant') {
      namespaceId = tenant?.uuid || '';
    } else {
      namespaceId = user?.uuid || '';
    }
    const pinecone = new Pinecone({ apiKey: pinecone_api_key });
    const pineconeIndex = pinecone.Index(index);
    const result = await getDataFromVectorStore(
      query,
      namespaceId,
      pineconeIndex,
      embedding_model,
      secret_key,
      dimension,
    );
    const { _id, ...existingFields } = itemByQuery;
    console.log('_id of Update collection items IN pinecone flow', _id);
    const updatePayload = { ...existingFields };
    if (fieldForContext) updatePayload[fieldForContext] = result;
    const { data } = await updateCollectionItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      collectionData,
      itemId,
      updatePayload,
      user,
      headers,
    );
    console.log('data of Update collection items IN pinecone flow', data);
    return { code: 200, message: 'Knowledge base results retrieved successfully', data };
  } catch (error) {
    logger.error(`Error in queryFromKnowledgeBaseService  Service:>> ${error}`);
    return {
      code: 500,
      message: 'An error occurred while Query From  Knowledge Base',
      error: error.message || error,
    };
  }
};

const getDataFromVectorStore = async (
  query,
  namespaceName,
  pineconeIndex,
  embeddingModel,
  apiKey,
  dimension,
) => {
  try {
    const embeddings = await generateEmbeddings(embeddingModel, apiKey, dimension);
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
      namespace: namespaceName,
    });

    const similaritySearchResults = await vectorStore.similaritySearch(query, 5);

    const context = similaritySearchResults
      .map((doc, i) => `Result ${i + 1}:\n${doc.pageContent}`)
      .join('\n\n');

    return context;
  } catch (error) {
    logger.error(`Error In getDataFromVectorStore Service: >> ${error}`);
    throw error;
  }
};

export const answerFromChatbotService = async (req) => {
  try {
    const { db, body, projectId, user, environment, enableAuditTrail, headers } = req;

    if (!db || !body || !environment || !projectId) {
      throw new Error('Invalid request: db, body and environment are required');
    }
    const { setting } = await findInstalledPlugin(projectId, pluginCode.AI_CHATBOT);
    if (!setting) throw new Error('Chatbot config not found');

    const { query, context, collectionForAiChatbot } = body;
    let chatbotCollection = await findOneCollectionService(projectId, collectionForAiChatbot);
    if (!chatbotCollection) throw new Error('Chatbot collection does not exist');

    let chatbotRoomCollection = await findOneCollectionService(projectId, 'ai_chatbot_room');
    if (!chatbotRoomCollection) throw new Error('Chatbot Room collection does not exist');

    if (!query || !context) {
      throw new Error('Query or context missing in request');
    }
    const { data: rooms } = await findItemById(db, projectId, chatbotRoomCollection, null, {
      userId: { $in: [user?.uuid] },
    });
    let chatbotRoom;
    if (!rooms || rooms.length === 0) {
      console.log('No existing chat room found, creating a new one');
      const newRoom = {
        chat_room_id: uuidv4(),
        userId: user.uuid,
      };

      const { data: createdRoom } = await saveItem(
        db,
        projectId,
        environment,
        enableAuditTrail,
        chatbotRoomCollection,
        newRoom,
        null,
        user,
        headers,
      );
      chatbotRoom = createdRoom;
    } else {
      chatbotRoom = rooms;
    }
    const { model, secret_key, temperature } = setting;
    const answer = await getChatbotAnswer(query, context, model, secret_key, temperature);
    const messageToSave = {
      query,
      answer,
      chatbot_room: chatbotRoom.uuid,
    };
    const { data: savedMessage } = await saveItem(
      db,
      projectId,
      environment,
      enableAuditTrail,
      chatbotCollection,
      messageToSave,
      null,
      user,
      headers,
    );

    return {
      code: 200,
      message: 'Chatbot answer retrieved successfully',
      data: {
        room: chatbotRoom,
        message: savedMessage,
      },
    };
  } catch (error) {
    console.error('Error in answerFromChatbotService', error);
    throw error;
  }
};

export const getChatbotAnswer = async (query, context, model, apiKey, temperature) => {
  try {
    const provider = await getProvider(model);
    let response;
    switch (provider) {
      case 'openai':
        response = await callOpenAiLLM(query, context, model, apiKey, temperature);
        break;
      default:
        throw new Error(`Unsupported provider for model: ${model}`);
    }
    return response;
  } catch (error) {
    logger.error(`Error In getChatbotAnswer Service: >> ${error}`);
    throw error;
  }
};

export const continueConversationService = async (req) => {
  try {
    const { db, body, projectId, user, environment } = req;
    if (!db || !body || !environment || !projectId) {
      throw new Error('Invalid request: db, body and environment are required');
    }
    let chatbotRoomCollection = await findOneCollectionService(projectId, 'ai_chatbot_room');
    const { data: room } = await findItemById(db, projectId, chatbotRoomCollection, null, {
      userId: { $in: [user?.uuid] },
    });
    if (!room) {
      return { code: 200, message: 'No previous history of login user', chatHistory: {} };
    }
    const collectionName = 'ai_chatbot_message'.toString().toLowerCase();
    const dbCollection = await db.collection(collectionName);
    const chatHistory = await dbCollection
      .find({ chatbot_room: room.uuid })
      .sort({ createdAt: 1 })
      .project({ query: 1, answer: 1, _id: 0 })
      .toArray();
    return {
      code: 200,
      message: 'Chatbot answer retrieved successfully',
      chatHistory,
    };
  } catch (error) {
    logger.error('error in continue conversation service', error);
    throw error;
  }
};
