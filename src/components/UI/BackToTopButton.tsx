import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Z_INDEX } from '@/constants/zIndex';

export const BackToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const lastVisibleRef = useRef(false);
  const location = useLocation();
  const isHomeFeedRoute = location.pathname === '/';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const bottomOffsetClass = isAdminRoute
    ? 'bottom-20 md:bottom-24'
    : 'max-md:bottom-[calc(1.5rem+var(--mobile-bottom-nav-inset,0px))] md:max-lg:bottom-[calc(2rem+var(--mobile-bottom-nav-inset,0px))] lg:bottom-8';

  useEffect(() => {
    const handleScroll = () => {
      const shouldBeVisible = window.scrollY > 300;
      if (shouldBeVisible !== lastVisibleRef.current) {
        lastVisibleRef.current = shouldBeVisible;
        setIsVisible(shouldBeVisible);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: isHomeFeedRoute ? 'instant' : 'smooth',
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed right-6 md:right-8 p-2.5 rounded-full bg-primary-500 text-slate-900 shadow-lg shadow-primary-500/30 hover:bg-primary-400 flex items-center justify-center ${bottomOffsetClass} ${
        isVisible ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
      }`}
      style={{ zIndex: Z_INDEX.CHROME_WIDGET }}
    >
      <ArrowUp size={20} />
    </button>
  );
};


