import { queryOptions } from "@tanstack/react-query";
import { getNotes, getOrders, getDriveFiles } from "./saban.functions";

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: () => getOrders(),
  staleTime: 60_000,
});

export const notesQuery = queryOptions({
  queryKey: ["notes"],
  queryFn: () => getNotes(),
  staleTime: 60_000,
});

export const driveQuery = (folder: "scans" | "customers", search?: string) =>
  queryOptions({
    queryKey: ["drive", folder, search ?? ""],
    queryFn: () => getDriveFiles({ data: { folder, search } }),
    staleTime: 120_000,
  });