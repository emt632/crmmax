import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Plus, Search, Loader2, MapPin, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilEvent, PhilEventType, PhilEventStatus } from '../../types';

/* ── Type labels ── */
const EVENT_TYPE_LABELS: Record<PhilEventType, string> = {
  golf_outing: 'Golf Outing',
  gala: 'Gala',
  '5k': '5K Run/Walk',
  auction: 'Auction',
  walkathon: 'Walk-a-thon',
  other: 'Other',
};

/* ── Status badge colors ── */
const STATUS_BADGE: Record<PhilEventStatus, { bg: string; text: string }> = {
  planning:          { bg: 'bg-gray-100', text: 'text-gray-700' },
  open_registration: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sold_out:          { bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress:       { bg: 'bg-green-100', text: 'text-green-700' },
  completed:         { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled:         { bg: 'bg-red-100', text: 'text-red-700' },
};

const STATUS_LABELS: Record<PhilEventStatus, string> = {
  planning: 'Planning',
  open_registration: 'Open Registration',
  sold_out: 'Sold Out',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/* ── Type badge colors ── */
const TYPE_BADGE: Record<PhilEventType, string> = {
  golf_outing: 'bg-green-100 text-green-700',
  gala: 'bg-purple-100 text-purple-700',
  '5k': 'bg-orange-100 text-orange-700',
  auction: 'bg-indigo-100 text-indigo-700',
  walkathon: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
};

const formatCurrency = (amount: number | null): string => {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

const formatDateRange = (start: string | null, end: string | null): string => {
  if (!start) return 'Date TBD';
  const startFormatted = format(new Date(start), 'MMM d, yyyy');
  if (!end || end === start) return startFormatted;
  // Same month+year? Show compact range
  const s = new Date(start);
  const e = new Date(end);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, 'MMM d')} - ${format(e, 'd, yyyy')}`;
  }
  return `${startFormatted} - ${format(e, 'MMM d, yyyy')}`;
};

const EventsList: React.FC = () => {
  const { hasModule } = useAuth();

  const [events, setEvents] = useState<PhilEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  if (!hasModule('philanthropy')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to PhilanthropyMax is required to view this page.</p>
      </div>
    );
  }

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('phil_events')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
    }
    setEvents((data || []) as PhilEvent[]);
    setLoading(false);
  };

  /* ── Filtering ── */
  const filtered = events.filter((ev) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = ev.name.toLowerCase().includes(q);
      const matchVenue = ev.venue_name?.toLowerCase().includes(q);
      if (!matchName && !matchVenue) return false;
    }
    if (filterType && ev.event_type !== filterType) return false;
    if (filterStatus && ev.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-rose-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-rose-200" />
            <div>
              <h1 className="text-2xl font-bold">Events</h1>
              <p className="text-rose-200 text-sm">Manage fundraising events and galas</p>
            </div>
          </div>
          <Link
            to="/philanthropy/events/new"
            className="inline-flex items-center gap-2 bg-white text-rose-700 px-4 py-2 rounded-lg font-semibold hover:bg-rose-50 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Event
          </Link>
        </div>
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
        >
          <option value="">All Types</option>
          {(Object.keys(EVENT_TYPE_LABELS) as PhilEventType[]).map((t) => (
            <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
        >
          <option value="">All Statuses</option>
          {(Object.keys(STATUS_LABELS) as PhilEventStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-1">No events found</h3>
          <p className="text-gray-400 text-sm mb-4">
            {events.length === 0
              ? 'Get started by creating your first fundraising event.'
              : 'Try adjusting your search or filters.'}
          </p>
          {events.length === 0 && (
            <Link
              to="/philanthropy/events/new"
              className="inline-flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-rose-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          )}
        </div>
      )}

      {/* ── Event cards ── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ev) => {
            const statusStyle = STATUS_BADGE[ev.status] || STATUS_BADGE.planning;
            const typeStyle = TYPE_BADGE[ev.event_type] || TYPE_BADGE.other;
            return (
              <Link
                key={ev.id}
                to={`/philanthropy/events/${ev.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-rose-200 transition-all"
              >
                <div className="p-5 space-y-3">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle}`}>
                      {EVENT_TYPE_LABELS[ev.event_type] || ev.event_type}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                      {STATUS_LABELS[ev.status] || ev.status}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{ev.name}</h3>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>{formatDateRange(ev.start_date, ev.end_date)}</span>
                  </div>

                  {/* Venue */}
                  {ev.venue_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">
                        {ev.venue_name}
                        {ev.venue_city && ev.venue_state ? `, ${ev.venue_city}, ${ev.venue_state}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Budget / Goal */}
                  {(ev.budget_amount != null || ev.goal_amount != null) && (
                    <div className="flex items-center gap-4 text-sm pt-1 border-t border-gray-100">
                      {ev.budget_amount != null && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <DollarSign className="w-4 h-4 shrink-0" />
                          <span>Budget: <span className="font-medium text-gray-700">{formatCurrency(ev.budget_amount)}</span></span>
                        </div>
                      )}
                      {ev.goal_amount != null && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <DollarSign className="w-4 h-4 shrink-0" />
                          <span>Goal: <span className="font-medium text-gray-700">{formatCurrency(ev.goal_amount)}</span></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsList;
