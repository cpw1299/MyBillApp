// 存储版本管理
const STORAGE_VERSION = 2;

export const STORAGE_KEYS = {
  settings: 'app:settings',
  products: 'app:products',
  records: 'app:records',
  batches: 'app:batches',
  currentBatch: 'app:currentBatch',
  backups: 'app:backups',
} as const;

interface StorageData<T> { data: T; version: number; }

export function readVersionedJson<T>(key: string, defaultValue: T): StorageData<T> {
  try {
    const raw = uni.getStorageSync(key);
    if (!raw) return { data: defaultValue, version: STORAGE_VERSION };
    const parsed = JSON.parse(raw) as StorageData<T>;
    if (!parsed || typeof parsed !== 'object') return { data: defaultValue, version: STORAGE_VERSION };
    return { data: parsed.data !== undefined ? parsed.data : defaultValue, version: parsed.version || STORAGE_VERSION };
  } catch (error) {
    console.warn(`读取存储数据失败: ${key}`, error);
    return { data: defaultValue, version: STORAGE_VERSION };
  }
}

export function writeVersionedJson<T>(key: string, data: T): boolean {
  try {
    uni.setStorageSync(key, JSON.stringify({ data, version: STORAGE_VERSION }));
    return true;
  } catch (error) {
    console.warn(`写入存储数据失败: ${key}`, error);
    return false;
  }
}

export function removeStorageItem(key: string): boolean {
  try { uni.removeStorageSync(key); return true; } catch (error) { console.warn(`删除存储数据失败: ${key}`, error); return false; }
}

export function clearAllStorage(): boolean {
  try { uni.clearStorageSync(); return true; } catch (error) { console.warn('清空存储数据失败', error); return false; }
}

export function getStorageInfo(): Promise<UniApp.GetStorageInfoSuccess> {
  return new Promise((resolve, reject) => uni.getStorageInfo({ success: resolve, fail: reject }));
}
