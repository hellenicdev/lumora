import { Router } from 'express';
import * as billingController from '../controllers/billingController.js';
import { authenticate } from '../middlewares/auth.js';
import { webhookLimiter } from '../middlewares/rateLimiter.js';
import config from '../config/index.js';

const router = Router();

router.get('/plans', billingController.getPlans);
router.get('/kofi-link', authenticate, billingController.getKoFiLink);
router.get('/subscription', authenticate, billingController.getSubscription);

if (config.kofi.pageUrl) {
  router.post('/webhook', webhookLimiter, billingController.webhook);
}

export default router;
