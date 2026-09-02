import * as fs from 'fs';
import * as path from 'path';

export interface NarrationArtifacts {
  videoPath: string;
  srtPath: string;
  modifiedMs: number;
}

interface PartialPair {
  videoPath?: string;
  srtPath?: string;
  modifiedMs: number;
}

export async function findLatestNarrationArtifacts(
  roots: string[],
  maxDepth = 4,
): Promise<NarrationArtifacts | undefined> {
  const pairs = new Map<string, PartialPair>();
  const visited = new Set<string>();
  const ignoredDirectories = new Set([
    '.git', '.vscode-test', 'build', 'dist', 'node_modules', 'out',
  ]);

  const visit = async (directory: string, depth: number): Promise<void> => {
    const normalized = path.resolve(directory).toLowerCase();
    if (visited.has(normalized) || depth > maxDepth) {
      return;
    }
    visited.add(normalized);

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name.toLowerCase())) {
          continue;
        }
        await visit(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (extension !== '.mp4' && extension !== '.srt') {
        continue;
      }

      const key = path.join(directory, path.basename(entry.name, extension)).toLowerCase();
      const pair = pairs.get(key) ?? { modifiedMs: 0 };
      const stat = await fs.promises.stat(fullPath);
      pair.modifiedMs = Math.max(pair.modifiedMs, stat.mtimeMs);
      if (extension === '.mp4') {
        pair.videoPath = fullPath;
      } else {
        pair.srtPath = fullPath;
      }
      pairs.set(key, pair);
    }
  };

  await Promise.all(roots.map(root => visit(root, 0)));

  return [...pairs.values()]
    .filter((pair): pair is Required<PartialPair> =>
      pair.videoPath !== undefined && pair.srtPath !== undefined)
    .sort((left, right) => right.modifiedMs - left.modifiedMs)[0];
}

export function resolveDubbingExecutable(
  configured: string,
  baseDirectory: string,
  pathValue = process.env.PATH ?? '',
): string | undefined {
  const value = configured.trim() || 'srt-dubber';
  const isPath = path.isAbsolute(value) || value.includes('/') || value.includes('\\');
  if (isPath) {
    const candidate = path.isAbsolute(value) ? value : path.resolve(baseDirectory, value);
    return fs.existsSync(candidate) ? candidate : undefined;
  }

  const extensions = process.platform === 'win32'
    ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')]
    : [''];
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, value + extension.toLowerCase());
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}