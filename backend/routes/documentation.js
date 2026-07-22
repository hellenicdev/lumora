import { Router } from 'express';
import * as documentationController from '../controllers/documentationController.js';
import { authenticate } from '../middlewares/auth.js';
import { enforceLimit } from '../middlewares/usage.js';

const router = Router();

router.get('/:id/docs', authenticate, documentationController.listDocs);
router.get('/:id/docs/drift', authenticate, documentationController.checkDrift);
router.get('/:id/docs/status', authenticate, documentationController.getQualityScore);
router.get('/:id/docs/history', authenticate, documentationController.getHistory);
router.post('/:id/docs/generate', authenticate, enforceLimit('docGenerations'), documentationController.generateAll);
router.get('/:id/docs/:type', authenticate, documentationController.getDocByType);
router.get('/:id/docs/:type/versions', authenticate, documentationController.getDocVersions);
router.post('/:id/docs/:type/regenerate', authenticate, enforceLimit('docGenerations'), documentationController.generateByType);

export default router;
