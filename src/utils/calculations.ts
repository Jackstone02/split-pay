import { Split, Bill, ValidationResult, BillItem, UserBalance } from '../types';

/**
 * Calculate equal split for all participants
 */
export const calculateEqualSplit = (total: number, participantCount: number): number => {
  if (participantCount === 0) return 0;
  return parseFloat((total / participantCount).toFixed(2));
};

/**
 * Generate equal splits for all participants
 * The last participant absorbs any rounding difference to ensure the total matches exactly
 */
export const generateEqualSplits = (total: number, participantIds: string[]): Split[] => {
  if (participantIds.length === 0) return [];

  const amountPerPerson = calculateEqualSplit(total, participantIds.length);
  const splits = participantIds.map(id => ({
    userId: id,
    amount: amountPerPerson,
  }));

  // Adjust the last split to account for rounding errors
  const currentTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  const difference = parseFloat((total - currentTotal).toFixed(2));

  if (difference !== 0 && splits.length > 0) {
    splits[splits.length - 1].amount = parseFloat((splits[splits.length - 1].amount + difference).toFixed(2));
  }

  return splits;
};

/**
 * Validate custom splits
 */
export const validateCustomSplit = (
  splits: Split[],
  total: number
): ValidationResult => {
  const splitTotal = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
  const roundedTotal = parseFloat(splitTotal.toFixed(2));
  const expectedTotal = parseFloat(total.toFixed(2));

  if (roundedTotal !== expectedTotal) {
    return {
      isValid: false,
      error: `Total must equal ${expectedTotal}. Current total: ${roundedTotal}`,
      total: roundedTotal,
    };
  }

  return {
    isValid: true,
    error: null,
    total: roundedTotal,
  };
};

/**
 * Validate percentage split
 */
export const validatePercentageSplit = (splits: Split[]): ValidationResult => {
  const total = splits.reduce((sum, split) => sum + (split.percentage || 0), 0);
  const roundedTotal = parseFloat(total.toFixed(2));

  if (Math.abs(roundedTotal - 100) > 0.01) {
    return {
      isValid: false,
      error: `Percentages must total 100%. Current total: ${roundedTotal}%`,
      total: roundedTotal,
    };
  }

  return {
    isValid: true,
    error: null,
    total: roundedTotal,
  };
};

/**
 * Calculate amounts from percentages
 */
export const calculatePercentageSplit = (
  total: number,
  splits: Split[]
): Split[] => {
  return splits.map(split => ({
    ...split,
    amount: parseFloat((total * (split.percentage || 0) / 100).toFixed(2)),
  }));
};

/**
 * Calculate item-based split
 */
export const calculateItemBasedSplit = (
  items: BillItem[],
  participantIds: string[]
): Split[] => {
  const splits: Record<string, number> = {};

  // Initialize all participants with 0
  participantIds.forEach(id => {
    splits[id] = 0;
  });

  // Add item prices to assigned participants
  items.forEach(item => {
    if (item.assignedTo && item.assignedTo.length > 0) {
      const pricePerPerson = item.price / item.assignedTo.length;
      item.assignedTo.forEach(userId => {
        if (splits && splits[userId] !== undefined) {
          splits[userId] += pricePerPerson;
        }
      });
    }
  });

  // Convert to array and round
  return Object.entries(splits).map(([userId, amount]) => ({
    userId,
    amount: parseFloat(amount.toFixed(2)),
  }));
};

/**
 * Generate payment graph - who owes whom
 * Now considers settled status and payment confirmation status from bill_splits table
 */
export const generatePaymentGraph = (bill: Partial<Bill>) => {
  const { paidBy, splits } = bill;
  const payments = [];

  if (!paidBy || !splits) return payments;

  splits.forEach(split => {
    if (split.userId !== paidBy && split.amount > 0) {
      payments.push({
        fromUserId: split.userId,
        toUserId: paidBy,
        amount: parseFloat(split.amount.toFixed(2)),
        isPaid: split.settled || false,
        paidAt: split.settledAt,
        paymentStatus: split.paymentStatus || 'unpaid',
        markedPaidAt: split.markedPaidAt,
      });
    }
  });

  return payments;
};

/**
 * Calculate summary for a user's bills
 * Only counts unsettled (unpaid) splits
 */
export const calculateUserBalance = (bills: Bill[], userId: string): UserBalance => {
  let totalOwed = 0;
  let totalOwing = 0;

  bills.forEach(bill => {
    // Add to totalOwed if user paid
    if (bill.paidBy === userId) {
      bill.splits.forEach(split => {
        // Only count unsettled splits
        if (split.userId !== userId && !split.settled) {
          totalOwed += split.amount;
        }
      });
    }

    // Add to totalOwing if user is participant
    const userSplit = bill.splits.find(s => s.userId === userId);
    if (userSplit && bill.paidBy !== userId && !userSplit.settled) {
      totalOwing += userSplit.amount;
    }
  });

  return {
    totalOwed: parseFloat(totalOwed.toFixed(2)),
    totalOwing: parseFloat(totalOwing.toFixed(2)),
    balance: parseFloat((totalOwed - totalOwing).toFixed(2)),
  };
};
