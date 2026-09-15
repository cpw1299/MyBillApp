import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Product, WorkRecord, WorkBatch, AppSettings, BackupMeta, ProductDraft, RecordDraft, ProductMutationResult, RecordMutationResult, ImportDataResult, ProductRemoveResult, LegacyProduct, LegacyRecord } from '@/types';
import { readVersionedJson, writeVersionedJson, clearAllStorage, STORAGE_KEYS } from '@/utils/storage';
import { createId, normalizeProductName, isValidUnitPrice, isValidDateString, calculateFee } from '@/utils';
import defaultProducts from '@/config/default-products.json';

function normalizeProducts(products: LegacyProduct[]): Product[] {
  const getColorPrice = (color: string | { colorName?: string; unitPrice?: number }) => typeof color === 'string' ? undefined : color.unitPrice;
  return products.filter(p => typeof p.id === 'string' && typeof p.name === 'string').map(p => {
    const colors = Array.isArray(p.colors) ? p.colors : [];
    const names = colors.map(c => typeof c === 'string' ? c : c.colorName).filter((c): c is string => typeof c === 'string' && c.length > 0);
    const fallback = colors.map(getColorPrice).find(v => typeof v === 'number');
    return { id: p.id as string, name: p.name as string, unitPrice: typeof p.unitPrice === 'number' ? p.unitPrice : (fallback ?? 0), colors: names, enabled: p.enabled !== false };
  });
}

function normalizeRecords(records: LegacyRecord[]): WorkRecord[] {
  return records.filter(r => typeof r.productId === 'string' && typeof r.productName === 'string').map(r => {
    const quantity = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 0;
    const unitPrice = typeof r.unitPrice === 'number' ? r.unitPrice : 0;
    const fee = typeof r.fee === 'number' ? r.fee : typeof r.amount === 'number' ? r.amount : quantity * unitPrice;
    const createdAt = typeof r.createdAt === 'number' ? r.createdAt : Date.now();
    return {
      id: typeof r.id === 'string' && r.id ? r.id : createId(),
      batchId: typeof r.batchId === 'string' ? r.batchId : '',
      date: typeof r.date === 'string' && r.date ? r.date : new Date(createdAt).toISOString().slice(0, 10),
      productId: r.productId as string,
      productName: r.productName as string,
      colorName: typeof r.colorName === 'string' ? r.colorName : '',
      quantity,
      unitPrice,
      fee: Number(fee.toFixed(2)),
      createdAt,
    };
  }).filter(r => r.quantity > 0);
}

const defaultSettings: AppSettings = { serverType: 'webdav', serverUrl: '', remotePath: 'backups', autoUpload: true, backupTimePolicy: 'onComplete' };

