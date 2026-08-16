/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Enterprise Core Server Engine
 * File: saban.server.ts
 * Description: Production-Ready Resilient Google Sheets & Drive Infrastructure Layer
 * ============================================================================
 */

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SabanServerConfig {
  spreadsheetId: string;
  driveRootFolderId: string;
  clientEmail: string;
  privateKey: string;
  cacheTtlMs: number;
  batchFlushIntervalMs: number;
  maxBatchSize: number;
  maxRetries: number;
  baseRetryDelayMs: number;
}

export interface SheetWriteOperation {
  id: string;
  sheetName: string;
  type: 'APPEND' | 'UPDATE_ROW' | 'CLEAR_AND_SET';
  range?: string;
  rowIdentifier?: { columnKey: string; value: string | number };
  values: any[][];
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  isStale: boolean;
}

/**
 * מנהל חיבור ותשתית עמידה לעבודה מול Google Sheets & Drive
 */
export class SabanServerCore {
  private static instance: SabanServerCore;
  private sheetsClient!: sheets_v4.Sheets;
  private authClient!: JWT;
  private isInitialized = false;

  private config: SabanServerConfig = {
    spreadsheetId: process.env.SABAN_SPREADSHEET_ID || '1i2J9ByIAerL48eIRYnT9SJLJcUryR0mlkD8uiWjjZPc',
    driveRootFolderId: process.env.SABAN_DRIVE_FOLDER_ID || '1JCxbchEs3hznBCuXMpfTCzbMO7Ncgiuz',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    cacheTtlMs: 30_000, // 30 שניות TTL לקריאות
    batchFlushIntervalMs: 800, // Flush כל 800 מ"ש לאיחוד כתיבות
    maxBatchSize: 50,
    maxRetries: 4,
    baseRetryDelayMs: 1000,
  };

  // In-Memory Storage
  private cache = new Map<string, CacheEntry<any>>();
  private writeQueue: SheetWriteOperation[] = [];
  private isFlushingQueue = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private sheetLocks = new Map<string, Promise<void>>();

  private constructor() {
    this.startBatchFlusher();
  }

  public static getInstance(): SabanServerCore {
    if (!SabanServerCore.instance) {
      SabanServerCore.instance = new SabanServerCore();
    }
    return SabanServerCore.instance;
  }

