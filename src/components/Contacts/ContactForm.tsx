import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Plus,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  DollarSign,
  Tag
} from 'lucide-react';
import type { Contact, Organization, ContactOrganization, ContactType, ContactTypeAssignment } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import AddContactTypeModal from '../shared/AddContactTypeModal';

const ContactForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contactOrganizations, setContactOrganizations] = useState<ContactOrganization[]>([]);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ContactTypeAssignment[]>([]);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Contact>>({
    first_name: '',
    last_name: '',
    title: '',
    email_work: '',
    email_personal: '',
    phone_mobile: '',
    phone_office: '',
    phone_home: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
    is_donor: false,
    notes: ''
  });

  const [newAffiliation, setNewAffiliation] = useState({
    organization_id: '',
    role: '',
    department: '',
    is_primary: false
  });

  useEffect(() => {
    fetchOrganizations();
    fetchContactTypes();
    if (isEditing) {
      fetchContact();
      fetchContactOrganizations();
      fetchTypeAssignments();
    }
  }, [id]);

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

  const fetchTypeAssignments = async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('contact_type_assignments')
        .select('*')
        .eq('entity_type', 'contact')
        .eq('entity_id', id);

      if (error) throw error;
      setExistingAssignments(data || []);
      setSelectedTypeIds((data || []).map(a => a.contact_type_id));
    } catch {
      setExistingAssignments([]);
    }
  };

  const toggleType = (typeId: string) => {
    setSelectedTypeIds(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const fetchContact = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (err) {
      console.error('Failed to fetch contact:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContactOrganizations = async () => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('contact_organizations')
        .select('*')
        .eq('contact_id', id);

      if (error) throw error;
      setContactOrganizations(data || []);
    } catch (err) {
      console.error('Failed to fetch contact organizations:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const userId = user!.id;

      const contactData = {
        ...formData,
        created_by: isEditing ? formData.created_by : userId,
        updated_at: new Date().toISOString()
      };

      let contactId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert([{
            ...contactData,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        contactId = data?.id;
      }

      // Sync type assignments
      if (contactId) {
        const toRemove = existingAssignments.filter(
          a => !selectedTypeIds.includes(a.contact_type_id)
        );
        for (const assignment of toRemove) {
          await supabase
            .from('contact_type_assignments')
            .delete()
            .eq('id', assignment.id);
        }

        const existingTypeIds = existingAssignments.map(a => a.contact_type_id);
        const toAdd = selectedTypeIds.filter(typeId => !existingTypeIds.includes(typeId));
        if (toAdd.length > 0) {
          await supabase
            .from('contact_type_assignments')
            .insert(toAdd.map(typeId => ({
              contact_type_id: typeId,
              entity_type: 'contact' as const,
              entity_id: contactId!,
              created_by: userId,
            })));
        }
      }

      navigate('/contacts');
    } catch (err) {
      console.error('Failed to save contact:', err);
      // In case of error, still navigate (for demo purposes)
      navigate('/contacts');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addAffiliation = async () => {
    if (!id || !newAffiliation.organization_id) return;

    try {
      const userId = user!.id;

      const { error } = await supabase
        .from('contact_organizations')
        .insert([{
          contact_id: id,
          ...newAffiliation,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Refresh affiliations
      fetchContactOrganizations();
      
      // Reset form
      setNewAffiliation({
        organization_id: '',
        role: '',
        department: '',
        is_primary: false
      });
    } catch (err) {
      console.error('Failed to add affiliation:', err);
    }
  };

  const removeAffiliation = async (affiliationId: string) => {
    try {
      const { error } = await supabase
        .from('contact_organizations')
        .delete()
        .eq('id', affiliationId);

      if (error) throw error;
      
      // Refresh affiliations
      fetchContactOrganizations();
    } catch (err) {
      console.error('Failed to remove affiliation:', err);
    }
  };

  const getOrganizationName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown Organization';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <User className="w-8 h-8 mr-3" />
              {isEditing ? 'Edit Contact' : 'New Contact'}
            </h1>
            <p className="mt-2 text-blue-100">
              {isEditing ? 'Update contact information' : 'Add a new contact to your CRM'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="p-3 bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Basic Information */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mr-3">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Basic Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
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
          
          {/* Emails */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Mail className="w-4 h-4 mr-1" />
              Email Addresses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Work Email</label>
                <input
                  type="email"
                  value={formData.email_work || ''}
                  onChange={(e) => handleInputChange('email_work', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={formData.email_personal || ''}
                  onChange={(e) => handleInputChange('email_personal', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Phones */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 flex items-center">
              <Phone className="w-4 h-4 mr-1" />
              Phone Numbers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Mobile</label>
                <input
                  type="tel"
                  value={formData.phone_mobile || ''}
                  onChange={(e) => handleInputChange('phone_mobile', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Office</label>
                <input
                  type="tel"
                  value={formData.phone_office || ''}
                  onChange={(e) => handleInputChange('phone_office', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Home</label>
                <input
                  type="tel"
                  value={formData.phone_home || ''}
                  onChange={(e) => handleInputChange('phone_home', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.address_line1 || ''}
                onChange={(e) => handleInputChange('address_line1', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.address_line2 || ''}
                onChange={(e) => handleInputChange('address_line2', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={formData.zip || ''}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Organization Affiliations - Only show if editing */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-gray-500" />
                <h2 className="text-lg font-medium">Organization Affiliations</h2>
              </div>
            </div>

            {/* Existing affiliations */}
            {contactOrganizations.length > 0 && (
              <div className="space-y-3 mb-4">
                {contactOrganizations.map((aff) => (
                  <div key={aff.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getOrganizationName(aff.organization_id)}</p>
                      {aff.role && <p className="text-sm text-gray-600">{aff.role}</p>}
                      {aff.department && <p className="text-sm text-gray-500">{aff.department}</p>}
                      {aff.is_primary && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAffiliation(aff.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new affiliation */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Add Affiliation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={newAffiliation.organization_id}
                  onChange={(e) => setNewAffiliation({...newAffiliation, organization_id: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Organization</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Role/Title"
                  value={newAffiliation.role}
                  onChange={(e) => setNewAffiliation({...newAffiliation, role: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Department"
                  value={newAffiliation.department}
                  onChange={(e) => setNewAffiliation({...newAffiliation, department: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={newAffiliation.is_primary}
                    onChange={(e) => setNewAffiliation({...newAffiliation, is_primary: e.target.checked})}
                    className="mr-2"
                  />
                  <label htmlFor="isPrimary" className="text-sm text-gray-700">Primary Organization</label>
                </div>
              </div>
              <button
                type="button"
                onClick={addAffiliation}
                className="mt-3 inline-flex items-center px-3 py-1.5 border border-blue-600 text-sm font-medium rounded-lg text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Affiliation
              </button>
            </div>
          </div>
        )}

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
              This contact is a donor
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <label className="block text-xl font-semibold text-gray-800 mb-4">
            Notes
          </label>
          <textarea
            rows={4}
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any additional notes about this contact..."
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:border-gray-300 hover:shadow-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Update Contact' : 'Create Contact'}
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
    </div>
  );
};

export default ContactForm;