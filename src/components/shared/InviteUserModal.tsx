import React, { useState, useEffect } from 'react';
import { X, UserPlus, Copy, Check } from 'lucide-react';
import type { UserRole, UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserInvited: () => void;
}

const ROLES: UserRole[] = [
  'General',
  'Executive Leader',
  'Partner Engagement Manager',
  'Clinical Manager',
  'Base Lead',
  'Philanthropy',
  'Advocacy',
  'Maintenance',
  'Supervisor',
  'Marketing',
  'admin',
];

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onUserInvited }) => {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('General');
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('full_name');
    setAllUsers((data || []) as UserProfile[]);
  };

  const reset = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('General');
    setReportsTo(null);
    setError('');
    setTempPassword('');
    setCopied(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const password = generateTempPassword();

    try {
      // Create the auth user via Supabase signUp
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setSubmitting(false);
        return;
      }

      if (!data.user) {
        setError('Failed to create user account.');
        setSubmitting(false);
        return;
      }

      // Wait briefly for the trigger to create the public.users row
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update the public.users row with role, first/last name, and reports_to
      const { error: updateError } = await supabase
        .from('users')
        .update({
          role,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          reports_to: reportsTo || null,
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.error('Failed to update user profile:', updateError);
        // User was created but profile update failed - still show password
      }

      setTempPassword(password);
      onUserInvited();
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Invite User</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {tempPassword ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800 mb-1">User invited successfully!</p>
                <p className="text-xs text-green-700">Share the temporary password below with the user. They can change it after signing in.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{email}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-sm text-gray-500">Temporary Password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono">
                    {tempPassword}
                  </code>
                  <button
                    onClick={copyPassword}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r === 'admin' ? 'Admin' : r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                <select
                  value={reportsTo || ''}
                  onChange={(e) => setReportsTo(e.target.value || null)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all bg-white"
                >
                  <option value="">No Manager</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create &amp; Generate Password
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;
