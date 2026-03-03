import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, ScrollText, Handshake, Star, Plus, Loader2,
  TrendingUp, Calendar, ArrowRight, AlertCircle, Clock, CheckCircle2, Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Bill, GAEngagement } from '../../types';
import {
  formatBillNumber,
  BILL_STATUS_LABELS,
  BILL_STATUS_COLORS,
  BILL_STATUS_ORDER,
  GA_ENGAGEMENT_TYPE_LABELS,
} from '../../lib/bill-format';

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

const AdvocacyDashboard: React.FC = () => {
  const { hasModule } = useAuth();

  const [bills, setBills] = useState<Bill[]>([]);
  const [engagements, setEngagements] = useState<GAEngagement[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
    const [billsRes, engagementsRes, usersRes] = await Promise.all([
      supabase.from('bills').select('*').order('updated_at', { ascending: false }),
      supabase.from('ga_engagements').select('*').order('date', { ascending: false }),
      supabase.from('users').select('id, full_name, email').eq('is_active', true),
    ]);
    setBills((billsRes.data || []) as Bill[]);
    setEngagements((engagementsRes.data || []) as GAEngagement[]);
    const map: Record<string, string> = {};
    (usersRes.data || []).forEach((u: any) => { map[u.id] = u.full_name || u.email; });
    setUserMap(map);
    setLoading(false);
  };

  // Stats
  const activeBills = bills.filter((b) => !['signed', 'vetoed', 'failed'].includes(b.status));
  const priorityBills = bills.filter((b) => b.is_priority);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const weekEngagements = engagements.filter((e) => new Date(e.date) >= startOfWeek);
  const monthEngagements = engagements.filter((e) => new Date(e.date) >= startOfMonth);

  const today = now.toISOString().split('T')[0];
  const pendingFollowUps = engagements
    .filter((e) => e.follow_up_required && !e.follow_up_completed)
    .sort((a, b) => (a.follow_up_date || '9999').localeCompare(b.follow_up_date || '9999'));

  // Status counts for pipeline
  const statusCounts: Record<string, number> = {};
  bills.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  });
  const totalBills = bills.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <h1 className="text-xl sm:text-3xl font-bold flex items-center">
          <Landmark className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
          ADVO-LINK
        </h1>
        <p className="mt-2 text-teal-200 text-sm sm:text-base">Government Affairs & Legislative Tracking</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/advocacy/bills" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <ScrollText className="w-5 h-5 text-teal-600" />
            <span className="text-2xl font-bold text-gray-900">{activeBills.length}</span>
          </div>
          <p className="text-sm text-gray-500">Active Bills</p>
        </Link>

        <Link to="/advocacy/bills" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Star className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-gray-900">{priorityBills.length}</span>
          </div>
          <p className="text-sm text-gray-500">Priority Bills</p>
        </Link>

        <Link to="/advocacy/engagements" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{weekEngagements.length}</span>
          </div>
          <p className="text-sm text-gray-500">This Week</p>
        </Link>

        <Link to="/advocacy/engagements" className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-2xl font-bold text-gray-900">{monthEngagements.length}</span>
          </div>
          <p className="text-sm text-gray-500">Month Total</p>
        </Link>
      </div>

      {/* Status Pipeline Bar */}
      {totalBills > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Bill Status Pipeline</h3>
          <div className="flex rounded-full overflow-hidden h-4 mb-3">
            {BILL_STATUS_ORDER.map((status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              const pct = (count / totalBills) * 100;
              return (
                <div
                  key={status}
                  className={`${STATUS_PIPELINE_COLORS[status]}`}
                  style={{ width: `${pct}%`, minWidth: '2px' }}
                  title={`${BILL_STATUS_LABELS[status]}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {BILL_STATUS_ORDER.map((status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              return (
                <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className={`w-2 h-2 rounded-full ${STATUS_PIPELINE_COLORS[status]}`} />
                  {BILL_STATUS_LABELS[status]} ({count})
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Priority Bills */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Priority Bills
            </h2>
            <Link to="/advocacy/bills" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {priorityBills.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No priority bills</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {priorityBills.slice(0, 5).map((bill) => {
                const sc = BILL_STATUS_COLORS[bill.status];
                return (
                  <Link
                    key={bill.id}
                    to={`/advocacy/bills/${bill.id}`}
                    className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">
                          {formatBillNumber(bill.bill_number)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          {BILL_STATUS_LABELS[bill.status]}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{bill.jurisdiction}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{bill.title}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Engagements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Handshake className="w-5 h-5 text-teal-600" />
              Recent Engagements
            </h2>
            <Link to="/advocacy/engagements" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {engagements.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Handshake className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No engagements logged</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {engagements.slice(0, 5).map((eng) => (
                <Link
                  key={eng.id}
                  to={`/advocacy/engagements/${eng.id}`}
                  className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{eng.subject}</span>
                    <span className="text-xs text-gray-400">{eng.date}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {GA_ENGAGEMENT_TYPE_LABELS[eng.type]}
                    {eng.legislator_name && ` — ${eng.legislator_name}`}
                    {eng.association_name && ` — ${eng.association_name}`}
                    {eng.entity_name && ` — ${eng.entity_name}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Follow-Ups */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Pending Follow-Ups
            {pendingFollowUps.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {pendingFollowUps.length}
              </span>
            )}
          </h2>
        </div>
        {pendingFollowUps.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">All follow-ups complete</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingFollowUps.slice(0, 10).map((eng) => {
              const isOverdue = eng.follow_up_date && eng.follow_up_date < today;
              const isDueToday = eng.follow_up_date === today;
              return (
                <Link
                  key={eng.id}
                  to={`/advocacy/engagements/${eng.id}`}
                  className="block px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-gray-900 text-sm truncate">{eng.subject}</span>
                      {isOverdue && (
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          Overdue
                        </span>
                      )}
                      {isDueToday && (
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          Due Today
                        </span>
                      )}
                      {!isOverdue && !isDueToday && eng.follow_up_date && (
                        <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          Upcoming
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {eng.follow_up_assigned_to && userMap[eng.follow_up_assigned_to] && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {userMap[eng.follow_up_assigned_to]}
                        </span>
                      )}
                      {eng.follow_up_date && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {eng.follow_up_date}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    {GA_ENGAGEMENT_TYPE_LABELS[eng.type]}
                    {eng.legislator_name && ` — ${eng.legislator_name}`}
                    {eng.association_name && ` — ${eng.association_name}`}
                    {eng.entity_name && ` — ${eng.entity_name}`}
                  </p>
                  {eng.follow_up_notes && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{eng.follow_up_notes}</p>
                  )}
                </Link>
              );
            })}
            {pendingFollowUps.length > 10 && (
              <div className="px-5 py-3 text-center text-sm text-gray-500">
                +{pendingFollowUps.length - 10} more pending follow-ups
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/advocacy/bills/new"
          className="flex items-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Bill
        </Link>
        <Link
          to="/advocacy/engagements/new"
          className="flex items-center gap-2 px-5 py-3 bg-white text-teal-700 border border-teal-200 rounded-xl font-medium hover:bg-teal-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Engagement
        </Link>
      </div>
    </div>
  );
};

export default AdvocacyDashboard;
