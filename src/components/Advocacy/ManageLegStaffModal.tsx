import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Plus, Edit2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LegislativeOfficeStaff, LegiscanLegislator, LegislativeOffice } from '../../types';

interface ManageLegStaffModalProps {
  legislators: LegiscanLegislator[];
  userId: string;
  onClose: () => void;
}

type StaffWithOffice = LegislativeOfficeStaff;

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-0.5';

const ManageLegStaffModal: React.FC<ManageLegStaffModalProps> = ({
  legislators,
  userId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<LegislativeOffice[]>([]);
  const [staffByOffice, setStaffByOffice] = useState<Record<string, StaffWithOffice[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' });
  const [addingForOffice, setAddingForOffice] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const peopleIds = legislators.map(l => l.people_id);

    // Get offices for these legislators
    const { data: officeData } = await supabase
      .from('legislative_offices')
      .select('*')
      .in('legislator_people_id', peopleIds);

    const loadedOffices = (officeData || []) as LegislativeOffice[];
    setOffices(loadedOffices);

    if (loadedOffices.length === 0) {
      // Auto-create offices for legislators that don't have one
      const newOffices: LegislativeOffice[] = [];
      for (const leg of legislators) {
        const chamber = (leg.chamber || '').toLowerCase();
        let name = leg.name;
        if (chamber === 'senate' || chamber === 'sen') name = `Senator ${leg.name}`;
        else if (chamber === 'house' || chamber === 'assembly' || chamber === 'rep') name = `Representative ${leg.name}`;

        const { data: created } = await supabase
          .from('legislative_offices')
          .insert({
            office_type: 'legislator',
            name,
            state: leg.state || null,
            chamber: leg.chamber?.toLowerCase() || null,
            district: leg.district || null,
            legislator_people_id: leg.people_id,
            created_by: userId,
          })
          .select('*')
          .single();

        if (created) newOffices.push(created as LegislativeOffice);
      }
      loadedOffices.push(...newOffices);
      setOffices([...loadedOffices]);
    }

    // Load all staff for these offices
    if (loadedOffices.length > 0) {
      const officeIds = loadedOffices.map(o => o.id);
      const { data: staffData } = await supabase
        .from('legislative_office_staff')
        .select('*')
        .in('office_id', officeIds)
        .order('last_name');

      const byOffice: Record<string, StaffWithOffice[]> = {};
      for (const office of loadedOffices) byOffice[office.id] = [];
      for (const s of (staffData || []) as StaffWithOffice[]) {
        if (byOffice[s.office_id]) byOffice[s.office_id].push(s);
      }
      setStaffByOffice(byOffice);
    }

    setLoading(false);
  };

  const getLegislatorForOffice = (office: LegislativeOffice): LegiscanLegislator | undefined => {
    return legislators.find(l => l.people_id === office.legislator_people_id);
  };

  const formatOfficeName = (office: LegislativeOffice): string => {
    const leg = getLegislatorForOffice(office);
    if (leg) {
      const c = (leg.chamber || '').toLowerCase();
      const party = leg.party ? ` (${leg.party})` : '';
      if (c === 'senate' || c === 'sen') return `Senator ${leg.name}${party}`;
      if (c === 'house' || c === 'assembly' || c === 'rep') return `Representative ${leg.name}${party}`;
      return `${leg.name}${party}`;
    }
    return office.name;
  };

  // ─── Edit ─────────────────────────────────────────────────
  const startEdit = (s: StaffWithOffice) => {
    setEditingId(s.id);
    setEditForm({
      first_name: s.first_name,
      last_name: s.last_name,
      title: s.title || '',
      email: s.email || '',
      phone: s.phone || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.first_name.trim() || !editForm.last_name.trim()) return;
    setSaving(true);

    const { error } = await supabase
      .from('legislative_office_staff')
      .update({
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        title: editForm.title.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
      })
      .eq('id', editingId);

    if (!error) {
      setStaffByOffice(prev => {
        const updated = { ...prev };
        for (const officeId of Object.keys(updated)) {
          updated[officeId] = updated[officeId].map(s =>
            s.id === editingId
              ? { ...s, first_name: editForm.first_name.trim(), last_name: editForm.last_name.trim(), title: editForm.title.trim() || undefined, email: editForm.email.trim() || undefined, phone: editForm.phone.trim() || undefined }
              : s
          );
        }
        return updated;
      });
      setEditingId(null);
    }
    setSaving(false);
  };

  // ─── Add ──────────────────────────────────────────────────
  const saveAdd = async (officeId: string) => {
    if (!addForm.first_name.trim() || !addForm.last_name.trim()) return;
    setSaving(true);

    const { data: staff, error } = await supabase
      .from('legislative_office_staff')
      .insert({
        office_id: officeId,
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        title: addForm.title.trim() || null,
        email: addForm.email.trim() || null,
        phone: addForm.phone.trim() || null,
        created_by: userId,
      })
      .select('*')
      .single();

    if (!error && staff) {
      setStaffByOffice(prev => ({
        ...prev,
        [officeId]: [...(prev[officeId] || []), staff as StaffWithOffice],
      }));
      setAddingForOffice(null);
      setAddForm({ first_name: '', last_name: '', title: '', email: '', phone: '' });
    }
    setSaving(false);
  };

  // ─── Deactivate (soft delete) ─────────────────────────────
  const toggleActive = async (staffId: string, officeId: string, currentlyActive: boolean) => {
    const action = currentlyActive ? 'Deactivate' : 'Reactivate';
    if (!confirm(`${action} this staff member?`)) return;

    const { error } = await supabase
      .from('legislative_office_staff')
      .update({ is_active: !currentlyActive })
      .eq('id', staffId);

    if (!error) {
      setStaffByOffice(prev => ({
        ...prev,
        [officeId]: (prev[officeId] || []).map(s =>
          s.id === staffId ? { ...s, is_active: !currentlyActive } : s
        ),
      }));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <p className="mt-3 text-gray-600 text-sm">Loading office staff...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Manage Office Staff</h3>
            <p className="text-xs text-gray-500 mt-0.5">Add, edit, or remove staff from the directory</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {offices.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No offices found for selected legislators.</p>
          )}

          {offices.map(office => {
            const allStaff = staffByOffice[office.id] || [];
            const activeStaff = allStaff.filter(s => s.is_active !== false);
            const inactiveStaff = allStaff.filter(s => s.is_active === false);
            const displayStaff = showInactive ? allStaff : activeStaff;

            return (
              <div key={office.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Office header */}
                <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm text-gray-900">{formatOfficeName(office)}</span>
                    {office.district && (
                      <span className="ml-2 text-xs text-gray-500">District {office.district}</span>
                    )}
                    {office.state && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[10px] font-medium">
                        {office.state}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {inactiveStaff.length > 0 && (
                      <button
                        onClick={() => setShowInactive(!showInactive)}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        {showInactive ? 'Hide' : 'Show'} inactive ({inactiveStaff.length})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setAddingForOffice(office.id);
                        setAddForm({ first_name: '', last_name: '', title: '', email: '', phone: '' });
                      }}
                      className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Staff list */}
                <div className="divide-y divide-gray-100">
                  {displayStaff.length === 0 && addingForOffice !== office.id && (
                    <div className="px-4 py-4 text-center">
                      <p className="text-sm text-gray-400">No staff on file</p>
                      <button
                        onClick={() => {
                          setAddingForOffice(office.id);
                          setAddForm({ first_name: '', last_name: '', title: '', email: '', phone: '' });
                        }}
                        className="mt-1 text-xs text-teal-600 hover:text-teal-800"
                      >
                        Add from business card or signature block
                      </button>
                    </div>
                  )}

                  {displayStaff.map(s => {
                    const isActive = s.is_active !== false;
                    const isEditing = editingId === s.id;

                    if (isEditing) {
                      return (
                        <div key={s.id} className="px-4 py-3 bg-teal-50/30 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={labelClass}>First Name *</label>
                              <input type="text" value={editForm.first_name} onChange={e => setEditForm(p => ({ ...p, first_name: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Last Name *</label>
                              <input type="text" value={editForm.last_name} onChange={e => setEditForm(p => ({ ...p, last_name: e.target.value }))} className={inputClass} />
                            </div>
                          </div>
                          <div>
                            <label className={labelClass}>Title</label>
                            <input type="text" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Chief of Staff" className={inputClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className={labelClass}>Email</label>
                              <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
                            </div>
                            <div>
                              <label className={labelClass}>Phone</label>
                              <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">
                              Cancel
                            </button>
                            <button
                              onClick={saveEdit}
                              disabled={saving || !editForm.first_name.trim() || !editForm.last_name.trim()}
                              className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={s.id} className={`px-4 py-2.5 flex items-center justify-between ${!isActive ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                              {s.first_name} {s.last_name}
                            </span>
                            {!isActive && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">
                                Inactive
                              </span>
                            )}
                          </div>
                          {s.title && <p className="text-xs text-gray-500">{s.title}</p>}
                          <div className="flex gap-3 mt-0.5">
                            {s.email && <span className="text-xs text-gray-400">{s.email}</span>}
                            {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          {isActive && (
                            <button
                              onClick={() => startEdit(s)}
                              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              title="Edit staff"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleActive(s.id, office.id, isActive)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={isActive ? 'Deactivate staff' : 'Reactivate staff'}
                          >
                            {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Inline add form */}
                  {addingForOffice === office.id && (
                    <div className="px-4 py-3 bg-teal-50/30 space-y-2">
                      <p className="text-xs font-medium text-teal-700">New Staff Member</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>First Name *</label>
                          <input type="text" value={addForm.first_name} onChange={e => setAddForm(p => ({ ...p, first_name: e.target.value }))} className={inputClass} autoFocus />
                        </div>
                        <div>
                          <label className={labelClass}>Last Name *</label>
                          <input type="text" value={addForm.last_name} onChange={e => setAddForm(p => ({ ...p, last_name: e.target.value }))} className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Title</label>
                        <input type="text" value={addForm.title} onChange={e => setAddForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., Chief of Staff, Legislative Director" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelClass}>Email</label>
                          <input type="email" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Phone</label>
                          <input type="tel" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} className={inputClass} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setAddingForOffice(null)} className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={() => saveAdd(office.id)}
                          disabled={saving || !addForm.first_name.trim() || !addForm.last_name.trim()}
                          className="flex items-center gap-1 px-2.5 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageLegStaffModal;
