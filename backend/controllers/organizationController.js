import * as teamService from '../services/teamService.js';
import { success, error } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function create(req, res) {
  try {
    const { name } = req.body;
    if (!name) return error(res, 'Organization name required', 400);

    const org = await teamService.createOrganization(name, req.user._id);
    return success(res, { organization: org }, 'Organization created', 201);
  } catch (err) {
    return error(res, 'Failed to create organization', 500);
  }
}

export async function list(req, res) {
  try {
    const orgs = await teamService.getOrganizations(req.user._id);
    return success(res, { organizations: orgs });
  } catch (err) {
    return error(res, 'Failed to list organizations', 500);
  }
}

export async function getById(req, res) {
  try {
    const org = await teamService.getOrganization(req.params.id, req.user._id);
    return success(res, { organization: org });
  } catch (err) {
    if (err.message === 'Organization not found') return error(res, err.message, 404);
    return error(res, 'Failed to get organization', 500);
  }
}

export async function invite(req, res) {
  try {
    const { email, role } = req.body;
    if (!email) return error(res, 'Email required', 400);

    const org = await teamService.inviteMember(req.params.id, email, role || 'developer', req.user._id);
    return success(res, { organization: org }, 'Member invited');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function removeMember(req, res) {
  try {
    const org = await teamService.removeMember(req.params.id, req.params.userId, req.user._id);
    return success(res, { organization: org }, 'Member removed');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

export async function updateMemberRole(req, res) {
  try {
    const { role } = req.body;
    if (!role) return error(res, 'Role required', 400);

    const org = await teamService.updateMemberRole(req.params.id, req.params.userId, role, req.user._id);
    return success(res, { organization: org }, 'Role updated');
  } catch (err) {
    return error(res, err.message, 400);
  }
}
