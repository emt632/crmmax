import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScrollText, Plus, Search, Star, Link2, Loader2, Trash2, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Bill } from '../../types';
import {
  formatBillNumber,
  BILL_STATUS_LABELS,
  BILL_STATUS_COLORS,
  BILL_STATUS_ORDER,
} from '../../lib/bill-format';
import { getOurStates, refreshBillFromLegiscan } from '../../lib/legiscan-api';
import DeleteConfirmModal from './DeleteConfirmModal';

const STATUS_PIPELINE_COLORS: Record<string, string> = {
  introduced: 'bg-gray-400',
  in_committee: 'bg-blue-500',
  passed_house: 'bg-indigo-500',
  passed_senate: 'bg-purple-500',
  enrolled: 'bg-amber-500',
  signed: 'bg-green-500',
  vetoed: 'bg-red-500',
  failed: 'bg-red-400',
};

const BillsList: React.FC = () => {
  const { user, hasModule } = useAuth();
  const navigate = useNavigate();

  const [bills, setBills] = useState<Bill[]>([]);
  const [companionMap, setCompanionMap] = useState<Record<string, { bill_number: string; id: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJurisdiction, setFilterJurisdiction] = useState('');
  const [filterPriority, setFilterPriority] = useState(false);
  const [ourStates, setOurStates] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBills();
    getOurStates().then(setOurStates);
  }, []);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchBills = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bills')
      .select('*')
      .order('updated_at', { ascending: false });
    const allBills = (data || []) as Bill[];

    // Retroactive companion scan: link bills that have legiscan sasts data
    // but haven't been grouped yet
    await autoLinkUnlinkedCompanions(allBills);

    // Re-fetch after potential linking
    const { data: refreshed } = await supabase
      .from('bills')
      .select('*')
      .order('updated_at', { ascending: false });
    const finalBills = (refreshed || allBills) as Bill[];
    setBills(finalBills);

    // Build companion map
    buildCompanionMap(finalBills);

    setLoading(false);
  };

  const autoLinkUnlinkedCompanions = async (allBills: Bill[]) => {
    // Build lookup: legiscan_bill_id → bill
    const byLegiscanId = new Map<number, Bill>();
    for (const b of allBills) {
      if (b.legiscan_bill_id) byLegiscanId.set(b.legiscan_bill_id, b);
    }

    // Find bills with sasts in legiscan_raw that aren't in a group yet
    const unlinked = allBills.filter(
      (b) => b.legiscan_raw?.sasts?.length > 0 && !b.bill_group_id
    );

    for (const bill of unlinked) {
      const sasts = bill.legiscan_raw.sasts as Array<{ sast_bill_id: number }>;
      const companions = sasts
        .map((s) => byLegiscanId.get(s.sast_bill_id))
        .filter(Boolean) as Bill[];

      if (companions.length === 0) continue;

      // Check if any companion already has a group
      const existingGroupId = companions.find((c) => c.bill_group_id)?.bill_group_id;
      let groupId = existingGroupId;

      if (!groupId) {
        const { data: group } = await supabase
          .from('bill_groups')
          .insert({ label: 'Companion Bills', created_by: user?.id })
          .select('id')
          .single();
        if (!group) continue;
        groupId = group.id;
      }

      const idsToLink = [
        bill.id,
        ...companions.filter((c) => !c.bill_group_id).map((c) => c.id),
      ];

      await supabase
        .from('bills')
        .update({ bill_group_id: groupId })
        .in('id', idsToLink);

      // Update local references so subsequent iterations see the group
      bill.bill_group_id = groupId;
      for (const c of companions) {
        if (!c.bill_group_id) c.bill_group_id = groupId;
      }
    }
  };

  const buildCompanionMap = (allBills: Bill[]) => {
    const grouped: Record<string, Bill[]> = {};
    for (const b of allBills) {
      if (b.bill_group_id) {
        if (!grouped[b.bill_group_id]) grouped[b.bill_group_id] = [];
        grouped[b.bill_group_id].push(b);
      }
    }
    const cMap: Record<string, { bill_number: string; id: string }[]> = {};
    for (const group of Object.values(grouped)) {
      for (const b of group) {
        cMap[b.id] = group
          .filter((other) => other.id !== b.id)
          .map((other) => ({ bill_number: other.bill_number, id: other.id }));
      }
    }
    setCompanionMap(cMap);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Remove from junction tables first
    await supabase.from('ga_engagement_bills').delete().eq('bill_id', deleteTarget.id);
    // If this bill is in a group and is the last companion, clean up the other bill's group ref
    if (deleteTarget.bill_group_id) {
      const companions = bills.filter(
        (b) => b.bill_group_id === deleteTarget.bill_group_id && b.id !== deleteTarget.id
      );
      if (companions.length === 1) {
        // Only one companion left — remove its group link
        await supabase.from('bills').update({ bill_group_id: null }).eq('id', companions[0].id);
      }
      if (companions.length === 0) {
        // No companions — delete the group
        await supabase.from('bill_groups').delete().eq('id', deleteTarget.bill_group_id);
      }
    }
    await supabase.from('bills').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    fetchBills();
  };

  const handleRefreshAll = async () => {
    const legiscanBills = bills.filter((b) => b.legiscan_bill_id);
    if (legiscanBills.length === 0 || refreshing) return;

    setRefreshing(true);
    setRefreshMsg(null);
    let updatedCount = 0;

    for (let i = 0; i < legiscanBills.length; i++) {
      const b = legiscanBills[i];
      setRefreshProgress(`Refreshing ${i + 1}/${legiscanBills.length}...`);
      try {
        const result = await refreshBillFromLegiscan(b.id, b.legiscan_bill_id!);
        if (result?.updated) updatedCount++;
      } catch {
        // Continue with remaining bills
      }
    }

    setRefreshProgress('');
    setRefreshMsg(
      updatedCount > 0
        ? `Updated ${updatedCount} bill${updatedCount !== 1 ? 's' : ''}`
        : 'All bills are up to date',
    );
    await fetchBills();
    setRefreshing(false);
    setTimeout(() => setRefreshMsg(null), 5000);
  };

  // Filtering
  const filtered = bills.filter((b) => {
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterJurisdiction && b.jurisdiction !== filterJurisdiction) return false;
    if (filterPriority && !b.is_priority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.bill_number.toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Status pipeline counts
  const statusCounts: Record<string, number> = {};
  bills.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });
  const totalBills = bills.length;

  // Unique jurisdictions
  const jurisdictions = [...new Set(bills.map((b) => b.jurisdiction))].sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold flex items-center">
              <ScrollText className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
              Bills
            </h1>
            <p className="mt-2 text-teal-200 text-sm sm:text-base">{bills.length} bill{bills.length !== 1 ? 's' : ''} tracked</p>
          </div>
          <div className="flex items-center gap-2">
            {bills.some((b) => b.legiscan_bill_id) && (
              <button
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                title="Refresh all bills from LegiScan"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">
                  {refreshProgress || 'Refresh All'}
                </span>
              </button>
            )}
            <Link
              to="/advocacy/bills/new"
              className="flex items-center gap-2 px-5 py-3 bg-white text-teal-700 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Add Bill</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Refresh Flash */}
      {refreshMsg && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 text-sm font-medium">
          {refreshMsg}
        </div>
      )}

      {/* Status Pipeline Bar */}
      {totalBills > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Bill Status Pipeline</h3>
          <div className="flex rounded-full overflow-hidden h-4">
            {BILL_STATUS_ORDER.map((status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              const pct = (count / totalBills) * 100;
              return (
                <div
                  key={status}
                  className={`${STATUS_PIPELINE_COLORS[status]} relative group cursor-pointer transition-opacity hover:opacity-80`}
                  style={{ width: `${pct}%`, minWidth: count > 0 ? '2px' : '0' }}
                  onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                  title={`${BILL_STATUS_LABELS[status]}: ${count}`}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {BILL_STATUS_LABELS[status]}: {count}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {BILL_STATUS_ORDER.map((status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors ${
                    filterStatus === status
                      ? 'bg-teal-100 text-teal-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${STATUS_PIPELINE_COLORS[status]}`} />
                  {BILL_STATUS_LABELS[status]} ({count})
                </button>
              );
            })}
          </div>
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
              placeholder="Search bills..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all"
            />
          </div>
          <select
            value={filterJurisdiction}
            onChange={(e) => setFilterJurisdiction(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
          >
            <option value="">All Jurisdictions</option>
            {jurisdictions.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
          <button
            onClick={() => setFilterPriority(!filterPriority)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              filterPriority
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Star className={`w-4 h-4 ${filterPriority ? 'fill-current' : ''}`} />
            Priority
          </button>
          {(filterStatus || filterJurisdiction || filterPriority || searchQuery) && (
            <button
              onClick={() => {
                setFilterStatus('');
                setFilterJurisdiction('');
                setFilterPriority(false);
                setSearchQuery('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 px-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">
            {bills.length === 0 ? 'No bills tracked yet' : 'No bills match your filters'}
          </p>
          {bills.length === 0 && (
            <Link
              to="/advocacy/bills/new"
              className="mt-3 inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add your first bill
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((bill) => {
              const statusColor = BILL_STATUS_COLORS[bill.status];
              const ourStateCosponsorCount = bill.cosponsors?.filter(
                (cs) => ourStates.includes(cs.state || '')
              ).length || 0;
              const companions = companionMap[bill.id] || [];

              return (
                <div
                  key={bill.id}
                  className="flex items-center px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/advocacy/bills/${bill.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        {formatBillNumber(bill.bill_number)}
                      </span>
                      {bill.is_priority && (
                        <Star className="w-4 h-4 text-amber-500 fill-current" />
                      )}
                      {companions.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          <Link2 className="w-3 h-3" />
                          {companions.map((c) => formatBillNumber(c.bill_number)).join(', ')}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor.bg} ${statusColor.text}`}>
                        {BILL_STATUS_LABELS[bill.status]}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {bill.jurisdiction}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{bill.title}</p>
                    {bill.author && (
                      <p className="text-xs text-gray-500 mt-1">Author: {bill.author}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {ourStateCosponsorCount > 0 && (
                      <span className="text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded-full whitespace-nowrap">
                        {ourStateCosponsorCount} our states
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(bill);
                      }}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete bill"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        itemLabel={deleteTarget ? formatBillNumber(deleteTarget.bill_number) : ''}
      />
    </div>
  );
};

export default BillsList;
