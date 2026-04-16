import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SponsorManagerTab from './SponsorManagerTab';
import RegistrationManagerTab from './RegistrationManagerTab';
import TeamBuilderTab from './TeamBuilderTab';
import DonationsTab from './DonationsTab';
import VolunteerTab from './VolunteerTab';
import ContestsTab from './ContestsTab';
import EventReports from './EventReports';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  BarChart3,
  Gem,
  ClipboardList,
  FileText,
  UsersRound,
  HandHeart,
  UserCheck,
  Trophy,
  Calendar,
  MapPin,
  DollarSign,
  Target,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import type { PhilEvent, PhilEventType, PhilEventStatus } from '../../types';

// ─── Constants ─────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'sponsors', label: 'Sponsors', icon: Gem },
  { key: 'registrations', label: 'Registrations', icon: ClipboardList },
  { key: 'teams', label: 'Teams', icon: UsersRound },
  { key: 'donations', label: 'Donations', icon: HandHeart },
  { key: 'volunteers', label: 'Volunteers', icon: UserCheck },
  { key: 'contests', label: 'Contests', icon: Trophy },
  { key: 'reports', label: 'Reports', icon: FileText },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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
  '5k': 'bg-orange-100 text-orange-700',
  auction: 'bg-blue-100 text-blue-700',
  walkathon: 'bg-yellow-100 text-yellow-700',
  other: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<PhilEventStatus, string> = {
  planning: 'Planning',
  open_registration: 'Open Registration',
  sold_out: 'Sold Out',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<PhilEventStatus, string> = {
  planning: 'bg-gray-100 text-gray-700',
  open_registration: 'bg-emerald-100 text-emerald-700',
  sold_out: 'bg-red-100 text-red-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

// ─── Helpers ───────────────────────────────────────────────

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildVenueString(event: PhilEvent): string | null {
  const parts: string[] = [];
  if (event.venue_address) parts.push(event.venue_address);
  const cityState = [event.venue_city, event.venue_state].filter(Boolean).join(', ');
  if (cityState) parts.push(cityState);
  if (event.venue_zip) parts.push(event.venue_zip);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ─── Overview Tab ──────────────────────────────────────────

function OverviewTab({ event }: { event: PhilEvent }) {
  const venueString = buildVenueString(event);

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Registrations', value: 0, icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
          { label: 'Sponsors', value: 0, icon: Gem, color: 'text-purple-600 bg-purple-50' },
          { label: 'Donations', value: 0, icon: HandHeart, color: 'text-rose-600 bg-rose-50' },
          { label: 'Volunteers', value: 0, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Details Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h3>
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Date</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {event.start_date
                    ? format(new Date(event.start_date + 'T00:00:00'), 'MMMM d, yyyy')
                    : 'TBD'}
                  {event.end_date && event.end_date !== event.start_date && (
                    <> &ndash; {format(new Date(event.end_date + 'T00:00:00'), 'MMMM d, yyyy')}</>
                  )}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Venue</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {event.venue_name || 'TBD'}
                </dd>
                {venueString && (
                  <dd className="text-sm text-gray-500">{venueString}</dd>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-gray-400 mt-0.5 shrink-0">
                <span className="text-xs font-bold">ST</span>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[event.status]}`}>
                    {STATUS_LABELS[event.status]}
                  </span>
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Capacity</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {event.capacity != null ? event.capacity.toLocaleString() : 'Unlimited'}
                </dd>
              </div>
            </div>

            {event.description && (
              <div className="pt-2 border-t border-gray-100">
                <dt className="text-sm text-gray-500 mb-1">Description</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h3>
          <dl className="space-y-4">
            <div className="flex items-start gap-3">
              <DollarSign className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Budget</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatCurrency(event.budget_amount)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Fundraising Goal</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatCurrency(event.goal_amount)}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Gem className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Sponsor Revenue</dt>
                <dd className="text-sm font-medium text-gray-900">$0</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <HandHeart className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Donation Revenue</dt>
                <dd className="text-sm font-medium text-gray-900">$0</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <dt className="text-sm text-gray-500">Registration Revenue</dt>
                <dd className="text-sm font-medium text-gray-900">$0</dd>
              </div>
            </div>

            {event.goal_amount && event.goal_amount > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-500">Progress to Goal</span>
                  <span className="font-medium text-gray-900">0%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-rose-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: '0%' }}
                  />
                </div>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<PhilEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;

    async function fetchEvent() {
      setLoading(true);
      const { data, error } = await supabase
        .from('phil_events')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setEvent(data as PhilEvent);
      }
      setLoading(false);
    }

    fetchEvent();
  }, [id]);

  // ── Loading state ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-rose-600 animate-spin" />
      </div>
    );
  }

  // ── 404 state ──

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
        <p className="text-gray-500 mb-6">The event you are looking for does not exist or has been removed.</p>
        <Link
          to="/philanthropy/events"
          className="inline-flex items-center gap-2 text-rose-600 hover:text-rose-700 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
      </div>
    );
  }

  // ── Render active tab content ──

  function renderTabContent() {
    const eid = event!.id;
    switch (activeTab) {
      case 'overview':
        return <OverviewTab event={event!} />;
      case 'sponsors':
        return <SponsorManagerTab eventId={eid} />;
      case 'registrations':
        return <RegistrationManagerTab eventId={eid} />;
      case 'teams':
        return <TeamBuilderTab eventId={eid} />;
      case 'donations':
        return <DonationsTab eventId={eid} />;
      case 'volunteers':
        return <VolunteerTab eventId={eid} />;
      case 'contests':
        return <ContestsTab eventId={eid} />;
      case 'reports':
        return <EventReports eventId={eid} eventName={event!.name} eventDate={event!.start_date} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-rose-700 rounded-xl p-4 sm:p-8 text-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/philanthropy/events"
            className="inline-flex items-center gap-1 text-rose-200 hover:text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Link>
          <Link
            to={`/philanthropy/events/${id}/edit`}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-3">{event.name}</h1>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${EVENT_TYPE_COLORS[event.event_type]}`}>
            {EVENT_TYPE_LABELS[event.event_type]}
          </span>
          <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[event.status]}`}>
            {STATUS_LABELS[event.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-rose-100">
          {event.start_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {format(new Date(event.start_date + 'T00:00:00'), 'MMM d, yyyy')}
              {event.end_date && event.end_date !== event.start_date && (
                <> &ndash; {format(new Date(event.end_date + 'T00:00:00'), 'MMM d, yyyy')}</>
              )}
            </span>
          )}
          {event.venue_name && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {event.venue_name}
            </span>
          )}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 border-b border-gray-200 min-w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {renderTabContent()}
    </div>
  );
}
