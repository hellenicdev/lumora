import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import { verifyTurnstile } from '../middlewares/turnstile.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

const loginSchema = {
  email: [{ required: true, type: 'email' }],
  password: [{ required: true, minLength: 8 }],
};

const registerSchema = {
  email: [{ required: true, type: 'email' }],
  password: [{ required: true, minLength: 8 }],
  name: [{ maxLength: 100 }],
};

router.post('/register', authLimiter, verifyTurnstile, validate(registerSchema), authController.register);
router.post('/login', authLimiter, verifyTurnstile, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-everywhere', authenticate, authController.logoutEverywhere);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/forgot-password', authLimiter, verifyTurnstile, validate({ email: [{ required: true, type: 'email' }] }), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate({ password: [{ required: true, minLength: 8 }] }), authController.resetPassword);
router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, authController.updateProfile);
router.post('/change-password', authenticate, validate({ currentPassword: [{ required: true }], newPassword: [{ required: true, minLength: 8 }] }), authController.changePassword);
router.get('/usage', authenticate, authController.getMyUsage);
router.get('/dashboard-stats', authenticate, authController.getDashboardStats);
router.post('/activate-plan', authenticate, authController.activatePlan);

export default router;
