import express from 'express';
import {
 addDataKnowledgeBase,
 answerFromChatbot,
 continueConversation,
 queryFromKnowledgeBase
} from './pinecone.controller';

const pineconeRouter = express.Router();

pineconeRouter.post('/upload-data', addDataKnowledgeBase);
pineconeRouter.post('/query-from-knowledge-base',queryFromKnowledgeBase )
pineconeRouter.post('/answer-from-chatbot',answerFromChatbot )
pineconeRouter.post('/continue-conversation',continueConversation)


export default pineconeRouter;