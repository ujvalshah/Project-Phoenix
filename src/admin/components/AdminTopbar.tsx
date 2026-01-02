
import React from 'react';
import { Menu, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/shared/Avatar';
import { useAuth } from '@/hooks/useAuth';

interface AdminTopbarProps {
  onMenuClick: () => void;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const AdminTopbar: React.FC<AdminTopbarProps> = ({ onMenuClick, title, description, actions }) => {
  const { user } = useAuth();

  return (
    <header className="h-auto min-h-[4rem] py-2 px-4 lg:px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-20">
      
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden shrink-0"
        >
          <Menu size={20} />
        </button>
        
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
            {title || 'Admin Panel'}
          </h1>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 self-end sm:self-center ml-auto sm:ml-0">
        
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-900 dark:text-white">{user?.name}</div>
            <div className="text-[10px] font-bold text-slate-400 tracking-wider">Super Admin</div>
          </div>
          <Avatar name={user?.name || 'Admin'} size="md" className="bg-slate-900 text-white" />
        </div>
      </div>
    </header>
  );
};
