import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Plus,
  Building2,
  Phone,
  MapPin,
  Globe,
  DollarSign,
  Tag
} from 'lucide-react';
import type { Organization, ContactType, ContactTypeAssignment } from '../../types';
import { supabase } from '../../lib/supabase';
import AddContactTypeModal from '../shared/AddContactTypeModal';

const OrganizationForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ContactTypeAssignment[]>([]);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);

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
    notes: ''
  });

  useEffect(() => {
    fetchContactTypes();
    if (isEditing) {
      fetchOrganization();
      fetchTypeAssignments();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const currentUser = await supabase.auth.getUser();
      const userId = currentUser.data.user?.id || 'user-1';

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
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 text-white shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Building2 className="w-8 h-8 mr-3" />
              {isEditing ? 'Edit Organization' : 'New Organization'}
            </h1>
            <p className="mt-2 text-emerald-100">
              {isEditing ? 'Update organization information' : 'Add a new organization to your CRM'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/organizations')}
            className="p-3 bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 transition-all duration-200 hover:border-gray-300"
              />
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
    </div>
  );
};

export default OrganizationForm;
