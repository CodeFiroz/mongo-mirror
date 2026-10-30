import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { EJSON } from 'bson';

export type ConflictPolicy = 'skip' | 'upsert' | 'fail';

export interface ImportOptions {
  connectionId: string;
  database: string;
  collection: string;
  fileContent: string;
  filename: string;
  conflictPolicy: ConflictPolicy;
  dropFirst?: boolean;
}

export interface ImportStats {
  totalRecords: number;
  insertedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  skippedCount: number;
  durationMs: number;
}

export class ImportService {
  /**
   * Import data from JSON, Extended JSON, or CSV into a MongoDB collection
   */
  static async importData(options: ImportOptions): Promise<ImportStats> {
    const { connectionId, database, collection, fileContent, filename, conflictPolicy, dropFirst } = options;
    const startTime = Date.now();

    const client = ConnectionPoolManager.getClient(connectionId);
    const db = client.db(database);
    const coll = db.collection(collection);

    if (dropFirst) {
      try {
        await coll.drop();
      } catch {
        // Collection might not exist yet
      }
    }

    const isCsv = filename.toLowerCase().endsWith('.csv');
    const docs = isCsv ? this.parseCsv(fileContent) : this.parseJson(fileContent);

    if (!docs || docs.length === 0) {
      throw new Error('No valid documents found in the uploaded file');
    }

    const totalRecords = docs.length;
    let insertedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;
    let skippedCount = 0;

    // Process in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);

      if (conflictPolicy === 'upsert') {
        const operations = batch.map((doc) => {
          if (doc._id) {
            return {
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true,
              },
            };
          }
          return {
            insertOne: {
              document: doc,
            },
          };
        });

        const res = await coll.bulkWrite(operations, { ordered: false });
        insertedCount += res.insertedCount || 0;
        modifiedCount += res.modifiedCount || 0;
        upsertedCount += res.upsertedCount || 0;
      } else if (conflictPolicy === 'skip') {
        try {
          const res = await coll.insertMany(batch, { ordered: false });
          insertedCount += res.insertedCount || 0;
        } catch (err: any) {
          if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
            insertedCount += err.result?.insertedCount || 0;
            const writeErrors = err.writeErrors || err.result?.writeErrors || [];
            skippedCount += writeErrors.length;
          } else {
            throw err;
          }
        }
      } else {
        // 'fail' mode
        const res = await coll.insertMany(batch, { ordered: true });
        insertedCount += res.insertedCount || 0;
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      totalRecords,
      insertedCount,
      modifiedCount,
      upsertedCount,
      skippedCount,
      durationMs,
    };
  }

  private static parseJson(content: string): any[] {
    const trimmed = content.trim();

    // 1. Try standard or Extended JSON parse as a whole
    try {
      const parsed = EJSON.parse(trimmed, { relaxed: true });
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed !== null) return [parsed];
    } catch {
      // Continue to line-by-line fallback
    }

    // 2. Try JSON lines (NDJSON)
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const docs: any[] = [];

    for (const line of lines) {
      try {
        const doc = EJSON.parse(line.trim(), { relaxed: true });
        if (typeof doc === 'object' && doc !== null) docs.push(doc);
      } catch {
        // Skip unparseable lines
      }
    }

    return docs;
  }

  private static parseCsv(content: string): any[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]);
    const docs: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      if (values.length === 0) continue;

      const doc: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        const val = values[j] ?? '';

        // Try parsing JSON if value looks like object or array
        if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
          try {
            doc[key] = JSON.parse(val);
            continue;
          } catch {
            // Use as string
          }
        }

        // Try boolean
        if (val.toLowerCase() === 'true') {
          doc[key] = true;
        } else if (val.toLowerCase() === 'false') {
          doc[key] = false;
        } else if (val !== '' && !isNaN(Number(val)) && !val.startsWith('0x')) {
          doc[key] = Number(val);
        } else {
          doc[key] = val;
        }
      }

      docs.push(doc);
    }

    return docs;
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}
