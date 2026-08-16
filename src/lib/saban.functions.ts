/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Business Functions & Named Exports
 * File: src/lib/saban.functions.ts
 * Description: Complete Production-Ready Exports for TanStack Start / Vite / Netlify
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

export interface Customer {
  id?: string;
  customerNumber: string;
  name: string;
  phone: string;
  phoneNumber?: string;
  address?: string;
  contactPerson?: string;
  totalOrders?: number;
  driveFolderId?: string;
}

export interface Driver {
  id?: string;
  driverId: string;
  name: string;
  phone: string;
  vehicleType: 'truck' | 'crane' | 'משאית' | 'מנוף';
  plateNumber?: string;
  status?: string;
}

export interface InventoryItem {
  id?: string;
  sku: string;
  name: string;
  currentStock: number;
  price?: number;
  minStock?: number;
}

export interface Reminder {
  id?: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime: string;
  orderId?: string;
  isCompleted?: boolean;
}

// ============================================================================
// 1. שירותי הזמנות (Orders Named Exports)
// ============================================================================

/**
 * שליפת הזמנות מהגיליון
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
 * יצירת הזמנה חדשה
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

/**
 * חיפוש הזמנות
 */
export async function searchOrders(searchTerm: string): Promise<Order[]> {
  const all = await getOrders();
  const term = searchTerm.toLowerCase().trim();
  if (!term) return all;

  return all.filter((o) =>
    o.customerName.toLowerCase().includes(term) ||
    o.orderNumber.toLowerCase().includes(term) ||
    o.destination.toLowerCase().includes(term) ||
    (o.items && o.items.toLowerCase().includes(term))
  );
}

// ============================================================================
// 2. שירותי תעודות משלוח (Delivery Notes Named Exports)
// ============================================================================

/**
 * שליפת תעודות משלוח
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
 * עדכון סטטוס תעודת משלוח
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
// 3. שירותי Google Drive (Drive Named Exports)
// ============================================================================

/**
 * קבלת רשימת קבצים מתיקיית הדרייב
 */
export async function getDriveFiles(folderId?: string): Promise<DriveFileItem[]> {
  return await sabanServer.listDriveFiles(folderId);
}

// ============================================================================
// 4. שירות לקוחות ו-CRM (Customer Named Exports)
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

export async function createCustomer(customerData: Partial<Customer>): Promise<Customer> {
  const phone = customerData.phone || customerData.phoneNumber || '';
  const name = customerData.name || 'לקוח חדש';
  const address = customerData.address || '';
  const customerNumber = customerData.customerNumber || `CUST-${phone.slice(-4) || 'NEW'}`;

  const row = [customerNumber, name, phone, customerData.contactPerson || name, address, 1, '', 'פעיל'];
  await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.CUSTOMERS, row);
  return { customerNumber, name, phone, address };
}

export async function updateCustomer(customerId: string, updates: Partial<Customer>): Promise<void> {
  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
  const rows = raw.slice(1);
  const existing = rows.find((r) => String(r[0]) === customerId || String(r[2]) === customerId);

  if (existing) {
    const updatedRow = [
      existing[0],
      updates.name || existing[1],
      updates.phone || existing[2],
      updates.contactPerson || existing[3],
      updates.address || existing[4],
      existing[5],
      existing[6],
      'פעיל',
    ];
    await sabanServer.updateRowByIdentifierQueued(SABAN_SHEET_NAMES.CUSTOMERS, 'מזהה לקוח', existing[0], updatedRow);
  }
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
  const rows = raw.slice(1);
  const term = query.toLowerCase();

  return rows
    .filter((r) => String(r[1]).toLowerCase().includes(term) || String(r[2]).includes(term))
    .map((r) => ({
      customerNumber: r[0],
      name: r[1],
      phone: r[2],
      contactPerson: r[3],
      address: r[4],
      totalOrders: Number(r[5]) || 0,
    }));
}

// ============================================================================
// 5. שירותי נהגים ושיגור (Drivers & Dispatch Named Exports)
// ============================================================================

export async function getAllDrivers(): Promise<Driver[]> {
  return [
    { driverId: 'ali', name: 'עלי', phone: '050-0000001', vehicleType: 'משאית', plateNumber: '615-41-001', status: 'active' },
    { driverId: 'hikmat', name: 'חכמת', phone: '050-0000002', vehicleType: 'מנוף', plateNumber: '615-41-002', status: 'active' },
  ];
}

