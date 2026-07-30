import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, getAuditLogs);

export default router;
