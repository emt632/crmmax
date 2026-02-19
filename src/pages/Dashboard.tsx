import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Phone,
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

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalOrganizations: 0,
    touchpointsThisWeek: 0,
    upcomingRideAlongs: 0,
    pendingPRRequests: 0,
    activeDonors: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
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
      // Keep defaults (zeros)
    }
  };

  const recentActivities: { id: string; type: string; message: string; time: string; icon: React.FC<any> }[] = [];

  const upcomingTasks: { id: string; title: string; dueDate: string; priority: string; category: string }[] = [];

  const statCards = [
    {
      title: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      lightBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      link: '/contacts'
    },
    {
      title: 'Organizations',
      value: stats.totalOrganizations,
      icon: Building2,
      color: 'from-emerald-500 to-emerald-600',
      lightBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      link: '/organizations'
    },
    {
      title: 'Touchpoints (Week)',
      value: stats.touchpointsThisWeek,
      icon: Phone,
      color: 'from-purple-500 to-purple-600',
      lightBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      link: '/touchpoints'
    },
    {
      title: 'Upcoming Ride-Alongs',
      value: stats.upcomingRideAlongs,
      icon: Plane,
      color: 'from-indigo-500 to-indigo-600',
      lightBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      link: '/ride-alongs'
    },
    {
      title: 'Pending PR Requests',
      value: stats.pendingPRRequests,
      icon: Megaphone,
      color: 'from-orange-500 to-orange-600',
      lightBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      link: '/pr-requests'
    },
    {
      title: 'Active Donors',
      value: stats.activeDonors,
      icon: Heart,
      color: 'from-rose-500 to-rose-600',
      lightBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      link: '/donors'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome back!</h1>
            <p className="mt-2 text-blue-100">
              Here's what's happening with your Life Link III CRM today.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid with enhanced cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="group relative bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${stat.color}" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities - Enhanced */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Recent Activities</h2>
              </div>
              <Link to="/activities" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No recent activities yet.</p>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={activity.id} className="flex items-start space-x-4 group hover:bg-gray-50 p-3 rounded-lg transition-colors">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        index === 0 ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-gray-100 to-gray-200'
                      }`}>
                        <activity.icon className={`w-5 h-5 ${index === 0 ? 'text-white' : 'text-gray-600'}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                      <div className="flex items-center mt-1">
                        <Clock className="w-3 h-3 text-gray-400 mr-1" />
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Tasks - Enhanced */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Upcoming Tasks</h2>
              </div>
              <Link to="/tasks" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                View all →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No upcoming tasks.</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="group hover:bg-gray-50 p-3 rounded-lg transition-colors">
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
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          <div className="flex items-center mt-1 space-x-3">
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <Calendar className="w-3 h-3 mr-1" />
                              {task.dueDate}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                              {task.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions - Enhanced */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
          <AlertCircle className="w-5 h-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/contacts/new"
            className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="p-3 bg-blue-100 rounded-lg mb-3 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Add Contact</span>
          </Link>
          
          <Link
            to="/touchpoints/new"
            className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:shadow-lg transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="p-3 bg-purple-100 rounded-lg mb-3 group-hover:scale-110 transition-transform">
              <Phone className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Log Touchpoint</span>
          </Link>
          
          <Link
            to="/ride-alongs/new"
            className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="p-3 bg-indigo-100 rounded-lg mb-3 group-hover:scale-110 transition-transform">
              <Plane className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Schedule Ride-Along</span>
          </Link>
          
          <Link
            to="/pr-requests/new"
            className="group relative flex flex-col items-center justify-center p-6 bg-white border-2 border-gray-200 rounded-xl hover:border-orange-500 hover:shadow-lg transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity" />
            <div className="p-3 bg-orange-100 rounded-lg mb-3 group-hover:scale-110 transition-transform">
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