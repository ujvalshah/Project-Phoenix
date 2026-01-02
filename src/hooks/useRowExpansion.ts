import { useState, useCallback, useRef } from 'react';

export const useRowExpansion = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerCard = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
    } else {
      cardRefs.current.delete(id);
    }
  }, []);

  const toggleExpansion = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  return {
    expandedId,
    toggleExpansion,
    registerCard
  };
};


