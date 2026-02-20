import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Menu,
  X,
  Home,
  Phone,
  Settings,
  LogOut,
  Plus,
  BarChart3,
} from 'lucide-react';
import ll3Logo from '../../assets/ll3-logo.png';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  onSignOut?: () => void;
  userEmail?: string;
  userName?: string | null;
}

const navItems = [
  { path: '/contacts', label: 'Contacts', icon: Users },
  { path: '/organizations', label: 'Organizations', icon: Building2 },
  { path: '/touchpoints', label: 'Touchpoints', icon: Phone },
];

const quickAddItems = [
  { path: '/contacts/new', label: 'Contact', icon: Users, color: 'bg-blue-500' },
  { path: '/organizations/new', label: 'Organization', icon: Building2, color: 'bg-emerald-500' },
  { path: '/touchpoints/new', label: 'Touchpoint', icon: Phone, color: 'bg-purple-500' },
];

const Sidebar: React.FC<SidebarProps> = ({ onSignOut, userEmail, userName }) => {
  const { isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const NavContent = () => (
    <>
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <img src={ll3Logo} alt="Life Link III" className="h-9" />
          <span className="text-sm font-semibold text-gray-500">CRM</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                : 'text-gray-700 hover:bg-gray-50 border border-transparent'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </NavLink>

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'text-gray-700 hover:bg-gray-50 border border-transparent'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* Admin: Team Activity */}
        {isAdmin && (
          <NavLink
            to="/team-activity"
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border border-blue-100'
                  : 'text-gray-700 hover:bg-gray-50 border border-transparent'
              }`
            }
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium">Team Activity</span>
          </NavLink>
        )}

        {/* Quick Add */}
        <div
          className="relative mt-3 pt-3 border-t border-gray-100"
          onMouseLeave={() => setQuickAddOpen(false)}
        >
          <button
            onClick={() => setQuickAddOpen(!quickAddOpen)}
            onMouseEnter={() => setQuickAddOpen(true)}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
              quickAddOpen
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
            }`}
          >
            <Plus className={`w-5 h-5 transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''}`} />
            <span className="font-medium">Quick Add</span>
          </button>

          {quickAddOpen && (
            <div className="mt-1 ml-2 animate-fade-in">
              {quickAddItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { setQuickAddOpen(false); setIsMobileMenuOpen(false); }}
                  className="flex items-center space-x-3 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all duration-200"
                >
                  <div className={`w-6 h-6 rounded-md ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="p-6 border-t border-gray-100 bg-gray-50">
        {(userName || userEmail) && (
          <div className="px-4 py-2 mb-2">
            {userName && <p className="text-sm font-medium text-gray-700 truncate">{userName}</p>}
            {userEmail && <p className="text-xs text-gray-500 truncate">{userEmail}</p>}
          </div>
        )}
        <NavLink
          to="/settings"
          className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </NavLink>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 mt-2 group"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-6 left-6 z-50 p-3 bg-white rounded-xl shadow-md border border-gray-200 transition-colors hover:bg-gray-50"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
        <div
          className={`absolute left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-transform ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <NavContent />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:h-screen lg:bg-white lg:border-r lg:border-gray-200 lg:shadow-sm">
        <NavContent />
      </div>
    </>
  );
};

export default Sidebar;