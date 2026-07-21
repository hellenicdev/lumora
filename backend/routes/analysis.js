import { Router } from 'express';
import * as analysisController from '../controllers/analysisController.js';
import { authenticate } from '../middlewares/auth.js';
import { enforceLimit } from '../middlewares/usage.js';

const router = Router();

router.get('/:id/health', authenticate, analysisController.getHealth);
router.get('/:id/security', authenticate, analysisController.getSecurity);
router.post('/:id/security/scan', authenticate, enforceLimit('securityScans'), analysisController.runSecurityScan);
router.post('/:id/security/:incidentId/resolve', authenticate, analysisController.resolveSecurityIncident);
router.post('/:id/security/:incidentId/dismiss', authenticate, analysisController.dismissSecurityIncident);
router.post('/:id/impact', authenticate, analysisController.analyzeImpact);

export default router;
