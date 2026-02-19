import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

interface LayoutProps {
  onSignOut?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ onSignOut }) => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Sidebar onSignOut={onSignOut} />
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="relative p-6 lg:p-10 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;