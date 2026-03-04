import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Handshake, ArrowLeft, Save, Loader2, Trash2,
  Users, UserCircle, Building2, Gavel, Calendar, Plus, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { GAEngagementType, LegiscanLegislator, LegislativeOffice, LegislativeOfficeStaff } from '../../types';
import { GA_ENGAGEMENT_TYPE_LABELS, GA_ASSOCIATION_OPTIONS, US_STATES } from '../../lib/bill-format';
import { getLegislators, getOurStates, getAssociationOptions, getInitiativeOptions, getLocationOptions, setAdvoLinkSetting } from '../../lib/legiscan-api';
import MultiSelectDropdown from './MultiSelectDropdown';
import type { MultiSelectOption } from './MultiSelectDropdown';
import QuickAddLegStaffModal from './QuickAddLegStaffModal';
import QuickAddLegOfficeModal from './QuickAddLegOfficeModal';
import QuickAddCommitteeStaffModal from './QuickAddCommitteeStaffModal';
import ManageLegStaffModal from './ManageLegStaffModal';
import InitiativeCombo from './InitiativeCombo';

interface EngagementFormData {
  type: GAEngagementType;
  date: string;
  duration: number | null;
  subject: string;
  notes: string;
  topics_covered: string;
  jurisdiction: string;
  meeting_level: 'member' | 'staff' | '';
  association_name: string;
  entity_name: string;
  initiative: string;
  meeting_location: string;
  meeting_location_detail: string;
  follow_up_required: boolean;
  follow_up_date: string;
  follow_up_notes: string;
  follow_up_completed: boolean;
  follow_up_assigned_to: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lobby_team: <Users className="w-4 h-4" />,
  ga_committee: <Building2 className="w-4 h-4" />,
  legislator_office: <UserCircle className="w-4 h-4" />,
  committee_meeting: <Gavel className="w-4 h-4" />,
  federal_state_entity: <Building2 className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  lobby_team: 'border-blue-300 bg-blue-50 text-blue-700',
  ga_committee: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  legislator_office: 'border-purple-300 bg-purple-50 text-purple-700',
  committee_meeting: 'border-amber-300 bg-amber-50 text-amber-700',
  federal_state_entity: 'border-rose-300 bg-rose-50 text-rose-700',
};

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-0.5';

const emptyForm: EngagementFormData = {
  type: 'lobby_team',
  date: new Date().toISOString().split('T')[0],
  duration: null,
  subject: '',
  notes: '',
  topics_covered: '',
  jurisdiction: '',
  meeting_level: '',
  association_name: '',
  entity_name: '',
  initiative: '',
  meeting_location: '',
  meeting_location_detail: '',
  follow_up_required: false,
  follow_up_date: '',
  follow_up_notes: '',
  follow_up_completed: false,
  follow_up_assigned_to: '',
};

// ─── Session storage helpers to survive page reloads / desktop switches ───
const DRAFT_KEY = 'engagement-draft';