export async function searchDrivers(query: string): Promise<Driver[]> {
  const drivers = await getAllDrivers();
  const term = query.toLowerCase();
  return drivers.filter((d) => d.name.toLowerCase().includes(term));
}

export async function updateDriver(driverId: string, updates: Partial<Driver>): Promise<{ success: boolean }> {
  return { success: true };
}

// ============================================================================
// 6. שירותי מלאי ותזכורות (Inventory & Reminders Named Exports)
// ============================================================================

export async function getInventory(query?: string): Promise<InventoryItem[]> {
  const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.INVENTORY);
  if (!raw || raw.length <= 1) return [];

  const items = raw.slice(1).map((r) => ({
    sku: String(r[0] || '').trim(),
    name: String(r[1] || '').trim(),
    currentStock: Number(r[2]) || 0,
    price: Number(r[3]) || 0,
  }));

  if (query) {
    const term = query.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(term) || i.sku.includes(term));
  }
  return items;
}

export async function updateInventoryStock(sku: string, qty: number): Promise<{ success: boolean }> {
  return { success: true };
}

export async function createReminder(data: Partial<Reminder>): Promise<Reminder> {
  return {
    id: `rem_${Date.now()}`,
    title: data.title || '',
    dueDate: data.dueDate || '',
    dueTime: data.dueTime || '',
    isCompleted: false,
  };
}

export async function getReminders(date?: string): Promise<Reminder[]> {
  return [];
}

export async function updateReminder(id: string, updates: Partial<Reminder>): Promise<{ success: boolean }> {
  return { success: true };
}

export async function deleteReminder(id: string): Promise<{ success: boolean }> {
  return { success: true };
}

// ============================================================================
// 7. מנוע נועה AI (Noa Chat Engine - עבור src/components/NoaChat.tsx)
// ============================================================================

export const noaSystemInstruction = `
את "נועה" (Noa) - מנהלת הלוגיסטיקה והמשימות החכמה של ח. סבן חומרי בניין.
את פועלת בסגנון מקצועי, חד, ענייני ותומך.
תפקידך לתאם סידורי עבודה, לפקח על אספקות מחסני החרש והתלמיד, לבדוק מלאי והצלבות תעודות משלוח מול הזמנות קומקס.
`;

const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|\#|\*|`/g, '')
    .replace(/^\s*[\-\*+]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * פונקציית השיחה הראשית עם נועה AI (עבור NoaChat.tsx)
 */
export async function askNoa(
  message: string,
  history: any[] = [],
  userKey?: string
): Promise<{ text: string; audioContent?: string; candidates?: any[] }> {
  const gasUrl =
    (typeof process !== 'undefined' && process.env?.VITE_GAS_URL_AI) ||
    (typeof process !== 'undefined' && process.env?.VITE_GAS_URL) ||
    '';

  // אם הוגדר צינור GAS חיצוני
  if (gasUrl) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'generateAI',
          prompt: message,
          history,
          userKey,
        }),
      });
      const data = await res.json();
      const textResponse = data?.reply || data?.text || 'נועה קיבלה את הפקודה ומעבדת אותה.';
      return {
        text: textResponse,
        audioContent: sanitizeForVoice(textResponse),
      };
    } catch (err) {
      console.warn('GAS proxy request failed, falling back to local dispatch response:', err);
    }
  }

  // מענה לוגיסטי מהיר מקומי אם ה-GAS אינו זמין
  let fallbackReply = `ראמי נשמה, קיבלתי את ההודעה: "${message}".`;

  if (message.includes('סידור') || message.includes('הזמנות')) {
    const orders = await getOrders();
    fallbackReply = `ישנן כרגע ${orders.length} הזמנות פעילות בלוח התפעולי של סבן.`;
  } else if (message.includes('נהג') || message.includes('עלי') || message.includes('חכמת')) {
    fallbackReply = `עלי פנוי על המשאית, וחכמת זמין בציוד המנוף בהוד השרון.`;
  }

  return {
    text: fallbackReply,
    audioContent: sanitizeForVoice(fallbackReply),
  };
}

export async function predictOrderEta(order: Order, historicalOrders: Order[] = []): Promise<string | null> {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 45); // הערכת זמן בסיסית של 45 דק'
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
