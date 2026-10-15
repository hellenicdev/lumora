const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.less', '.html', '.htm',
  '.md', '.mdx', '.yaml', '.yml', '.toml',
  '.py', '.java', '.go', '.rs', '.php', '.rb',
  '.sh', '.bash', '.zsh', '.dockerfile', '.env',
  '.cfg', '.conf', '.ini', '.xml', '.svg',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.java', '.php', '.rb', '.rs',
]);

const SKIP_DIRECTORIES = new Set([
  'node_modules', '.git', '.github', 'dist', 'build',
  '.next', '.cache', '__pycache__', '.venv', 'venv',
  'vendor', '.bundle', 'target', '.gradle', 'coverage',
  '.nyc_output', '.svelte-kit', '.turbo',
]);

export function isSupportedFile(filePath) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function shouldSkipDirectory(dirName) {
  return SKIP_DIRECTORIES.has(dirName);
}

export function extractFileMetadata(filePath, size) {
  const parts = filePath.split('/');
  return {
    path: filePath,
    name: parts[parts.length - 1],
    extension: '.' + (filePath.split('.').pop() || '').toLowerCase(),
    directory: parts.slice(0, -1).join('/') || '/',
    size,
    lines: 0,
  };
}

export function getLanguageFromExtension(ext) {
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.json': 'json', '.css': 'css', '.scss': 'scss', '.less': 'less',
    '.html': 'html', '.htm': 'html',
    '.md': 'markdown', '.mdx': 'markdown',
    '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
    '.py': 'python', '.java': 'java', '.go': 'go', '.rs': 'rust',
    '.php': 'php', '.rb': 'ruby',
    '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
    '.dockerfile': 'dockerfile',
    '.env': 'dotenv',
  };
  return map[ext] || 'unknown';
}

function pathHasSkippedDir(filePath) {
  return filePath.split('/').some(function (part) { return SKIP_DIRECTORIES.has(part); });
}

async function fetchGitHubFile(accessToken, owner, repo, filePath) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath.split('/').map((s) => encodeURIComponent(s)).join('/')}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.content) {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

function extOf(filePath) {
  return '.' + (filePath.split('.').pop() || '').toLowerCase();
}

function pushUniqueNamed(list, item, key) {
  if (!list.some((existing) => existing[key] === item[key] && existing.file === item.file)) {
    list.push(item);
  }
}

function parseJavaScript(filePath, content, filePathSet, functions, classes, imports, routes) {
  const importRegex = /import\s+(?:(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"])|(?:require\(\s*['"]([^'"]+)['"]\s*\))/g;
  let m;
  while ((m = importRegex.exec(content))) {
    const source = m[1] || m[2];
    if (source) {
      pushUniqueNamed(imports, { file: filePath, source, symbols: [] }, 'source');
    }
  }

  const classRegex = /class\s+([A-Za-z_$][\w$]*)/g;
  while ((m = classRegex.exec(content))) {
    pushUniqueNamed(classes, { name: m[1], file: filePath, extends: null }, 'name');
  }

  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
  while ((m = funcRegex.exec(content))) {
    const name = m[1] || m[2];
    if (name) {
      pushUniqueNamed(functions, { name, file: filePath, parameters: [] }, 'name');
    }
  }

  const routeRegex = /(?:router|app|server|express)\.(get|post|put|patch|delete|use|all)\(\s*['"]([^'"]+)['"]/gi;
  while ((m = routeRegex.exec(content))) {
    pushUniqueNamed(routes, { path: m[2], method: m[1].toUpperCase(), file: filePath, function: 'handler', middleware: [] }, 'path');
  }
}

function parsePython(filePath, content, functions, classes, imports, routes) {
  let m;
  const fromImportRegex = /^\s*(?:from\s+([\w.]+)\s+import\s+([\w,\s*]+)|import\s+([\w.]+))/gm;
  while ((m = fromImportRegex.exec(content))) {
    const source = m[1] || m[3];
    if (source) pushUniqueNamed(imports, { file: filePath, source, symbols: [] }, 'source');
  }

  const classRegex = /^\s*class\s+([A-Za-z_]\w*)/gm;
  while ((m = classRegex.exec(content))) {
    pushUniqueNamed(classes, { name: m[1], file: filePath, extends: null }, 'name');
  }

  const funcRegex = /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/gm;
  while ((m = funcRegex.exec(content))) {
    pushUniqueNamed(functions, { name: m[1], file: filePath, parameters: [] }, 'name');
  }

  const routeRegex = /@(?:app|router|blueprint)\.(route|get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/gi;
  while ((m = routeRegex.exec(content))) {
    pushUniqueNamed(routes, { path: m[2], method: (m[1] || 'GET').toUpperCase(), file: filePath, function: 'handler', middleware: [] }, 'path');
  }
}

function parseGo(filePath, content, functions, classes, imports, routes) {
  let m;
  const importRegex = /"([^"]+)"/g;
  const importBlockRegex = /import\s*\(([\s\S]*?)\)/g;
  let block;
  while ((block = importBlockRegex.exec(content))) {
    let im;
    const reg = /"([^"]+)"/g;
    while ((im = reg.exec(block[1]))) {
      pushUniqueNamed(imports, { file: filePath, source: im[1], symbols: [] }, 'source');
    }
  }
  // single imports
  const singleImportRegex = /^\s*import\s+"([^"]+)"/gm;
  while ((m = singleImportRegex.exec(content))) {
    pushUniqueNamed(imports, { file: filePath, source: m[1], symbols: [] }, 'source');
  }

  const funcRegex = /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?([A-Za-z_]\w*)/gm;
  while ((m = funcRegex.exec(content))) {
    pushUniqueNamed(functions, { name: m[1], file: filePath, parameters: [] }, 'name');
  }

  const routeRegex = /\.(GET|POST|PUT|PATCH|DELETE|Handle|HandleFunc)\(\s*"([^"]+)"/g;
  while ((m = routeRegex.exec(content))) {
    pushUniqueNamed(routes, { path: m[2], method: m[1].toUpperCase(), file: filePath, function: 'handler', middleware: [] }, 'path');
  }
}

