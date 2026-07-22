import { Router } from 'express';
import * as githubController from '../controllers/githubController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/login', githubController.login);
router.get('/connect', authenticate, githubController.connect);
router.get('/callback', githubController.callback);
router.get('/repositories', authenticate, githubController.getRepositories);
router.post('/disconnect', authenticate, githubController.disconnect);
router.get('/status', authenticate, githubController.status);

export default router;
