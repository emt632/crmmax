import React from 'react';
import { Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';

const HomePage: React.FC = () => {
  const isMobile = !window.matchMedia('(min-width: 1024px)').matches;

  if (isMobile) {
    return <Navigate to="/contacts" replace />;
  }

  return <Dashboard />;
};

export default HomePage;
