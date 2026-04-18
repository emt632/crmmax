import React, { useState, useEffect, useCallback } from 'react';
import {
  HandHeart,
  Plus,
  Loader2,
  DollarSign,
  AlertTriangle,
  Check,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  PhilCashDonation,
  PhilInkindDonation,
  PhilDonationMethod,
  PhilInkindCategory,
  Contact,
  Organization,
} from '../../types';

// ─── Props ──────────────────────────────────────────────────

interface DonationsTabProps {
  eventId: string;
}

// ─── Constants ──────────────────────────────────────────────

const METHOD_LABELS: Record<PhilDonationMethod, string> = {
  cash: 'Cash',
  check: 'Check',
  credit_card: 'Credit Card',
  ach: 'ACH',
  other: 'Other',
};

const METHOD_COLORS: Record<PhilDonationMethod, string> = {
  cash: 'bg-green-100 text-green-700',
  check: 'bg-blue-100 text-blue-700',
  credit_card: 'bg-purple-100 text-purple-700',
  ach: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
};

const CATEGORY_LABELS: Record<PhilInkindCategory, string> = {
  goods: 'Goods',
  services: 'Services',
  experiences: 'Experiences',
  food_beverage: 'Food & Beverage',
  printing: 'Printing',
  venue: 'Venue',
  other: 'Other',
};

const CATEGORY_COLORS: Record<PhilInkindCategory, string> = {
  goods: 'bg-blue-100 text-blue-700',
  services: 'bg-purple-100 text-purple-700',
  experiences: 'bg-amber-100 text-amber-700',
  food_beverage: 'bg-orange-100 text-orange-700',
  printing: 'bg-cyan-100 text-cyan-700',
  venue: 'bg-emerald-100 text-emerald-700',
  other: 'bg-gray-100 text-gray-700',
};

type SubTab = 'cash' | 'inkind';

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function donorName(
  contact?: { first_name: string; last_name: string } | null,
  org?: { name: string } | null,
): string {
  const parts: string[] = [];
  if (contact) parts.push(`${contact.first_name} ${contact.last_name}`);
  if (org) parts.push(org.name);
  return parts.join(' / ') || '—';
}

// ─── Empty-state defaults ───────────────────────────────────

const EMPTY_CASH_FORM = {
  contact_id: '',
  organization_id: '',
  amount: '',
  method: 'check' as PhilDonationMethod,
  donation_date: new Date().toISOString().slice(0, 10),
  receipt_number: '',
  tax_deductible: true,
  notes: '',
};

const EMPTY_INKIND_FORM = {
  item_description: '',
  contact_id: '',
  organization_id: '',
  category: 'goods' as PhilInkindCategory,
  fair_market_value: '',
  intended_use: '',
  quantity: '1',
  notes: '',
};

// ─── Component ──────────────────────────────────────────────

