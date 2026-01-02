import React from 'react';
import { Link } from 'react-router-dom';

interface NavTabProps {
  to: string;
  label: string;
  active: boolean;
}

export const NavTab: React.FC<NavTabProps> = ({ to, label, active }) => (
    <Link 
        to={to} 
        className={`px-2.5 py-1.5 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
    >
        {label}
    </Link>
);


