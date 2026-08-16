export const SHEETS = {
  orders: "16gvy_W6JHWjcLC7eKA4CKqq_RHQpLeRpkC_Fd1bj5Ps",
  notes: "15MdpPh1uwknscBSI_I5WALvXY-jvqdpO63b8zw5gi3Y",
  dashboard: "1NZf_bH4Xl2RfA8AoBk_hFh8nlg3_WQP0BHjA3BQPXUE",
} as const;

export const ORDERS_TAB = "הזמנות";
export const NOTES_TAB = "Untitled";

export const DRIVE = {
  scans: "1Hnq5RjGmE0368ZCAKBratRJGzaj0wJJl",
  customers: "1dcQ4TfEZzIOvGLqK3arRiVpyU2l6UM7jcvS1QW_b3Lg",
} as const;

export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;

export type Order = {
  row: number;
  receivedAt: string;
  orderNumber: string;
  customer: string;
  warehouse: string;
  address: string;
  items: string;
  bigBagDeposit: string;
  palletDeposit: string;
};

export type DeliveryNote = {
  row: number;
  serial: string;
  sourceFile: string;
  noteNumber: string;
  datetime: string;
  customer: string;
  customerId: string;
  address: string;
  driver: string;
  orderNumber: string;
  craneTimes: string;
  waitTimes: string;
  bigBagDeposit: string;
  palletDeposit: string;
  returns: string;
  warehouseApproval: string;
  goods: string;
  totalUnits: string;
  status: string;
  notes: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

export function statusTone(status: string): "ok" | "warn" | "bad" | "neutral" {
  const s = status || "";
  if (s.includes("❌") || s.includes("סטורנו") || s.includes("חסר")) return "bad";
  if (s.includes("⚠") || s.includes("חוסר") || s.includes("פטור") || s.includes("ℹ")) return "warn";
  if (s.includes("✅") || s.includes("מאושר") || s.includes("חתום")) return "ok";
  return "neutral";
}

export function parseItems(raw: string) {
  return (raw || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sku = line.match(/מק"ט:\s*(\d+)/)?.[1] ?? "";
      const qty = line.match(/כמות:\s*([\d.]+)/)?.[1] ?? "";
      const name =
        line
          .replace(/^\d+\.\s*/, "")
          .replace(/📦\s*/, "")
          .replace(/מק"ט:\s*\d+\s*\|?\s*/, "")
          .replace(/\|\s*כמות:\s*[\d.]+/, "")
          .trim() || line;
      return { sku, qty, name };
    });
}

export function wazeUrl(address: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}
