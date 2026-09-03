import * as fs from 'fs';

type PathExists = (filePath: string) => boolean;

export function isExplicitDeckPath(
  filePath: string,
  pathExists: PathExists = fs.existsSync,
): boolean {
  if (filePath.endsWith('.deck.md') || filePath.endsWith('.deck.yaml')) {
    return true;
  }
  if (!filePath.endsWith('.md')) {
    return false;
  }
  return pathExists(filePath.replace(/\.md$/, '.deck.yaml'));
}