import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Save, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { US_STATES } from '../../lib/bill-format';
import { getLegislators } from '../../lib/legiscan-api';
import type { LegislativeOffice, LegiscanLegislator } from '../../types';

interface QuickAddLegOfficeModalProps {
  defaultType?: 'legislator' | 'committee';
  legislator?: LegiscanLegislator;
  userId: string;
  onCreated: (office: LegislativeOffice) => void;
  onClose: () => void;
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-0.5';

function chamberTitle(chamber?: string): string {
  const c = (chamber || '').toLowerCase();
  if (c === 'senate' || c === 'sen') return 'Senator';
  if (c === 'house' || c === 'assembly' || c === 'rep') return 'Representative';
  return '';
}

function formatOfficeName(name: string, chamber?: string): string {
  const title = chamberTitle(chamber);
  return title ? `${title} ${name}` : name;
}

const QuickAddLegOfficeModal: React.FC<QuickAddLegOfficeModalProps> = ({
  defaultType = 'legislator',
  legislator,
  userId,
  onCreated,
  onClose,
}) => {
  const [saving, setSaving] = useState(false);
  const [officeType, setOfficeType] = useState<'legislator' | 'committee'>(defaultType);
  const [name, setName] = useState(legislator ? formatOfficeName(legislator.name, legislator.chamber) : '');
  const [selectedPeopleId, setSelectedPeopleId] = useState<number | null>(legislator?.people_id || null);
  const [state, setState] = useState(legislator?.state || '');
  const [chamber, setChamber] = useState(legislator?.chamber?.toLowerCase() || '');
  const [district, setDistrict] = useState(legislator?.district || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [officeState, setOfficeState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Legislator search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LegiscanLegislator[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close search results on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ensure legislators are cached for the selected state
  const cachedStatesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (officeType === 'legislator' && state && !cachedStatesRef.current.has(state)) {
      cachedStatesRef.current.add(state);
      // getLegislators refreshes the cache if stale
      getLegislators(state);
    }
  }, [state, officeType]);

  // Debounced search
  useEffect(() => {
    if (officeType !== 'legislator' || searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const q = searchQuery.toLowerCase();

      // Build query — filter by state if one is selected
      let query = supabase
        .from('legiscan_legislators')
        .select('*')
        .ilike('name', `%${q}%`);
      if (state && state !== 'US') {
        query = query.eq('state', state);
      }
      const { data } = await query.limit(20);

      let results = (data || []) as LegiscanLegislator[];

      // If no results and a state is selected, try refreshing cache from API
      if (results.length === 0 && state) {
        await getLegislators(state);
        let retryQuery = supabase
          .from('legiscan_legislators')
          .select('*')
          .ilike('name', `%${q}%`);
        if (state !== 'US') {
          retryQuery = retryQuery.eq('state', state);
        }
        const { data: retryData } = await retryQuery.limit(20);
        results = (retryData || []) as LegiscanLegislator[];
      }

      setSearchResults(results);
      setShowResults(true);
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, officeType, state]);

  const selectLegislator = (leg: LegiscanLegislator) => {
    setName(formatOfficeName(leg.name, leg.chamber));
    setSelectedPeopleId(leg.people_id);
    setState(leg.state || '');
    setChamber((leg.chamber || '').toLowerCase());
    setDistrict(leg.district || '');
    setSearchQuery('');
    setShowResults(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from('legislative_offices')
      .insert({
        office_type: officeType,
        name: name.trim(),
        state: state || null,
        chamber: chamber || null,
        district: district.trim() || null,
        legislator_people_id: officeType === 'legislator' ? selectedPeopleId : null,
        address: address.trim() || null,
        city: city.trim() || null,
        office_state: officeState || null,
        zip: zip.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        created_by: userId,
      })
      .select('*')
      .single();

    setSaving(false);
    if (error || !data) return;
    onCreated(data as LegislativeOffice);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 sm:p-4">
      <div className="bg-white shadow-xl w-full h-full sm:h-auto sm:rounded-xl sm:max-w-lg overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Add {officeType === 'committee' ? 'Committee' : 'Legislative'} Office
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Office Type *</label>
              <select value={officeType} onChange={(e) => setOfficeType(e.target.value as any)} className={inputClass}>
                <option value="legislator">Legislator Office</option>
                <option value="committee">Committee Office</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Chamber</label>
              <select value={chamber} onChange={(e) => setChamber(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                <option value="senate">Senate</option>
                <option value="house">House</option>
                <option value="assembly">Assembly</option>
                <option value="joint">Joint</option>
                <option value="committee">Committee</option>
              </select>
            </div>
          </div>

          {/* Legislator search — only for legislator type */}
          {officeType === 'legislator' && (
            <div ref={searchRef} className="relative">
              <label className={labelClass}>Search Legislator</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                  placeholder="Type to search legislators..."
                  className={`${inputClass} pl-8`}
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
                )}
              </div>
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((leg) => (
                    <button
                      key={leg.people_id}
                      type="button"
                      onClick={() => selectLegislator(leg)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-teal-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-900">{leg.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {leg.party ? `(${leg.party})` : ''} {leg.state || ''} {leg.chamber || ''} {leg.district ? `D-${leg.district}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="px-3 py-4 text-center text-xs text-gray-400">
                    No legislators found. You can still type a name manually below.
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Office Name *</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setSelectedPeopleId(null); }} placeholder="e.g., Senator Andy Lang" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>State</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>District</label>
              <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g., 29" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Zip</label>
              <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Street Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>City</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Office Location</label>
              <select value={officeState} onChange={(e) => setOfficeState(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {US_STATES.filter((s) => s.value !== 'US').map((s) => (
                  <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3 py-2 sm:py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Add Office
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddLegOfficeModal;
