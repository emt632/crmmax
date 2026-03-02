import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
  FileBarChart,
  Download,
  FileText,
  X,
  Filter,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  MapPin,
  Lightbulb,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GAEngagement } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  GA_ENGAGEMENT_TYPE_LABELS,
  US_STATES,
  formatBillNumber,
} from '../../lib/bill-format';
import { getOurStates } from '../../lib/legiscan-api';

type SortField = 'date' | 'type' | 'subject' | 'jurisdiction' | 'entity' | 'initiative' | 'location' | 'bills' | 'staff' | 'contacts' | 'duration' | 'follow_up';
type SortDir = 'asc' | 'desc';

const MEETING_LOCATION_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In-Person',
  other: 'Other',
};

interface EnrichedEngagement extends GAEngagement {
  bills: { id: string; bill_number: string; title: string }[];
  staff: { id: string; full_name: string | null; email: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
}

const getEntityDisplay = (e: GAEngagement): string => {
  switch (e.type) {
    case 'legislator_office': return e.legislator_name || '';
    case 'ga_committee': return e.association_name || '';
    case 'federal_state_entity': return e.entity_name || '';
    default: return '';
  }
};

const AdvocacyReports: React.FC = () => {
  const { hasModule, effectiveUserId } = useAuth();

  // Data
  const [engagements, setEngagements] = useState<EnrichedEngagement[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [ourStates, setOurStates] = useState<string[]>([]);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterJurisdiction, setFilterJurisdiction] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterBill, setFilterBill] = useState('all');
  const [filterStaff, setFilterStaff] = useState('all');
  const [filterContact, setFilterContact] = useState('all');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  const [filterInitiative, setFilterInitiative] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Expanded row detail
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    getOurStates().then(setOurStates);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [engRes, billJoinRes, staffJoinRes, contactJoinRes, usersRes] = await Promise.all([
        supabase
          .from('ga_engagements')
          .select('*')
          .order('date', { ascending: false }),
        supabase
          .from('ga_engagement_bills')
          .select('engagement_id, bill_id, bills(id, bill_number, title)'),
        supabase
          .from('ga_engagement_staff')
          .select('engagement_id, user_id, users(id, full_name, email)'),
        supabase
          .from('ga_engagement_contacts')
          .select('engagement_id, contact_id, contacts(id, first_name, last_name)'),
        supabase
          .from('users')
          .select('id, full_name, email')
          .eq('is_active', true),
      ]);

      const uMap: Record<string, string> = {};
      (usersRes.data || []).forEach((u: any) => { uMap[u.id] = u.full_name || u.email; });
      setUserMap(uMap);

      const rawEngagements = (engRes.data || []) as GAEngagement[];

      // Build lookup maps from junction tables
      const billMap = new Map<string, { id: string; bill_number: string; title: string }[]>();
      for (const row of billJoinRes.data || []) {
        const eid = row.engagement_id as string;
        const bill = row.bills as unknown as { id: string; bill_number: string; title: string } | null;
        if (!bill) continue;
        if (!billMap.has(eid)) billMap.set(eid, []);
        billMap.get(eid)!.push(bill);
      }

      const staffMap = new Map<string, { id: string; full_name: string | null; email: string }[]>();
      for (const row of staffJoinRes.data || []) {
        const eid = row.engagement_id as string;
        const user = row.users as unknown as { id: string; full_name: string | null; email: string } | null;
        if (!user) continue;
        if (!staffMap.has(eid)) staffMap.set(eid, []);
        staffMap.get(eid)!.push(user);
      }

      const contactMap = new Map<string, { id: string; first_name: string; last_name: string }[]>();
      for (const row of contactJoinRes.data || []) {
        const eid = row.engagement_id as string;
        const contact = row.contacts as unknown as { id: string; first_name: string; last_name: string } | null;
        if (!contact) continue;
        if (!contactMap.has(eid)) contactMap.set(eid, []);
        contactMap.get(eid)!.push(contact);
      }

      const enriched: EnrichedEngagement[] = rawEngagements.map(e => ({
        ...e,
        bills: billMap.get(e.id) || [],
        staff: staffMap.get(e.id) || [],
        contacts: contactMap.get(e.id) || [],
      }));

