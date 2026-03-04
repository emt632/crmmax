import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Heart, ArrowLeft, Save, Loader2, Trash2,
  ChevronDown, ChevronUp, Search, X, Plus, Calendar,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  SUPPORT_STATUS_LABELS, SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS, OUTREACH_METHOD_LABELS,
  TARGET_TYPE_LABELS, THANK_YOU_METHOD_LABELS,
} from '../../lib/bill-format';
import { getInitiativeOptions, setAdvoLinkSetting } from '../../lib/legiscan-api';
import InitiativeCombo from './InitiativeCombo';
import MultiSelectDropdown from './MultiSelectDropdown';
import type { MultiSelectOption } from './MultiSelectDropdown';
import type {
  SupportAskTargetType, SupportAskOutreachMethod,
  SupportTypeRequested, SupportStatus, ThankYouMethod,
} from '../../types';

// ─── Form Data Shape ──────────────────────────────────────────
interface SupportAskFormData {
  requester_id: string;
  target_type: SupportAskTargetType;
  target_legislator_people_id: number | null;
  target_contact_id: string;
  target_organization_id: string;
  target_leg_staff_id: string;
  target_name: string;
  ask_date: string;
  outreach_method: SupportAskOutreachMethod;
  initiative: string;
  support_type_requested: SupportTypeRequested;
  ask_notes: string;
  // Conversion tracking
  support_status: SupportStatus;
  follow_up_date: string;
  follow_up_notes: string;
  support_type_provided: string;
  support_received_date: string;
  // Stewardship
  thank_you_sent: boolean;
  thank_you_date: string;
  thank_you_method: ThankYouMethod | '';
  invited_to_event: boolean;
  event_invitation_details: string;
  stewardship_notes: string;
}

// ─── Style tokens (matching EngagementForm) ──────────────────
const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-0.5';

const TARGET_TYPE_ICONS: Record<string, React.ReactNode> = {
  legislator: <Heart className="w-4 h-4" />,
  organization: <Heart className="w-4 h-4" />,
  contact: <Heart className="w-4 h-4" />,
  leg_staff: <Heart className="w-4 h-4" />,
  other: <Heart className="w-4 h-4" />,
};

const TARGET_TYPE_COLORS: Record<string, string> = {
  legislator: 'border-purple-300 bg-purple-50 text-purple-700',
  organization: 'border-blue-300 bg-blue-50 text-blue-700',
  contact: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  leg_staff: 'border-amber-300 bg-amber-50 text-amber-700',
  other: 'border-gray-300 bg-gray-50 text-gray-700',
};

const emptyForm: SupportAskFormData = {
  requester_id: '',
  target_type: 'legislator',
  target_legislator_people_id: null,
  target_contact_id: '',
  target_organization_id: '',
  target_leg_staff_id: '',
  target_name: '',
  ask_date: new Date().toISOString().split('T')[0],
  outreach_method: 'email',
  initiative: '',
  support_type_requested: 'letter_of_support',
  ask_notes: '',
  support_status: 'pending',
  follow_up_date: '',
  follow_up_notes: '',
  support_type_provided: '',
  support_received_date: '',
  thank_you_sent: false,
  thank_you_date: '',
  thank_you_method: '',
  invited_to_event: false,
  event_invitation_details: '',
  stewardship_notes: '',
};

// ─── Session storage helpers ─────────────────────────────────
const DRAFT_KEY = 'support-ask-draft';

function saveDraft(data: { formData: SupportAskFormData; billIds: string[] }) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
}

function loadDraft(): ReturnType<typeof JSON.parse> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
}

