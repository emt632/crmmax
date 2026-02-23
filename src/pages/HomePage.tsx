import React from 'react';
import { Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';

const HomePage: React.FC = () => {
  const isMobile = !window.matchMedia('(min-width: 1024px)').matches;

  // On mobile, redirect to contacts only on first visit per session
  if (isMobile && !sessionStorage.getItem('has_navigated')) {
    sessionStorage.setItem('has_navigated', '1');
    return <Navigate to="/contacts" replace />;
  }

  return <Dashboard />;
};

export default HomePage;
