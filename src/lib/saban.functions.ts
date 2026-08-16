/**
 * ============================================================================
 * Saban-Drive-Buddy / SabanOS Business Logic & Operational Functions
 * File: saban.functions.ts
 * Description: Production-Ready Dispatch, Reconciliation, Inventory & Customer Engine
 * ============================================================================
 */

import { sabanServer } from './saban.server';

// ============================================================================
// הגדרות קבועות ומבנה נתונים
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

export const DEPOSIT_SKUS = {
  BIG_BAG: '60002', // שק גדול פקדון (בלה)
  PALLET: '60006',  // משטח בלוקים פקדון
};

export const WAREHOUSE_LOCATIONS: Record<string, string> = {
  'החרש': 'החרש 4, הוד השרון',
  '4(החרש)': 'החרש 4, הוד השרון',
  'התלמיד': 'התלמיד 6, הוד השרון',
  '1(התלמיד)': 'התלמיד 6, הוד השרון',
  'DEFAULT': 'החרש 4, הוד השרון',
};

export interface OrderRecord {
  orderNumber: string;
  dateTime: string;
  customerName: string;
  customerPhone: string;
  warehouse: string;
  destination: string;
  itemsText: string;
  bigBagsDeposit: number;
  palletsDeposit: number;
  status: 'ממתין' | 'בליקוט' | 'בשינוע' | 'סופק' | 'מבוטל';
  etaDistance?: string;
  wazeLink?: string;
  driveFolderUrl?: string;
  noaReview?: string;
  syncStatus?: string;
}

export interface DeliveryNoteRecord {
  documentNumber: string;
  documentDate: string;
  relatedOrderNumber: string;
  customerName: string;
  driverName: string;
  deliveredItemsText: string;
  bigBagsSupplied: number;
  palletsSupplied: number;
  matchStatus: string;
  fileUrl: string;
  notes: string;
}

export interface ReconciliationReport {
  orderNumber: string;
  documentNumber: string;
  customerName: string;
  isPerfectMatch: boolean;
  itemDiscrepancies: Array<{
    sku: string;
    itemName: string;
    orderedQty: number;
    deliveredQty: number;
    delta: number;
  }>;
  depositDiscrepancies: {
    bigBags: { ordered: number; supplied: number; delta: number };
    pallets: { ordered: number; supplied: number; delta: number };
  };
  reconciliationStatus: string;
}

export interface DriverInfo {
  driverId: string;
  name: string;
  phone: string;
  vehicleType: 'משאית' | 'מנוף';
  plateNumber: string;
  currentStatus: 'פנוי' | 'בנסיעה' | 'בפריקה' | 'לא פעיל';
  lastLocation?: string;
}

// ============================================================================
// 1. שירות הזמנות (Orders Service)
// ============================================================================

export class OrdersService {
  /**
   * שליפת כל ההזמנות מגיליון המערכת עם המרה למבנה נתונים מסודר
   */
  public static async getAllOrders(forceFresh = false): Promise<OrderRecord[]> {
    const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.ORDERS_LOG, undefined, forceFresh);
    if (raw.length <= 1) return [];

