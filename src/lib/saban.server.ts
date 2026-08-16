/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Enterprise Core Server Engine
 * File: src/lib/saban.server.ts
 * Description: Production-Ready Google Sheets & Drive Resilient Server Infrastructure
 * ============================================================================
 */

import { google, sheets_v4, drive_v3 } from 'googleapis';
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
  private sheetsClient!: sheets_v4.Sheets;
  private driveClient!: drive_v3.Drive;
  private authClient!: JWT;
  private isInitialized = false;

  private config: SabanServerConfig = {
    spreadsheetId: process.env.SABAN_SPREADSHEET_ID || '1i2J9ByIAerL48eIRYnT9SJLJcUryR0mlkD8uiWjjZPc',
    driveRootFolderId: process.env.SABAN_DRIVE_FOLDER_ID || '1JCxbchEs3hznBCuXMpfTCzbMO7Ncgiuz',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    cacheTtlMs: 30_000,
    batchFlushIntervalMs: 800,
    maxBatchSize: 50,
    maxRetries: 4,
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

  public async initialize(customConfig?: Partial<SabanServerConfig>): Promise<void> {
    if (this.isInitialized) return;

    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }

    try {
      this.authClient = new google.auth.JWT({
        email: this.config.clientEmail || undefined,
        key: this.config.privateKey || undefined,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      this.sheetsClient = google.sheets({ version: 'v4', auth: this.authClient });
      this.driveClient = google.drive({ version: 'v3', auth: this.authClient });
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Saban Server Engine Auth:', error);
      throw error;
    }
  }

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
          const delay = Math.pow(2, attempt) * this.config.baseRetryDelayMs + Math.random() * 200;
          console.warn(`⏳ [RateLimit in ${context}] Retrying (${attempt}/${this.config.maxRetries}) after ${Math.round(delay)}ms...`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error(`Execution failed after ${this.config.maxRetries} retries in ${context}`);
  }

  public async getSheetValues(sheetName: string, range?: string, forceFresh = false): Promise<any[][]> {
    await this.initialize();
    const fullRange = range ? `${sheetName}!${range}` : `${sheetName}!A1:Z`;
    const cacheKey = `read_${this.config.spreadsheetId}_${fullRange}`;

    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (!forceFresh && cached && cached.expiresAt > now) {
      return cached.data;
    }

    try {
      const data = await this.executeWithRetry(async () => {
        const res = await this.sheetsClient.spreadsheets.values.get({
          spreadsheetId: this.config.spreadsheetId,
          range: fullRange,
          valueRenderOption: 'FORMATTED_VALUE',
        });
        return res.data.values || [];
      }, `getSheetValues(${fullRange})`);

      this.cache.set(cacheKey, {
        data,
        expiresAt: now + this.config.cacheTtlMs,
      });
      return data;
    } catch (err) {
      if (cached) return cached.data;
      throw err;
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
    await this.initialize();
    const targetFolder = folderId || this.config.driveRootFolderId;
    const cacheKey = `drive_files_${targetFolder}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const files = await this.executeWithRetry(async () => {
      const query = `'${targetFolder}' in parents and trashed = false`;
      const res = await this.driveClient.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink, thumbnailLink, createdTime, size)',
        orderBy: 'createdTime desc',
        pageSize: 50,
      });

      return (res.data.files || []).map((f) => ({
        id: f.id || '',
        name: f.name || 'ללא שם',
        mimeType: f.mimeType || '',
        webViewLink: f.webViewLink || '',
        thumbnailLink: f.thumbnailLink || '',
        createdTime: f.createdTime || '',
        size: f.size || '',
      }));
    }, `listDriveFiles(${targetFolder})`);

    this.cache.set(cacheKey, {
      data: files,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });

    return files;
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
      const bySheet = new Map<string, SheetWriteOperation[]>();
      for (const op of operations) {
        const list = bySheet.get(op.sheetName) || [];
        list.push(op);
        bySheet.set(op.sheetName, list);
      }

      for (const [sheetName, ops] of bySheet.entries()) {
        const appends = ops.filter((o) => o.type === 'APPEND');
        const updates = ops.filter((o) => o.type === 'UPDATE_ROW');

        if (appends.length > 0) {
          const allRows = appends.flatMap((a) => a.values);
          await this.executeWithRetry(async () => {
            return await this.sheetsClient.spreadsheets.values.append({
              spreadsheetId: this.config.spreadsheetId,
              range: `${sheetName}!A:A`,
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              requestBody: { values: allRows },
            });
          }, `appendRows(${sheetName})`);
          appends.forEach((a) => a.resolve({ success: true, count: allRows.length }));
        }

        if (updates.length > 0) {
          const currentData = await this.getSheetValues(sheetName, undefined, true);
          if (currentData.length > 0) {
            const headers = currentData[0] as string[];
            const batchData: sheets_v4.Schema$ValueRange[] = [];

            for (const updateOp of updates) {
              if (!updateOp.rowIdentifier) continue;
              const colIndex = headers.indexOf(updateOp.rowIdentifier.columnKey);
              if (colIndex === -1) continue;

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
              }, `batchUpdateRows(${sheetName})`);
            }
          }
        }
      }
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
