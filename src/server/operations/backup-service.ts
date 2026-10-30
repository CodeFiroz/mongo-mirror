import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { ToolDetector } from './tool-detector';
import crypto from 'crypto';

export interface BackupOptions {
  connectionId: string;
  database: string;
  collection?: string;
  gzip?: boolean;
}

export interface BackupResult {
  backupId: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  durationMs: number;
  type: 'native-archive' | 'json-dump';
}

// Preserve in-memory registry of created backup files across Next.js dev server hot reloads
const globalForBackup = globalThis as unknown as {
  mongoBackupRegistry?: Map<string, { filePath: string; filename: string; contentType: string }>;
};

const backupRegistry =
  globalForBackup.mongoBackupRegistry || new Map<string, { filePath: string; filename: string; contentType: string }>();

if (process.env.NODE_ENV !== 'production') {
  globalForBackup.mongoBackupRegistry = backupRegistry;
}

export class BackupService {
  private static backupsDir = path.join(process.cwd(), 'data', 'backups');

  static getBackupsDir() {
    return this.backupsDir;
  }

  static getBackup(backupId: string) {
    return backupRegistry.get(backupId);
  }

  static async createBackup(options: BackupOptions): Promise<BackupResult> {
    const { connectionId, database, collection, gzip = true } = options;
    const startTime = Date.now();

    const conn = ConnectionPoolManager.getConnection(connectionId);
    if (!conn) {
      throw new Error(`Connection "${connectionId}" not found or closed`);
    }

    // 0. Validate that the target database and collection actually exist in MongoDB
    const client = conn.client;
    const adminDb = client.db('admin');
    const dbsResult = await adminDb.admin().listDatabases();
    const dbNames = (dbsResult.databases || []).map((d: any) => d.name);

    if (!dbNames.includes(database)) {
      const matching = dbNames.filter((d: string) => d.toLowerCase().includes(database.toLowerCase()));
      const suggestion =
        matching.length > 0
          ? ` Did you mean "${matching.join('", "')}"?`
          : ` Available databases: ${dbNames.join(', ')}`;
      throw new Error(`Database "${database}" does not exist on this MongoDB instance.${suggestion}`);
    }

    if (collection) {
      const db = client.db(database);
      const collList = await db.listCollections().toArray();
      const collNames = collList.map((c) => c.name);

      if (!collNames.includes(collection)) {
        const matching = collNames.filter((c: string) => c.toLowerCase().includes(collection.toLowerCase()));
        const suggestion =
          matching.length > 0
            ? ` Did you mean "${matching.join('", "')}"?`
            : collNames.length > 0
            ? ` Available collections: ${collNames.slice(0, 10).join(', ')}`
            : ' (this database has no collections)';
        throw new Error(`Collection "${collection}" does not exist in database "${database}".${suggestion}`);
      }
    }

    // Ensure backups directory exists
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const tools = ToolDetector.detectTools();

    // 1. If native mongodump is available, use official mongodump --archive --gzip
    if (tools.hasDump && tools.dumpPath) {
      const ext = gzip ? 'archive.gz' : 'archive';
      const filename = collection
        ? `${database}_${collection}_${timestamp}.${ext}`
        : `${database}_all_collections_${timestamp}.${ext}`;
      const filePath = path.join(this.backupsDir, filename);

      const args = [
        `--uri=${conn.rawUri}`,
        `--db=${database}`,
        `--archive=${filePath}`,
      ];

      if (collection) {
        args.push(`--collection=${collection}`);
      }

      if (gzip) {
        args.push('--gzip');
      }

      let stderrOutput = '';
      let stdoutOutput = '';

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(tools.dumpPath!, args, {
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
            // mongodump can exit with 0 even if the namespace does not exist
            if (stderrOutput.includes('does not exist')) {
              reject(new Error(stderrOutput.trim()));
            } else {
              resolve();
            }
          } else {
            reject(new Error(`mongodump failed with exit code ${code}: ${stderrOutput.slice(-300)}`));
          }
        });

        proc.on('error', (err) => {
          reject(err);
        });
      });

      if (!fs.existsSync(filePath)) {
        throw new Error(
          `Backup archive was not created on disk. ${
            stderrOutput.trim() ? `mongodump output: ${stderrOutput.trim()}` : ''
          }`
        );
      }

      const stats = fs.statSync(filePath);
      const backupId = crypto.randomUUID();

      backupRegistry.set(backupId, {
        filePath,
        filename,
        contentType: 'application/gzip',
      });

      return {
        backupId,
        filename,
        filePath,
        sizeBytes: stats.size,
        durationMs: Date.now() - startTime,
        type: 'native-archive',
      };
    }

    // 2. Driver-based fallback logical backup
    const db = client.db(database);

    const collNames = collection
      ? [collection]
      : (await db.listCollections().toArray()).map((c) => c.name);

    const databaseDump: Record<string, any[]> = {};
    for (const name of collNames) {
      databaseDump[name] = await db.collection(name).find({}).toArray();
    }

    const filename = `${database}_backup_${timestamp}.json`;
    const filePath = path.join(this.backupsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(databaseDump, null, 2), 'utf-8');

    if (!fs.existsSync(filePath)) {
      throw new Error(`Failed to generate fallback backup file at ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const backupId = crypto.randomUUID();

    backupRegistry.set(backupId, {
      filePath,
      filename,
      contentType: 'application/json',
    });

    return {
      backupId,
      filename,
      filePath,
      sizeBytes: stats.size,
      durationMs: Date.now() - startTime,
      type: 'json-dump',
    };
  }
}
