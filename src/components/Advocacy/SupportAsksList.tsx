import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, Search, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_COLORS,
  SUPPORT_TYPE_LABELS,
  OUTREACH_METHOD_LABELS,
  TARGET_TYPE_LABELS,
} from '../../lib/bill-format';
import { getInitiativeOptions } from '../../lib/legiscan-api';
import type { SupportAsk } from '../../types';

/* ── Pipeline segment colors (tailwind classes for the summary bar) ── */
const PIPELINE_SEGMENT_COLORS: Record<string, { bg: string; text: string }> = {
  pending:          { bg: 'bg-gray-200', text: 'text-gray-700' },
  follow_up_needed: { bg: 'bg-amber-300', text: 'text-amber-900' },
  committed:        { bg: 'bg-blue-400', text: 'text-blue-900' },
  received:         { bg: 'bg-green-400', text: 'text-green-900' },
  declined:         { bg: 'bg-red-400', text: 'text-red-900' },
};

const PIPELINE_ORDER = ['pending', 'follow_up_needed', 'committed', 'received', 'declined'];

/* ── Outreach method badge colors ── */
const OUTREACH_BADGE_COLORS: Record<string, string> = {
  virtual:   'bg-indigo-100 text-indigo-700',
  in_person: 'bg-teal-100 text-teal-700',
  email:     'bg-sky-100 text-sky-700',
  phone:     'bg-violet-100 text-violet-700',
  letter:    'bg-amber-100 text-amber-700',
  other:     'bg-gray-100 text-gray-600',
};

