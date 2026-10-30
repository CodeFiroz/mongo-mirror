import { ConnectionPoolManager } from './client-pool';
import { DatabaseNode, CollectionNode } from '@/types/explorer';

export class ExplorerService {
  /**
   * List accessible databases and their basic metrics
   */
  static async listDatabases(connectionId: string): Promise<{ databases: DatabaseNode[]; totalSize: number }> {
    const client = ConnectionPoolManager.getClient(connectionId);
    const adminDb = client.db('admin');

    let totalSize = 0;
    const result = await adminDb.admin().listDatabases();
    totalSize = result.totalSize || 0;

    const databases: DatabaseNode[] = [];

    for (const rawDb of result.databases) {
      // List collections for each database to provide immediate collection counts
      let collections: CollectionNode[] = [];
      try {
        const db = client.db(rawDb.name);
        const collList = await db.listCollections().toArray();
        collections = collList.map((c) => ({
          name: c.name,
          type: (c.type === 'view' ? 'view' : 'collection') as 'collection' | 'view',
        }));
      } catch {
        // May fail if restricted by user permissions
      }

      databases.push({
        name: rawDb.name,
        sizeOnDisk: rawDb.sizeOnDisk,
        empty: rawDb.empty,
        collections,
      });
    }

    return { databases, totalSize };
  }

  /**
   * List collections with detailed document counts and sizes for a specific database
   */
  static async listCollections(connectionId: string, dbName: string): Promise<CollectionNode[]> {
    const client = ConnectionPoolManager.getClient(connectionId);
    const db = client.db(dbName);
    const collList = await db.listCollections().toArray();

    const collections: CollectionNode[] = await Promise.all(
      collList.map(async (c) => {
        const coll = db.collection(c.name);
        let documentCount = 0;
        let sizeBytes = 0;

        try {
          // estimatedDocumentCount is fast on large collections
          documentCount = await coll.estimatedDocumentCount();
        } catch {
          try {
            documentCount = await coll.countDocuments();
          } catch {
            documentCount = 0;
          }
        }

        try {
          const stats = await db.command({ collStats: c.name });
          sizeBytes = stats.size || 0;
        } catch {
          // Ignore if collStats is unavailable or user lacks permission
        }

        return {
          name: c.name,
          type: (c.type === 'view' ? 'view' : 'collection') as 'collection' | 'view',
          documentCount,
          sizeBytes,
        };
      })
    );

    return collections.sort((a, b) => a.name.localeCompare(b.name));
  }
}
