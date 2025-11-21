import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { LspManager } from '../services/lsp';

interface LspContextValue {
  manager: LspManager;
  activeLsps: string[];
  setActiveLsps: (lsps: string[]) => void;
}

const LspContext = createContext<LspContextValue | null>(null);

export function LspProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<LspManager>(new LspManager());
  const [activeLsps, setActiveLspsState] = useState<string[]>([]);
  
  const setActiveLsps = useCallback((lsps: string[]) => {
    setActiveLspsState(lsps);
  }, []);
  
  return (
    <LspContext.Provider value={{ 
      manager: managerRef.current,
      activeLsps,
      setActiveLsps
    }}>
      {children}
    </LspContext.Provider>
  );
}

export function useLsp() {
  const context = useContext(LspContext);
  if (!context) {
    throw new Error('useLsp must be used within LspProvider');
  }
  return context;
}

