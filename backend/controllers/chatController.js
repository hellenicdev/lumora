import * as chatService from '../services/chatService.js';
import { success, error } from '../utils/response.js';
import { getIO } from '../socket/index.js';
import { logger } from '../utils/logger.js';
import { recordUsage } from '../middlewares/usage.js';
import { logAuditEvent } from '../utils/audit.js';

export async function createSession(req, res) {
  try {
    const { repositoryId, title } = req.body;
    if (!repositoryId) return error(res, 'Repository ID required', 400);

    const session = await chatService.createSession(req.user._id, repositoryId, title);
    return success(res, { session }, 'Chat session created', 201);
  } catch (err) {
    return error(res, 'Failed to create session', 500);
  }
}

export async function listSessions(req, res) {
  try {
    const sessions = await chatService.getSessions(req.user._id, req.query.repositoryId);
    return success(res, { sessions });
  } catch (err) {
    return error(res, 'Failed to list sessions', 500);
  }
}

export async function getSession(req, res) {
  try {
    const result = await chatService.getSession(req.params.id, req.user._id);
    return success(res, result);
  } catch (err) {
    if (err.message === 'Session not found') return error(res, err.message, 404);
    return error(res, 'Failed to get session', 500);
  }
}

export async function sendMessage(req, res) {
  try {
    const { content } = req.body;
    if (!content) return error(res, 'Message content required', 400);

    const result = await chatService.sendMessage(req.params.id, req.user._id, content);
    await recordUsage(req, 'aiQuestions');
    return success(res, result);
  } catch (err) {
    logger.error('Chat message error', { sessionId: req.params.id, error: err.message });
    return error(res, err.message, 500);
  }
}

export async function sendMessageStream(req, res) {
  try {
    const { content } = req.body;
    if (!content) return error(res, 'Message content required', 400);

    const sessionId = req.params.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let sources = [];

    await chatService.sendMessageStreaming(
      sessionId,
      req.user._id,
      content,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
    );

    await recordUsage(req, 'aiQuestions');

    res.write(`data: ${JSON.stringify({ type: 'done', sources })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      return error(res, err.message, 500);
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
}

export async function getHistory(req, res) {
  try {
    const messages = await chatService.getSession(req.params.id, req.user._id);
    return success(res, messages);
  } catch (err) {
    return error(res, 'Failed to get history', 500);
  }
}

export async function deleteSession(req, res) {
  try {
    await chatService.deleteSession(req.params.id, req.user._id);
    await logAuditEvent({
      userId: req.user._id,
      action: 'chat.session.deleted',
      resource: 'ChatSession',
      resourceId: req.params.id,
      req,
    });
    return success(res, null, 'Session deleted');
  } catch (err) {
    return error(res, 'Failed to delete session', 500);
  }
}

export async function explainProject(req, res) {
  try {
    const { repositoryId } = req.body;
    if (!repositoryId) return error(res, 'Repository ID required', 400);

    const explanation = await chatService.generateProjectExplanation(repositoryId);
    return success(res, { explanation });
  } catch (err) {
    return error(res, err.message, 500);
  }
}

export async function analyzeImpact(req, res) {
  try {
    const { repositoryId, file } = req.body;
    if (!repositoryId || !file) return error(res, 'Repository ID and file path required', 400);

    const analysis = await chatService.generateChangeImpact(repositoryId, file);
    return success(res, { analysis });
  } catch (err) {
    return error(res, err.message, 500);
  }
}
