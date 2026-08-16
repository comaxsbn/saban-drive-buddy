/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Business Functions & Named Exports
 * File: src/lib/saban.functions.ts
 * Description: Client & Server Safe Operational Functions for TanStack / Vite
 * ============================================================================
 */

import { sabanServer, DriveFileItem } from './saban.server';

// ============================================================================
// הגדרות קבועות וטיפוסים (Types & Constants)
// ============================================================================

export const SABAN_SHEET_NAMES = {
  ORDERS_LOG: 'לוג_הזמנות_מערכת',
  DELIVERY_NOTES: 'תעודות_משלוח',
  RECONCILIATION: 'בקרת_סטיות_והצלבות',
  CUSTOMERS: 'תיק_לקוח',
  LOGISTIC_DICT: 'מילון_לוגיסטי',
  DRIVERS: 'נהגים',
  INVENTORY: 'מלאי',
  SYSTEM_LOGS: 'System_Logs',
};

export interface Order {
  id?: string;
  orderNumber: string;
  date?: string;
  time?: string;
  dateTime?: string;
  customerName: string;
  customerPhone?: string;
  warehouse?: string;
  destination: string;
  items: string;
  itemsText?: string;
  driverId?: string;
  bigBagsDeposit?: number;
  palletsDeposit?: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | string;
  eta?: string;
  etaDistance?: string;
  wazeLink?: string;
  driveFolderUrl?: string;
  noaReview?: string;
  syncStatus?: string;
  totalAmount?: number;
}

export interface DeliveryNote {
  id?: string;
  documentNumber: string;
  documentDate: string;
  relatedOrderNumber: string;
  customerName: string;
  driverName: string;
  itemsText: string;
  bigBagsSupplied?: number;
  palletsSupplied?: number;
  status: string;
  matchStatus?: string;
  fileUrl?: string;
  notes?: string;
}

// ============================================================================
// 1. פונקציות הזמנות (Orders Named Exports)
// ============================================================================

/**
 * שליפת כל ההזמנות מהמערכת (עבור src/lib/queries.ts)
 */
export async function getOrders(forceFresh = false): Promise<Order[]> {
  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.ORDERS_LOG, undefined, forceFresh);
  if (!raw || raw.length <= 1) return [];

  const rows = raw.slice(1);
  return rows.map((r, idx) => ({
    id: `ord_${r[1] || idx}`,
    dateTime: r[0] || '',
    date: r[0] ? String(r[0]).split(' ')[0] : '',
    time: r[0] ? String(r[0]).split(' ')[1] : '',
    orderNumber: String(r[1] || '').trim(),
    customerName: r[2] || '',
    customerPhone: r[3] || '',
    warehouse: r[4] || 'החרש',
    destination: r[5] || '',
    items: r[6] || '',
    itemsText: r[6] || '',
    bigBagsDeposit: Number(r[7]) || 0,
    palletsDeposit: Number(r[8]) || 0,
    status: r[9] || 'pending',
    etaDistance: r[10] || '',
    wazeLink: r[11] || '',
    driveFolderUrl: r[12] || '',
    noaReview: r[13] || '',
    syncStatus: r[14] || '',
  }));
}

/**
 * יצירת הזמנה חדשה (עבור src/routes/orders.tsx)
 */
export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  const orderNumber = orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;
  const dateTime = orderData.dateTime || new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const destination = orderData.destination || '';
  const wazeLink = destination ? `https://waze.com/ul?q=${encodeURIComponent(destination)}` : '';

  const newOrder: Order = {
    orderNumber,
    dateTime,
    customerName: orderData.customerName || 'לקוח כללי',
    customerPhone: orderData.customerPhone || '',
    warehouse: orderData.warehouse || 'החרש',
    destination,
    items: orderData.items || orderData.itemsText || '',
    itemsText: orderData.items || orderData.itemsText || '',
    bigBagsDeposit: Number(orderData.bigBagsDeposit) || 0,
    palletsDeposit: Number(orderData.palletsDeposit) || 0,
    status: orderData.status || 'pending',
    etaDistance: orderData.etaDistance || '',
    wazeLink,
    driveFolderUrl: orderData.driveFolderUrl || '',
    noaReview: orderData.noaReview || 'סונכרן בהצלחה למערכת',
    syncStatus: 'סונכרן ל-Sheets',
  };

  const row = [
    newOrder.dateTime,
    newOrder.orderNumber,
    newOrder.customerName,
    newOrder.customerPhone,
    newOrder.warehouse,
    newOrder.destination,
    newOrder.items,
    newOrder.bigBagsDeposit,
    newOrder.palletsDeposit,
    newOrder.status,
    newOrder.etaDistance,
    newOrder.wazeLink,
    newOrder.driveFolderUrl,
    newOrder.noaReview,
    newOrder.syncStatus,
  ];

  await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.ORDERS_LOG, row);

  // יצירת/עדכון כרטיס לקוח ברקע
  if (newOrder.customerPhone) {
    await touchCustomer(newOrder.customerName, newOrder.customerPhone, newOrder.destination);
  }

  return newOrder;
}

