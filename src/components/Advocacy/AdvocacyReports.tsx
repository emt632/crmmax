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
  StickyNote,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GAEngagement } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  GA_ENGAGEMENT_TYPE_LABELS,
  GA_ENGAGEMENT_TYPE_BADGE_COLORS,
  COMMITTEE_ROLE_LABELS,
  US_STATES,
  formatBillNumber,
} from '../../lib/bill-format';
import { getOurStates } from '../../lib/legiscan-api';

type SortField = 'date' | 'engagement' | 'subject' | 'jurisdiction' | 'initiative' | 'location' | 'committee' | 'bills' | 'staff' | 'contacts' | 'duration' | 'follow_up';
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
  legislators: { people_id: number; name: string; party?: string; chamber?: string; state?: string }[];
  legStaff: { id: string; first_name: string; last_name: string; title?: string }[];
}

/** Plain-text engagement description for sorting, CSV, and PDF */
const getEngagementText = (e: EnrichedEngagement): string => {
  switch (e.type) {
    case 'legislator_office': {
      const legNames = e.legislators.map(l => l.name).filter(Boolean);
      const name = legNames.length > 0 ? legNames.join(', ') : (e.legislator_name || 'Unknown Legislator');
      const level = e.meeting_level === 'staff' ? ' (Staff)' : e.meeting_level === 'member' ? ' (Member)' : '';
      const lsNames = e.legStaff.map(ls => `${ls.first_name} ${ls.last_name}`).filter(Boolean);
      const staffSuffix = lsNames.length > 0 ? ` [${lsNames.join(', ')}]` : '';
      return `${name}${level}${staffSuffix}`;
    }
    case 'lobby_team':
      return e.staff.length > 0
        ? e.staff.map(s => s.full_name || '').filter(Boolean).join(', ')
        : 'Lobby Team';
    case 'ga_committee':
      return e.association_name || 'GA Committee';
    case 'committee_meeting':
      return e.association_name || 'Committee Meeting';
    case 'federal_state_entity':
      return e.entity_name || 'Federal/State Entity';
    default:
      return GA_ENGAGEMENT_TYPE_LABELS[e.type] || e.type;
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

  // Export options
  const [includeNotes, setIncludeNotes] = useState(false);

  useEffect(() => {
    fetchData();
    getOurStates().then(setOurStates);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [engRes, billJoinRes, staffJoinRes, contactJoinRes, legJoinRes, legStaffJoinRes, usersRes] = await Promise.all([
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
          .from('ga_engagement_legislators')
          .select('engagement_id, people_id, legiscan_legislators(people_id, name, party, chamber, state)'),
        supabase
          .from('ga_engagement_leg_staff')
          .select('engagement_id, staff_id, legislative_office_staff(id, first_name, last_name, title)'),
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

      const legMap = new Map<string, { people_id: number; name: string; party?: string; chamber?: string; state?: string }[]>();
      for (const row of legJoinRes.data || []) {
        const eid = row.engagement_id as string;
        const leg = row.legiscan_legislators as unknown as { people_id: number; name: string; party?: string; chamber?: string; state?: string } | null;
        if (!leg) continue;
        if (!legMap.has(eid)) legMap.set(eid, []);
        legMap.get(eid)!.push(leg);
      }

      const legStaffMap = new Map<string, { id: string; first_name: string; last_name: string; title?: string }[]>();
      for (const row of legStaffJoinRes.data || []) {
        const eid = row.engagement_id as string;
        const ls = row.legislative_office_staff as unknown as { id: string; first_name: string; last_name: string; title?: string } | null;
        if (!ls) continue;
        if (!legStaffMap.has(eid)) legStaffMap.set(eid, []);
        legStaffMap.get(eid)!.push(ls);
      }

      const enriched: EnrichedEngagement[] = rawEngagements.map(e => ({
        ...e,
        bills: billMap.get(e.id) || [],
        staff: staffMap.get(e.id) || [],
        contacts: contactMap.get(e.id) || [],
        legislators: legMap.get(e.id) || [],
        legStaff: legStaffMap.get(e.id) || [],
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
        case 'engagement': cmp = getEngagementText(a).localeCompare(getEngagementText(b)); break;
        case 'subject': cmp = a.subject.localeCompare(b.subject); break;
        case 'jurisdiction': cmp = (a.jurisdiction || '').localeCompare(b.jurisdiction || ''); break;
        case 'initiative': cmp = (a.initiative || '').localeCompare(b.initiative || ''); break;
        case 'location': cmp = (a.meeting_location || '').localeCompare(b.meeting_location || ''); break;
        case 'committee': cmp = (a.committee_of_jurisdiction || '').localeCompare(b.committee_of_jurisdiction || ''); break;
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
      'Date', 'Engagement', 'Meeting Level', 'Legislators Met', 'Legislative Staff Met',
      'Subject', 'Jurisdiction', 'Committee Role', 'Committee(s) of Jurisdiction',
      'Initiative', 'Meeting Location', 'Location Detail',
      'Bills', 'LL3 Staff', 'PSG Attendees', 'Duration (min)',
      'Topics Covered', 'Notes', 'Follow-Up Required', 'Follow-Up Date',
      'Follow-Up Assigned To', 'Follow-Up Completed', 'Follow-Up Notes',
    ];

    const rows = filteredEngagements.map(e => [
      e.date ? format(new Date(e.date + 'T00:00:00'), 'yyyy-MM-dd') : '',
      getEngagementText(e),
      e.type === 'legislator_office' ? (e.meeting_level || '') : '',
      e.legislators.map(l => `${l.name}${l.party ? ` (${l.party})` : ''}`).join('; '),
      e.legStaff.map(ls => `${ls.first_name} ${ls.last_name}${ls.title ? ` - ${ls.title}` : ''}`).join('; '),
      e.subject,
      getJurisdictionLabel(e.jurisdiction),
      e.committee_role ? (COMMITTEE_ROLE_LABELS[e.committee_role] || e.committee_role) : '',
      e.committee_of_jurisdiction || '',
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

    const baseHeaders = ['Date', 'Engagement', 'Subject', 'Jur.', 'Committee', 'Initiative', 'Location', 'Bills', 'Attendees', 'Dur.'];
    const headers = includeNotes ? [...baseHeaders, 'Notes'] : baseHeaders;

    const committeeText = (e: any): string => {
      if (!e.committee_of_jurisdiction) return '';
      const role = e.committee_role ? (COMMITTEE_ROLE_LABELS[e.committee_role] || e.committee_role) + ': ' : '';
      const text = role + e.committee_of_jurisdiction;
      return text.length > 30 ? text.slice(0, 27) + '...' : text;
    };

    const rows = filteredEngagements.map(e => {
      const engText = getEngagementText(e);
      const base = [
        e.date ? format(new Date(e.date + 'T00:00:00'), 'MM/dd/yy') : '',
        engText.length > 30 ? engText.slice(0, 27) + '...' : engText,
        e.subject,
        getJurisdictionLabel(e.jurisdiction),
        committeeText(e),
        e.initiative || '',
        e.meeting_location ? (MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location) : '',
        e.bills.map(b => formatBillNumber(b.bill_number)).join('; '),
        [...e.staff.map(s => s.full_name || ''), ...e.contacts.map(c => `${c.first_name} ${c.last_name}`)].join('; '),
        e.duration != null ? `${e.duration}m` : '',
      ];
      if (includeNotes) {
        const notes = e.notes || '';
        base.push(notes.length > 150 ? notes.slice(0, 147) + '...' : notes);
      }
      return base;
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 36,
      styles: { fontSize: includeNotes ? 6 : 6.5, cellPadding: 2 },
      headStyles: { fillColor: [13, 148, 136] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: includeNotes
        ? {
            0: { cellWidth: 18 },  // Date
            1: { cellWidth: 22 },  // Engagement
            2: { cellWidth: 42 },  // Subject
            3: { cellWidth: 16 },  // Jur.
            4: { cellWidth: 22 },  // Committee
            5: { cellWidth: 'auto' }, // Initiative (takes remaining)
            6: { cellWidth: 16 },  // Location
            7: { cellWidth: 14 },  // Bills
            8: { cellWidth: 18 },  // Attendees
            9: { cellWidth: 10 },  // Dur.
            10: { cellWidth: 45 }, // Notes
          }
        : { 0: { cellWidth: 18 }, 2: { cellWidth: 40 }, 8: { cellWidth: 14 } },
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

  /** Render the Engagement cell with contextual content + type badge */
  const renderEngagementCell = (e: EnrichedEngagement) => {
    const badgeColor = GA_ENGAGEMENT_TYPE_BADGE_COLORS[e.type] || 'bg-gray-100 text-gray-600';
    const typeLabel = GA_ENGAGEMENT_TYPE_LABELS[e.type] || e.type;

    switch (e.type) {
      case 'legislator_office': {
        const legNames = e.legislators.map(l => {
          const partyTag = l.party ? ` (${l.party})` : '';
          return `${l.name}${partyTag}`;
        });
        const legStaffNames = e.legStaff.map(ls => `${ls.first_name} ${ls.last_name}`);
        const displayName = legNames.length > 0 ? legNames.join(', ') : (e.legislator_name || 'Unknown Legislator');
        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-gray-900">{displayName}</span>
              {e.meeting_level && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  e.meeting_level === 'member' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {e.meeting_level === 'member' ? 'Member' : 'Staff'}
                </span>
              )}
            </div>
            {legStaffNames.length > 0 && (
              <span className="text-xs text-gray-500">Staff: {legStaffNames.join(', ')}</span>
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${badgeColor}`}>
              {typeLabel}
            </span>
          </div>
        );
      }
      case 'lobby_team': {
        const names = e.staff.map(s => s.full_name || '').filter(Boolean);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900">
              {names.length > 0 ? names.join(', ') : 'Lobby Team'}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${badgeColor}`}>
              {typeLabel}
            </span>
          </div>
        );
      }
      case 'ga_committee':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900">{e.association_name || 'GA Committee'}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${badgeColor}`}>
              {typeLabel}
            </span>
          </div>
        );
      case 'committee_meeting':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900">{e.association_name || 'Committee Meeting'}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${badgeColor}`}>
              {typeLabel}
            </span>
          </div>
        );
      case 'federal_state_entity':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-gray-900">{e.entity_name || 'Federal/State Entity'}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${badgeColor}`}>
              {typeLabel}
            </span>
          </div>
        );
      default:
        return <span className="text-gray-600">{typeLabel}</span>;
    }
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
  const totalCols = 12; // expand chevron + 11 data columns

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold flex items-center">
              <FileBarChart className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
              Legislative Activity Reports
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-teal-100">Filter, analyze, and export engagement data</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 sm:mt-0 sm:flex sm:space-x-6 text-center">
            <div>
              <p className="text-lg sm:text-2xl font-bold">{engagements.length}</p>
              <p className="text-xs text-teal-200">Total</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold">{filteredEngagements.length}</p>
              <p className="text-xs text-teal-200">Filtered</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold">{engagements.filter(e => e.follow_up_required && !e.follow_up_completed).length}</p>
              <p className="text-xs text-teal-200">Follow-Ups</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Showing {filteredEngagements.length} of {engagements.length}
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

      {/* Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Mobile card view */}
        <div className="md:hidden divide-y divide-gray-100">
          {previewData.map(e => {
            const isExpanded = expandedRow === e.id;
            const hasDetail = !!(e.notes || e.topics_covered || e.follow_up_notes || e.meeting_location_detail);
            return (
              <div
                key={e.id}
                className={`p-4 space-y-2 ${isExpanded ? 'bg-teal-50/30' : ''}`}
                onClick={() => setExpandedRow(isExpanded ? null : e.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-gray-500">{e.date ? format(new Date(e.date + 'T00:00:00'), 'MM/dd/yy') : ''}</span>
                  <div className="flex items-center gap-1.5">
                    {e.follow_up_required && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        e.follow_up_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {e.follow_up_completed ? 'Done' : e.follow_up_date ? format(new Date(e.follow_up_date + 'T00:00:00'), 'MM/dd') : 'Pending'}
                      </span>
                    )}
                    {hasDetail && <ChevronRight className={`w-3.5 h-3.5 text-teal-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />}
                  </div>
                </div>
                <div>{renderEngagementCell(e)}</div>
                {e.subject && <p className="text-sm text-gray-700 line-clamp-2">{e.subject}</p>}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {getJurisdictionLabel(e.jurisdiction) && (
                    <span className="text-gray-500">{getJurisdictionLabel(e.jurisdiction)}</span>
                  )}
                  {e.committee_of_jurisdiction && (
                    <span className="text-teal-700">
                      {e.committee_role ? `${COMMITTEE_ROLE_LABELS[e.committee_role] || e.committee_role}: ` : ''}
                      {e.committee_of_jurisdiction}
                    </span>
                  )}
                  {e.initiative && <span className="text-gray-500">{e.initiative}</span>}
                  {e.meeting_location && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                      e.meeting_location === 'virtual' ? 'bg-blue-50 text-blue-700' :
                      e.meeting_location === 'in_person' ? 'bg-green-50 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location}
                    </span>
                  )}
                  {e.duration != null && <span className="text-gray-400">{e.duration}m</span>}
                </div>
                {e.bills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {e.bills.map(b => (
                      <span key={b.id} className="inline-block px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs">
                        {formatBillNumber(b.bill_number)}
                      </span>
                    ))}
                  </div>
                )}
                {isExpanded && (
                  <div className="pt-2 border-t border-gray-100 space-y-2 text-sm" onClick={(ev) => ev.stopPropagation()}>
                    {e.notes && <div><span className="font-medium text-gray-700">Notes:</span><p className="mt-0.5 text-gray-600 whitespace-pre-wrap">{e.notes}</p></div>}
                    {e.topics_covered && <div><span className="font-medium text-gray-700">Topics:</span><p className="mt-0.5 text-gray-600 whitespace-pre-wrap">{e.topics_covered}</p></div>}
                    {e.meeting_location_detail && <div><span className="font-medium text-gray-700">Location:</span><p className="mt-0.5 text-gray-600">{e.meeting_location_detail}</p></div>}
                    {e.follow_up_notes && <div><span className="font-medium text-gray-700">Follow-Up:</span><p className="mt-0.5 text-gray-600 whitespace-pre-wrap">{e.follow_up_notes}</p></div>}
                    {e.staff.length > 0 && <div><span className="font-medium text-gray-700">Staff:</span><span className="ml-1 text-gray-600">{e.staff.map(s => s.full_name || s.email).join(', ')}</span></div>}
                    {e.contacts.length > 0 && <div><span className="font-medium text-gray-700">PSG:</span><span className="ml-1 text-gray-600">{e.contacts.map(c => `${c.first_name} ${c.last_name}`).join(', ')}</span></div>}
                    {!e.notes && !e.topics_covered && !e.meeting_location_detail && !e.follow_up_notes && (
                      <p className="text-gray-400 italic text-xs">No additional details</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filteredEngagements.length === 0 && (
            <div className="px-4 py-12 text-center text-gray-500 text-sm">No engagements match your filters</div>
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-6 px-1 py-3"></th>
                {([
                  ['date', 'Date'],
                  ['engagement', 'Engagement'],
                  ['subject', 'Subject'],
                  ['jurisdiction', 'Jur.'],
                  ['committee', 'Committee'],
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
                      <td className="px-2 py-3 text-sm max-w-[220px]">
                        {renderEngagementCell(e)}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-900 max-w-[180px] truncate" title={e.subject}>
                        {e.subject}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {getJurisdictionLabel(e.jurisdiction) || '—'}
                      </td>
                      <td className="px-2 py-3 text-sm text-gray-600 max-w-[120px] truncate" title={e.committee_of_jurisdiction || ''}>
                        {e.committee_of_jurisdiction ? (
                          <span className="text-teal-700">
                            {e.committee_role ? `${COMMITTEE_ROLE_LABELS[e.committee_role] || e.committee_role}: ` : ''}
                            {e.committee_of_jurisdiction}
                          </span>
                        ) : '—'}
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
                        <td colSpan={totalCols} className="px-6 py-4">
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
                  <td colSpan={totalCols} className="px-4 py-12 text-center text-gray-500">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export</h3>

        <div className="flex items-center mb-4">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <StickyNote className="w-4 h-4 text-gray-500 ml-2 mr-1.5" />
            <span className="text-sm text-gray-700">Include notes in PDF export</span>
          </label>
        </div>

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
