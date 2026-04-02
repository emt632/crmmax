import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Star, Loader2, Link2, Users, Handshake,
  ChevronDown, ChevronUp, Clock, Calendar, ExternalLink, RefreshCw,
  Paperclip,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Bill, GAEngagement } from '../../types';
import BillStatusPipeline from './BillStatusPipeline';
import {
  formatBillNumber, BILL_STATUS_LABELS, BILL_STATUS_COLORS,
  GA_ENGAGEMENT_TYPE_LABELS, GA_ENGAGEMENT_TYPE_BADGE_COLORS,
  parseSponsorState,
} from '../../lib/bill-format';
import { getOurStates, refreshBillFromLegiscan } from '../../lib/legiscan-api';
import { matchCommittee, getCommitteeMembers } from '../../lib/congress-data';
import type { CommitteeMember } from '../../lib/congress-data';

// ─── Types ──────────────────────────────────────────────────

interface RawSponsor {
  people_id: number;
  name: string;
  party?: string;
  state?: string;
  district?: string;
  sponsor_type_desc?: string;
  sponsor_type?: string;
  sponsor_type_id?: number;
  sponsor_order?: number;
}

interface HistoryEntry {
  date: string;
  action: string;
  chamber: string;
}

interface EngagementDetail {
  bills: { id: string; bill_number: string; title: string }[];
  staff: { id: string; full_name: string | null; email: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  attachments: { id: string; file_name: string; public_url: string }[];
}

// ─── Helpers ────────────────────────────────────────────────

function chamberBadge(chamber: string) {
  const c = (chamber || '').toUpperCase();
  if (c === 'H' || c.startsWith('HOUSE'))
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">House</span>;
  if (c === 'S' || c.startsWith('SENATE'))
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Senate</span>;
  return null;
}

function isPrimarySponsor(s: RawSponsor): boolean {
  // Check sponsor_type_id (LegiScan: 0=Author, 1=Primary Sponsor)
  if (s.sponsor_type_id === 0 || s.sponsor_type_id === 1) return true;
  // Check text fields (sponsor_type_desc or sponsor_type)
  const role = (s.sponsor_type_desc || s.sponsor_type || '').toLowerCase();
  if (role.includes('primary') || role === 'author' || role === 'sponsor') return true;
  // sponsor_order 1 with no "co" in the role
  if (s.sponsor_order === 1 && !role.includes('co')) return true;
  return false;
}

function isCoAuthor(s: RawSponsor): boolean {
  const role = (s.sponsor_type_desc || s.sponsor_type || '').toLowerCase();
  return role.includes('co-author') || role.includes('coauthor');
}

function parseSponsorGroups(bill: Bill, ourStates: string[]) {
  const rawSponsors = bill.legiscan_raw?.sponsors;
  // Handle both array and object formats from LegiScan
  const raw: RawSponsor[] = Array.isArray(rawSponsors)
    ? rawSponsors
    : rawSponsors
      ? Object.values(rawSponsors)
      : [];
  const billState = bill.jurisdiction || 'US';

  let author: { name: string; party?: string; state?: string; district?: string } | null = null;
  const coAuthors: typeof bill.cosponsors = [];
  const cosponsors: typeof bill.cosponsors = [];

  // Build a people_id → state lookup from stored cosponsors (parsed during import)
  const storedStateByPeopleId = new Map<number, string>();
  for (const cs of bill.cosponsors) {
    if (cs.people_id && cs.state && cs.state !== billState) {
      storedStateByPeopleId.set(cs.people_id, cs.state);
    }
  }

  if (raw.length > 0) {
    // Track the primary sponsor's people_id to exclude from cosponsors
    let authorPeopleId: number | null = null;

    for (const s of raw) {
      // Resolve state: try district parsing, then stored cosponsor data
      let state = parseSponsorState(billState, s.district);
      if (state === billState && s.people_id && storedStateByPeopleId.has(s.people_id)) {
        state = storedStateByPeopleId.get(s.people_id)!;
      }

      const entry = {
        people_id: s.people_id,
        name: s.name,
        party: s.party || '',
        state,
        district: s.district || '',
      };

      if (isPrimarySponsor(s)) {
        author = entry;
        authorPeopleId = s.people_id;
      } else if (isCoAuthor(s)) {
        coAuthors.push(entry);
      } else {
        cosponsors.push(entry);
      }
    }

    // Safety: remove author from cosponsors if they slipped through
    if (authorPeopleId) {
      const idx = cosponsors.findIndex((c) => c.people_id === authorPeopleId);
      if (idx !== -1) cosponsors.splice(idx, 1);
    }
  } else {
    // Fallback to stored data
    if (bill.author) author = { name: bill.author };
    cosponsors.push(...bill.cosponsors);
  }

  // Sort: our-state cosponsors first
  const sortByOurState = (a: typeof cosponsors[0], b: typeof cosponsors[0]) => {
    const aOur = ourStates.includes(a.state || '') ? 0 : 1;
    const bOur = ourStates.includes(b.state || '') ? 0 : 1;
    return aOur - bOur;
  };
  cosponsors.sort(sortByOurState);
  coAuthors.sort(sortByOurState);

  return { author, coAuthors, cosponsors };
}

function parseHistory(bill: Bill): HistoryEntry[] {
  const history: HistoryEntry[] = bill.legiscan_raw?.history || [];
  return [...history].sort((a, b) => b.date.localeCompare(a.date));
}

function getEntityDisplay(eng: GAEngagement, legNames?: string[]): string {
  switch (eng.type) {
    case 'legislator_office': return legNames?.join(', ') || eng.legislator_name || '';
    case 'ga_committee': return eng.association_name || '';
    case 'federal_state_entity': return eng.entity_name || '';
    default: return '';
  }
}

function followUpStatus(eng: GAEngagement) {
  if (!eng.follow_up_required) return null;
  if (eng.follow_up_completed) return { label: 'Completed', color: 'bg-green-100 text-green-700' };
  if (!eng.follow_up_date) return { label: 'Pending', color: 'bg-gray-100 text-gray-600' };
  const today = new Date().toISOString().slice(0, 10);
  if (eng.follow_up_date < today) return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
  if (eng.follow_up_date === today) return { label: 'Due Today', color: 'bg-amber-100 text-amber-700' };
  return { label: 'Upcoming', color: 'bg-blue-100 text-blue-700' };
}

// ─── Component ──────────────────────────────────────────────

const BillDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasModule } = useAuth();

  const [bill, setBill] = useState<Bill | null>(null);
  const [companionBills, setCompanionBills] = useState<Bill[]>([]);
  const [linkedEngagements, setLinkedEngagements] = useState<GAEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [ourStates, setOurStates] = useState<string[]>([]);

  // Refresh state
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Legislator names per engagement (from junction table)
  const [legislatorNames, setLegislatorNames] = useState<Record<string, string[]>>({});

  // Expandable states
  const [expandedCommittee, setExpandedCommittee] = useState<number | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [expandedEngagement, setExpandedEngagement] = useState<string | null>(null);
  const [engagementDetails, setEngagementDetails] = useState<Record<string, EngagementDetail>>({});
  const [engDetailLoading, setEngDetailLoading] = useState<string | null>(null);

  // Committee member state (keyed by committee index)
  const [committeeMembers, setCommitteeMembers] = useState<Record<number, CommitteeMember[]>>({});
  const [committeeMemberLoading, setCommitteeMemberLoading] = useState<number | null>(null);
  const [committeeMemberError, setCommitteeMemberError] = useState<Record<number, string>>({});

  useEffect(() => {
    if (id) {
      fetchBill();
      fetchLinkedEngagements();
    }
    getOurStates().then(setOurStates);
  }, [id]);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchBill = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from('bills').select('*').eq('id', id).single();
    if (error || !data) {
      navigate('/advocacy/bills');
      return;
    }
    setBill(data as Bill);

    // Fetch companion bills
    if (data.bill_group_id) {
      const { data: companions } = await supabase
        .from('bills')
        .select('id, bill_number, title, jurisdiction, status')
        .eq('bill_group_id', data.bill_group_id)
        .neq('id', id);
      setCompanionBills((companions || []) as Bill[]);
    }
    setLoading(false);
  };

  const fetchLinkedEngagements = async () => {
    if (!id) return;
    const { data: junctions } = await supabase
      .from('ga_engagement_bills')
      .select('engagement_id')
      .eq('bill_id', id);

    if (!junctions?.length) return;

    const engIds = junctions.map((j) => j.engagement_id);
    const { data: engagements } = await supabase
      .from('ga_engagements')
      .select('*')
      .in('id', engIds)
      .order('date', { ascending: false });
    setLinkedEngagements((engagements || []) as GAEngagement[]);

    // Fetch legislator names from junction table
    const { data: legJunc } = await supabase
      .from('ga_engagement_legislators')
      .select('engagement_id, people_id')
      .in('engagement_id', engIds);

    if (legJunc?.length) {
      const peopleIds = [...new Set(legJunc.map((r: any) => r.people_id))];
      const [officeRes, legRes] = await Promise.all([
        supabase.from('legislative_offices').select('name, legislator_people_id').in('legislator_people_id', peopleIds),
        supabase.from('legiscan_legislators').select('people_id, name').in('people_id', peopleIds),
      ]);

      const nameByPeopleId: Record<number, string> = {};
      for (const l of (legRes.data || []) as any[]) nameByPeopleId[l.people_id] = l.name;
      for (const o of (officeRes.data || []) as any[]) nameByPeopleId[o.legislator_people_id] = o.name;

      const nameMap: Record<string, string[]> = {};
      for (const r of legJunc as any[]) {
        if (!nameMap[r.engagement_id]) nameMap[r.engagement_id] = [];
        const name = nameByPeopleId[r.people_id];
        if (name) nameMap[r.engagement_id].push(name);
      }
      setLegislatorNames(nameMap);
    }
  };

  const fetchEngagementDetail = useCallback(async (engId: string) => {
    if (engagementDetails[engId]) return; // already cached
    setEngDetailLoading(engId);
    const [billsRes, staffRes, contactsRes, attachRes] = await Promise.all([
      supabase.from('ga_engagement_bills').select('bill_id, bills(id, bill_number, title)').eq('engagement_id', engId),
      supabase.from('ga_engagement_staff').select('user_id, users(id, full_name, email)').eq('engagement_id', engId),
      supabase.from('ga_engagement_contacts').select('contact_id, contacts(id, first_name, last_name)').eq('engagement_id', engId),
      supabase.from('ga_engagement_attachments').select('id, file_name, public_url').eq('engagement_id', engId),
    ]);

    const detail: EngagementDetail = {
      bills: (billsRes.data || []).map((r: any) => r.bills).filter(Boolean),
      staff: (staffRes.data || []).map((r: any) => r.users).filter(Boolean),
      contacts: (contactsRes.data || []).map((r: any) => r.contacts).filter(Boolean),
      attachments: (attachRes.data || []) as { id: string; file_name: string; public_url: string }[],
    };
    setEngagementDetails((prev) => ({ ...prev, [engId]: detail }));
    setEngDetailLoading(null);
  }, [engagementDetails]);

  const isFederal = bill?.jurisdiction === 'US';

  const toggleCommittee = useCallback(async (idx: number) => {
    if (expandedCommittee === idx) {
      setExpandedCommittee(null);
      return;
    }
    setExpandedCommittee(idx);

    // Already loaded or not federal → skip fetch
    if (committeeMembers[idx] || committeeMemberError[idx] || !isFederal || !bill) return;

    const c = bill.committees[idx];
    if (!c) return;

    setCommitteeMemberLoading(idx);
    try {
      const thomasId = await matchCommittee(c.name, c.chamber);
      if (!thomasId) {
        setCommitteeMemberError((prev) => ({ ...prev, [idx]: 'Could not match committee to roster data.' }));
        setCommitteeMemberLoading(null);
        return;
      }
      const members = await getCommitteeMembers(thomasId);
      setCommitteeMembers((prev) => ({ ...prev, [idx]: members }));
    } catch {
      setCommitteeMemberError((prev) => ({ ...prev, [idx]: 'Failed to load committee members.' }));
    }
    setCommitteeMemberLoading(null);
  }, [expandedCommittee, committeeMembers, committeeMemberError, isFederal, bill]);

  const toggleEngagement = (engId: string) => {
    if (expandedEngagement === engId) {
      setExpandedEngagement(null);
    } else {
      setExpandedEngagement(engId);
      fetchEngagementDetail(engId);
    }
  };

  const handleRefresh = async () => {
    if (!bill?.legiscan_bill_id || refreshing) return;
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const result = await refreshBillFromLegiscan(bill.id, bill.legiscan_bill_id);
      if (!result) {
        setRefreshMsg({ type: 'error', text: 'Could not fetch bill from LegiScan.' });
      } else if (result.changes.length === 0) {
        setRefreshMsg({ type: 'info', text: 'Bill is already up to date.' });
      } else {
        setRefreshMsg({ type: 'success', text: result.changes.join(', ') });
      }
      await fetchBill();
    } catch (err: any) {
      setRefreshMsg({ type: 'error', text: err.message || 'Refresh failed.' });
    }
    setRefreshing(false);
    setTimeout(() => setRefreshMsg(null), 6000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!bill) return null;

  const statusColor = BILL_STATUS_COLORS[bill.status];
  const { author, coAuthors, cosponsors } = parseSponsorGroups(bill, ourStates);
  const history = parseHistory(bill);
  const ourStateCosponsors = cosponsors.filter((cs) => ourStates.includes(cs.state || ''));
  const HISTORY_PREVIEW_COUNT = 5;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-8 text-white shadow-sm">
        <button
          onClick={() => navigate('/advocacy/bills')}
          className="flex items-center text-teal-200 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bills
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{formatBillNumber(bill.bill_number)}</h1>
              {bill.is_priority && (
                <Star className="w-6 h-6 text-amber-300 fill-current" />
              )}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor.bg} ${statusColor.text}`}>
                {BILL_STATUS_LABELS[bill.status]}
              </span>
            </div>
            <p className="text-teal-100 text-lg">{bill.title}</p>
            <p className="text-teal-200 text-sm mt-1">{bill.jurisdiction}</p>
          </div>
          <div className="flex items-center gap-2">
            {bill.legiscan_bill_id && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
                title="Refresh from LegiScan"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            <Link
              to={`/advocacy/bills/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* Refresh Flash */}
      {refreshMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          refreshMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          refreshMsg.type === 'info' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {refreshMsg.type === 'success' && 'Updated: '}{refreshMsg.text}
        </div>
      )}

      {/* Status Pipeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Bill Progress</h2>
        <BillStatusPipeline currentStatus={bill.status} />
      </div>

      {/* Bill Details + Committees (side by side) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Details</h2>
          {bill.description && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700">{bill.description}</p>
            </div>
          )}
          {/* Author / Primary Sponsor */}
          {author && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Author / Primary Sponsor</p>
              <p className="text-sm font-medium text-gray-900">
                {author.name}
                {author.party && <span className="text-gray-500 ml-1">({author.party})</span>}
                {author.state && <span className="text-gray-500 ml-1">- {author.state}</span>}
              </p>
            </div>
          )}
          {/* Co-Authors */}
          {coAuthors.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-2">Co-Authors ({coAuthors.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {coAuthors.map((ca, i) => {
                  const isOur = ourStates.includes(ca.state || '');
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${
                        isOur
                          ? 'bg-teal-100 text-teal-800 border border-teal-200 font-medium'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {ca.name}
                      {ca.party && <span className="opacity-60">({ca.party})</span>}
                      {ca.state && <span className="opacity-60">- {ca.state}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {bill.notes && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Internal Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}
        </div>

        {/* Committees — expandable accordion */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Committees</h2>
          {bill.committees.length > 0 ? (
            <div className="space-y-2">
              {bill.committees.map((c, i) => {
                const isExpanded = expandedCommittee === i;
                const members = committeeMembers[i];
                const isLoadingMembers = committeeMemberLoading === i;
                const error = committeeMemberError[i];

                // Sort: our-state members first within each party group
                const sortedMembers = members
                  ? [...members].sort((a, b) => {
                      // Majority first, then minority
                      if (a.side !== b.side) return a.side === 'majority' ? -1 : 1;
                      // Within same side: our-state first
                      const aOur = ourStates.includes(a.state) ? 0 : 1;
                      const bOur = ourStates.includes(b.state) ? 0 : 1;
                      if (aOur !== bOur) return aOur - bOur;
                      return a.rank - b.rank;
                    })
                  : null;

                const ourStateCount = members?.filter((m) => ourStates.includes(m.state)).length ?? 0;

                return (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleCommittee(i)}
                      className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{c.name}</span>
                        {c.chamber && chamberBadge(c.chamber)}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      }
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 text-sm bg-white border-t border-gray-100">
                        {!isFederal ? (
                          <p className="text-gray-400 italic">Committee member data is not available for state legislature bills.</p>
                        ) : isLoadingMembers ? (
                          <div className="flex items-center gap-2 text-gray-400 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading committee members...
                          </div>
                        ) : error ? (
                          <p className="text-gray-400 italic">{error}</p>
                        ) : sortedMembers && sortedMembers.length > 0 ? (
                          <div className="space-y-1">
                            {ourStateCount > 0 && (
                              <div className="mb-2">
                                <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                                  {ourStateCount} from our states
                                </span>
                              </div>
                            )}
                            {sortedMembers.map((m, mi) => {
                              const isOurState = ourStates.includes(m.state);
                              const prevMember = mi > 0 ? sortedMembers[mi - 1] : null;
                              const showDivider = prevMember && prevMember.side !== m.side;

                              return (
                                <React.Fragment key={m.bioguide}>
                                  {showDivider && (
                                    <div className="border-t border-gray-200 my-2" />
                                  )}
                                  <div
                                    className={`flex items-center gap-2 py-1.5 px-2 rounded ${
                                      isOurState ? 'bg-teal-50' : ''
                                    }`}
                                  >
                                    <span className="text-gray-900 font-medium text-sm flex-1 min-w-0 truncate">
                                      {m.name}
                                    </span>
                                    <span className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                                      m.party === 'R'
                                        ? 'bg-red-100 text-red-700'
                                        : m.party === 'D'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {m.party}
                                    </span>
                                    {isOurState && (
                                      <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">
                                        {m.state}
                                      </span>
                                    )}
                                    {!isOurState && m.state && (
                                      <span className="shrink-0 text-xs text-gray-400 w-6 text-center">{m.state}</span>
                                    )}
                                    {m.title && (
                                      <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                        {m.title}
                                      </span>
                                    )}
                                    <span className="shrink-0 text-xs text-gray-400 w-5 text-right">#{m.rank}</span>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                            <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                              {sortedMembers.length} members &middot; Source: unitedstates/congress-legislators
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-400 italic">No member data available for this committee.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No committees listed</p>
          )}
        </div>
      </div>

      {/* Legislative History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5" />
          Legislative History
        </h2>
        {history.length > 0 ? (
          <>
            <div className="space-y-0">
              {(showAllHistory ? history : history.slice(0, HISTORY_PREVIEW_COUNT)).map((h, i) => (
                <div key={i} className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400 font-mono whitespace-nowrap pt-0.5 w-20 shrink-0">{h.date}</span>
                  <div className="flex items-start gap-2 min-w-0">
                    {h.chamber && chamberBadge(h.chamber)}
                    <span className="text-sm text-gray-700">{h.action}</span>
                  </div>
                </div>
              ))}
            </div>
            {history.length > HISTORY_PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
              >
                {showAllHistory
                  ? <><ChevronUp className="w-4 h-4" /> Show less</>
                  : <><ChevronDown className="w-4 h-4" /> Show all {history.length} actions</>
                }
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">No legislative history available</p>
        )}
      </div>

      {/* Cosponsors */}
      {cosponsors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Cosponsors ({cosponsors.length})
            </h2>
            {ourStateCosponsors.length > 0 && (
              <span className="text-sm text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
                {ourStateCosponsors.length} from our states
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {cosponsors.map((cs, i) => {
              const isOurState = ourStates.includes(cs.state || '');
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                    isOurState
                      ? 'bg-teal-100 text-teal-800 border border-teal-200 font-medium'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}
                >
                  {cs.name}
                  {cs.party && <span className="text-xs opacity-60">({cs.party})</span>}
                  {cs.state && <span className="text-xs opacity-60">- {cs.state}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Companion Bills */}
      {companionBills.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Companion Bills
          </h2>
          <div className="space-y-2">
            {companionBills.map((b) => (
              <Link
                key={b.id}
                to={`/advocacy/bills/${b.id}`}
                className="block py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{formatBillNumber(b.bill_number)}</span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-sm text-gray-500">{b.jurisdiction}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${BILL_STATUS_COLORS[b.status]?.bg} ${BILL_STATUS_COLORS[b.status]?.text}`}>
                    {BILL_STATUS_LABELS[b.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate">{b.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Linked Engagements — expandable activity feed */}
      {linkedEngagements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Handshake className="w-5 h-5" />
            Linked Engagements ({linkedEngagements.length})
          </h2>
          <div className="space-y-2">
            {linkedEngagements.map((eng) => {
              const badgeColor = GA_ENGAGEMENT_TYPE_BADGE_COLORS[eng.type] || 'bg-gray-100 text-gray-700';
              const entity = getEntityDisplay(eng, legislatorNames[eng.id]);
              const isExpanded = expandedEngagement === eng.id;
              const detail = engagementDetails[eng.id];
              const isLoading = engDetailLoading === eng.id;
              const fStatus = followUpStatus(eng);

              return (
                <div key={eng.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Collapsed row */}
                  <button
                    onClick={() => toggleEngagement(eng.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                        {GA_ENGAGEMENT_TYPE_LABELS[eng.type]}
                      </span>
                      {eng.type === 'legislator_office' && eng.meeting_level && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          eng.meeting_level === 'member' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {eng.meeting_level === 'member' ? 'Member' : 'Staff'}
                        </span>
                      )}
                      {entity && <span className="text-sm font-medium text-gray-900 truncate">{entity}</span>}
                      <span className="text-sm text-gray-600 truncate">{eng.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <span className="text-xs text-gray-500">{eng.date}</span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-4 border-t border-gray-100 bg-gray-50 space-y-3 text-sm">
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading details...
                        </div>
                      ) : (
                        <>
                          {eng.notes && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                              <p className="text-gray-700 whitespace-pre-wrap">{eng.notes}</p>
                            </div>
                          )}
                          {eng.topics_covered && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Topics Covered</p>
                              <p className="text-gray-700">{eng.topics_covered}</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-4">
                            {eng.duration && (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Clock className="w-3.5 h-3.5" />
                                {eng.duration} min
                              </div>
                            )}
                            {fStatus && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">Follow-up:</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fStatus.color}`}>
                                  {fStatus.label}
                                </span>
                                {eng.follow_up_date && (
                                  <span className="text-xs text-gray-400">{eng.follow_up_date}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {eng.follow_up_notes && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Follow-up Notes</p>
                              <p className="text-gray-700">{eng.follow_up_notes}</p>
                            </div>
                          )}
                          {/* Attendees */}
                          {detail && (detail.staff.length > 0 || detail.contacts.length > 0) && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Attendees</p>
                              <div className="flex flex-wrap gap-1.5">
                                {detail.staff.map((s) => (
                                  <span key={s.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                                    {s.full_name || s.email}
                                  </span>
                                ))}
                                {detail.contacts.map((c) => (
                                  <Link
                                    key={c.id}
                                    to={`/contacts/${c.id}`}
                                    className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200 transition-colors"
                                  >
                                    {c.first_name} {c.last_name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Attachments */}
                          {detail && detail.attachments.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Attachments</p>
                              <div className="flex flex-wrap gap-1.5">
                                {detail.attachments.map((a) => (
                                  <a
                                    key={a.id}
                                    href={a.public_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200 transition-colors"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    {a.file_name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* View Full Link */}
                          <Link
                            to={`/advocacy/engagements/${eng.id}`}
                            className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 font-medium text-sm"
                          >
                            View Full Engagement
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillDetail;
