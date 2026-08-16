/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Enterprise Core Server Engine
 * File: src/lib/saban.server.ts
 * Description: Zero-Dependency High-Performance Google Sheets & Drive Bridge
 * ============================================================================
 */

export interface SabanServerConfig {
  gasUrl: string;
  spreadsheetId: string;
  driveRootFolderId: string;
  cacheTtlMs: number;
  batchFlushIntervalMs: number;
  maxBatchSize: number;
  maxRetries: number;
  baseRetryDelayMs: number;
}

export interface SheetWriteOperation {
  id: string;
  sheetName: string;
  type: 'APPEND' | 'UPDATE_ROW';
  rowIdentifier?: { columnKey: string; value: string | number };
  values: any[][];
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  size?: string;
}

export class SabanServerCore {
  private static instance: SabanServerCore;

  private config: SabanServerConfig = {
    // ה-Web App URL החי של סבן
    gasUrl:
      (typeof process !== 'undefined' && (process.env.VITE_GAS_URL || process.env.VITE_GAS_URL_GEMINI)) ||
      'https://script.google.com/macros/s/AKfycbzzomapy62uLXtkN7oS0Dg9XUUPcCJ1fOxbkRN7ftI1n30IN95a0xwB_wtyupCmb8_2Ig/exec',
    spreadsheetId:
      (typeof process !== 'undefined' && process.env.SABAN_SPREADSHEET_ID) ||
      '1i2J9ByIAerL48eIRYnT9SJLJcUryR0mlkD8uiWjjZPc',
    driveRootFolderId:
      (typeof process !== 'undefined' && process.env.SABAN_DRIVE_FOLDER_ID) ||
      '1JCxbchEs3hznBCuXMpfTCzbMO7Ncgiuz',
    cacheTtlMs: 30_000,
    batchFlushIntervalMs: 800,
    maxBatchSize: 50,
    maxRetries: 3,
    baseRetryDelayMs: 1000,
  };

  private cache = new Map<string, { data: any; expiresAt: number }>();
  private writeQueue: SheetWriteOperation[] = [];
  private isFlushingQueue = false;
  private flushTimer: any = null;

  private constructor() {
    this.startBatchFlusher();
  }

  public static getInstance(): SabanServerCore {
    if (!SabanServerCore.instance) {
      SabanServerCore.instance = new SabanServerCore();
    }
    return SabanServerCore.instance;
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let attempt = 0;
    while (attempt < this.config.maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;
        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt) * this.config.baseRetryDelayMs + Math.random() * 200;
          console.warn(`⏳ [Retry in ${context}] Attempt ${attempt}/${this.config.maxRetries} after ${Math.round(delay)}ms...`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          console.error(`❌ Request failed in ${context}:`, error);
          throw error;
        }
      }
    }
    throw new Error(`Failed after ${this.config.maxRetries} retries in ${context}`);
  }

  public async getSheetValues(sheetName: string, range?: string, forceFresh = false): Promise<any[][]> {
    const cacheKey = `read_${sheetName}_${range || 'all'}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceFresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const data = await this.executeWithRetry(async () => {
        const url = `${this.config.gasUrl}?action=readSheet&sheet=${encodeURIComponent(sheetName)}${
          range ? `&range=${encodeURIComponent(range)}` : ''
        }`;

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching ${sheetName}`);
        }

        const json = await res.json();
        return Array.isArray(json) ? json : json.data || [];
      }, `getSheetValues(${sheetName})`);

      this.cache.set(cacheKey, {
        data,
        expiresAt: now + this.config.cacheTtlMs,
      });

      return data;
    } catch (err) {
      if (cached) return cached.data;
      return [];
    }
  }

  public appendRowQueued(sheetName: string, rowValues: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({
        id: `append_${Date.now()}_${Math.random()}`,
        sheetName,
        type: 'APPEND',
        values: [rowValues],
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.invalidateCache(sheetName);

      if (this.writeQueue.length >= this.config.maxBatchSize) {
        this.flushQueue();
      }
    });
  }

  public updateRowByIdentifierQueued(
    sheetName: string,
    idColumnName: string,
    idValue: string | number,
    updatedRowValues: any[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const existingIdx = this.writeQueue.findIndex(
        (op) =>
          op.sheetName === sheetName &&
          op.type === 'UPDATE_ROW' &&
          op.rowIdentifier?.columnKey === idColumnName &&
          String(op.rowIdentifier?.value).trim() === String(idValue).trim()
      );

      if (existingIdx !== -1) {
        this.writeQueue[existingIdx].values = [updatedRowValues];
        this.writeQueue[existingIdx].timestamp = Date.now();
        resolve({ coalesced: true });
        return;
      }

      this.writeQueue.push({
        id: `update_${Date.now()}_${Math.random()}`,
        sheetName,
        type: 'UPDATE_ROW',
        rowIdentifier: { columnKey: idColumnName, value: idValue },
        values: [updatedRowValues],
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.invalidateCache(sheetName);
    });
  }

  public async listDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
    const targetFolder = folderId || this.config.driveRootFolderId;
    const cacheKey = `drive_files_${targetFolder}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const files = await this.executeWithRetry(async () => {
        const url = `${this.config.gasUrl}?action=listFiles&folderId=${encodeURIComponent(targetFolder)}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        return Array.isArray(json) ? json : json.files || [];
      }, `listDriveFiles`);

      this.cache.set(cacheKey, {
        data: files,
        expiresAt: Date.now() + this.config.cacheTtlMs,
      });

      return files;
    } catch (err) {
      if (cached) return cached.data;
      return [];
    }
  }

  private startBatchFlusher(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.writeQueue.length > 0 && !this.isFlushingQueue) {
        this.flushQueue();
      }
    }, this.config.batchFlushIntervalMs);
  }

  private async flushQueue(): Promise<void> {
    if (this.isFlushingQueue || this.writeQueue.length === 0) return;
    this.isFlushingQueue = true;

    const operations = [...this.writeQueue];
    this.writeQueue = [];

    try {
      const payload = {
        action: 'batchSync',
        operations: operations.map((op) => ({
          sheetName: op.sheetName,
          type: op.type,
          rowIdentifier: op.rowIdentifier,
          values: op.values,
        })),
      };

      await this.executeWithRetry(async () => {
        await fetch(this.config.gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
        });
      }, 'flushBatchQueue');

      operations.forEach((op) => op.resolve({ success: true, count: op.values.length }));
    } catch (error) {
      console.error('❌ Flush error:', error);
      operations.forEach((op) => op.reject(error));
    } finally {
      this.isFlushingQueue = false;
    }
  }

  public invalidateCache(sheetNamePrefix?: string): void {
    if (!sheetNamePrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(sheetNamePrefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const sabanServer = SabanServerCore.getInstance();
