import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { ToolDetector } from './tool-detector';

export interface RestoreOptions {
  connectionId: string;
  archiveFilePath: string;
  targetDatabase?: string;
  sourceDatabase?: string;
  drop?: boolean;
  gzip?: boolean;
  stopOnError?: boolean;
  noIndexRestore?: boolean;
}

export interface RestoreResult {
  success: boolean;
  documentsRestored: number;
  collectionsRestored: number;
  failures: number;
  targetDatabase?: string;
  durationMs: number;
  summary: string;
  outputLog: string;
}

export class RestoreService {
  /**
   * Restores an external mongodump archive (.archive or .archive.gz) into MongoDB using official mongorestore
   */
  static async restoreBackup(options: RestoreOptions): Promise<RestoreResult> {
    const {
      connectionId,
      archiveFilePath,
      targetDatabase,
      sourceDatabase,
      drop = false,
      gzip = true,
      stopOnError = false,
      noIndexRestore = false,
    } = options;

    const startTime = Date.now();

    const conn = ConnectionPoolManager.getConnection(connectionId);
    if (!conn) {
      throw new Error(`Connection "${connectionId}" not found or closed`);
    }

    if (!fs.existsSync(archiveFilePath)) {
      throw new Error(`Backup archive file not found at: ${archiveFilePath}`);
    }

    const tools = ToolDetector.detectTools();
    if (!tools.hasRestore || !tools.restorePath) {
      throw new Error(
        'MongoDB Database Tool "mongorestore" not found. Please install MongoDB Database Tools.'
      );
    }

    const args = [
      `--uri=${conn.rawUri}`,
      `--archive=${archiveFilePath}`,
    ];

    if (gzip) {
      args.push('--gzip');
    }

    if (drop) {
      args.push('--drop');
    }

    if (stopOnError) {
      args.push('--stopOnError');
    }

    if (noIndexRestore) {
      args.push('--noIndexRestore');
    }

    // Remap database namespace if requested, or ensure all namespaces in archive are included
    if (sourceDatabase && targetDatabase && sourceDatabase.trim() !== targetDatabase.trim()) {
      args.push(`--nsInclude=${sourceDatabase.trim()}.*`);
      args.push(`--nsFrom=${sourceDatabase.trim()}.*`);
      args.push(`--nsTo=${targetDatabase.trim()}.*`);
    } else {
      args.push('--nsInclude=*');
    }

    let stderrOutput = '';
    let stdoutOutput = '';

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(tools.restorePath!, args, {
        windowsHide: true,
      });

      proc.stdout.on('data', (data) => {
        stdoutOutput += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`mongorestore failed with exit code ${code}: ${stderrOutput.slice(-400)}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });

    const fullLog = stderrOutput || stdoutOutput;

    // Parse statistics from mongorestore output
    // e.g. "62 document(s) restored successfully. 0 document(s) failed to restore."
    let documentsRestored = 0;
    let failures = 0;

    const summaryMatch = fullLog.match(/(\d+)\s+document\(s\)\s+restored\s+successfully\.\s+(\d+)\s+document\(s\)\s+failed/i);
    if (summaryMatch) {
      documentsRestored = parseInt(summaryMatch[1], 10);
      failures = parseInt(summaryMatch[2], 10);
    }

    // Count restored collections from lines like "finished restoring <db>.<coll>"
    const collectionMatches = fullLog.match(/finished restoring/gi);
    const collectionsRestored = collectionMatches ? collectionMatches.length : (documentsRestored > 0 ? 1 : 0);

    const durationMs = Date.now() - startTime;
    const summary = `${documentsRestored} document(s) restored across ${collectionsRestored} collection(s) (${failures} failures) in ${durationMs}ms`;

    return {
      success: true,
      documentsRestored,
      collectionsRestored,
      failures,
      targetDatabase,
      durationMs,
      summary,
      outputLog: fullLog,
    };
  }

  /**
   * Lists available backup archives in the local data/backups directory
   */
  static listAvailableBackups(): { name: string; sizeBytes: number; createdAt: Date; path: string }[] {
    const backupsDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupsDir)) return [];

    const files = fs.readdirSync(backupsDir);
    return files
      .filter((f) => f.endsWith('.archive') || f.endsWith('.archive.gz') || f.endsWith('.json') || f.endsWith('.gz'))
      .map((f) => {
        const fullPath = path.join(backupsDir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          sizeBytes: stat.size,
          createdAt: stat.birthtime,
          path: fullPath,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
