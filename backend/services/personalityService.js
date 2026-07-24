import Repository from '../models/Repository.js';
import RepositorySnapshot from '../models/RepositorySnapshot.js';
import GraphNode from '../models/GraphNode.js';
import GraphEdge from '../models/GraphEdge.js';
import ApiEndpoint from '../models/ApiEndpoint.js';
import Dependency from '../models/Dependency.js';
import { generateCompletion } from './aiService.js';

export async function generatePersonality(repositoryId) {
  const repo = await Repository.findById(repositoryId);
  if (!repo) throw new Error('Repository not found');

  const snapshot = await RepositorySnapshot.findOne({ repositoryId }).sort({ createdAt: -1 });
  const nodes = await GraphNode.find({ repositoryId });
  const edges = await GraphEdge.find({ repositoryId });
  const endpoints = await ApiEndpoint.find({ repositoryId });
  const deps = await Dependency.find({ repositoryId });

  const files = snapshot?.tree?.filter((f) => f.type === 'blob') || [];
  const extensions = [...new Set(files.map((f) => f.path.split('.').pop()).filter(Boolean))];
  const testFiles = files.filter((f) => /\.(test|spec)\.|__tests__\/|_test\./i.test(f.path)).length;

  const depNames = deps.map((d) => d.name).slice(0, 20);
  const routeMethods = [...new Set(endpoints.map((e) => e.method))];
  const types = [...new Set(nodes.map((n) => n.type))];

  const prompt = `You are a codebase analyst. Summarize this repository in exactly TWO sentences.

Language/tech: ${extensions.slice(0, 8).join(', ')}
Files: ${files.length} total (${testFiles} test files)
Dependencies: ${depNames.join(', ') || 'none detected'}
Routes: ${endpoints.length} (${routeMethods.join(', ')})}
Architecture: ${nodes.length} modules, ${edges.length} connections
Types detected: ${types.join(', ')}
Description: ${repo.description || 'none'}

First sentence: Describe what this project is (e.g., "a modern TypeScript REST API", "a Python data pipeline", etc.).
Second sentence: Evaluate its quality — organization, testing, documentation, architecture.

Format:
This is [TYPE]. The codebase [STRENGTH] but [WEAKNESS].`;

  try {
    const response = await generateCompletion(prompt, { maxTokens: 150, temperature: 0.7 });
    const personality = response?.trim() || 'No summary generated.';
    return { personality, generatedAt: new Date() };
  } catch {
    return { personality: 'Could not generate repository personality.', generatedAt: new Date() };
  }
}
