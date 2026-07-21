import { Router } from 'express';
import * as chatController from '../controllers/chatController.js';
import { authenticate } from '../middlewares/auth.js';
import { enforceLimit } from '../middlewares/usage.js';

const router = Router();

router.post('/session', authenticate, chatController.createSession);
router.get('/sessions', authenticate, chatController.listSessions);
router.get('/session/:id', authenticate, chatController.getSession);
router.get('/session/:id/history', authenticate, chatController.getHistory);
router.post('/session/:id/message', authenticate, enforceLimit('aiQuestions'), chatController.sendMessage);
router.post('/session/:id/stream', authenticate, enforceLimit('aiQuestions'), chatController.sendMessageStream);
router.delete('/session/:id', authenticate, chatController.deleteSession);
router.post('/explain', authenticate, chatController.explainProject);
router.post('/impact', authenticate, chatController.analyzeImpact);

export default router;