    const rows = raw.slice(1);
    return rows.map((r) => ({
      dateTime: r[0] || '',
      orderNumber: String(r[1] || '').trim(),
      customerName: r[2] || '',
      customerPhone: r[3] || '',
      warehouse: r[4] || 'החרש',
      destination: r[5] || '',
      itemsText: r[6] || '',
      bigBagsDeposit: Number(r[7]) || 0,
      palletsDeposit: Number(r[8]) || 0,
      status: (r[9] as any) || 'ממתין',
      etaDistance: r[10] || '',
      wazeLink: r[11] || '',
      driveFolderUrl: r[12] || '',
      noaReview: r[13] || '',
      syncStatus: r[14] || '',
    }));
  }

  /**
   * קבלת הזמנה ספציפית לפי מספר
   */
  public static async getOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
    const orders = await this.getAllOrders();
    const cleanNumber = String(orderNumber).trim();
    return orders.find((o) => o.orderNumber === cleanNumber) || null;
  }

  /**
   * יצירת הזמנה חדשה עם Onboarding אוטומטי ללקוח וסנכרון תור
   */
  public static async createOrder(order: OrderRecord): Promise<void> {
    const wazeLink = order.destination
      ? `https://waze.com/ul?q=${encodeURIComponent(order.destination)}`
      : '';

    const row = [
      order.dateTime || new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      order.warehouse,
      order.destination,
      order.itemsText,
      order.bigBagsDeposit,
      order.palletsDeposit,
      order.status || 'ממתין',
      order.etaDistance || '',
      wazeLink,
      order.driveFolderUrl || '',
      order.noaReview || 'עובד בהצלחה על ידי נועה AI',
      'סונכרן ל-Sheets',
    ];

    await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.ORDERS_LOG, row);

    // עדכון כרטיס לקוח ברקע
    if (order.customerPhone) {
      await CustomerService.touchCustomerRecord(order.customerName, order.customerPhone, order.destination);
    }
  }

  /**
   * עדכון סטטוס הזמנה מהיר (מוגן מפני עומסים וקונפליקטים)
   */
  public static async updateOrderStatus(orderNumber: string, newStatus: OrderRecord['status'], notes?: string): Promise<void> {
    const existing = await this.getOrderByNumber(orderNumber);
    if (!existing) {
      throw new Error(`הזמנה ${orderNumber} לא נמצאה בגיליון.`);
    }

    const updatedRow = [
      existing.dateTime,
      existing.orderNumber,
      existing.customerName,
      existing.customerPhone,
      existing.warehouse,
      existing.destination,
      existing.itemsText,
      existing.bigBagsDeposit,
      existing.palletsDeposit,
      newStatus,
      existing.etaDistance,
      existing.wazeLink,
      existing.driveFolderUrl,
      notes ? `${existing.noaReview || ''} | ${notes}` : existing.noaReview,
      `מעודכן (${new Date().toLocaleTimeString('he-IL')})`,
    ];

    await sabanServer.updateRowByIdentifierQueued(
      SABAN_SHEET_NAMES.ORDERS_LOG,
      'מספר הזמנה',
      orderNumber,
      updatedRow
    );
  }
}

// ============================================================================
// 2. שירות הצלבה ובקרת סטיות (Reconciliation Engine)
// ============================================================================

export class ReconciliationService {
  /**
   * הצלבה מדויקת בין הזמנת קומקס לתעודת משלוח סרוקה
   */
  public static async reconcileOrderWithDeliveryNote(
    orderNumber: string,
    deliveryNote: DeliveryNoteRecord
  ): Promise<ReconciliationReport> {
    const order = await OrdersService.getOrderByNumber(orderNumber);
    if (!order) {
      throw new Error(`לא ניתן להצליב: הזמנה ${orderNumber} לא קיימת.`);
    }

    const orderedItems = this.parseItemList(order.itemsText);
    const suppliedItems = this.parseItemList(deliveryNote.deliveredItemsText);

    const discrepancies: ReconciliationReport['itemDiscrepancies'] = [];
    let perfectMatch = true;

    // השוואת פריטים לפי מק"ט ושם
    for (const [key, ordItem] of orderedItems.entries()) {
      const supItem = suppliedItems.get(key);
      const suppliedQty = supItem ? supItem.qty : 0;
      const delta = suppliedQty - ordItem.qty;

      if (delta !== 0) {
        perfectMatch = false;
      }

      discrepancies.push({
        sku: ordItem.sku,
        itemName: ordItem.name,
        orderedQty: ordItem.qty,
        deliveredQty: suppliedQty,
        delta,
      });
    }

    // פער בפקדונות
    const bigBagsDelta = deliveryNote.bigBagsSupplied - order.bigBagsDeposit;
    const palletsDelta = deliveryNote.palletsSupplied - order.palletsDeposit;

    if (bigBagsDelta !== 0 || palletsDelta !== 0) {
      perfectMatch = false;
    }

    const report: ReconciliationReport = {
      orderNumber,
      documentNumber: deliveryNote.documentNumber,
      customerName: order.customerName,
      isPerfectMatch: perfectMatch && discrepancies.every((d) => d.delta === 0),
      itemDiscrepancies: discrepancies,
      depositDiscrepancies: {
        bigBags: { ordered: order.bigBagsDeposit, supplied: deliveryNote.bigBagsSupplied, delta: bigBagsDelta },
        pallets: { ordered: order.palletsDeposit, supplied: deliveryNote.palletsSupplied, delta: palletsDelta },
      },
      reconciliationStatus: perfectMatch ? '✅ אספקה מאומתת מלאה' : '⚠️ קיימת סטייה / שינוי פקדון',
    };

    // תיעוד בטאב בקרת סטיות והצלבות
    await this.logReconciliationRow(report);

    return report;
  }

