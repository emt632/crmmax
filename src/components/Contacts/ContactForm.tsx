import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  X,
  Plus,
  Trash2,
  User,
  Building2,
  Download,
  Sparkles,
  Camera,
  Info,
  Siren,
  Flame,
  Hospital,
  Landmark,
  GraduationCap,
  Package,
  Users,
  Briefcase,
  Tag,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Contact, Organization, ContactOrganization, ContactType, ContactTypeAssignment, SmartCaptureResult } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { contactToVCard, downloadVCard } from '../../lib/vcard';
import { formatPhone } from '../../lib/format-phone';
import AddContactTypeModal from '../shared/AddContactTypeModal';
import SmartCaptureModal from './SmartCaptureModal';
import { uploadContactPhoto, deleteContactPhoto } from '../../lib/photo-upload';

const contactTypeIcons: Record<string, LucideIcon> = {
  ems: Siren,
  fire: Flame,
  hospital: Hospital,
  government: Landmark,
  education: GraduationCap,
  vendor: Package,
  association: Users,
  'industry contact': Briefcase,
};

const getTypeIcon = (name: string): LucideIcon => {
  return contactTypeIcons[name.toLowerCase()] || Tag;
};


const ContactForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, profile } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [contactOrganizations, setContactOrganizations] = useState<ContactOrganization[]>([]);
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<ContactTypeAssignment[]>([]);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [showSmartCapture, setShowSmartCapture] = useState(false);
  const [pendingOrgLink, setPendingOrgLink] = useState<{ organizationId: string; organizationName: string; role?: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
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
    is_vip: false,
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
        if (data.photo_url) {
          setPhotoPreview(data.photo_url);
          setOriginalPhotoUrl(data.photo_url);
        }
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

      // Create pending org link if Smart Capture created/matched an organization
      if (contactId && pendingOrgLink) {
        await supabase
          .from('contact_organizations')
          .insert([{
            contact_id: contactId,
            organization_id: pendingOrgLink.organizationId,
            role: pendingOrgLink.role || null,
            is_primary: true,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        setPendingOrgLink(null);
      }

      // Save pending affiliation from the affiliation form (if user filled it but didn't click "Add Affiliation")
      if (contactId && newAffiliation.organization_id) {
        await supabase
          .from('contact_organizations')
          .insert([{
            contact_id: contactId,
            ...newAffiliation,
            created_by: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        setNewAffiliation({ organization_id: '', role: '', department: '', is_primary: false });
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

      // Handle photo upload/removal
      if (contactId) {
        if (photoFile) {
          try {
            if (originalPhotoUrl) {
              await deleteContactPhoto(originalPhotoUrl);
            }
            const newPhotoUrl = await uploadContactPhoto(contactId, photoFile);
            await supabase
              .from('contacts')
              .update({ photo_url: newPhotoUrl })
              .eq('id', contactId);
          } catch (err) {
            console.error('Photo upload failed:', err);
          }
        } else if (!photoPreview && originalPhotoUrl) {
          try {
            await deleteContactPhoto(originalPhotoUrl);
            await supabase
              .from('contacts')
              .update({ photo_url: null })
              .eq('id', contactId);
          } catch (err) {
            console.error('Photo removal failed:', err);
          }
        }
      }

      navigate('/contacts');
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      setSaveError(err?.message || JSON.stringify(err));
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

  const handleExportVCard = () => {
    const primaryAff = contactOrganizations.find(co => co.is_primary) || contactOrganizations[0];
    let orgName: string | undefined;
    let orgRole: string | undefined;
    if (primaryAff) {
      const org = organizations.find(o => o.id === primaryAff.organization_id);
      orgName = org?.name;
      orgRole = primaryAff.role;
    }
    const vcardString = contactToVCard(formData as Contact, orgName, orgRole);
    const filename = `${formData.first_name || 'contact'}-${formData.last_name || ''}`.toLowerCase().replace(/\s+/g, '-') + '.vcf';
    downloadVCard(vcardString, filename);
  };

  const handleSmartCaptureResult = (result: SmartCaptureResult) => {
    // If contact was saved directly by Smart Capture, navigate to it
    if (result.savedContactId) {
      navigate(`/contacts/${result.savedContactId}`);
      return;
    }

    // Fallback: merge contact data into form (only fill empty fields)
    setFormData(prev => {
      const updated = { ...prev };
      for (const [key, value] of Object.entries(result.contactData)) {
        if (value && !(prev as any)[key]) {
          (updated as any)[key] = value;
        }
      }
      return updated;
    });

    // Store pending org link if an organization was created/matched
    if (result.organizationId) {
      const org = organizations.find(o => o.id === result.organizationId);
      setPendingOrgLink({
        organizationId: result.organizationId,
        organizationName: org?.name || 'Organization',
        role: result.organizationRole
      });
      fetchOrganizations();
    }
  };

  const handlePhotoSelected = (file: File) => {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
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
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-blue-600 rounded-xl p-4 sm:p-5 text-white shadow-sm gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center">
              <User className="w-6 h-6 sm:w-7 sm:h-7 mr-2" />
              {isEditing ? 'Edit Contact' : 'New Contact'}
            </h1>
            <p className="mt-1 text-blue-100 text-sm">
              {isEditing ? 'Update contact information' : 'Add a new contact to your CRM'}
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowSmartCapture(true)}
              className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              <Sparkles className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Smart Capture</span>
            </button>
            {isEditing && !loading && (
              <button
                type="button"
                onClick={handleExportVCard}
                className="inline-flex items-center px-3 py-2.5 sm:px-4 sm:py-2 bg-white/20 border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export vCard</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/contacts')}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Created by metadata */}
        {isEditing && formData.created_at && (
          <div className="flex items-center text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
            <Info className="w-4 h-4 mr-2 text-gray-400" />
            Created by {profile?.full_name || profile?.email || 'Unknown'} on {format(new Date(formData.created_at), 'MMM d, yyyy')}
          </div>
        )}

        {/* Pending Organization Link Banner */}
        {pendingOrgLink && (
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center">
              <Building2 className="w-5 h-5 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-purple-900">
                  Organization will be linked on save
                </p>
                <p className="text-sm text-purple-700">
                  {pendingOrgLink.organizationName}
                  {pendingOrgLink.role && ` — ${pendingOrgLink.role}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingOrgLink(null)}
              className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Basic Info + Contact Types */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {/* Photo + Name row */}
          <div className="flex items-start gap-3 mb-3">
            <div className="relative group flex-shrink-0">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelected(file);
                  e.target.value = '';
                }}
              />
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Contact photo"
                  className="h-14 w-14 rounded-lg object-cover shadow cursor-pointer"
                  onClick={() => photoInputRef.current?.click()}
                />
              ) : (
                <div
                  className="h-14 w-14 rounded-lg bg-blue-50 flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="w-5 h-5 text-blue-400" />
                </div>
              )}
              <div
                className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 text-white" />
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full shadow hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          {/* Contact Types */}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Types</span>
              <button
                type="button"
                onClick={() => setShowAddTypeModal(true)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              >
                <Plus className="w-3 h-3 mr-0.5" />
                Add Type
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {contactTypes.map(ct => {
                const TypeIcon = getTypeIcon(ct.name);
                return (
                  <label
                    key={ct.id}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full border cursor-pointer transition-all text-xs font-medium ${
                      selectedTypeIds.includes(ct.id)
                        ? 'shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    style={selectedTypeIds.includes(ct.id) ? { borderColor: ct.color, backgroundColor: ct.color + '15', color: ct.color } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypeIds.includes(ct.id)}
                      onChange={() => toggleType(ct.id)}
                      className="sr-only"
                    />
                    <TypeIcon
                      className="w-3 h-3 mr-1.5 flex-shrink-0"
                      style={{ color: selectedTypeIds.includes(ct.id) ? ct.color : undefined }}
                    />
                    {ct.name}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contact Info + Address */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Work Email</label>
              <input
                type="email"
                value={formData.email_work || ''}
                onChange={(e) => handleInputChange('email_work', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Personal Email</label>
              <input
                type="email"
                value={formData.email_personal || ''}
                onChange={(e) => handleInputChange('email_personal', e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Mobile</label>
              <input
                type="tel"
                value={formatPhone(formData.phone_mobile || '')}
                onChange={(e) => handleInputChange('phone_mobile', formatPhone(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Office</label>
              <input
                type="tel"
                value={formatPhone(formData.phone_office || '')}
                onChange={(e) => handleInputChange('phone_office', formatPhone(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Home</label>
              <input
                type="tel"
                value={formatPhone(formData.phone_home || '')}
                onChange={(e) => handleInputChange('phone_home', formatPhone(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Address */}
          <div className="border-t border-gray-100 pt-3">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Address</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Address Line 1</label>
                <input
                  type="text"
                  value={formData.address_line1 || ''}
                  onChange={(e) => handleInputChange('address_line1', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">Address Line 2</label>
                <input
                  type="text"
                  value={formData.address_line2 || ''}
                  onChange={(e) => handleInputChange('address_line2', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">City</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">State</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-0.5">ZIP</label>
                <input
                  type="text"
                  value={formData.zip || ''}
                  onChange={(e) => handleInputChange('zip', e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Organization Affiliations - Only show if editing */}
        {isEditing && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Building2 className="w-4 h-4 mr-1.5 text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">Organization Affiliations</span>
              </div>
            </div>

            {contactOrganizations.length > 0 && (
              <div className="space-y-2 mb-3">
                {contactOrganizations.map((aff) => (
                  <div key={aff.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-gray-900">{getOrganizationName(aff.organization_id)}</span>
                      {aff.role && <span className="text-gray-500 ml-2">{aff.role}</span>}
                      {aff.department && <span className="text-gray-400 ml-2">{aff.department}</span>}
                      {aff.is_primary && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">Primary</span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeAffiliation(aff.id)} className="p-1 hover:bg-gray-200 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <select
                  value={newAffiliation.organization_id}
                  onChange={(e) => setNewAffiliation({...newAffiliation, organization_id: e.target.value})}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
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
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Department"
                  value={newAffiliation.department}
                  onChange={(e) => setNewAffiliation({...newAffiliation, department: e.target.value})}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={newAffiliation.is_primary}
                      onChange={(e) => setNewAffiliation({...newAffiliation, is_primary: e.target.checked})}
                      className="mr-1"
                    />
                    Primary
                  </label>
                  <button
                    type="button"
                    onClick={addAffiliation}
                    className="inline-flex items-center px-2.5 py-1.5 border border-blue-600 text-xs font-medium rounded-md text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3 mr-0.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Donor + Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-3">
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_donor || false}
                onChange={(e) => handleInputChange('is_donor', e.target.checked)}
                className="mr-2"
              />
              Donor
            </label>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.is_vip || false}
                onChange={(e) => handleInputChange('is_vip', e.target.checked)}
                className="mr-2"
              />
              VIP
            </label>
          </div>
          <textarea
            rows={2}
            value={formData.notes || ''}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm"
            placeholder="Notes..."
          />
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700 font-medium">Save failed:</p>
            <p className="text-sm text-red-600 mt-1">{saveError}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/contacts')}
            className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
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

      <SmartCaptureModal
        isOpen={showSmartCapture}
        onClose={() => setShowSmartCapture(false)}
        onResult={handleSmartCaptureResult}
        existingOrganizations={organizations}
        userId={user?.id || ''}
      />
    </div>
  );
};

export default ContactForm;