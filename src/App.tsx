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
import HomePage from './pages/HomePage';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import ContactImport from './pages/ContactImport';
import ShareTarget from './pages/ShareTarget';
import Login from './pages/Login';
import TeamActivity from './pages/TeamActivity';
import AdvocacyDashboard from './components/Advocacy/AdvocacyDashboard';
import BillsList from './components/Advocacy/BillsList';
import BillForm from './components/Advocacy/BillForm';
import BillDetail from './components/Advocacy/BillDetail';
import EngagementsList from './components/Advocacy/EngagementsList';
import EngagementForm from './components/Advocacy/EngagementForm';
import AdvocacyReports from './components/Advocacy/AdvocacyReports';
import LegislativeDirectory from './components/Advocacy/LegislativeDirectory';
import SupportAsksList from './components/Advocacy/SupportAsksList';
import SupportAskForm from './components/Advocacy/SupportAskForm';
import PhilanthropyDashboard from './components/Philanthropy/PhilanthropyDashboard';
import EventsList from './components/Philanthropy/EventsList';
import EventForm from './components/Philanthropy/EventForm';
import EventDetail from './components/Philanthropy/EventDetail';
import SponsorsListAll from './components/Philanthropy/SponsorsListAll';
import RegistrationsListAll from './components/Philanthropy/RegistrationsListAll';
import TeamsListAll from './components/Philanthropy/TeamsListAll';
import DonationsListAll from './components/Philanthropy/DonationsListAll';
import VolunteersListAll from './components/Philanthropy/VolunteersListAll';
import ContestsListAll from './components/Philanthropy/ContestsListAll';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="contacts" element={<ContactsList />} />
              <Route path="contacts/new" element={<ContactForm />} />
              <Route path="contacts/import" element={<ContactImport />} />
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
              <Route path="advocacy" element={<AdvocacyDashboard />} />
              <Route path="advocacy/bills" element={<BillsList />} />
              <Route path="advocacy/bills/new" element={<BillForm />} />
              <Route path="advocacy/bills/:id" element={<BillDetail />} />
              <Route path="advocacy/bills/:id/edit" element={<BillForm />} />
              <Route path="advocacy/engagements" element={<EngagementsList />} />
              <Route path="advocacy/engagements/new" element={<EngagementForm />} />
              <Route path="advocacy/engagements/:id" element={<EngagementForm />} />
              <Route path="advocacy/support-campaigns" element={<SupportAsksList />} />
              <Route path="advocacy/support-campaigns/new" element={<SupportAskForm />} />
              <Route path="advocacy/support-campaigns/:id" element={<SupportAskForm />} />
              <Route path="advocacy/directory" element={<LegislativeDirectory />} />
              <Route path="advocacy/reports" element={<AdvocacyReports />} />
              <Route path="philanthropy" element={<PhilanthropyDashboard />} />
              <Route path="philanthropy/events" element={<EventsList />} />
              <Route path="philanthropy/events/new" element={<EventForm />} />
              <Route path="philanthropy/events/:id" element={<EventDetail />} />
              <Route path="philanthropy/events/:id/edit" element={<EventForm />} />
              <Route path="philanthropy/sponsors" element={<SponsorsListAll />} />
              <Route path="philanthropy/registrations" element={<RegistrationsListAll />} />
              <Route path="philanthropy/teams" element={<TeamsListAll />} />
              <Route path="philanthropy/donations" element={<DonationsListAll />} />
              <Route path="philanthropy/volunteers" element={<VolunteersListAll />} />
              <Route path="philanthropy/contests" element={<ContestsListAll />} />
              <Route path="share-target" element={<ShareTarget />} />
              <Route path="reports" element={<Reports />} />
              <Route path="team-activity" element={<TeamActivity />} />
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
  <div className="flex flex-col items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4 p-12">
      <div className="inline-flex p-4 bg-blue-50 rounded-xl mb-4">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-gray-900">
        {module}
      </h2>
      <p className="text-gray-600 text-lg max-w-md mx-auto">
        We're working hard to bring you this feature. Stay tuned for updates!
      </p>
      <div className="flex items-center justify-center space-x-2 mt-6">
        <span className="inline-flex h-2 w-2 bg-blue-600 rounded-full"></span>
        <span className="inline-flex h-2 w-2 bg-blue-400 rounded-full"></span>
        <span className="inline-flex h-2 w-2 bg-blue-300 rounded-full"></span>
      </div>
    </div>
  </div>
);

export default App;
