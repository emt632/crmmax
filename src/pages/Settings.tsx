import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Info,
  Users as UsersIcon,
  UserPlus,
  Lock,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import type { ContactType, UserProfile, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AddContactTypeModal from '../components/shared/AddContactTypeModal';
import InviteUserModal from '../components/shared/InviteUserModal';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#14B8A6', '#6B7280', '#DC2626', '#059669',
];

const ALL_ROLES: UserRole[] = [
  'admin',
  'Executive Leader',
  'Partner Engagement Manager',
  'Clinical Manager',
  'Base Lead',
  'Philanthropy',
  'Advocacy',
  'Maintenance',
  'Supervisor',
  'Marketing',
  'General',
];

type SettingsTab = 'general' | 'admin';

const Settings: React.FC = () => {
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Contact types state
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // User management state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<UserRole>('General');

  // Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchContactTypes();
    fetchUsageCounts();
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'admin') {
      fetchAllUsers();
    }
  }, [isAdmin, activeTab]);

  const fetchContactTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_types')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setContactTypes(data || []);
    } catch {
      setContactTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_type_assignments')
        .select('contact_type_id');

      if (error) throw error;

      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        counts[row.contact_type_id] = (counts[row.contact_type_id] || 0) + 1;
      });
      setUsageCounts(counts);
    } catch {
      setUsageCounts({});
    }
  };

  const fetchAllUsers = async () => {
    try {
      setUsersLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at');

      if (error) throw error;
      setAllUsers((data || []) as UserProfile[]);
    } catch {
      setAllUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Contact type editing
  const startEditing = (ct: ContactType) => {
    setEditingId(ct.id);
    setEditName(ct.name);
    setEditColor(ct.color);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    try {
      const { error } = await supabase
        .from('contact_types')
        .update({ name: editName.trim(), color: editColor })
        .eq('id', editingId);

      if (error) throw error;

      setContactTypes(prev =>
        prev.map(ct => ct.id === editingId ? { ...ct, name: editName.trim(), color: editColor } : ct)
      );
      cancelEditing();
    } catch (err) {
      console.error('Failed to update contact type:', err);
    }
  };

  const deleteType = async (id: string) => {
    try {
      await supabase
        .from('contact_type_assignments')
        .delete()
        .eq('contact_type_id', id);

      const { error } = await supabase
        .from('contact_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContactTypes(prev => prev.filter(ct => ct.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete contact type:', err);
    }
  };

  // User management
  const startEditingRole = (u: UserProfile) => {
    setEditingRoleUserId(u.id);
    setEditingRoleValue(u.role);
  };

  const saveRole = async () => {
    if (!editingRoleUserId) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: editingRoleValue })
        .eq('id', editingRoleUserId);

      if (error) throw error;

      setAllUsers(prev =>
        prev.map(u => u.id === editingRoleUserId ? { ...u, role: editingRoleValue } : u)
      );
      setEditingRoleUserId(null);

      // Refresh own profile if we changed our own role
      if (editingRoleUserId === user?.id) {
        await refreshProfile();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const toggleUserActive = async (targetUser: UserProfile) => {
    if (targetUser.id === user?.id) return; // Can't deactivate self
    try {
      const newActive = !targetUser.is_active;
      const { error } = await supabase
        .from('users')
        .update({ is_active: newActive })
        .eq('id', targetUser.id);

      if (error) throw error;

      setAllUsers(prev =>
        prev.map(u => u.id === targetUser.id ? { ...u, is_active: newActive } : u)
      );
    } catch (err) {
      console.error('Failed to toggle user active:', err);
    }
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess('Password changed successfully.');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPasswordError('An unexpected error occurred.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gray-600"></div>
          <SettingsIcon className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-gray-600" />
        </div>
        <p className="mt-4 text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold flex items-center">
          <SettingsIcon className="w-8 h-8 mr-3" />
          Settings
        </h1>
        <p className="mt-2 text-gray-300">Manage your CRM configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'general' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Info className="w-4 h-4 mr-2" />
          General
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'admin' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Admin
          </button>
        )}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium text-gray-900">{profile?.full_name || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user?.email || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium text-gray-900">{profile?.role === 'admin' ? 'Admin' : profile?.role || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Version</p>
                <p className="font-medium text-gray-900">1.0.0</p>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-4">
              <Lock className="w-5 h-5 mr-2 text-gray-600" />
              Change Password
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-sm text-green-700">{passwordSuccess}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={changingPassword}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && isAdmin && (
        <div className="space-y-6">
          {/* User Management */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <UsersIcon className="w-5 h-5 text-gray-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite User
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Manage user accounts, roles, and access.
              </p>
            </div>

            {usersLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto" />
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {allUsers.map(u => (
                  <div key={u.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">
                            {u.full_name || u.email}
                          </p>
                          {u.id === user?.id && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">You</span>
                          )}
                          {!u.is_active && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">{u.email}</p>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        {/* Role editing */}
                        {editingRoleUserId === u.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingRoleValue}
                              onChange={(e) => setEditingRoleValue(e.target.value as UserRole)}
                              className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                            >
                              {ALL_ROLES.map(r => (
                                <option key={r} value={r}>{r === 'admin' ? 'Admin' : r}</option>
                              ))}
                            </select>
                            <button
                              onClick={saveRole}
                              className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingRoleUserId(null)}
                              className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingRole(u)}
                            className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                          >
                            {u.role === 'admin' ? 'Admin' : u.role}
                            <Pencil className="w-3 h-3 text-gray-400" />
                          </button>
                        )}

                        {/* Active toggle */}
                        <button
                          onClick={() => toggleUserActive(u)}
                          disabled={u.id === user?.id}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.id === user?.id
                              ? 'text-gray-300 cursor-not-allowed'
                              : u.is_active
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-red-400 hover:bg-red-50'
                          }`}
                          title={u.id === user?.id ? "Can't deactivate yourself" : u.is_active ? 'Deactivate user' : 'Reactivate user'}
                        >
                          {u.is_active ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {allUsers.length === 0 && (
                  <div className="px-6 py-8 text-center text-gray-500">
                    <UsersIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                    <p>No users found.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact Types */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Tag className="w-5 h-5 text-gray-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">Contact Types</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Type
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Define the types used to categorize contacts and organizations. Users must select from these options.
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {contactTypes.map(ct => (
                <div key={ct.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  {editingId === ct.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`w-7 h-7 rounded-md transition-all ${
                              editColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ct.color }}
                        />
                        <span className="font-medium text-gray-900">{ct.name}</span>
                        {usageCounts[ct.id] && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {usageCounts[ct.id]} assigned
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(ct)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === ct.id ? (
                          <div className="flex items-center space-x-2 bg-red-50 px-3 py-1 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-xs text-red-700">
                              {usageCounts[ct.id]
                                ? `Used by ${usageCounts[ct.id]} records. Delete?`
                                : 'Delete this type?'}
                            </span>
                            <button
                              onClick={() => deleteType(ct.id)}
                              className="text-xs font-medium text-red-600 hover:text-red-800"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-xs font-medium text-gray-600 hover:text-gray-800"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(ct.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {contactTypes.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  <Tag className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p>No contact types defined yet.</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Add your first type
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AddContactTypeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onTypeCreated={(newType) => {
          setContactTypes(prev => [...prev, newType]);
        }}
      />

      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onUserInvited={fetchAllUsers}
      />
    </div>
  );
};

export default Settings;
