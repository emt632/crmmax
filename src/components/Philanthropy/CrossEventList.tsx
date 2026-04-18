import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilEvent } from '../../types';

interface CrossEventListProps {
  title: string;
  icon: LucideIcon;
  table: string;
  columns: { key: string; label: string; render?: (row: any, events: Record<string, PhilEvent>) => React.ReactNode }[];
  newPath?: string;
  newLabel?: string;
}

const CrossEventList: React.FC<CrossEventListProps> = ({ title, icon: Icon, table, columns, newPath, newLabel }) => {
  const { hasModule } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [events, setEvents] = useState<Record<string, PhilEvent>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEventId, setFilterEventId] = useState('');
  const [eventList, setEventList] = useState<PhilEvent[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rowsRes, eventsRes] = await Promise.all([
      supabase.from(table).select('*').order('created_at', { ascending: false }),
      supabase.from('phil_events').select('*').order('start_date', { ascending: false }),
    ]);
    setRows(rowsRes.data || []);
    const evList = (eventsRes.data || []) as PhilEvent[];
    setEventList(evList);
    const evMap: Record<string, PhilEvent> = {};
    for (const e of evList) evMap[e.id] = e;
    setEvents(evMap);
    setLoading(false);
  };

  if (!hasModule('philanthropy')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to PhilanthropyMax is required.</p>
      </div>
    );
  }

  const filtered = rows.filter((r) => {
    if (filterEventId && r.event_id !== filterEventId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return JSON.stringify(r).toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-rose-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold flex items-center">
              <Icon className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
              {title}
            </h1>
            <p className="mt-2 text-rose-200 text-sm sm:text-base">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {newPath && (
            <Link
              to={newPath}
              className="flex items-center gap-2 px-5 py-3 bg-white text-rose-700 rounded-xl font-semibold hover:bg-rose-50 transition-colors"
            >
              <span className="hidden sm:inline">{newLabel || 'Add New'}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all"
          />
        </div>
        <select
          value={filterEventId}
          onChange={(e) => setFilterEventId(e.target.value)}
          className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-100 focus:border-rose-500"
        >
          <option value="">All Events</option>
          {eventList.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">
            {rows.length === 0 ? `No ${title.toLowerCase()} yet` : 'No records match your filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Event</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/philanthropy/events/${row.event_id}`} className="text-sm text-rose-600 hover:text-rose-700 font-medium">
                        {events[row.event_id]?.name || 'Unknown Event'}
                      </Link>
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                        {col.render ? col.render(row, events) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossEventList;
