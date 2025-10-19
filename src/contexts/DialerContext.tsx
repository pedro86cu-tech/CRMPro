import { createContext, useContext, useRef } from 'react';

interface DialerContextType {
  openDialerWithNumber: (phoneNumber: string) => void;
  registerDialer: (handler: (phoneNumber: string) => void) => void;
  initiateCall: (phoneNumber: string, contactName?: string) => void;
}

const DialerContext = createContext<DialerContextType | undefined>(undefined);

export function DialerProvider({ children }: { children: React.ReactNode }) {
  const dialerHandlerRef = useRef<((phoneNumber: string) => void) | null>(null);

  const registerDialer = (handler: (phoneNumber: string) => void) => {
    dialerHandlerRef.current = handler;
  };

  const openDialerWithNumber = (phoneNumber: string) => {
    if (dialerHandlerRef.current) {
      dialerHandlerRef.current(phoneNumber);
    }
  };

  const initiateCall = (phoneNumber: string, contactName?: string) => {
    if (dialerHandlerRef.current) {
      dialerHandlerRef.current(phoneNumber);
    }
  };

  return (
    <DialerContext.Provider value={{ openDialerWithNumber, registerDialer, initiateCall }}>
      {children}
    </DialerContext.Provider>
  );
}

export function useDialer() {
  const context = useContext(DialerContext);
  if (context === undefined) {
    throw new Error('useDialer must be used within a DialerProvider');
  }
  return context;
}
