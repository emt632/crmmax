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
  ToggleRight,
  GitBranch,
  ChevronRight,
  User as UserIcon,
  KeyRound,
  Eye
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
  const { user, profile, isAdmin, refreshProfile, startImpersonating } = useAuth();
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
  const [editingReportsToUserId, setEditingReportsToUserId] = useState<string | null>(null);
  const [editingReportsToValue, setEditingReportsToValue] = useState<string | null>(null);

  // User detail editing state
  const [editingUserDetailsId, setEditingUserDetailsId] = useState<string | null>(null);
  const [editUserFirstName, setEditUserFirstName] = useState('');
  const [editUserLastName, setEditUserLastName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');

  // Password reset state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [resetPasswordStatus, setResetPasswordStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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

  // User detail editing
  const startEditingUserDetails = (u: UserProfile) => {
    setEditingUserDetailsId(u.id);
    setEditUserFirstName(u.first_name || '');
    setEditUserLastName(u.last_name || '');
    setEditUserEmail(u.email);
  };

  const cancelEditingUserDetails = () => {
    setEditingUserDetailsId(null);
    setEditUserFirstName('');
    setEditUserLastName('');
    setEditUserEmail('');
  };

  const saveUserDetails = async () => {
    if (!editingUserDetailsId) return;
    try {
      const firstName = editUserFirstName.trim() || null;
      const lastName = editUserLastName.trim() || null;
      const computedFullName = [firstName, lastName].filter(Boolean).join(' ') || null;

      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          email: editUserEmail.trim(),
        })
        .eq('id', editingUserDetailsId);

      if (error) throw error;

      setAllUsers(prev =>
        prev.map(u => u.id === editingUserDetailsId
          ? { ...u, first_name: firstName, last_name: lastName, full_name: computedFullName, email: editUserEmail.trim() }
          : u
        )
      );

      if (editingUserDetailsId === user?.id) {
        await refreshProfile();
      }

      cancelEditingUserDetails();
    } catch (err) {
      console.error('Failed to update user details:', err);
    }
  };

  // Password reset
  const sendPasswordReset = async (targetUser: UserProfile) => {
    setResetPasswordUserId(targetUser.id);
    setResetPasswordStatus('sending');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetUser.email);
      if (error) throw error;
      setResetPasswordStatus('sent');
      setTimeout(() => {
        setResetPasswordUserId(null);
        setResetPasswordStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('Failed to send password reset:', err);
      setResetPasswordStatus('error');
      setTimeout(() => {
        setResetPasswordUserId(null);
        setResetPasswordStatus('idle');
      }, 3000);
    }
  };

  // Reports To editing
  const startEditingReportsTo = (u: UserProfile) => {
    setEditingReportsToUserId(u.id);
    setEditingReportsToValue(u.reports_to);
  };

  const saveReportsTo = async () => {
    if (!editingReportsToUserId) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ reports_to: editingReportsToValue || null })
        .eq('id', editingReportsToUserId);

      if (error) throw error;

      setAllUsers(prev =>
        prev.map(u => u.id === editingReportsToUserId ? { ...u, reports_to: editingReportsToValue || null } : u)
      );
      setEditingReportsToUserId(null);
    } catch (err) {
      console.error('Failed to update reports_to:', err);
    }
  };

  // Build org chart tree from allUsers
  const buildOrgTree = () => {
    const roots: UserProfile[] = [];
    const childrenMap: Record<string, UserProfile[]> = {};

    allUsers.filter(u => u.is_active).forEach(u => {
      if (!u.reports_to) {
        roots.push(u);
      } else {
        if (!childrenMap[u.reports_to]) childrenMap[u.reports_to] = [];
        childrenMap[u.reports_to].push(u);
      }
    });

    return { roots, childrenMap };
  };

  const OrgTreeNode: React.FC<{ u: UserProfile; childrenMap: Record<string, UserProfile[]>; depth: number }> = ({ u, childrenMap, depth }) => {
    const children = childrenMap[u.id] || [];
    return (
      <div>
        <div
          className="flex items-center py-2 px-3 hover:bg-gray-50 rounded-lg transition-colors"
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
        >
          {children.length > 0 ? (
            <ChevronRight className="w-4 h-4 text-gray-400 mr-2 rotate-90" />
          ) : (
            <span className="w-4 h-4 mr-2" />
          )}
          <UserIcon className="w-4 h-4 text-gray-500 mr-2" />
          <span className="text-sm font-medium text-gray-900">{u.full_name || u.email}</span>
          <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {u.role === 'admin' ? 'Admin' : u.role}
          </span>
        </div>
        {children.map(child => (
          <OrgTreeNode key={child.id} u={child} childrenMap={childrenMap} depth={depth + 1} />
        ))}
      </div>
    );
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
      <div className="bg-gray-800 rounded-xl p-8 text-white shadow-sm">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">First Name</p>
                <p className="font-medium text-gray-900">{profile?.first_name || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Last Name</p>
                <p className="font-medium text-gray-900">{profile?.last_name || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user?.email || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Role</p>
                <p className="font-medium text-gray-900">{profile?.role === 'admin' ? 'Admin' : profile?.role || '—'}</p>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                    {editingUserDetailsId === u.id ? (
                      /* Expanded edit mode */
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700">Edit User Details</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={saveUserDetails}
                              className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditingUserDetails}
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
                            <input
                              type="text"
                              value={editUserFirstName}
                              onChange={(e) => setEditUserFirstName(e.target.value)}
                              placeholder="First Name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                            <input
                              type="text"
                              value={editUserLastName}
                              onChange={(e) => setEditUserLastName(e.target.value)}
                              placeholder="Last Name"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                            <input
                              type="email"
                              value={editUserEmail}
                              onChange={(e) => setEditUserEmail(e.target.value)}
                              placeholder="user@example.com"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Normal display mode */
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditingUserDetails(u)}
                              className="font-medium text-gray-900 truncate hover:text-blue-600 transition-colors flex items-center gap-1"
                              title="Edit name & email"
                            >
                              {u.full_name || u.email}
                              <Pencil className="w-3 h-3 text-gray-400" />
                            </button>
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
                          {/* View As (impersonate) */}
                          {u.id !== user?.id && u.is_active && (
                            <button
                              onClick={() => startImpersonating(u.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={`View as ${u.full_name || u.email}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          {/* Password Reset */}
                          {resetPasswordUserId === u.id ? (
                            <span className={`text-xs px-2 py-1 rounded-lg ${
                              resetPasswordStatus === 'sent' ? 'bg-green-100 text-green-700' :
                              resetPasswordStatus === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {resetPasswordStatus === 'sending' && 'Sending...'}
                              {resetPasswordStatus === 'sent' && 'Reset email sent!'}
                              {resetPasswordStatus === 'error' && 'Failed to send'}
                            </span>
                          ) : (
                            <button
                              onClick={() => sendPasswordReset(u)}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Send password reset email"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reports To editing */}
                          {editingReportsToUserId === u.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={editingReportsToValue || ''}
                                onChange={(e) => setEditingReportsToValue(e.target.value || null)}
                                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">No Manager</option>
                                {allUsers
                                  .filter(m => m.id !== u.id && m.is_active)
                                  .map(m => (
                                    <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
                                  ))
                                }
                              </select>
                              <button
                                onClick={saveReportsTo}
                                className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingReportsToUserId(null)}
                                className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditingReportsTo(u)}
                              className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1 min-w-[80px]"
                              title="Set manager"
                            >
                              <GitBranch className="w-3 h-3 text-gray-400" />
                              {u.reports_to
                                ? allUsers.find(m => m.id === u.reports_to)?.full_name || 'Unknown'
                                : 'No manager'}
                            </button>
                          )}

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
                    )}
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

          {/* Org Chart */}
          {allUsers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center">
                  <GitBranch className="w-5 h-5 text-gray-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">Organization Chart</h2>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Reporting hierarchy. Set managers using the user list above.
                </p>
              </div>
              <div className="p-4">
                {(() => {
                  const { roots, childrenMap } = buildOrgTree();
                  const unassigned = roots.filter(u => {
                    // "Roots" that have no children are unassigned loners
                    return !(childrenMap[u.id]?.length);
                  });
                  const topLevel = roots.filter(u => childrenMap[u.id]?.length > 0);

                  return (
                    <div className="space-y-1">
                      {topLevel.map(u => (
                        <OrgTreeNode key={u.id} u={u} childrenMap={childrenMap} depth={0} />
                      ))}
                      {/* Roots with no children — show as standalone */}
                      {roots.filter(u => !childrenMap[u.id]?.length && !topLevel.includes(u)).length > 0 && topLevel.length > 0 && (
                        <div className="border-t border-gray-200 mt-3 pt-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1 px-3">Unassigned</p>
                        </div>
                      )}
                      {unassigned.map(u => (
                        <OrgTreeNode key={u.id} u={u} childrenMap={childrenMap} depth={0} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Contact Types */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