function parseJava(filePath, content, functions, classes, imports, routes) {
  let m;
  const importRegex = /^\s*import\s+([\w.]+);/gm;
  while ((m = importRegex.exec(content))) {
    pushUniqueNamed(imports, { file: filePath, source: m[1], symbols: [] }, 'source');
  }
  const classRegex = /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+([A-Za-z_]\w*)/g;
  while ((m = classRegex.exec(content))) {
    pushUniqueNamed(classes, { name: m[1], file: filePath, extends: null }, 'name');
  }
  const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(/g;
  while ((m = methodRegex.exec(content))) {
    pushUniqueNamed(functions, { name: m[1], file: filePath, parameters: [] }, 'name');
  }
  const routeRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping|GetMapping)\(\s*(?:value\s*=\s*)?["']([^"']+)["']/g;
  while ((m = routeRegex.exec(content))) {
    const method = m[1].toUpperCase().replace('MAPPING', '');
    pushUniqueNamed(routes, { path: m[2], method: method === 'REQUEST' ? 'GET' : method, file: filePath, function: 'handler', middleware: [] }, 'path');
  }
}

export async function scanRepository(repositoryId, accessToken, repo, tree) {
  const files = [];
  const functions = [];
  const classes = [];
  const imports = [];
  const routes = [];
  const models = [];
  const services = [];

  const blobs = (tree || []).filter(function (item) { return item.type === 'blob'; });

  const fullName = (repo && (repo.fullName || repo.full_name)) || '';
  const owner = (repo && (repo.owner)) || (fullName ? fullName.split('/')[0] : '');
  const repoName = (repo && (repo.name || repo.repo)) || (fullName ? fullName.split('/').slice(1).join('/') : '');

  // Heuristic classification from file paths (always available)
  for (const item of blobs) {
    if (pathHasSkippedDir(item.path)) continue;

    const meta = extractFileMetadata(item.path, item.size || 0);
    files.push(meta);

    const pathLower = item.path.toLowerCase();
    const ext = extOf(item.path);

    if (pathLower.includes('/models/') || pathLower.endsWith('model.js') || pathLower.endsWith('model.ts') || pathLower.endsWith('schema.js') || pathLower.endsWith('schema.ts')) {
      const name = item.path.split('/').pop().replace(/\.\w+$/, '');
      models.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        file: item.path,
        fields: {},
      });
    }

    if (pathLower.includes('/services/') || pathLower.endsWith('service.js') || pathLower.endsWith('service.ts')) {
      services.push({
        name: item.path.split('/').pop().replace(/\.\w+$/, ''),
        file: item.path,
      });
    }
  }

  // Deep content parsing for code files. Bounded to keep imports fast.
  if (accessToken && owner && repoName) {
    const candidateFiles = blobs.filter(function (item) {
      return !pathHasSkippedDir(item.path) && CODE_EXTENSIONS.has(extOf(item.path)) && (item.size || 0) <= 200000;
    }).slice(0, 50);

    let totalSize = 0;
    for (const item of candidateFiles) {
      const size = item.size || 0;
      if (totalSize + size > 500000) break;
      totalSize += size;

      const content = await fetchGitHubFile(accessToken, owner, repoName, item.path);
      if (!content) continue;

      const ext = extOf(item.path);
      if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
        parseJavaScript(item.path, content, new Set(blobs.map((b) => b.path)), functions, classes, imports, routes);
      } else if (ext === '.py') {
        parsePython(item.path, content, functions, classes, imports, routes);
      } else if (ext === '.go') {
        parseGo(item.path, content, functions, classes, imports, routes);
      } else if (ext === '.java') {
        parseJava(item.path, content, functions, classes, imports, routes);
      }
    }
  }

  // Heuristic route entries for remaining controller/route/handler files that were not parsed (no token or binary/large).
  const parsedFiles = new Set(routes.map((r) => r.file));
  for (const item of blobs) {
    if (pathHasSkippedDir(item.path)) continue;
    const pathLower = item.path.toLowerCase();
    if (parsedFiles.has(item.path)) continue;
    if (pathLower.includes('route') || pathLower.includes('controller') || pathLower.includes('handler') || pathLower.includes('api/') || pathLower.includes('endpoint')) {
      routes.push({
        path: '/' + item.path.replace(/\.\w+$/, '').replace(/\/index$/, ''),
        method: 'GET',
        file: item.path,
        function: 'handler',
        middleware: [],
      });
    }
  }

  return { files, functions, classes, imports, routes, models, services };
}

export function generateTreeStructure(files) {
  const tree = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      if (isLast) {
        current[parts[i]] = { type: 'file', ...file };
      } else {
        if (!current[parts[i]]) {
          current[parts[i]] = { type: 'directory', children: {} };
        }
        current = current[parts[i]].children;
      }
    }
  }

  return tree;
}
