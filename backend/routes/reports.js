import { Router } from 'express';
import * as reportsController from '../controllers/reportsController.js';
import { authenticate } from '../middlewares/auth.js';
import { enforceLimit } from '../middlewares/usage.js';

const router = Router();

router.get('/:id/onboarding', authenticate, enforceLimit('docGenerations'), reportsController.getOnboardingReport);
router.post('/:id/share', authenticate, reportsController.shareReport);
router.get('/shared/:slug', reportsController.getSharedReport);
router.get('/', authenticate, reportsController.listSharedReports);
router.delete('/:reportId', authenticate, reportsController.deleteSharedReport);

export default router;
