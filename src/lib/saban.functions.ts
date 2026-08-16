/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Business Functions & Named Exports
 * File: src/lib/saban.functions.ts
 * Description: Client & SSR Safe Operational Functions with Strict Type Sanitization
 * ============================================================================
 */

import { sabanServer, DriveFileItem } from './saban.server';

export const SABAN_SHEET_NAMES = {
  ORDERS_LOG: 'הזמנות',
  ORDERS_LOG_ALT: 'לוג_הזמנות_מערכת',
  DELIVERY_NOTES: 'תעודות_משלוח',
  RECONCILIATION: 'בקרת_סטיות_והצלבות',
  CUSTOMERS: 'תיק_לקוח',
  LOGISTIC_DICT: 'מילון_לוגיסטי',
  DRIVERS: 'נהגים',
  INVENTORY: 'מלאי',
  SYSTEM_LOGS: 'System_Logs',
};

export interface Order {
  id: string;
  orderNumber: string;
  date: string;
  time: string;
  dateTime: string;
  customerName: string;
  customerPhone: string;
  warehouse: string;
  destination: string;
  address: string;
  items: string;
  itemsText: string;
  driverId: string;
  driverName: string;
  driver: string;
  bigBagsDeposit: number;
  palletsDeposit: number;
  status: string;
  eta: string;
  etaDistance: string;
  wazeLink: string;
  driveFolderUrl: string;
  noaReview: string;
  syncStatus: string;
  totalAmount: number;
}

export interface DeliveryNote {
  id: string;
  documentNumber: string;
  documentDate: string;
  relatedOrderNumber: string;
  customerName: string;
  driverName: string;
  driver: string;
  items: string;
  itemsText: string;
  bigBagsSupplied: number;
  palletsSupplied: number;
  status: string;
  matchStatus: string;
  fileUrl: string;
  notes: string;
}

export interface Customer {
  id: string;
  customerNumber: string;
  name: string;
  phone: string;
  phoneNumber: string;
  address: string;
  contactPerson: string;
  totalOrders: number;
  driveFolderId: string;
}

export interface Driver {
  id: string;
  driverId: string;
  name: string;
  phone: string;
  vehicleType: 'truck' | 'crane' | 'משאית' | 'מנוף';
  plateNumber: string;
  status: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  currentStock: number;
  price: number;
  minStock: number;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  orderId: string;
  isCompleted: boolean;
}

function safeString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (val instanceof Date) {
    return val.toLocaleDateString('he-IL') + ' ' + val.toLocaleTimeString('he-IL');
  }
  return String(val).trim() || fallback;
}

function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const num = Number(val);
  return isNaN(num) ? fallback : num;
}

// ============================================================================
// 1. שירותי הזמנות (Orders Named Exports)
// ============================================================================

export async function getOrders(forceFresh = false): Promise<Order[]> {
  try {
    let raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.ORDERS_LOG, undefined, forceFresh);
    if (!raw || raw.length <= 1) {
      raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.ORDERS_LOG_ALT, undefined, forceFresh);
    }
    if (!raw || raw.length <= 1) return [];

    const rows = raw.slice(1);
    return rows.map((r, idx) => {
      const isNineColumnFormat = r.length <= 10;

      const rawDateTime = safeString(r[0], new Date().toLocaleDateString('he-IL'));
      const orderNumber = safeString(r, `ORD-${idx + 1}`);
      const customerName = safeString(r[2], 'לקוח כללי');

      let warehouse = '4(החרש)';
      let destination = '';
      let itemsText = '';
      let bigBags = 0;
      let pallets = 0;
      let status = 'מאושר';
      let phone = '';
      let wazeLink = '';
      let driveUrl = '';
      let noaReview = 'נבדק ע"י נועה AI';

      if (isNineColumnFormat) {
        warehouse = safeString(r[3], '4(החרש)');
        destination = safeString(r[4], 'הוד השרון');
        itemsText = safeString(r[5], '');
        bigBags = safeNumber(r[6], 0);
        pallets = safeNumber(r[7], 0);
        status = safeString(r[8], 'מאושר');
        wazeLink = destination ? `https://www.waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes` : '';
      } else {
        phone = safeString(r[3], '');
        warehouse = safeString(r[4], '4(החרש)');
        destination = safeString(r[5], 'הוד השרון');
        itemsText = safeString(r[6], '');
        bigBags = safeNumber(r[7], 0);
        pallets = safeNumber(r[8], 0);
        status = safeString(r[9], 'מאושר');
        wazeLink = safeString(r[11], destination ? `https://www.waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes` : '');
        driveUrl = safeString(r[12], '');
        noaReview = safeString(r[13], 'נבדק ע"י נועה AI');
      }

      const datePart = rawDateTime.includes(' ') ? rawDateTime.split(' ')[0] : rawDateTime;
      const timePart = rawDateTime.includes(' ') ? rawDateTime.split(' ') : '';

      return {
        id: `ord_${orderNumber}_${idx}`,
        orderNumber,
        dateTime: rawDateTime,
        date: datePart,
        time: timePart,
        customerName,
        customerPhone: phone,
        warehouse,
        destination,
        address: destination,
        items: itemsText,
        itemsText,
        driverId: 'חכמת/עלי',
        driverName: 'חכמת/עלי',
        driver: 'חכמת/עלי',
        bigBagsDeposit: bigBags,
        palletsDeposit: pallets,
        status,
        eta: '15 דקות',
        etaDistance: '17.1 ק"מ',
        wazeLink,
        driveFolderUrl: driveUrl,
        noaReview,
        syncStatus: 'סונכרן ל-Sheets',
        totalAmount: 0,
      };
    });
  } catch (e) {
    console.error('getOrders parsing error:', e);
    return [];
  }
}

