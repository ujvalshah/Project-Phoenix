import React, { createContext, useContext, useMemo, useState } from 'react';

interface FilterResultsContextValue {
  resultCount: number | undefined;
  setResultCount: React.Dispatch<React.SetStateAction<number | undefined>>;
}

const FilterResultsContext = createContext<FilterResultsContextValue | null>(null);

export const FilterResultsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);

  const value = useMemo(
    () => ({
      resultCount,
      setResultCount,
    }),
    [resultCount],
  );

  return <FilterResultsContext.Provider value={value}>{children}</FilterResultsContext.Provider>;
};

export const useFilterResults = (): FilterResultsContextValue => {
  const context = useContext(FilterResultsContext);
  if (!context) {
    throw new Error('useFilterResults must be used within a FilterResultsProvider');
  }
  return context;
};