  private static async logReconciliationRow(report: ReconciliationReport): Promise<void> {
    for (const item of report.itemDiscrepancies) {
      const row = [
        report.orderNumber,
        report.documentNumber,
        report.customerName,
        item.sku,
        item.itemName,
        item.orderedQty,
        item.deliveredQty,
        item.delta,
        item.delta === 0 ? '✅ תואם' : item.delta > 0 ? `⚠️ עודף (+${item.delta})` : `❌ חסר (${item.delta})`,
        report.reconciliationStatus,
      ];
      await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.RECONCILIATION, row);
    }
  }

  private static parseItemList(text: string): Map<string, { sku: string; name: string; qty: number }> {
    const map = new Map<string, { sku: string; name: string; qty: number }>();
    if (!text) return map;

    const parts = text.split(/,|\n|;/);
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;

      // חיפוש תבנית: שם פריט (כמות) או מק"ט
      const match = clean.match(/^(.*?)\s*\((\d+)\)/);
      if (match) {
        const name = match[1].trim();
        const qty = parseInt(match[2], 10);
        map.set(name, { sku: '', name, qty });
      } else {
        map.set(clean, { sku: '', name: clean, qty: 1 });
      }
    }
    return map;
  }
}

// ============================================================================
// 3. שירות לקוחות ו-CRM (Customer Service)
// ============================================================================

export class CustomerService {
  public static async touchCustomerRecord(name: string, phone: string, address: string): Promise<void> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const customerId = `CUST-${cleanPhone.slice(-4) || 'SBN'}`;

    const raw = await sabanServer.getSheetValues(SABAN_SHEET_NAMES.CUSTOMERS);
    const existing = raw.find((r) => String(r[2]).replace(/[^0-9]/g, '') === cleanPhone);

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
      const newRow = [
        customerId,
        name,
        phone,
        name,
        address,
        1,
        '',
        'לקוח חדש',
      ];
      await sabanServer.appendRowQueued(SABAN_SHEET_NAMES.CUSTOMERS, newRow);
    }
  }
}

// ============================================================================
// 4. שירות שיגור ונהגים חכם (Smart Dispatch Engine)
// ============================================================================

export class DispatchService {
  /**
   * רשימת נהגי סבן קבועה והתאמת כלי רכב
   */
  public static readonly FLEET_DRIVERS: DriverInfo[] = [
    { driverId: 'ali', name: 'עלי', phone: '050-0000001', vehicleType: 'משאית', plateNumber: '615-41-001', currentStatus: 'פנוי' },
    { driverId: 'hikmat', name: 'חכמת', phone: '050-0000002', vehicleType: 'מנוף', plateNumber: '615-41-002', currentStatus: 'פנוי' },
  ];

  /**
   * המלצה אוטומטית על נהג וכלי רכב בהתאם לסוג הפריטים בהזמנה
   */
  public static recommendDriverForOrder(order: OrderRecord): { driver: DriverInfo; reason: string } {
    const isCraneRequired =
      order.itemsText.includes('מנוף') ||
      order.itemsText.includes('בלוק') ||
      order.itemsText.includes('משטח') ||
      order.bigBagsDeposit > 0 ||
      order.palletsDeposit > 0;

    if (isCraneRequired) {
      const craneDriver = this.FLEET_DRIVERS.find((d) => d.vehicleType === 'מנוף') || this.FLEET_DRIVERS[1];
      return {
        driver: craneDriver,
        reason: 'ההזמנה כוללת עבודת מנוף, פריקת משטחים או שקים גדולים (בלות).',
      };
    }

    const truckDriver = this.FLEET_DRIVERS.find((d) => d.vehicleType === 'משאית') || this.FLEET_DRIVERS[0];
    return {
      driver: truckDriver,
      reason: 'אספקת חומרים קלים/יבשים ללא צורך במנוף.',
    };
  }
}
