/**
 * src/lib/saban.functions.ts
 * מודול ניהול לוגיקה מאוחדת למערכת הזמנות ותעודות משלוח
 * תואם למבנה הנתונים: הזמנות, תעודות משלוח, הצלבה ובקרה
 */

export interface OrderData {
  tarihKlita: string;
  orderNumber: string;
  customerNumber: string;
  customerName: string;
  warehouse: string;
  deliveryAddress: string;
  productsDetails: string;
  depositBales: string;
  depositPallets: string;
  driveFolderLink?: string;
}

export interface DeliveryNoteData {
  tarihTeuda: string;
  teudaNumber: string;
  bginOrder: string;
  customerNumber: string;
  customerName: string;
  warehouse: string;
  deliveryAddress: string;
  driver: string;
  truck: string;
  deliveredProducts: string;
  depositBales: string;
  depositPallets: string;
  scannedDocLink?: string;
}

/**
 * פונקציה לפורמט נתוני הזמנה למבנה הגיליון
 */
export const formatOrderForSheet = (data: any): OrderData => {
  return {
    tarihKlita: data.tarihKlita || new Date().toLocaleString('he-IL'),
    orderNumber: data.orderNumber || "",
    customerNumber: data.customerNumber || "",
    customerName: data.customerName || "",
    warehouse: data.warehouse || "4 (החרש)",
    deliveryAddress: data.deliveryAddress || "",
    productsDetails: data.productsDetails || "",
    depositBales: data.depositBales || "פטור",
    depositPallets: data.depositPallets || "פטור",
    driveFolderLink: data.driveFolderLink || "📁 תיק לקוח",
  };
};

/**
 * פונקציה לפורמט נתוני תעודת משלוח למבנה הגיליון
 */
export const formatDeliveryNoteForSheet = (data: any): DeliveryNoteData => {
  return {
    tarihTeuda: data.tarihTeuda || new Date().toLocaleString('he-IL'),
    teudaNumber: data.teudaNumber || "",
    bginOrder: data.bginOrder || "",
    customerNumber: data.customerNumber || "",
    customerName: data.customerName || "",
    warehouse: data.warehouse || "4 (החרש)",
    deliveryAddress: data.deliveryAddress || "",
    driver: data.driver || "",
    truck: data.truck || "",
    deliveredProducts: data.deliveredProducts || "",
    depositBales: data.depositBales || "—",
    depositPallets: data.depositPallets || "—",
    scannedDocLink: data.scannedDocLink || "📄 צפה בתעודה",
  };
};

/**
 * סנכרון נתונים מול ה-Google Apps Script בזמן אמת
 */
export async function syncToGoogleSheet(action: 'ADD_ORDER' | 'ADD_DELIVERY_NOTE' | 'UPDATE_CONTROL', data: any) {
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJDwvb3wPYFoCEVCH_E9Mdco5w_dZeh35KNtCJB8_GdSllt59vV10oWgEA-QaH4S5A/exec";
  
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        data: action === 'ADD_ORDER' ? formatOrderForSheet(data) : 
              action === 'ADD_DELIVERY_NOTE' ? formatDeliveryNoteForSheet(data) : data
      }),
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error syncing to Google Sheet:", error);
    return { success: false, error };
  }
}

/**
 * פונקציה לבדיקת התאמה בין הזמנה לתעודה (הצלבה)
 */
export const validateOrderVsDelivery = (order: OrderData, delivery: DeliveryNoteData) => {
  const isMatch = order.orderNumber === delivery.bginOrder;
  return {
    isMatch,
    status: isMatch ? "✅ תואם" : "⚠️ חוסר התאמה",
    timestamp: new Date().toISOString()
  };
};
