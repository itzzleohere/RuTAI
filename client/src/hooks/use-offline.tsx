import { useState, useEffect, useCallback } from 'react';

// Define types for our offline data
export interface OfflineCaseData {
  id: string; // Temporary ID for offline cases
  data: any;
  status: 'pending' | 'synced';
  createdAt: string;
  updatedAt: string;
}

export function useOffline() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCases, setPendingCases] = useState<OfflineCaseData[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Update online status when network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // When we come back online, attempt to sync
      syncOfflineData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Load offline cases from localStorage on init
  useEffect(() => {
    const storedCases = localStorage.getItem('offlineCases');
    if (storedCases) {
      try {
        setPendingCases(JSON.parse(storedCases));
      } catch (error) {
        console.error('Error loading offline cases:', error);
        // If there's an error parsing, reset the storage
        localStorage.removeItem('offlineCases');
      }
    }
  }, []);
  
  // Save a case offline
  const saveOfflineCase = useCallback((caseData: any) => {
    // Generate a temporary ID for offline cases
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const offlineCase: OfflineCaseData = {
      id: tempId,
      data: caseData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setPendingCases(prevCases => {
      const newCases = [...prevCases, offlineCase];
      // Save to localStorage
      localStorage.setItem('offlineCases', JSON.stringify(newCases));
      return newCases;
    });
    
    return offlineCase;
  }, []);
  
  // Sync offline data with the server when back online
  const syncOfflineData = useCallback(async () => {
    if (!isOnline || pendingCases.length === 0 || isSyncing) {
      return;
    }
    
    setIsSyncing(true);
    setSyncError(null);
    
    try {
      // Clone the pending cases to work with
      const casesToSync = [...pendingCases];
      const successfulSyncs: string[] = [];
      
      for (const offlineCase of casesToSync) {
        try {
          // Attempt to sync with server
          const response = await fetch('/api/cases/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(offlineCase.data),
          });
          
          if (response.ok) {
            successfulSyncs.push(offlineCase.id);
          } else {
            console.error(`Failed to sync case ${offlineCase.id}: ${response.statusText}`);
          }
        } catch (error) {
          console.error(`Error syncing case ${offlineCase.id}:`, error);
          // Continue with other cases even if one fails
        }
      }
      
      // Remove successfully synced cases
      if (successfulSyncs.length > 0) {
        setPendingCases(prevCases => {
          const updatedCases = prevCases.filter(c => !successfulSyncs.includes(c.id));
          localStorage.setItem('offlineCases', JSON.stringify(updatedCases));
          return updatedCases;
        });
      }
      
      if (successfulSyncs.length < casesToSync.length) {
        setSyncError(`Failed to sync ${casesToSync.length - successfulSyncs.length} cases. Will retry later.`);
      }
    } catch (error) {
      console.error('Error during sync process:', error);
      setSyncError('Sync failed due to an error. Will retry later.');
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, pendingCases, isSyncing]);
  
  // Get all offline cases
  const getOfflineCases = useCallback(() => {
    return pendingCases;
  }, [pendingCases]);
  
  // Update an existing offline case
  const updateOfflineCase = useCallback((id: string, updatedData: any) => {
    setPendingCases(prevCases => {
      const caseIndex = prevCases.findIndex(c => c.id === id);
      
      if (caseIndex === -1) {
        return prevCases;
      }
      
      const updatedCases = [...prevCases];
      updatedCases[caseIndex] = {
        ...updatedCases[caseIndex],
        data: {
          ...updatedCases[caseIndex].data,
          ...updatedData
        },
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem('offlineCases', JSON.stringify(updatedCases));
      return updatedCases;
    });
  }, []);
  
  // Delete an offline case
  const deleteOfflineCase = useCallback((id: string) => {
    setPendingCases(prevCases => {
      const updatedCases = prevCases.filter(c => c.id !== id);
      localStorage.setItem('offlineCases', JSON.stringify(updatedCases));
      return updatedCases;
    });
  }, []);
  
  // Manually trigger synchronization
  const triggerSync = useCallback(() => {
    if (isOnline) {
      return syncOfflineData();
    }
    return Promise.reject('Currently offline');
  }, [isOnline, syncOfflineData]);
  
  return {
    isOnline,
    pendingCases,
    isSyncing,
    syncError,
    saveOfflineCase,
    getOfflineCases,
    updateOfflineCase,
    deleteOfflineCase,
    triggerSync
  };
}