
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, Layers, Flag, MessageSquare, Globe, Lock, Hash } from 'lucide-react';
import { adminUsersService } from '../services/adminUsersService';
import { adminNuggetsService } from '../services/adminNuggetsService';
import { adminCollectionsService } from '../services/adminCollectionsService';
import { adminTagsService } from '../services/adminTagsService';
import { adminModerationService } from '../services/adminModerationService';
import { adminFeedbackService } from '../services/adminFeedbackService';
import { useAdminHeader } from '../layout/AdminLayout';

interface DashboardMetrics {
  users: { total: number };
  nuggets: { total: number; public: number; private: number };
  collections: { community: number; nuggetsInCommunity: number };
  tags: { total: number };
  reports: { open: number };
  feedback: { total: number };
}

const MetricCard = ({ label, value, subValue, icon, onClick, colorClass }: any) => (
  <div 
    onClick={onClick}
    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all group"
  >
    <div className="flex justify-between items-start">
        <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</h3>
            {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg ${colorClass} group-hover:scale-110 transition-transform`}>
            {icon}
        </div>
    </div>
  </div>
);

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { setPageHeader } = useAdminHeader();

  useEffect(() => {
    setPageHeader(
      "Dashboard", 
      "Platform overview at a glance.",
      <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-sm hover:opacity-90">Download Report</button>
    );
  }, []);

  const loadAll = useCallback(() => {
    let isCancelled = false;

    const run = async () => {
      try {
        const [users, nuggets, cols, tags, reports, feed] = await Promise.all([
            adminUsersService.getStats(),
            adminNuggetsService.getStats(),
            adminCollectionsService.getStats(),
            adminTagsService.getStats(),
            adminModerationService.getStats(),
            adminFeedbackService.getStats()
        ]);

        if (!isCancelled) {
          setMetrics({
              users: { total: users.total },
              nuggets: { total: nuggets.total, public: nuggets.public, private: nuggets.private },
              collections: { community: cols.totalCommunity, nuggetsInCommunity: cols.totalNuggetsInCommunity },
              tags: { total: tags.totalTags },
              reports: { open: reports.open },
              feedback: { total: feed.total }
          });
          setErrorMessage(null);
        }
      } catch (error: any) {
        if (error.message !== 'Request cancelled' && !isCancelled) {
          // Show more specific error messages
          let errorMsg = "Could not load dashboard metrics. Please retry.";
          
          if (error.message?.includes('connect to the server')) {
            errorMsg = "Backend server is not running. Please start the server on port 5000.";
          } else if (error.message?.includes('session has expired')) {
            errorMsg = "Your session has expired. Please sign in again.";
          } else if (error.message) {
            errorMsg = `Error: ${error.message}`;
          }
          
          console.error('Dashboard load error:', error);
          setErrorMessage(errorMsg);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = loadAll();
    return () => cancel && cancel();
  }, [loadAll]);

  if (!metrics) return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>{errorMessage}</span>
          <button
            onClick={() => { setMetrics(null); loadAll(); }}
            className="px-3 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold hover:bg-amber-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, idx) => (
          <div key={`metric-skel-${idx}`} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-start animate-pulse">
              <div className="space-y-2">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-5 w-10 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <MetricCard 
            label="Standard Users" 
            value={metrics.users.total} 
            icon={<Users size={18} />} 
            colorClass="bg-blue-50 text-blue-600"
            onClick={() => navigate('/admin/users')}
        />
        <MetricCard 
            label="Total Nuggets" 
            value={metrics.nuggets.total} 
            icon={<FileText size={18} />} 
            colorClass="bg-indigo-50 text-indigo-600"
            onClick={() => navigate('/admin/nuggets')}
        />
        <MetricCard 
            label="Public Nuggets" 
            value={metrics.nuggets.public} 
            icon={<Globe size={18} />} 
            colorClass="bg-green-50 text-green-600"
            onClick={() => navigate('/admin/nuggets')}
        />
        <MetricCard 
            label="Private Nuggets" 
            value={metrics.nuggets.private} 
            icon={<Lock size={18} />} 
            colorClass="bg-slate-100 text-slate-600"
            onClick={() => navigate('/admin/nuggets')}
        />
        <MetricCard 
            label="Comm. Collections" 
            value={metrics.collections.community} 
            subValue={`${metrics.collections.nuggetsInCommunity} items`}
            icon={<Layers size={18} />} 
            colorClass="bg-purple-50 text-purple-600"
            onClick={() => navigate('/admin/collections')}
        />
        <MetricCard 
            label="Total Tags" 
            value={metrics.tags.total} 
            icon={<Hash size={18} />} 
            colorClass="bg-pink-50 text-pink-600"
            onClick={() => navigate('/admin/tags')}
        />
        <MetricCard 
            label="Open Reports" 
            value={metrics.reports.open} 
            icon={<Flag size={18} />} 
            colorClass="bg-red-50 text-red-600"
            onClick={() => navigate('/admin/moderation')}
        />
        <MetricCard 
            label="Total Feedback" 
            value={metrics.feedback.total} 
            icon={<MessageSquare size={18} />} 
            colorClass="bg-teal-50 text-teal-600"
            onClick={() => navigate('/admin/feedback')}
        />
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => navigate('/admin/downloads')}>
            <span className="text-xs font-bold text-slate-500">Download Data</span>
            <span className="text-[10px] text-slate-400 mt-1">Export Reports</span>
        </div>
      </div>
    </div>
  );
};
