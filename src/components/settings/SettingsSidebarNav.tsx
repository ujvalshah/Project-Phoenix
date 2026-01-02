
import React from 'react';
import { User, Shield, Sliders, AlertTriangle, CreditCard } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: <User size={18} /> },
  { id: 'account', label: 'Account Info', icon: <CreditCard size={18} /> },
  { id: 'security', label: 'Security', icon: <Shield size={18} /> },
  { id: 'preferences', label: 'Preferences', icon: <Sliders size={18} /> },
  { id: 'danger', label: 'Danger Zone', icon: <AlertTriangle size={18} /> },
];

interface SettingsSidebarNavProps {
  activeSection: string;
  onSelect: (id: string) => void;
}

export const SettingsSidebarNav: React.FC<SettingsSidebarNavProps> = ({ activeSection, onSelect }) => {
  return (
    <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 custom-scrollbar sticky top-[5.5rem]">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap
            ${activeSection === item.id 
              ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' 
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
            }
          `}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
};