/**
 * עדכון פרטי הזמנה קיימת
 */
export async function updateOrder(orderNumber: string, updates: Partial<Order>): Promise<void> {
  const all = await getOrders();
  const existing = all.find((o) => o.orderNumber === String(orderNumber).trim());
  if (!existing) {
    throw new Error(`הזמנה ${orderNumber} לא נמצאה`);
  }

  const merged: Order = { ...existing, ...updates };
  const updatedRow = [
    merged.dateTime,
    merged.orderNumber,
    merged.customerName,
    merged.customerPhone,
    merged.warehouse,
    merged.destination,
    merged.items,
    merged.bigBagsDeposit,
    merged.palletsDeposit,
    merged.status,
    merged.etaDistance,
    merged.wazeLink,
    merged.driveFolderUrl,
    merged.noaReview,
    `עודכן (${new Date().toLocaleTimeString('he-IL')})`,
  ];

  await sabanServer.updateRowByIdentifierQueued(
    SABAN_SHEET_NAMES.ORDERS_LOG,
    'מספר הזמנה',
    orderNumber,
    updatedRow
  );
}

// ============================================================================
// 2. פונקציות תעודות משלוח (Delivery Notes Named Exports)
// ============================================================================

/**
 * שליפת תעודות משלוח מהגיליון (עבור src/lib/queries.ts)
 */
export async function getNotes(forceFresh = false): Promise<DeliveryNote[]> {
  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.DELIVERY_NOTES, undefined, forceFresh);
  if (!raw || raw.length <= 1) return [];

  const rows = raw.slice(1);
  return rows.map((r, idx) => ({
    id: `note_${r[1] || idx}`,
    documentDate: r[0] || '',
    documentNumber: String(r[1] || '').trim(),
    relatedOrderNumber: String(r[2] || '').trim(),
    customerName: r[3] || '',
    driverName: r[4] || '',
    itemsText: r[5] || '',
    status: r[6] || 'נמסר',
    matchStatus: r[6] || '✅ תואם',
    fileUrl: r[7] || '',
    notes: r[8] || '',
  }));
}

/**
 * עדכון סטטוס תעודת משלוח (עבור src/components/NoteSheet.tsx)
 */
export async function updateNoteStatus(
  noteNumber: string,
  newStatus: string,
  notesText?: string
): Promise<{ success: boolean }> {
  const allNotes = await getNotes();
  const cleanId = String(noteNumber).trim();
  const existing = allNotes.find((n) => n.documentNumber === cleanId || n.id === cleanId);

  if (!existing) {
    throw new Error(`תעודת משלוח ${noteNumber} לא נמצאה`);
  }

  const updatedRow = [
    existing.documentDate,
    existing.documentNumber,
    existing.relatedOrderNumber,
    existing.customerName,
    existing.driverName,
    existing.itemsText,
    newStatus,
    existing.fileUrl || '',
    notesText ? `${existing.notes || ''} | ${notesText}` : existing.notes || '',
  ];

  await sabanServer.updateRowByIdentifierQueued(
    SABAN_SHEET_NAMES.DELIVERY_NOTES,
    'מספר תעודת משלוח',
    existing.documentNumber,
    updatedRow
  );

  return { success: true };
}

// ============================================================================
// 3. פונקציית קבצי Google Drive (Drive Files Named Export)
// ============================================================================

/**
 * שליפת רשימת קבצים מתיקיית הדרייב המוגדרת (עבור src/lib/queries.ts)
 */
export async function getDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
  return await sabanServer.listDriveFiles(folderId);
}

// ============================================================================
// 4. פונקציות לקוחות ו-CRM (Customer Named Exports)
// ============================================================================

export async function touchCustomer(name: string, phone: string, address: string): Promise<void> {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return;

  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
  const rows = raw.slice(1);
  const existing = rows.find((r) => String(r[2]).replace(/[^0-9]/g, '') === cleanPhone);

  if (existing) {
    const totalOrders = (Number(existing[5]) || 0) + 1;
    const updatedRow = [
      existing[0],
      existing[1] || name,
      phone,
      existing[3] || name,
      address || existing[4],
      totalOrders,
      existing[6] || '',
      'פעיל',
    ];
    await sabanServer.updateRowByIdentifierQueued(
      SABAN_SHEET_NAMES.CUSTOMERS,
      'טלפון ראשי',
      phone,
      updatedRow
    );
  } else {
    const newId = `CUST-${cleanPhone.slice(-4) || 'SBN'}`;
    const newRow = [newId, name, phone, name, address, 1, '', 'לקוח חדש'];
    await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.CUSTOMERS, newRow);
  }
}

// ============================================================================
// 5. ייצוא מחלקות שירות לנוחות עתידית (Services Layer)
// ============================================================================

export const OrdersService = {
  getAllOrders: getOrders,
  createOrder,
  updateOrder,
};

export const NotesService = {
  getNotes,
  updateNoteStatus,
};

export const DriveService = {
  getDriveFiles,
};