// ─── Searchable Target Dropdown ──────────────────────────────
interface SearchableDropdownProps {
  options: { value: string; label: string; sublabel?: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options, value, onChange, placeholder = 'Search...', loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      {value && selected ? (
        <div className="flex items-center gap-2 border border-gray-200 rounded-md px-2.5 py-1.5">
          <div className="flex-1 min-w-0">
            <span className="text-sm text-gray-900">{selected.label}</span>
            {selected.sublabel && (
              <span className="ml-2 text-xs text-gray-400">{selected.sublabel}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onChange(''); setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="text-gray-400 hover:text-red-600 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 border rounded-md px-2.5 py-1.5 transition-all cursor-text ${
            isOpen ? 'border-teal-500 ring-2 ring-teal-100' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        >
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
            onFocus={() => setIsOpen(true)}
            placeholder={loading ? 'Loading...' : placeholder}
            className="flex-1 outline-none text-sm bg-transparent"
          />
        </div>
      )}

      {isOpen && !value && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              {query ? 'No matches found' : 'No options available'}
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setIsOpen(false);
                  setQuery('');
                }}
                className="w-full px-3 py-2 text-left hover:bg-teal-50 transition-colors"
              >
                <span className="text-sm text-gray-900">{o.label}</span>
                {o.sublabel && (
                  <span className="ml-2 text-xs text-gray-400">{o.sublabel}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────
const SupportAskForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, effectiveUserId, hasModule } = useAuth();
  const isEditing = Boolean(id);

  // Restore draft for NEW support asks only
  const draft = !isEditing ? loadDraft() : null;

  const [formData, setFormData] = useState<SupportAskFormData>(() => {
    const base = draft?.formData || { ...emptyForm };
    if (!isEditing && effectiveUserId && !draft?.formData) {
      base.requester_id = effectiveUserId;
    }
    return base;
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Collapsible sections
  const [conversionOpen, setConversionOpen] = useState(false);
  const [stewardshipOpen, setStewardshipOpen] = useState(false);

  // Linked bills
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>(draft?.billIds || []);

  // Dropdown data
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([]);
  const [legislatorOptions, setLegislatorOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [organizationOptions, setOrganizationOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [contactOptions, setContactOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [legStaffOptions, setLegStaffOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [billOptions, setBillOptions] = useState<MultiSelectOption[]>([]);
  const [initiativeOptions, setInitiativeOptions] = useState<string[]>([]);

  const [legislatorsLoading, setLegislatorsLoading] = useState(false);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [legStaffLoading, setLegStaffLoading] = useState(false);

  // Stewardship enabled when status is committed or received
  const stewardshipEnabled = formData.support_status === 'committed' || formData.support_status === 'received';

  // Persist draft (new only)
  useEffect(() => {
    if (isEditing) return;
    saveDraft({ formData, billIds: selectedBillIds });
  }, [formData, selectedBillIds, isEditing]);

  // Set default requester when effectiveUserId loads
  useEffect(() => {
    if (!isEditing && effectiveUserId && !formData.requester_id) {
      setFormData((prev) => ({ ...prev, requester_id: effectiveUserId }));
    }
  }, [effectiveUserId, isEditing]);

  // Fetch all lookup data on mount
  useEffect(() => {
    fetchLookupData();
    if (id) fetchSupportAsk();
  }, [id]);

  // Auto-open conversion section when editing and status isn't pending
  useEffect(() => {
    if (isEditing && formData.support_status !== 'pending') {
      setConversionOpen(true);
    }
  }, [isEditing, formData.support_status]);

  // Auto-open stewardship section when editing and has stewardship data
  useEffect(() => {
    if (isEditing && (formData.thank_you_sent || formData.invited_to_event || formData.stewardship_notes)) {
      setStewardshipOpen(true);
    }
  }, [isEditing, formData.thank_you_sent, formData.invited_to_event, formData.stewardship_notes]);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchLookupData = async () => {
    // Users
    const { data: usersData } = await supabase
      .from('users').select('id, email, full_name').eq('is_active', true).order('full_name');
    setUserOptions(
      (usersData || []).map((u: any) => ({ value: u.id, label: u.full_name || u.email })),
    );

    // Bills
    const { data: billsData } = await supabase
      .from('bills').select('id, bill_number, title').order('bill_number');
    setBillOptions(
      (billsData || []).map((b: any) => ({
        value: b.id,
        label: b.bill_number,
        sublabel: b.title,
      })),
    );

    // Legislators
    setLegislatorsLoading(true);
    const { data: legsData } = await supabase
      .from('legiscan_legislators').select('people_id, name, party, chamber, district, state').order('name');
    setLegislatorOptions(
      (legsData || []).map((l: any) => ({
        value: String(l.people_id),
        label: `${l.name}${l.party ? ` (${l.party})` : ''}`,
        sublabel: [l.state, l.chamber, l.district ? `Dist. ${l.district}` : ''].filter(Boolean).join(' - '),
      })),
    );
    setLegislatorsLoading(false);

    // Organizations
    setOrgsLoading(true);
    const { data: orgsData } = await supabase
      .from('organizations').select('id, name, city, state').order('name');
    setOrganizationOptions(
      (orgsData || []).map((o: any) => ({
        value: o.id,
        label: o.name,
        sublabel: [o.city, o.state].filter(Boolean).join(', ') || undefined,
      })),
    );
    setOrgsLoading(false);

    // Contacts
    setContactsLoading(true);
    const { data: contactsData } = await supabase
      .from('contacts').select('id, first_name, last_name, title').order('last_name');
    setContactOptions(
      (contactsData || []).map((c: any) => ({
        value: c.id,
        label: `${c.first_name} ${c.last_name}`,
        sublabel: c.title || undefined,
      })),
    );
    setContactsLoading(false);

    // Legislative Staff
    setLegStaffLoading(true);
    const { data: legStaffData } = await supabase
      .from('legislative_office_staff')
      .select('id, first_name, last_name, title, office_id')
      .eq('is_active', true)
      .order('last_name');
    setLegStaffOptions(
      (legStaffData || []).map((s: any) => ({
        value: s.id,
        label: `${s.first_name} ${s.last_name}`,
        sublabel: s.title || undefined,
      })),
    );
    setLegStaffLoading(false);

    // Initiatives
    const initOpts = await getInitiativeOptions();
    setInitiativeOptions(initOpts);
  };

  const fetchSupportAsk = async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase.from('support_asks').select('*').eq('id', id).single();
    if (error || !data) { navigate('/advocacy/support-campaigns'); return; }

    setFormData({
      requester_id: data.requester_id || '',
      target_type: data.target_type || 'legislator',
      target_legislator_people_id: data.target_legislator_people_id || null,
      target_contact_id: data.target_contact_id || '',
      target_organization_id: data.target_organization_id || '',
      target_leg_staff_id: data.target_leg_staff_id || '',
      target_name: data.target_name || '',
      ask_date: data.ask_date || '',
      outreach_method: data.outreach_method || 'email',
      initiative: data.initiative || '',
      support_type_requested: data.support_type_requested || 'letter_of_support',
      ask_notes: data.ask_notes || '',
      support_status: data.support_status || 'pending',
      follow_up_date: data.follow_up_date || '',
      follow_up_notes: data.follow_up_notes || '',
      support_type_provided: data.support_type_provided || '',
      support_received_date: data.support_received_date || '',
      thank_you_sent: data.thank_you_sent || false,
      thank_you_date: data.thank_you_date || '',
      thank_you_method: data.thank_you_method || '',
      invited_to_event: data.invited_to_event || false,
      event_invitation_details: data.event_invitation_details || '',
      stewardship_notes: data.stewardship_notes || '',
    });

    // Fetch junction bills
    const { data: billJunc } = await supabase
      .from('support_ask_bills').select('bill_id').eq('support_ask_id', id);
    setSelectedBillIds((billJunc || []).map((r: any) => r.bill_id));

    setLoading(false);
  };

  const handleInputChange = (field: keyof SupportAskFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    // Build target fields based on target_type
    const targetFields = {
      target_legislator_people_id: formData.target_type === 'legislator' ? formData.target_legislator_people_id : null,
      target_contact_id: formData.target_type === 'contact' ? formData.target_contact_id || null : null,
      target_organization_id: formData.target_type === 'organization' ? formData.target_organization_id || null : null,
      target_leg_staff_id: formData.target_type === 'leg_staff' ? formData.target_leg_staff_id || null : null,
      target_name: formData.target_type === 'other' ? formData.target_name || null : null,
    };

    const payload = {
      requester_id: formData.requester_id || effectiveUserId,
      target_type: formData.target_type,
      ...targetFields,
      ask_date: formData.ask_date,
      outreach_method: formData.outreach_method,
      initiative: formData.initiative || null,
      support_type_requested: formData.support_type_requested,
      ask_notes: formData.ask_notes || null,
      support_status: formData.support_status,
      follow_up_date: formData.follow_up_date || null,
      follow_up_notes: formData.follow_up_notes || null,
      support_type_provided: formData.support_type_provided || null,
      support_received_date: formData.support_received_date || null,
      thank_you_sent: stewardshipEnabled ? formData.thank_you_sent : false,
      thank_you_date: stewardshipEnabled && formData.thank_you_sent ? formData.thank_you_date || null : null,
      thank_you_method: stewardshipEnabled && formData.thank_you_sent ? formData.thank_you_method || null : null,
      invited_to_event: stewardshipEnabled ? formData.invited_to_event : false,
      event_invitation_details: stewardshipEnabled && formData.invited_to_event ? formData.event_invitation_details || null : null,
      stewardship_notes: stewardshipEnabled ? formData.stewardship_notes || null : null,
    };

    let supportAskId = id;

    if (isEditing) {
      const { error } = await supabase.from('support_asks').update(payload).eq('id', id);
      if (error) { console.error('Update error:', error); setSaving(false); return; }
    } else {
      const { data, error } = await supabase
        .from('support_asks')
        .insert({ ...payload, created_by: user.id })
        .select('id').single();
      if (error || !data) { console.error('Insert error:', error); setSaving(false); return; }
      supportAskId = data.id;
    }

    // Junction: delete-all + re-insert pattern for bills
    await supabase.from('support_ask_bills').delete().eq('support_ask_id', supportAskId!);

    if (selectedBillIds.length > 0) {
      await supabase.from('support_ask_bills').insert(
        selectedBillIds.map((bid) => ({
          support_ask_id: supportAskId!,
          bill_id: bid,
          created_by: user.id,
        })),
      );
    }

    setSaving(false);
    clearDraft();
    navigate('/advocacy/support-campaigns');
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this support ask?')) return;
    await supabase.from('support_asks').delete().eq('id', id);
    clearDraft();
    navigate('/advocacy/support-campaigns');
  };

  // Conversion section summary line
  const conversionSummary = (() => {
    const parts: string[] = [];
    parts.push(SUPPORT_STATUS_LABELS[formData.support_status] || formData.support_status);
    if (formData.follow_up_date) parts.push(`Follow-up: ${formData.follow_up_date}`);
    if (formData.support_type_provided) parts.push(SUPPORT_TYPE_LABELS[formData.support_type_provided] || formData.support_type_provided);
    return parts.join(' / ');
  })();

  // Stewardship summary line
  const stewardshipSummary = (() => {
    if (!stewardshipEnabled) return 'Available when status is Committed or Received';
    const parts: string[] = [];
    if (formData.thank_you_sent) parts.push('Thank You Sent');
    if (formData.invited_to_event) parts.push('Event Invitation');
    if (formData.stewardship_notes) parts.push('Has Notes');
    return parts.length > 0 ? parts.join(' / ') : 'No stewardship actions yet';
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* ─── Header ─── */}
      <div className="bg-teal-700 rounded-xl p-5 text-white shadow-sm">
        <button
          onClick={() => { clearDraft(); navigate('/advocacy/support-campaigns'); }}
          className="flex items-center text-teal-200 hover:text-white mb-2 transition-colors text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Support Tracker
        </button>
        <h1 className="text-xl font-bold flex items-center">
          <Heart className="w-5 h-5 mr-2" />
          {isEditing ? 'Edit Support Ask' : 'New Support Ask'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── Card 1: The Ask ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">The Ask</span>

          {/* Requester */}
          <div className="mt-3">
            <label className={labelClass}>Requester *</label>
            <select
              value={formData.requester_id}
              onChange={(e) => handleInputChange('requester_id', e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select requester...</option>
              {userOptions.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {/* Target Type — button row selector */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Type</span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2 mb-3">
              {(Object.keys(TARGET_TYPE_LABELS) as SupportAskTargetType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleInputChange('target_type', type)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center ${
                    formData.target_type === type
                      ? TARGET_TYPE_COLORS[type] + ' border-current'
                      : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {TARGET_TYPE_ICONS[type]}
                  <span className="text-[10px] font-medium leading-tight">{TARGET_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>

            {/* Target search by type */}
            {formData.target_type === 'legislator' && (
              <div>
                <label className={labelClass}>Legislator *</label>
                <SearchableDropdown
                  options={legislatorOptions}
                  value={formData.target_legislator_people_id ? String(formData.target_legislator_people_id) : ''}
                  onChange={(val) => handleInputChange('target_legislator_people_id', val ? Number(val) : null)}
                  placeholder="Search legislators..."
                  loading={legislatorsLoading}
                />
              </div>
            )}

            {formData.target_type === 'organization' && (
              <div>
                <label className={labelClass}>Organization *</label>
                <SearchableDropdown
                  options={organizationOptions}
                  value={formData.target_organization_id}
                  onChange={(val) => handleInputChange('target_organization_id', val)}
                  placeholder="Search organizations..."
                  loading={orgsLoading}
                />
              </div>
            )}

            {formData.target_type === 'contact' && (
              <div>
                <label className={labelClass}>Contact *</label>
                <SearchableDropdown
                  options={contactOptions}
                  value={formData.target_contact_id}
                  onChange={(val) => handleInputChange('target_contact_id', val)}
                  placeholder="Search contacts..."
                  loading={contactsLoading}
                />
              </div>
            )}

            {formData.target_type === 'leg_staff' && (
              <div>
                <label className={labelClass}>Legislative Staff *</label>
                <SearchableDropdown
                  options={legStaffOptions}
                  value={formData.target_leg_staff_id}
                  onChange={(val) => handleInputChange('target_leg_staff_id', val)}
                  placeholder="Search legislative staff..."
                  loading={legStaffLoading}
                />
              </div>
            )}

            {formData.target_type === 'other' && (
              <div>
                <label className={labelClass}>Target Name *</label>
                <input
                  type="text"
                  value={formData.target_name}
                  onChange={(e) => handleInputChange('target_name', e.target.value)}
                  placeholder="Enter target name..."
                  required
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Ask Date + Outreach Method */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Ask Date *</label>
                <input
                  type="date"
                  value={formData.ask_date}
                  onChange={(e) => handleInputChange('ask_date', e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Outreach Method *</label>
                <select
                  value={formData.outreach_method}
                  onChange={(e) => handleInputChange('outreach_method', e.target.value)}
                  required
                  className={inputClass}
                >
                  {Object.entries(OUTREACH_METHOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Initiative */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <InitiativeCombo
              value={formData.initiative}
              options={initiativeOptions}
              onChange={(val) => handleInputChange('initiative', val)}
              onAddNew={async (newVal) => {
                const updated = [...initiativeOptions, newVal].sort();
                setInitiativeOptions(updated);
                if (user) await setAdvoLinkSetting('initiative_options', updated, user.id);
              }}
            />
          </div>

          {/* Support Type Requested */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <label className={labelClass}>Support Type Requested *</label>
            <select
              value={formData.support_type_requested}
              onChange={(e) => handleInputChange('support_type_requested', e.target.value)}
              required
              className={inputClass}
            >
              {Object.entries(SUPPORT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Linked Bills */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Bills</span>
            <div className="mt-2">
              <MultiSelectDropdown
                options={billOptions}
                selected={selectedBillIds}
                onChange={setSelectedBillIds}
                placeholder="Select bills..."
                searchPlaceholder="Search by bill number or title..."
                emptyMessage="No bills tracked yet"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <label className={labelClass}>Notes</label>
            <textarea
              value={formData.ask_notes}
              onChange={(e) => handleInputChange('ask_notes', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Additional context about this ask..."
            />
          </div>
        </div>

        {/* ─── Card 2: Conversion Tracking (collapsible) ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setConversionOpen(!conversionOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversion Tracking</span>
            </div>
            <div className="flex items-center gap-3">
              {!conversionOpen && (
                <span className="text-xs text-gray-400">{conversionSummary}</span>
              )}
              {conversionOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {conversionOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
              {/* Support Status */}
              <div className="pt-3">
                <label className={labelClass}>Support Status</label>
                <select
                  value={formData.support_status}
                  onChange={(e) => handleInputChange('support_status', e.target.value)}
                  className={inputClass}
                >
                  {Object.entries(SUPPORT_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                {formData.support_status && (
                  <div className="mt-1.5">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${SUPPORT_STATUS_COLORS[formData.support_status] || ''}`}>
                      {SUPPORT_STATUS_LABELS[formData.support_status]}
                    </span>
                  </div>
                )}
              </div>

              {/* Follow-Up Date + Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Follow-Up Date</label>
                  <input
                    type="date"
                    value={formData.follow_up_date}
                    onChange={(e) => handleInputChange('follow_up_date', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Support Type Provided</label>
                  <select
                    value={formData.support_type_provided}
                    onChange={(e) => handleInputChange('support_type_provided', e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not yet received</option>
                    {Object.entries(SUPPORT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Follow-Up Notes</label>
                <textarea
                  value={formData.follow_up_notes}
                  onChange={(e) => handleInputChange('follow_up_notes', e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="Notes on follow-up actions..."
                />
              </div>

              {/* Date Support Received */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Date Support Received</label>
                  <input
                    type="date"
                    value={formData.support_received_date}
                    onChange={(e) => handleInputChange('support_received_date', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── Card 3: Stewardship (collapsible) ─── */}
        <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${!stewardshipEnabled ? 'opacity-60' : ''}`}>
          <button
            type="button"
            onClick={() => stewardshipEnabled && setStewardshipOpen(!stewardshipOpen)}
            className={`w-full flex items-center justify-between p-4 transition-colors ${
              stewardshipEnabled ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stewardship</span>
            </div>
            <div className="flex items-center gap-3">
              {!stewardshipOpen && (
                <span className="text-xs text-gray-400">{stewardshipSummary}</span>
              )}
              {stewardshipOpen ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {stewardshipOpen && stewardshipEnabled && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
              {/* Thank You Sent toggle */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thank You Sent</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange('thank_you_sent', !formData.thank_you_sent)}
                    className={`relative w-8 h-4.5 rounded-full transition-colors ${
                      formData.thank_you_sent ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                      formData.thank_you_sent ? 'translate-x-3.5' : ''
                    }`} />
                  </button>
                </div>

                {formData.thank_you_sent && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>Thank You Date</label>
                      <input
                        type="date"
                        value={formData.thank_you_date}
                        onChange={(e) => handleInputChange('thank_you_date', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Thank You Method</label>
                      <select
                        value={formData.thank_you_method}
                        onChange={(e) => handleInputChange('thank_you_method', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select method...</option>
                        {Object.entries(THANK_YOU_METHOD_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Invited to Event toggle */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invited to Event / Base Visit</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange('invited_to_event', !formData.invited_to_event)}
                    className={`relative w-8 h-4.5 rounded-full transition-colors ${
                      formData.invited_to_event ? 'bg-teal-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                      formData.invited_to_event ? 'translate-x-3.5' : ''
                    }`} />
                  </button>
                </div>

                {formData.invited_to_event && (
                  <div>
                    <label className={labelClass}>Event Invitation Details</label>
                    <textarea
                      value={formData.event_invitation_details}
                      onChange={(e) => handleInputChange('event_invitation_details', e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-none`}
                      placeholder="Details about the event invitation..."
                    />
                  </div>
                )}
              </div>

              {/* Stewardship Notes */}
              <div className="border-t border-gray-100 pt-3">
                <label className={labelClass}>Stewardship Notes</label>
                <textarea
                  value={formData.stewardship_notes}
                  onChange={(e) => handleInputChange('stewardship_notes', e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Additional stewardship notes..."
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── Actions ─── */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { clearDraft(); navigate('/advocacy/support-campaigns'); }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.ask_date || !formData.requester_id}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SupportAskForm;
