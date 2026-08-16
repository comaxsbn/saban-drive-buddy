/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Enterprise Core Server Engine
 * File: src/lib/saban.server.ts
 * Description: SSR-Safe Zero-Dependency Google Sheets & Drive Bridge
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
    gasUrl:
      (typeof process !== 'undefined' && (process.env.VITE_GAS_URL || process.env.VITE_GAS_URL_GEMINI)) ||
      'https://script.google.com/macros/s/AKfycbyNBrjlLDih7d-4UkRTs1QHVUi12JKL0KHYlnjSVBxrUW1OJ-7dWfm7D-JAXyEU8r--/exec',
    spreadsheetId:
      (typeof process !== 'undefined' && process.env.SABAN_SPREADSHEET_ID) ||
      '1i2J9ByIAerL48eIRYnT9SJLJcUryR0mlkD8uiWjjZPc',
    driveRootFolderId:
      (typeof process !== 'undefined' && process.env.SABAN_DRIVE_FOLDER_ID) ||
      '1JCxbchEs3hznBCuXMpfTCzbMO7Ncgiuz',
    cacheTtlMs: 30_000,
    batchFlushIntervalMs: 1200,
    maxBatchSize: 50,
    maxRetries: 2,
    baseRetryDelayMs: 600,
  };

  private cache = new Map<string, { data: any; expiresAt: number }>();
  private writeQueue: SheetWriteOperation[] = [];
  private isFlushingQueue = false;
  private flushTimer: any = null;

  private constructor() {}

  public static getInstance(): SabanServerCore {
    if (!SabanServerCore.instance) {
      SabanServerCore.instance = new SabanServerCore();
    }
    return SabanServerCore.instance;
  }

  /**
   * פענוח בטוח של JSON שאינו זורק שגיאות ב-SSR
   */
  private async safeParseJson(res: Response): Promise<any> {
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) {
        // התקבל HTML של שגיאה או הפניה מגוגל
        return null;
      }
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /**
   * שליפת נתונים מוגנת מ-Sheets (לעולם לא קורסת)
   */
  public async getSheetValues(sheetName: string, range?: string, forceFresh = false): Promise<any[][]> {
    const cacheKey = `read_${sheetName}_${range || 'all'}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceFresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      const url = `${this.config.gasUrl}?action=readSheet&sheet=${encodeURIComponent(sheetName)}${
        range ? `&range=${encodeURIComponent(range)}` : ''
      }`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        return cached ? cached.data : [];
      }

      const json = await this.safeParseJson(res);
      if (!json) {
        return cached ? cached.data : [];
      }

      const data = Array.isArray(json) ? json : json.data || [];
      if (Array.isArray(data) && data.length > 0) {
        this.cache.set(cacheKey, {
          data,
          expiresAt: now + this.config.cacheTtlMs,
        });
        return data;
      }

      return cached ? cached.data : [];
    } catch (err) {
      // במקרה של שגיאת רשת/timeout - החזר מערך ריק או cache במקום לקרוס
      return cached ? cached.data : [];
    }
  }

  /**
   * הוספת שורה לתור הכתיבה
   */
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
      this.ensureFlusherActive();
    });
  }

  /**
   * עדכון שורה לפי מזהה
   */
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
      this.ensureFlusherActive();
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
      const url = `${this.config.gasUrl}?action=listFiles&folderId=${encodeURIComponent(targetFolder)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const json = await this.safeParseJson(res);
      const files = json && (Array.isArray(json) ? json : json.files || []);

      if (Array.isArray(files)) {
        this.cache.set(cacheKey, {
          data: files,
          expiresAt: Date.now() + this.config.cacheTtlMs,
        });
        return files;
      }
      return cached ? cached.data : [];
    } catch (err) {
      return cached ? cached.data : [];
    }
  }

  private ensureFlusherActive(): void {
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushQueue();
      }, this.config.batchFlushIntervalMs);
    }
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

      await fetch(this.config.gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });

      operations.forEach((op) => op.resolve({ success: true, count: op.values.length }));
    } catch (error) {
      operations.forEach((op) => op.resolve({ success: false, error }));
    } finally {
      this.isFlushingQueue = false;
      if (this.writeQueue.length > 0) {
        this.ensureFlusherActive();
      }
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
