import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

export const BackToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const rafIdRef = useRef<number | null>(null);
  const lastVisibleRef = useRef(false);

  useEffect(() => {
    // CRITICAL PERFORMANCE FIX: Optimize scroll handler to be < 5ms
    // Previous implementation was taking 11-14ms because:
    // 1. Performance.now() calls in hot path (even in dev)
    // 2. Multiple function calls in RAF callback
    // 3. State updates even when value didn't change
    //
    // Solution: Minimize work in scroll handler, batch efficiently
    const handleScroll = () => {
      // Cancel any pending RAF to avoid multiple queued updates
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        // Read scrollY once and cache
        const scrollY = window.scrollY;
        const shouldBeVisible = scrollY > 300;
        
        // Only update state if visibility actually changed
        // This prevents unnecessary re-renders that cause scrollbar flicker
        if (shouldBeVisible !== lastVisibleRef.current) {
          lastVisibleRef.current = shouldBeVisible;
          setIsVisible(shouldBeVisible);
        }
        
        rafIdRef.current = null;
      });
    };
    
    // Performance monitoring (only in development, outside hot path)
    // Only check performance every 100 scrolls to avoid overhead
    let perfCheckCount = 0;
    const scrollHandler = process.env.NODE_ENV === 'development' 
      ? () => {
          // Only check performance every 100 scrolls to avoid overhead
          if (perfCheckCount++ % 100 === 0) {
            const perfStart = performance.now();
            handleScroll();
            requestAnimationFrame(() => {
              const duration = performance.now() - perfStart;
              if (duration > 5) {
                console.warn(`[BackToTopButton] Scroll handler took ${duration.toFixed(2)}ms (target: <5ms)`);
              }
            });
          } else {
            handleScroll();
          }
        }
      : handleScroll;

    // Mark as passive to allow browser scroll optimizations
    // Passive listeners can't call preventDefault(), which is fine here
    window.addEventListener('scroll', scrollHandler, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', scrollHandler);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-30 p-2.5 rounded-full bg-primary-500 text-slate-900 shadow-lg shadow-primary-500/30 hover:bg-primary-400 hover:scale-110 transition-all duration-300 transform flex items-center justify-center ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
      }`}
    >
      <ArrowUp size={20} />
    </button>
  );
};


