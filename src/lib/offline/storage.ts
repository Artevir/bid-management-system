/**
 * 离线存储服务
 * 使用 IndexedDB 进行数据持久化存储
 */

// 数据库名称和版本
const DB_NAME = 'bid-management-offline';
const DB_VERSION = 1;

// 存储对象名称
const STORES = {
  PROJECTS: 'projects',
  DOCUMENTS: 'documents',
  TASKS: 'tasks',
  PENDING_OPERATIONS: 'pending_operations',
  CACHE_METADATA: 'cache_metadata',
};

// 离线操作类型
export type OfflineOperationType = 
  | 'create_project'
  | 'update_project'
  | 'create_document'
  | 'update_document'
  | 'approve_task'
  | 'reject_task';

// 离线操作接口
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  data: any;
  timestamp: number;
  synced: boolean;
  retryCount: number;
  error?: string;
}

// 缓存元数据
export interface CacheMetadata {
  key: string;
  lastUpdated: number;
  expiresAt: number;
  version: string;
}

// IndexedDB 实例
let db: IDBDatabase | null = null;

// 初始化数据库
export async function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('无法打开离线数据库'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // 创建存储对象
      if (!database.objectStoreNames.contains(STORES.PROJECTS)) {
        database.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.DOCUMENTS)) {
        database.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.TASKS)) {
        database.createObjectStore(STORES.TASKS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
        const pendingStore = database.createObjectStore(STORES.PENDING_OPERATIONS, { keyPath: 'id' });
        pendingStore.createIndex('synced', 'synced', { unique: false });
        pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.CACHE_METADATA)) {
        database.createObjectStore(STORES.CACHE_METADATA, { keyPath: 'key' });
      }
    };
  });
}

// 通用存储操作
async function storeData<T>(storeName: string, data: T): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`存储数据失败: ${storeName}`));
  });
}

// 通用获取操作
async function getData<T>(storeName: string, key: number | string): Promise<T | null> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`获取数据失败: ${storeName}`));
  });
}

// 通用获取所有数据
async function getAllData<T>(storeName: string): Promise<T[]> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`获取所有数据失败: ${storeName}`));
  });
}

// 通用删除操作
async function _deleteData(storeName: string, key: number | string): Promise<void> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`删除数据失败: ${storeName}`));
  });
}

// ============================================
// 项目缓存操作
// ============================================

export async function cacheProjects(projects: any[]): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(STORES.PROJECTS, 'readwrite');
  const store = transaction.objectStore(STORES.PROJECTS);

  // 清除旧数据
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(new Error('清除项目缓存失败'));
  });

  // 添加新数据
  for (const project of projects) {
    store.put(project);
  }

  // 更新缓存元数据
  await updateCacheMetadata('projects', Date.now(), Date.now() + 24 * 60 * 60 * 1000);
}

export async function getCachedProjects(): Promise<any[]> {
  return getAllData(STORES.PROJECTS);
}

// ============================================
// 文档缓存操作
// ============================================

export async function cacheDocuments(documents: any[]): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(STORES.DOCUMENTS, 'readwrite');
  const store = transaction.objectStore(STORES.DOCUMENTS);

  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(new Error('清除文档缓存失败'));
  });

  for (const doc of documents) {
    store.put(doc);
  }

  await updateCacheMetadata('documents', Date.now(), Date.now() + 24 * 60 * 60 * 1000);
}

export async function getCachedDocuments(): Promise<any[]> {
  return getAllData(STORES.DOCUMENTS);
}

// ============================================
// 任务缓存操作
// ============================================

export async function cacheTasks(tasks: any[]): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(STORES.TASKS, 'readwrite');
  const store = transaction.objectStore(STORES.TASKS);

  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(new Error('清除任务缓存失败'));
  });

  for (const task of tasks) {
    store.put(task);
  }

  await updateCacheMetadata('tasks', Date.now(), Date.now() + 1 * 60 * 60 * 1000); // 1小时过期
}

export async function getCachedTasks(): Promise<any[]> {
  return getAllData(STORES.TASKS);
}

// ============================================
// 离线操作队列
// ============================================

export async function addPendingOperation(
  type: OfflineOperationType,
  data: any
): Promise<OfflineOperation> {
  const operation: OfflineOperation = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    data,
    timestamp: Date.now(),
    synced: false,
    retryCount: 0,
  };

  await storeData(STORES.PENDING_OPERATIONS, operation);
  return operation;
}

export async function getPendingOperations(): Promise<OfflineOperation[]> {
  const database = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.PENDING_OPERATIONS, 'readonly');
    const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error('获取待同步操作失败'));
  });
}

export async function markOperationSynced(id: string): Promise<void> {
  const operation = await getData<OfflineOperation>(STORES.PENDING_OPERATIONS, id);
  if (operation) {
    operation.synced = true;
    await storeData(STORES.PENDING_OPERATIONS, operation);
  }
}

export async function updateOperationError(id: string, error: string): Promise<void> {
  const operation = await getData<OfflineOperation>(STORES.PENDING_OPERATIONS, id);
  if (operation) {
    operation.error = error;
    operation.retryCount++;
    await storeData(STORES.PENDING_OPERATIONS, operation);
  }
}

export async function clearSyncedOperations(): Promise<void> {
  const database = await initOfflineDB();
  const transaction = database.transaction(STORES.PENDING_OPERATIONS, 'readwrite');
  const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
  const index = store.index('synced');
  const request = index.openCursor(IDBKeyRange.only(true));

  request.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

// ============================================
// 缓存元数据管理
// ============================================

async function updateCacheMetadata(
  key: string,
  lastUpdated: number,
  expiresAt: number
): Promise<void> {
  const metadata: CacheMetadata = {
    key,
    lastUpdated,
    expiresAt,
    version: '1.0',
  };
  await storeData(STORES.CACHE_METADATA, metadata);
}

export async function getCacheMetadata(key: string): Promise<CacheMetadata | null> {
  return getData<CacheMetadata>(STORES.CACHE_METADATA, key);
}

export async function isCacheExpired(key: string): Promise<boolean> {
  const metadata = await getCacheMetadata(key);
  if (!metadata) return true;
  return Date.now() > metadata.expiresAt;
}

// ============================================
// 清除所有缓存
// ============================================

export async function clearAllCache(): Promise<void> {
  const database = await initOfflineDB();
  const storeNames = Object.values(STORES);

  for (const storeName of storeNames) {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`清除 ${storeName} 失败`));
    });
  }
}

// ============================================
// 存储空间管理
// ============================================

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  available: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0),
    };
  }
  return { usage: 0, quota: 0, available: 0 };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return navigator.storage.persist();
  }
  return false;
}
