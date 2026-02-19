import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import {
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  Video,
  Users as UsersIcon,
  MessageSquare,
  ChevronRight,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import type { Touchpoint, TouchpointType } from '../../types';
import { supabase } from '../../lib/supabase';

const TOUCHPOINT_TYPE_CONFIG: Record<TouchpointType, { icon: React.FC<any>; color: string; label: string }> = {
  'phone': { icon: Phone, color: 'bg-blue-100 text-blue-700', label: 'Phone Call' },
  'email': { icon: Mail, color: 'bg-green-100 text-green-700', label: 'Email' },
  'in-person': { icon: UsersIcon, color: 'bg-purple-100 text-purple-700', label: 'In Person' },
  'virtual': { icon: Video, color: 'bg-indigo-100 text-indigo-700', label: 'Virtual' },
  'other': { icon: MessageSquare, color: 'bg-gray-100 text-gray-700', label: 'Other' },
};

const TouchpointsList: React.FC = () => {
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [filteredTouchpoints, setFilteredTouchpoints] = useState<Touchpoint[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [followUpFilter, setFollowUpFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTouchpoints();
  }, []);

  useEffect(() => {
    filterTouchpoints();
  }, [searchTerm, touchpoints, typeFilter, followUpFilter]);

  const fetchTouchpoints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('touchpoints')
        .select(`
          *,
          contacts:contact_id(first_name, last_name),
          organizations:organization_id(name)
        `)
        .order('date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((tp: any) => ({
        ...tp,
        contact_name: tp.contacts ? `${tp.contacts.first_name} ${tp.contacts.last_name}` : undefined,
        organization_name: tp.organizations?.name || undefined,
      }));
      setTouchpoints(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch touchpoints');
      setTouchpoints(getSampleTouchpoints());
    } finally {
      setLoading(false);
    }
  };

  const filterTouchpoints = () => {
    let filtered = touchpoints;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tp =>
        tp.subject.toLowerCase().includes(term) ||
        tp.notes?.toLowerCase().includes(term) ||
        tp.contact_name?.toLowerCase().includes(term) ||
        tp.organization_name?.toLowerCase().includes(term)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(tp => tp.type === typeFilter);
    }

    if (followUpFilter === 'pending') {
      filtered = filtered.filter(tp => tp.follow_up_required && !tp.follow_up_completed);
    } else if (followUpFilter === 'completed') {
      filtered = filtered.filter(tp => tp.follow_up_required && tp.follow_up_completed);
    }

    setFilteredTouchpoints(filtered);
  };

  const getSampleTouchpoints = (): Touchpoint[] => [
    {
      id: 'tp-1',
      contact_id: '1',
      type: 'phone',
      date: new Date().toISOString(),
      duration: 30,
      subject: 'Discussed partnership renewal',
      notes: 'Sarah mentioned they want to extend the partnership for another year.',
      follow_up_required: true,
      follow_up_date: format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'),
      follow_up_notes: 'Send renewal proposal',
      follow_up_completed: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contact_name: 'Sarah Mitchell',
      organization_name: 'Mayo Clinic'
    },
    {
      id: 'tp-2',
      contact_id: '2',
      type: 'email',
      date: new Date(Date.now() - 86400000).toISOString(),
      subject: 'Flight operations coordination',
      notes: 'Coordinated upcoming flight schedule changes.',
      follow_up_required: false,
      follow_up_completed: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contact_name: 'John Anderson',
      organization_name: 'Sanford Health'
    },
    {
      id: 'tp-3',
      contact_id: '3',
      organization_id: 'org-1',
      type: 'in-person',
      date: new Date(Date.now() - 2 * 86400000).toISOString(),
      duration: 60,
      subject: 'Quarterly review meeting',
      notes: 'Reviewed Q4 metrics and upcoming initiatives.',
      follow_up_required: true,
      follow_up_date: format(new Date(Date.now() + 3 * 86400000), 'yyyy-MM-dd'),
      follow_up_notes: 'Share meeting minutes',
      follow_up_completed: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contact_name: 'Emily Johnson',
      organization_name: 'Mayo Clinic'
    },
    {
      id: 'tp-4',
      contact_id: '4',
      type: 'virtual',
      date: new Date(Date.now() - 5 * 86400000).toISOString(),
      duration: 45,
      subject: 'Equipment demo video call',
      notes: 'Demonstrated new monitoring equipment capabilities.',
      follow_up_required: false,
      follow_up_completed: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contact_name: 'Michael Brown',
      organization_name: 'Essentia Health'
    }
  ];

  const thisWeekCount = touchpoints.filter(tp => {
    try {
      const tpDate = new Date(tp.date);
      const now = new Date();
      return isWithinInterval(tpDate, {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 })
      });
    } catch {
      return false;
    }
  }).length;

  const pendingFollowUps = touchpoints.filter(tp => tp.follow_up_required && !tp.follow_up_completed).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600"></div>
          <Phone className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-purple-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading touchpoints...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Phone className="w-8 h-8 mr-3" />
              Touchpoints
            </h1>
            <p className="mt-2 text-purple-100">
              Track your interactions with contacts and organizations
            </p>
            <div className="mt-4 flex items-center space-x-6">
              <div>
                <p className="text-sm text-purple-200">Total</p>
                <p className="text-2xl font-bold">{touchpoints.length}</p>
              </div>
              <div>
                <p className="text-sm text-purple-200">This Week</p>
                <p className="text-2xl font-bold">{thisWeekCount}</p>
              </div>
              <div>
                <p className="text-sm text-purple-200">Pending Follow-ups</p>
                <p className="text-2xl font-bold">{pendingFollowUps}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 lg:mt-0">
            <Link
              to="/touchpoints/new"
              className="inline-flex items-center px-5 py-2.5 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Touchpoint
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by subject, notes, contact..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="in-person">In Person</option>
                <option value="virtual">Virtual</option>
                <option value="other">Other</option>
              </select>

              <select
                value={followUpFilter}
                onChange={(e) => setFollowUpFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">All Follow-ups</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-4 py-3 border rounded-xl text-sm font-medium transition-all ${
                  showFilters
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(TOUCHPOINT_TYPE_CONFIG) as [TouchpointType, typeof TOUCHPOINT_TYPE_CONFIG[TouchpointType]][]).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        typeFilter === type ? config.color + ' border border-current' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Icon className="w-3 h-3 mr-1.5" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">Running in mock mode - no Supabase connection</p>
              <p className="text-xs text-yellow-700 mt-1">Displaying sample data for demonstration purposes</p>
            </div>
          </div>
        </div>
      )}

      {/* Touchpoints List */}
      {filteredTouchpoints.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center">
              <Phone className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No touchpoints found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm || typeFilter !== 'all' || followUpFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by logging your first touchpoint'}
            </p>
            <div className="mt-6">
              <Link
                to="/touchpoints/new"
                className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Touchpoint
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredTouchpoints.map((tp) => {
              const typeConfig = TOUCHPOINT_TYPE_CONFIG[tp.type];
              const TypeIcon = typeConfig.icon;
              const isPendingFollowUp = tp.follow_up_required && !tp.follow_up_completed;

              return (
                <Link
                  key={tp.id}
                  to={`/touchpoints/${tp.id}`}
                  className={`block transition-all group ${
                    isPendingFollowUp
                      ? 'hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 bg-amber-50/30'
                      : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50'
                  }`}
                >
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${typeConfig.color}`}>
                          <TypeIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-base font-semibold text-gray-900 truncate">
                              {tp.subject}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                              {typeConfig.label}
                            </span>
                            {isPendingFollowUp && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Follow-up
                              </span>
                            )}
                            {tp.follow_up_required && tp.follow_up_completed && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Done
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            {tp.contact_name && (
                              <span>{tp.contact_name}</span>
                            )}
                            {tp.organization_name && (
                              <span className="text-gray-400">@ {tp.organization_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-6">
                        <div className="hidden lg:flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(new Date(tp.date), 'MMM d, yyyy')}
                          </div>
                          {tp.duration && (
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {tp.duration} min
                            </div>
                          )}
                          {isPendingFollowUp && tp.follow_up_date && (
                            <div className="flex items-center text-amber-600">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Due {format(new Date(tp.follow_up_date), 'MMM d')}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
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

export default TouchpointsList;
