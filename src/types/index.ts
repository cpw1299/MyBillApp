// 产品类型定义
export interface Product {
  id: string;
  name: string;
  unitPrice: number;
  colors: string[];
  enabled?: boolean;
}

// 工作批次：以老板结账为核心的业务边界
export interface WorkBatch {
  id: string;
  name: string;
  createdAt: number;
  completedAt?: number;
  settledAt?: number;
  status: 'active' | 'completed' | 'settled';
}

// 工作记录类型定义
export interface WorkRecord {
  id: string;
  batchId: string;
  date: string;
  productId: string;
  productName: string;
  colorName: string;
  quantity: number;
  unitPrice: number;
  fee: number;
  createdAt: number;
}

export interface AppSettings {
  serverType: 'webdav' | 'http' | 'sftp';
  serverUrl: string;
  remotePath: string;
  username?: string;
  password?: string;
  autoUpload: boolean;
  backupTimePolicy: 'onComplete' | 'daily21' | 'startupCatchup';
}

export interface BackupMeta {
  fileName: string;
  localPath: string;
  generatedAt: number;
  uploadStatus: 'pending' | 'success' | 'failed';
  lastUploadAttempt?: number;
  retryCount?: number;
}

export interface DailySummary {
  date: string;
  totalFee: number;
  totalCount: number;
  itemsByProduct: Record<string, { count: number; fee: number }>;
}

export interface ProductDraft {
  name: string;
  unitPrice: number;
}

export interface RecordDraft {
  batchId: string;
  date: string;
  productId: string;
  quantity: number;
  colorName?: string;
}

export type ProductMutationResult = { ok: true; product: Product } | { ok: false; message: string };
export type RecordMutationResult = { ok: true; record: WorkRecord } | { ok: false; message: string };
export type ImportDataResult =
  | { ok: true; productCount: number; recordCount: number; batchCount: number }
  | { ok: false; message: string };
export type ProductRemoveResult = { ok: true } | { ok: false; message: string };

export interface LegacyColor {
  colorName?: string;
  unitPrice?: number;
}

export interface LegacyProduct {
  id?: string;
  name?: string;
  unitPrice?: number;
  colors?: Array<string | LegacyColor>;
  enabled?: boolean;
}

export interface LegacyProductWithIdentity extends LegacyProduct {
  id: string;
  name: string;
}

export interface LegacyRecord extends Partial<WorkRecord> {
  amount?: number;
}