export default function DonationsTab({ eventId }: DonationsTabProps) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('cash');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [cashDonations, setCashDonations] = useState<PhilCashDonation[]>([]);
  const [inkindDonations, setInkindDonations] = useState<PhilInkindDonation[]>([]);
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'first_name' | 'last_name'>[]>([]);
  const [organizations, setOrganizations] = useState<Pick<Organization, 'id' | 'name'>[]>([]);

  // Add-form visibility
  const [showCashForm, setShowCashForm] = useState(false);
  const [showInkindForm, setShowInkindForm] = useState(false);

  // Add-form state
  const [cashForm, setCashForm] = useState(EMPTY_CASH_FORM);
  const [inkindForm, setInkindForm] = useState(EMPTY_INKIND_FORM);

  // ── Fetch all data ──

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [cashRes, inkindRes, contactsRes, orgsRes] = await Promise.all([
      supabase
        .from('phil_cash_donations')
        .select('*, contact:contacts(id, first_name, last_name), organization:organizations(id, name)')
        .eq('event_id', eventId)
        .order('donation_date', { ascending: false }),
      supabase
        .from('phil_inkind_donations')
        .select('*, contact:contacts(id, first_name, last_name), organization:organizations(id, name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .order('last_name'),
      supabase
        .from('organizations')
        .select('id, name')
        .order('name'),
    ]);

    if (cashRes.data) setCashDonations(cashRes.data as PhilCashDonation[]);
    if (inkindRes.data) setInkindDonations(inkindRes.data as PhilInkindDonation[]);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Summary stats ──

  const totalCash = cashDonations.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalInkindValue = inkindDonations.reduce((sum, d) => sum + Number(d.fair_market_value || 0), 0);
  const form8283Count = inkindDonations.filter((d) => d.form_8283_required && !d.form_8283_completed).length;
  const ackPending =
    cashDonations.filter((d) => !d.acknowledgement_sent).length +
    inkindDonations.filter((d) => !d.acknowledgement_sent).length;

  // ── Toggle acknowledgement ──

  async function toggleCashAck(donation: PhilCashDonation) {
    const { error } = await supabase
      .from('phil_cash_donations')
      .update({ acknowledgement_sent: !donation.acknowledgement_sent })
      .eq('id', donation.id);
    if (!error) {
      setCashDonations((prev) =>
        prev.map((d) => (d.id === donation.id ? { ...d, acknowledgement_sent: !d.acknowledgement_sent } : d)),
      );
    }
  }

  async function toggleInkindAck(donation: PhilInkindDonation) {
    const { error } = await supabase
      .from('phil_inkind_donations')
      .update({ acknowledgement_sent: !donation.acknowledgement_sent })
      .eq('id', donation.id);
    if (!error) {
      setInkindDonations((prev) =>
        prev.map((d) => (d.id === donation.id ? { ...d, acknowledgement_sent: !d.acknowledgement_sent } : d)),
      );
    }
  }

  // ── Delete ──

  async function deleteCash(id: string) {
    if (!confirm('Delete this cash donation?')) return;
    const { error } = await supabase.from('phil_cash_donations').delete().eq('id', id);
    if (!error) setCashDonations((prev) => prev.filter((d) => d.id !== id));
  }

  async function deleteInkind(id: string) {
    if (!confirm('Delete this in-kind donation?')) return;
    const { error } = await supabase.from('phil_inkind_donations').delete().eq('id', id);
    if (!error) setInkindDonations((prev) => prev.filter((d) => d.id !== id));
  }

  // ── Add cash donation ──

  async function handleAddCash(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(cashForm.amount);
    if (isNaN(amount) || amount <= 0) return;

    setSaving(true);
    const { error } = await supabase.from('phil_cash_donations').insert({
      event_id: eventId,
      contact_id: cashForm.contact_id || null,
      organization_id: cashForm.organization_id || null,
      amount,
      method: cashForm.method,
      donation_date: cashForm.donation_date || new Date().toISOString().slice(0, 10),
      receipt_number: cashForm.receipt_number || null,
      tax_deductible: cashForm.tax_deductible,
      notes: cashForm.notes || null,
      created_by: user.id,
    });
    setSaving(false);

    if (!error) {
      setCashForm(EMPTY_CASH_FORM);
      setShowCashForm(false);
      fetchData();
    }
  }

  // ── Add in-kind donation ──

  async function handleAddInkind(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!inkindForm.item_description.trim()) return;

    setSaving(true);
    const fmv = parseFloat(inkindForm.fair_market_value) || 0;
    const { error } = await supabase.from('phil_inkind_donations').insert({
      event_id: eventId,
      contact_id: inkindForm.contact_id || null,
      organization_id: inkindForm.organization_id || null,
      item_description: inkindForm.item_description.trim(),
      category: inkindForm.category,
      fair_market_value: fmv,
      intended_use: inkindForm.intended_use || null,
      quantity: parseInt(inkindForm.quantity) || 1,
      notes: inkindForm.notes || null,
      created_by: user.id,
    });
    setSaving(false);

    if (!error) {
      setInkindForm(EMPTY_INKIND_FORM);
      setShowInkindForm(false);
      fetchData();
    }
  }

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Cash', value: formatCurrency(totalCash), icon: DollarSign, color: 'text-rose-600 bg-rose-50' },
          { label: 'Total In-Kind Value', value: formatCurrency(totalInkindValue), icon: HandHeart, color: 'text-purple-600 bg-purple-50' },
          { label: 'Form 8283 Required', value: form8283Count.toString(), icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
          { label: 'Ack. Pending', value: ackPending.toString(), icon: Check, color: 'text-blue-600 bg-blue-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub-tab toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab('cash')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subTab === 'cash' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cash Donations ({cashDonations.length})
        </button>
        <button
          onClick={() => setSubTab('inkind')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subTab === 'inkind' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          In-Kind Donations ({inkindDonations.length})
        </button>
      </div>

      {/* Cash Donations Sub-tab */}
      {subTab === 'cash' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header + Add button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Cash Donations</h3>
            <button
              onClick={() => setShowCashForm((v) => !v)}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {showCashForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showCashForm ? 'Cancel' : 'Add Donation'}
            </button>
          </div>

          {/* Inline add form */}
          {showCashForm && (
            <form onSubmit={handleAddCash} className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Contact */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact</label>
                  <select
                    value={cashForm.contact_id}
                    onChange={(e) => setCashForm((f) => ({ ...f, contact_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">— None —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.last_name}, {c.first_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Organization */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
                  <select
                    value={cashForm.organization_id}
                    onChange={(e) => setCashForm((f) => ({ ...f, organization_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">— None —</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={cashForm.amount}
                    onChange={(e) => setCashForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                {/* Method */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                  <select
                    value={cashForm.method}
                    onChange={(e) => setCashForm((f) => ({ ...f, method: e.target.value as PhilDonationMethod }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    {(Object.keys(METHOD_LABELS) as PhilDonationMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={cashForm.donation_date}
                    onChange={(e) => setCashForm((f) => ({ ...f, donation_date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                {/* Receipt Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Receipt #</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={cashForm.receipt_number}
                    onChange={(e) => setCashForm((f) => ({ ...f, receipt_number: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cashForm.tax_deductible}
                    onChange={(e) => setCashForm((f) => ({ ...f, tax_deductible: e.target.checked }))}
                    className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  Tax Deductible
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={cashForm.notes}
                  onChange={(e) => setCashForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save Donation
                </button>
              </div>
            </form>
          )}

          {/* Cash table */}
          {cashDonations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No cash donations yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Contact / Org</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Method</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Tax Ded.</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Acknowledged</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cashDonations.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{donorName(d.contact, d.organization)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(d.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${METHOD_COLORS[d.method]}`}>
                          {METHOD_LABELS[d.method]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{d.donation_date}</td>
                      <td className="px-4 py-3 text-gray-600">{d.tax_deductible ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleCashAck(d)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                            d.acknowledgement_sent
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={d.acknowledgement_sent ? 'Click to mark as not sent' : 'Click to mark as sent'}
                        >
                          {d.acknowledgement_sent ? <Check className="w-3 h-3" /> : null}
                          {d.acknowledgement_sent ? 'Sent' : 'Pending'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteCash(d.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* In-Kind Donations Sub-tab */}
      {subTab === 'inkind' && (
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header + Add button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">In-Kind Donations</h3>
            <button
              onClick={() => setShowInkindForm((v) => !v)}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              {showInkindForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showInkindForm ? 'Cancel' : 'Add In-Kind'}
            </button>
          </div>

          {/* Inline add form */}
          {showInkindForm && (
            <form onSubmit={handleAddInkind} className="p-4 border-b border-gray-100 bg-gray-50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Item Description */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Item Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silent auction basket, catering services..."
                    value={inkindForm.item_description}
                    onChange={(e) => setInkindForm((f) => ({ ...f, item_description: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                {/* Contact */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact</label>
                  <select
                    value={inkindForm.contact_id}
                    onChange={(e) => setInkindForm((f) => ({ ...f, contact_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">— None —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.last_name}, {c.first_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Organization */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
                  <select
                    value={inkindForm.organization_id}
                    onChange={(e) => setInkindForm((f) => ({ ...f, organization_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    <option value="">— None —</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select
                    value={inkindForm.category}
                    onChange={(e) => setInkindForm((f) => ({ ...f, category: e.target.value as PhilInkindCategory }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  >
                    {(Object.keys(CATEGORY_LABELS) as PhilInkindCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FMV */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fair Market Value ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={inkindForm.fair_market_value}
                    onChange={(e) => setInkindForm((f) => ({ ...f, fair_market_value: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                  {parseFloat(inkindForm.fair_market_value) > 500 && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      IRS Form 8283 will be required
                    </p>
                  )}
                </div>

                {/* Intended Use */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Intended Use</label>
                  <input
                    type="text"
                    placeholder="e.g. Silent auction, raffle prize..."
                    value={inkindForm.intended_use}
                    onChange={(e) => setInkindForm((f) => ({ ...f, intended_use: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={inkindForm.quantity}
                    onChange={(e) => setInkindForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={inkindForm.notes}
                  onChange={(e) => setInkindForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Save In-Kind
                </button>
              </div>
            </form>
          )}

          {/* In-kind table */}
          {inkindDonations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No in-kind donations yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-4 py-3 font-medium text-gray-500">Item Description</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Donor</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 font-medium text-gray-500">FMV</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Intended Use</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Form 8283</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Acknowledged</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inkindDonations.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={d.item_description}>
                        {d.item_description}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{donorName(d.contact, d.organization)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLORS[d.category]}`}>
                          {CATEGORY_LABELS[d.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(d.fair_market_value)}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate" title={d.intended_use || ''}>
                        {d.intended_use || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {d.form_8283_required ? (
                          d.form_8283_completed ? (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              Done
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              Required
                            </span>
                          )
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleInkindAck(d)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${
                            d.acknowledgement_sent
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={d.acknowledgement_sent ? 'Click to mark as not sent' : 'Click to mark as sent'}
                        >
                          {d.acknowledgement_sent ? <Check className="w-3 h-3" /> : null}
                          {d.acknowledgement_sent ? 'Sent' : 'Pending'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteInkind(d.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
