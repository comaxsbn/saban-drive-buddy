/**
 * src/lib/saban.functions.ts
 * מודול ניהול לוגיקה, צ'אט נועה וממשק מול הגיליון והמערכת
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
 * שליחת שאלה / הודעה לעוזרת החכמה נועה (Noa AI)
 */
export async function askNoa(prompt: string): Promise<string> {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJDwvb3wPYFoCEVCH_E9Mdco5w_dZeh35KNtCJB8_GdSllt59vV10oWgEA-QaH4S5A/exec";
  
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "askNoa", prompt }),
    });
    return "השאלה נשלחה בהצלחה לנועה.";
  } catch (error) {
    console.error("Noa AI Error:", error);
    return "שגיאה בתקשורת עם נועה.";
  }
}

/**
 * שליפת כל ההזמנות
 */
export async function getOrders(): Promise<OrderData[]> {
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
export async function getOrders() {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJDwvb3wPYFoCEVCH_E9Mdco5w_dZeh35KNtCJB8_GdSllt59vV10oWgEA-QaH4S5A/exec?action=readSheet&sheet=הזמנות";
  
  try {
    const response = await fetch(SCRIPT_URL);
    const result = await response.json();
    console.log("🔍 תוצאה שהתקבלה מהגיליון:", result);
    
    if (result.status === "success" && Array.isArray(result.data)) {
      // אם הנתונים מגיעים כמערך של מערכים (Rows), יש להמיר אותם לאובייקטים:
      const rows = result.data.slice(1); // דילוג על שורת הכותרת
      return rows.map((row: any[]) => ({
        timestamp: row[0],
        orderNumber: row[1],
        customerNumber: row[2],
        customerName: row[3],
        warehouse: row[4],
        deliveryAddress: row[5],
        itemsText: row[6],
        depositBags: row[7],
        depositPallets: row[8],
      }));
    }
    return [];
  } catch (err) {
    console.error("❌ שגיאה בשליפת הזמנות:", err);
    return [];
  }
}
