import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Filter,
  Mail,
  Phone,
  Globe,
  ChevronRight,
  Download,
  MapPin,
  Grid3x3,
  List,
  X,
  Building2,
  Heart,
  Tag
} from 'lucide-react';
import type { Organization, ContactType, ContactTypeAssignment } from '../../types';
import { supabase } from '../../lib/supabase';

const OrganizationsList: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [typeAssignments, setTypeAssignments] = useState<ContactTypeAssignment[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchOrganizations();
    fetchContactTypes();
    fetchTypeAssignments();
  }, []);

  useEffect(() => {
    filterOrganizations();
  }, [searchTerm, organizations, selectedTypeFilter, typeAssignments]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
      setOrganizations(getSampleOrganizations());
    } finally {
      setLoading(false);
    }
  };

  const fetchContactTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_types')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setContactTypes(data || []);
    } catch {
      setContactTypes(getDefaultContactTypes());
    }
  };

  const fetchTypeAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_type_assignments')
        .select('*')
        .eq('entity_type', 'organization');

      if (error) throw error;
      setTypeAssignments(data || []);
    } catch {
      setTypeAssignments([]);
    }
  };

  const filterOrganizations = () => {
    let filtered = organizations;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(term) ||
        org.email?.toLowerCase().includes(term) ||
        org.phone?.includes(searchTerm)
      );
    }

    if (selectedTypeFilter !== 'all') {
      const orgIds = typeAssignments
        .filter(ta => ta.contact_type_id === selectedTypeFilter)
        .map(ta => ta.entity_id);
      filtered = filtered.filter(org => orgIds.includes(org.id));
    }

    setFilteredOrganizations(filtered);
  };

  const getOrgTypes = (orgId: string): ContactType[] => {
    const assignedTypeIds = typeAssignments
      .filter(ta => ta.entity_id === orgId)
      .map(ta => ta.contact_type_id);
    return contactTypes.filter(ct => assignedTypeIds.includes(ct.id));
  };

  const getSampleOrganizations = (): Organization[] => [
    {
      id: 'org-1',
      name: 'Mayo Clinic',
      type: 'Healthcare',
      phone: '507-255-5123',
      email: 'info@mayo.edu',
      website: 'https://www.mayoclinic.org',
      address_line1: '200 First St SW',
      city: 'Rochester',
      state: 'MN',
      zip: '55905',
      is_donor: true,
      notes: 'Major hospital partner',
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'org-2',
      name: 'Sanford Health',
      type: 'Healthcare',
      phone: '605-333-1000',
      email: 'contact@sanfordhealth.org',
      website: 'https://www.sanfordhealth.org',
      address_line1: '1305 W 18th St',
      city: 'Sioux Falls',
      state: 'SD',
      zip: '57105',
      is_donor: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'org-3',
      name: 'Minneapolis Fire Department',
      type: 'Fire',
      phone: '612-673-2000',
      email: 'fire@minneapolismn.gov',
      address_line1: '530 S 5th St',
      city: 'Minneapolis',
      state: 'MN',
      zip: '55415',
      is_donor: false,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'org-4',
      name: 'North Memorial Health',
      type: 'Healthcare',
      phone: '763-520-5200',
      email: 'info@northmemorial.com',
      address_line1: '3300 Oakdale Ave N',
      city: 'Robbinsdale',
      state: 'MN',
      zip: '55422',
      is_donor: true,
      created_by: 'user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const getDefaultContactTypes = (): ContactType[] => [
    { id: 'ct-1', name: 'EMS', color: '#EF4444', sort_order: 1, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-2', name: 'Fire', color: '#F97316', sort_order: 2, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-3', name: 'Hospital', color: '#3B82F6', sort_order: 3, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-4', name: 'Association', color: '#8B5CF6', sort_order: 4, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-5', name: 'Government', color: '#6B7280', sort_order: 5, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-6', name: 'Education', color: '#10B981', sort_order: 6, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-7', name: 'Vendor', color: '#F59E0B', sort_order: 7, created_by: 'user-1', created_at: '', updated_at: '' },
    { id: 'ct-8', name: 'Other', color: '#9CA3AF', sort_order: 8, created_by: 'user-1', created_at: '', updated_at: '' },
  ];

  const exportOrganizations = () => {
    const csv = [
      ['Name', 'Type', 'Phone', 'Email', 'Website', 'City', 'State', 'Donor'],
      ...filteredOrganizations.map(org => [
        org.name,
        org.type || '',
        org.phone || '',
        org.email || '',
        org.website || '',
        org.city || '',
        org.state || '',
        org.is_donor ? 'Yes' : 'No'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organizations-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-emerald-500 to-teal-600',
      'bg-gradient-to-br from-teal-500 to-cyan-600',
      'bg-gradient-to-br from-cyan-500 to-blue-600',
      'bg-gradient-to-br from-green-500 to-emerald-600',
      'bg-gradient-to-br from-lime-500 to-green-600',
      'bg-gradient-to-br from-indigo-500 to-purple-600',
      'bg-gradient-to-br from-blue-500 to-indigo-600'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600"></div>
          <Building2 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-emerald-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading organizations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Building2 className="w-8 h-8 mr-3" />
              Organizations
            </h1>
            <p className="mt-2 text-emerald-100">
              Manage your organization partners and relationships
            </p>
            <div className="mt-4 flex items-center space-x-6">
              <div>
                <p className="text-sm text-emerald-200">Total Organizations</p>
                <p className="text-2xl font-bold">{organizations.length}</p>
              </div>
              <div>
                <p className="text-sm text-emerald-200">Donors</p>
                <p className="text-2xl font-bold">{organizations.filter(o => o.is_donor).length}</p>
              </div>
              <div>
                <p className="text-sm text-emerald-200">Types</p>
                <p className="text-2xl font-bold">{contactTypes.length}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 lg:mt-0 flex flex-wrap gap-3">
            <button
              onClick={exportOrganizations}
              className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
            <Link
              to="/organizations/new"
              className="inline-flex items-center px-5 py-2.5 bg-white text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Organization
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {contactTypes.map(ct => (
                  <option key={ct.id} value={ct.id}>{ct.name}</option>
                ))}
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-4 py-3 border rounded-xl text-sm font-medium transition-all ${
                  showFilters
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>

              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {contactTypes.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => setSelectedTypeFilter(selectedTypeFilter === ct.id ? 'all' : ct.id)}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      selectedTypeFilter === ct.id
                        ? 'text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={selectedTypeFilter === ct.id ? { backgroundColor: ct.color } : undefined}
                  >
                    <Tag className="w-3 h-3 mr-1.5" />
                    {ct.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-yellow-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">Running in mock mode - no Supabase connection</p>
              <p className="text-xs text-yellow-700 mt-1">Displaying sample data for demonstration purposes</p>
            </div>
          </div>
        </div>
      )}

      {/* Organizations Display */}
      {filteredOrganizations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center">
              <Building2 className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No organizations found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm || selectedTypeFilter !== 'all'
                ? 'Try adjusting your filters to find organizations'
                : 'Get started by creating your first organization'}
            </p>
            <div className="mt-6">
              <Link
                to="/organizations/new"
                className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Organization
              </Link>
            </div>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredOrganizations.map((org) => {
              const orgTypes = getOrgTypes(org.id);
              return (
                <Link
                  key={org.id}
                  to={`/organizations/${org.id}`}
                  className="block hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 transition-all group"
                >
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`flex-shrink-0 h-12 w-12 ${getAvatarColor(org.name)} rounded-xl flex items-center justify-center text-white font-semibold shadow-lg group-hover:scale-110 transition-transform`}>
                          {getInitials(org.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-base font-semibold text-gray-900 truncate">
                              {org.name}
                            </p>
                            {org.is_donor && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">
                                <Heart className="w-3 h-3 mr-1" />
                                Donor
                              </span>
                            )}
                            {orgTypes.map(ct => (
                              <span
                                key={ct.id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: ct.color }}
                              >
                                {ct.name}
                              </span>
                            ))}
                          </div>
                          {org.type && (
                            <p className="text-sm text-gray-600 truncate mt-0.5">
                              {org.type}
                              {org.hospital_ownership && (
                                <span className="text-gray-400"> — {org.hospital_ownership}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-8">
                        <div className="hidden lg:flex items-center space-x-6 text-sm">
                          {org.email && (
                            <div className="flex items-center text-gray-600">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {org.email}
                            </div>
                          )}
                          {org.phone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="w-4 h-4 mr-2 text-gray-400" />
                              {org.phone}
                            </div>
                          )}
                          {org.website && (
                            <div className="flex items-center text-gray-600">
                              <Globe className="w-4 h-4 mr-2 text-gray-400" />
                              {org.website.replace(/^https?:\/\//, '')}
                            </div>
                          )}
                          {org.city && org.state && (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                              {org.city}, {org.state}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredOrganizations.map((org) => {
            const orgTypes = getOrgTypes(org.id);
            return (
              <Link
                key={org.id}
                to={`/organizations/${org.id}`}
                className="group relative bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 opacity-0 group-hover:opacity-5 transition-opacity" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`h-16 w-16 ${getAvatarColor(org.name)} rounded-xl flex items-center justify-center text-white font-semibold text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                      {getInitials(org.name)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {org.name}
                      </h3>
                      {org.type && (
                        <p className="text-sm text-gray-600">
                          {org.type}
                          {org.hospital_ownership && (
                            <span className="text-gray-400"> — {org.hospital_ownership}</span>
                          )}
                        </p>
                      )}
                    </div>

                    {org.email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{org.email}</span>
                      </div>
                    )}

                    {org.phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{org.phone}</span>
                      </div>
                    )}

                    <div className="pt-3 flex flex-wrap gap-2">
                      {org.is_donor && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Heart className="w-3 h-3 mr-1" />
                          Donor
                        </span>
                      )}
                      {orgTypes.map(ct => (
                        <span
                          key={ct.id}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: ct.color }}
                        >
                          {ct.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrganizationsList;