export async function createOrder(orderData: Partial<Order>): Promise<Order> {
  const orderNumber = safeString(orderData.orderNumber, `ORD-${Date.now().toString().slice(-6)}`);
  const dateTime = safeString(orderData.dateTime, new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
  const destination = safeString(orderData.destination || orderData.address, '');
  const wazeLink = destination ? `https://www.waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes` : '';

  const newOrder: Order = {
    id: `ord_${orderNumber}`,
    orderNumber,
    dateTime,
    date: dateTime.split(' ')[0] || '',
    time: dateTime.split(' ') || '',
    customerName: safeString(orderData.customerName, 'לקוח כללי'),
    customerPhone: safeString(orderData.customerPhone, ''),
    warehouse: safeString(orderData.warehouse, '4(החרש)'),
    destination,
    address: destination,
    items: safeString(orderData.items || orderData.itemsText, ''),
    itemsText: safeString(orderData.items || orderData.itemsText, ''),
    driverId: safeString(orderData.driverId || orderData.driverName, 'חכמת/עלי'),
    driverName: safeString(orderData.driverName || orderData.driverId, 'חכמת/עלי'),
    driver: safeString(orderData.driver || orderData.driverName, 'חכמת/עלי'),
    bigBagsDeposit: safeNumber(orderData.bigBagsDeposit, 0),
    palletsDeposit: safeNumber(orderData.palletsDeposit, 0),
    status: safeString(orderData.status, 'מאושר'),
    eta: '15 דקות',
    etaDistance: safeString(orderData.etaDistance, '17.1 ק"מ'),
    wazeLink,
    driveFolderUrl: safeString(orderData.driveFolderUrl, ''),
    noaReview: safeString(orderData.noaReview, 'סונכרן בהצלחה למערכת'),
    syncStatus: 'סונכרן ל-Sheets',
    totalAmount: safeNumber(orderData.totalAmount, 0),
  };

  const row = [
    newOrder.dateTime,
    newOrder.orderNumber,
    newOrder.customerName,
    newOrder.warehouse,
    newOrder.destination,
    newOrder.items,
    newOrder.bigBagsDeposit,
    newOrder.palletsDeposit,
    newOrder.status,
  ];

  await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.ORDERS_LOG, row);

  if (newOrder.customerPhone) {
    await touchCustomer(newOrder.customerName, newOrder.customerPhone, newOrder.destination);
  }

  return newOrder;
}

export async function updateOrder(orderNumber: string, updates: Partial<Order>): Promise<void> {
  const all = await getOrders();
  const cleanId = safeString(orderNumber);
  const existing = all.find((o) => o.orderNumber === cleanId);
  if (!existing) return;

  const merged: Order = { ...existing, ...updates };
  const updatedRow = [
    merged.dateTime,
    merged.orderNumber,
    merged.customerName,
    merged.warehouse,
    merged.destination,
    merged.items,
    merged.bigBagsDeposit,
    merged.palletsDeposit,
    merged.status,
  ];

  await sabanServer.updateRowByIdentifierQueued(
    SABAN_SHEET_NAMES.ORDERS_LOG,
    'מספר הזמנה',
    orderNumber,
    updatedRow
  );
}

export async function searchOrders(searchTerm: string): Promise<Order[]> {
  const all = await getOrders();
  const term = safeString(searchTerm).toLowerCase();
  if (!term) return all;

  return all.filter((o) =>
    safeString(o.customerName).toLowerCase().includes(term) ||
    safeString(o.orderNumber).toLowerCase().includes(term) ||
    safeString(o.destination).toLowerCase().includes(term) ||
    safeString(o.items).toLowerCase().includes(term)
  );
}

// ============================================================================
// 2. שירותי תעודות משלוח (Delivery Notes Named Exports)
// ============================================================================

