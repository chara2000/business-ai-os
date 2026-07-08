'use client';

import { Search } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Buscar...', className }: SearchFieldProps) {
  return (
    <div className={className ?? 'search-field search-field-fintech'}>
      <Search size={14} className="search-field-icon" />
      <input
        className="input input-compact"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
