import React, { useState, useEffect, useMemo } from 'react';
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
  Building2,
  Plus
} from 'lucide-react';
import type { Touchpoint, TouchpointType, Contact, Organization, UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const TOUCHPOINT_TYPES: { value: TouchpointType; label: string; icon: React.FC<any> }[] = [
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'in-person', label: 'In Person', icon: UsersIcon },
  { value: 'virtual', label: 'Virtual Meeting', icon: Video },
  { value: 'other', label: 'Other', icon: MessageSquare },
];

// A participant is a contact paired with their org affiliation (if any)
interface Participant {
  contactId: string;
  organizationId: string | null;
}

const TouchpointForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, isAdmin, isManager, subordinateIds } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [affiliations, setAffiliations] = useState<{ contact_id: string; organization_id: string }[]>([]);

  // Participant state (contact + org paired together)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantDropdownValue, setParticipantDropdownValue] = useState('');

  // Standalone orgs (org without a specific contact)
  const [standaloneOrgIds, setStandaloneOrgIds] = useState<string[]>([]);
  const [orgDropdownValue, setOrgDropdownValue] = useState('');

  // Assignable users for follow-up delegation
  const [assignableUsers, setAssignableUsers] = useState<Pick<UserProfile, 'id' | 'full_name' | 'email'>[]>([]);

  const [formData, setFormData] = useState<Partial<Touchpoint>>({
    type: 'phone',
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    duration: undefined,
    subject: '',
    notes: '',
    follow_up_required: false,
    follow_up_date: undefined,
    follow_up_notes: '',
    follow_up_completed: false,
    assigned_to: undefined,
  });

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchContacts(), fetchOrganizations(), fetchAffiliations(), fetchAssignableUsers()]);
      if (isEditing) {
        await fetchTouchpoint();
      }
    };
    init();
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
        { id: '1', first_name: 'Sarah', last_name: 'Mitchell', is_donor: true, is_vip: true, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '2', first_name: 'John', last_name: 'Anderson', is_donor: false, is_vip: false, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '3', first_name: 'Emily', last_name: 'Johnson', is_donor: true, is_vip: false, created_by: 'user-1', created_at: '', updated_at: '' },
        { id: '4', first_name: 'Michael', last_name: 'Brown', is_donor: false, is_vip: true, created_by: 'user-1', created_at: '', updated_at: '' },
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

  const fetchAffiliations = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_organizations')
        .select('contact_id, organization_id');
      if (error) throw error;
      setAffiliations(data || []);
    } catch {
      setAffiliations([]);
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      if (!isAdmin && !isManager) {
        setAssignableUsers([]);
        return;
      }

      let query = supabase
        .from('users')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (!isAdmin && isManager) {
        query = query.in('id', [user!.id, ...subordinateIds]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAssignableUsers((data || []).filter(u => u.id !== user!.id));
    } catch {
      setAssignableUsers([]);
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

        // Fetch junction data
        const [tcRes, toRes] = await Promise.all([
          supabase.from('touchpoint_contacts').select('contact_id').eq('touchpoint_id', id),
          supabase.from('touchpoint_organizations').select('organization_id').eq('touchpoint_id', id),
        ]);

        const linkedCIds = (tcRes.data || []).map((r: any) => r.contact_id);
        const linkedOIds = (toRes.data || []).map((r: any) => r.organization_id);

        // Fetch affiliations for the linked contacts to reconstruct pairings
        let affData: { contact_id: string; organization_id: string }[] = [];
        if (linkedCIds.length > 0) {
          const { data: aData } = await supabase
            .from('contact_organizations')
            .select('contact_id, organization_id')
            .in('contact_id', linkedCIds);
          affData = aData || [];
        }

        // Reconstruct participants: pair each contact with an org if the org is also linked
        const usedOrgIds = new Set<string>();
        const rebuilt: Participant[] = linkedCIds.map((cId: string) => {
          const contactAffs = affData.filter(a => a.contact_id === cId);
          const match = contactAffs.find(a => linkedOIds.includes(a.organization_id));
          if (match) {
            usedOrgIds.add(match.organization_id);
            return { contactId: cId, organizationId: match.organization_id };
          }
          return { contactId: cId, organizationId: null };
        });

        setParticipants(rebuilt);
        setStandaloneOrgIds(linkedOIds.filter((oId: string) => !usedOrgIds.has(oId)));
      }
    } catch (err) {
      console.error('Failed to fetch touchpoint:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build dropdown options: each contact shown with their org affiliation(s)
  const participantOptions = useMemo(() => {
    return contacts.flatMap(contact => {
      const contactAffs = affiliations.filter(a => a.contact_id === contact.id);
      const name = `${contact.first_name} ${contact.last_name}`;

      if (contactAffs.length === 0) {
        return [{ value: `${contact.id}|`, contactId: contact.id, organizationId: null as string | null, label: name }];
      }

      return contactAffs.map(aff => {
        const org = organizations.find(o => o.id === aff.organization_id);
        return {
          value: `${contact.id}|${aff.organization_id}`,
          contactId: contact.id,
          organizationId: aff.organization_id as string | null,
          label: org ? `${name}, ${org.name}` : name,
        };
      });
    });
  }, [contacts, organizations, affiliations]);

  // Filter out already-selected participants
  const availableParticipants = participantOptions.filter(opt =>
    !participants.some(p => p.contactId === opt.contactId && p.organizationId === opt.organizationId)
  );

  // Orgs already covered by participants
  const participantOrgIds = new Set(participants.map(p => p.organizationId).filter(Boolean) as string[]);
  const availableStandaloneOrgs = organizations.filter(o =>
    !standaloneOrgIds.includes(o.id) && !participantOrgIds.has(o.id)
  );

  const addParticipant = () => {
    if (!participantDropdownValue) return;
    const [contactId, orgId] = participantDropdownValue.split('|');
    const newP: Participant = { contactId, organizationId: orgId || null };
    if (!participants.some(p => p.contactId === newP.contactId && p.organizationId === newP.organizationId)) {
      setParticipants(prev => [...prev, newP]);
    }
    setParticipantDropdownValue('');
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const addStandaloneOrg = () => {
    if (orgDropdownValue && !standaloneOrgIds.includes(orgDropdownValue)) {
      setStandaloneOrgIds(prev => [...prev, orgDropdownValue]);
      setOrgDropdownValue('');
    }
  };

  const removeStandaloneOrg = (orgId: string) => {
    setStandaloneOrgIds(prev => prev.filter(id => id !== orgId));
  };

  const getParticipantLabel = (p: Participant) => {
    const contact = contacts.find(c => c.id === p.contactId);
    if (!contact) return 'Unknown';
    const name = `${contact.first_name} ${contact.last_name}`;
    if (p.organizationId) {
      const org = organizations.find(o => o.id === p.organizationId);
      return org ? `${name}, ${org.name}` : name;
    }
    return name;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (participants.length === 0 && standaloneOrgIds.length === 0) {
      alert('Please add at least one participant or organization.');
      return;
    }

    setSaving(true);

    try {
      const userId = user!.id;

      const touchpointData: Record<string, any> = {
        type: formData.type,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
        duration: formData.duration || null,
        subject: formData.subject,
        notes: formData.notes || null,
        follow_up_required: formData.follow_up_required || false,
        follow_up_date: formData.follow_up_required ? formData.follow_up_date || null : null,
        follow_up_notes: formData.follow_up_required ? formData.follow_up_notes || null : null,
        follow_up_completed: formData.follow_up_required ? formData.follow_up_completed || false : false,
        assigned_to: formData.follow_up_required ? formData.assigned_to || null : null,
        updated_at: new Date().toISOString(),
      };

      let touchpointId = id;

      if (isEditing) {
        const { error } = await supabase
          .from('touchpoints')
          .update(touchpointData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('touchpoints')
          .insert([{
            ...touchpointData,
            created_by: userId,
            created_at: new Date().toISOString(),
          }])
          .select('id')
          .single();
        if (error) throw error;
        touchpointId = inserted.id;
      }

      // Derive unique contact IDs and org IDs from participants + standalone
      const contactIds = [...new Set(participants.map(p => p.contactId))];
      const orgIdsFromParticipants = participants.map(p => p.organizationId).filter(Boolean) as string[];
      const allOrgIds = [...new Set([...orgIdsFromParticipants, ...standaloneOrgIds])];

      // Delete-all + re-insert junction rows for contacts
      await supabase
        .from('touchpoint_contacts')
        .delete()
        .eq('touchpoint_id', touchpointId!);

      if (contactIds.length > 0) {
        const { error: tcError } = await supabase
          .from('touchpoint_contacts')
          .insert(contactIds.map(cId => ({
            touchpoint_id: touchpointId!,
            contact_id: cId,
            created_by: userId,
          })));
        if (tcError) throw tcError;
      }

      // Delete-all + re-insert junction rows for organizations
      await supabase
        .from('touchpoint_organizations')
        .delete()
        .eq('touchpoint_id', touchpointId!);

      if (allOrgIds.length > 0) {
        const { error: toError } = await supabase
          .from('touchpoint_organizations')
          .insert(allOrgIds.map(oId => ({
            touchpoint_id: touchpointId!,
            organization_id: oId,
            created_by: userId,
          })));
        if (toError) throw toError;
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
        <div className="flex items-center justify-between bg-purple-600 rounded-xl p-8 text-white shadow-sm">
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
            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Context bar */}
        {(participants.length > 0 || standaloneOrgIds.length > 0) && (
          <div className="flex items-center flex-wrap gap-4 bg-gray-50 rounded-lg px-5 py-3 border border-gray-200">
            {participants.map((p, i) => (
              <div key={i} className="flex items-center text-sm text-gray-700">
                <User className="w-4 h-4 mr-2 text-blue-600" />
                <span className="font-medium">{getParticipantLabel(p)}</span>
              </div>
            ))}
            {standaloneOrgIds.map(oId => {
              const org = organizations.find(o => o.id === oId);
              return org ? (
                <div key={oId} className="flex items-center text-sm text-gray-700">
                  <Building2 className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="font-medium">{org.name}</span>
                </div>
              ) : null;
            })}
          </div>
        )}

        {/* Linked Entities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-blue-50 rounded-lg mr-3">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">Participants</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Add contacts involved in this touchpoint. Their organization affiliation is shown automatically.</p>

          {/* Participant picker */}
          <div className="flex gap-2">
            <select
              value={participantDropdownValue}
              onChange={(e) => setParticipantDropdownValue(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
            >
              <option value="">Select a contact...</option>
              {availableParticipants.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addParticipant}
              disabled={!participantDropdownValue}
              className="px-3 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Participant chips */}
          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {participants.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-800 text-sm font-medium rounded-lg border border-blue-200"
                >
                  {getParticipantLabel(p)}
                  <button
                    type="button"
                    onClick={() => removeParticipant(i)}
                    className="ml-1 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Standalone org picker */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="w-4 h-4 inline mr-1" />
              Additional Organizations <span className="font-normal text-gray-400">(without a specific contact)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={orgDropdownValue}
                onChange={(e) => setOrgDropdownValue(e.target.value)}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all"
              >
                <option value="">Select an organization...</option>
                {availableStandaloneOrgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addStandaloneOrg}
                disabled={!orgDropdownValue}
                className="px-3 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {standaloneOrgIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {standaloneOrgIds.map(oId => {
                  const org = organizations.find(o => o.id === oId);
                  return org ? (
                    <span
                      key={oId}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-800 text-sm font-medium rounded-lg border border-emerald-200"
                    >
                      {org.name}
                      <button
                        type="button"
                        onClick={() => removeStandaloneOrg(oId)}
                        className="ml-1 hover:text-red-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-purple-50 rounded-lg mr-3">
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

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-amber-50 rounded-lg mr-3">
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
                <div className={`grid grid-cols-1 ${assignableUsers.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                    <input
                      type="date"
                      value={formData.follow_up_date || ''}
                      onChange={(e) => handleInputChange('follow_up_date', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all"
                    />
                  </div>
                  {assignableUsers.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                      <select
                        value={formData.assigned_to || ''}
                        onChange={(e) => handleInputChange('assigned_to', e.target.value || undefined)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-500 transition-all"
                      >
                        <option value="">Me (default)</option>
                        {assignableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                        ))}
                      </select>
                    </div>
                  )}
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
            className="px-8 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
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
