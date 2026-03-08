import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

// ─── Initiative Multi-Combo (searchable, multi-select, allows adding new) ────
export interface InitiativeComboProps {
  value: string;            // comma-separated stored value
  options: string[];        // all known initiatives
  onChange: (val: string) => void;
  onAddNew: (val: string) => Promise<void>;
  label?: string;           // override label (default: "Initiatives")
}

const InitiativeCombo: React.FC<InitiativeComboProps> = ({ value, options, onChange, onAddNew, label }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse comma-separated value into array
  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter((o) => {
    if (selected.includes(o)) return false; // hide already-selected
    if (!query) return true;
    return o.toLowerCase().includes(query.toLowerCase());
  });

  const exactMatch = options.some((o) => o.toLowerCase() === query.toLowerCase());
  const showAddNew = query.trim().length > 0 && !exactMatch && !selected.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  const addToSelected = (val: string) => {
    const next = [...selected, val];
    onChange(next.join(', '));
    setQuery('');
  };

  const removeFromSelected = (val: string) => {
    const next = selected.filter((s) => s !== val);
    onChange(next.join(', '));
  };

  const handleAddNew = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    await onAddNew(trimmed);
    addToSelected(trimmed);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label || 'Initiatives'}</label>

      {/* Chip display + input */}
      <div
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={`w-full min-h-[38px] px-2.5 py-1.5 border rounded-md flex flex-wrap items-center gap-1.5 cursor-text transition-all ${
          isOpen ? 'border-teal-500 ring-2 ring-teal-100' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 text-sm px-2 py-0.5 rounded-full"
          >
            {s}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeFromSelected(s); }}
              className="text-teal-600 hover:text-teal-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={selected.length === 0 ? `Search or type new ${(label || 'initiative').toLowerCase()}...` : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent py-0.5"
        />
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => addToSelected(o)}
              className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-teal-50 transition-colors"
            >
              {o}
            </button>
          ))}
          {showAddNew && (
            <button
              type="button"
              onClick={handleAddNew}
              className="w-full px-3 py-2 text-left text-sm text-teal-600 hover:bg-teal-50 transition-colors border-t border-gray-100 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add "{query.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showAddNew && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">No more initiatives</div>
          )}
        </div>
      )}
    </div>
  );
};

export default InitiativeCombo;
