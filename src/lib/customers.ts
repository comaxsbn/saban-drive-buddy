import type { DeliveryNote, Order } from "./saban-config";

export type CustomerFile = {
  key: string;
  name: string;
  customerId: string;
  address: string;
  orders: Order[];
  notes: DeliveryNote[];
  bigBags: number;
  pallets: number;
  lastActivity: string;
};

const num = (v: string) => {
  const m = (v || "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

export const normalizeName = (n: string) =>
  (n || "")
    .replace(/\(\d+\)/g, "")
    .replace(/[־–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function buildCustomers(orders: Order[], notes: DeliveryNote[]): CustomerFile[] {
  const map = new Map<string, CustomerFile>();

  const ensure = (name: string): CustomerFile => {
    const key = normalizeName(name);
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name: key,
        customerId: "",
        address: "",
        orders: [],
        notes: [],
        bigBags: 0,
        pallets: 0,
        lastActivity: "",
      };
      map.set(key, c);
    }
    return c;
  };

  for (const o of orders) {
    if (!o.customer) continue;
    const c = ensure(o.customer);
    c.orders.push(o);
    c.address ||= o.address;
    c.customerId ||= o.customer.match(/\((\d+)\)/)?.[1] ?? "";
    if (o.receivedAt > c.lastActivity) c.lastActivity = o.receivedAt;
  }

  for (const n of notes) {
    if (!n.customer) continue;
    const c = ensure(n.customer);
    c.notes.push(n);
    c.address ||= n.address;
    c.customerId ||= n.customerId;
    c.bigBags += num(n.bigBagDeposit);
    c.pallets += num(n.palletDeposit);
    if (n.datetime > c.lastActivity) c.lastActivity = n.datetime;
  }

  return [...map.values()].sort((a, b) => b.notes.length + b.orders.length - (a.notes.length + a.orders.length));
}