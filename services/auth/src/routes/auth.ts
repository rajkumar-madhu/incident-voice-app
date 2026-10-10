import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { CreateUserSchema, LoginSchema, SignupSchema } from '../types/index.js';
import { authenticate, requireRole, verifyJwt } from '../middleware/auth.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';
import { ValidationError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /auth/signup
 * Public: create an organisation and its first admin, and sign them in
 */
router.post(
  '/signup',
  strictRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = SignupSchema.parse(req.body);
      const result = await authService.signupWithTenant(data);

      res.status(201).json({
        success: true,
        data: {
          tenant: result.tenant,
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/register
 * Add a user to the caller's tenant (tenant admins only)
 */
router.post(
  '/register',
  strictRateLimiter,
  authenticate,
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateUserSchema.parse({
        ...req.body,
        tenant_id: req.context!.tenant_id,
      });
      const result = await authService.registerUser(data, req.context!.tenant_id);

      res.status(201).json({
        success: true,
        data: { user: result.user },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/login
 * Login with email and password
 */
router.post(
  '/login',
  strictRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = LoginSchema.parse(req.body);
      const result = await authService.loginUser(data);

      res.json({
        success: true,
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new ValidationError('refreshToken is required');
      }

      const tokens = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: { tokens },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/logout
 * Logout (blacklist token)
 */
router.post(
  '/logout',
  verifyJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization?.substring(7);
      const refreshToken = req.body?.refreshToken;
      if (token) {
        await authService.logoutUser(token, refreshToken);
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /auth/change-password
 * Change password
 */
router.post(
  '/change-password',
  verifyJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8).max(128),
      });

      const { currentPassword, newPassword } = schema.parse(req.body);

      await authService.changePassword(
        req.context!.user_id!,
        req.context!.tenant_id,
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /auth/me
 * Get current user profile
 */
router.get(
  '/me',
  verifyJwt,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getUserById(
        req.context!.user_id!,
        req.context!.tenant_id
      );

      res.json({
        success: true,
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
