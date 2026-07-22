import { Router } from 'express';
import * as organizationController from '../controllers/organizationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/', authenticate, organizationController.create);
router.get('/', authenticate, organizationController.list);
router.get('/invitations', authenticate, organizationController.myInvitations);
router.get('/:id', authenticate, organizationController.getById);
router.post('/:id/invite', authenticate, organizationController.invite);
router.post('/:id/accept', authenticate, organizationController.acceptInvite);
router.post('/:id/reject', authenticate, organizationController.rejectInvite);
router.post('/:id/leave', authenticate, organizationController.leave);
router.delete('/:id/member/:userId', authenticate, organizationController.removeMember);
router.patch('/:id/member/:userId', authenticate, organizationController.updateMemberRole);

export default router;
