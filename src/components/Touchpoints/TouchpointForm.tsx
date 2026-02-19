import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Save,
  X,
  Phone,
  Mail,
  Video,
  Users as UsersIcon,
  MessageSquare,
  Calendar,
  Clock,
  AlertCircle,
  User,
  Building2
} from 'lucide-react';
import type { Touchpoint, TouchpointType, Contact, Organization } from '../../types';
import { supabase } from '../../lib/supabase';

const TOUCHPOINT_TYPES: { value: TouchpointType; label: string; icon: React.FC<any> }[] = [
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'in-person', label: 'In Person', icon: UsersIcon },
  { value: 'virtual', label: 'Virtual Meeting', icon: Video },
  { value: 'other', label: 'Other', icon: MessageSquare },
];

const TouchpointForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [formData, setFormData] = useState<Partial<Touchpoint>>({
    type: 'phone',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: undefined,
    subject: '',
    notes: '',
    contact_id: undefined,
    organization_id: undefined,
    follow_up_required: false,
    follow_up_date: undefined,
    follow_up_notes: '',
    follow_up_completed: false,
  });

  useEffect(() => {
    fetchContacts();
    fetchOrganizations();
    if (isEditing) {
      fetchTouchpoint();
    }
  }, [id]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('last_name');

      if (error) throw error;
      setContacts(data || []);
    } catch {
      setContacts([
        { id: '1', first_name: 'Sarah', last_name: 'Mitchell', is_donor: true, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '2', first_name: 'John', last_name: 'Anderson', is_donor: false, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '3', first_name: 'Emily', last_name: 'Johnson', is_donor: true, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '4', first_name: 'Michael', last_name: 'Brown', is_donor: false, created_by: 'user-1', created_at: '', updated_at: '' },
      ]);
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
    } catch {
      setOrganizations([
        { id: 'org-1', name: 'Mayo Clinic', is_donor: true, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'org-2', name: 'Sanford Health', is_donor: false, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: 'org-3', name: 'Minneapolis Fire Department', is_donor: false, created_by: 'user-1', created_at: '', updated_at: '' },
      ]);
    }
  };

  const fetchTouchpoint = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('touchpoints')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          ...data,
          date: data.date ? format(new Date(data.date), "yyyy-MM-dd'T'HH:mm") : '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch touchpoint:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const currentUser = await supabase.auth.getUser();
      const userId = currentUser.data.user?.id || 'user-1';

      const touchpointData = {
        ...formData,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        contact_id: formData.contact_id || null,
        organization_id: formData.organization_id || null,
        duration: formData.duration || null,
        follow_up_date: formData.follow_up_required ? formData.follow_up_date || null : null,
        follow_up_notes: formData.follow_up_required ? formData.follow_up_notes || null : null,
        follow_up_completed: formData.follow_up_required ? formData.follow_up_completed || false : false,
        created_by: isEditing ? formData.created_by : userId,
        updated_at: new Date().toISOString(),
      };

      // Remove joined fields
      delete (touchpointData as any).contact_name;
      delete (touchpointData as any).organization_name;

      if (isEditing) {
        const { error } = await supabase
          .from('touchpoints')
          .update(touchpointData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('touchpoints')
          .insert([{
            ...touchpointData,
            created_at: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      navigate('/touchpoints');
    } catch (err) {
      console.error('Failed to save touchpoint:', err);
      navigate('/touchpoints');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Phone className="w-8 h-8 mr-3" />
              {isEditing ? 'Edit Touchpoint' : 'Log Touchpoint'}
            </h1>
            <p className="mt-2 text-purple-100">
              {isEditing ? 'Update touchpoint details' : 'Record a new interaction'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/touchpoints')}
            className="p-3 bg-white/20 backdrop-blur hover:bg-white/30 rounded-xl transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Details */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mr-3">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
              >
                {TOUCHPOINT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="datetime-local"
                  required
                  value={formData.date || ''}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={formData.duration || ''}
                  onChange={(e) => handleInputChange('duration', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="30"
                  min="1"
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input
                type="text"
                required
                value={formData.subject || ''}
                onChange={(e) => handleInputChange('subject', e.target.value)}
                placeholder="Brief description of the interaction"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Linked Entities */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl mr-3">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Linked Entities</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Link this touchpoint to at least one contact or organization.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Contact
              </label>
              <select
                value={formData.contact_id || ''}
                onChange={(e) => handleInputChange('contact_id', e.target.value || undefined)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
              >
                <option value="">Select a contact...</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building2 className="w-4 h-4 inline mr-1" />
                Organization
              </label>
              <select
                value={formData.organization_id || ''}
                onChange={(e) => handleInputChange('organization_id', e.target.value || undefined)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
              >
                <option value="">Select an organization...</option>
                {organizations.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <label className="block text-xl font-semibold text-gray-800 mb-4">Notes</label>
          <textarea
            rows={4}
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Detailed notes about the interaction..."
          />
        </div>

        {/* Follow-Up */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl mr-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Follow-Up</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="followUpRequired"
                checked={formData.follow_up_required || false}
                onChange={(e) => handleInputChange('follow_up_required', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="followUpRequired" className="text-sm text-gray-700">
                Follow-up required
              </label>
            </div>

            {formData.follow_up_required && (
              <div className="pl-6 space-y-4 border-l-2 border-amber-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.follow_up_date || ''}
                      onChange={(e) => handleInputChange('follow_up_date', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="followUpCompleted"
                        checked={formData.follow_up_completed || false}
                        onChange={(e) => handleInputChange('follow_up_completed', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="followUpCompleted" className="text-sm text-gray-700">
                        Mark as completed
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Notes</label>
                  <textarea
                    rows={2}
                    value={formData.follow_up_notes || ''}
                    onChange={(e) => handleInputChange('follow_up_notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="What needs to be followed up on..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={() => navigate('/touchpoints')}
            className="px-8 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:border-gray-300 hover:shadow-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Update Touchpoint' : 'Log Touchpoint'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TouchpointForm;
