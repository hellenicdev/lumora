import { Router } from 'express';
import * as repositoryController from '../controllers/repositoryController.js';
import { authenticate } from '../middlewares/auth.js';
import { enforceLimit } from '../middlewares/usage.js';

const router = Router();

router.get('/', authenticate, repositoryController.list);
router.post('/import', authenticate, enforceLimit('repositories'), repositoryController.importRepo);
router.get('/:id', authenticate, repositoryController.getById);
router.get('/:id/files', authenticate, repositoryController.getFiles);
router.get('/:id/routes', authenticate, repositoryController.getRoutes);
router.get('/:id/dependencies', authenticate, repositoryController.getDependencies);
router.get('/:id/env-vars', authenticate, repositoryController.getEnvVars);
router.get('/:id/graph', authenticate, repositoryController.getGraphData);
router.get('/:id/content', authenticate, repositoryController.getFileContent);
router.post('/:id/resync', authenticate, enforceLimit('repositories'), repositoryController.resync);
router.delete('/:id', authenticate, repositoryController.deleteRepo);

export default router;
