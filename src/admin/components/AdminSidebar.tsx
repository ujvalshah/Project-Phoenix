
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Layers, Hash, Settings, LogOut, Flag, Activity, MessageSquare, Download, Scale } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { path: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/nuggets', label: 'Nuggets', icon: FileText },
  { path: '/admin/collections', label: 'Collections', icon: Layers },
  { path: '/admin/tags', label: 'Tags', icon: Hash },
  { path: '/admin/moderation', label: 'Moderation', icon: Flag },
  { path: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { path: '/admin/activity', label: 'Activity Log', icon: Activity },
  { path: '/admin/downloads', label: 'Data Export', icon: Download },
  { path: '/admin/legal', label: 'Legal Pages', icon: Scale },
  { path: '/admin/config', label: 'Settings & Access', icon: Settings },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const { logout } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white dark:bg-slate-900 
        border-r border-slate-200 dark:border-slate-800
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg flex items-center justify-center font-bold mr-3">
            A
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Admin Panel</span>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => onClose()} // Close on mobile click
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive 
                  ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }
              `}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button 
            onClick={() => { logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
