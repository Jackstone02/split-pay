import { BillBreakdownItem } from '../types';

const round2 = (n: number) => parseFloat(n.toFixed(2));

/** One payment waiting for confirmation: a combined (net) payment, or a single-bill payment. */
export interface PendingPaymentGroup {
  key: string;
  /** Set for combined payments; undefined for a single-bill payment. */
  settlementId?: string;
  /** Splits the payer marked as paid. */
  billIds: string[];
  /** Splits of the receiver that this payment cancels out (combined payments only). */
  offsetBillIds: string[];
  /** Net amount the payer sent. */
  amount: number;
  proofUrl?: string;
}

export interface FriendSettlementState {
  /** My open debts to the friend that a new payment would cover. */
  payBillIds: string[];
  /** The friend's open debts to me that a new payment would cancel out. */
  payOffsetBillIds: string[];
  /** Net amount to pay now. Only meaningful when > 0. */
  payAmount: number;
  /** Payments I made that the friend still has to confirm. */
  outgoingPending: PendingPaymentGroup[];
  /** Payments the friend made that I still have to confirm. */
  incomingPending: PendingPaymentGroup[];
}

/**
 * Group pending splits into payments.
 * `paid` are the payer's pending splits, `counter` are the receiver's open splits
 * (candidates for offsets, matched by settlement id).
 */
const groupPending = (paid: BillBreakdownItem[], counter: BillBreakdownItem[]): PendingPaymentGroup[] => {
  const groups = new Map<string, PendingPaymentGroup>();

  paid.forEach(item => {
    const key = item.settlementId ? `s:${item.settlementId}` : `b:${item.billId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        settlementId: item.settlementId,
        billIds: [],
        offsetBillIds: [],
        amount: 0,
        proofUrl: item.proofUrl,
      };
      groups.set(key, group);
    }
    group.billIds.push(item.billId);
    group.amount += item.amount;
    if (!group.proofUrl && item.proofUrl) group.proofUrl = item.proofUrl;
  });

  counter.forEach(item => {
    if (!item.settlementId || item.paymentStatus === 'pending_confirmation') return;
    const group = groups.get(`s:${item.settlementId}`);
    if (group) {
      group.offsetBillIds.push(item.billId);
      group.amount -= item.amount;
    }
  });

  return Array.from(groups.values()).map(g => ({ ...g, amount: round2(g.amount) }));
};

/**
 * Work out what can be paid and what is waiting for confirmation between me and one friend,
 * from the friend's open-bill breakdown (FriendsContext).
 */
export const getFriendSettlementState = (breakdown: BillBreakdownItem[]): FriendSettlementState => {
  const myDebts = breakdown.filter(b => !b.youPaid);
  const theirDebts = breakdown.filter(b => b.youPaid);
  const isPending = (b: BillBreakdownItem) => b.paymentStatus === 'pending_confirmation';

  const outgoingPending = groupPending(myDebts.filter(isPending), theirDebts);
  const incomingPending = groupPending(theirDebts.filter(isPending), myDebts);

  // My debts already cancelled by a payment the friend sent: don't pay them again.
  const coveredByIncoming = new Set(incomingPending.flatMap(g => g.offsetBillIds));
  const coveredByOutgoing = new Set(outgoingPending.flatMap(g => g.offsetBillIds));

  const payItems = myDebts.filter(b => !isPending(b) && !coveredByIncoming.has(b.billId));
  const offsetItems = theirDebts.filter(b => !isPending(b) && !coveredByOutgoing.has(b.billId));

  const payAmount = round2(
    payItems.reduce((s, b) => s + b.amount, 0) - offsetItems.reduce((s, b) => s + b.amount, 0)
  );

  return {
    payBillIds: payItems.map(b => b.billId),
    payOffsetBillIds: offsetItems.map(b => b.billId),
    payAmount,
    outgoingPending,
    incomingPending,
  };
};
