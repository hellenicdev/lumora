const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.less', '.html', '.htm',
  '.md', '.mdx', '.yaml', '.yml', '.toml',
  '.py', '.java', '.go', '.rs', '.php', '.rb',
  '.sh', '.bash', '.zsh', '.dockerfile', '.env',
  '.cfg', '.conf', '.ini', '.xml', '.svg',
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

export async function scanRepository(repositoryId, accessToken, repo, tree) {
  const files = [];
  const functions = [];
  const classes = [];
  const imports = [];
  const routes = [];
  const models = [];
  const services = [];

  const blobs = tree.filter(function (item) { return item.type === 'blob'; });

  for (const item of blobs) {
    const meta = extractFileMetadata(item.path, item.size || 0);
    files.push(meta);

    const pathLower = item.path.toLowerCase();

    if (pathLower.includes('route') || pathLower.includes('controller') || pathLower.includes('handler') || pathLower.includes('api/') || pathLower.includes('endpoint')) {
      routes.push({
        path: '/' + item.path.replace(/\.\w+$/, '').replace(/\/index$/, ''),
        method: 'GET',
        file: item.path,
        function: 'handler',
        middleware: [],
      });
    }

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
