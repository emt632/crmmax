import React, { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LegislativeOfficeStaff, LegislativeOffice } from '../../types';

interface QuickAddCommitteeStaffModalProps {
  committeeOffice: LegislativeOffice;
  userId: string;
  onCreated: (staff: LegislativeOfficeStaff) => void;
  onClose: () => void;
}

const inputClass = 'w-full px-2.5 py-1.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all text-sm';
const labelClass = 'block text-xs font-medium text-gray-600 mb-0.5';

const QuickAddCommitteeStaffModal: React.FC<QuickAddCommitteeStaffModalProps> = ({
  committeeOffice,
  userId,
  onCreated,
  onClose,
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);

    const { data: staff, error } = await supabase
      .from('legislative_office_staff')
      .insert({
        office_id: committeeOffice.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        created_by: userId,
      })
      .select('*')
      .single();

    setSaving(false);
    if (error || !staff) { console.error('Failed to create staff:', error); return; }
    onCreated(staff as LegislativeOfficeStaff);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 sm:p-4">
      <div className="bg-white shadow-xl w-full h-full sm:h-auto sm:rounded-xl sm:max-w-md overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Add Committee Staff</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Adding staff to: <span className="font-medium text-gray-700">{committeeOffice.name}</span>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>First Name *</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name *</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Committee Clerk" className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-3 py-2 sm:py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Add Staff
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickAddCommitteeStaffModal;
