import { Router } from 'express';
import * as webhookController from '../controllers/webhookController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/repositories/:id/webhook/setup', authenticate, webhookController.setup);
router.get('/repositories/:id/webhook/status', authenticate, webhookController.status);
router.post('/repositories/:id/webhook/disable', authenticate, webhookController.disable);
router.post('/webhooks/github/:token', webhookController.handle);

export default router;
