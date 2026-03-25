import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BookUser, Search, Plus, ChevronDown, ChevronRight,
  Edit2, Trash2, Loader2, Download, UserCircle, Gavel,
  Phone, Mail, MapPin, Save, X, Sparkles, GitMerge, Camera, MessageCircle, ArrowUpDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { US_STATES } from '../../lib/bill-format';
import { useAuth } from '../../contexts/AuthContext';
import type { LegislativeOffice, LegislativeOfficeStaff } from '../../types';
import { exportDirectoryCSV, allStaffToVCardFile, downloadFile } from '../../lib/leg-staff-export';
import QuickAddLegOfficeModal from './QuickAddLegOfficeModal';
import QuickAddCommitteeStaffModal from './QuickAddCommitteeStaffModal';
import SmartCaptureLegStaffModal from './SmartCaptureLegStaffModal';
import MergeLegOfficeModal from './MergeLegOfficeModal';

type TabType = 'legislator' | 'committee';

// State color coding — sports/collegiate inspired
const STATE_COLORS: Record<string, string> = {
  MN: 'bg-purple-100 text-purple-800 border border-purple-300',   // Vikings purple
  WI: 'bg-red-100 text-red-800 border border-red-300',            // Badgers red
  ND: 'bg-amber-100 text-amber-800 border border-amber-300',      // NDSU Bison gold
  MI: 'bg-blue-100 text-blue-800 border border-blue-300',         // Wolverines blue
  US: 'bg-slate-100 text-slate-800 border border-slate-300',      // Federal — neutral
  IA: 'bg-yellow-100 text-yellow-800 border border-yellow-300',   // Hawkeyes gold
  IL: 'bg-orange-100 text-orange-800 border border-orange-300',   // Illini orange
  SD: 'bg-sky-100 text-sky-800 border border-sky-300',            // Jackrabbits blue
  OH: 'bg-red-100 text-red-800 border border-red-300',            // Buckeyes scarlet
  IN: 'bg-red-100 text-red-800 border border-red-300',            // Hoosiers crimson
  PA: 'bg-indigo-100 text-indigo-800 border border-indigo-300',   // Penn State navy
};
const DEFAULT_STATE_COLOR = 'bg-gray-100 text-gray-700 border border-gray-300';

// Left border accent per state
const STATE_BORDER: Record<string, string> = {
  MN: 'border-l-purple-500',
  WI: 'border-l-red-500',
  ND: 'border-l-amber-500',
  MI: 'border-l-blue-500',
  US: 'border-l-slate-500',
  IA: 'border-l-yellow-500',
  IL: 'border-l-orange-500',
  SD: 'border-l-sky-500',
  OH: 'border-l-red-500',
  IN: 'border-l-red-500',
  PA: 'border-l-indigo-500',
};

function getStateColor(state?: string): string {
  return state ? (STATE_COLORS[state] || DEFAULT_STATE_COLOR) : DEFAULT_STATE_COLOR;
}

function getStateBorder(state?: string): string {
  return state ? (STATE_BORDER[state] || 'border-l-gray-300') : 'border-l-gray-300';
}

// Strip all title/office prefixes to get just the person's name
function stripName(name: string): string {
  return name
    .replace(/^Office of\s+(Sen\.\s*|Rep\.\s*|Senator\s+|Representative\s+|Congressman\s+|Congresswoman\s+)?/i, '')
    .replace(/^Senator\s+/i, '')
    .replace(/^Representative\s+/i, '')
    .replace(/^Congressman\s+/i, '')
    .replace(/^Congresswoman\s+/i, '')
    .replace(/^Congressperson\s+/i, '')
    .replace(/^Sen\.\s*/i, '')
    .replace(/^Rep\.\s*/i, '')
    .trim();
}

