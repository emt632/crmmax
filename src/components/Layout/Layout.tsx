import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Plus, User, Building2, Phone, X, ContactRound } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const fabItems = [
  { to: '/contacts/new', label: 'Contact', icon: User, color: 'bg-blue-500' },
  { to: '/share-target', label: 'Quick Import', icon: ContactRound, color: 'bg-sky-500' },
  { to: '/organizations/new', label: 'Organization', icon: Building2, color: 'bg-emerald-500' },
  { to: '/touchpoints/new', label: 'Touchpoint', icon: Phone, color: 'bg-purple-500' },
];

const Layout: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Sidebar onSignOut={signOut} userEmail={user?.email} userName={profile?.full_name} />
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="relative p-6 pt-20 lg:p-10 lg:pt-10 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile FAB */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-3">
        {/* Backdrop */}
        {fabOpen && (
          <div className="fixed inset-0 bg-black/20 -z-10" onClick={() => setFabOpen(false)} />
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl flex items-center justify-center transition-transform duration-200 ${
            fabOpen ? 'rotate-45' : ''
          }`}
        >
          {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>

        {/* Expanded menu items */}
        {fabOpen && (
          <>
            {fabItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setFabOpen(false)}
                className="flex items-center gap-3 animate-fade-in"
              >
                <span className="px-3 py-1.5 bg-white rounded-lg shadow-lg text-sm font-medium text-gray-700">
                  {item.label}
                </span>
                <div className={`w-11 h-11 rounded-full ${item.color} text-white shadow-lg flex items-center justify-center`}>
                  <item.icon className="w-5 h-5" />
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default Layout;
