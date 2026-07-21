import ApiEndpoint from '../models/ApiEndpoint.js';
import EnvironmentVariable from '../models/EnvironmentVariable.js';
import Dependency from '../models/Dependency.js';

export function analyzeJavaScript(content, filePath) {
  const analysis = {
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    routes: [],
    envVars: [],
  };

  const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([\s\S]*?)\)/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    analysis.functions.push({
      name: match[1],
      parameters: match[2].split(',').map((p) => p.trim()).filter(Boolean),
      file: filePath,
    });
  }

  const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([\s\S]*?)\)\s*=>/g;
  while ((match = arrowFunctionRegex.exec(content)) !== null) {
    analysis.functions.push({
      name: match[1],
      parameters: match[2].split(',').map((p) => p.trim()).filter(Boolean),
      file: filePath,
    });
  }

  const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
  while ((match = classRegex.exec(content)) !== null) {
    analysis.classes.push({
      name: match[1],
      extends: match[2] || null,
      file: filePath,
    });
  }

  const importRegex = /import\s+(?:\{[^}]*\}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(content)) !== null) {
    analysis.imports.push({
      source: match[1],
      file: filePath,
    });
  }

  const requireRegex = /(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    analysis.imports.push({
      source: match[1],
      file: filePath,
    });
  }

  const exportRegex = /export\s+(default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    analysis.exports.push({
      name: match[2],
      default: !!match[1],
      file: filePath,
    });
  }

  const envRegex = /process\.env\.(\w+)/g;
  while ((match = envRegex.exec(content)) !== null) {
    analysis.envVars.push({
      name: match[1],
      file: filePath,
    });
  }

  analysis.routes = detectRoutes(content, filePath);

  return analysis;
}

function detectRoutes(content, filePath) {
  const routes = [];
  const methodPatterns = [
    { method: 'GET', regex: /(?:router|app)\.get\s*\(\s*['"]([^'"]+)['"]/g },
    { method: 'POST', regex: /(?:router|app)\.post\s*\(\s*['"]([^'"]+)['"]/g },
    { method: 'PUT', regex: /(?:router|app)\.put\s*\(\s*['"]([^'"]+)['"]/g },
    { method: 'PATCH', regex: /(?:router|app)\.patch\s*\(\s*['"]([^'"]+)['"]/g },
    { method: 'DELETE', regex: /(?:router|app)\.delete\s*\(\s*['"]([^'"]+)['"]/g },
  ];

  for (const { method, regex } of methodPatterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      routes.push({
        method,
        path: match[1],
        file: filePath,
      });
    }
  }

  return routes;
}

export function detectFrameworks(dependencies) {
  const frameworks = [];

  const detectors = [
    { name: 'Express', pattern: /express/ },
    { name: 'React', pattern: /react/ },
    { name: 'Next.js', pattern: /next/ },
    { name: 'Vue', pattern: /vue/ },
    { name: 'Angular', pattern: /@angular/ },
    { name: 'Svelte', pattern: /svelte/ },
    { name: 'Socket.IO', pattern: /socket\.io/ },
    { name: 'Mongoose', pattern: /mongoose/ },
    { name: 'Prisma', pattern: /prisma/ },
    { name: 'TypeORM', pattern: /typeorm/ },
    { name: 'Jest', pattern: /jest/ },
    { name: 'Mocha', pattern: /mocha/ },
    { name: 'Cypress', pattern: /cypress/ },
    { name: 'Tailwind', pattern: /tailwindcss/ },
    { name: 'Bootstrap', pattern: /bootstrap/ },
    { name: 'Django', pattern: /django/ },
    { name: 'Flask', pattern: /flask/ },
    { name: 'FastAPI', pattern: /fastapi/ },
    { name: 'Spring', pattern: /spring/ },
    { name: 'Gin', pattern: /gin/ },
    { name: 'Echo', pattern: /echo/ },
    { name: 'Rocket', pattern: /rocket/ },
    { name: 'Laravel', pattern: /laravel/ },
  ];

  for (const dep of dependencies) {
    for (const detector of detectors) {
      if (detector.pattern.test(dep.name) && !frameworks.find((f) => f.name === detector.name)) {
        frameworks.push({ name: detector.name, detectedIn: dep.name });
      }
    }
  }

  return frameworks;
}

export function parseDependencies(packageJsonContent) {
  const deps = [];
  try {
    const pkg = JSON.parse(packageJsonContent);
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({ name, version, type: 'production' });
      }
    }
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({ name, version, type: 'development' });
      }
    }
  } catch {}
  return deps;
}

export function analyzeFile(filePath, content) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  const analysis = { path: filePath, functions: [], classes: [], imports: [], envVars: [], routes: [] };

  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    Object.assign(analysis, analyzeJavaScript(content, filePath));
  }

  return analysis;
}
