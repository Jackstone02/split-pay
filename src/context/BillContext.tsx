import React, { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import { supabaseApi } from '../services/supabaseApi';
import { Bill, CreateBillData, UserBillsSummary } from '../types';
import { AuthContext } from './AuthContext';

interface BillContextType {
  bills: Bill[];
  selectedBill: Bill | null;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loadBills: () => Promise<void>;
  loadUserBills: (userId: string) => Promise<void>;
  createBill: (billData: CreateBillData) => Promise<Bill>;
  updateBill: (billId: string, updates: Partial<Bill>) => Promise<Bill>;
  deleteBill: (billId: string) => Promise<{ success: boolean }>;
  getBillById: (billId: string) => Promise<Bill | null>;
  updatePaymentStatus: (billId: string, paymentIndex: number, isPaid: boolean) => Promise<Bill>;
  getSummary: (userId: string) => Promise<UserBillsSummary | null>;
}

export const BillContext = createContext<BillContextType | undefined>(undefined);

interface BillProviderProps {
  children: ReactNode;
}

export const BillProvider: React.FC<BillProviderProps> = ({ children }) => {
  const authContext = useContext(AuthContext);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const loadBills = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!authContext?.user?.id) {
        throw new Error('User not authenticated');
      }
      const loadedBills = await supabaseApi.getBills(authContext.user.id);
      setBills(loadedBills);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authContext?.user?.id]);

  const loadUserBills = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const userBills = await supabaseApi.getBills(userId);
      setBills(userBills);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading user bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBill = useCallback(async (billData: CreateBillData & { groupId?: string }) => {
    try {
      setError(null);
      if (!authContext?.user?.id) {
        throw new Error('User not authenticated');
      }
      const newBill = await supabaseApi.createBill(billData, authContext.user.id, billData.groupId);
      setBills(prev => [...prev, newBill]);
      return newBill;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bill';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [authContext?.user?.id]);

  const updateBill = useCallback(
    async (billId: string, updates: Partial<Bill>) => {
      try {
        setError(null);
        if (!authContext?.user?.id) {
          throw new Error('User not authenticated');
        }
        // Convert updates to CreateBillData format for the API
        const billData: CreateBillData = {
          title: updates.title || '',
          totalAmount: updates.totalAmount || 0,
          paidBy: updates.paidBy || authContext.user.id,
          participants: updates.participants || [],
          splitMethod: updates.splitMethod || 'equal',
          splits: updates.splits || [],
          description: updates.description,
        };
        const updatedBill = await supabaseApi.updateBill(billId, billData, authContext.user.id);
        setBills(prev =>
          prev.map(bill => (bill.id === billId ? updatedBill : bill))
        );
        if (selectedBill?.id === billId) {
          setSelectedBill(updatedBill);
        }
        return updatedBill;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update bill';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedBill, authContext?.user?.id]
  );

  const deleteBill = useCallback(
    async (billId: string) => {
      try {
        setError(null);
        if (!authContext?.user?.id) {
          throw new Error('User not authenticated');
        }
        await supabaseApi.deleteBill(billId, authContext.user.id);
        setBills(prev => prev.filter(bill => bill.id !== billId));
        if (selectedBill?.id === billId) {
          setSelectedBill(null);
        }
        return { success: true };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete bill';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedBill, authContext?.user?.id]
  );

  const getBillById = useCallback(async (billId: string) => {
    try {
      setError(null);
      const bill = await supabaseApi.getBillById(billId);
      setSelectedBill(bill);
      return bill;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error getting bill:', err);
      return null;
    }
  }, []);

  const updatePaymentStatus = useCallback(
    async (billId: string, paymentIndex: number, isPaid: boolean) => {
      try {
        setError(null);

        // First, get the bill to find payment details
        const bill = await supabaseApi.getBillById(billId);
        if (!bill) {
          throw new Error('Bill not found');
        }

        // Get the payment at the specified index
        const payment = bill.payments[paymentIndex];
        if (!payment) {
          throw new Error('Payment not found');
        }

        // Mark or unmark payment based on isPaid flag
        if (isPaid && !payment.isPaid) {
          // Mark as paid
          await supabaseApi.markBillPaymentAsPaid(
            billId,
            payment.fromUserId,
            payment.toUserId,
            payment.amount,
            'manual'
          );
        } else if (!isPaid && payment.isPaid) {
          // Unmark payment (undo)
          await supabaseApi.unmarkBillPayment(
            billId,
            payment.fromUserId
          );
        }

        // Reload the bill to get updated settled status
        const updatedBill = await supabaseApi.getBillById(billId);
        if (!updatedBill) {
          throw new Error('Failed to reload bill');
        }

        // Update the bill in local state
        setBills(prev =>
          prev.map(b => (b.id === billId ? updatedBill : b))
        );
        if (selectedBill?.id === billId) {
          setSelectedBill(updatedBill);
        }
        return updatedBill;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update payment status';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [selectedBill]
  );

  const getSummary = useCallback(async (userId: string) => {
    try {
      setError(null);
      // Get all bills for the user
      const userBills = await supabaseApi.getBills(userId);

      // Calculate summary from bills
      let totalOwed = 0; // What others owe this user (unpaid)
      let totalOwing = 0; // What this user owes others (unpaid)
      let totalSettled = 0; // Total amount settled/paid

      userBills.forEach(bill => {
        bill.splits.forEach(split => {
          if (split.userId === userId && bill.paidBy !== userId) {
            // This user owes the payer
            if (split.settled) {
              totalSettled += split.amount;
            } else {
              totalOwing += split.amount;
            }
          } else if (bill.paidBy === userId && split.userId !== userId) {
            // Someone owes this user
            if (!split.settled) {
              totalOwed += split.amount;
            }
          }
        });
      });

      return {
        totalOwed,
        totalOwing,
        totalSettled,
        balance: totalOwed - totalOwing,
        billCount: userBills.length,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error getting summary:', err);
      return null;
    }
  }, []);

  const value: BillContextType = {
    bills,
    selectedBill,
    isLoading,
    error,
    setError,
    loadBills,
    loadUserBills,
    createBill,
    updateBill,
    deleteBill,
    getBillById,
    updatePaymentStatus,
    getSummary,
  };

  return (
    <BillContext.Provider value={value}>
      {children}
    </BillContext.Provider>
  );
};
