import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, Users, DollarSign, HandHeart, Gem, UserCheck,
  Trophy, TrendingUp, ArrowRight, Loader2, Plus, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilEvent, PhilEventStatus, PhilEventType } from '../../types';

const EVENT_TYPE_LABELS: Record<PhilEventType, string> = {
  golf_outing: 'Golf Outing',
  gala: 'Gala',
  '5k': '5K',
  auction: 'Auction',
  walkathon: 'Walkathon',
  other: 'Other',
};

const EVENT_TYPE_COLORS: Record<PhilEventType, string> = {
  golf_outing: 'bg-green-100 text-green-700',
  gala: 'bg-purple-100 text-purple-700',
  '5k': 'bg-blue-100 text-blue-700',
  auction: 'bg-amber-100 text-amber-700',
  walkathon: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
};

const EVENT_STATUS_LABELS: Record<PhilEventStatus, string> = {
  planning: 'Planning',
  open_registration: 'Open Registration',
  sold_out: 'Sold Out',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const EVENT_STATUS_COLORS: Record<PhilEventStatus, string> = {
  planning: 'bg-gray-100 text-gray-700',
  open_registration: 'bg-emerald-100 text-emerald-700',
  sold_out: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface KPIData {
  totalEvents: number;
  activeEvents: number;
  totalRegistrations: number;
  totalRevenue: number;
  sponsors: number;
  volunteerHours: number;
  inkindValue: number;
  cashDonations: number;
}

const PhilanthropyDashboard: React.FC = () => {
  const { hasModule } = useAuth();

  const [kpi, setKpi] = useState<KPIData>({
    totalEvents: 0,
    activeEvents: 0,
    totalRegistrations: 0,
    totalRevenue: 0,
    sponsors: 0,
    volunteerHours: 0,
    inkindValue: 0,
    cashDonations: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<PhilEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (!hasModule('philanthropy')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to PhilanthropyMax is required to view this page.</p>
      </div>
    );
  }

  const fetchDashboardData = async () => {
    setLoading(true);

    const [
      eventsCountRes,
      activeEventsRes,
      registrationsRes,
      cashDonationsRes,
      sponsorsPaidRes,
      sponsorsCountRes,
      volunteerHoursRes,
      inkindRes,
      upcomingRes,
    ] = await Promise.all([
      // 1. Total Events
      supabase.from('phil_events').select('id', { count: 'exact', head: true }),
      // 2. Active Events
      supabase
        .from('phil_events')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open_registration', 'in_progress']),
      // 3. Total Registrations
      supabase.from('phil_registrations').select('id', { count: 'exact', head: true }),
      // 4. Cash Donations sum
      supabase.from('phil_cash_donations').select('amount'),
      // 5. Sponsors paid sum
      supabase.from('phil_sponsors').select('payment_amount, payment_status'),
      // 6. Sponsors count
      supabase.from('phil_sponsors').select('id', { count: 'exact', head: true }),
      // 7. Volunteer Hours sum
      supabase.from('phil_volunteer_assignments').select('hours_logged'),
      // 8. In-Kind Value sum
      supabase.from('phil_inkind_donations').select('fair_market_value'),
      // Upcoming Events
      supabase
        .from('phil_events')
        .select('*')
        .not('status', 'in', '("completed","cancelled")')
        .order('start_date', { ascending: true })
        .limit(5),
    ]);

    // Calculate cash donations total
    const cashTotal = (cashDonationsRes.data || []).reduce(
      (sum: number, row: any) => sum + (row.amount || 0),
      0
    );

    // Calculate sponsors paid total
    const sponsorPaidTotal = (sponsorsPaidRes.data || [])
      .filter((s: any) => s.payment_status === 'paid')
      .reduce((sum: number, row: any) => sum + (row.payment_amount || 0), 0);

    // Calculate volunteer hours
    const volHours = (volunteerHoursRes.data || []).reduce(
      (sum: number, row: any) => sum + (row.hours_logged || 0),
      0
    );

    // Calculate in-kind value
    const inkindTotal = (inkindRes.data || []).reduce(
      (sum: number, row: any) => sum + (row.fair_market_value || 0),
      0
    );

    setKpi({
      totalEvents: eventsCountRes.count || 0,
      activeEvents: activeEventsRes.count || 0,
      totalRegistrations: registrationsRes.count || 0,
      totalRevenue: cashTotal + sponsorPaidTotal,
      sponsors: sponsorsCountRes.count || 0,
      volunteerHours: volHours,
      inkindValue: inkindTotal,
      cashDonations: cashTotal,
    });

    setUpcomingEvents((upcomingRes.data || []) as PhilEvent[]);
    setLoading(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-US').format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Events', value: formatNumber(kpi.totalEvents), icon: CalendarDays, color: 'text-rose-600' },
    { label: 'Active Events', value: formatNumber(kpi.activeEvents), icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Total Registrations', value: formatNumber(kpi.totalRegistrations), icon: Users, color: 'text-blue-600' },
    { label: 'Total Revenue', value: formatCurrency(kpi.totalRevenue), icon: DollarSign, color: 'text-green-600' },
    { label: 'Sponsors', value: formatNumber(kpi.sponsors), icon: Gem, color: 'text-purple-600' },
    { label: 'Volunteer Hours', value: formatNumber(kpi.volunteerHours), icon: UserCheck, color: 'text-teal-600' },
    { label: 'In-Kind Value', value: formatCurrency(kpi.inkindValue), icon: HandHeart, color: 'text-amber-600' },
    { label: 'Cash Donations', value: formatCurrency(kpi.cashDonations), icon: Trophy, color: 'text-rose-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-rose-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <h1 className="text-xl sm:text-3xl font-bold flex items-center">
          <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3" />
          PhilanthropyMax
        </h1>
        <p className="mt-2 text-rose-200 text-sm sm:text-base">Event Management & Fundraising</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-2xl font-bold text-gray-900">{card.value}</span>
            </div>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Events */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-rose-600" />
            Upcoming Events
          </h2>
          <Link
            to="/philanthropy/events"
            className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming events</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/philanthropy/events/${event.id}`}
                className="block px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-gray-900 text-sm truncate">
                      {event.name}
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${EVENT_TYPE_COLORS[event.event_type]}`}
                    >
                      {EVENT_TYPE_LABELS[event.event_type]}
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${EVENT_STATUS_COLORS[event.status]}`}
                    >
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                  </div>
                  {event.start_date && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0 ml-3">
                      <Clock className="w-3 h-3" />
                      {format(new Date(event.start_date), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                {event.venue_name && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{event.venue_name}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          to="/philanthropy/events/new"
          className="flex items-center gap-3 px-5 py-4 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Event
        </Link>
        <Link
          to="/philanthropy/sponsors"
          className="flex items-center gap-3 px-5 py-4 bg-white text-rose-700 border border-rose-200 rounded-xl font-medium hover:bg-rose-50 transition-colors"
        >
          <Gem className="w-5 h-5" />
          Manage Sponsors
        </Link>
        <Link
          to="/philanthropy/donations"
          className="flex items-center gap-3 px-5 py-4 bg-white text-rose-700 border border-rose-200 rounded-xl font-medium hover:bg-rose-50 transition-colors"
        >
          <DollarSign className="w-5 h-5" />
          View Donations
        </Link>
        <Link
          to="/philanthropy/volunteers"
          className="flex items-center gap-3 px-5 py-4 bg-white text-rose-700 border border-rose-200 rounded-xl font-medium hover:bg-rose-50 transition-colors"
        >
          <UserCheck className="w-5 h-5" />
          Volunteer Dashboard
        </Link>
      </div>
    </div>
  );
};

export default PhilanthropyDashboard;