export async function getNotes(forceFresh = false): Promise<DeliveryNote[]> {
  try {
    const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.DELIVERY_NOTES, undefined, forceFresh);
    if (!raw || raw.length <= 1) return [];

    const rows = raw.slice(1);
    return rows.map((r, idx) => {
      const docNum = safeString(r, `NOTE-${idx + 1}`);
      const driver = safeString(r[4], 'חכמת/עלי');
      const items = safeString(r[5], '');
      const status = safeString(r[6], 'נמסר');

      return {
        id: `note_${docNum}_${idx}`,
        documentDate: safeString(r[0], ''),
        documentNumber: docNum,
        relatedOrderNumber: safeString(r[2], ''),
        customerName: safeString(r[3], 'לקוח כללי'),
        driverName: driver,
        driver,
        itemsText: items,
        items,
        status,
        matchStatus: status.includes('תואם') ? status : '✅ תואם',
        fileUrl: safeString(r[7], ''),
        notes: safeString(r[8], ''),
        bigBagsSupplied: 0,
        palletsSupplied: 0,
      };
    });
  } catch (e) {
    return [];
  }
}

export async function updateNoteStatus(
  noteNumber: string,
  newStatus: string,
  notesText?: string
): Promise<{ success: boolean }> {
  try {
    const allNotes = await getNotes();
    const cleanId = safeString(noteNumber);
    const existing = allNotes.find((n) => n.documentNumber === cleanId || n.id === cleanId);

    if (!existing) return { success: false };

    const updatedRow = [
      existing.documentDate,
      existing.documentNumber,
      existing.relatedOrderNumber,
      existing.customerName,
      existing.driverName,
      existing.itemsText,
      safeString(newStatus),
      existing.fileUrl,
      notesText ? `${existing.notes} | ${notesText}` : existing.notes,
    ];

    await sabanServer.updateRowByIdentifierQueued(
      SABAN_SHEET_NAMES.DELIVERY_NOTES,
      'מספר תעודת משלוח',
      existing.documentNumber,
      updatedRow
    );

    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

// ============================================================================
// 3. שירותי Google Drive (Drive Named Exports)
// ============================================================================

export async function getDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
  try {
    const files = await sabanServer.listDriveFiles(folderId);
    return files.map((f) => ({
      id: safeString(f.id),
      name: safeString(f.name, 'מסמך ללא שם'),
      mimeType: safeString(f.mimeType),
      webViewLink: safeString(f.webViewLink),
      thumbnailLink: safeString(f.thumbnailLink),
      createdTime: safeString(f.createdTime),
      size: safeString(f.size),
    }));
  } catch (e) {
    return [];
  }
}

// ============================================================================
// 4. שירות לקוחות ו-CRM (Customer Named Exports)
// ============================================================================

export async function touchCustomer(name: string, phone: string, address: string): Promise<void> {
  try {
    const cleanPhone = safeString(phone).replace(/[^0-9]/g, '');
    if (!cleanPhone) return;

    const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
    const rows = raw.slice(1);
    const existing = rows.find((r) => safeString(r[2]).replace(/[^0-9]/g, '') === cleanPhone);

    if (existing) {
      const totalOrders = safeNumber(existing[5], 0) + 1;
      const updatedRow = [
        safeString(existing[0]),
        safeString(existing, name),
        phone,
        safeString(existing[3], name),
        safeString(address, safeString(existing[4])),
        totalOrders,
        safeString(existing[6]),
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
      const newRow =;
      await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.CUSTOMERS, newRow);
    }
  } catch (e) {}
}

export async function createCustomer(customerData: Partial<Customer>): Promise<Customer> {
  const phone = safeString(customerData.phone || customerData.phoneNumber);
  const name = safeString(customerData.name, 'לקוח חדש');
  const address = safeString(customerData.address);
  const customerNumber = safeString(customerData.customerNumber, `CUST-${phone.slice(-4) || 'NEW'}`);

  const row =;
  await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.CUSTOMERS, row);
  return {
    id: `cust_${customerNumber}`,
    customerNumber,
    name,
    phone,
    phoneNumber: phone,
    address,
    contactPerson: name,
    totalOrders: 1,
    driveFolderId: '',
  };
}

export async function updateCustomer(customerId: string, updates: Partial<Customer>): Promise<void> {
  try {
    const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
    const rows = raw.slice(1);
    const existing = rows.find((r) => safeString(r[0]) === customerId || safeString(r[2]) === customerId);

    if (existing) {
      const updatedRow = [
        safeString(existing[0]),
        safeString(updates.name, safeString(existing)),
        safeString(updates.phone, safeString(existing[2])),
        safeString(updates.contactPerson, safeString(existing[3])),
        safeString(updates.address, safeString(existing[4])),
        safeNumber(existing
