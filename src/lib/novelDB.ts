/**
 * Novel Creator - IndexedDB 封装层
 * 基于 idb 库，为小说创作工坊提供持久化存储
 * 
 * 数据库设计：
 * - projects store: 存储 NovelProject（不含 snapshots）
 * - snapshots store: 存储版本快照，最多保留5个/项目
 * 
 * IndexedDB 不可用时（隐私模式）自动降级到 localStorage
 */

import type { NovelProject, StoryBibleSnapshot } from '@/types/novel';
import { syncProjectToCloud, deleteProjectFromCloud } from '@/lib/novelSync';

// ── 云端同步防抖（全局共享，跨多次 saveProject 调用）──────────────────────────
// 解决问题：AI 生成内容时每 800ms 触发一次 saveProject，每次都 upsert 到 Supabase
// 实际上没必要这么频繁，只需要在最后一次写入后 3s 再同步一次即可

const CLOUD_SYNC_DEBOUNCE = 3_000; // 3 秒

/** 每个项目独立的同步定时器 */
const _cloudSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** 最新待同步的项目数据（同一 ID 只保留最后一次） */
const _cloudSyncPending = new Map<string, NovelProject>();

function scheduleCloudSync(project: NovelProject) {
  const id = project.id;
  // 更新待同步数据（只保留最新）
  _cloudSyncPending.set(id, project);

  // 清除已有定时器
  const existing = _cloudSyncTimers.get(id);
  if (existing) clearTimeout(existing);

  // 设置新定时器
  const timer = setTimeout(() => {
    const toSync = _cloudSyncPending.get(id);
    if (toSync) {
      _cloudSyncPending.delete(id);
      _cloudSyncTimers.delete(id);
      syncProjectToCloud(toSync).catch(() => {});
    }
  }, CLOUD_SYNC_DEBOUNCE);

  _cloudSyncTimers.set(id, timer);
}

const DB_NAME = 'novel-creator';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_SNAPSHOTS = 'snapshots';
const MAX_SNAPSHOTS = 5;

// ── IndexedDB 可用性检测 ──────────────────────────────────────────────────────

function isIndexedDBAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}

// ── 动态 import idb（仅在浏览器环境下使用）───────────────────────────────────

type IDBPDatabase = import('idb').IDBPDatabase;
// readwrite 用于写操作（createSnapshot 中的 delete/add）
type IDBPObjectStore = import('idb').IDBPObjectStore<unknown, string[], string, 'readwrite'>;
// readonly 用于只读操作（listSnapshots）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIDBPObjectStore = any;

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise;

  const { openDB } = await import('idb');
  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // projects store
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      // snapshots store，复合键 [projectId, timestamp]
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        const snapshotStore = db.createObjectStore(STORE_SNAPSHOTS, {
          autoIncrement: true,
        });
        snapshotStore.createIndex('byProject', 'projectId', { unique: false });
      }
    },
  });

  return dbPromise;
}

// ── localStorage 降级实现 ─────────────────────────────────────────────────────

const LS_PREFIX = 'novel_creator_';

function lsKey(id: string) {
  return `${LS_PREFIX}${id}`;
}

function lsSaveProject(project: NovelProject): void {
  try {
    localStorage.setItem(lsKey(project.id), JSON.stringify(project));
  } catch (e) {
    console.error('[NovelDB] localStorage 写入失败:', e);
  }
}

