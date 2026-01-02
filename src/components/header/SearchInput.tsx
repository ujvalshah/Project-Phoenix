import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = "Search..." }) => {
  return (
    <div className="flex items-center px-3 transition-colors cursor-text w-full overflow-hidden">
      <Search size={18} className="text-slate-400 mr-3 shrink-0" />
      <input 
        className="flex-1 bg-transparent py-2.5 text-sm font-medium focus:outline-none text-slate-700 dark:text-slate-200 min-w-[50px] placeholder-slate-400 w-full" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder} 
      />
    </div>
  );
};


