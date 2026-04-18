import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { MentionType } from '../../types';

interface MentionResult {
  id: string;
  label: string;
  sublabel?: string;
  type: MentionType;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
  placeholder?: string;
}

const CATEGORY_LABELS: Record<MentionType, string> = {
  legislator: 'Legislators',
  leg_staff: 'Legislative Staff',
  contact: 'Contacts',
  user: 'LL3 Team',
  committee: 'Committees',
};

const CATEGORY_ORDER: MentionType[] = ['legislator', 'leg_staff', 'contact', 'user', 'committee'];

const MENTION_REGEX = /@\[([^\]]+)\]\((legislator|leg_staff|contact|user|committee):([^)]+)\)/g;

// ─── Shared helper ──────────────────────────────────────────────────

function getMentionHref(type: MentionType, id: string): string | null {
  switch (type) {
    case 'contact': return `/contacts/${id}`;
    case 'legislator': return `/advocacy/directory?highlight=legislator:${id}`;
    case 'leg_staff': return `/advocacy/directory?highlight=leg_staff:${id}`;
    case 'committee': return `/advocacy/directory?highlight=committee:${id}`;
    case 'user': return null;
  }
}

// ─── Contenteditable helpers ────────────────────────────────────────

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert raw value (with @[Name](type:id) markers) → HTML for contenteditable */
function valueToHTML(text: string): string {
  if (!text) return '';
  const parts: string[] = [];
  let lastIndex = 0;

  MENTION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(escapeHTML(text.slice(lastIndex, match.index)).replace(/\n/g, '<br>'));
    }
    const name = match[1];
    const type = match[2];
    const id = match[3];
    const mentionHref = getMentionHref(type as MentionType, id);
    const cursorStyle = mentionHref ? 'pointer' : 'default';
    const underline = mentionHref ? 'text-decoration:underline;text-decoration-color:transparent;' : '';
    parts.push(
      `<span contenteditable="false" data-mention-type="${escapeHTML(type)}" data-mention-id="${escapeHTML(id)}" style="font-weight:700;color:#0d9488;cursor:${cursorStyle};${underline}" onmouseover="if(this.style.cursor==='pointer'){this.style.textDecorationColor='currentColor'}" onmouseout="this.style.textDecorationColor='transparent'">@${escapeHTML(name)}</span>`
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(escapeHTML(text.slice(lastIndex)).replace(/\n/g, '<br>'));
  }

  return parts.join('');
}

/** Serialize contenteditable DOM → raw value with mention markers */
function domToValue(el: HTMLElement): string {
  let result = '';

  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];

    if (node.nodeType === Node.TEXT_NODE) {
      // Convert &nbsp; back to regular space
      result += (node.textContent || '').replace(/\u00A0/g, ' ');
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement;

      if (elem.dataset.mentionType && elem.dataset.mentionId) {
        // Mention span → marker format
        const name = (elem.textContent || '').replace(/^@/, '');
        result += `@[${name}](${elem.dataset.mentionType}:${elem.dataset.mentionId})`;
      } else if (elem.tagName === 'BR') {
        result += '\n';
      } else if (elem.tagName === 'DIV' || elem.tagName === 'P') {
        // Block elements from pressing Enter
        if (i > 0 && result.length > 0 && !result.endsWith('\n')) {
          result += '\n';
        }
        const inner = domToValue(elem);
        result += inner;
      } else {
        result += domToValue(elem);
      }
    }
  }

  return result;
}

// ─── Component ──────────────────────────────────────────────────────

