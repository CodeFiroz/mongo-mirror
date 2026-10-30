import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface DatabaseToolsInfo {
  hasDump: boolean;
  hasRestore: boolean;
  dumpPath?: string;
  restorePath?: string;
  version?: string;
}

const COMMON_WINDOWS_PATHS = [
  'C:\\Program Files\\MongoDB\\Tools\\100\\bin',
  'C:\\Program Files\\MongoDB\\Server\\8.0\\bin',
  'C:\\Program Files\\MongoDB\\Server\\7.0\\bin',
  'C:\\Program Files\\MongoDB\\Server\\6.0\\bin',
];

export class ToolDetector {
  private static cachedInfo: DatabaseToolsInfo | null = null;

  static detectTools(): DatabaseToolsInfo {
    if (this.cachedInfo) return this.cachedInfo;

    let dumpPath: string | undefined;
    let restorePath: string | undefined;

    // 1. Check common installation directories on Windows
    for (const dir of COMMON_WINDOWS_PATHS) {
      const candidateDump = path.join(dir, 'mongodump.exe');
      const candidateRestore = path.join(dir, 'mongorestore.exe');

      if (!dumpPath && fs.existsSync(candidateDump)) {
        dumpPath = candidateDump;
      }
      if (!restorePath && fs.existsSync(candidateRestore)) {
        restorePath = candidateRestore;
      }
    }

    // 2. Fallback to system PATH lookup
    if (!dumpPath) {
      try {
        const out = execSync('where mongodump', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const firstLine = out.split(/\r?\n/)[0]?.trim();
        if (firstLine && fs.existsSync(firstLine)) dumpPath = firstLine;
      } catch {
        // Not found in PATH
      }
    }

    if (!restorePath) {
      try {
        const out = execSync('where mongorestore', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const firstLine = out.split(/\r?\n/)[0]?.trim();
        if (firstLine && fs.existsSync(firstLine)) restorePath = firstLine;
      } catch {
        // Not found in PATH
      }
    }

    let version = 'unknown';
    if (dumpPath) {
      try {
        const out = execSync(`"${dumpPath}" --version`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const match = out.match(/version:\s*([^\s]+)/i);
        if (match) version = match[1];
      } catch {
        // Ignore version check error
      }
    }

    this.cachedInfo = {
      hasDump: !!dumpPath,
      hasRestore: !!restorePath,
      dumpPath,
      restorePath,
      version,
    };

    return this.cachedInfo;
  }
}
