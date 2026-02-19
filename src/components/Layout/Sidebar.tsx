import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users,
  Building2,
  Plane,
  Megaphone,
  Heart,
  Shield,
  Menu,
  X,
  Home,
  Phone,
  ClipboardList,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  onSignOut?: () => void;
  userEmail?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ onSignOut, userEmail }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<string[]>(['crm']);

  const toggleModule = (module: string) => {
    setExpandedModules(prev =>
      prev.includes(module)
        ? prev.filter(m => m !== module)
        : [...prev, module]
    );
  };

  const navigationItems = [
    {
      module: 'crm',
      title: 'CRM',
      icon: Users,
      items: [
        { path: '/contacts', label: 'Contacts', icon: Users },
        { path: '/organizations', label: 'Organizations', icon: Building2 },
        { path: '/touchpoints', label: 'Touchpoints', icon: Phone },
        { path: '/ride-alongs', label: 'Ride-Alongs', icon: Plane },
        { path: '/pr-requests', label: 'PR Requests', icon: Megaphone },
      ]
    },
    {
      module: 'philanthropy',
      title: 'Philanthropy',
      icon: Heart,
      items: [
        { path: '/donors', label: 'Donors', icon: Heart },
        { path: '/campaigns', label: 'Campaigns', icon: ClipboardList },
        { path: '/grants', label: 'Grants', icon: Shield },
      ]
    },
    {
      module: 'advolink',
      title: 'ADVO-LINK',
      icon: Shield,
      items: [
        { path: '/advocacy', label: 'Coming Soon', icon: Shield },
      ]
    }
  ];

  const NavContent = () => (
    <>
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse-slow">
            <span className="text-white font-bold text-sm">LL3</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 text-lg">Life Link III</span>
            <p className="text-xs text-gray-500">CRM System</p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-6">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 shadow-md border border-blue-100'
                : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm border border-transparent'
            }`
          }
        >
          <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-medium">Dashboard</span>
        </NavLink>

        <div className="mt-8 space-y-3">
          {navigationItems.map((module) => (
            <div key={module.module}>
              <button
                onClick={() => toggleModule(module.module)}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-xl transition-all duration-200 group"
              >
                <div className="flex items-center space-x-3">
                  <module.icon className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" />
                  <span className="font-semibold">{module.title}</span>
                </div>
                {expandedModules.includes(module.module) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
              
              {expandedModules.includes(module.module) && (
                <div className="ml-6 mt-3 space-y-2">
                  {module.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 font-medium shadow-sm border border-blue-100'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      <div className="p-6 border-t border-gray-100 bg-gradient-to-br from-gray-50 to-white">
        {userEmail && (
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-gray-500 truncate">{userEmail}</p>
          </div>
        )}
        <NavLink
          to="/settings"
          className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200 group"
        >
          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="font-medium">Settings</span>
        </NavLink>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 mt-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
        className="lg:hidden fixed top-6 left-6 z-50 p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/20"
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
      <div className="hidden lg:flex lg:flex-col lg:w-72 lg:h-screen lg:bg-white/80 lg:backdrop-blur-xl lg:border-r lg:border-gray-100 lg:shadow-xl">
        <NavContent />
      </div>
    </>
  );
};

export default Sidebar;