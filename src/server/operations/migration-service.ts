import { ConnectionPoolManager } from '@/server/mongodb/client-pool';
import { ConflictPolicy } from './import-service';

export interface MigrationOptions {
  sourceConnectionId: string;
  sourceDatabase: string;
  sourceCollection: string;
  targetConnectionId: string;
  targetDatabase: string;
  targetCollection: string;
  conflictPolicy: ConflictPolicy;
  dropFirst?: boolean;
}

export interface MigrationStats {
  sourceNamespace: string;
  targetNamespace: string;
  totalDocuments: number;
  insertedCount: number;
  skippedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  durationMs: number;
}

export interface DatabaseMigrationOptions {
  sourceConnectionId: string;
  sourceDatabase: string;
  targetConnectionId: string;
  targetDatabase: string;
  collections?: string[];
  conflictPolicy: ConflictPolicy;
  dropFirst?: boolean;
}

export interface DatabaseMigrationStats {
  sourceDatabase: string;
  targetDatabase: string;
  totalCollections: number;
  totalDocuments: number;
  insertedCount: number;
  skippedCount: number;
  modifiedCount: number;
  upsertedCount: number;
  collectionResults: MigrationStats[];
  durationMs: number;
}

export class MigrationService {
  /**
   * Migrate collections directly from source MongoDB instance to target MongoDB instance
   */
  static async migrateCollection(options: MigrationOptions): Promise<MigrationStats> {
    const {
      sourceConnectionId,
      sourceDatabase,
      sourceCollection,
      targetConnectionId,
      targetDatabase,
      targetCollection,
      conflictPolicy,
      dropFirst,
    } = options;

    const startTime = Date.now();

    const sourceClient = ConnectionPoolManager.getClient(sourceConnectionId);
    const targetClient = ConnectionPoolManager.getClient(targetConnectionId);

    const sourceColl = sourceClient.db(sourceDatabase).collection(sourceCollection);
    const targetColl = targetClient.db(targetDatabase).collection(targetCollection);

    // If dropFirst enabled, drop target collection first
    if (dropFirst) {
      try {
        await targetColl.drop();
      } catch {
        // Target collection may not exist yet
      }
    }

    let totalDocuments = 0;
    try {
      totalDocuments = await sourceColl.estimatedDocumentCount();
    } catch {
      totalDocuments = await sourceColl.countDocuments().catch(() => 0);
    }

    let insertedCount = 0;
    let skippedCount = 0;
    let modifiedCount = 0;
    let upsertedCount = 0;

    const cursor = sourceColl.find({}).batchSize(1000);
    const batchSize = 1000;
    let currentBatch: any[] = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      currentBatch.push(doc);

      if (currentBatch.length >= batchSize) {
        const stats = await this.processBatch(targetColl, currentBatch, conflictPolicy);
        insertedCount += stats.inserted;
        skippedCount += stats.skipped;
        modifiedCount += stats.modified;
        upsertedCount += stats.upserted;
        currentBatch = [];
      }
    }

    // Process remaining batch
    if (currentBatch.length > 0) {
      const stats = await this.processBatch(targetColl, currentBatch, conflictPolicy);
      insertedCount += stats.inserted;
      skippedCount += stats.skipped;
      modifiedCount += stats.modified;
      upsertedCount += stats.upserted;
    }

    const durationMs = Date.now() - startTime;

    return {
      sourceNamespace: `${sourceDatabase}.${sourceCollection}`,
      targetNamespace: `${targetDatabase}.${targetCollection}`,
      totalDocuments,
      insertedCount,
      skippedCount,
      modifiedCount,
      upsertedCount,
      durationMs,
    };
  }

  /**
   * Migrate an entire database (or selected collections) to target database
   */
  static async migrateDatabase(options: DatabaseMigrationOptions): Promise<DatabaseMigrationStats> {
    const {
      sourceConnectionId,
      sourceDatabase,
      targetConnectionId,
      targetDatabase,
      collections: requestedCollections,
      conflictPolicy,
      dropFirst,
    } = options;

    const startTime = Date.now();
    const sourceClient = ConnectionPoolManager.getClient(sourceConnectionId);
    const sourceDb = sourceClient.db(sourceDatabase);

    let collNamesToMigrate: string[] = [];
    if (requestedCollections && requestedCollections.length > 0) {
      collNamesToMigrate = requestedCollections;
    } else {
      const allColls = await sourceDb.listCollections().toArray();
      collNamesToMigrate = allColls
        .filter((c) => !c.name.startsWith('system.'))
        .map((c) => c.name);
    }

    const results: MigrationStats[] = [];
    let totalDocs = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalModified = 0;
    let totalUpserted = 0;

    for (const collName of collNamesToMigrate) {
      const collStats = await this.migrateCollection({
        sourceConnectionId,
        sourceDatabase,
        sourceCollection: collName,
        targetConnectionId,
        targetDatabase,
        targetCollection: collName,
        conflictPolicy,
        dropFirst,
      });

      results.push(collStats);
      totalDocs += collStats.totalDocuments;
      totalInserted += collStats.insertedCount;
      totalSkipped += collStats.skippedCount;
      totalModified += collStats.modifiedCount;
      totalUpserted += collStats.upsertedCount;
    }

    return {
      sourceDatabase,
      targetDatabase,
      totalCollections: results.length,
      totalDocuments: totalDocs,
      insertedCount: totalInserted,
      skippedCount: totalSkipped,
      modifiedCount: totalModified,
      upsertedCount: totalUpserted,
      collectionResults: results,
      durationMs: Date.now() - startTime,
    };
  }

  private static async processBatch(
    targetColl: any,
    batch: any[],
    policy: ConflictPolicy
  ): Promise<{ inserted: number; skipped: number; modified: number; upserted: number }> {
    let inserted = 0;
    let skipped = 0;
    let modified = 0;
    let upserted = 0;

    if (policy === 'upsert') {
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

      const res = await targetColl.bulkWrite(operations, { ordered: false });
      inserted += res.insertedCount || 0;
      modified += res.modifiedCount || 0;
      upserted += res.upsertedCount || 0;
    } else if (policy === 'skip') {
      try {
        const res = await targetColl.insertMany(batch, { ordered: false });
        inserted += res.insertedCount || 0;
      } catch (err: any) {
        if (err.name === 'MongoBulkWriteError' || err.code === 11000) {
          inserted += err.result?.insertedCount || 0;
          const writeErrors = err.writeErrors || err.result?.writeErrors || [];
          skipped += writeErrors.length;
        } else {
          throw err;
        }
      }
    } else {
      // 'fail' mode
      const res = await targetColl.insertMany(batch, { ordered: true });
      inserted += res.insertedCount || 0;
    }

    return { inserted, skipped, modified, upserted };
  }
}
