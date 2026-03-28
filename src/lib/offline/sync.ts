/**
 * 离线同步服务
 * 处理离线操作的同步和数据一致性
 */

import {
  initOfflineDB,
  addPendingOperation,
  getPendingOperations,
  markOperationSynced,
  updateOperationError,
  clearSyncedOperations,
  cacheProjects,
  cacheDocuments,
  cacheTasks,
  getCachedProjects,
  getCachedDocuments,
  getCachedTasks,
  isCacheExpired,
  getStorageEstimate,
  requestPersistentStorage,
  clearAllCache as storageClearAllCache,
  type OfflineOperation,
} from './storage';

// 同步状态
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

// 同步回调
type SyncCallback = (status: SyncStatus, progress?: number) => void;

// 最大重试次数
const MAX_RETRY_COUNT = 3;

// 同步状态管理
let syncStatus: SyncStatus = 'idle';
let syncCallbacks: SyncCallback[] = [];
let syncInterval: NodeJS.Timeout | null = null;

// ============================================
// 网络状态检测
// ============================================

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================
// 同步状态管理
// ============================================

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function onSyncStatusChange(callback: SyncCallback): () => void {
  syncCallbacks.push(callback);
  return () => {
    syncCallbacks = syncCallbacks.filter(cb => cb !== callback);
  };
}

function updateSyncStatus(status: SyncStatus, progress?: number) {
  syncStatus = status;
  syncCallbacks.forEach(cb => cb(status, progress));
}

// ============================================
// 数据同步
// ============================================

// 同步单个操作
async function syncOperation(operation: OfflineOperation): Promise<boolean> {
  try {
    let response: Response;
    const { type, data } = operation;

    switch (type) {
      case 'create_project':
        response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'update_project':
        response = await fetch(`/api/projects/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'create_document':
        response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'update_document':
        response = await fetch(`/api/documents/${data.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        break;

      case 'approve_task':
        response = await fetch('/api/workflow/tasks/handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: data.taskId, action: 'approve', comment: data.comment }),
        });
        break;

      case 'reject_task':
        response = await fetch('/api/workflow/tasks/handle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: data.taskId, action: 'reject', comment: data.comment }),
        });
        break;

      default:
        throw new Error(`未知的操作类型: ${type}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `同步失败: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error(`同步操作失败 [${operation.id}]:`, error);
    await updateOperationError(
      operation.id,
      error instanceof Error ? error.message : '同步失败'
    );
    return false;
  }
}

// 同步所有待处理操作
export async function syncPendingOperations(): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  if (!isOnline()) {
    updateSyncStatus('offline');
    return { total: 0, success: 0, failed: 0 };
  }

  updateSyncStatus('syncing');

  const operations = await getPendingOperations();
  const result = { total: operations.length, success: 0, failed: 0 };

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];

    // 跳过重试次数过多的操作
    if (operation.retryCount >= MAX_RETRY_COUNT) {
      result.failed++;
      continue;
    }

    const success = await syncOperation(operation);
    if (success) {
      await markOperationSynced(operation.id);
      result.success++;
    } else {
      result.failed++;
    }

    // 更新进度
    updateSyncStatus('syncing', (i + 1) / operations.length);
  }

  // 清理已同步的操作
  await clearSyncedOperations();

  updateSyncStatus(result.failed > 0 ? 'error' : 'idle');
  return result;
}

// 刷新缓存数据
export async function refreshCache(): Promise<void> {
  if (!isOnline()) {
    throw new Error('离线状态下无法刷新缓存');
  }

  try {
    // 获取并缓存项目数据
    const projectsRes = await fetch('/api/projects?pageSize=100');
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      await cacheProjects(projectsData.items || []);
    }

    // 获取并缓存文档数据
    const documentsRes = await fetch('/api/documents?pageSize=100');
    if (documentsRes.ok) {
      const documentsData = await documentsRes.json();
      await cacheDocuments(documentsData.items || []);
    }

    // 获取并缓存任务数据
    const tasksRes = await fetch('/api/workflow/tasks?status=pending');
    if (tasksRes.ok) {
      const tasksData = await tasksRes.json();
      await cacheTasks(tasksData.tasks || []);
    }
  } catch (error) {
    console.error('刷新缓存失败:', error);
    throw error;
  }
}

// ============================================
// 离线操作记录
// ============================================

export async function recordOfflineOperation(
  type: OfflineOperation['type'],
  data: any
): Promise<OfflineOperation> {
  const operation = await addPendingOperation(type, data);

  // 如果在线，立即尝试同步
  if (isOnline()) {
    syncPendingOperations();
  }

  return operation;
}

// ============================================
// 初始化和自动同步
// ============================================

export async function initOfflineSync(): Promise<void> {
  // 初始化数据库
  await initOfflineDB();

  // 请求持久化存储
  await requestPersistentStorage();

  // 监听网络状态
  onNetworkChange((online) => {
    if (online) {
      // 网络恢复时自动同步
      syncPendingOperations();
      refreshCache();
    }
  });

  // 检查是否需要刷新缓存
  const needsRefresh = await Promise.all([
    isCacheExpired('projects'),
    isCacheExpired('documents'),
    isCacheExpired('tasks'),
  ]);

  if (isOnline() && needsRefresh.some(Boolean)) {
    refreshCache();
  }

  // 启动定期同步（每5分钟）
  syncInterval = setInterval(() => {
    if (isOnline()) {
      syncPendingOperations();
    }
  }, 5 * 60 * 1000);
}

export function stopOfflineSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// ============================================
// 离线数据访问
// ============================================

export async function getOfflineProjects(): Promise<any[]> {
  return getCachedProjects();
}

export async function getOfflineDocuments(): Promise<any[]> {
  return getCachedDocuments();
}

export async function getOfflineTasks(): Promise<any[]> {
  return getCachedTasks();
}

// ============================================
// 存储信息
// ============================================

export async function getOfflineStorageInfo(): Promise<{
  usage: number;
  quota: number;
  available: number;
  pendingOperations: number;
}> {
  const [storage, operations] = await Promise.all([
    getStorageEstimate(),
    getPendingOperations(),
  ]);

  return {
    ...storage,
    pendingOperations: operations.length,
  };
}

// 清除所有缓存
export async function clearAllCache(): Promise<void> {
  await storageClearAllCache();
}
