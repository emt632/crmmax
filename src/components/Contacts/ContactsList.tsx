import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Filter,
  Mail,
  Phone,
  Building2,
  ChevronRight,
  User,
  Download,
  Upload,
  MapPin,
  Star,
  MoreVertical,
  Grid3x3,
  List,
  X,
  Users,
  Heart
} from 'lucide-react';
import type { Contact, Organization, ContactOrganization, ContactType, ContactTypeAssignment } from '../../types';
import { supabase } from '../../lib/supabase';
import { contactsToVCardFile, downloadVCard } from '../../lib/vcard';

const ContactsList: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<string>('all');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contactOrganizations, setContactOrganizations] = useState<ContactOrganization[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [typeAssignments, setTypeAssignments] = useState<ContactTypeAssignment[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchContacts();
    fetchOrganizations();
    fetchContactOrganizations();
    fetchContactTypes();
    fetchTypeAssignments();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchTerm, selectedOrganization, contacts, selectedTags, selectedTypeFilter, typeAssignments]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts');
      // Use sample data if database is not configured
      setContacts(getSampleContacts());
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (err) {
      // Use sample organizations if database is not configured
      setOrganizations([
        { 
          id: 'org-1', 
          name: 'Mayo Clinic',
          type: 'Healthcare',
          is_donor: false,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { 
          id: 'org-2', 
          name: 'Sanford Health',
          type: 'Healthcare',
          is_donor: false,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { 
          id: 'org-3', 
          name: 'Essentia Health',
          type: 'Healthcare',
          is_donor: false,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
    }
  };

  const fetchContactOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_organizations')
        .select('*');

      if (error) throw error;
      setContactOrganizations(data || []);
    } catch (err) {
      // Use sample data if database is not configured
      setContactOrganizations([
        {
          id: 'co-1',
          contact_id: '1',
          organization_id: 'org-1',
          role: 'Director',
          is_primary: true,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'co-2',
          contact_id: '2',
          organization_id: 'org-2',
          role: 'Manager',
          is_primary: true,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'co-3',
          contact_id: '3',
          organization_id: 'org-1',
          role: 'Coordinator',
          is_primary: true,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);
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
      setContactTypes([]);
    }
  };

  const fetchTypeAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_type_assignments')
        .select('*')
        .eq('entity_type', 'contact');

      if (error) throw error;
      setTypeAssignments(data || []);
    } catch {
      setTypeAssignments([]);
    }
  };

  const getContactTypes = (contactId: string): ContactType[] => {
    const assignedTypeIds = typeAssignments
      .filter(ta => ta.entity_id === contactId)
      .map(ta => ta.contact_type_id);
    return contactTypes.filter(ct => assignedTypeIds.includes(ct.id));
  };

  const filterContacts = () => {
    let filtered = contacts;

    if (searchTerm) {
      filtered = filtered.filter(contact => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase()) ||
          contact.email_work?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.email_personal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.phone_mobile?.includes(searchTerm) ||
          contact.phone_office?.includes(searchTerm);
      });
    }

    if (selectedOrganization !== 'all') {
      const contactIds = contactOrganizations
        .filter(co => co.organization_id === selectedOrganization)
        .map(co => co.contact_id);
      filtered = filtered.filter(contact => contactIds.includes(contact.id));
    }

    if (selectedTags.length > 0) {
      if (selectedTags.includes('donor')) {
        filtered = filtered.filter(contact => contact.is_donor);
      }
      if (selectedTags.includes('vip')) {
        filtered = filtered.filter(contact => contact.is_vip);
      }
    }

    if (selectedTypeFilter !== 'all') {
      const contactIds = typeAssignments
        .filter(ta => ta.contact_type_id === selectedTypeFilter)
        .map(ta => ta.entity_id);
      filtered = filtered.filter(contact => contactIds.includes(contact.id));
    }

    setFilteredContacts(filtered);
  };

  const getSampleContacts = (): Contact[] => {
    return [
      {
        id: '1',
        first_name: 'Sarah',
        last_name: 'Mitchell',
        title: 'Emergency Medicine Director',
        email_work: 'sarah.mitchell@mayo.edu',
        email_personal: 'sarah.m@gmail.com',
        phone_mobile: '507-555-0234',
        phone_office: '507-255-5123',
        address_line1: '200 First St SW',
        city: 'Rochester',
        state: 'MN',
        zip: '55905',
        is_donor: true,
        is_vip: true,
        notes: 'Key contact for emergency services',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        first_name: 'John',
        last_name: 'Anderson',
        title: 'Flight Operations Manager',
        email_work: 'john.anderson@sanfordhealth.org',
        phone_mobile: '605-555-0123',
        phone_office: '605-333-1000',
        address_line1: '1305 W 18th St',
        city: 'Sioux Falls',
        state: 'SD',
        zip: '57105',
        is_donor: false,
        is_vip: false,
        notes: 'Oversees flight operations',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '3',
        first_name: 'Emily',
        last_name: 'Johnson',
        title: 'Patient Care Coordinator',
        email_work: 'emily.johnson@mayo.edu',
        phone_mobile: '507-555-0456',
        phone_office: '507-255-5789',
        address_line1: '200 First St SW',
        city: 'Rochester',
        state: 'MN',
        zip: '55905',
        is_donor: true,
        is_vip: false,
        notes: 'Coordinates patient transfers',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '4',
        first_name: 'Michael',
        last_name: 'Brown',
        title: 'Chief Medical Officer',
        email_work: 'michael.brown@essentia.org',
        phone_mobile: '218-555-0789',
        phone_office: '218-786-2000',
        address_line1: '502 E 2nd St',
        city: 'Duluth',
        state: 'MN',
        zip: '55805',
        is_donor: false,
        is_vip: true,
        notes: 'Decision maker for medical equipment',
        created_by: 'user-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  };

  const getContactOrganization = (contactId: string) => {
    const contactOrg =
      contactOrganizations.find(co => co.contact_id === contactId && co.is_primary) ||
      contactOrganizations.find(co => co.contact_id === contactId);
    if (contactOrg) {
      const org = organizations.find(o => o.id === contactOrg.organization_id);
      return { organization: org, role: contactOrg.role };
    }
    return null;
  };

  const exportContacts = () => {
    const csv = [
      ['First Name', 'Last Name', 'Title', 'Work Email', 'Personal Email', 'Mobile Phone', 'Office Phone', 'Organization', 'Role', 'Donor'],
      ...filteredContacts.map(contact => {
        const orgInfo = getContactOrganization(contact.id);
        return [
          contact.first_name,
          contact.last_name,
          contact.title || '',
          contact.email_work || '',
          contact.email_personal || '',
          contact.phone_mobile || '',
          contact.phone_office || '',
          orgInfo?.organization?.name || '',
          orgInfo?.role || '',
          contact.is_donor ? 'Yes' : 'No'
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const exportVCards = () => {
    const vcardContent = contactsToVCardFile(
      filteredContacts,
      (contactId) => {
        const orgInfo = getContactOrganization(contactId);
        if (!orgInfo) return null;
        return { name: orgInfo.organization?.name, role: orgInfo.role };
      }
    );
    downloadVCard(vcardContent, `contacts-${format(new Date(), 'yyyy-MM-dd')}.vcf`);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-500 to-blue-600',
      'bg-gradient-to-br from-purple-500 to-purple-600',
      'bg-gradient-to-br from-green-500 to-green-600',
      'bg-gradient-to-br from-yellow-500 to-yellow-600',
      'bg-gradient-to-br from-red-500 to-red-600',
      'bg-gradient-to-br from-indigo-500 to-indigo-600',
      'bg-gradient-to-br from-pink-500 to-pink-600'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          <Users className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Users className="w-8 h-8 mr-3" />
              Contacts
            </h1>
            <p className="mt-2 text-blue-100">
              Manage your contacts and relationships
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-sm text-blue-200">Total Contacts</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-200">Organizations</p>
                <p className="text-2xl font-bold">{organizations.length}</p>
              </div>
              <div>
                <p className="text-sm text-blue-200">Donors</p>
                <p className="text-2xl font-bold">{contacts.filter(c => c.is_donor).length}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 lg:mt-0 flex flex-wrap gap-3">
            <button
              onClick={exportContacts}
              className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={exportVCards}
              className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export vCards</span>
            </button>
            <Link
              to="/contacts/import"
              className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Link>
            <Link
              to="/contacts/new"
              className="inline-flex items-center px-5 py-2.5 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Link>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Search and View Toggle */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
            
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedOrganization}
                onChange={(e) => setSelectedOrganization(e.target.value)}
                className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Organizations</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>

              {contactTypes.length > 0 && (
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {contactTypes.map(ct => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
              )}
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-4 py-3 border rounded-xl text-sm font-medium transition-all ${
                  showFilters 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {selectedTags.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {selectedTags.length}
                  </span>
                )}
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

          {/* Advanced Filters */}
          {showFilters && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (selectedTags.includes('donor')) {
                      setSelectedTags(selectedTags.filter(t => t !== 'donor'));
                    } else {
                      setSelectedTags([...selectedTags, 'donor']);
                    }
                  }}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedTags.includes('donor')
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart className="w-3 h-3 mr-1.5" />
                  Donors Only
                </button>
                <button
                  onClick={() => {
                    if (selectedTags.includes('vip')) {
                      setSelectedTags(selectedTags.filter(t => t !== 'vip'));
                    } else {
                      setSelectedTags([...selectedTags, 'vip']);
                    }
                  }}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedTags.includes('vip')
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Star className="w-3 h-3 mr-1.5" />
                  VIP Contacts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                Running in mock mode - no Supabase connection
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Displaying sample data for demonstration purposes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Display */}
      {filteredContacts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12">
          <div className="text-center">
            <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No contacts found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm || selectedOrganization !== 'all' || selectedTags.length > 0
                ? 'Try adjusting your filters to find contacts'
                : 'Get started by creating your first contact'}
            </p>
            <div className="mt-6">
              <Link
                to="/contacts/new"
                className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Contact
              </Link>
            </div>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredContacts.map((contact) => {
              const orgInfo = getContactOrganization(contact.id);
              const contactTypeList = getContactTypes(contact.id);
              return (
                <Link
                  key={contact.id}
                  to={`/contacts/${contact.id}`}
                  className="block hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all group"
                >
                  <div className="px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 h-12 w-12 rounded-xl shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
                          {contact.photo_url ? (
                            <img src={contact.photo_url} alt={`${contact.first_name} ${contact.last_name}`} className="h-full w-full object-cover" />
                          ) : (
                            <div className={`h-full w-full ${getAvatarColor(contact.first_name)} flex items-center justify-center text-white font-semibold`}>
                              {getInitials(contact.first_name, contact.last_name)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <p className="text-base font-semibold text-gray-900 truncate">
                              {contact.first_name} {contact.last_name}
                            </p>
                            {contact.is_donor && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">
                                <Heart className="w-3 h-3 mr-1" />
                                Donor
                              </span>
                            )}
                            {contact.is_vip && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 border border-purple-200">
                                <Star className="w-3 h-3 mr-1" />
                                VIP
                              </span>
                            )}
                            {contactTypeList.map(ct => (
                              <span
                                key={ct.id}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: ct.color }}
                              >
                                {ct.name}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm text-gray-600 truncate mt-0.5">
                            {contact.title}
                          </p>
                          {orgInfo && (
                            <p className="text-sm text-gray-500 truncate mt-0.5 lg:hidden">
                              {orgInfo.organization?.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-8">
                        <div className="hidden lg:flex items-center space-x-6 text-sm">
                          {orgInfo && (
                            <div className="flex items-center text-gray-600">
                              <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="font-medium">{orgInfo.organization?.name}</span>
                              {orgInfo.role && orgInfo.role !== contact.title && (
                                <span className="ml-2 text-gray-500">• {orgInfo.role}</span>
                              )}
                            </div>
                          )}
                          {contact.email_work && (
                            <div className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {contact.email_work}
                            </div>
                          )}
                          {contact.phone_mobile && (
                            <div className="flex items-center text-gray-600 hover:text-blue-600 transition-colors">
                              <Phone className="w-4 h-4 mr-2 text-gray-400" />
                              {contact.phone_mobile}
                            </div>
                          )}
                          {contact.city && contact.state && (
                            <div className="flex items-center text-gray-600">
                              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                              {contact.city}, {contact.state}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
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
          {filteredContacts.map((contact) => {
            const orgInfo = getContactOrganization(contact.id);
            const contactTypeList = getContactTypes(contact.id);
            return (
              <Link
                key={contact.id}
                to={`/contacts/${contact.id}`}
                className="group relative bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-5 transition-opacity" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-16 w-16 rounded-xl shadow-lg group-hover:scale-110 transition-transform overflow-hidden">
                      {contact.photo_url ? (
                        <img src={contact.photo_url} alt={`${contact.first_name} ${contact.last_name}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`h-full w-full ${getAvatarColor(contact.first_name)} flex items-center justify-center text-white font-semibold text-lg`}>
                          {getInitials(contact.first_name, contact.last_name)}
                        </div>
                      )}
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {contact.first_name} {contact.last_name}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">{contact.title}</p>
                    </div>
                    
                    {orgInfo && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{orgInfo.organization?.name}</span>
                      </div>
                    )}
                    
                    {contact.email_work && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="truncate">{contact.email_work}</span>
                      </div>
                    )}
                    
                    {contact.phone_mobile && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{contact.phone_mobile}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 flex flex-wrap gap-2">
                      {contact.is_donor && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Heart className="w-3 h-3 mr-1" />
                          Donor
                        </span>
                      )}
                      {contact.is_vip && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Star className="w-3 h-3 mr-1" />
                          VIP
                        </span>
                      )}
                      {contactTypeList.map(ct => (
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

export default ContactsList;