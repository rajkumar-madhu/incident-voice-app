import { Router, Request, Response, NextFunction } from 'express';
import * as agentService from '../services/agentService.js';
import { CreateAgentSchema, UpdateAgentSchema } from '../types/dashboard.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post(
  '/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = CreateAgentSchema.parse(req.body);
      const agent = await agentService.createAgent(req.context!.tenant_id, data);
      res.status(201).json({ success: true, data: { agent } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const agents = await agentService.listAgents(req.context!.tenant_id, includeInactive);
      res.json({ success: true, data: { agents } });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:agent_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await agentService.getAgentById(req.params.agent_id, req.context!.tenant_id);
      res.json({ success: true, data: { agent } });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:agent_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = UpdateAgentSchema.parse(req.body);
      const agent = await agentService.updateAgent(req.params.agent_id, req.context!.tenant_id, data);
      res.json({ success: true, data: { agent } });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:agent_id',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await agentService.deleteAgent(req.params.agent_id, req.context!.tenant_id);
      res.json({ success: true, message: 'Agent deactivated' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:agent_id/duplicate',
  authenticate,
  rateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const agent = await agentService.duplicateAgent(req.params.agent_id, req.context!.tenant_id);
      res.status(201).json({ success: true, data: { agent } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
