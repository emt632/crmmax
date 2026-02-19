import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle
} from 'lucide-react';
import type { ContactType } from '../types';
import { supabase } from '../lib/supabase';
import AddContactTypeModal from '../components/shared/AddContactTypeModal';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#14B8A6', '#6B7280', '#DC2626', '#059669',
];

const Settings: React.FC = () => {
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchContactTypes();
    fetchUsageCounts();
  }, []);

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
      // Delete assignments first
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

      {/* Contact Types Management */}
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
            Define the types used to categorize contacts and organizations (e.g., EMS, Fire, Hospital).
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

      <AddContactTypeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onTypeCreated={(newType) => {
          setContactTypes(prev => [...prev, newType]);
        }}
      />
    </div>
  );
};

export default Settings;
