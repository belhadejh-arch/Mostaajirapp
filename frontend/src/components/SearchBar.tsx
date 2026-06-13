import React, { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSearch?: () => void;
  onFilter?: () => void;
  showFilter?: boolean;
}

export function SearchBar({ value, onChange, onSearch, onFilter, showFilter }: SearchBarProps) {
  const { t, isRTL } = useLanguage();

  return (
    <div className={cn('flex gap-2', isRTL ? 'flex-row-reverse' : '')}>
      <div className="relative flex-1 min-w-0">
        <Search
          size={16}
          className={cn('absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none', isRTL ? 'right-3' : 'left-3')}
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch?.()}
          placeholder={t('searchPlaceholder')}
          className={cn('px-3', isRTL ? 'pr-10' : 'pl-10')}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
      </div>
      {showFilter && (
        <Button variant="outline" size="icon" onClick={onFilter} className="shrink-0">
          <SlidersHorizontal size={16} />
        </Button>
      )}
    </div>
  );
}
