import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Handshake, Plus, Search, Loader2,
  Users, UserCircle, Building2, Gavel, ScrollText, Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { GAEngagement } from '../../types';
import { GA_ENGAGEMENT_TYPE_LABELS, GA_ENGAGEMENT_TYPE_BADGE_COLORS } from '../../lib/bill-format';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  lobby_team: <Users className="w-4 h-4" />,
  ga_committee: <Building2 className="w-4 h-4" />,
  legislator_office: <UserCircle className="w-4 h-4" />,
  committee_meeting: <Gavel className="w-4 h-4" />,
  federal_state_entity: <Building2 className="w-4 h-4" />,
};

const TYPE_BADGE_COLORS = GA_ENGAGEMENT_TYPE_BADGE_COLORS;

const EngagementsList: React.FC = () => {
  const { hasModule, effectiveUserId } = useAuth();

  const [engagements, setEngagements] = useState<GAEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterScope, setFilterScope] = useState<'all' | 'mine'>('all');

  // Junction counts
  const [billCounts, setBillCounts] = useState<Record<string, number>>({});
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchEngagements();
  }, []);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchEngagements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ga_engagements')
      .select('*')
      .order('date', { ascending: false });
    const engList = (data || []) as GAEngagement[];
    setEngagements(engList);

    // Fetch junction counts
    if (engList.length > 0) {
      const engIds = engList.map((e) => e.id);

      const [billJunc, staffJunc, contactJunc] = await Promise.all([
        supabase.from('ga_engagement_bills').select('engagement_id').in('engagement_id', engIds),
        supabase.from('ga_engagement_staff').select('engagement_id').in('engagement_id', engIds),
        supabase.from('ga_engagement_contacts').select('engagement_id').in('engagement_id', engIds),
      ]);

      const bCounts: Record<string, number> = {};
      (billJunc.data || []).forEach((r) => {
        bCounts[r.engagement_id] = (bCounts[r.engagement_id] || 0) + 1;
      });
      setBillCounts(bCounts);

      const aCounts: Record<string, number> = {};
      [...(staffJunc.data || []), ...(contactJunc.data || [])].forEach((r) => {
        aCounts[r.engagement_id] = (aCounts[r.engagement_id] || 0) + 1;
      });
      setAttendeeCounts(aCounts);
    }

    setLoading(false);
  };

  const filtered = engagements.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterScope === 'mine' && e.created_by !== effectiveUserId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.subject.toLowerCase().includes(q) ||
        (e.legislator_name || '').toLowerCase().includes(q) ||
        (e.association_name || '').toLowerCase().includes(q) ||
        (e.entity_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getEntityDisplay = (e: GAEngagement): string => {
    switch (e.type) {
      case 'legislator_office': return e.legislator_name || '';
      case 'ga_committee': return e.association_name || '';
      case 'federal_state_entity': return e.entity_name || '';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Handshake className="w-8 h-8 mr-3" />
              Engagements
            </h1>
            <p className="mt-2 text-teal-200">{engagements.length} engagement{engagements.length !== 1 ? 's' : ''} logged</p>
          </div>
          <Link
            to="/advocacy/engagements/new"
            className="flex items-center gap-2 px-5 py-3 bg-white text-teal-700 rounded-xl font-semibold hover:bg-teal-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Log Engagement
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search engagements..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
          >
            <option value="">All Types</option>
            {Object.entries(GA_ENGAGEMENT_TYPE_LABELS).map(([k, v]) => (
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

      {/* Engagements List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Handshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">
            {engagements.length === 0 ? 'No engagements logged yet' : 'No engagements match your filters'}
          </p>
          {engagements.length === 0 && (
            <Link
              to="/advocacy/engagements/new"
              className="mt-3 inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Log your first engagement
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filtered.map((eng) => {
              const badgeColor = TYPE_BADGE_COLORS[eng.type];
              const entity = getEntityDisplay(eng);
              const bCount = billCounts[eng.id] || 0;
              const aCount = attendeeCounts[eng.id] || 0;

              return (
                <Link
                  key={eng.id}
                  to={`/advocacy/engagements/${eng.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                          {TYPE_ICONS[eng.type]}
                          {GA_ENGAGEMENT_TYPE_LABELS[eng.type]}
                        </span>
                        {eng.jurisdiction && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {eng.jurisdiction}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900">{eng.subject}</p>
                      {entity && (
                        <p className="text-sm text-gray-500 mt-0.5">{entity}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <span className="text-sm text-gray-500">{eng.date}</span>
                      {eng.duration && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {eng.duration} min
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {bCount > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ScrollText className="w-3 h-3" />
                            {bCount}
                          </span>
                        )}
                        {aCount > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {aCount}
                          </span>
                        )}
                      </div>
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

export default EngagementsList;
