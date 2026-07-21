import ChatSession from '../models/ChatSession.js';
import ChatMessage from '../models/ChatMessage.js';
import Repository from '../models/Repository.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateCompletion, generateStreamingCompletion } from './aiService.js';
import { getKnowledgeContext, searchKnowledge, buildKnowledgeBase } from './knowledgeService.js';
import { logger } from '../utils/logger.js';

export async function createSession(userId, repositoryId, title) {
  const session = await ChatSession.create({
    userId,
    repositoryId,
    title: title || 'New Chat',
  });

  return session;
}

export async function getSessions(userId, repositoryId) {
  const filter = { userId };
  if (repositoryId) filter.repositoryId = repositoryId;

  const sessions = await ChatSession.find(filter)
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  return sessions;
}

export async function getSession(sessionId, userId) {
  const session = await ChatSession.findOne({ _id: sessionId, userId }).lean();
  if (!session) throw new Error('Session not found');

  const messages = await ChatMessage.find({ sessionId })
    .sort({ createdAt: 1 })
    .lean();

  return { session, messages };
}

export async function sendMessage(sessionId, userId, content) {
  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw new Error('Session not found');

  await ChatMessage.create({
    sessionId,
    role: 'user',
    content,
  });

  const chunkCount = await KnowledgeChunk.countDocuments({ repositoryId: session.repositoryId });
  if (chunkCount === 0) {
    try {
      await buildKnowledgeBase(session.repositoryId, userId);
    } catch (err) {
      logger.warn('Knowledge base build failed', { repositoryId: session.repositoryId, error: err.message });
    }
  }

  const context = await getKnowledgeContext(session.repositoryId, content);

  const relevantChunks = await searchKnowledge(session.repositoryId, content);
  const sources = relevantChunks
    .filter((c) => c.sourceFile)
    .map((c) => ({
      file: c.sourceFile,
      type: c.type,
      title: c.title,
    }))
    .slice(0, 10);

  const prompt = `You are Lumora, an AI engineer that understands this codebase completely.

Context about the repository:
${context}

Question: ${content}

Answer the question based on the repository context above. If the information isn't in the context, say so. Always reference specific files and code when possible.`;

  try {
    const answer = await generateCompletion(prompt, {
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: 'You are Lumora, an AI software intelligence engineer. Answer based on the provided repository context. Reference specific files and code. Be accurate and concise.',
    });

    await ChatMessage.create({
      sessionId,
      role: 'assistant',
      content: answer,
      sources,
    });

    await ChatSession.findByIdAndUpdate(sessionId, { updatedAt: new Date() });

    return { answer, sources };
  } catch (err) {
    logger.error('Chat message failed', { sessionId, error: err.message });
    throw err;
  }
}

export async function sendMessageStreaming(sessionId, userId, content, onChunk) {
  const session = await ChatSession.findOne({ _id: sessionId, userId });
  if (!session) throw new Error('Session not found');

  await ChatMessage.create({
    sessionId,
    role: 'user',
    content,
  });

  const chunkCount = await KnowledgeChunk.countDocuments({ repositoryId: session.repositoryId });
  if (chunkCount === 0) {
    try {
      await buildKnowledgeBase(session.repositoryId, userId);
    } catch (err) {
      logger.warn('Knowledge base build failed', { repositoryId: session.repositoryId, error: err.message });
    }
  }

  const context = await getKnowledgeContext(session.repositoryId, content);

  const relevantChunks = await searchKnowledge(session.repositoryId, content);
  const sources = relevantChunks
    .filter((c) => c.sourceFile)
    .map((c) => ({
      file: c.sourceFile,
      type: c.type,
      title: c.title,
    }))
    .slice(0, 10);

  const prompt = `Context about the repository:
${context}

Question: ${content}

Answer based on the repository context above. Reference specific files.`;

  try {
    const fullAnswer = await generateStreamingCompletion(prompt, onChunk, {
      temperature: 0.2,
      maxTokens: 4096,
      systemPrompt: 'You are Lumora, an AI software intelligence engineer. Answer based on the provided repository context. Reference specific files and code.',
    });

    await ChatMessage.create({
      sessionId,
      role: 'assistant',
      content: fullAnswer,
      sources,
    });

    await ChatSession.findByIdAndUpdate(sessionId, { updatedAt: new Date() });

    return { sources };
  } catch (err) {
    logger.error('Chat streaming failed', { sessionId, error: err.message });
    throw err;
  }
}

export async function generateProjectExplanation(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const context = await getKnowledgeContext(repositoryId, 'Explain this project architecture, technologies, and data flow');

  const prompt = `Explain this repository to a new developer who has never seen it before.

Repository Context:
${context}

Generate a comprehensive explanation covering:
1. Project purpose and what it does
2. Main technologies and stack
3. Architecture overview and data flow
4. Important files and directories
5. How authentication works
6. External services used
7. Common modification points
8. Warnings and gotchas

Be specific. Reference actual files, endpoints, and technologies detected in the codebase.`;

  const answer = await generateCompletion(prompt, {
    temperature: 0.3,
    maxTokens: 8192,
  });

  return answer;
}

export async function generateChangeImpact(repositoryId, filePath) {
  const context = await getKnowledgeContext(repositoryId, `What does the file ${filePath} do and what depends on it?`);

  const prompt = `Analyze the impact of modifying ${filePath} in this codebase.

Context:
${context}

Generate a change impact analysis covering:
1. What this file does
2. What depends on this file (imports it, calls it, extends it)
3. What this file depends on
4. Risk level (LOW / MEDIUM / HIGH)
5. Recommended approach for safe changes
6. What to test after changing this file`;

  const answer = await generateCompletion(prompt, {
    temperature: 0.2,
    maxTokens: 4096,
  });

  return answer;
}