      setEngagements(enriched);
    } catch (err) {
      console.error('Failed to load advocacy report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Unique values for filter dropdowns
  const uniqueBills = useMemo(() => {
    const map = new Map<string, { id: string; bill_number: string; title: string }>();
    engagements.forEach(e => e.bills.forEach(b => map.set(b.id, b)));
    return Array.from(map.values()).sort((a, b) => a.bill_number.localeCompare(b.bill_number));
  }, [engagements]);

  const uniqueStaff = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string | null; email: string }>();
    engagements.forEach(e => e.staff.forEach(s => map.set(s.id, s)));
    return Array.from(map.values()).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [engagements]);

  const uniqueContacts = useMemo(() => {
    const map = new Map<string, { id: string; first_name: string; last_name: string }>();
    engagements.forEach(e => e.contacts.forEach(c => map.set(c.id, c)));
    return Array.from(map.values()).sort((a, b) => a.last_name.localeCompare(b.last_name));
  }, [engagements]);

  const uniqueInitiatives = useMemo(() => {
    const set = new Set<string>();
    engagements.forEach(e => { if (e.initiative) set.add(e.initiative); });
    return Array.from(set).sort();
  }, [engagements]);

  // Filtering
  const filteredEngagements = useMemo(() => {
    let filtered = [...engagements];

    if (filterScope === 'mine') {
      filtered = filtered.filter(e => e.created_by === effectiveUserId);
    }
    if (filterDateFrom) {
      filtered = filtered.filter(e => e.date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter(e => e.date <= filterDateTo);
    }
    if (filterJurisdiction !== 'all') {
      filtered = filtered.filter(e => e.jurisdiction === filterJurisdiction);
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }
    if (filterBill !== 'all') {
      filtered = filtered.filter(e => e.bills.some(b => b.id === filterBill));
    }
    if (filterStaff !== 'all') {
      filtered = filtered.filter(e => e.staff.some(s => s.id === filterStaff));
    }
    if (filterContact !== 'all') {
      filtered = filtered.filter(e => e.contacts.some(c => c.id === filterContact));
    }
    if (filterInitiative !== 'all') {
      filtered = filtered.filter(e => e.initiative === filterInitiative);
    }
    if (filterLocation !== 'all') {
      filtered = filtered.filter(e => e.meeting_location === filterLocation);
    }

    return filtered;
  }, [engagements, filterScope, filterDateFrom, filterDateTo, filterJurisdiction, filterType, filterBill, filterStaff, filterContact, filterInitiative, filterLocation, effectiveUserId]);

  // Sorting
  const sortedEngagements = useMemo(() => {
    const sorted = [...filteredEngagements];
    const dir = sortDir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = a.date.localeCompare(b.date); break;
        case 'type': cmp = (GA_ENGAGEMENT_TYPE_LABELS[a.type] || a.type).localeCompare(GA_ENGAGEMENT_TYPE_LABELS[b.type] || b.type); break;
        case 'subject': cmp = a.subject.localeCompare(b.subject); break;
        case 'jurisdiction': cmp = (a.jurisdiction || '').localeCompare(b.jurisdiction || ''); break;
        case 'entity': cmp = getEntityDisplay(a).localeCompare(getEntityDisplay(b)); break;
        case 'initiative': cmp = (a.initiative || '').localeCompare(b.initiative || ''); break;
        case 'location': cmp = (a.meeting_location || '').localeCompare(b.meeting_location || ''); break;
        case 'bills': cmp = a.bills.length - b.bills.length; break;
        case 'staff': cmp = a.staff.length - b.staff.length; break;
        case 'contacts': cmp = a.contacts.length - b.contacts.length; break;
        case 'duration': cmp = (a.duration || 0) - (b.duration || 0); break;
        case 'follow_up': cmp = (a.follow_up_required ? 1 : 0) - (b.follow_up_required ? 1 : 0); break;
      }
      return cmp * dir;
    });

    return sorted;
  }, [filteredEngagements, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterJurisdiction('all');
    setFilterType('all');
    setFilterBill('all');
    setFilterStaff('all');
    setFilterContact('all');
    setFilterScope('all');
    setFilterInitiative('all');
    setFilterLocation('all');
  };

  const buildFilterSummary = (): string => {
    const parts: string[] = [];
    if (filterScope === 'mine') parts.push('Scope: Mine');
    if (filterDateFrom) parts.push(`From: ${filterDateFrom}`);
    if (filterDateTo) parts.push(`To: ${filterDateTo}`);
    if (filterJurisdiction !== 'all') {
      const st = US_STATES.find(s => s.value === filterJurisdiction);
      parts.push(`Jurisdiction: ${st?.label || filterJurisdiction}`);
    }
    if (filterType !== 'all') parts.push(`Type: ${GA_ENGAGEMENT_TYPE_LABELS[filterType] || filterType}`);
    if (filterBill !== 'all') {
      const b = uniqueBills.find(x => x.id === filterBill);
      parts.push(`Bill: ${b ? formatBillNumber(b.bill_number) : ''}`);
    }
    if (filterStaff !== 'all') {
      const s = uniqueStaff.find(x => x.id === filterStaff);
      parts.push(`LL3 Staff: ${s?.full_name || ''}`);
    }
    if (filterContact !== 'all') {
      const c = uniqueContacts.find(x => x.id === filterContact);
      parts.push(`PSG: ${c ? `${c.first_name} ${c.last_name}` : ''}`);
    }
    if (filterInitiative !== 'all') parts.push(`Initiative: ${filterInitiative}`);
    if (filterLocation !== 'all') parts.push(`Location: ${MEETING_LOCATION_LABELS[filterLocation] || filterLocation}`);
    return parts.length > 0 ? parts.join(' | ') : 'None';
  };

  const getJurisdictionLabel = (code?: string): string => {
    if (!code) return '';
    const st = US_STATES.find(s => s.value === code);
    return st?.label || code;
  };

  // CSV Export
  const escapeCSV = (val: string): string => `"${(val || '').replace(/"/g, '""')}"`;

  const exportCSV = () => {
    const headers = [
      'Date', 'Type', 'Subject', 'Jurisdiction', 'Entity/Legislator',
      'Initiative', 'Meeting Location', 'Location Detail',
      'Bills', 'LL3 Staff', 'PSG Attendees', 'Duration (min)',
      'Topics Covered', 'Notes', 'Follow-Up Required', 'Follow-Up Date',
      'Follow-Up Assigned To', 'Follow-Up Completed', 'Follow-Up Notes',
    ];

    const rows = filteredEngagements.map(e => [
      e.date ? format(new Date(e.date + 'T00:00:00'), 'yyyy-MM-dd') : '',
      GA_ENGAGEMENT_TYPE_LABELS[e.type] || e.type,
      e.subject,
      getJurisdictionLabel(e.jurisdiction),
      getEntityDisplay(e),
      e.initiative || '',
      e.meeting_location ? (MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location) : '',
      e.meeting_location_detail || '',
      e.bills.map(b => formatBillNumber(b.bill_number)).join('; '),
      e.staff.map(s => s.full_name || s.email).join('; '),
      e.contacts.map(c => `${c.first_name} ${c.last_name}`).join('; '),
      e.duration != null ? String(e.duration) : '',
      e.topics_covered || '',
      e.notes || '',
      e.follow_up_required ? 'Yes' : 'No',
      e.follow_up_date || '',
      e.follow_up_assigned_to ? (userMap[e.follow_up_assigned_to] || '') : '',
      e.follow_up_completed ? 'Yes' : 'No',
      e.follow_up_notes || '',
    ]);

    const csv = [headers.map(escapeCSV).join(','), ...rows.map(r => r.map(escapeCSV).join(','))].join('\n');
    downloadFile(csv, `legislative-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv');
  };

  // PDF Export
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.text('Life Link III - Legislative Activity Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')} | Filters: ${buildFilterSummary()}`, 14, 30);

    const headers = ['Date', 'Type', 'Subject', 'Jurisdiction', 'Entity', 'Initiative', 'Location', 'Bills', 'Attendees', 'Dur.'];
    const rows = filteredEngagements.map(e => [
      e.date ? format(new Date(e.date + 'T00:00:00'), 'MM/dd/yy') : '',
      GA_ENGAGEMENT_TYPE_LABELS[e.type] || e.type,
      e.subject.length > 35 ? e.subject.slice(0, 32) + '...' : e.subject,
      getJurisdictionLabel(e.jurisdiction),
      getEntityDisplay(e),
      e.initiative || '',
      e.meeting_location ? (MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location) : '',
      e.bills.map(b => formatBillNumber(b.bill_number)).join('; '),
      [...e.staff.map(s => s.full_name || ''), ...e.contacts.map(c => `${c.first_name} ${c.last_name}`)].join('; '),
      e.duration != null ? `${e.duration}m` : '',
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      styles: { fontSize: 6.5, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 18 },
        2: { cellWidth: 40 },
        9: { cellWidth: 14 },
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} | Life Link III ADVO-LINK`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`legislative-activity-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Access Required</h2>
        <p className="text-gray-500 mt-2">You need ADVO-LINK module access to view reports.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600"></div>
          <FileBarChart className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-teal-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading report data...</p>
      </div>
    );
  }

  const previewData = sortedEngagements.slice(0, 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <FileBarChart className="w-8 h-8 mr-3" />
              Legislative Activity Reports
            </h1>
            <p className="mt-2 text-teal-100">Filter, analyze, and export engagement data</p>
          </div>
          <div className="flex space-x-6 text-center">
            <div>
              <p className="text-2xl font-bold">{engagements.length}</p>
              <p className="text-xs text-teal-200">Total Engagements</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredEngagements.length}</p>
              <p className="text-xs text-teal-200">Filtered</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{engagements.filter(e => e.follow_up_required && !e.follow_up_completed).length}</p>
              <p className="text-xs text-teal-200">Open Follow-Ups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Showing {filteredEngagements.length} of {engagements.length} engagements
            </span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              Date Range
            </label>
            <div className="flex space-x-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Jurisdiction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
            <select
              value={filterJurisdiction}
              onChange={(e) => setFilterJurisdiction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Jurisdictions</option>
              {(ourStates.length > 0
                ? US_STATES.filter(s => ourStates.includes(s.value))
                : US_STATES
              ).map(s => (
                <option key={s.value} value={s.value}>{s.label}{s.value === 'US' ? ' (Federal)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Engagement Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Engagement Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              {Object.entries(GA_ENGAGEMENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterScope('all')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filterScope === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterScope('mine')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filterScope === 'mine' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Mine
              </button>
            </div>
          </div>

          {/* Bill */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bill</label>
            <select
              value={filterBill}
              onChange={(e) => setFilterBill(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Bills</option>
              {uniqueBills.map(b => (
                <option key={b.id} value={b.id}>
                  {formatBillNumber(b.bill_number)} — {b.title.length > 40 ? b.title.slice(0, 37) + '...' : b.title}
                </option>
              ))}
            </select>
          </div>

          {/* LL3 Staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LL3 Staff</label>
            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Staff</option>
              {uniqueStaff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
              ))}
            </select>
          </div>

          {/* PSG Attendee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PSG Attendee</label>
            <select
              value={filterContact}
              onChange={(e) => setFilterContact(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Attendees</option>
              {uniqueContacts.map(c => (
                <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
              ))}
            </select>
          </div>

          {/* Initiative */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Lightbulb className="w-3 h-3 inline mr-1" />
              Initiative
            </label>
            <select
              value={filterInitiative}
              onChange={(e) => setFilterInitiative(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Initiatives</option>
              {uniqueInitiatives.map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          {/* Meeting Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-3 h-3 inline mr-1" />
              Meeting Location
            </label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">All Locations</option>
              <option value="virtual">Virtual</option>
              <option value="in_person">In-Person</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-6 px-1 py-3"></th>
                {([
                  ['date', 'Date'],
                  ['type', 'Type'],
                  ['subject', 'Subject'],
                  ['jurisdiction', 'Jur.'],
                  ['entity', 'Entity'],
                  ['initiative', 'Initiative'],
                  ['location', 'Location'],
                  ['bills', 'Bills'],
                  ['staff', 'LL3 Staff'],
                  ['contacts', 'PSG'],
                  ['duration', 'Dur.'],
                  ['follow_up', 'Follow-Up'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewData.map(e => {
                const isExpanded = expandedRow === e.id;
                const hasDetail = !!(e.notes || e.topics_covered || e.follow_up_notes || e.meeting_location_detail);
                return (
                  <React.Fragment key={e.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-teal-50/40' : ''}`}
                      onClick={() => setExpandedRow(isExpanded ? null : e.id)}
                    >
                      <td className="w-6 px-1 py-3 text-gray-400">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''} ${hasDetail ? 'text-teal-500' : 'opacity-30'}`} />
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {e.date ? format(new Date(e.date + 'T00:00:00'), 'MM/dd/yy') : ''}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {GA_ENGAGEMENT_TYPE_LABELS[e.type] || e.type}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-900 max-w-[180px] truncate" title={e.subject}>
                        {e.subject}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {getJurisdictionLabel(e.jurisdiction) || '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[130px] truncate" title={getEntityDisplay(e)}>
                        {getEntityDisplay(e) || '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={e.initiative || ''}>
                        {e.initiative || '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {e.meeting_location ? (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            e.meeting_location === 'virtual' ? 'bg-blue-50 text-blue-700' :
                            e.meeting_location === 'in_person' ? 'bg-green-50 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[120px]">
                        {e.bills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.bills.map(b => (
                              <span key={b.id} className="inline-block px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs">
                                {formatBillNumber(b.bill_number)}
                              </span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[120px] truncate">
                        {e.staff.length > 0 ? e.staff.map(s => s.full_name || '').filter(Boolean).join(', ') : '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[120px] truncate">
                        {e.contacts.length > 0 ? e.contacts.map(c => `${c.first_name} ${c.last_name}`).join(', ') : '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {e.duration != null ? `${e.duration}m` : '—'}
                      </td>
                      <td className="px-2 py-3 text-sm">
                        {e.follow_up_required ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium w-fit ${
                              e.follow_up_completed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {e.follow_up_completed ? 'Done' : e.follow_up_date ? format(new Date(e.follow_up_date + 'T00:00:00'), 'MM/dd') : 'Pending'}
                            </span>
                            {e.follow_up_assigned_to && userMap[e.follow_up_assigned_to] && (
                              <span className="text-[10px] text-gray-400 truncate max-w-[100px]" title={userMap[e.follow_up_assigned_to]}>
                                {userMap[e.follow_up_assigned_to]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={13} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {e.notes && (
                              <div>
                                <span className="font-medium text-gray-700">Notes:</span>
                                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{e.notes}</p>
                              </div>
                            )}
                            {e.topics_covered && (
                              <div>
                                <span className="font-medium text-gray-700">Topics Covered:</span>
                                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{e.topics_covered}</p>
                              </div>
                            )}
                            {e.meeting_location_detail && (
                              <div>
                                <span className="font-medium text-gray-700">Location Detail:</span>
                                <p className="mt-1 text-gray-600">{e.meeting_location_detail}</p>
                              </div>
                            )}
                            {e.follow_up_notes && (
                              <div>
                                <span className="font-medium text-gray-700">Follow-Up Notes:</span>
                                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{e.follow_up_notes}</p>
                              </div>
                            )}
                            {!e.notes && !e.topics_covered && !e.meeting_location_detail && !e.follow_up_notes && (
                              <p className="text-gray-400 italic">No additional details recorded</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredEngagements.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-500">
                    No engagements match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredEngagements.length > 50 && (
          <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-500 text-center">
            Showing first 50 of {filteredEngagements.length} results. Export for full data.
          </div>
        )}
      </div>

      {/* Export Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportCSV}
            disabled={filteredEngagements.length === 0}
            className="inline-flex items-center px-4 py-2.5 border-2 border-teal-600 text-teal-600 rounded-xl font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            disabled={filteredEngagements.length === 0}
            className="inline-flex items-center px-4 py-2.5 border-2 border-teal-600 text-teal-600 rounded-xl font-medium hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvocacyReports;