const SupportAsksList: React.FC = () => {
  const { hasModule, effectiveUserId } = useAuth();

  const [asks, setAsks] = useState<SupportAsk[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInitiative, setFilterInitiative] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');
  const [initiativeOptions, setInitiativeOptions] = useState<string[]>([]);
  const [showAllInitiatives, setShowAllInitiatives] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchData = async () => {
    setLoading(true);

    // Fetch support asks + initiative options in parallel
    const [asksResult, initiatives] = await Promise.all([
      supabase
        .from('support_asks')
        .select('*')
        .order('ask_date', { ascending: false }),
      getInitiativeOptions(),
    ]);

    const askList = (asksResult.data || []) as SupportAsk[];
    setInitiativeOptions(initiatives);

    if (askList.length === 0) {
      setAsks([]);
      setLoading(false);
      return;
    }

    // Collect IDs to resolve display names
    const legislatorPeopleIds = new Set<number>();
    const contactIds = new Set<string>();
    const orgIds = new Set<string>();
    const legStaffIds = new Set<string>();
    const requesterIds = new Set<string>();

    for (const ask of askList) {
      requesterIds.add(ask.requester_id);
      switch (ask.target_type) {
        case 'legislator':
          if (ask.target_legislator_people_id) legislatorPeopleIds.add(ask.target_legislator_people_id);
          break;
        case 'contact':
          if (ask.target_contact_id) contactIds.add(ask.target_contact_id);
          break;
        case 'organization':
          if (ask.target_organization_id) orgIds.add(ask.target_organization_id);
          // Also resolve the paired contact for org-type asks
          if (ask.target_contact_id) contactIds.add(ask.target_contact_id);
          break;
        case 'leg_staff':
          if (ask.target_leg_staff_id) legStaffIds.add(ask.target_leg_staff_id);
          break;
      }
    }

    // Resolve names in parallel
    const [legResult, contactResult, orgResult, staffResult, userResult] = await Promise.all([
      legislatorPeopleIds.size > 0
        ? supabase
            .from('legiscan_legislators')
            .select('people_id, name')
            .in('people_id', [...legislatorPeopleIds])
        : Promise.resolve({ data: [] }),
      contactIds.size > 0
        ? supabase
            .from('contacts')
            .select('id, first_name, last_name')
            .in('id', [...contactIds])
        : Promise.resolve({ data: [] }),
      orgIds.size > 0
        ? supabase
            .from('organizations')
            .select('id, name')
            .in('id', [...orgIds])
        : Promise.resolve({ data: [] }),
      legStaffIds.size > 0
        ? supabase
            .from('legislative_office_staff')
            .select('id, first_name, last_name')
            .in('id', [...legStaffIds])
        : Promise.resolve({ data: [] }),
      requesterIds.size > 0
        ? supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', [...requesterIds])
        : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const legMap: Record<number, string> = {};
    for (const l of (legResult.data || []) as any[]) {
      legMap[l.people_id] = l.name;
    }

    const contactMap: Record<string, string> = {};
    for (const c of (contactResult.data || []) as any[]) {
      contactMap[c.id] = `${c.first_name} ${c.last_name}`.trim();
    }

    const orgMap: Record<string, string> = {};
    for (const o of (orgResult.data || []) as any[]) {
      orgMap[o.id] = o.name;
    }

    const staffMap: Record<string, string> = {};
    for (const s of (staffResult.data || []) as any[]) {
      staffMap[s.id] = `${s.first_name} ${s.last_name}`.trim();
    }

    const userMap: Record<string, string> = {};
    for (const u of (userResult.data || []) as any[]) {
      userMap[u.id] = u.full_name || u.email;
    }

    // Enrich asks with display names
    const enriched = askList.map((ask) => {
      let targetDisplayName = '';
      switch (ask.target_type) {
        case 'legislator':
          targetDisplayName = ask.target_legislator_people_id
            ? legMap[ask.target_legislator_people_id] || 'Unknown Legislator'
            : '';
          break;
        case 'contact':
          targetDisplayName = ask.target_contact_id
            ? contactMap[ask.target_contact_id] || 'Unknown Contact'
            : '';
          break;
        case 'organization':
          targetDisplayName = ask.target_organization_id
            ? orgMap[ask.target_organization_id] || 'Unknown Organization'
            : '';
          break;
        case 'leg_staff':
          targetDisplayName = ask.target_leg_staff_id
            ? staffMap[ask.target_leg_staff_id] || 'Unknown Staff'
            : '';
          break;
        case 'other':
          targetDisplayName = ask.target_name || 'Other';
          break;
      }

      // Resolve paired contact name for org-type asks
      const targetContactDisplayName =
        ask.target_type === 'organization' && ask.target_contact_id
          ? contactMap[ask.target_contact_id] || ''
          : '';

      return {
        ...ask,
        target_display_name: targetDisplayName,
        target_contact_display_name: targetContactDisplayName,
        requester_name: userMap[ask.requester_id] || '',
      };
    });

    setAsks(enriched);
    setLoading(false);
  };

  /* ── Filtering ── */
  const filtered = asks.filter((a) => {
    if (filterStatus && a.support_status !== filterStatus) return false;
    if (filterInitiative === '__none__' && a.initiative) return false;
    if (filterInitiative && filterInitiative !== '__none__' && a.initiative !== filterInitiative) return false;
    if (filterTargetType && a.target_type !== filterTargetType) return false;
    if (filterScope === 'mine' && a.created_by !== effectiveUserId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (a.target_display_name || '').toLowerCase().includes(q) ||
        (a.target_contact_display_name || '').toLowerCase().includes(q) ||
        (a.initiative || '').toLowerCase().includes(q) ||
        (a.ask_notes || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── Pipeline counts (from full dataset, not filtered) ── */
  const pipelineCounts: Record<string, number> = {};
  for (const status of PIPELINE_ORDER) {
    pipelineCounts[status] = 0;
  }
  for (const a of asks) {
    if (pipelineCounts[a.support_status] !== undefined) {
      pipelineCounts[a.support_status]++;
    }
  }
  const totalPipeline = asks.length;

  /* ── Overall conversion rate ── */
  const totalConverted = asks.filter((a) => a.support_status === 'committed' || a.support_status === 'received').length;
  const overallConversionRate = asks.length > 0 ? Math.round((totalConverted / asks.length) * 100) : 0;

  /* ── Per-initiative conversion rates ── */
  const initiativeGroups: { name: string; total: number; converted: number; rate: number }[] = [];
  const groupMap: Record<string, { total: number; converted: number }> = {};
  for (const a of asks) {
    const key = a.initiative || '';
    if (!groupMap[key]) groupMap[key] = { total: 0, converted: 0 };
    groupMap[key].total++;
    if (a.support_status === 'committed' || a.support_status === 'received') {
      groupMap[key].converted++;
    }
  }
  for (const [key, val] of Object.entries(groupMap)) {
    initiativeGroups.push({
      name: key || 'No initiative',
      total: val.total,
      converted: val.converted,
      rate: val.total > 0 ? Math.round((val.converted / val.total) * 100) : 0,
    });
  }
  // Sort by rate desc, "No initiative" always last
  initiativeGroups.sort((a, b) => {
    if (a.name === 'No initiative') return 1;
    if (b.name === 'No initiative') return -1;
    return b.rate - a.rate;
  });
  const visibleInitiatives = showAllInitiatives ? initiativeGroups : initiativeGroups.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold flex items-center">
              <Heart className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
              Support Tracker
            </h1>
            <p className="mt-2 text-teal-200 text-sm sm:text-base">
              {asks.length} support ask{asks.length !== 1 ? 's' : ''} tracked
              {asks.length > 0 && ` \u00b7 ${overallConversionRate}% conversion rate`}
            </p>
          </div>
          <Link
            to="/advocacy/support-campaigns/new"
            className="flex items-center gap-2 px-5 py-3 bg-white text-teal-700 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Log Support Ask</span>
          </Link>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      {!loading && totalPipeline > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Pipeline</p>
          <div className="flex rounded-lg overflow-hidden h-9">
            {PIPELINE_ORDER.map((status) => {
              const count = pipelineCounts[status];
              if (count === 0) return null;
              const pct = (count / totalPipeline) * 100;
              const colors = PIPELINE_SEGMENT_COLORS[status];
              return (
                <div
                  key={status}
                  className={`${colors.bg} ${colors.text} flex items-center justify-center text-xs font-semibold transition-all`}
                  style={{ width: `${pct}%`, minWidth: count > 0 ? '48px' : 0 }}
                  title={`${SUPPORT_STATUS_LABELS[status]}: ${count}`}
                >
                  {count} {SUPPORT_STATUS_LABELS[status]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Initiative Performance */}
      {!loading && initiativeGroups.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Initiative Conversion Rates</p>
          <div className="space-y-2">
            {visibleInitiatives.map((group) => (
              <button
                key={group.name}
                onClick={() =>
                  setFilterInitiative(
                    group.name === 'No initiative'
                      ? filterInitiative === '__none__' ? '' : '__none__'
                      : filterInitiative === group.name ? '' : group.name
                  )
                }
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  (filterInitiative === group.name || (filterInitiative === '__none__' && group.name === 'No initiative'))
                    ? 'bg-teal-50 ring-1 ring-teal-300'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{group.name}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{group.converted}/{group.total} converted</span>
                    <span className="font-semibold text-gray-700">{group.rate}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${group.rate}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
          {initiativeGroups.length > 5 && (
            <button
              onClick={() => setShowAllInitiatives(!showAllInitiatives)}
              className="mt-2 flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              {showAllInitiatives ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show fewer
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  Show all {initiativeGroups.length} initiatives
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search support asks..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
          >
            <option value="">All Statuses</option>
            {Object.entries(SUPPORT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterInitiative}
            onChange={(e) => setFilterInitiative(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
          >
            <option value="">All Initiatives</option>
            {initiativeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <select
            value={filterTargetType}
            onChange={(e) => setFilterTargetType(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
          >
            <option value="">All Target Types</option>
            {Object.entries(TARGET_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilterScope('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filterScope === 'all' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterScope('mine')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filterScope === 'mine' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500'
              }`}
            >
              Mine
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">
            {asks.length === 0 ? 'No support asks tracked yet' : 'No support asks match your filters'}
          </p>
          {asks.length === 0 && (
            <Link
              to="/advocacy/support-campaigns/new"
              className="mt-3 inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Log your first support ask
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((ask) => {
              const statusBadge = SUPPORT_STATUS_COLORS[ask.support_status] || 'bg-gray-100 text-gray-700';
              const outreachBadge = OUTREACH_BADGE_COLORS[ask.outreach_method] || 'bg-gray-100 text-gray-600';

              return (
                <Link
                  key={ask.id}
                  to={`/advocacy/support-campaigns/${ask.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Badges */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
                          {SUPPORT_STATUS_LABELS[ask.support_status] || ask.support_status}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {TARGET_TYPE_LABELS[ask.target_type] || ask.target_type}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${outreachBadge}`}>
                          {OUTREACH_METHOD_LABELS[ask.outreach_method] || ask.outreach_method}
                        </span>
                      </div>
                      {/* Row 2: Target name */}
                      <p className="font-medium text-gray-900">
                        {ask.target_display_name || 'Unnamed Target'}
                      </p>
                      {ask.target_contact_display_name && (
                        <p className="text-xs text-gray-500">{ask.target_contact_display_name}</p>
                      )}
                      {/* Row 3: Initiative + Support type */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {ask.initiative && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                            {ask.initiative}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {SUPPORT_TYPE_LABELS[ask.support_type_requested] || ask.support_type_requested}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                      <span className="text-sm text-gray-500">{ask.ask_date}</span>
                      {ask.requester_name && (
                        <span className="text-xs text-gray-400">{ask.requester_name}</span>
                      )}
                      {ask.thank_you_sent && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium mt-1">
                          <Check className="w-3 h-3" />
                          Thanked
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportAsksList;
