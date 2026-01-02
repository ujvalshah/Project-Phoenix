import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Key, AlertCircle, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface KeyStatus {
  total: number;
  currentIndex: number;
  keys: Array<{
    index: number;
    status: 'active' | 'rate-limited' | 'standby';
  }>;
}

/**
 * Fetch key status from the backend
 */
const fetchKeyStatus = async (): Promise<KeyStatus> => {
  const response = await fetch(`${API_BASE}/ai/admin/key-status`);
  if (!response.ok) {
    throw new Error('Failed to fetch key status');
  }
  return response.json();
};

/**
 * Reset all exhausted keys
 */
const resetKeys = async (): Promise<{ success: boolean; message: string; keyStatus: KeyStatus }> => {
  const response = await fetch(`${API_BASE}/ai/admin/reset-keys`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reset keys');
  }
  return response.json();
};

export const KeyStatusWidget: React.FC = () => {
  const queryClient = useQueryClient();
  const [isResetting, setIsResetting] = useState(false);
  
  const { data, isLoading, error } = useQuery<KeyStatus>({
    queryKey: ['gemini-key-status'],
    queryFn: fetchKeyStatus,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
  
  const handleResetKeys = async () => {
    setIsResetting(true);
    try {
      await resetKeys();
      // Refetch key status
      await queryClient.invalidateQueries({ queryKey: ['gemini-key-status'] });
    } catch (err) {
      console.error('Failed to reset keys:', err);
    } finally {
      setIsResetting(false);
    }
  };
  
  // Check if any keys are rate-limited
  const hasRateLimitedKeys = data?.keys.some(k => k.status === 'rate-limited') ?? false;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading key status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/30 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          <span>Failed to load key status</span>
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Key size={16} />
          <span>No API keys configured</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: 'active' | 'rate-limited' | 'standby') => {
    const baseClasses = 'w-2 h-2 rounded-full';
    switch (status) {
      case 'active':
        return <div className={`${baseClasses} bg-green-500`} title="Active" />;
      case 'rate-limited':
        return (
          <div className="flex items-center gap-1">
            <div className={`${baseClasses} bg-red-500 animate-pulse`} title="Rate Limited" />
            <span className="text-xs text-red-600 dark:text-red-400">Rate Limited</span>
          </div>
        );
      case 'standby':
        return <div className={`${baseClasses} bg-gray-400`} title="Standby" />;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-gray-600 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Gemini API Keys</h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-400">
          {data.total} key{data.total !== 1 ? 's' : ''} total
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-600 dark:text-slate-400">
          Active: Key #{data.currentIndex}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {data.keys.map((key) => (
            <div
              key={key.index}
              className={`
                flex items-center gap-2 px-2 py-1 rounded-lg text-xs
                ${key.status === 'active' 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                  : key.status === 'rate-limited'
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700'
                }
              `}
            >
              {getStatusBadge(key.status)}
              <span className="font-medium text-gray-700 dark:text-slate-300">
                Key {key.index}
              </span>
            </div>
          ))}
        </div>
        
        {/* Reset button - only show when keys are rate-limited */}
        {hasRateLimitedKeys && (
          <button
            onClick={handleResetKeys}
            disabled={isResetting}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors disabled:opacity-50"
          >
            {isResetting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Reset Rate Limits
          </button>
        )}
      </div>
    </div>
  );
};

