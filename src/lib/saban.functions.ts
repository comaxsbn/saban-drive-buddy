/**
 * src/lib/saban.functions.ts
 * מודול ניהול לוגיקה וממשק מול הגיליון והמערכת
 */

export interface OrderData {
  timestamp?: string;
  orderNumber: string;
  customerNumber: string;
  customerName: string;
  warehouse: string;
  deliveryAddress: string;
  itemsText?: string;
  items?: Array<{ sku?: string; name: string; quantity: number }>;
  depositBags?: string;
  depositPallets?: string;
  customerFolderUrl?: string;
  docViewLink?: string;
}

export interface NoteData {
  id: string;
  content: string;
  status: string;
  timestamp?: string;
}

/**
 * שליפת כל ההזמנות
 */
export async function getOrders(): Promise<OrderData[]> {
  // החזרת רשימה ריקה או קריאה לשרת
  return [];
}

/**
 * יצירת הזמנה חדשה
 */
export async function createOrder(orderData: OrderData) {
  return await syncToJoniSystem('ADD_ORDER', orderData);
}

/**
 * שליפת הערות
 */
export async function getNotes(): Promise<NoteData[]> {
  return [];
}

/**
 * עדכון סטטוס הערה
 */
export async function updateNoteStatus(noteId: string, status: string) {
  return { success: true, noteId, status };
}

/**
 * שליפת קבצי דרייב
 */
export async function getDriveFiles() {
  return [];
}

/**
 * סנכרון נתונים מול מערכת JONI / Google Apps Script
 */
export async function syncToJoniSystem(action: string, data: any) {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJDwvb3wPYFoCEVCH_E9Mdco5w_dZeh35KNtCJB8_GdSllt59vV10oWgEA-QaH4S5A/exec";
  
  try {
    await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data }),
    });
    return { success: true };
  } catch (error) {
    console.error("Sync Error:", error);
    return { success: false, error };
  }
}
