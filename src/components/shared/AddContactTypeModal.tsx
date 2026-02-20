import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { ContactType } from '../../types';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#14B8A6', '#6B7280', '#DC2626', '#059669',
];

interface AddContactTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTypeCreated: (newType: ContactType) => void;
}

const AddContactTypeModal: React.FC<AddContactTypeModalProps> = ({ isOpen, onClose, onTypeCreated }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const userId = user!.id;

      const { data, error: insertError } = await supabase
        .from('contact_types')
        .insert([{
          name: name.trim(),
          color,
          sort_order: 99,
          created_by: userId,
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        onTypeCreated(data);
      }
      setName('');
      setColor('#3B82F6');
      onClose();
    } catch (err: any) {
      if (err?.code === '23505') {
        setError('A type with this name already exists');
      } else {
        setError('Failed to create type. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Add Contact Type</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., EMS, Fire, Hospital..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              {saving ? 'Creating...' : 'Create Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddContactTypeModal;
