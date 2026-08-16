/**
 * src/lib/saban.functions.ts
 * התאמה לממשק המערכת המאוחדת (JONI)
 */

export interface OrderData {
  timestamp: string;
  orderNumber: string;
  customerNumber: string;
  customerName: string;
  warehouse: string;
  deliveryAddress: string;
  itemsText: string;
  blowDeposit: string; // פקדון בלות (תואם לקוד ה-Script)
  palletDeposit: string; // פקדון משטחים
  customerFolderUrl: string;
  docViewLink: string;
}

/**
 * פונקציה לפורמט הזמנה למבנה JONI המדויק
 */
export const formatOrderForJoni = (data: any): OrderData => {
  return {
    timestamp: data.timestamp || new Date().toLocaleString('he-IL'),
    orderNumber: data.orderNumber || data.id || "",
    customerNumber: data.customerNumber || data.customerId || "",
    customerName: data.customerName || data.customer || "",
    warehouse: data.warehouse || "4 (החרש)",
    deliveryAddress: data.deliveryAddress || data.address || "",
    itemsText: data.itemsText || "פירוט מצורף במסמך",
    blowDeposit: data.depositBags || data.blowDeposit || "תקין",
    palletDeposit: data.depositPallets || data.palletDeposit || "תקין",
    customerFolderUrl: data.customerFolderUrl || "",
    docViewLink: data.docViewLink || ""
  };
};

/**
 * פונקציית סנכרון מרכזית ל-JONI Engine
 * משתמשת ב-POST כדי לעקוף בעיות CORS שנתקלת בהן
 */
export async function syncToJoniSystem(action: 'ADD_ORDER' | 'ADD_DELIVERY_NOTE', data: any) {
  // כתובת ה-Script שביקשת להטמיע
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJDwvb3wPYFoCEVCH_E9Mdco5w_dZeh35KNtCJB8_GdSllt59vV10oWgEA-QaH4S5A/exec";
  
  const payload = {
    action: action,
    data: action === 'ADD_ORDER' ? formatOrderForJoni(data) : data
  };

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      // שימוש ב-no-cors הוא הכרחי מול Google Script כדי למנוע CORS Errors בדפדפן
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    return { success: true };
  } catch (error) {
    console.error("JONI Sync Error:", error);
    return { success: false, error };
  }
}

/**
 * פונקציה להפקת קישור וואטסאפ בהתאם ללוגיקת JONI
 */
export const getJoniWhatsAppLink = (order: OrderData) => {
  const phone = "972508861080";
  const text = `📦 הזמנה ${order.orderNumber} עבור ${order.customerName}\nכתובת: ${order.deliveryAddress}`;
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
};
