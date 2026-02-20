import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays, startOfDay, endOfDay, differenceInDays, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  Users,
  Phone,
  AlertCircle,
  CheckCircle2,
  ArrowUpDown,
  TrendingUp,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../types';

interface UserStats {
  userId: string;
  name: string;
  role: string;
  lastLogin: string | null;
  daysSinceLogin: number | null;
  contactsCreated: number;
  touchpoints: number;
  openFollowUps: number;
  closedFollowUps: number;
}

type SortKey = keyof UserStats;
type SortDir = 'asc' | 'desc';
type Period = 'day' | 'week' | 'month';
type DrillDownType = 'contacts' | 'touchpoints' | 'openFollowUps' | 'closedFollowUps' | null;

interface DrillDownRecord {
  id: string;
  label: string;
  sublabel?: string;
  date: string;
  user: string;
}

const TeamActivity: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [period, setPeriod] = useState<Period>('week');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [trendData, setTrendData] = useState<{ label: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [drillDown, setDrillDown] = useState<DrillDownType>(null);
  const [drillDownRecords, setDrillDownRecords] = useState<DrillDownRecord[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) fetchData();
    setDrillDown(null);
  }, [isAdmin, dateFrom, dateTo]);

  useEffect(() => {
    if (users.length > 0) buildTrend();
  }, [dateFrom, dateTo, period, users]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const from = startOfDay(new Date(dateFrom)).toISOString();
      const to = endOfDay(new Date(dateTo)).toISOString();

      const [usersRes, contactsRes, touchpointsRes, openFollowUpsRes, closedFollowUpsRes] = await Promise.all([
        supabase.from('users').select('*').eq('is_active', true).order('full_name'),
        supabase.from('contacts').select('id, created_by').gte('created_at', from).lte('created_at', to),
        supabase.from('touchpoints').select('id, created_by, date').gte('date', from).lte('date', to),
        supabase.from('touchpoints').select('id, created_by').eq('follow_up_required', true).eq('follow_up_completed', false),
        supabase.from('touchpoints').select('id, created_by').eq('follow_up_required', true).eq('follow_up_completed', true).gte('date', from).lte('date', to),
      ]);

      const allUsers = (usersRes.data || []) as UserProfile[];
      setUsers(allUsers);

      const contacts = contactsRes.data || [];
      const touchpoints = touchpointsRes.data || [];
      const openFU = openFollowUpsRes.data || [];
      const closedFU = closedFollowUpsRes.data || [];

      // Count by user
      const contactsByUser = new Map<string, number>();
      contacts.forEach((c: any) => contactsByUser.set(c.created_by, (contactsByUser.get(c.created_by) || 0) + 1));

      const touchpointsByUser = new Map<string, number>();
      touchpoints.forEach((t: any) => touchpointsByUser.set(t.created_by, (touchpointsByUser.get(t.created_by) || 0) + 1));

      const openByUser = new Map<string, number>();
      openFU.forEach((t: any) => openByUser.set(t.created_by, (openByUser.get(t.created_by) || 0) + 1));

      const closedByUser = new Map<string, number>();
      closedFU.forEach((t: any) => closedByUser.set(t.created_by, (closedByUser.get(t.created_by) || 0) + 1));

      const now = new Date();
      const stats: UserStats[] = allUsers.map(u => {
        const daysSince = u.last_login ? differenceInDays(now, new Date(u.last_login)) : null;
        return {
          userId: u.id,
          name: u.full_name || u.email,
          role: u.role,
          lastLogin: u.last_login,
          daysSinceLogin: daysSince,
          contactsCreated: contactsByUser.get(u.id) || 0,
          touchpoints: touchpointsByUser.get(u.id) || 0,
          openFollowUps: openByUser.get(u.id) || 0,
          closedFollowUps: closedByUser.get(u.id) || 0,
        };
      });

      setUserStats(stats);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  };

  const buildTrend = async () => {
    try {
      const from = startOfDay(new Date(dateFrom));
      const to = endOfDay(new Date(dateTo));

      const { data } = await supabase
        .from('touchpoints')
        .select('date')
        .gte('date', from.toISOString())
        .lte('date', to.toISOString());

      const touchpoints = data || [];

      let intervals: Date[];
      let labelFn: (d: Date) => string;
      let bucketFn: (d: Date) => string;

      if (period === 'day') {
        intervals = eachDayOfInterval({ start: from, end: to });
        labelFn = (d) => format(d, 'MMM d');
        bucketFn = (d) => format(d, 'yyyy-MM-dd');
      } else if (period === 'week') {
        intervals = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
        labelFn = (d) => `Week of ${format(d, 'MMM d')}`;
        bucketFn = (d) => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else {
        intervals = eachMonthOfInterval({ start: from, end: to });
        labelFn = (d) => format(d, 'MMM yyyy');
        bucketFn = (d) => format(startOfMonth(d), 'yyyy-MM');
      }

      // Count touchpoints per bucket
      const counts = new Map<string, number>();
      intervals.forEach(d => counts.set(period === 'month' ? format(d, 'yyyy-MM') : format(d, 'yyyy-MM-dd'), 0));

      touchpoints.forEach((tp: any) => {
        const key = bucketFn(new Date(tp.date));
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      const trend = intervals.map(d => ({
        label: labelFn(d),
        count: counts.get(period === 'month' ? format(d, 'yyyy-MM') : format(d, 'yyyy-MM-dd')) || 0,
      }));

      setTrendData(trend);
    } catch {
      setTrendData([]);
    }
  };

  const sortedStats = useMemo(() => {
    return [...userStats].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (av == null) av = sortDir === 'asc' ? Infinity : -Infinity;
      if (bv == null) bv = sortDir === 'asc' ? Infinity : -Infinity;
      if (typeof av === 'string') {
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [userStats, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDrillDown = async (type: DrillDownType) => {
    if (drillDown === type) {
      setDrillDown(null);
      return;
    }
    setDrillDown(type);
    setDrillDownLoading(true);

    try {
      const from = startOfDay(new Date(dateFrom)).toISOString();
      const to = endOfDay(new Date(dateTo)).toISOString();

      // Build a user name map
      const userMap = new Map(users.map(u => [u.id, u.full_name || u.email]));

      let records: DrillDownRecord[] = [];

      if (type === 'contacts') {
        const { data } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, title, created_by, created_at')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false });

        records = (data || []).map((c: any) => ({
          id: c.id,
          label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed',
          sublabel: c.title || undefined,
          date: c.created_at,
          user: userMap.get(c.created_by) || 'Unknown',
        }));
      } else if (type === 'touchpoints') {
        const { data } = await supabase
          .from('touchpoints')
          .select('id, type, summary, contact_id, created_by, date, contacts(first_name, last_name)')
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: false });

        records = (data || []).map((t: any) => ({
          id: t.id,
          label: t.contacts ? `${t.contacts.first_name || ''} ${t.contacts.last_name || ''}`.trim() : 'No contact',
          sublabel: `${t.type}${t.summary ? ' — ' + t.summary.substring(0, 60) : ''}`,
          date: t.date,
          user: userMap.get(t.created_by) || 'Unknown',
        }));
      } else if (type === 'openFollowUps') {
        const { data } = await supabase
          .from('touchpoints')
          .select('id, type, summary, follow_up_date, contact_id, created_by, date, contacts(first_name, last_name)')
          .eq('follow_up_required', true)
          .eq('follow_up_completed', false)
          .order('follow_up_date', { ascending: true });

        records = (data || []).map((t: any) => ({
          id: t.id,
          label: t.contacts ? `${t.contacts.first_name || ''} ${t.contacts.last_name || ''}`.trim() : 'No contact',
          sublabel: `${t.type}${t.summary ? ' — ' + t.summary.substring(0, 60) : ''}`,
          date: t.follow_up_date || t.date,
          user: userMap.get(t.created_by) || 'Unknown',
        }));
      } else if (type === 'closedFollowUps') {
        const { data } = await supabase
          .from('touchpoints')
          .select('id, type, summary, contact_id, created_by, date, contacts(first_name, last_name)')
          .eq('follow_up_required', true)
          .eq('follow_up_completed', true)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: false });

        records = (data || []).map((t: any) => ({
          id: t.id,
          label: t.contacts ? `${t.contacts.first_name || ''} ${t.contacts.last_name || ''}`.trim() : 'No contact',
          sublabel: `${t.type}${t.summary ? ' — ' + t.summary.substring(0, 60) : ''}`,
          date: t.date,
          user: userMap.get(t.created_by) || 'Unknown',
        }));
      }

      setDrillDownRecords(records);
    } catch {
      setDrillDownRecords([]);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const drillDownTitle: Record<string, string> = {
    contacts: 'Contacts Created',
    touchpoints: 'Touchpoints',
    openFollowUps: 'Open Follow-ups',
    closedFollowUps: 'Closed Follow-ups',
  };

  const handleDrillDownClick = (record: DrillDownRecord) => {
    if (drillDown === 'contacts') {
      navigate(`/contacts/${record.id}`);
    } else {
      navigate(`/touchpoints/${record.id}`);
    }
  };

  const maxTrend = Math.max(...trendData.map(d => d.count), 1);

  const totals = useMemo(() => ({
    contacts: userStats.reduce((s, u) => s + u.contactsCreated, 0),
    touchpoints: userStats.reduce((s, u) => s + u.touchpoints, 0),
    openFollowUps: userStats.reduce((s, u) => s + u.openFollowUps, 0),
    closedFollowUps: userStats.reduce((s, u) => s + u.closedFollowUps, 0),
  }), [userStats]);

  const daysSinceColor = (days: number | null) => {
    if (days === null) return 'text-gray-400';
    if (days <= 2) return 'text-green-600 bg-green-50';
    if (days <= 7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Team Activity</h1>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { type: 'contacts' as DrillDownType, icon: Users, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', activeBorder: 'border-blue-400 ring-2 ring-blue-100', count: totals.contacts, label: 'Contacts Created' },
          { type: 'touchpoints' as DrillDownType, icon: Phone, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', activeBorder: 'border-purple-400 ring-2 ring-purple-100', count: totals.touchpoints, label: 'Touchpoints' },
          { type: 'openFollowUps' as DrillDownType, icon: AlertCircle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', activeBorder: 'border-amber-400 ring-2 ring-amber-100', count: totals.openFollowUps, label: 'Open Follow-ups' },
          { type: 'closedFollowUps' as DrillDownType, icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-600', activeBorder: 'border-green-400 ring-2 ring-green-100', count: totals.closedFollowUps, label: 'Closed Follow-ups' },
        ]).map(card => (
          <button
            key={card.type}
            onClick={() => handleDrillDown(card.type)}
            className={`bg-white rounded-xl shadow-sm border-2 p-5 text-left transition-all hover:shadow-md cursor-pointer ${
              drillDown === card.type ? card.activeBorder : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-gray-900">{card.count}</p>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${drillDown === card.type ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-500 mt-3">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Drill-down panel */}
      {drillDown && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{drillDownTitle[drillDown]} — Detail</h3>
            <span className="text-xs text-gray-500">{drillDownRecords.length} records</span>
          </div>
          {drillDownLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : drillDownRecords.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No records found.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {drillDownRecords.map(r => (
                <div
                  key={r.id}
                  onClick={() => handleDrillDownClick(r)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                    {r.sublabel && <p className="text-xs text-gray-500 truncate">{r.sublabel}</p>}
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-500">{r.user}</span>
                    <span className="text-xs text-gray-400">{format(new Date(r.date), 'MMM d')}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User stats table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Per-User Breakdown</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {[
                    { key: 'name' as SortKey, label: 'Name' },
                    { key: 'role' as SortKey, label: 'Role' },
                    { key: 'daysSinceLogin' as SortKey, label: 'Last Login' },
                    { key: 'contactsCreated' as SortKey, label: 'Contacts' },
                    { key: 'touchpoints' as SortKey, label: 'Touchpoints' },
                    { key: 'openFollowUps' as SortKey, label: 'Open F/U' },
                    { key: 'closedFollowUps' as SortKey, label: 'Closed F/U' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className={`w-3.5 h-3.5 ${sortKey === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedStats.map(u => (
                  <tr key={u.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-blue-100 text-blue-700'
                        : u.role === 'manager' ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.lastLogin ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">{format(new Date(u.lastLogin), 'MMM d, yyyy')}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${daysSinceColor(u.daysSinceLogin)}`}>
                            {u.daysSinceLogin === 0 ? 'Today' : `${u.daysSinceLogin}d ago`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{u.contactsCreated}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{u.touchpoints}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${u.openFollowUps > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {u.openFollowUps}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${u.closedFollowUps > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {u.closedFollowUps}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity trend chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Touchpoints Over Time</h2>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['day', 'week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {trendData.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No data for this period.</p>
          ) : (
            <div className="space-y-2">
              {trendData.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 sm:w-36 text-right flex-shrink-0 truncate">{d.label}</span>
                  <div className="flex-1 h-7 bg-gray-50 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-blue-500 rounded-lg transition-all duration-300"
                      style={{ width: `${Math.max((d.count / maxTrend) * 100, d.count > 0 ? 2 : 0)}%` }}
                    />
                    {d.count > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-600">
                        {d.count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamActivity;