function lsGetProject(id: string): NovelProject | null {
  try {
    const raw = localStorage.getItem(lsKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsListProjects(): NovelProject[] {
  const result: NovelProject[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LS_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            result.push(JSON.parse(raw));
          } catch {
            // 忽略损坏的条目
          }
        }
      }
    }
  } catch {
    // 忽略
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

function lsDeleteProject(id: string): void {
  try {
    localStorage.removeItem(lsKey(id));
    // 清理快照
    const snapshotKey = `${LS_PREFIX}snapshots_${id}`;
    localStorage.removeItem(snapshotKey);
  } catch {
    // 忽略
  }
}

function lsSaveSnapshots(projectId: string, snapshots: StoryBibleSnapshot[]): void {
  try {
    const key = `${LS_PREFIX}snapshots_${projectId}`;
    localStorage.setItem(key, JSON.stringify(snapshots));
  } catch {
    // 忽略
  }
}

function lsGetSnapshots(projectId: string): StoryBibleSnapshot[] {
  try {
    const key = `${LS_PREFIX}snapshots_${projectId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── 内部辅助类型（IndexedDB 快照条目）────────────────────────────────────────

interface SnapshotRecord {
  id?: number;
  projectId: string;
  timestamp: number;
  label: string;
  data: StoryBibleSnapshot['data'];
}

// ── 公开 API ─────────────────────────────────────────────────────────────────

/**
 * 保存或更新一个 NovelProject
 * 自动更新 updatedAt，并异步触发防抖保存（调用者不需要等待）
 */
export async function saveProject(project: NovelProject): Promise<void> {
  const toSave = { ...project, updatedAt: Date.now() };

  // 本地写入
  if (!isIndexedDBAvailable()) {
    lsSaveProject(toSave);
  } else {
    try {
      const db = await getDB();
      await db.put(STORE_PROJECTS, toSave);
    } catch (e) {
      console.error('[NovelDB] IndexedDB 写入失败，降级到 localStorage:', e);
      lsSaveProject(toSave);
    }
  }

  // 云端同步：3s 防抖，避免 AI 生成时每次写入都触发 upsert
  scheduleCloudSync(toSave);
}

/**
 * 读取单个项目
 */
export async function getProject(id: string): Promise<NovelProject | null> {
  if (!isIndexedDBAvailable()) {
    return lsGetProject(id);
  }

  try {
    const db = await getDB();
    const result = await db.get(STORE_PROJECTS, id);
    return (result as NovelProject) ?? null;
  } catch (e) {
    console.error('[NovelDB] IndexedDB 读取失败，尝试 localStorage:', e);
    return lsGetProject(id);
  }
}

/**
 * 列出所有项目（按更新时间降序）
 */
export async function listProjects(): Promise<NovelProject[]> {
  if (!isIndexedDBAvailable()) {
    return lsListProjects();
  }

  try {
    const db = await getDB();
    const all = await db.getAll(STORE_PROJECTS);
    return (all as NovelProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    console.error('[NovelDB] IndexedDB 列表失败，降级到 localStorage:', e);
    return lsListProjects();
  }
}

/**
 * 删除项目及其快照
 */
export async function deleteProject(id: string): Promise<void> {
  // 本地删除
  if (!isIndexedDBAvailable()) {
    lsDeleteProject(id);
  } else {
    try {
      const db = await getDB();
      const tx = db.transaction([STORE_PROJECTS, STORE_SNAPSHOTS], 'readwrite');
      await tx.objectStore(STORE_PROJECTS).delete(id);

      // 删除该项目所有快照
      const snapshotStore = tx.objectStore(STORE_SNAPSHOTS) as IDBPObjectStore;
      const index = snapshotStore.index('byProject');
      let cursor = await index.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch (e) {
      console.error('[NovelDB] IndexedDB 删除失败，降级到 localStorage:', e);
      lsDeleteProject(id);
    }
  }

  // 云端同步删除（异步，不阻塞）
  deleteProjectFromCloud(id).catch(() => {});
}

// ── 快照管理 ─────────────────────────────────────────────────────────────────

/**
 * 创建版本快照
 * 保留最新 MAX_SNAPSHOTS 个，超出时删除最旧的
 */
export async function createSnapshot(project: NovelProject, label: string): Promise<void> {
  const snapshotData: Omit<NovelProject, 'snapshots'> = (() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { snapshots: _snapshots, ...rest } = project;
    return rest;
  })();

  if (!isIndexedDBAvailable()) {
    const existing = lsGetSnapshots(project.id);
    const newSnapshot: StoryBibleSnapshot = {
      timestamp: Date.now(),
      label,
      data: snapshotData,
    };
    const updated = [...existing, newSnapshot]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_SNAPSHOTS);
    lsSaveSnapshots(project.id, updated);
    return;
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SNAPSHOTS) as IDBPObjectStore;

    // 读取该项目现有快照
    const index = store.index('byProject');
    const existingKeys: number[] = [];
    let cursor = await index.openCursor(project.id);
    while (cursor) {
      existingKeys.push(cursor.primaryKey as number);
      cursor = await cursor.continue();
    }

    // 超出上限时删除最旧的
    if (existingKeys.length >= MAX_SNAPSHOTS) {
      // 按 key 排序，最小的 key（最早）先删
      existingKeys.sort((a, b) => a - b);
      const toDelete = existingKeys.slice(0, existingKeys.length - MAX_SNAPSHOTS + 1);
      for (const key of toDelete) {
        await store.delete(key);
      }
    }

    // 写入新快照
    const record: SnapshotRecord = {
      projectId: project.id,
      timestamp: Date.now(),
      label,
      data: snapshotData,
    };
    await store.add(record as unknown as Parameters<typeof store.add>[0]);
    await tx.done;
  } catch (e) {
    console.error('[NovelDB] 快照写入失败:', e);
  }
}

/**
 * 列出项目的所有快照（按时间倒序）
 */
export async function listSnapshots(projectId: string): Promise<StoryBibleSnapshot[]> {
  if (!isIndexedDBAvailable()) {
    return lsGetSnapshots(projectId);
  }

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
    const store = tx.objectStore(STORE_SNAPSHOTS) as AnyIDBPObjectStore;
    const index = store.index('byProject');
    const records: SnapshotRecord[] = [];
    let cursor = await index.openCursor(projectId);
    while (cursor) {
      records.push(cursor.value as unknown as SnapshotRecord);
      cursor = await cursor.continue();
    }
    await tx.done;
    return records
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(r => ({
        timestamp: r.timestamp,
        label: r.label,
        data: r.data,
      }));
  } catch (e) {
    console.error('[NovelDB] 快照读取失败:', e);
    return lsGetSnapshots(projectId);
  }
}

/**
 * 回滚到指定快照
 * 注意：会覆盖当前项目数据（除了 snapshots 列表本身）
 */
export async function restoreSnapshot(
  projectId: string,
  snapshotTimestamp: number
): Promise<NovelProject | null> {
  const snapshots = await listSnapshots(projectId);
  const target = snapshots.find(s => s.timestamp === snapshotTimestamp);
  if (!target) return null;

  const current = await getProject(projectId);
  const restored: NovelProject = {
    ...target.data,
    // 保留当前快照列表，不覆盖
    snapshots: current?.snapshots ?? [],
    updatedAt: Date.now(),
  };

  await saveProject(restored);
  return restored;
}

// ── 导出/导入 Story Bible JSON（跨设备迁移）────────────────────────────────────

/**
 * 导出项目为 JSON 字符串
 */
export function exportProjectJSON(project: NovelProject): string {
  return JSON.stringify(project, null, 2);
}

/**
 * 从 JSON 字符串导入项目
 * 会覆盖同 ID 的现有项目
 */
export async function importProjectJSON(json: string): Promise<NovelProject | null> {
  try {
    const project = JSON.parse(json) as NovelProject;
    if (!project.id || !project.title) {
      throw new Error('无效的 Story Bible 格式');
    }
    // 更新导入时间
    project.updatedAt = Date.now();
    await saveProject(project);
    return project;
  } catch (e) {
    console.error('[NovelDB] 导入失败:', e);
    return null;
  }
}