const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  rows = 4,
  className = '',
  placeholder,
}) => {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync external value → DOM (only when value changes externally, not from our own edits)
  useEffect(() => {
    if (!editorRef.current) return;
    const domValue = domToValue(editorRef.current);
    if (domValue !== value) {
      editorRef.current.innerHTML = valueToHTML(value);
    }
  }, [value]);

  // Search all entity types in parallel
  const searchEntities = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const search = `%${q}%`;

    const [legislators, legStaff, contacts, users, committees] = await Promise.all([
      supabase
        .from('legiscan_legislators')
        .select('people_id, name, party, state, chamber')
        .ilike('name', search)
        .limit(3),
      supabase
        .from('legislative_office_staff')
        .select('id, first_name, last_name, title')
        .or(`first_name.ilike.${search},last_name.ilike.${search}`)
        .neq('is_active', false)
        .limit(3),
      supabase
        .from('contacts')
        .select('id, first_name, last_name, title')
        .or(`first_name.ilike.${search},last_name.ilike.${search}`)
        .limit(3),
      supabase
        .from('users')
        .select('id, full_name, email')
        .eq('is_active', true)
        .or(`full_name.ilike.${search},email.ilike.${search}`)
        .limit(3),
      supabase
        .from('legislative_offices')
        .select('id, name, state, chamber')
        .eq('office_type', 'committee')
        .ilike('name', search)
        .limit(3),
    ]);

    const all: MentionResult[] = [];

    for (const l of legislators.data || []) {
      all.push({
        id: String(l.people_id),
        label: l.name,
        sublabel: [l.party, l.state, l.chamber].filter(Boolean).join(' · '),
        type: 'legislator',
      });
    }
    for (const s of legStaff.data || []) {
      all.push({
        id: s.id,
        label: `${s.first_name} ${s.last_name}`,
        sublabel: s.title || undefined,
        type: 'leg_staff',
      });
    }
    for (const c of contacts.data || []) {
      all.push({
        id: c.id,
        label: `${c.first_name} ${c.last_name}`,
        sublabel: c.title || undefined,
        type: 'contact',
      });
    }
    for (const u of users.data || []) {
      all.push({
        id: u.id,
        label: u.full_name || u.email,
        sublabel: u.full_name ? u.email : undefined,
        type: 'user',
      });
    }
    for (const co of committees.data || []) {
      all.push({
        id: co.id,
        label: co.name,
        sublabel: [co.state, co.chamber].filter(Boolean).join(' · ') || undefined,
        type: 'committee',
      });
    }

    setResults(all);
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!showDropdown) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchEntities(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, showDropdown, searchEntities]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        editorRef.current && !editorRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /** Detect @ trigger from current cursor position */
  const checkForMentionTrigger = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) {
      setShowDropdown(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) {
      setShowDropdown(false);
      return;
    }

    const text = textNode.textContent || '';
    const cursorOffset = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorOffset);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt === -1) {
      setShowDropdown(false);
      return;
    }

    // @ must be at start of the text node or after whitespace
    if (lastAt > 0 && !/\s/.test(textBeforeCursor[lastAt - 1])) {
      setShowDropdown(false);
      return;
    }

    const searchText = textBeforeCursor.slice(lastAt + 1);
    if (searchText.includes('\n')) {
      setShowDropdown(false);
      return;
    }

    setQuery(searchText);
    setShowDropdown(true);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const newValue = domToValue(editorRef.current);
    onChange(newValue);
    checkForMentionTrigger();
  };

  /** Insert a mention span at the current cursor, replacing the @query text */
  const insertMention = (result: MentionResult) => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent || '';
    const cursorOffset = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorOffset);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt === -1) return;

    const beforeText = text.slice(0, lastAt);
    const afterText = text.slice(cursorOffset);

    // Create mention span (non-editable inline element)
    const mentionSpan = document.createElement('span');
    mentionSpan.contentEditable = 'false';
    mentionSpan.dataset.mentionType = result.type;
    mentionSpan.dataset.mentionId = result.id;
    mentionSpan.style.fontWeight = '700';
    mentionSpan.style.color = '#0d9488';
    mentionSpan.style.cursor = 'default';
    mentionSpan.textContent = `@${result.label}`;

    // Build replacement nodes
    const parent = textNode.parentNode!;
    const beforeNode = document.createTextNode(beforeText);
    // Use nbsp so cursor has a landing spot after the mention
    const afterNode = document.createTextNode('\u00A0' + afterText);

    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(mentionSpan, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);

    // Place cursor right after the nbsp
    const newRange = document.createRange();
    newRange.setStart(afterNode, 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    // Serialize and push value up
    const newValue = domToValue(editor);
    onChange(newValue);

    setShowDropdown(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!showDropdown || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowDropdown(false);
    }
  };

  /** Strip HTML on paste — only allow plain text */
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  /** Click on a mention span → navigate to entity */
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.mentionType && target.dataset.mentionId) {
      const href = getMentionHref(target.dataset.mentionType as MentionType, target.dataset.mentionId);
      if (href) {
        e.preventDefault();
        e.stopPropagation();
        navigate(href);
      }
    }
  };

  // Group results by type
  const grouped = CATEGORY_ORDER
    .map((type) => ({
      type,
      label: CATEGORY_LABELS[type],
      items: results.filter((r) => r.type === type),
    }))
    .filter((g) => g.items.length > 0);

  let flatIndex = 0;

  return (
    <div className="relative">
      {/* Placeholder — shown when editor is empty */}
      {!value && placeholder && (
        <div
          className="absolute px-2.5 py-1.5 text-sm text-gray-400 pointer-events-none select-none"
          aria-hidden="true"
        >
          {placeholder}
        </div>
      )}

      {/* Contenteditable editor — renders mention spans as styled inline elements */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        className={className}
        style={{
          minHeight: `${rows * 1.5}em`,
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowY: 'auto',
          outline: 'none',
        }}
        role="textbox"
        aria-multiline="true"
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-80 max-h-72 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 bottom-full mb-1 sm:bottom-auto sm:mb-0 sm:top-full sm:mt-1"
          style={{ maxHeight: 'min(288px, 40vh)' }}
        >
          <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-400">
            {query ? `Searching "${query}"...` : 'Type to search people & committees'}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            </div>
          )}

          {!loading && results.length === 0 && query.length > 0 && (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">
              No results found
            </div>
          )}

          {!loading && grouped.map((group) => (
            <div key={group.type}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                {group.label}
              </div>
              {group.items.map((item) => {
                const idx = flatIndex++;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className={`w-full text-left px-3 py-2 hover:bg-teal-50 transition-colors ${
                      idx === selectedIndex ? 'bg-teal-50' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(item);
                    }}
                  >
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    {item.sublabel && (
                      <div className="text-xs text-gray-400">{item.sublabel}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;

// ─── Mention rendering helper ───────────────────────────────────────

/**
 * Parse mention markers in notes text and return React nodes —
 * mentions render as bold teal text. Clickable for types with pages.
 */
export function renderNotesWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const displayName = match[1];
    const type = match[2] as MentionType;
    const id = match[3];
    const href = getMentionHref(type, id);

    if (href) {
      parts.push(
        React.createElement(
          Link,
          {
            key: `mention-${match.index}`,
            to: href,
            className: 'font-bold text-teal-700 hover:underline hover:text-teal-900',
            title: `${CATEGORY_LABELS[type]}: ${displayName}`,
          },
          `@${displayName}`
        )
      );
    } else {
      parts.push(
        React.createElement(
          'strong',
          {
            key: `mention-${match.index}`,
            className: 'text-teal-700',
            title: `${CATEGORY_LABELS[type]}: ${displayName}`,
          },
          `@${displayName}`
        )
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Extract mention data from notes text for saving to ga_engagement_mentions.
 */
export function extractMentions(text: string): { type: MentionType; id: string }[] {
  const mentions: { type: MentionType; id: string }[] = [];
  let match: RegExpExecArray | null;

  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push({ type: match[2] as MentionType, id: match[3] });
  }

  return mentions;
}
