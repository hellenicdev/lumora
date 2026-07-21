import OpenAI from 'openai';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

let client = null;

function getClient() {
  if (client) return client;

  if (config.ai.provider === 'groq') {
    client = new OpenAI({
      apiKey: config.ai.groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  } else {
    client = new OpenAI({
      apiKey: config.ai.groqApiKey,
    });
  }

  return client;
}

export async function generateCompletion(prompt, options = {}) {
  const {
    model = config.ai.groqModel,
    temperature = 0.3,
    maxTokens = 4096,
    systemPrompt = 'You are Lumora, an AI software intelligence engineer. You understand codebases deeply and generate accurate, production-quality documentation.',
  } = options;

  try {
    const c = getClient();
    const response = await c.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0].message.content;
  } catch (err) {
    logger.error('AI completion failed', { error: err.message, provider: config.ai.provider });
    throw new Error(`AI generation failed: ${err.message}`);
  }
}

export async function generateFastCompletion(prompt, systemPrompt) {
  return generateCompletion(prompt, {
    model: config.ai.groqModelFast,
    temperature: 0.1,
    maxTokens: 1024,
    systemPrompt: systemPrompt || 'You are Lumora, an AI software engineer. Be concise and accurate.',
  });
}

export async function generateStreamingCompletion(prompt, onChunk, options = {}) {
  const {
    model = config.ai.groqModel,
    temperature = 0.3,
    systemPrompt = 'You are Lumora, an AI software intelligence engineer.',
  } = options;

  try {
    const c = getClient();
    const stream = await c.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: 4096,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullContent += content;
      if (onChunk) onChunk(content);
    }

    return fullContent;
  } catch (err) {
    logger.error('AI streaming failed', { error: err.message });
    throw new Error(`AI generation failed: ${err.message}`);
  }
}
