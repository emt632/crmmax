import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ScrollText, ArrowLeft, Save, Loader2, Star, Search, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { BillStatus, BillCommittee, BillCosponsor } from '../../types';
import BillNumberInput from './BillNumberInput';
import BillStatusPipeline from './BillStatusPipeline';
import CompanionBillGroup from './CompanionBillGroup';
import LegiScanSearchModal from './LegiScanSearchModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { formatBillNumber, BILL_STATUS_LABELS, BILL_STATUS_ORDER, US_STATES } from '../../lib/bill-format';
import { getOurStates } from '../../lib/legiscan-api';

interface BillFormData {
  bill_number: string;
  title: string;
  description: string;
  status: BillStatus;
  jurisdiction: string;
  session_id: number | null;
  author: string;
  committees: BillCommittee[];
  cosponsors: BillCosponsor[];
  bill_group_id: string | null;
  legiscan_bill_id: number | null;
  legiscan_raw: any;
  legiscan_sasts: Array<{ type: string; sast_bill_number: string; sast_bill_id: number }>;
  is_priority: boolean;
  notes: string;
}

const emptyForm: BillFormData = {
  bill_number: '',
  title: '',
  description: '',
  status: 'introduced',
  jurisdiction: 'US',
  session_id: null,
  author: '',
  committees: [],
  cosponsors: [],
  bill_group_id: null,
  legiscan_bill_id: null,
  legiscan_raw: null,
  legiscan_sasts: [],
  is_priority: false,
  notes: '',
};

const BillForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasModule } = useAuth();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState<BillFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showLegiScan, setShowLegiScan] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [ourStates, setOurStates] = useState<string[]>([]);

  useEffect(() => {
    if (id) fetchBill();
    getOurStates().then(setOurStates);
  }, [id]);

  if (!hasModule('advoLink')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-gray-500 text-lg">Access to ADVO-LINK is required to view this page.</p>
      </div>
    );
  }

  const fetchBill = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from('bills').select('*').eq('id', id).single();
    if (error || !data) {
      navigate('/advocacy/bills');
      return;
    }
    setFormData({
      bill_number: data.bill_number,
      title: data.title,
      description: data.description || '',
      status: data.status as BillStatus,
      jurisdiction: data.jurisdiction,
      session_id: data.session_id,
      author: data.author || '',
      committees: data.committees || [],
      cosponsors: data.cosponsors || [],
      bill_group_id: data.bill_group_id,
      legiscan_bill_id: data.legiscan_bill_id,
      legiscan_raw: data.legiscan_raw,
      legiscan_sasts: [],
      is_priority: data.is_priority,
      notes: data.notes || '',
    });
    setLoading(false);
  };

  const handleInputChange = (field: keyof BillFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLegiScanImport = (data: any) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const autoLinkCompanions = async (
    newBillId: string,
    sasts: Array<{ sast_bill_id: number }>,
    userId: string
  ) => {
    // Find existing bills in our DB that match the LegiScan companion bill IDs
    const legiscanIds = sasts.map((s) => s.sast_bill_id);
    const { data: existingBills } = await supabase
      .from('bills')
      .select('id, bill_group_id, legiscan_bill_id')
      .in('legiscan_bill_id', legiscanIds);

    if (!existingBills?.length) return;

    // Check if any existing companion already has a bill_group
    const existingGroup = existingBills.find((b) => b.bill_group_id)?.bill_group_id;

    let groupId = existingGroup;
    if (!groupId) {
      // Create a new group
      const { data: group } = await supabase
        .from('bill_groups')
        .insert({ label: 'Companion Bills', created_by: userId })
        .select('id')
        .single();
      if (!group) return;
      groupId = group.id;
    }

    // Assign the new bill and all found companions to this group
    const billIds = [newBillId, ...existingBills.map((b) => b.id)];
    await supabase
      .from('bills')
      .update({ bill_group_id: groupId })
      .in('id', billIds);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveError('');

    // Duplicate check: prevent importing a bill that already exists
    if (!isEditing && formData.legiscan_bill_id) {
      const { data: existing } = await supabase
        .from('bills')
        .select('id, bill_number')
        .eq('legiscan_bill_id', formData.legiscan_bill_id)
        .limit(1);
      if (existing && existing.length > 0) {
        setSaveError(
          `This bill already exists as ${formatBillNumber(existing[0].bill_number)}. ` +
          `Please edit the existing bill instead of creating a duplicate.`
        );
        setSaving(false);
        return;
      }
    }

    const payload = {
      bill_number: formData.bill_number,
      title: formData.title,
      description: formData.description || null,
      status: formData.status,
      jurisdiction: formData.jurisdiction,
      session_id: formData.session_id,
      author: formData.author || null,
      committees: formData.committees,
      cosponsors: formData.cosponsors,
      bill_group_id: formData.bill_group_id,
      legiscan_bill_id: formData.legiscan_bill_id,
      legiscan_raw: formData.legiscan_raw,
      is_priority: formData.is_priority,
      notes: formData.notes || null,
    };

    if (isEditing) {
      const { error } = await supabase.from('bills').update(payload).eq('id', id);
      if (!error) navigate(`/advocacy/bills/${id}`);
    } else {
      const { data, error } = await supabase
        .from('bills')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single();
      if (!error && data) {
        // Auto-link companion bills from LegiScan sasts data
        if (formData.legiscan_sasts.length > 0) {
          await autoLinkCompanions(data.id, formData.legiscan_sasts, user.id);
        }
        navigate(`/advocacy/bills/${data.id}`);
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    await supabase.from('ga_engagement_bills').delete().eq('bill_id', id);
    await supabase.from('bills').delete().eq('id', id);
    setShowDeleteModal(false);
    navigate('/advocacy/bills');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-teal-700 rounded-xl p-8 text-white shadow-sm">
        <button
          onClick={() => navigate('/advocacy/bills')}
          className="flex items-center text-teal-200 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bills
        </button>
        <h1 className="text-3xl font-bold flex items-center">
          <ScrollText className="w-8 h-8 mr-3" />
          {isEditing ? 'Edit Bill' : 'New Bill'}
        </h1>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* LegiScan Import */}
        {!isEditing && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <button
              type="button"
              onClick={() => setShowLegiScan(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors font-medium"
            >
              <Search className="w-4 h-4" />
              Import from LegiScan
            </button>
            <p className="text-xs text-gray-500 mt-2">Search and auto-populate bill details from LegiScan</p>
          </div>
        )}

        {/* Bill Identity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Bill Identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number *</label>
              <BillNumberInput
                value={formData.bill_number}
                onChange={(v) => handleInputChange('bill_number', v)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction *</label>
              <select
                value={formData.jurisdiction}
                onChange={(e) => handleInputChange('jurisdiction', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
              >
                {(ourStates.length > 0
                  ? US_STATES.filter((s) => ourStates.includes(s.value))
                  : US_STATES
                ).map((s) => (
                  <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* Status & Priority */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Status & Priority</h2>
          <BillStatusPipeline currentStatus={formData.status} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
              >
                {BILL_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{BILL_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => handleInputChange('is_priority', !formData.is_priority)}
                  className={`p-2 rounded-xl transition-all ${
                    formData.is_priority
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Star className={`w-5 h-5 ${formData.is_priority ? 'fill-current' : ''}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">Priority Bill</span>
              </label>
            </div>
          </div>
        </div>

        {/* Author & Cosponsors */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Author & Cosponsors</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author / Primary Sponsor</label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
            />
          </div>
          {formData.cosponsors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cosponsors</label>
              <div className="flex flex-wrap gap-2">
                {formData.cosponsors.map((cs, i) => {
                  const isOurState = ourStates.includes(cs.state || '');
                  return (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                        isOurState
                          ? 'bg-teal-100 text-teal-800 border border-teal-200 font-medium'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {cs.name}
                      {cs.party && <span className="text-xs opacity-60">({cs.party})</span>}
                      {cs.state && <span className="text-xs opacity-60">- {cs.state}</span>}
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...formData.cosponsors];
                          next.splice(i, 1);
                          handleInputChange('cosponsors', next);
                        }}
                        className="ml-1 text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Committees */}
        {formData.committees.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Committees</h2>
            <div className="space-y-2">
              {formData.committees.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    {c.chamber && (
                      <span className="ml-2 text-xs text-gray-500">({c.chamber})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = [...formData.committees];
                      next.splice(i, 1);
                      handleInputChange('committees', next);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Companion Bills */}
        {isEditing && id && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <CompanionBillGroup
              billId={id}
              billGroupId={formData.bill_group_id}
              onGroupChange={(gid) => handleInputChange('bill_group_id', gid)}
              userId={user!.id}
            />
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Bill
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/advocacy/bills')}
              className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.bill_number || !formData.title}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEditing ? 'Update Bill' : 'Save Bill'}
            </button>
          </div>
        </div>
      </form>

      <LegiScanSearchModal
        isOpen={showLegiScan}
        onClose={() => setShowLegiScan(false)}
        onImport={handleLegiScanImport}
        ourStates={ourStates}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        itemLabel={formatBillNumber(formData.bill_number)}
      />
    </div>
  );
};

export default BillForm;
