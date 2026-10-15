import Repository from '../models/Repository.js';
import { error } from './response.js';

/**
 * Resolve a repository that belongs to the given user.
 * Returns the repository document, or null if it does not exist / is not owned.
 */
export async function findOwnedRepository(repositoryId, userId) {
  if (!repositoryId || !userId) return null;
  return Repository.findOne({ _id: repositoryId, userId }).lean();
}

/**
 * Respond 404 and return null if the requested repository is not owned by the
 * authenticated user. Convenience wrapper for controllers.
 */
export async function getOwnedRepoOr404(req, res, repositoryId = req.params.id) {
  const repo = await Repository.findOne({ _id: repositoryId, userId: req.user._id });
  if (!repo) {
    error(res, 'Repository not found', 404);
    return null;
  }
  return repo;
}
