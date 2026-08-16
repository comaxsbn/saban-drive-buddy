from pathlib import Path

code = r'''/**
 * src/lib/saban.functions.ts
 * מודול ניהול לוגיקה, צ'אט נועה וממשק מול Google Sheets / Google Apps Script
 *
 * תיקון:
 * - בוטלה כפילות getOrders
 * - כל הפונקציות מיוצאות פעם אחת בלבד
 * - getOrders מחובר בפועל ל-Google Sheets
 * - createOrder משתמש ב-action createOrder התואם ל-Code.js
 * - עדכון סטטוס תעודה משתמש ב-updateNoteStatus
 * - getDriveFiles מחובר ל-Apps Script
 * - נוספה תמיכה ב-forceFresh
 */

export interface OrderData {
  timestamp?: string;
  orderNumber: string;
  customerNumber?: string;
  customerName: string;
  customerPhone?: string;
  warehouse: string;
  deliveryAddress: string;
  itemsText?: string;
  items?: Array<{
    sku?: string;
    name: string;
    quantity: number;
  }>;
  depositBags?: string | number;
  depositPallets?: string | number;
  customerFolderUrl?: string;
  docViewLink?: string;
  status?: string;
  driver?: string;
  wazeLink?: string;
  driveFolderUrl?: string;
  noaReview?: string;
  totalAmount?: number;
}

export interface NoteData {
  id: string;
  content: string;
  status: string;
  timestamp?: string;
}

const SCRIPT_URL =
  import.meta.env.VITE_GAS_URL ||
  "https://script.google.com/macros/s/AKfycbxaP0WMAEJZu7PkHWFnVFLKfgbgeimbrHQBQ6FYNsqTgsAHCOtw5c555dIqUysnbQFUJw/exec";

/**
 * קריאת GET ל-Google Apps Script.
 */
async function gasGet(
  action: string,
  params: Record<string, string> = {}
): Promise<any> {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Google Apps Script HTTP ${response.status}`
    );
  }

  return await response.json();
}

/**
 * שליחת POST ל-Google Apps Script.
 *
 * text/plain נבחר בכוונה כדי למנוע preflight מיותר בדפדפן.
 * Code.js קורא את e.postData.contents ומפרש JSON.
 */
async function gasPost(
  payload: Record<string, unknown>
): Promise<any> {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `Google Apps Script HTTP ${response.status}`
    );
  }

  const text = await response.text();

  if (!text) {
    return {
      success: true,
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      success: true,
      raw: text,
    };
  }
}

/**
 * שליחת שאלה / הודעה לעוזרת החכמה נועה (Noa AI).
 */
export async function askNoa(
  prompt: string
): Promise<string> {
  if (!prompt.trim()) {
    return "נא להזין שאלה.";
  }

  try {
    const result = await gasPost({
      action: "askNoa",
      prompt: prompt.trim(),
    });

    if (result?.success && result?.answer) {
      return String(result.answer);
    }

    if (result?.message) {
      return String(result.message);
    }

    return "השאלה נשלחה בהצלחה לנועה.";
  } catch (error) {
    console.error("Noa AI Error:", error);
    return "שגיאה בתקשורת עם נועה.";
  }
}

/**
 * המרת ערך למספר בטוח.
 */
function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * המרת ערך למחרוזת בטוחה.
 */
function safeString(
  value: unknown,
  fallback = ""
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).trim() || fallback;
}

/**
 * שליפת כל ההזמנות מהגיליון.
 *
 * Code.js מחזיר:
 * {
 *   success: true,
 *   sheet: "...",
 *   data: [...]
 * }
 *
 * שורת data הראשונה היא כותרות.
 */
export async function getOrders(
  forceFresh = false
): Promise<OrderData[]> {
  try {
    const result = await gasGet(
      "readSheet",
      {
        sheet: "הזמנות",
        ...(forceFresh
          ? { _: String(Date.now()) }
          : {}),
      }
    );

    console.log(
      "🔍 תוצאה שהתקבלה מהגיליון:",
      result
    );

    if (
      !result?.success ||
      !Array.isArray(result.data) ||
      result.data.length <= 1
    ) {
      return [];
    }

    const rows = result.data.slice(1);

    return rows
      .filter(
        (row: unknown) =>
          Array.isArray(row) &&
          row.some(
            (value) =>
              safeString(value) !== ""
          )
      )
      .map(
        (row: unknown[]): OrderData => {
          const r = row as any[];

          /*
           * מבנה נתמך:
           *
           * 0 תאריך ושעה
           * 1 מספר הזמנה
           * 2 לקוח
           * 3 טלפון
           * 4 מחסן
           * 5 יעד
           * 6 פריטים
           * 7 שקי ביג בג
           * 8 משטחים
           * 9 סטטוס
           * 10 נהג
           * 11 Waze
           * 12 קישור Drive
           * 13 נועה AI
           * 14 סה"כ
           */

          const timestamp = safeString(r[0]);
          const orderNumber = safeString(
            r[1],
            `ORD-${Date.now()}`
          );
          const customerName = safeString(
            r[2],
            "לקוח כללי"
          );
          const customerPhone = safeString(r[3]);
          const warehouse = safeString(
            r[4],
            "4(החרש)"
          );
          const deliveryAddress = safeString(r[5]);
          const itemsText = safeString(r[6]);

          const depositBags = safeNumber(r[7]);
          const depositPallets = safeNumber(r[8]);

          const status = safeString(
            r[9],
            "מאושר"
          );
          const driver = safeString(r[10]);

          const wazeLink = safeString(r[11]);
          const driveFolderUrl = safeString(r[12]);
          const noaReview = safeString(r[13]);

          const totalAmount = safeNumber(r[14]);

          return {
            timestamp,
            orderNumber,
            customerNumber: "",
            customerName,
            customerPhone,
            warehouse,
            deliveryAddress,
            itemsText,
            depositBags,
            depositPallets,
            status,
            driver,
            wazeLink,
            driveFolderUrl,
            customerFolderUrl: driveFolderUrl,
            docViewLink: driveFolderUrl,
            noaReview,
            totalAmount,
          };
        }
      );
  } catch (error) {
    console.error(
      "❌ שגיאה בשליפת הזמנות:",
      error
    );

    return [];
  }
}

/**
 * יצירת הזמנה חדשה.
 *
 * תואם ל-Code.js:
 * { action: "createOrder", order: {...} }
 */
export async function createOrder(
  orderData: OrderData
) {
  try {
    return await gasPost({
      action: "createOrder",
      order: {
        orderNumber: orderData.orderNumber,
        customerName: orderData.customerName,
        customerPhone:
          orderData.customerPhone || "",
        warehouse: orderData.warehouse,
        destination:
          orderData.deliveryAddress,
        address:
          orderData.deliveryAddress,
        items:
          orderData.itemsText ||
          orderData.items ||
          "",
        bigBagsDeposit:
          safeNumber(orderData.depositBags),
        palletsDeposit:
          safeNumber(orderData.depositPallets),
        status:
          orderData.status || "מאושר",
        driver:
          orderData.driver || "",
        driveFolderUrl:
          orderData.customerFolderUrl ||
          orderData.driveFolderUrl ||
          "",
        totalAmount:
          safeNumber(orderData.totalAmount),
        noaReview:
          orderData.noaReview || "",
      },
    });
  } catch (error) {
    console.error(
      "❌ שגיאה ביצירת הזמנה:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

/**
 * שליפת הערות / תעודות משלוח.
 */
export async function getNotes(): Promise<NoteData[]> {
  try {
    const result = await gasGet(
      "readSheet",
      {
        sheet: "תעודות_משלוח",
        _: String(Date.now()),
      }
    );

    if (
      !result?.success ||
      !Array.isArray(result.data) ||
      result.data.length <= 1
    ) {
      return [];
    }

    const rows = result.data.slice(1);

    return rows
      .filter(
        (row: unknown) =>
          Array.isArray(row) &&
          row.some(
            (value) =>
              safeString(value) !== ""
          )
      )
      .map(
        (row: unknown[], index): NoteData => {
          const r = row as any[];

          return {
            id: safeString(
              r[1],
              `NOTE-${index + 1}`
            ),
            content: safeString(
              r[8],
              safeString(r[5])
            ),
            status: safeString(
              r[6],
              "פתוח"
            ),
            timestamp: safeString(r[0]),
          };
        }
      );
  } catch (error) {
    console.error(
      "❌ שגיאה בשליפת הערות:",
      error
    );

    return [];
  }
}

/**
 * עדכון סטטוס תעודת משלוח.
 */
export async function updateNoteStatus(
  noteId: string,
  status: string
) {
  try {
    return await gasPost({
      action: "updateNoteStatus",
      noteNumber: noteId,
      status,
    });
  } catch (error) {
    console.error(
      "❌ שגיאה בעדכון סטטוס הערה:",
      error
    );

    return {
      success: false,
      noteId,
      status,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

/**
 * שליפת קבצי Drive.
 */
export async function getDriveFiles(
  folderId?: string
) {
  try {
    return await gasGet(
      "listFiles",
      folderId
        ? { folderId }
        : {}
    );
  } catch (error) {
    console.error(
      "❌ שגיאה בשליפת קבצי Drive:",
      error
    );

    return {
      success: false,
      files: [],
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

/**
 * סנכרון כללי מול Google Apps Script.
 *
 * נשמרת הפונקציה כדי לא לשבור קוד קיים
 * שקורא לה ממקומות אחרים במערכת.
 */
export async function syncToJoniSystem(
  action: string,
  data: any
) {
  try {
    /*
     * תאימות לאחור:
     * ADD_ORDER הישן הופך ל-createOrder החדש.
     */
    if (action === "ADD_ORDER") {
      return await createOrder(
        data as OrderData
      );
    }

    return await gasPost({
      action,
      ...(data &&
      typeof data === "object"
        ? data
        : { data }),
    });
  } catch (error) {
    console.error(
      "Sync Error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}
'''

path = Path("/mnt/data/saban.functions.ts")
path.write_text(code, encoding="utf-8")

# Basic structural checks.
text = path.read_text(encoding="utf-8")
print("Created:", path)
print("Lines:", len(text.splitlines()))
print("getOrders declarations:", text.count("export async function getOrders"))
print("createOrder declarations:", text.count("export async function createOrder"))