// Build display name: "Senator Jane Doe" or "Representative John Smith"
function displayOfficeName(name: string, chamber?: string): string {
  const clean = stripName(name);
  const c = (chamber || '').toLowerCase();
  if (c === 'senate' || c === 'sen') return `Senator ${clean}`;
  if (c === 'house' || c === 'assembly' || c === 'rep') return `Representative ${clean}`;
  return clean || name;
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';

const LegislativeDirectory: React.FC = () => {
  const { user, hasModule } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('legislator');
  const [offices, setOffices] = useState<LegislativeOffice[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, LegislativeOfficeStaff[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOffices, setExpandedOffices] = useState<Set<string>>(new Set());
  const [mentionCounts, setMentionCounts] = useState<Record<string, number>>({});
  // All engagements linked to an office (via junction tables + mentions), keyed by office id
  const [officeEngagements, setOfficeEngagements] = useState<Record<string, { id: string; subject: string; date: string; type: string; source: string }[]>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightProcessed = useRef(false);

  // Modal state
  const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
  const [addOfficeDefaultType, setAddOfficeDefaultType] = useState<'legislator' | 'committee'>('legislator');
  const [showAddStaffForOffice, setShowAddStaffForOffice] = useState<LegislativeOffice | null>(null);
  const [showSmartCapture, setShowSmartCapture] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [smartCaptureTarget, setSmartCaptureTarget] = useState<{ office: LegislativeOffice; mode: 'legislator' | 'staff' } | null>(null);
  const [stateFilter, setStateFilter] = useState<string>(''); // empty = all
  const [sortBy, setSortBy] = useState<'name' | 'state'>('name');

  // Inline edit state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaffData, setEditStaffData] = useState<Partial<LegislativeOfficeStaff>>({});
  const [savingStaff, setSavingStaff] = useState(false);

  // Inline edit state for offices
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editOfficeData, setEditOfficeData] = useState<Partial<LegislativeOffice>>({});
  const [savingOffice, setSavingOffice] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: officeData } = await supabase
      .from('legislative_offices')
      .select('*')
      .order('name');

    const allOffices = (officeData || []) as LegislativeOffice[];
    setOffices(allOffices);

    let localStaffMap: Record<string, LegislativeOfficeStaff[]> = {};
    if (allOffices.length > 0) {
      const { data: staffData } = await supabase
        .from('legislative_office_staff')
        .select('*')
        .neq('is_active', false)
        .order('last_name');

      for (const s of (staffData || []) as LegislativeOfficeStaff[]) {
        if (!localStaffMap[s.office_id]) localStaffMap[s.office_id] = [];
        localStaffMap[s.office_id].push(s);
      }
      setStaffMap(localStaffMap);
    }

    // Fetch mention counts + engagement details for badges
    const { data: mentionData } = await supabase
      .from('ga_engagement_mentions')
      .select('mention_type, legislator_people_id, leg_staff_id, committee_office_id, ga_engagements!inner(id, subject, date, type)');
    const counts: Record<string, number> = {};
    const engMap: Record<string, { id: string; subject: string; date: string; type: string }[]> = {};
    for (const m of (mentionData || []) as any[]) {
      let key = '';
      if (m.mention_type === 'legislator' && m.legislator_people_id) key = `legislator:${m.legislator_people_id}`;
      else if (m.mention_type === 'leg_staff' && m.leg_staff_id) key = `leg_staff:${m.leg_staff_id}`;
      else if (m.mention_type === 'committee' && m.committee_office_id) key = `committee:${m.committee_office_id}`;
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
        if (!engMap[key]) engMap[key] = [];
        const eng = m.ga_engagements;
        // Deduplicate
        if (eng && !engMap[key].some((e: any) => e.id === eng.id)) {
          engMap[key].push({ id: eng.id, subject: eng.subject || 'Untitled', date: eng.date || '', type: eng.type || '' });
        }
      }
    }
    setMentionCounts(counts);

    // Build officeEngagements: all engagements linked to each office via junction tables + mentions
    const oEngMap: Record<string, Map<string, { id: string; subject: string; date: string; type: string; source: string }>> = {};
    const addToOffice = (officeId: string, eng: { id: string; subject: string; date: string; type: string }, source: string) => {
      if (!oEngMap[officeId]) oEngMap[officeId] = new Map();
      if (!oEngMap[officeId].has(eng.id)) oEngMap[officeId].set(eng.id, { ...eng, source });
    };

    // 1. Legislator junction: ga_engagement_legislators → people_id → office
    const { data: legJuncData } = await supabase
      .from('ga_engagement_legislators')
      .select('people_id, ga_engagements!inner(id, subject, date, type)');
    for (const row of (legJuncData || []) as any[]) {
      const office = allOffices.find((o) => o.legislator_people_id === row.people_id);
      if (office && row.ga_engagements) addToOffice(office.id, row.ga_engagements, 'attendee');
    }

    // 2. Leg staff junction: ga_engagement_leg_staff → staff_id → office_id
    const { data: legStaffJuncData } = await supabase
      .from('ga_engagement_leg_staff')
      .select('staff_id, ga_engagements!inner(id, subject, date, type)');
    const staffToOffice: Record<string, string> = {};
    for (const [oid, sList] of Object.entries(localStaffMap)) {
      for (const s of sList) staffToOffice[s.id] = oid;
    }
    for (const row of (legStaffJuncData || []) as any[]) {
      const oid = staffToOffice[row.staff_id];
      if (oid && row.ga_engagements) addToOffice(oid, row.ga_engagements, 'staff attendee');
    }

    // 3. Committee office on engagement
    const { data: committeeEngs } = await supabase
      .from('ga_engagements')
      .select('id, subject, date, type, committee_office_id')
      .not('committee_office_id', 'is', null);
    for (const e of (committeeEngs || []) as any[]) {
      if (e.committee_office_id) addToOffice(e.committee_office_id, { id: e.id, subject: e.subject || 'Untitled', date: e.date || '', type: e.type || '' }, 'committee');
    }

    // 4. Mentions (already fetched above)
    for (const [key, engs] of Object.entries(engMap)) {
      const [mType, mId] = key.split(':');
      let officeId: string | undefined;
      if (mType === 'legislator') {
        officeId = allOffices.find((o) => o.legislator_people_id === Number(mId))?.id;
      } else if (mType === 'leg_staff') {
        officeId = staffToOffice[mId];
      } else if (mType === 'committee') {
        officeId = mId;
      }
      if (officeId) {
        for (const eng of engs) addToOffice(officeId, eng, 'mentioned');
      }
    }

    // Convert maps to sorted arrays (most recent first)
    const oEngResult: Record<string, { id: string; subject: string; date: string; type: string; source: string }[]> = {};
    for (const [oid, engMapInner] of Object.entries(oEngMap)) {
      oEngResult[oid] = Array.from(engMapInner.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    setOfficeEngagements(oEngResult);

    setLoading(false);
  };

  // Process ?highlight=type:id URL param after data loads
  useEffect(() => {
    if (loading || highlightProcessed.current) return;
    const hlParam = searchParams.get('highlight');
    if (!hlParam) return;

    const colonIdx = hlParam.indexOf(':');
    if (colonIdx < 0) return;
    const hlType = hlParam.slice(0, colonIdx);
    const hlId = hlParam.slice(colonIdx + 1);

    let targetOfficeId: string | null = null;
    let targetElementId: string | null = null;
    let targetTab: TabType = 'legislator';

    if (hlType === 'legislator') {
      const pid = Number(hlId);
      const office = offices.find((o) => o.legislator_people_id === pid);
      if (office) {
        targetOfficeId = office.id;
        targetElementId = `office-${office.id}`;
        targetTab = 'legislator';
      }
    } else if (hlType === 'leg_staff') {
      for (const [officeId, staffList] of Object.entries(staffMap)) {
        const staff = staffList.find((s) => s.id === hlId);
        if (staff) {
          targetOfficeId = officeId;
          targetElementId = `staff-${staff.id}`;
          const office = offices.find((o) => o.id === officeId);
          targetTab = office?.office_type === 'committee' ? 'committee' : 'legislator';
          break;
        }
      }
    } else if (hlType === 'committee') {
      const office = offices.find((o) => o.id === hlId && o.office_type === 'committee');
      if (office) {
        targetOfficeId = office.id;
        targetElementId = `office-${office.id}`;
        targetTab = 'committee';
      }
    }

    if (!targetOfficeId || !targetElementId) return;

    highlightProcessed.current = true;
    setActiveTab(targetTab);
    setStateFilter('');
    setSearchQuery('');
    setExpandedOffices((prev) => new Set(prev).add(targetOfficeId!));
    setHighlightId(targetElementId);

    // Clear the param from URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('highlight');
      return next;
    }, { replace: true });

    // Scroll into view after render
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(targetElementId!);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });

    // Remove highlight ring after 3s
    setTimeout(() => setHighlightId(null), 3000);
  }, [loading, offices, staffMap, searchParams, setSearchParams]);

  // Unique states for filter pills (across both tabs)
  const availableStates = useMemo(() => {
    const states = new Set<string>();
    for (const o of offices) {
      if (o.state) states.add(o.state);
    }
    return Array.from(states).sort();
  }, [offices]);

  const filteredOffices = useMemo(() => {
    let byType = offices.filter((o) => o.office_type === activeTab);
    if (stateFilter) {
      byType = byType.filter((o) => o.state === stateFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      byType = byType.filter((o) => {
        if (o.name.toLowerCase().includes(q)) return true;
        if (o.state?.toLowerCase().includes(q)) return true;
        if (o.chamber?.toLowerCase().includes(q)) return true;
        const staff = staffMap[o.id] || [];
        return staff.some(
          (s) =>
            s.first_name.toLowerCase().includes(q) ||
            s.last_name.toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q)
        );
      });
    }
    // Sort
    return byType.sort((a, b) => {
      const aWords = stripName(a.name).split(/\s+/);
      const bWords = stripName(b.name).split(/\s+/);
      const aLast = (aWords[aWords.length - 1] || '').toLowerCase();
      const bLast = (bWords[bWords.length - 1] || '').toLowerCase();
      if (sortBy === 'state') {
        const stateCompare = (a.state || '').localeCompare(b.state || '');
        if (stateCompare !== 0) return stateCompare;
      }
      return aLast.localeCompare(bLast);
    });
  }, [offices, activeTab, searchQuery, stateFilter, staffMap, sortBy]);

  const toggleExpand = (id: string) => {
    setExpandedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteOffice = async (office: LegislativeOffice) => {
    if (!confirm(`Delete "${office.name}"? Staff will be deactivated to preserve historical records.`)) return;
    // Soft-delete staff first to preserve engagement history
    await supabase.from('legislative_office_staff').update({ is_active: false }).eq('office_id', office.id);
    await supabase.from('legislative_offices').delete().eq('id', office.id);
    setOffices((prev) => prev.filter((o) => o.id !== office.id));
    setStaffMap((prev) => {
      const next = { ...prev };
      delete next[office.id];
      return next;
    });
  };

  const handleDeleteStaff = async (staffId: string, officeId: string) => {
    if (!confirm('Deactivate this staff member? They will be hidden but historical engagement records will be preserved.')) return;
    await supabase.from('legislative_office_staff').update({ is_active: false }).eq('id', staffId);
    setStaffMap((prev) => ({
      ...prev,
      [officeId]: (prev[officeId] || []).filter((s) => s.id !== staffId),
    }));
  };

  const startEditStaff = (staff: LegislativeOfficeStaff) => {
    setEditingStaffId(staff.id);
    setEditStaffData({
      first_name: staff.first_name,
      last_name: staff.last_name,
      title: staff.title || '',
      email: staff.email || '',
      phone: staff.phone || '',
    });
  };

  const saveEditStaff = async (staffId: string, officeId: string) => {
    setSavingStaff(true);
    const { error } = await supabase
      .from('legislative_office_staff')
      .update({
        first_name: editStaffData.first_name,
        last_name: editStaffData.last_name,
        title: (editStaffData.title as string)?.trim() || null,
        email: (editStaffData.email as string)?.trim() || null,
        phone: (editStaffData.phone as string)?.trim() || null,
      })
      .eq('id', staffId);

    if (!error) {
      setStaffMap((prev) => ({
        ...prev,
        [officeId]: (prev[officeId] || []).map((s) =>
          s.id === staffId ? { ...s, ...editStaffData } as LegislativeOfficeStaff : s
        ),
      }));
    }
    setSavingStaff(false);
    setEditingStaffId(null);
  };

  const startEditOffice = (office: LegislativeOffice) => {
    setEditingOfficeId(office.id);
    setEditOfficeData({
      name: office.name,
      state: office.state || '',
      chamber: office.chamber || '',
      district: office.district || '',
      phone: office.phone || '',
      email: office.email || '',
      address: office.address || '',
      city: office.city || '',
      office_state: office.office_state || '',
      zip: office.zip || '',
    });
  };

  const saveEditOffice = async (officeId: string) => {
    setSavingOffice(true);
    const { data, error } = await supabase
      .from('legislative_offices')
      .update({
        name: (editOfficeData.name as string)?.trim() || '',
        state: (editOfficeData.state as string) || null,
        chamber: (editOfficeData.chamber as string) || null,
        district: (editOfficeData.district as string)?.trim() || null,
        phone: (editOfficeData.phone as string)?.trim() || null,
        email: (editOfficeData.email as string)?.trim() || null,
        address: (editOfficeData.address as string)?.trim() || null,
        city: (editOfficeData.city as string)?.trim() || null,
        office_state: (editOfficeData.office_state as string) || null,
        zip: (editOfficeData.zip as string)?.trim() || null,
      })
      .eq('id', officeId)
      .select('*')
      .single();

    if (!error && data) {
      setOffices((prev) => prev.map((o) => o.id === officeId ? data as LegislativeOffice : o));
    }
    setSavingOffice(false);
    setEditingOfficeId(null);
  };

  const handleExportCSV = () => {
    const filtered = offices.filter((o) => o.office_type === activeTab);
    const csv = exportDirectoryCSV(filtered, staffMap);
    downloadFile(csv, `legislative-directory-${activeTab}.csv`, 'text/csv');
  };

  const handleExportVCards = () => {
    const filtered = offices.filter((o) => o.office_type === activeTab);
    const pairs: { staff: LegislativeOfficeStaff; office: LegislativeOffice }[] = [];
    for (const office of filtered) {
      for (const staff of staffMap[office.id] || []) {
        pairs.push({ staff, office });
      }
    }
    if (pairs.length === 0) { alert('No staff to export.'); return; }
    const vcf = allStaffToVCardFile(pairs);
    downloadFile(vcf, `legislative-staff-${activeTab}.vcf`, 'text/vcard');
  };

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-4 sm:p-5 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold flex items-center">
            <BookUser className="w-5 h-5 mr-2" />
            Legislative Directory
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handleExportVCards}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">vCards</span>
            </button>
            <button
              onClick={() => setShowSmartCapture(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Smart Capture</span>
            </button>
            <button
              onClick={() => setShowMerge(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-sm transition-colors"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Merge</span>
            </button>
            <button
              onClick={() => {
                setAddOfficeDefaultType(activeTab);
                setShowAddOfficeModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Office
            </button>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 px-4 gap-2 sm:gap-0">
          <div className="flex">
            <button
              onClick={() => setActiveTab('legislator')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'legislator'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Legislator </span>Offices
            </button>
            <button
              onClick={() => setActiveTab('committee')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'committee'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gavel className="w-4 h-4" />
              Committees
            </button>
          </div>
          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search offices or staff..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'state')}
                className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 outline-none"
              >
                <option value="name">Last Name A–Z</option>
                <option value="state">State, then Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* State filter pills */}
        {availableStates.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500 mr-1">Filter:</span>
            <button
              onClick={() => setStateFilter('')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                !stateFilter
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {availableStates.map((st) => (
              <button
                key={st}
                onClick={() => setStateFilter(stateFilter === st ? '' : st)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  stateFilter === st
                    ? getStateColor(st) + ' ring-2 ring-offset-1 ring-teal-400'
                    : getStateColor(st) + ' opacity-70 hover:opacity-100'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : filteredOffices.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookUser className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No {activeTab === 'legislator' ? 'legislator' : 'committee'} offices found.</p>
              <button
                onClick={() => {
                  setAddOfficeDefaultType(activeTab);
                  setShowAddOfficeModal(true);
                }}
                className="mt-3 text-sm text-teal-600 hover:text-teal-800 font-medium"
              >
                + Add your first office
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOffices.map((office) => {
                const isExpanded = expandedOffices.has(office.id);
                const staff = staffMap[office.id] || [];

                return (
                  <div
                    key={office.id}
                    id={`office-${office.id}`}
                    className={`border border-gray-200 rounded-lg overflow-hidden border-l-4 ${getStateBorder(office.state)} transition-shadow duration-500 ${highlightId === `office-${office.id}` ? 'ring-2 ring-teal-400' : ''}`}
                  >
                    {/* Office header */}
                    {editingOfficeId === office.id ? (
                      <div className="px-4 py-3 bg-gray-50 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-3">
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Office Name</label>
                            <input value={editOfficeData.name || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">State</label>
                            <select value={editOfficeData.state || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, state: e.target.value }))} className={inputClass}>
                              <option value="">Select...</option>
                              {US_STATES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Chamber</label>
                            <select value={editOfficeData.chamber || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, chamber: e.target.value }))} className={inputClass}>
                              <option value="">Select...</option>
                              <option value="senate">Senate</option>
                              <option value="house">House</option>
                              <option value="assembly">Assembly</option>
                              <option value="joint">Joint</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">District</label>
                            <input value={editOfficeData.district || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, district: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Phone</label>
                            <input value={editOfficeData.phone || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Email</label>
                            <input value={editOfficeData.email || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Address</label>
                            <input value={editOfficeData.address || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, address: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">City</label>
                            <input value={editOfficeData.city || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, city: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-0.5">Zip</label>
                            <input value={editOfficeData.zip || ''} onChange={(e) => setEditOfficeData((p) => ({ ...p, zip: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => saveEditOffice(office.id)}
                            disabled={savingOffice || !editOfficeData.name?.trim()}
                            className="flex items-center gap-1 px-3 py-2 sm:py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                          >
                            {savingOffice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                          </button>
                          <button
                            onClick={() => setEditingOfficeId(null)}
                            className="px-3 py-2 sm:py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleExpand(office.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {office.state && (
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${getStateColor(office.state)}`}>{office.state}</span>
                            )}
                            <span className="font-medium text-sm text-gray-900 truncate">
                              {office.office_type === 'legislator' ? displayOfficeName(office.name, office.chamber) : office.name}
                            </span>
                            {office.district && (
                              <span className="text-xs text-gray-500 flex-shrink-0">District {office.district}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                            {office.phone && (
                              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{office.phone}</span>
                            )}
                            {office.email && (
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{office.email}</span>
                            )}
                            {office.address && (
                              <span className="hidden sm:flex items-center gap-1"><MapPin className="w-3 h-3" />{office.address}{office.city ? `, ${office.city}` : ''}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-xs text-gray-400 mr-1">{staff.length} staff</span>
                          {(() => {
                            const key = office.office_type === 'legislator' && office.legislator_people_id
                              ? `legislator:${office.legislator_people_id}`
                              : office.office_type === 'committee' ? `committee:${office.id}` : '';
                            const count = key ? mentionCounts[key] || 0 : 0;
                            return count > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-medium mr-1" title={`Mentioned in ${count} engagement${count > 1 ? 's' : ''}`}>
                                <MessageCircle className="w-3 h-3" />{count} mention{count > 1 ? 's' : ''}
                              </span>
                            ) : null;
                          })()}
                          <button
                            onClick={(e) => { e.stopPropagation(); setSmartCaptureTarget({ office, mode: 'legislator' }); }}
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Scan card to add office details"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditOffice(office); }}
                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Edit office"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteOffice(office); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete office"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Staff list */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        {staff.length === 0 ? (
                          <div className="px-4 py-4 text-center text-xs text-gray-400">
                            No staff members yet.
                          </div>
                        ) : (
                          <>
                          {/* Mobile staff cards */}
                          <div className="sm:hidden divide-y divide-gray-100">
                            {staff.map((s) => (
                              <div key={s.id} id={`staff-${s.id}`} className={`px-4 py-3 transition-shadow duration-500 ${highlightId === `staff-${s.id}` ? 'ring-2 ring-teal-400 ring-inset' : ''}`}>
                                {editingStaffId === s.id ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input value={editStaffData.first_name || ''} onChange={(e) => setEditStaffData((p) => ({ ...p, first_name: e.target.value }))} className={inputClass} placeholder="First" />
                                      <input value={editStaffData.last_name || ''} onChange={(e) => setEditStaffData((p) => ({ ...p, last_name: e.target.value }))} className={inputClass} placeholder="Last" />
                                    </div>
                                    <input value={editStaffData.title || ''} onChange={(e) => setEditStaffData((p) => ({ ...p, title: e.target.value }))} className={inputClass} placeholder="Title" />
                                    <input value={editStaffData.email || ''} onChange={(e) => setEditStaffData((p) => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="Email" />
                                    <input value={editStaffData.phone || ''} onChange={(e) => setEditStaffData((p) => ({ ...p, phone: e.target.value }))} className={inputClass} placeholder="Phone" />
                                    <div className="flex gap-2">
                                      <button onClick={() => saveEditStaff(s.id, office.id)} disabled={savingStaff} className="flex-1 flex items-center justify-center gap-1 py-2 bg-teal-600 text-white rounded-lg text-sm">
                                        {savingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                                      </button>
                                      <button onClick={() => setEditingStaffId(null)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {s.first_name} {s.last_name}
                                        {(mentionCounts[`leg_staff:${s.id}`] || 0) > 0 && (
                                          <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-medium">
                                            <MessageCircle className="w-3 h-3" />{mentionCounts[`leg_staff:${s.id}`]}
                                          </span>
                                        )}
                                      </p>
                                      {s.title && <p className="text-xs text-gray-500">{s.title}</p>}
                                      {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                                      {s.phone && <p className="text-xs text-gray-400">{s.phone}</p>}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button onClick={() => startEditStaff(s)} className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                      <button onClick={() => handleDeleteStaff(s.id, office.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {/* Desktop staff table */}
                          <table className="hidden sm:table w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                                <th className="px-4 py-2 text-left font-medium">Name</th>
                                <th className="px-4 py-2 text-left font-medium">Title</th>
                                <th className="px-4 py-2 text-left font-medium">Email</th>
                                <th className="px-4 py-2 text-left font-medium">Phone</th>
                                <th className="px-4 py-2 text-right font-medium w-20">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {staff.map((s) => (
                                <tr key={s.id} id={`staff-${s.id}`} className={`border-t border-gray-100 hover:bg-gray-50 transition-shadow duration-500 ${highlightId === `staff-${s.id}` ? 'ring-2 ring-teal-400 ring-inset' : ''}`}>
                                  {editingStaffId === s.id ? (
                                    <>
                                      <td className="px-4 py-2">
                                        <div className="flex gap-1">
                                          <input
                                            value={editStaffData.first_name || ''}
                                            onChange={(e) => setEditStaffData((p) => ({ ...p, first_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="First"
                                          />
                                          <input
                                            value={editStaffData.last_name || ''}
                                            onChange={(e) => setEditStaffData((p) => ({ ...p, last_name: e.target.value }))}
                                            className={inputClass}
                                            placeholder="Last"
                                          />
                                        </div>
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.title || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, title: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.email || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, email: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2">
                                        <input
                                          value={editStaffData.phone || ''}
                                          onChange={(e) => setEditStaffData((p) => ({ ...p, phone: e.target.value }))}
                                          className={inputClass}
                                        />
                                      </td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => saveEditStaff(s.id, office.id)}
                                            disabled={savingStaff}
                                            className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                          >
                                            {savingStaff ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                          </button>
                                          <button
                                            onClick={() => setEditingStaffId(null)}
                                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="px-4 py-2 text-gray-900">
                                        {s.first_name} {s.last_name}
                                        {(mentionCounts[`leg_staff:${s.id}`] || 0) > 0 && (
                                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-teal-600" title={`Mentioned in ${mentionCounts[`leg_staff:${s.id}`]} engagement${mentionCounts[`leg_staff:${s.id}`] > 1 ? 's' : ''}`}>
                                            <MessageCircle className="w-3 h-3" />{mentionCounts[`leg_staff:${s.id}`]}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-gray-600">{s.title || '—'}</td>
                                      <td className="px-4 py-2 text-gray-600">{s.email || '—'}</td>
                                      <td className="px-4 py-2 text-gray-600">{s.phone || '—'}</td>
                                      <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => startEditStaff(s)}
                                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                            title="Edit staff"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteStaff(s.id, office.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete staff"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </>
                        )}
                        {/* Engagements linked to this office */}
                        {(officeEngagements[office.id] || []).length > 0 && (
                          <div className="px-4 py-3 border-t border-gray-100 bg-teal-50/40">
                            <div className="flex items-center gap-1.5 mb-2">
                              <MessageCircle className="w-3.5 h-3.5 text-teal-600" />
                              <span className="text-xs font-semibold text-teal-800">Engagements ({officeEngagements[office.id].length})</span>
                            </div>
                            <div className="space-y-1">
                              {officeEngagements[office.id].map((eng) => (
                                <Link
                                  key={eng.id}
                                  to={`/advocacy/engagements/${eng.id}`}
                                  className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-md text-sm hover:bg-teal-50 transition-colors group border border-gray-100"
                                >
                                  <span className="font-medium text-gray-800 group-hover:text-teal-700 truncate">{eng.subject}</span>
                                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                                    {eng.date ? format(new Date(eng.date + 'T00:00:00'), 'MMM d, yyyy') : ''}{eng.type ? ` · ${eng.type}` : ''}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3">
                          <button
                            onClick={() => setShowAddStaffForOffice(office)}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add Staff
                          </button>
                          <button
                            onClick={() => setSmartCaptureTarget({ office, mode: 'staff' })}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                          >
                            <Camera className="w-3 h-3" />
                            Scan Card
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddOfficeModal && user && (
        <QuickAddLegOfficeModal
          defaultType={addOfficeDefaultType}
          userId={user.id}
          onCreated={(office) => {
            setOffices((prev) => [...prev, office].sort((a, b) => a.name.localeCompare(b.name)));
            setShowAddOfficeModal(false);
          }}
          onClose={() => setShowAddOfficeModal(false)}
        />
      )}

      {showAddStaffForOffice && user && (
        <QuickAddCommitteeStaffModal
          committeeOffice={showAddStaffForOffice}
          userId={user.id}
          onCreated={(staff) => {
            setStaffMap((prev) => ({
              ...prev,
              [showAddStaffForOffice.id]: [...(prev[showAddStaffForOffice.id] || []), staff],
            }));
            setShowAddStaffForOffice(null);
          }}
          onClose={() => setShowAddStaffForOffice(null)}
        />
      )}

      {showSmartCapture && user && (
        <SmartCaptureLegStaffModal
          isOpen={showSmartCapture}
          existingOffices={offices}
          userId={user.id}
          onCreated={(staff, office) => {
            // Add or update office
            setOffices((prev) => {
              const idx = prev.findIndex((o) => o.id === office.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = office;
                return updated;
              }
              return [...prev, office].sort((a, b) => a.name.localeCompare(b.name));
            });
            // Add staff to map (if staff was created)
            if (staff) {
              setStaffMap((prev) => ({
                ...prev,
                [office.id]: [...(prev[office.id] || []), staff],
              }));
            }
            setShowSmartCapture(false);
          }}
          onClose={() => setShowSmartCapture(false)}
        />
      )}

      {smartCaptureTarget && user && (
        <SmartCaptureLegStaffModal
          isOpen={!!smartCaptureTarget}
          existingOffices={offices}
          userId={user.id}
          targetOffice={smartCaptureTarget.office}
          defaultIsLegislatorCard={smartCaptureTarget.mode === 'legislator'}
          onCreated={(staff, office) => {
            setOffices((prev) => {
              const idx = prev.findIndex((o) => o.id === office.id);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = office;
                return updated;
              }
              return [...prev, office].sort((a, b) => a.name.localeCompare(b.name));
            });
            if (staff) {
              setStaffMap((prev) => ({
                ...prev,
                [office.id]: [...(prev[office.id] || []), staff],
              }));
            }
            setSmartCaptureTarget(null);
          }}
          onClose={() => setSmartCaptureTarget(null)}
        />
      )}

      {showMerge && (
        <MergeLegOfficeModal
          offices={offices}
          staffMap={staffMap}
          onMerged={() => {
            setShowMerge(false);
            fetchAll();
          }}
          onClose={() => setShowMerge(false)}
        />
      )}
    </div>
  );
};

export default LegislativeDirectory;
