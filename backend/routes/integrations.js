import { Router } from 'express';
import * as integrationController from '../controllers/integrationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, integrationController.list);
router.post('/', authenticate, integrationController.create);
router.put('/:id', authenticate, integrationController.update);
router.delete('/:id', authenticate, integrationController.remove);
router.post('/:id/test', authenticate, integrationController.test);

export default router;
