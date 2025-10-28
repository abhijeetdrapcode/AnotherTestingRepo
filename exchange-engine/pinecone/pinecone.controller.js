
import {addDataKnowledgeBaseService, answerFromChatbotService, continueConversationService, queryFromKnowledgeBaseService} from './pinecone.service'
import { logger } from 'drapcode-logger';

export const addDataKnowledgeBase = async (req, res, next) => {
  try {
    const response = await addDataKnowledgeBaseService(
      req,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    logger.error('Error in addDataKnowledgeBase Controller: >>', error);
    next(error);
  }
};



export const  queryFromKnowledgeBase = async (req,res,next)=>{
   try {
    const response = await queryFromKnowledgeBaseService(
      req,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    logger.error('Error in queryFromKnowledgeBase Controller: >> ', error);
    next(error);
  }
}


export const answerFromChatbot= async(req,res,next)=>{
  try {
    const response = await answerFromChatbotService(
      req,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    logger.error('Error in answerFromChatbot Controller: >> ', error);
    next(error);
  }
}


export const  continueConversation=async(req,res,next)=>{
  try {
    const response = await continueConversationService(
      req,
    );
    return res.status(response.code).send(response);
  } catch (error) {
    logger.error('Error in continueConversation Controller: >> ', error);
    next(error);
  }
}