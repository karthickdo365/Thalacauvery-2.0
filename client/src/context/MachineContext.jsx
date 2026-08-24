import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MachineContext = createContext(null);

const STORAGE_KEY = 'thalacauvery_machine';

export const MachineProvider = ({ children }) => {
  const [currentMachine, setCurrentMachineState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'big' || saved === 'small') return saved;
    } catch {}
    return null;
  });

  const setMachine = useCallback((machine) => {
    if (machine !== 'big' && machine !== 'small') return;
    setCurrentMachineState(machine);
    try {
      localStorage.setItem(STORAGE_KEY, machine);
    } catch {}
  }, []);

  const clearMachine = useCallback(() => {
    setCurrentMachineState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  // Keep localStorage in sync if state is cleared externally
  useEffect(() => {
    if (currentMachine) {
      try {
        localStorage.setItem(STORAGE_KEY, currentMachine);
      } catch {}
    }
  }, [currentMachine]);

  return (
    <MachineContext.Provider
      value={{
        currentMachine,
        setMachine,
        clearMachine,
        isBig: currentMachine === 'big',
        isSmall: currentMachine === 'small',
        hasMachine: !!currentMachine,
      }}
    >
      {children}
    </MachineContext.Provider>
  );
};

export const useMachine = () => {
  const ctx = useContext(MachineContext);
  if (!ctx) {
    throw new Error('useMachine must be used within MachineProvider');
  }
  return ctx;
};

export default MachineContext;
