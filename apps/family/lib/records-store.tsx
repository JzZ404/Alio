'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { SAMPLE_RECORDS, type MedicalRecord } from '@alio/mock-data';

/**
 * Records store — shared between the Home FAB and the Records tab.
 *
 * The tabs layout unmounts each tab when you switch away from it, so a record
 * added from Home would be lost if the list lived in either page's own state.
 * Holding it here keeps the two screens in sync for the prototype. Swap for the
 * real data layer when persistence lands.
 */
const RecordsContext = createContext<{
  records: MedicalRecord[];
  addRecord: (rec: Omit<MedicalRecord, 'id'>) => void;
} | null>(null);

export function RecordsProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<MedicalRecord[]>(SAMPLE_RECORDS);

  const addRecord = useCallback((rec: Omit<MedicalRecord, 'id'>) => {
    setRecords((prev) => [{ ...rec, id: `r-${Date.now()}` }, ...prev]);
  }, []);

  return (
    <RecordsContext.Provider value={{ records, addRecord }}>
      {children}
    </RecordsContext.Provider>
  );
}

export function useRecords() {
  const ctx = useContext(RecordsContext);
  if (!ctx) throw new Error('useRecords must be used inside <RecordsProvider>');
  return ctx;
}