export const useAppStore = defineStore('app', () => {
  const settings = ref<AppSettings>(defaultSettings);
  const products = ref<Product[]>([]);
  const records = ref<WorkRecord[]>([]);
  const batches = ref<WorkBatch[]>([]);
  const currentBatchId = ref('');
  const backups = ref<BackupMeta[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const totalQuantity = computed(() => records.value.reduce((s, r) => s + r.quantity, 0));
  const totalAmount = computed(() => Number(records.value.reduce((s, r) => s + r.fee, 0).toFixed(2)));
  const todayTotal = computed(() => { const d = new Date().toISOString().slice(0, 10); return Number(records.value.filter(r => r.date === d).reduce((s, r) => s + r.fee, 0).toFixed(2)); });
  const currentBatch = computed(() => batches.value.find(b => b.id === currentBatchId.value));
  const currentBatchRecords = computed(() => currentBatch.value ? records.value.filter(r => r.batchId === currentBatch.value!.id) : []);
  const currentBatchQuantity = computed(() => currentBatchRecords.value.reduce((s, r) => s + r.quantity, 0));
  const currentBatchAmount = computed(() => Number(currentBatchRecords.value.reduce((s, r) => s + r.fee, 0).toFixed(2)));

  function persistBatches() { writeVersionedJson(STORAGE_KEYS.batches, batches.value); writeVersionedJson(STORAGE_KEYS.currentBatch, currentBatchId.value); }

  function createBatch(name?: string): WorkBatch {
    const index = batches.value.length + 1;
    const batch: WorkBatch = { id: createId(), name: name?.trim() || `批次 ${index}`, createdAt: Date.now(), status: 'active' };
    batches.value.unshift(batch); currentBatchId.value = batch.id; persistBatches(); return batch;
  }

  function selectBatch(id: string): boolean {
    const batch = batches.value.find(b => b.id === id);
    if (!batch) return false;
    currentBatchId.value = id; writeVersionedJson(STORAGE_KEYS.currentBatch, id); return true;
  }

  function completeBatch(id: string): boolean {
    const batch = batches.value.find(b => b.id === id);
    if (!batch || batch.status !== 'active') return false;
    batch.status = 'completed'; batch.completedAt = Date.now(); persistBatches(); return true;
  }

  function settleBatch(id: string): boolean {
    const batch = batches.value.find(b => b.id === id);
    if (!batch || batch.status === 'settled') return false;
    if (!records.value.some(r => r.batchId === id)) return false;
    if (batch.status === 'active') { batch.status = 'completed'; batch.completedAt = Date.now(); }
    batch.status = 'settled'; batch.settledAt = Date.now();
    if (currentBatchId.value === id) currentBatchId.value = '';
    persistBatches(); return true;
  }

  function initProducts(): void {
    try {
      const { data } = readVersionedJson<Product[]>(STORAGE_KEYS.products, []);
      if (!data.length) { products.value = defaultProducts as Product[]; writeVersionedJson(STORAGE_KEYS.products, products.value); }
      else { const normalized = normalizeProducts(data as LegacyProduct[]); if (JSON.stringify(normalized) !== JSON.stringify(data)) writeVersionedJson(STORAGE_KEYS.products, normalized); products.value = normalized; }
    } catch { error.value = '初始化产品数据失败'; }
  }

  function initRecords(): void {
    try {
      const { data } = readVersionedJson<WorkRecord[]>(STORAGE_KEYS.records, []);
      const normalized = normalizeRecords(data as LegacyRecord[]);
      records.value = normalized;
      const savedBatches = readVersionedJson<WorkBatch[]>(STORAGE_KEYS.batches, []).data;
      batches.value = Array.isArray(savedBatches) ? savedBatches : [];
      // v1 记录没有 batchId：按日期生成“历史批次”，不丢失任何记录。
      const missing = records.value.filter(r => !r.batchId);
      const dateBatchMap = new Map<string, string>();
      missing.forEach(r => {
        if (!dateBatchMap.has(r.date)) {
          const b = createBatch(`历史批次 ${r.date}`); b.status = 'settled'; b.settledAt = b.createdAt; dateBatchMap.set(r.date, b.id);
        }
        r.batchId = dateBatchMap.get(r.date)!;
      });
      if (missing.length) writeVersionedJson(STORAGE_KEYS.records, records.value);
      const savedCurrent = readVersionedJson<string>(STORAGE_KEYS.currentBatch, '').data;
      currentBatchId.value = batches.value.some(b => b.id === savedCurrent && b.status === 'active') ? savedCurrent : '';
      if (!currentBatchId.value) { const active = batches.value.find(b => b.status === 'active'); if (active) currentBatchId.value = active.id; }
      if (JSON.stringify(savedBatches) !== JSON.stringify(batches.value)) writeVersionedJson(STORAGE_KEYS.batches, batches.value);
      writeVersionedJson(STORAGE_KEYS.currentBatch, currentBatchId.value);
    } catch { error.value = '初始化记录数据失败'; }
  }

  function ensureCurrentBatch(): WorkBatch {
    const active = batches.value.find(b => b.id === currentBatchId.value && b.status === 'active');
    return active || createBatch();
  }

  function createProduct(input: ProductDraft): ProductMutationResult {
    const name = normalizeProductName(input.name); if (!name) return { ok: false, message: '工件名称不能为空' };
    if (!isValidUnitPrice(input.unitPrice)) return { ok: false, message: '单价必须大于0' };
    if (products.value.some(p => p.name.trim() === name)) return { ok: false, message: '工件名称已存在' };
    const product: Product = { id: createId(), name, unitPrice: Number(input.unitPrice.toFixed(2)), colors: [] }; products.value.push(product); writeVersionedJson(STORAGE_KEYS.products, products.value); return { ok: true, product };
  }

  function updateProductBasic(id: string, input: ProductDraft): ProductMutationResult {
    const name = normalizeProductName(input.name); if (!name) return { ok: false, message: '工件名称不能为空' }; if (!isValidUnitPrice(input.unitPrice)) return { ok: false, message: '单价必须大于0' };
    const i = products.value.findIndex(p => p.id === id); if (i < 0) return { ok: false, message: '工件不存在' }; if (products.value.some(p => p.id !== id && p.name.trim() === name)) return { ok: false, message: '工件名称已存在' };
    products.value[i] = { ...products.value[i], name, unitPrice: Number(input.unitPrice.toFixed(2)) }; writeVersionedJson(STORAGE_KEYS.products, products.value); return { ok: true, product: products.value[i] };
  }

  function updateProductEnabled(id: string, enabled: boolean): ProductMutationResult { const i = products.value.findIndex(p => p.id === id); if (i < 0) return { ok: false, message: '工件不存在' }; products.value[i] = { ...products.value[i], enabled }; writeVersionedJson(STORAGE_KEYS.products, products.value); return { ok: true, product: products.value[i] }; }
  function saveSettings(newSettings: Partial<AppSettings>) { settings.value = { ...settings.value, ...newSettings }; writeVersionedJson(STORAGE_KEYS.settings, settings.value); }
  function removeProduct(id: string): ProductRemoveResult { if (records.value.some(r => r.productId === id)) return { ok: false, message: '该工件已有记录，暂不支持删除' }; products.value = products.value.filter(p => p.id !== id); writeVersionedJson(STORAGE_KEYS.products, products.value); return { ok: true }; }

  function createRecord(input: RecordDraft): RecordMutationResult {
    const product = products.value.find(p => p.id === input.productId); if (!product) return { ok: false, message: '请选择工件' };
    const batch = batches.value.find(b => b.id === input.batchId && b.status === 'active'); if (!batch) return { ok: false, message: '请选择一个进行中的批次' };
    if (!isValidDateString(input.date)) return { ok: false, message: '日期格式不正确' }; if (!Number.isInteger(input.quantity) || input.quantity <= 0) return { ok: false, message: '数量必须是正整数' }; if (!isValidUnitPrice(product.unitPrice)) return { ok: false, message: '工件单价必须大于0' };
    const unitPrice = product.unitPrice; const record: WorkRecord = { id: createId(), batchId: batch.id, date: input.date, productId: product.id, productName: product.name, colorName: input.colorName || '', quantity: input.quantity, unitPrice, fee: calculateFee(input.quantity, unitPrice), createdAt: Date.now() };
    records.value.push(record); writeVersionedJson(STORAGE_KEYS.records, records.value); return { ok: true, record };
  }

  function removeRecord(id: string) { records.value = records.value.filter(r => r.id !== id); writeVersionedJson(STORAGE_KEYS.records, records.value); }
  function getBatchRecords(id: string) { return records.value.filter(r => r.batchId === id); }
  function getBatchQuantity(id: string) { return getBatchRecords(id).reduce((s, r) => s + r.quantity, 0); }
  function getBatchAmount(id: string) { return Number(getBatchRecords(id).reduce((s, r) => s + r.fee, 0).toFixed(2)); }

  function exportData(): string { return JSON.stringify({ schemaVersion: 2, exportedAt: Date.now(), products: products.value, batches: batches.value, currentBatchId: currentBatchId.value, records: records.value }, null, 2); }

  function importData(raw: string): ImportDataResult {
    let parsed: any; try { parsed = JSON.parse(raw); } catch { return { ok: false, message: '导入文件不是有效JSON' }; }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products) || !Array.isArray(parsed.records)) return { ok: false, message: '导入文件缺少products或records字段' };
    const ps = normalizeProducts(parsed.products as LegacyProduct[]); const rs = normalizeRecords(parsed.records as LegacyRecord[]); if (ps.length === 0 && parsed.products.length) return { ok: false, message: '导入工件数据格式不正确' }; if (rs.length === 0 && parsed.records.length) return { ok: false, message: '导入记录数据格式不正确' };
    products.value = ps; batches.value = Array.isArray(parsed.batches) ? parsed.batches.filter((b: any) => b && typeof b.id === 'string') : [];
    const map = new Map<string, string>(); rs.forEach(r => { if (!r.batchId) { if (!map.has(r.date)) { const b = createBatch(`历史批次 ${r.date}`); b.status = 'settled'; b.settledAt = b.createdAt; map.set(r.date, b.id); } r.batchId = map.get(r.date)!; } }); records.value = rs;
    currentBatchId.value = typeof parsed.currentBatchId === 'string' && batches.value.some(b => b.id === parsed.currentBatchId && b.status === 'active') ? parsed.currentBatchId : (batches.value.find(b => b.status === 'active')?.id || '');
    writeVersionedJson(STORAGE_KEYS.products, products.value); writeVersionedJson(STORAGE_KEYS.batches, batches.value); writeVersionedJson(STORAGE_KEYS.records, records.value); writeVersionedJson(STORAGE_KEYS.currentBatch, currentBatchId.value);
    return { ok: true, productCount: ps.length, recordCount: rs.length, batchCount: batches.value.length };
  }

  function setBackups(list: BackupMeta[]) { backups.value = list; writeVersionedJson(STORAGE_KEYS.backups, backups.value); }
  function upsertBackup(meta: BackupMeta) { const i = backups.value.findIndex(b => b.fileName === meta.fileName); if (i >= 0) backups.value[i] = meta; else backups.value.push(meta); writeVersionedJson(STORAGE_KEYS.backups, backups.value); }
  function clearAllData() { try { clearAllStorage(); products.value = []; records.value = []; batches.value = []; currentBatchId.value = ''; backups.value = []; settings.value = defaultSettings; } catch { error.value = '清空数据失败'; } }

  const savedSettings = readVersionedJson<AppSettings>(STORAGE_KEYS.settings, defaultSettings).data; settings.value = savedSettings;
  return { settings, products, records, batches, currentBatchId, backups, isLoading, error, totalQuantity, totalAmount, todayTotal, currentBatch, currentBatchRecords, currentBatchQuantity, currentBatchAmount, initProducts, initRecords, createBatch, ensureCurrentBatch, selectBatch, completeBatch, settleBatch, getBatchRecords, getBatchQuantity, getBatchAmount, createProduct, updateProductBasic, updateProductEnabled, saveSettings, removeProduct, createRecord, removeRecord, exportData, importData, setBackups, upsertBackup, clearAllData };
});
