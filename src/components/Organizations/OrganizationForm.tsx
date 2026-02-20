import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Save,
  X,
  Plus,
  Building2,
  Phone,
  MapPin,
  Globe,
  DollarSign,
  Tag,
  Users,
  Mail,
  ChevronRight,
  Search,
  ShieldCheck
} from 'lucide-react';
import type { Organization, ContactType, ContactTypeAssignment, Contact } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddContactTypeModal from '../shared/AddContactTypeModal';
import CMSHospitalLookupModal from './CMSHospitalLookupModal';
import { toTitleCase, type CMSHospital } from '../../lib/cms-api';

const OrganizationForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ContactTypeAssignment[]>([]);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showCMSLookup, setShowCMSLookup] = useState(false);
  const [dupWarning, setDupWarning] = useState<{ name: string; id: string } | null>(null);
  const [affiliatedContacts, setAffiliatedContacts] = useState<(Contact & { role?: string; department?: string; is_primary?: boolean })[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    type: '',
    phone: '',
    email: '',
    website: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    is_donor: false,
    notes: '',
    cms_certification_number: '',
    hospital_type: '',
    hospital_ownership: ''
  });

  useEffect(() => {
    fetchContactTypes();
    if (isEditing) {
      fetchOrganization();
      fetchTypeAssignments();
      fetchAffiliatedContacts();
    }
  }, [id]);

  const fetchContactTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_types')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setContactTypes(data || []);
    } catch {
      setContactTypes([
        { id: 'ct-1', name: 'EMS', color: '#EF4444', sort_order: 1, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-2', name: 'Fire', color: '#F97316', sort_order: 2, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-3', name: 'Hospital', color: '#3B82F6', sort_order: 3, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-4', name: 'Association', color: '#8B5CF6', sort_order: 4, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-5', name: 'Government', color: '#6B7280', sort_order: 5, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-6', name: 'Education', color: '#10B981', sort_order: 6, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-7', name: 'Vendor', color: '#F59E0B', sort_order: 7, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'ct-8', name: 'Other', color: '#9CA3AF', sort_order: 8, created_by: 'user-1', created_at: '', updated_at: '' },
      ]);
    }
  };

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTypeAssignments = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('contact_type_assignments')
        .select('*')
        .eq('entity_type', 'organization')
        .eq('entity_id', id);

      if (error) throw error;
      setExistingAssignments(data || []);
      setSelectedTypeIds((data || []).map(a => a.contact_type_id));
    } catch {
      setExistingAssignments([]);
    }
  };

  const fetchAffiliatedContacts = async () => {
    if (!id) return;
    setLoadingContacts(true);
    try {
      const { data: links, error: linkError } = await supabase
        .from('contact_organizations')
        .select('*')
        .eq('organization_id', id);

      if (linkError) throw linkError;
      if (!links || links.length === 0) {
        setAffiliatedContacts([]);
        return;
      }

      const contactIds = links.map(l => l.contact_id);
      const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .in('id', contactIds);

      if (contactError) throw contactError;

      const merged = (contacts || []).map(c => {
        const link = links.find(l => l.contact_id === c.id);
        return { ...c, role: link?.role, department: link?.department, is_primary: link?.is_primary };
      });

      setAffiliatedContacts(merged);
    } catch (err) {
      console.error('Failed to fetch affiliated contacts:', err);
      setAffiliatedContacts([]);
    } finally {
      setLoadingContacts(false);
    }
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

  const handleCMSSelect = async (hospital: CMSHospital) => {
    setDupWarning(null);

    // Check for existing org with same CMS certification number
    try {
      const { data: existing } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('cms_certification_number', hospital.facility_id)
        .maybeSingle();

      if (existing) {
        setDupWarning({ name: existing.name, id: existing.id });
        return;
      }
    } catch {
      // Continue with fill if check fails
    }

    // Auto-fill form
    setFormData(prev => ({
      ...prev,
      name: toTitleCase(hospital.facility_name),
      address_line1: toTitleCase(hospital.address),
      city: toTitleCase(hospital.citytown),
      state: hospital.state,
      zip: hospital.zip_code,
      phone: hospital.telephone_number,
      type: hospital.hospital_type,
      cms_certification_number: hospital.facility_id,
      hospital_type: hospital.hospital_type,
      hospital_ownership: hospital.hospital_ownership,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const userId = user!.id;

      const orgData = {
        ...formData,
        created_by: isEditing ? formData.created_by : userId,
        updated_at: new Date().toISOString()
      };

      let orgId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('organizations')
          .update(orgData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('organizations')
          .insert([{
            ...orgData,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();
        if (error) throw error;
        orgId = data?.id;
      }

      // Sync type assignments
      if (orgId) {
        // Remove deselected assignments
        const toRemove = existingAssignments.filter(
          a => !selectedTypeIds.includes(a.contact_type_id)
        );
        for (const assignment of toRemove) {
          await supabase
            .from('contact_type_assignments')
            .delete()
            .eq('id', assignment.id);
        }

        // Add new assignments
        const existingTypeIds = existingAssignments.map(a => a.contact_type_id);
        const toAdd = selectedTypeIds.filter(typeId => !existingTypeIds.includes(typeId));
        if (toAdd.length > 0) {
          await supabase
            .from('contact_type_assignments')
            .insert(toAdd.map(typeId => ({
              contact_type_id: typeId,
              entity_type: 'organization' as const,
              entity_id: orgId!,
              created_by: userId,
            })));
        }
      }

      navigate('/organizations');
    } catch (err) {
      console.error('Failed to save organization:', err);
      navigate('/organizations');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleType = (typeId: string) => {
    setSelectedTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-2xl gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center">
              <Building2 className="w-7 h-7 sm:w-8 sm:h-8 mr-3" />
              {isEditing ? 'Edit Organization' : 'New Organization'}
            </h1>
            <p className="mt-2 text-emerald-100 text-sm sm:text-base">
              {isEditing ? 'Update organization information' : 'Add a new organization to your CRM'}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCMSLookup(true)}
              className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Search className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Search CMS Hospitals</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/organizations')}
              className="p-3 bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Duplicate Warning */}
        {dupWarning && (
          <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center">
              <Building2 className="w-5 h-5 text-yellow-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  This hospital already exists
                </p>
                <p className="text-sm text-yellow-700">
                  "{dupWarning.name}" is already in your CRM.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link
                to={`/organizations/${dupWarning.id}`}
                className="px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition-colors"
              >
                View It
              </Link>
              <button
                type="button"
                onClick={() => setDupWarning(null)}
                className="p-1 text-yellow-400 hover:text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl mr-3">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Organization Name *</label>
                {formData.cms_certification_number && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    CMS Verified
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
              {formData.hospital_ownership && (
                <p className="text-xs text-gray-500 mt-1">{formData.hospital_type} — {formData.hospital_ownership}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Types */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl mr-3">
                <Tag className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">Contact Types</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowAddTypeModal(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add New Type
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {contactTypes.map(ct => (
              <label
                key={ct.id}
                className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  selectedTypeIds.includes(ct.id)
                    ? 'border-current shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={selectedTypeIds.includes(ct.id) ? { borderColor: ct.color, backgroundColor: ct.color + '10' } : undefined}
              >
                <input
                  type="checkbox"
                  checked={selectedTypeIds.includes(ct.id)}
                  onChange={() => toggleType(ct.id)}
                  className="sr-only"
                />
                <div
                  className="w-4 h-4 rounded-full mr-3 flex-shrink-0"
                  style={{ backgroundColor: ct.color }}
                />
                <span className="text-sm font-medium text-gray-700">{ct.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mr-3">
              <Phone className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Contact Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl mr-3">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Address</h2>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <input
                type="text"
                value={formData.address_line1 || ''}
                onChange={(e) => handleInputChange('address_line1', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                type="text"
                value={formData.address_line2 || ''}
                onChange={(e) => handleInputChange('address_line2', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                <input
                  type="text"
                  value={formData.zip || ''}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Donor Status */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl mr-3">
              <DollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Donor Information</h2>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDonor"
              checked={formData.is_donor || false}
              onChange={(e) => handleInputChange('is_donor', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="isDonor" className="text-sm text-gray-700">
              This organization is a donor
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <label className="block text-xl font-semibold text-gray-800 mb-4">Notes</label>
          <textarea
            rows={4}
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder="Add any additional notes about this organization..."
          />
        </div>

        {/* Affiliated Contacts - Only show if editing */}
        {isEditing && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
            <div className="flex items-center mb-6">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mr-3">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800">
                Affiliated Contacts
                {affiliatedContacts.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({affiliatedContacts.length})
                  </span>
                )}
              </h2>
            </div>

            {loadingContacts ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : affiliatedContacts.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No contacts affiliated with this organization yet.</p>
                <p className="text-gray-400 text-xs mt-1">
                  Add this organization as an affiliation from a contact's edit page.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {affiliatedContacts.map((contact) => (
                  <Link
                    key={contact.id}
                    to={`/contacts/${contact.id}`}
                    className="flex items-center justify-between py-4 px-2 -mx-2 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 h-10 w-10 rounded-xl overflow-hidden shadow group-hover:scale-110 transition-transform">
                        {contact.photo_url ? (
                          <img
                            src={contact.photo_url}
                            alt={`${contact.first_name} ${contact.last_name}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className={`h-full w-full ${getAvatarColor(contact.first_name)} flex items-center justify-center text-white font-semibold text-sm`}>
                            {getInitials(contact.first_name, contact.last_name)}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <div className="flex items-center space-x-3 mt-0.5">
                          {contact.role && (
                            <span className="text-xs text-gray-600">{contact.role}</span>
                          )}
                          {contact.department && (
                            <span className="text-xs text-gray-500">| {contact.department}</span>
                          )}
                          {!contact.role && contact.title && (
                            <span className="text-xs text-gray-600">{contact.title}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="hidden md:flex items-center space-x-4 text-xs text-gray-500">
                        {contact.email_work && (
                          <span className="flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {contact.email_work}
                          </span>
                        )}
                        {(contact.phone_mobile || contact.phone_office) && (
                          <span className="flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {contact.phone_mobile || contact.phone_office}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={() => navigate('/organizations')}
            className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:border-gray-300 hover:shadow-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Update Organization' : 'Create Organization'}
              </>
            )}
          </button>
        </div>
      </form>

      <AddContactTypeModal
        isOpen={showAddTypeModal}
        onClose={() => setShowAddTypeModal(false)}
        onTypeCreated={(newType) => {
          setContactTypes(prev => [...prev, newType]);
          setSelectedTypeIds(prev => [...prev, newType.id]);
        }}
      />

      <CMSHospitalLookupModal
        isOpen={showCMSLookup}
        onClose={() => setShowCMSLookup(false)}
        onSelect={handleCMSSelect}
      />
    </div>
  );
};

export default OrganizationForm;
