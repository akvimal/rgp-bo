/**
 * The small decisions behind the Manage Delivery dialog, kept apart from the component so they can be tested: the time to put in a time box, who
 * delivers, the receiver in one line, and what to send for the cost. See docs/planning/DELIVERY_MANAGE.md.
 */
import { SaleDelivery } from "./models/sale-delivery.model";

const pad = (n: number) => String(n).padStart(2, "0");

/** now, as a datetime-local box wants it: the clock on the wall (local time), not UTC */
export const nowLocalInput = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** a stored time as the box shows it: the first sixteen characters (2026-11-09T16:30), as it was typed, whatever else came with it */
export const wallClock = (v: string | null | undefined): string => (v ? String(v).slice(0, 16).replace(" ", "T") : "");

export type DeliveredBy = "staff" | "courier";
export const deliveredByKind = (d: SaleDelivery): DeliveredBy => (d.deliverymethod === "Courier" ? "courier" : "staff");

/** the receiver in one line, for the summary that replaces three boxes */
export const receiverSummary = (d: SaleDelivery): string => [d.receivername, d.receiverphone, d.receiveraddress].map((x) => (x || "").trim()).filter(Boolean).join(", ");

export const COST_WAYS: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash from the counter" },
  { key: "DIGITAL", label: "Digital (UPI, bank, card)" },
  { key: "UNPAID", label: "Not paid yet" },
  { key: "NONE", label: "No cost" },
  { key: "LINK", label: "Already recorded as an expense" },
];
export const DIGITAL_MODES: { key: string; label: string }[] = [
  { key: "UPI", label: "UPI" }, { key: "BANK", label: "Bank transfer" }, { key: "CARD", label: "Card" }, { key: "CHEQUE", label: "Cheque" },
];

export interface CostChoice { via: string; mode: string; ref: string; linkKind: string; linkId: number | null; adopt: boolean; shiftId?: number | null }

/** what to send as costpaid: nothing when no way was chosen (the cost is left as it is), else the way with what it needs */
export const buildCostPaid = (c: CostChoice): any | undefined => {
  if (!c.via) return undefined;
  if (c.via === "LINK") return c.linkId ? { link: { kind: c.linkKind, id: c.linkId }, adopt: !!c.adopt } : undefined;
  if (c.via === "DIGITAL") return { via: "DIGITAL", mode: c.mode, ref: (c.ref || "").trim() || undefined };
  if (c.via === "CASH") return c.shiftId ? { via: "CASH", shiftid: c.shiftId } : { via: "CASH" };
  return { via: c.via };
};

/** what is still missing before the cost can be saved, in words ('' when nothing) */
export const costProblem = (c: CostChoice, amount: any): string => {
  const n = Number(amount) || 0;
  if (!c.via) return "";
  if ((c.via === "CASH" || c.via === "DIGITAL") && !(n > 0)) return "Enter the cost first.";
  if (c.via === "DIGITAL" && !c.mode) return "Choose how it was paid: UPI, bank transfer, card or cheque.";
  if (c.via === "LINK" && !c.linkId) return "Choose the entry to link.";
  return "";
};

/** the way shown for a delivery that already has its cost recorded ('' when it has none yet) */
export const choiceOf = (d: SaleDelivery): string => (d.costlinked ? "LINK" : d.costpaidvia || "");

export const costLabel = (via: string | null | undefined): string =>
  via === "CASH" ? "Paid in cash" : via === "DIGITAL" ? "Paid digitally" : via === "UNPAID" ? "Cost unpaid" : via === "NONE" ? "No cost" : "";
