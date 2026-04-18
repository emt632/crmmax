import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck, Plus, Trash2, Loader2, Clock, Check, X, ChevronDown, ChevronRight, Users, User, Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilVolunteerRole, PhilVolunteerShift, PhilVolunteerAssignment, Contact } from '../../types';
import { format } from 'date-fns';

interface VolunteerTabProps { eventId: string; }

// ─── Contact Search Picker ────────────────────────────────────────────────
// Searchable contact picker with inline "Add to CRM" for new names

interface ContactPickerProps {
  contacts: Contact[];
  onSelect: (contactId: string) => void;
  onCancel: () => void;
  onContactCreated: (contact: Contact) => void;
  userId: string;
}

const ContactPicker: React.FC<ContactPickerProps> = ({ contacts, onSelect, onCancel, onContactCreated, userId }) => {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? contacts.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.last_name || '').toLowerCase().includes(q)
      )
    : contacts;

  const noMatch = q.length > 1 && filtered.length === 0;

  const handleCreate = async () => {
    if (!newFirst.trim() || !newLast.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('contacts')
      .insert({ first_name: newFirst.trim(), last_name: newLast.trim(), created_by: userId })
      .select('id, first_name, last_name')
      .single();
    setSaving(false);
    if (data && !error) {
      onContactCreated(data as Contact);
      onSelect(data.id);
    }
  };

  // Parse typed name into first/last for create form
  const parseNameForCreate = () => {
    const parts = query.trim().split(/\s+/);
    if (parts.length >= 2) {
      setNewFirst(parts[0]);
      setNewLast(parts.slice(1).join(' '));
    } else {
      setNewFirst(query.trim());
      setNewLast('');
    }
    setShowCreate(true);
  };

  return (
    <div className="space-y-2">
      {!showCreate ? (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-rose-400 focus:ring-0 outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
            {filtered.slice(0, 20).map((c) => (
              <button key={c.id} type="button" onClick={() => onSelect(c.id)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-rose-50 transition-colors">
                {c.first_name} {c.last_name}
              </button>
            ))}
            {filtered.length === 0 && q.length > 0 && (
              <div className="px-3 py-3 text-center">
                <p className="text-xs text-gray-400 mb-2">No contacts match "{query}"</p>
                <button onClick={parseNameForCreate}
                  className="flex items-center gap-1 mx-auto text-xs text-rose-600 hover:text-rose-700 font-medium">
                  <User className="w-3 h-3" /> Add "{query}" to CRM
                </button>
              </div>
            )}
            {filtered.length > 20 && (
              <p className="px-3 py-1.5 text-xs text-gray-400 text-center">Type more to narrow results...</p>
            )}
          </div>
          {noMatch && (
            <button onClick={parseNameForCreate}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium">
              <Plus className="w-3 h-3" /> Create new contact
            </button>
          )}
          <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        </>
      ) : (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-rose-800">Add new contact to CRM</p>
          <div className="grid grid-cols-2 gap-1.5">
            <input type="text" value={newFirst} onChange={(e) => setNewFirst(e.target.value)}
              placeholder="First name *" autoFocus
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={newLast} onChange={(e) => setNewLast(e.target.value)}
              placeholder="Last name *"
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleCreate} disabled={saving || !newFirst.trim() || !newLast.trim()}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add & Assign
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Back</button>
            <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Assignment Row ───────────────────────────────────────────────────────

const AssignmentRow: React.FC<{
  a: PhilVolunteerAssignment & { contact?: Contact };
  onCheckIn: () => void;
  onRemove: () => void;
}> = ({ a, onCheckIn, onRemove }) => (
  <div className="flex items-center justify-between py-1.5 pl-6">
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-700">{a.contact?.first_name} {a.contact?.last_name}</span>
      {a.checked_in && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Checked in</span>}
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onCheckIn}
        className={`text-xs px-2 py-1 rounded-lg transition-colors ${a.checked_in ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        {a.checked_in ? 'Checked In' : 'Check In'}
      </button>
      <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────

interface RoleWithData extends PhilVolunteerRole {
  shifts: (PhilVolunteerShift & { assignments: (PhilVolunteerAssignment & { contact?: Contact })[] })[];
  directAssignments: (PhilVolunteerAssignment & { contact?: Contact })[];
}

const VolunteerTab: React.FC<VolunteerTabProps> = ({ eventId }) => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleWithData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Add role form
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleSlots, setNewRoleSlots] = useState(1);

  // Add shift form (per role)
  const [addingShiftRoleId, setAddingShiftRoleId] = useState<string | null>(null);
  const [newShiftLabel, setNewShiftLabel] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftSlots, setNewShiftSlots] = useState(1);

  // Assign volunteer (shift-based or direct)
  const [assigningShiftId, setAssigningShiftId] = useState<string | null>(null);
  const [assigningDirectRoleId, setAssigningDirectRoleId] = useState<string | null>(null);

  // Expanded roles
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  useEffect(() => { fetchData(); }, [eventId]);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, contactsRes] = await Promise.all([
      supabase.from('phil_volunteer_roles').select('*').eq('event_id', eventId).order('created_at'),
      supabase.from('contacts').select('id, first_name, last_name').order('last_name'),
    ]);

    const roleList = (rolesRes.data || []) as PhilVolunteerRole[];
    setContacts((contactsRes.data || []) as Contact[]);

    if (roleList.length === 0) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const roleIds = roleList.map((r) => r.id);

    // Fetch shifts
    const shiftsRes = await supabase.from('phil_volunteer_shifts').select('*').in('role_id', roleIds).order('start_time');
    const shiftList = (shiftsRes.data || []) as PhilVolunteerShift[];

    // Fetch ALL assignments (both shift-based and direct-to-role)
    const shiftIds = shiftList.map((s) => s.id);
    const [shiftAssignRes, directAssignRes] = await Promise.all([
      shiftIds.length > 0
        ? supabase.from('phil_volunteer_assignments').select('*, contact:contact_id(id, first_name, last_name)').in('shift_id', shiftIds)
        : Promise.resolve({ data: [] }),
      supabase.from('phil_volunteer_assignments').select('*, contact:contact_id(id, first_name, last_name)').in('role_id', roleIds).is('shift_id', null),
    ]);

    const shiftAssignments = (shiftAssignRes.data || []) as any[];
    const directAssignments = (directAssignRes.data || []) as any[];

    // Build nested structure
    const shiftMap: Record<string, (PhilVolunteerShift & { assignments: any[] })[]> = {};
    for (const s of shiftList) {
      if (!shiftMap[s.role_id]) shiftMap[s.role_id] = [];
      shiftMap[s.role_id].push({ ...s, assignments: shiftAssignments.filter((a) => a.shift_id === s.id) });
    }

    const directMap: Record<string, any[]> = {};
    for (const a of directAssignments) {
      const rId = a.role_id;
      if (!directMap[rId]) directMap[rId] = [];
      directMap[rId].push(a);
    }

    setRoles(roleList.map((r) => ({
      ...r,
      shifts: shiftMap[r.id] || [],
      directAssignments: directMap[r.id] || [],
    })));
    setExpandedRoles(new Set(roleList.map((r) => r.id)));
    setLoading(false);
  };

  const handleContactCreated = (newContact: Contact) => {
    setContacts((prev) => [...prev, newContact].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')));
  };

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    await supabase.from('phil_volunteer_roles').insert({
      event_id: eventId, role_name: newRoleName.trim(), description: newRoleDesc.trim() || null,
      slots_needed: newRoleSlots, created_by: user!.id,
    });
    setNewRoleName(''); setNewRoleDesc(''); setNewRoleSlots(1); setShowAddRole(false);
    fetchData();
  };

  const deleteRole = async (roleId: string) => {
    await supabase.from('phil_volunteer_roles').delete().eq('id', roleId);
    fetchData();
  };

  const addShift = async (roleId: string) => {
    if (!newShiftLabel.trim()) return;
    await supabase.from('phil_volunteer_shifts').insert({
      role_id: roleId, shift_label: newShiftLabel.trim(),
      start_time: newShiftStart || null, end_time: newShiftEnd || null,
      slots_needed: newShiftSlots, created_by: user!.id,
    });
    setNewShiftLabel(''); setNewShiftStart(''); setNewShiftEnd(''); setNewShiftSlots(1); setAddingShiftRoleId(null);
    fetchData();
  };

  const deleteShift = async (shiftId: string) => {
    await supabase.from('phil_volunteer_shifts').delete().eq('id', shiftId);
    fetchData();
  };

  // Assign to a specific shift
  const assignToShift = async (shiftId: string, contactId: string) => {
    await supabase.from('phil_volunteer_assignments').insert({
      shift_id: shiftId, contact_id: contactId, created_by: user!.id,
    });
    setAssigningShiftId(null);
    fetchData();
  };

  // Assign directly to a role (no shift)
  const assignDirectToRole = async (roleId: string, contactId: string) => {
    await supabase.from('phil_volunteer_assignments').insert({
      role_id: roleId, shift_id: null, contact_id: contactId, created_by: user!.id,
    });
    setAssigningDirectRoleId(null);
    fetchData();
  };

  const removeAssignment = async (assignmentId: string) => {
    await supabase.from('phil_volunteer_assignments').delete().eq('id', assignmentId);
    fetchData();
  };

  const toggleCheckIn = async (assignment: PhilVolunteerAssignment) => {
    const now = new Date().toISOString();
    await supabase.from('phil_volunteer_assignments').update({
      checked_in: !assignment.checked_in,
      checked_in_at: !assignment.checked_in ? now : null,
    }).eq('id', assignment.id);
    fetchData();
  };

  // Stats — count both shift-based and direct assignments
  const totalSlots = roles.reduce((s, r) => s + r.slots_needed, 0);
  const totalAssigned = roles.reduce((s, r) =>
    s + r.shifts.reduce((ss, sh) => ss + sh.assignments.length, 0) + r.directAssignments.length, 0);
  const totalCheckedIn = roles.reduce((s, r) =>
    s + r.shifts.reduce((ss, sh) => ss + sh.assignments.filter((a) => a.checked_in).length, 0)
    + r.directAssignments.filter((a) => a.checked_in).length, 0);
  const totalHours = roles.reduce((s, r) =>
    s + r.shifts.reduce((ss, sh) => ss + sh.assignments.reduce((hs, a) => hs + (a.hours_logged || 0), 0), 0)
    + r.directAssignments.reduce((hs, a) => hs + (a.hours_logged || 0), 0), 0);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Roles', value: roles.length, icon: Users },
          { label: 'Assigned', value: `${totalAssigned}/${totalSlots}`, icon: UserCheck },
          { label: 'Checked In', value: totalCheckedIn, icon: Check },
          { label: 'Hours Logged', value: totalHours.toFixed(1), icon: Clock },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <s.icon className="w-4 h-4 text-rose-500" />
              <span className="text-xl font-bold text-gray-900">{s.value}</span>
            </div>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add Role */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Volunteer Roles</h3>
        <button onClick={() => setShowAddRole(!showAddRole)}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Role
        </button>
      </div>

      {showAddRole && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Role Name *</label>
              <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm"
                placeholder="e.g., Golf Marshal" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
              <input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm"
                placeholder="Brief description" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Slots Needed</label>
              <input type="number" min={1} value={newRoleSlots} onChange={(e) => setNewRoleSlots(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addRole} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">Save Role</button>
            <button onClick={() => setShowAddRole(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Roles List */}
      {roles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No volunteer roles defined yet. Add a role to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const isExpanded = expandedRoles.has(role.id);
            const assigned = role.shifts.reduce((s, sh) => s + sh.assignments.length, 0) + role.directAssignments.length;
            return (
              <div key={role.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Role header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedRoles((prev) => {
                    const next = new Set(prev);
                    next.has(role.id) ? next.delete(role.id) : next.add(role.id);
                    return next;
                  })}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{role.role_name}</p>
                      {role.description && <p className="text-xs text-gray-500">{role.description}</p>}
                      {/* Shift fill chips — always visible (no expand needed) */}
                      {(role.shifts.length > 0 || role.directAssignments.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {role.directAssignments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              <UserCheck className="w-3 h-3" />
                              Direct: {role.directAssignments.length}
                            </span>
                          )}
                          {role.shifts.map((sh) => {
                            const filled = sh.assignments.length;
                            const needed = sh.slots_needed ?? 1;
                            const isFull = filled >= needed;
                            return (
                              <span key={sh.id}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isFull ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}
                                title={`${sh.shift_label} — ${filled}/${needed} filled`}
                              >
                                <Clock className="w-3 h-3" />
                                {sh.shift_label}: {filled}/{needed}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm text-gray-500">{assigned}/{role.slots_needed} total</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${assigned >= role.slots_needed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {assigned >= role.slots_needed ? 'Filled' : 'Needs volunteers'}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deleteRole(role.id); }} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 px-4 py-3 space-y-3">

                    {/* ── Direct Assignments (no shift) ── */}
                    {role.directAssignments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Direct Assignments</p>
                        {role.directAssignments.map((a: any) => (
                          <AssignmentRow key={a.id} a={a} onCheckIn={() => toggleCheckIn(a)} onRemove={() => removeAssignment(a.id)} />
                        ))}
                      </div>
                    )}

                    {/* ── Assign directly (no shift needed) ── */}
                    {assigningDirectRoleId === role.id ? (
                      <div className="pl-6">
                        <ContactPicker
                          contacts={contacts}
                          onSelect={(cid) => assignDirectToRole(role.id, cid)}
                          onCancel={() => setAssigningDirectRoleId(null)}
                          onContactCreated={handleContactCreated}
                          userId={user!.id}
                        />
                      </div>
                    ) : (
                      <button onClick={() => { setAssigningDirectRoleId(role.id); setAssigningShiftId(null); }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Assign Volunteer (no shift)
                      </button>
                    )}

                    {/* ── Shifts ── */}
                    {role.shifts.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Shifts</p>
                        {role.shifts.map((shift) => {
                          const filled = shift.assignments.length;
                          const needed = shift.slots_needed ?? 1;
                          const openSlots = Math.max(0, needed - filled);
                          const isFull = filled >= needed;
                          return (
                          <div key={shift.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">{shift.shift_label}</span>
                                {shift.start_time && shift.end_time && (
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(shift.start_time), 'h:mm a')} - {format(new Date(shift.end_time), 'h:mm a')}
                                  </span>
                                )}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isFull ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                                  {filled}/{needed} filled
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isFull && (
                                  <button onClick={() => { setAssigningShiftId(shift.id); setAssigningDirectRoleId(null); }}
                                    className="text-xs text-rose-600 hover:text-rose-700 font-medium">+ Assign</button>
                                )}
                                <button onClick={() => deleteShift(shift.id)} className="p-1 text-gray-400 hover:text-red-500">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Shift assignments */}
                            {shift.assignments.map((a: any) => (
                              <AssignmentRow key={a.id} a={a} onCheckIn={() => toggleCheckIn(a)} onRemove={() => removeAssignment(a.id)} />
                            ))}

                            {/* Empty slot placeholders — visible without expanding */}
                            {openSlots > 0 && assigningShiftId !== shift.id && (
                              <div className="space-y-1 mt-1">
                                {Array.from({ length: openSlots }).map((_, i) => (
                                  <button
                                    key={`empty-${shift.id}-${i}`}
                                    onClick={() => { setAssigningShiftId(shift.id); setAssigningDirectRoleId(null); }}
                                    className="w-full flex items-center gap-2 py-1.5 pl-6 text-sm text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors border border-dashed border-gray-300 hover:border-rose-300"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Open slot — click to assign
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Assign to shift */}
                            {assigningShiftId === shift.id && (
                              <div className="mt-2 pl-6">
                                <ContactPicker
                                  contacts={contacts}
                                  onSelect={(cid) => assignToShift(shift.id, cid)}
                                  onCancel={() => setAssigningShiftId(null)}
                                  onContactCreated={handleContactCreated}
                                  userId={user!.id}
                                />
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Shift (optional) */}
                    {addingShiftRoleId === role.id ? (
                      <div className="flex items-end gap-2 mt-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Shift Label *</label>
                          <input value={newShiftLabel} onChange={(e) => setNewShiftLabel(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder="e.g., Morning Shift" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Start</label>
                          <input type="datetime-local" value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">End</label>
                          <input type="datetime-local" value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-0.5">Slots</label>
                          <input type="number" min={1} value={newShiftSlots} onChange={(e) => setNewShiftSlots(Math.max(1, Number(e.target.value) || 1))}
                            className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm" />
                        </div>
                        <button onClick={() => addShift(role.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700">Add</button>
                        <button onClick={() => setAddingShiftRoleId(null)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingShiftRoleId(role.id); setNewShiftLabel(''); setNewShiftStart(''); setNewShiftEnd(''); setNewShiftSlots(1); }}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1 mt-1">
                        <Plus className="w-3.5 h-3.5" /> Add Shift (optional)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VolunteerTab;
