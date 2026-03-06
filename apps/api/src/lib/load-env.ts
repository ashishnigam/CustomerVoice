import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envLinePattern = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/;

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return '';
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1);
    return trimmed.startsWith('"') ? unquoted.replace(/\\n/g, '\n') : unquoted;
  }

  const commentStart = trimmed.indexOf(' #');
  return commentStart >= 0 ? trimmed.slice(0, commentStart).trim() : trimmed;
}

function loadEnvFile(filePath: string, protectedKeys: Set<string>): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) {
      continue;
    }

    const match = line.match(envLinePattern);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ''] = match;
    if (protectedKeys.has(key)) {
      continue;
    }

    process.env[key] = parseEnvValue(rawValue);
  }
}

export function loadLocalEnv(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const appRoot = path.resolve(path.dirname(currentFile), '..', '..');
  const workspaceRoot = path.resolve(appRoot, '..', '..');
  const protectedKeys = new Set(Object.keys(process.env));

  loadEnvFile(path.join(workspaceRoot, '.env'), protectedKeys);
  loadEnvFile(path.join(workspaceRoot, '.env.local'), protectedKeys);
  loadEnvFile(path.join(appRoot, '.env'), protectedKeys);
  loadEnvFile(path.join(appRoot, '.env.local'), protectedKeys);
}
