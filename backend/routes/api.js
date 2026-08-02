import { Router } from 'express';
import { authenticateApiKey } from '../middlewares/authenticateApiKey.js';
import { enforceLimit } from '../middlewares/usage.js';
import * as publicApiController from '../controllers/publicApiController.js';

const router = Router();

router.use(authenticateApiKey);

router.get('/me', publicApiController.me);
router.get('/repositories', publicApiController.repositories);
router.get('/reports/:repositoryId', enforceLimit('docGenerations'), publicApiController.report);

export default router;
