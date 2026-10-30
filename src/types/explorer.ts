export interface CollectionNode {
  name: string;
  type: 'collection' | 'view';
  documentCount?: number;
  sizeBytes?: number;
  avgDocSize?: number;
  indexesCount?: number;
  isLoading?: boolean;
}

export interface DatabaseNode {
  name: string;
  sizeOnDisk?: number;
  empty?: boolean;
  collections?: CollectionNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  error?: string;
}

export interface ExplorerSelection {
  slot: 'source' | 'target';
  databaseName?: string;
  collectionName?: string;
}