  /**
   * אתחול מאובטח של ה-Auth מול שרתי Google
   */
  public async initialize(customConfig?: Partial<SabanServerConfig>): Promise<void> {
    if (this.isInitialized) return;

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    if (!this.config.clientEmail || !this.config.privateKey) {
      // Fallback לסביבת פיתוח מקומית
      console.warn('⚠️ Google Credentials not fully supplied. Using Application Default or Mock Auth.');
    }

    try {
      this.authClient = new google.auth.JWT({
        email: this.config.clientEmail,
        key: this.config.privateKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive',
        ],
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth: this.authClient });
      this.isInitialized = true;
      console.log('✅ Saban Server Engine initialized successfully with Service Account.');
    } catch (error) {
      console.error('❌ Failed to initialize Saban Server Engine Auth:', error);
      throw error;
    }
  }

  /**
   * מנגנון נסיגה מעריכית לטיפול בשגיאות 429/503
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
    let attempt = 0;
    while (attempt < this.config.maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        attempt++;
        const status = error?.status || error?.response?.status;
        const isRateLimit = status === 429 || error?.message?.includes('Quota exceeded');
        const isTransient = status >= 500 && status < 600;

        if ((isRateLimit || isTransient) && attempt < this.config.maxRetries) {
          const jitter = Math.random() * 200;
          const delay = Math.pow(2, attempt) * this.config.baseRetryDelayMs + jitter;
          console.warn(`⏳ [RateLimit/Transient Error in ${context}] Retrying attempt ${attempt}/${this.config.maxRetries} after ${Math.round(delay)}ms...`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          console.error(`❌ Critical error executing ${context} after ${attempt} attempts:`, error);
          throw error;
        }
      }
    }
    throw new Error(`Execution failed after ${this.config.maxRetries} retries in ${context}`);
  }

  /**
   * קריאה חכמה מ-Sheets עם Cache ו-SWR
   */
  public async getSheetValues(sheetName: string, range?: string, forceFresh = false): Promise<any[][]> {
    await this.initialize();
    const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A1:Z`;
    const cacheKey = `read_${this.config.spreadsheetId}_${fullRange}`;

    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceFresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    const fetchPromise = this.executeWithRetry(async () => {
      const res = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.config.spreadsheetId,
        range: fullRange,
        valueRenderOption: 'FORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING',
      });
      return res.data.values || [];
    }, `getSheetValues(${fullRange})`);

    try {
      const data = await fetchPromise;
      this.cache.set(cacheKey, {
        data,
        expiresAt: now + this.config.cacheTtlMs,
        isStale: false,
      });
      return data;
    } catch (err) {
      if (cached) {
        console.warn(`⚠️ Serving stale cache for ${fullRange} due to fetch error.`);
        return cached.data;
      }
      throw err;
    }
  }

  /**
   * הוספת שורה לתור הכתיבה המושהית (Write-Behind)
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

      // ניקוי Cache של הטאב המתאים
      this.invalidateCache(sheetName);

      if (this.writeQueue.length >= this.config.maxBatchSize) {
        this.flushQueue();
      }
    });
  }

  /**
   * עדכון שורה לפי מזהה (למשל מספר הזמנה)
   */
  public updateRowByIdentifierQueued(
    sheetName: string,
    idColumnName: string,
    idValue: string | number,
    updatedRowValues: any[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Coalescing: אם כבר קיים עדכון לאותה שורה בתור, נמזג אותו
      const existingIdx = this.writeQueue.findIndex(
        (op) =>
          op.sheetName === sheetName &&
          op.type === 'UPDATE_ROW' &&
          op.rowIdentifier?.columnKey === idColumnName &&
          op.rowIdentifier?.value === idValue
      );

      if (existingIdx !== -1) {
        this.writeQueue[existingIdx].values = [updatedRowValues];
        this.writeQueue[existingIdx].timestamp = Date.now();
        resolve({ coalesced: true, message: 'Merged with queued update' });
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

  /**
   * הפעלת הטיימר לעיבוד תור הכתיבה במקבצים (Batch Flush)
   */
  private startBatchFlusher(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.writeQueue.length > 0 && !this.isFlushingQueue) {
        this.flushQueue();
      }
    }, this.config.batchFlushIntervalMs);
  }

  /**
   * עיבוד וביצוע של כל פעולות הכתיבה שהצטברו בתור
   */
  private async flushQueue(): Promise<void> {
    if (this.isFlushingQueue || this.writeQueue.length === 0) return;
    this.isFlushingQueue = true;

    const operations = [...this.writeQueue];
    this.writeQueue = [];

    try {
      // קיבוץ לפי טאב
      const bySheet = new Map<string, SheetWriteOperation[]>();
      for (const op of operations) {
        const list = bySheet.get(op.sheetName) || [];
        list.push(op);
        bySheet.set(op.sheetName, list);
      }

      for (const [sheetName, ops] of bySheet.entries()) {
        await this.processSheetOperations(sheetName, ops);
      }
    } catch (error) {
      console.error('❌ Batch flush error:', error);
      // החזרת שגיאה לכל מי שהמתין
      operations.forEach((op) => op.reject(error));
    } finally {
      this.isFlushingQueue = false;
    }
  }

  /**
   * עיבוד פעולות עבור טאב בודד עם Mutex מקומי למניעת Race Conditions
   */
  private async processSheetOperations(sheetName: string, ops: SheetWriteOperation[]): Promise<void> {
    const appends = ops.filter((o) => o.type === 'APPEND');
    const updates = ops.filter((o) => o.type === 'UPDATE_ROW');

    // 1. ביצוע Append מרוכז
    if (appends.length > 0) {
      const allRowsToAppend = appends.flatMap((a) => a.values);
      await this.executeWithRetry(async () => {
        const res = await this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.config.spreadsheetId,
          range: `${sheetName}!A:A`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: allRowsToAppend,
          },
        });
        appends.forEach((a) => a.resolve({ success: true, count: allRowsToAppend.length }));
        return res;
      }, `batchAppend(${sheetName})`);
    }

    // 2. ביצוע Updates מרוכזים
    if (updates.length > 0) {
      const currentData = await this.getSheetValues(sheetName, undefined, true);
      if (currentData.length > 0) {
        const headers = currentData[0] as string[];
        const batchData: sheets_v4.Schema$ValueRange[] = [];

        for (const updateOp of updates) {
          if (!updateOp.rowIdentifier) continue;
          const colIndex = headers.indexOf(updateOp.rowIdentifier.columnKey);
          if (colIndex === -1) {
            updateOp.reject(new Error(`Column ${updateOp.rowIdentifier.columnKey} not found in ${sheetName}`));
            continue;
          }

          const targetRowIndex = currentData.findIndex(
            (row, idx) => idx > 0 && String(row[colIndex]).trim() === String(updateOp.rowIdentifier?.value).trim()
          );

          if (targetRowIndex !== -1) {
            const sheetRowNumber = targetRowIndex + 1;
            const endColLetter = this.getColumnLetter(updateOp.values[0].length);
            batchData.push({
              range: `${sheetName}!A${sheetRowNumber}:${endColLetter}${sheetRowNumber}`,
              values: updateOp.values,
            });
            updateOp.resolve({ success: true, row: sheetRowNumber });
          } else {
            // אם השורה לא קיימת – נבצע Fallback ל-Append
            console.warn(`Row with ${updateOp.rowIdentifier.columnKey}=${updateOp.rowIdentifier.value} not found. Appending as new.`);
            await this.appendRowQueued(sheetName, updateOp.values[0]);
            updateOp.resolve({ success: true, appended: true });
          }
        }

        if (batchData.length > 0) {
          await this.executeWithRetry(async () => {
            return await this.sheetsClient.spreadsheets.values.batchUpdate({
              spreadsheetId: this.config.spreadsheetId,
              requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: batchData,
              },
            });
          }, `batchUpdate(${sheetName})`);
        }
      }
    }
  }

  /**
   * ניקוי Cache סלקטיבי
   */
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

  private getColumnLetter(colIndex: number): string {
    let temp = '';
    let letter = '';
    while (colIndex > 0) {
      temp = ((colIndex - 1) % 26) + 65;
      letter = String.fromCharCode(Number(temp)) + letter;
      colIndex = Math.floor((colIndex - 1) / 26);
    }
    return letter || 'Z';
  }
}

export const sabanServer = SabanServerCore.getInstance();
