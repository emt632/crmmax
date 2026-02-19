import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import Layout from './components/Layout/Layout';
import ContactsList from './components/Contacts/ContactsList';
import ContactForm from './components/Contacts/ContactForm';
import OrganizationsList from './components/Organizations/OrganizationsList';
import OrganizationForm from './components/Organizations/OrganizationForm';
import TouchpointsList from './components/Touchpoints/TouchpointsList';
import TouchpointForm from './components/Touchpoints/TouchpointForm';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Login from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="contacts" element={<ContactsList />} />
              <Route path="contacts/new" element={<ContactForm />} />
              <Route path="contacts/:id" element={<ContactForm />} />
              <Route path="organizations" element={<OrganizationsList />} />
              <Route path="organizations/new" element={<OrganizationForm />} />
              <Route path="organizations/:id" element={<OrganizationForm />} />
              <Route path="touchpoints" element={<TouchpointsList />} />
              <Route path="touchpoints/new" element={<TouchpointForm />} />
              <Route path="touchpoints/:id" element={<TouchpointForm />} />
              <Route path="ride-alongs" element={<ComingSoon module="Ride-Alongs" />} />
              <Route path="pr-requests" element={<ComingSoon module="PR Requests" />} />
              <Route path="donors" element={<ComingSoon module="Donors" />} />
              <Route path="campaigns" element={<ComingSoon module="Campaigns" />} />
              <Route path="grants" element={<ComingSoon module="Grants" />} />
              <Route path="advocacy" element={<ComingSoon module="ADVO-LINK" />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

// Temporary Coming Soon component
const ComingSoon: React.FC<{ module: string }> = ({ module }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] relative">
    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-3xl opacity-50" />
    <div className="relative text-center space-y-4 p-12">
      <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl mb-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center animate-pulse-slow">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        {module}
      </h2>
      <p className="text-gray-600 text-lg max-w-md mx-auto">
        We're working hard to bring you this feature. Stay tuned for updates!
      </p>
      <div className="flex items-center justify-center space-x-2 mt-6">
        <span className="inline-flex h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
        <span className="inline-flex h-2 w-2 bg-indigo-600 rounded-full animate-pulse delay-75"></span>
        <span className="inline-flex h-2 w-2 bg-purple-600 rounded-full animate-pulse delay-150"></span>
      </div>
    </div>
  </div>
);

export default App;
