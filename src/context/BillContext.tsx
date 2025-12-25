import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { mockApi } from '../services/mockApi';
import { Bill, CreateBillData, UserBillsSummary } from '../types';

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
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const loadBills = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedBills = await mockApi.getAllBills();
      setBills(loadedBills);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserBills = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const userBills = await mockApi.getUserBills(userId);
      setBills(userBills);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error loading user bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBill = useCallback(async (billData: CreateBillData) => {
    try {
      setError(null);
      const newBill = await mockApi.createBill(billData);
      setBills(prev => [...prev, newBill]);
      return newBill;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bill';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const updateBill = useCallback(
    async (billId: string, updates: Partial<Bill>) => {
      try {
        setError(null);
        const updatedBill = await mockApi.updateBill(billId, updates);
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
    [selectedBill]
  );

  const deleteBill = useCallback(
    async (billId: string) => {
      try {
        setError(null);
        await mockApi.deleteBill(billId);
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
    [selectedBill]
  );

  const getBillById = useCallback(async (billId: string) => {
    try {
      setError(null);
      const bill = await mockApi.getBillById(billId);
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
        const updatedBill = await mockApi.updatePaymentStatus(
          billId,
          paymentIndex,
          isPaid
        );
        setBills(prev =>
          prev.map(bill => (bill.id === billId ? updatedBill : bill))
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
      return await mockApi.getUserBillsSummary(userId);
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
