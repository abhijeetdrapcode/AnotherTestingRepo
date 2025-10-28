import { ChatOpenAI } from '@langchain/openai';

export const getProvider = async (model) => {
  console.log('model in getProvider', model);
  const modelRegistry = [{ provider: 'openai', models: ['gpt-3.5-turbo', 'gpt-4'] }];
  const entry = modelRegistry.find((r) => r.models.includes(model));
  return entry ? entry.provider : null;
};

export const callOpenAiLLM = async (query, context, model, apiKey ,temperature) => {
  console.log('apiKey in callOpenAiLLM', apiKey);
  if (!apiKey || !model) {
    throw new Error('OpenAI API key or model is missing');
  }
  const chat = new ChatOpenAI({
    modelName: model,
    apiKey: apiKey,
    temperature: temperature || 0.7,
  });
  const prompt = buildChatPrompt(query, context);
  const response = await chat.invoke([{ role: 'user', content: prompt }]);
  return response.content;
};

const buildChatPrompt = (query, context) => {
  return `
You are a knowledgeable assistant that provides clear, concise answers based on the provided context.

Context Information:
${context}

User Question: ${query}

Instructions:
1. Copy the most relevant section(s) from the context as the answer.
2. Do not paraphrase, do not summarize — preserve the text as-is.
3. You may adjust formatting (e.g., bullet points, numbering), but do not change the wording.
4. If no relevant answer exists, reply exactly with:
"Sorry, I couldn't find the answer in my knowledge base."

Answer:`;
};
