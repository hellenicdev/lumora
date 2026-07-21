import { Router } from 'express';
import authRoutes from './auth.js';
import githubRoutes from './github.js';
import repositoryRoutes from './repositories.js';
import documentationRoutes from './documentation.js';
import chatRoutes from './chat.js';
import analysisRoutes from './analysis.js';
import organizationRoutes from './organizations.js';
import billingRoutes from './billing.js';
import config from '../config/index.js';

const router = Router();

router.use('/auth', authRoutes);

if (config.github.clientId && config.github.clientSecret) {
  router.use('/github', githubRoutes);
}

router.use('/repositories', repositoryRoutes);
router.use('/repositories', documentationRoutes);
router.use('/repositories', analysisRoutes);
router.use('/chat', chatRoutes);
router.use('/organizations', organizationRoutes);
router.use('/billing', billingRoutes);

export default router;
