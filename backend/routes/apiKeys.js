import { Router } from 'express';
import * as apiKeyController from '../controllers/apiKeyController.js';
import { authenticate } from '../middlewares/auth.js';
import { requireRole } from '../middlewares/role.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const nameRule = { maxLength: 100 };
const createSchema = { name: [nameRule] };
const updateSchema = { name: [nameRule] };

router.get('/', authenticate, apiKeyController.list);
router.post('/', authenticate, requireRole('pro'), validate(createSchema), apiKeyController.create);
router.patch('/:id', authenticate, validate(updateSchema), apiKeyController.update);
router.delete('/:id', authenticate, apiKeyController.remove);

export default router;
