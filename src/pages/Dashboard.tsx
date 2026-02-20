import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Users,
  Building2,
  Phone,
  Mail,
  Video,
  Users as UsersIcon,
  MessageSquare,
  Plane,
  Megaphone,
  Heart,
  Calendar,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const TOUCHPOINT_ICONS: Record<string, React.FC<any>> = {
  phone: Phone,
  email: Mail,
  'in-person': UsersIcon,
  virtual: Video,
  other: MessageSquare,
};

const TOUCHPOINT_TYPE_LABELS: Record<string, string> = {
  phone: 'Phone Call',
  email: 'Email',
  'in-person': 'In Person',
  virtual: 'Virtual',
  other: 'Other',
};

interface RecentActivity {
  id: string;
  type: string;
  message: string;
  time: string;
  icon: React.FC<any>;
  createdByName?: string;
}

interface UpcomingFollowUp {
  id: string;
  title: string;
  who: string;
  dueDate: string;
  priority: string;
  category: string;
  assignedToName?: string;
}

const Dashboard: React.FC = () => {
  const {
    effectiveUserId, effectiveProfile,
    effectiveIsAdmin, effectiveIsManager, effectiveSubordinateIds,
  } = useAuth();
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOrganizations: 0,
    touchpointsThisWeek: 0,
    upcomingRideAlongs: 0,
    pendingPRRequests: 0,
    activeDonors: 0
  });

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingFollowUp[]>([]);

  const showTeamTab = effectiveIsManager || effectiveIsAdmin;

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (effectiveUserId) {
      fetchRecentActivities();
      fetchUpcomingFollowUps();
    }
  }, [effectiveUserId, activeTab, effectiveSubordinateIds]);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      const [contactsRes, orgsRes, touchpointsRes, donorsRes] = await Promise.all([
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('touchpoints').select('id', { count: 'exact', head: true }).gte('date', weekStart.toISOString()),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('is_donor', true),
      ]);

      setStats({
        totalContacts: contactsRes.count || 0,
        totalOrganizations: orgsRes.count || 0,
        touchpointsThisWeek: touchpointsRes.count || 0,
        upcomingRideAlongs: 0,
        pendingPRRequests: 0,
        activeDonors: donorsRes.count || 0,
      });
    } catch {
      // Keep defaults
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const userId = effectiveUserId!;

      let query = supabase
        .from('touchpoints')
        .select(`
          id, type, subject, date, created_by, assigned_to,
          creator:created_by(full_name),
          touchpoint_contacts(contact:contact_id(first_name, last_name)),
          touchpoint_organizations(organization:organization_id(name))
        `)
        .order('date', { ascending: false })
        .limit(activeTab === 'team' ? 10 : 5);

      if (activeTab === 'my') {
        query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
      } else if (activeTab === 'team' && !effectiveIsAdmin) {
        query = query.in('created_by', effectiveSubordinateIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const activities: RecentActivity[] = (data || []).map((tp: any) => {
        const contactNames = (tp.touchpoint_contacts || [])
          .map((tc: any) => tc.contact ? `${tc.contact.first_name} ${tc.contact.last_name}` : null)
          .filter(Boolean);
        const orgNames = (tp.touchpoint_organizations || [])
          .map((to: any) => to.organization?.name)
          .filter(Boolean);

        const who = [...contactNames, ...orgNames].join(', ');
        const typeLabel = TOUCHPOINT_TYPE_LABELS[tp.type] || tp.type;
        const message = who ? `${typeLabel} with ${who}` : `${typeLabel}: ${tp.subject}`;

        let time: string;
        try {
          time = format(new Date(tp.date), 'MMM d, h:mm a');
        } catch {
          time = '';
        }

        return {
          id: tp.id,
          type: tp.type,
          message,
          time,
          icon: TOUCHPOINT_ICONS[tp.type] || MessageSquare,
          createdByName: tp.creator?.full_name || undefined,
        };
      });

      setRecentActivities(activities);
    } catch {
      setRecentActivities([]);
    }
  };

  const fetchUpcomingFollowUps = async () => {
    try {
      const userId = effectiveUserId!;

      let query = supabase
        .from('touchpoints')
        .select(`
          id, subject, follow_up_date, follow_up_notes, type, created_by, assigned_to,
          assignee:assigned_to(full_name),
          touchpoint_contacts(contact:contact_id(first_name, last_name)),
          touchpoint_organizations(organization:organization_id(name))
        `)
        .eq('follow_up_required', true)
        .eq('follow_up_completed', false)
        .order('follow_up_date', { ascending: true })
        .limit(6);

      if (activeTab === 'my') {
        query = query.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
      } else if (activeTab === 'team' && !effectiveIsAdmin) {
        query = query.in('created_by', effectiveSubordinateIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      const tasks: UpcomingFollowUp[] = (data || []).map((tp: any) => {
        const contactNames = (tp.touchpoint_contacts || [])
          .map((tc: any) => tc.contact ? `${tc.contact.first_name} ${tc.contact.last_name}` : null)
          .filter(Boolean);
        const orgNames = (tp.touchpoint_organizations || [])
          .map((to: any) => to.organization?.name)
          .filter(Boolean);

        const who = [...contactNames, ...orgNames].join(', ');
        const title = tp.follow_up_notes || tp.subject;

        let dueDate = 'No date';
        let priority = 'low';
        if (tp.follow_up_date) {
          try {
            const due = new Date(tp.follow_up_date);
            dueDate = format(due, 'MMM d, yyyy');
            const daysUntil = Math.ceil((due.getTime() - Date.now()) / 86400000);
            if (daysUntil < 0) priority = 'high';
            else if (daysUntil <= 3) priority = 'medium';
          } catch {
            // keep defaults
          }
        }

        return {
          id: tp.id,
          title,
          who,
          dueDate,
          priority,
          category: TOUCHPOINT_TYPE_LABELS[tp.type] || tp.type,
          assignedToName: tp.assignee?.full_name || undefined,
        };
      });

      setUpcomingTasks(tasks);
    } catch {
      setUpcomingTasks([]);
    }
  };

  const statCards = [
    {
      title: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      lightBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      link: '/contacts'
    },
    {
      title: 'Organizations',
      value: stats.totalOrganizations,
      icon: Building2,
      lightBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      link: '/organizations'
    },
    {
      title: 'Touchpoints (Week)',
      value: stats.touchpointsThisWeek,
      icon: Phone,
      lightBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      link: '/touchpoints'
    },
    {
      title: 'Upcoming Ride-Alongs',
      value: stats.upcomingRideAlongs,
      icon: Plane,
      lightBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      link: '/ride-alongs'
    },
    {
      title: 'Pending PR Requests',
      value: stats.pendingPRRequests,
      icon: Megaphone,
      lightBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      link: '/pr-requests'
    },
    {
      title: 'Active Donors',
      value: stats.activeDonors,
      icon: Heart,
      lightBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      link: '/donors'
    }
  ];

  const firstName = effectiveProfile?.first_name || '';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-blue-600 rounded-xl p-8 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome back{firstName ? `, ${firstName}` : ''}!</h1>
            <p className="mt-2 text-blue-100">
              Here's what's happening with your Life Link III CRM today.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.lightBg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* My Activity / Team Activity tabs */}
      {showTeamTab && (
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'my'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Activity
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'team'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Team Activity
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {activeTab === 'team' ? 'Team Activities' : 'Recent Activities'}
                </h2>
              </div>
              <Link to="/touchpoints" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {activeTab === 'team' ? 'No team activities yet.' : 'No recent activities yet.'}
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <Link key={activity.id} to={`/touchpoints/${activity.id}`} className="flex items-start space-x-4 group hover:bg-gray-50 p-3 rounded-lg transition-colors">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-blue-600' : 'bg-gray-100'
                      }`}>
                        <activity.icon className={`w-5 h-5 ${index === 0 ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                      <div className="flex items-center mt-1 space-x-3">
                        <span className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {activity.time}
                        </span>
                        {activeTab === 'team' && activity.createdByName && (
                          <span className="text-xs text-gray-400">by {activity.createdByName}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {activeTab === 'team' ? 'Team Follow-ups' : 'Upcoming Follow-ups'}
                </h2>
              </div>
              <Link to="/touchpoints" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No pending follow-ups.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <Link key={task.id} to={`/touchpoints/${task.id}`} className="block group hover:bg-gray-50 p-3 rounded-lg transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'high'
                              ? 'bg-red-500 animate-pulse'
                              : task.priority === 'medium'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`} />
                        </div>
                        <div className="flex-1">
                          {task.who && (
                            <p className="text-sm font-semibold text-gray-900">{task.who}</p>
                          )}
                          <p className="text-sm text-gray-700">{task.title}</p>
                          <div className="flex items-center mt-1 space-x-3">
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <Calendar className="w-3 h-3 mr-1" />
                              {task.dueDate}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                              {task.category}
                            </span>
                            {activeTab === 'team' && task.assignedToName && (
                              <span className="text-xs text-purple-600">→ {task.assignedToName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          <AlertCircle className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/contacts/new"
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <div className="p-3 bg-blue-100 rounded-lg mb-3">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Add Contact</span>
          </Link>

          <Link
            to="/touchpoints/new"
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <div className="p-3 bg-purple-100 rounded-lg mb-3">
              <Phone className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Log Touchpoint</span>
          </Link>

          <Link
            to="/ride-alongs/new"
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <div className="p-3 bg-indigo-100 rounded-lg mb-3">
              <Plane className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Schedule Ride-Along</span>
          </Link>

          <Link
            to="/pr-requests/new"
            className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors"
          >
            <div className="p-3 bg-orange-100 rounded-lg mb-3">
              <Megaphone className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">New PR Request</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