function saveDraft(data: {
  formData: EngagementFormData;
  billIds: string[];
  staffIds: string[];
  contactIds: string[];
  legislatorIds: string[];
  legStaffIds: string[];
  committeeOfficeId: string;
  committeeStaffIds: string[];
  guests: { name: string; organization: string }[];
}) {
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

const EngagementForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasModule } = useAuth();
  const isEditing = Boolean(id);

  // Restore draft for NEW engagements only (not edits)
  const draft = !isEditing ? loadDraft() : null;

  const [formData, setFormData] = useState<EngagementFormData>(draft?.formData || emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Multi-select state — existing junctions
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>(draft?.billIds || []);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(draft?.staffIds || []);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(draft?.contactIds || []);

  // Multi-select state — new junctions
  const [selectedLegislatorIds, setSelectedLegislatorIds] = useState<string[]>(draft?.legislatorIds || []);
  const [selectedLegStaffIds, setSelectedLegStaffIds] = useState<string[]>(draft?.legStaffIds || []);

  // Committee state
  const [committeeOffices, setCommitteeOffices] = useState<LegislativeOffice[]>([]);
  const [selectedCommitteeOfficeId, setSelectedCommitteeOfficeId] = useState<string>(draft?.committeeOfficeId || '');
  const [committeeStaffOptions, setCommitteeStaffOptions] = useState<MultiSelectOption[]>([]);
  const [selectedCommitteeStaffIds, setSelectedCommitteeStaffIds] = useState<string[]>(draft?.committeeStaffIds || []);

  // Guests (lobby_team type)
  const [guests, setGuests] = useState<{ name: string; organization: string }[]>(draft?.guests || []);

  // Chamber filter for legislator picker
  const [chamberFilter, setChamberFilter] = useState('');

  // Dropdown options
  const [allBillOptions, setAllBillOptions] = useState<(MultiSelectOption & { jurisdiction?: string })[]>([]);
  const [staffOptions, setStaffOptions] = useState<MultiSelectOption[]>([]);
  const [psgContactOptions, setPsgContactOptions] = useState<MultiSelectOption[]>([]);
  const [legislators, setLegislators] = useState<LegiscanLegislator[]>([]);
  const [legislatorsLoading, setLegislatorsLoading] = useState(false);
  const [legStaffOptions, setLegStaffOptions] = useState<MultiSelectOption[]>([]);
  const [, setLegStaffRecords] = useState<LegislativeOfficeStaff[]>([]);
  const [ourStates, setOurStates] = useState<string[]>([]);
  const [associationOptions, setAssociationOptions] = useState<string[]>([]);
  const [initiativeOptions, setInitiativeOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  // Modal state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showManageStaffModal, setShowManageStaffModal] = useState(false);
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [showAddCommitteeStaffModal, setShowAddCommitteeStaffModal] = useState(false);

  // Persist draft to sessionStorage on every change (new engagements only)
  useEffect(() => {
    if (isEditing) return;
    saveDraft({
      formData,
      billIds: selectedBillIds,
      staffIds: selectedStaffIds,
      contactIds: selectedContactIds,
      legislatorIds: selectedLegislatorIds,
      legStaffIds: selectedLegStaffIds,
      committeeOfficeId: selectedCommitteeOfficeId,
      committeeStaffIds: selectedCommitteeStaffIds,
      guests,
    });
  }, [formData, selectedBillIds, selectedStaffIds, selectedContactIds, guests,
      selectedLegislatorIds, selectedLegStaffIds, selectedCommitteeOfficeId,
      selectedCommitteeStaffIds, isEditing]);

  useEffect(() => {
    fetchLookupData();
    fetchCommitteeOffices();
    if (id) fetchEngagement();
    getOurStates().then(setOurStates);
    getAssociationOptions().then((opts) => setAssociationOptions(opts.length > 0 ? opts : GA_ASSOCIATION_OPTIONS));
    getInitiativeOptions().then(setInitiativeOptions);
    getLocationOptions().then(setLocationOptions);
  }, [id]);

  // Fetch legislators when jurisdiction changes (for legislator_office type)
  useEffect(() => {
    if (formData.jurisdiction && (formData.type === 'legislator_office' || formData.type === 'committee_meeting')) {
      const fetchLegs = async () => {
        setLegislatorsLoading(true);
        let result = await getLegislators(formData.jurisdiction);
        // For Federal (US), getSessionPeople often returns nothing.
        // Fall back to ALL cached legislators so users can search across states.
        if (result.length === 0 && formData.jurisdiction === 'US') {
          result = await getLegislators();
        }
        setLegislators(result);
        setLegislatorsLoading(false);
      };
      fetchLegs();
    }
  }, [formData.jurisdiction, formData.type]);

  // Fetch leg staff when selected legislators change
  useEffect(() => {
    if (selectedLegislatorIds.length > 0) {
      fetchLegStaffForLegislators(selectedLegislatorIds.map(Number));
    } else {
      setLegStaffOptions([]);
      setLegStaffRecords([]);
    }
  }, [selectedLegislatorIds]);

  // Fetch committee staff when selected committee changes
  useEffect(() => {
    if (selectedCommitteeOfficeId) {
      fetchCommitteeStaff(selectedCommitteeOfficeId);
    } else {
      setCommitteeStaffOptions([]);
      setSelectedCommitteeStaffIds([]);
    }
  }, [selectedCommitteeOfficeId]);

  // Bill options filtered by jurisdiction
  const billOptions = useMemo(() => {
    if (!formData.jurisdiction) return allBillOptions;
    return allBillOptions.filter(
      (b) => !b.jurisdiction || b.jurisdiction === formData.jurisdiction || selectedBillIds.includes(b.value)
    );
  }, [allBillOptions, formData.jurisdiction, selectedBillIds]);

  // Legislator options filtered by chamber
  // LegiScan stores chamber as "Sen"/"Rep", filter values are "senate"/"house"/"assembly"
  const CHAMBER_MAP: Record<string, string[]> = {
    senate: ['sen', 'senate'],
    house: ['rep', 'house'],
    assembly: ['asm', 'assembly'],
  };
  const legislatorOptions = useMemo<MultiSelectOption[]>(() => {
    let filtered = legislators;
    if (chamberFilter) {
      const matches = CHAMBER_MAP[chamberFilter] || [chamberFilter];
      filtered = legislators.filter((l) => {
        const ch = (l.chamber || '').toLowerCase();
        return matches.some((m) => ch.includes(m) || m.includes(ch));
      });
    }
    return filtered.map((l) => ({
      value: String(l.people_id),
      label: `${l.name} (${l.party || '?'})`,
      sublabel: `${l.chamber || ''} ${l.district ? `- District ${l.district}` : ''}`.trim(),
    }));
  }, [legislators, chamberFilter]);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchLookupData = async () => {
    const { data: billsData } = await supabase
      .from('bills').select('id, bill_number, title, jurisdiction').order('bill_number');
    setAllBillOptions(
      (billsData || []).map((b: any) => ({
        value: b.id,
        label: b.bill_number,
        sublabel: b.title,
        jurisdiction: b.jurisdiction,
      }))
    );

    const { data: staffData } = await supabase
      .from('users').select('id, email, full_name').eq('is_active', true).order('full_name');
    setStaffOptions(
      (staffData || []).map((s: any) => ({ value: s.id, label: s.full_name || s.email }))
    );

    // PSG + WCS Contacts
    const { data: psgOrgs } = await supabase
      .from('organizations')
      .select('id, name')
      .or('name.ilike.%primacy%,name.ilike.%wisconsin capitol%');

    if (psgOrgs && psgOrgs.length > 0) {
      const orgIds = psgOrgs.map((o: any) => o.id);
      const { data: affiliations } = await supabase
        .from('contact_organizations').select('contact_id').in('organization_id', orgIds);

      if (affiliations && affiliations.length > 0) {
        const contactIds = [...new Set(affiliations.map((a: any) => a.contact_id))];
        const { data: contactsData } = await supabase
          .from('contacts').select('id, first_name, last_name, title').in('id', contactIds).order('last_name');
        setPsgContactOptions(
          (contactsData || []).map((c: any) => ({
            value: c.id,
            label: `${c.first_name} ${c.last_name}`,
            sublabel: c.title || undefined,
          }))
        );
      }
    }
  };

  const fetchCommitteeOffices = async () => {
    const { data } = await supabase
      .from('legislative_offices')
      .select('*')
      .eq('office_type', 'committee')
      .order('name');
    setCommitteeOffices((data || []) as LegislativeOffice[]);
  };

  const fetchCommitteeStaff = async (officeId: string) => {
    const { data } = await supabase
      .from('legislative_office_staff')
      .select('*')
      .eq('office_id', officeId)
      .neq('is_active', false)
      .order('last_name');
    const records = (data || []) as LegislativeOfficeStaff[];
    setCommitteeStaffOptions(
      records.map((s) => ({
        value: s.id,
        label: `${s.first_name} ${s.last_name}`,
        sublabel: s.title || undefined,
      }))
    );
  };

  const fetchLegStaffForLegislators = async (peopleIds: number[]) => {
    // Get offices for these legislators, then get staff for those offices
    const { data: offices } = await supabase
      .from('legislative_offices')
      .select('id, legislator_people_id')
      .in('legislator_people_id', peopleIds);

    if (!offices || offices.length === 0) {
      setLegStaffOptions([]);
      setLegStaffRecords([]);
      return;
    }

    const officeIds = offices.map((o: any) => o.id);
    const { data: staffData } = await supabase
      .from('legislative_office_staff')
      .select('*')
      .in('office_id', officeIds)
      .order('last_name');

    const records = (staffData || []) as (LegislativeOfficeStaff & { is_active?: boolean })[];
    setLegStaffRecords(records as LegislativeOfficeStaff[]);
    setLegStaffOptions(
      records
        .filter((s) => s.is_active !== false)
        .map((s) => ({
          value: s.id,
          label: `${s.first_name} ${s.last_name}`,
          sublabel: s.title || undefined,
        }))
    );
  };

  const fetchEngagement = async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase.from('ga_engagements').select('*').eq('id', id).single();
    if (error || !data) { navigate('/advocacy/engagements'); return; }

    setFormData({
      type: data.type,
      date: data.date,
      duration: data.duration,
      subject: data.subject,
      notes: data.notes || '',
      topics_covered: data.topics_covered || '',
      jurisdiction: data.jurisdiction || '',
      meeting_level: data.meeting_level || '',
      association_name: data.association_name || '',
      entity_name: data.entity_name || '',
      initiative: data.initiative || '',
      meeting_location: data.meeting_location || '',
      meeting_location_detail: data.meeting_location_detail || '',
      follow_up_required: data.follow_up_required || false,
      follow_up_date: data.follow_up_date || '',
      follow_up_notes: data.follow_up_notes || '',
      follow_up_completed: data.follow_up_completed || false,
      follow_up_assigned_to: data.follow_up_assigned_to || '',
    });

    // Restore committee office selection
    if (data.committee_office_id) {
      setSelectedCommitteeOfficeId(data.committee_office_id);
    }

    // Restore guests
    if (data.guests && Array.isArray(data.guests)) {
      setGuests(data.guests);
    }

    // Fetch all junction data
    const [billJunc, staffJunc, contactJunc, legJunc, legStaffJunc] = await Promise.all([
      supabase.from('ga_engagement_bills').select('bill_id').eq('engagement_id', id),
      supabase.from('ga_engagement_staff').select('user_id').eq('engagement_id', id),
      supabase.from('ga_engagement_contacts').select('contact_id').eq('engagement_id', id),
      supabase.from('ga_engagement_legislators').select('people_id').eq('engagement_id', id),
      supabase.from('ga_engagement_leg_staff').select('staff_id').eq('engagement_id', id),
    ]);
    setSelectedBillIds((billJunc.data || []).map((r) => r.bill_id));
    setSelectedStaffIds((staffJunc.data || []).map((r) => r.user_id));
    setSelectedContactIds((contactJunc.data || []).map((r) => r.contact_id));
    setSelectedLegislatorIds((legJunc.data || []).map((r) => String(r.people_id)));

    // For committee_meeting, staff IDs also come from leg_staff junction
    const allLegStaffIds = (legStaffJunc.data || []).map((r) => r.staff_id);
    if (data.type === 'committee_meeting' && data.committee_office_id) {
      setSelectedCommitteeStaffIds(allLegStaffIds);
    } else {
      setSelectedLegStaffIds(allLegStaffIds);
    }

    setLoading(false);
  };

  const handleInputChange = (field: keyof EngagementFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      type: formData.type,
      date: formData.date,
      duration: formData.duration,
      subject: formData.subject,
      notes: formData.notes || null,
      topics_covered: formData.topics_covered || null,
      jurisdiction: formData.jurisdiction || null,
      // Keep meeting_level on main record for legislator_office type
      meeting_level: formData.type === 'legislator_office' ? formData.meeting_level || null : null,
      // Clear legacy single-legislator fields (now using junction table)
      legislator_people_id: null,
      legislator_name: null,
      association_name: formData.type === 'ga_committee' ? formData.association_name || null : null,
      entity_name: formData.type === 'federal_state_entity' ? formData.entity_name || null : null,
      initiative: formData.initiative || null,
      meeting_location: formData.meeting_location || null,
      meeting_location_detail: formData.meeting_location_detail || null,
      committee_office_id: formData.type === 'committee_meeting' ? selectedCommitteeOfficeId || null : null,
      guests: formData.type === 'lobby_team' ? guests.filter((g) => g.name.trim()) : [],
      follow_up_required: formData.follow_up_required,
      follow_up_date: formData.follow_up_required ? formData.follow_up_date || null : null,
      follow_up_notes: formData.follow_up_required ? formData.follow_up_notes || null : null,
      follow_up_completed: formData.follow_up_completed,
      follow_up_assigned_to: formData.follow_up_required ? formData.follow_up_assigned_to || null : null,
    };

    let engagementId = id;

    if (isEditing) {
      const { error } = await supabase.from('ga_engagements').update(payload).eq('id', id);
      if (error) { setSaving(false); return; }
    } else {
      const { data, error } = await supabase
        .from('ga_engagements')
        .insert({ ...payload, created_by: user.id })
        .select('id').single();
      if (error || !data) { setSaving(false); return; }
      engagementId = data.id;
    }

    // Delete all junction rows then re-insert (same pattern as before + new tables)
    await Promise.all([
      supabase.from('ga_engagement_bills').delete().eq('engagement_id', engagementId!),
      supabase.from('ga_engagement_staff').delete().eq('engagement_id', engagementId!),
      supabase.from('ga_engagement_contacts').delete().eq('engagement_id', engagementId!),
      supabase.from('ga_engagement_legislators').delete().eq('engagement_id', engagementId!),
      supabase.from('ga_engagement_leg_staff').delete().eq('engagement_id', engagementId!),
    ]);

    // Determine which leg staff IDs to save (committee or legislator staff)
    const legStaffIdsToSave = formData.type === 'committee_meeting'
      ? selectedCommitteeStaffIds
      : selectedLegStaffIds;

    const inserts = [];
    if (selectedBillIds.length > 0) {
      inserts.push(supabase.from('ga_engagement_bills').insert(
        selectedBillIds.map((bid) => ({ engagement_id: engagementId!, bill_id: bid, created_by: user.id }))
      ));
    }
    if (selectedStaffIds.length > 0) {
      inserts.push(supabase.from('ga_engagement_staff').insert(
        selectedStaffIds.map((uid) => ({ engagement_id: engagementId!, user_id: uid, created_by: user.id }))
      ));
    }
    if (selectedContactIds.length > 0) {
      inserts.push(supabase.from('ga_engagement_contacts').insert(
        selectedContactIds.map((cid) => ({ engagement_id: engagementId!, contact_id: cid, created_by: user.id }))
      ));
    }
    if (selectedLegislatorIds.length > 0) {
      inserts.push(supabase.from('ga_engagement_legislators').insert(
        selectedLegislatorIds.map((pid) => ({ engagement_id: engagementId!, people_id: Number(pid), created_by: user.id }))
      ));
    }
    if (legStaffIdsToSave.length > 0) {
      inserts.push(supabase.from('ga_engagement_leg_staff').insert(
        legStaffIdsToSave.map((sid) => ({ engagement_id: engagementId!, staff_id: sid, created_by: user.id }))
      ));
    }
    await Promise.all(inserts);

    setSaving(false);
    clearDraft();
    navigate('/advocacy/engagements');
  };

  const handleDelete = async () => {
    if (!id || !confirm('Are you sure you want to delete this engagement?')) return;
    await supabase.from('ga_engagements').delete().eq('id', id);
    clearDraft();
    navigate('/advocacy/engagements');
  };

  // Get the actual LegiscanLegislator objects for selected IDs (for passing to modals)
  const selectedLegislatorObjects = useMemo(
    () => legislators.filter((l) => selectedLegislatorIds.includes(String(l.people_id))),
    [legislators, selectedLegislatorIds]
  );

  // Get the selected committee office object for the modal
  const selectedCommitteeOffice = useMemo(
    () => committeeOffices.find((o) => o.id === selectedCommitteeOfficeId),
    [committeeOffices, selectedCommitteeOfficeId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-5 text-white shadow-sm">
        <button
          onClick={() => { clearDraft(); navigate('/advocacy/engagements'); }}
          className="flex items-center text-teal-200 hover:text-white mb-2 transition-colors text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to Engagements
        </button>
        <h1 className="text-xl font-bold flex items-center">
          <Handshake className="w-5 h-5 mr-2" />
          {isEditing ? 'Edit Engagement' : 'Log Engagement'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ─── Card 1: Type + Core + Conditional + Bills + Attendees ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {/* Engagement Type */}
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</span>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2 mb-4">
            {(Object.keys(GA_ENGAGEMENT_TYPE_LABELS) as GAEngagementType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleInputChange('type', type)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-center ${
                  formData.type === type
                    ? TYPE_COLORS[type] + ' border-current'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {TYPE_ICONS[type]}
                <span className="text-[10px] font-medium leading-tight">{GA_ENGAGEMENT_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>

          {/* Date / Duration / Jurisdiction — always visible, right after type */}
          <div className="border-t border-gray-100 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <label className={labelClass}>Date *</label>
                <input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Duration (min)</label>
                <input type="number" value={formData.duration ?? ''} onChange={(e) => handleInputChange('duration', e.target.value ? Number(e.target.value) : null)} min={0} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Jurisdiction</label>
                <select value={formData.jurisdiction} onChange={(e) => handleInputChange('jurisdiction', e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {(ourStates.length > 0
                    ? US_STATES.filter((s) => ourStates.includes(s.value))
                    : US_STATES
                  ).map((s) => (
                    <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Meeting Location */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
              <div>
                <label className={labelClass}>Meeting Location</label>
                <select
                  value={formData.meeting_location}
                  onChange={(e) => {
                    handleInputChange('meeting_location', e.target.value);
                    if (e.target.value !== 'other') handleInputChange('meeting_location_detail', '');
                  }}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  <option value="virtual">Virtual</option>
                  <option value="in_person">In-Person</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {formData.meeting_location === 'other' && (
                <div className="md:col-span-3">
                  <label className={labelClass}>Location</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.meeting_location_detail}
                      onChange={(e) => handleInputChange('meeting_location_detail', e.target.value)}
                      list="location-suggestions"
                      placeholder="Type or select a location..."
                      className={inputClass}
                      onBlur={async () => {
                        const val = formData.meeting_location_detail.trim();
                        if (val && !locationOptions.includes(val) && user) {
                          const updated = [...locationOptions, val].sort();
                          setLocationOptions(updated);
                          await setAdvoLinkSetting('location_options', updated, user.id);
                        }
                      }}
                    />
                    <datalist id="location-suggestions">
                      {locationOptions.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}
              {formData.meeting_location === 'in_person' && (formData.type === 'legislator_office' || formData.type === 'committee_meeting') && (
                <div className="md:col-span-3 flex items-end">
                  <p className="text-xs text-gray-400 italic pb-2">Legislator/committee office assumed</p>
                </div>
              )}
            </div>
          </div>

          {/* Type-specific fields ABOVE Subject */}
          {formData.type === 'ga_committee' && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <label className={labelClass}>Association</label>
              <select value={formData.association_name} onChange={(e) => handleInputChange('association_name', e.target.value)} className={inputClass}>
                <option value="">Select association...</option>
                {associationOptions.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
            </div>
          )}

          {formData.type === 'legislator_office' && (
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Chamber</label>
                  <select value={chamberFilter} onChange={(e) => setChamberFilter(e.target.value)} className={inputClass}>
                    <option value="">All chambers</option>
                    <option value="senate">Senate</option>
                    <option value="house">House</option>
                    <option value="assembly">Assembly</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Meeting Level</label>
                  <select value={formData.meeting_level} onChange={(e) => handleInputChange('meeting_level', e.target.value)} className={inputClass}>
                    <option value="">Select...</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
              </div>

              {/* Legislator picker */}
              <div>
                <label className={labelClass}>Legislators Met</label>
                <MultiSelectDropdown
                  options={legislatorOptions}
                  selected={selectedLegislatorIds}
                  onChange={setSelectedLegislatorIds}
                  placeholder={legislatorsLoading ? 'Loading legislators...' : legislators.length > 0 ? 'Select legislators...' : !formData.jurisdiction ? 'Select jurisdiction first...' : 'No legislators found'}
                  searchPlaceholder="Search legislators..."
                  emptyMessage={formData.jurisdiction ? 'No legislators found' : 'Select a jurisdiction to load legislators'}
                />
              </div>

              {/* Legislative staff picker — visible when legislators selected */}
              {selectedLegislatorIds.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className={labelClass}>Legislative Staff Met</label>
                    <button
                      type="button"
                      onClick={() => setShowManageStaffModal(true)}
                      className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                    >
                      <Users className="w-3 h-3" />
                      Manage Staff
                    </button>
                  </div>
                  <MultiSelectDropdown
                    options={legStaffOptions}
                    selected={selectedLegStaffIds}
                    onChange={setSelectedLegStaffIds}
                    placeholder="Select staff..."
                    searchPlaceholder="Search staff..."
                    emptyMessage="No staff on file — use Manage Staff to add"
                    actionButton={
                      <button
                        type="button"
                        onClick={() => setShowAddStaffModal(true)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Quick Add
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          )}

          {formData.type === 'committee_meeting' && (
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
              {/* Committee office dropdown */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className={labelClass}>Committee</label>
                  <button
                    type="button"
                    onClick={() => setShowAddOfficeModal(true)}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Committee
                  </button>
                </div>
                <select
                  value={selectedCommitteeOfficeId}
                  onChange={(e) => setSelectedCommitteeOfficeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select committee...</option>
                  {committeeOffices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}{o.state ? ` (${o.state})` : ''}{o.chamber ? ` — ${o.chamber}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Committee staff picker */}
              {selectedCommitteeOfficeId && (
                <div>
                  <label className={labelClass}>Committee Staff Met</label>
                  <MultiSelectDropdown
                    options={committeeStaffOptions}
                    selected={selectedCommitteeStaffIds}
                    onChange={setSelectedCommitteeStaffIds}
                    placeholder="Select staff..."
                    searchPlaceholder="Search staff..."
                    emptyMessage="No staff on file for this committee"
                    actionButton={
                      <button
                        type="button"
                        onClick={() => setShowAddCommitteeStaffModal(true)}
                        className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Staff
                      </button>
                    }
                  />
                </div>
              )}
            </div>
          )}

          {formData.type === 'federal_state_entity' && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <label className={labelClass}>Entity Name</label>
              <input type="text" value={formData.entity_name} onChange={(e) => handleInputChange('entity_name', e.target.value)} placeholder="Entity name" className={inputClass} />
            </div>
          )}

          {/* Subject */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div>
              <label className={labelClass}>Subject *</label>
              <input type="text" value={formData.subject} onChange={(e) => handleInputChange('subject', e.target.value)} required className={inputClass} />
            </div>
          </div>

          {/* LL3 Attendees */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Life Link III Attendees</span>
            <div className="mt-2">
              <MultiSelectDropdown
                options={staffOptions}
                selected={selectedStaffIds}
                onChange={setSelectedStaffIds}
                placeholder="Select staff..."
                searchPlaceholder="Search staff..."
              />
            </div>
          </div>

          {/* PSG Contacts */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PSG Attendees</span>
            <p className="text-[10px] text-gray-400 mt-0.5 mb-2">Primacy Strategy Group & Wisconsin Capitol Solutions</p>
            <MultiSelectDropdown
              options={psgContactOptions}
              selected={selectedContactIds}
              onChange={setSelectedContactIds}
              placeholder="Select PSG contacts..."
              searchPlaceholder="Search contacts..."
              emptyMessage="No contacts linked to PSG or WCS"
            />
          </div>

          {/* Guests (lobby_team only) */}
          {formData.type === 'lobby_team' && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guests</span>
              <div className="mt-2 space-y-2">
                {guests.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={g.name}
                      onChange={(e) => setGuests((prev) => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))}
                      placeholder="Name"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="text"
                      value={g.organization}
                      onChange={(e) => setGuests((prev) => prev.map((p, j) => j === i ? { ...p, organization: e.target.value } : p))}
                      placeholder="Organization"
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => setGuests((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setGuests((prev) => [...prev, { name: '', organization: '' }])}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Guest
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Card 2: Initiative + Bills + Notes + Follow-up ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {/* Initiative — searchable combo with auto-save of new values */}
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

          {/* Linked Bills */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Bills</span>
            {formData.jurisdiction && (
              <span className="ml-2 text-[10px] text-gray-400">Filtered to {formData.jurisdiction}</span>
            )}
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

          <div className="border-t border-gray-100 pt-3">
            <label className={labelClass}>Notes</label>
            <textarea value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} rows={4} className={`${inputClass} resize-none`} />
          </div>

          {/* Follow-Up */}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Follow-Up
              </span>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">Required</span>
                <button
                  type="button"
                  onClick={() => handleInputChange('follow_up_required', !formData.follow_up_required)}
                  className={`relative w-8 h-4.5 rounded-full transition-colors ${
                    formData.follow_up_required ? 'bg-teal-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                    formData.follow_up_required ? 'translate-x-3.5' : ''
                  }`} />
                </button>
              </label>
            </div>

            {formData.follow_up_required && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className={labelClass}>Follow-Up Date</label>
                    <input type="date" value={formData.follow_up_date} onChange={(e) => handleInputChange('follow_up_date', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Assigned To</label>
                    <select
                      value={formData.follow_up_assigned_to}
                      onChange={(e) => handleInputChange('follow_up_assigned_to', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Unassigned</option>
                      {staffOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.follow_up_completed}
                        onChange={(e) => handleInputChange('follow_up_completed', e.target.checked)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">Completed</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Follow-Up Notes</label>
                  <textarea value={formData.follow_up_notes} onChange={(e) => handleInputChange('follow_up_notes', e.target.value)} rows={2} className={`${inputClass} resize-none`} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <div>
            {isEditing && (
              <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { clearDraft(); navigate('/advocacy/engagements'); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.subject || !formData.date}
              className="flex items-center gap-1.5 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </form>

      {/* ─── Modals ─── */}
      {showAddStaffModal && selectedLegislatorObjects.length > 0 && user && (
        <QuickAddLegStaffModal
          legislators={selectedLegislatorObjects}
          userId={user.id}
          onCreated={(staff) => {
            // Add to options and auto-select
            setLegStaffOptions((prev) => [
              ...prev,
              { value: staff.id, label: `${staff.first_name} ${staff.last_name}`, sublabel: staff.title || undefined },
            ]);
            setLegStaffRecords((prev) => [...prev, staff]);
            setSelectedLegStaffIds((prev) => [...prev, staff.id]);
            setShowAddStaffModal(false);
          }}
          onClose={() => setShowAddStaffModal(false)}
        />
      )}

      {showManageStaffModal && selectedLegislatorObjects.length > 0 && user && (
        <ManageLegStaffModal
          legislators={selectedLegislatorObjects}
          userId={user.id}
          onClose={() => {
            setShowManageStaffModal(false);
            // Refresh staff options to reflect any changes made in the modal
            if (selectedLegislatorIds.length > 0) {
              fetchLegStaffForLegislators(selectedLegislatorIds.map(Number));
            }
          }}
        />
      )}

      {showAddOfficeModal && user && (
        <QuickAddLegOfficeModal
          defaultType={formData.type === 'committee_meeting' ? 'committee' : 'legislator'}
          userId={user.id}
          onCreated={(office) => {
            if (office.office_type === 'committee') {
              setCommitteeOffices((prev) => [...prev, office]);
              setSelectedCommitteeOfficeId(office.id);
            }
            setShowAddOfficeModal(false);
          }}
          onClose={() => setShowAddOfficeModal(false)}
        />
      )}

      {showAddCommitteeStaffModal && selectedCommitteeOffice && user && (
        <QuickAddCommitteeStaffModal
          committeeOffice={selectedCommitteeOffice}
          userId={user.id}
          onCreated={(staff) => {
            setCommitteeStaffOptions((prev) => [
              ...prev,
              { value: staff.id, label: `${staff.first_name} ${staff.last_name}`, sublabel: staff.title || undefined },
            ]);
            setSelectedCommitteeStaffIds((prev) => [...prev, staff.id]);
            setShowAddCommitteeStaffModal(false);
          }}
          onClose={() => setShowAddCommitteeStaffModal(false)}
        />
      )}
    </div>
  );
};

export default EngagementForm;
