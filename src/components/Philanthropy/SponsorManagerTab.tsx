import React, { useState, useEffect, useCallback } from 'react';
import { Gem, Plus, Trash2, Loader2, Edit2, DollarSign, Check, Building2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilSponsor, PhilSponsorTier, PhilPaymentStatus } from '../../types';

// ─── Constants ─────────────────────────────────────────────

const PAYMENT_COLORS: Record<PhilPaymentStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  waived: 'bg-blue-100 text-blue-700',
};

const PAYMENT_OPTIONS: { value: PhilPaymentStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'waived', label: 'Waived' },
];

interface OrgOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
}

// ─── Tier Form ─────────────────────────────────────────────

interface TierFormData {
  name: string;
  amount: string;
  benefits: string;
  max_sponsors: string;
}

const EMPTY_TIER_FORM: TierFormData = { name: '', amount: '', benefits: '', max_sponsors: '' };

// ─── Sponsor Form ──────────────────────────────────────────

interface SponsorFormData {
  organization_id: string;
  contact_id: string;
  tier_id: string;
  payment_status: PhilPaymentStatus;
  payment_amount: string;
  hole_assignment: string;
  logo_received: boolean;
  notes: string;
}

const EMPTY_SPONSOR_FORM: SponsorFormData = {
  organization_id: '',
  contact_id: '',
  tier_id: '',
  payment_status: 'pending',
  payment_amount: '',
  hole_assignment: '',
  logo_received: false,
  notes: '',
};

// ─── Component ─────────────────────────────────────────────

const SponsorManagerTab: React.FC<{ eventId: string }> = ({ eventId }) => {
  const { user } = useAuth();

  // Data
  const [tiers, setTiers] = useState<PhilSponsorTier[]>([]);
  const [sponsors, setSponsors] = useState<PhilSponsor[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactOrgs, setContactOrgs] = useState<{ contact_id: string; organization_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline create org
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [savingNewOrg, setSavingNewOrg] = useState(false);

  // Inline create contact
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState('');
  const [newContactLast, setNewContactLast] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [savingNewContact, setSavingNewContact] = useState(false);
  const [promptLinkContact, setPromptLinkContact] = useState(false);
  const [newlyCreatedContactId, setNewlyCreatedContactId] = useState<string | null>(null);

  // Tier form
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierForm, setTierForm] = useState<TierFormData>(EMPTY_TIER_FORM);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState(false);

  // Sponsor form
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [sponsorForm, setSponsorForm] = useState<SponsorFormData>(EMPTY_SPONSOR_FORM);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [savingSponsor, setSavingSponsor] = useState(false);

  // Inline payment edit
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  // ─── Fetch ───────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tiersRes, sponsorsRes, orgsRes, contactsRes, contactOrgsRes] = await Promise.all([
      supabase
        .from('phil_sponsor_tiers')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order'),
      supabase
        .from('phil_sponsors')
        .select('*, tier:phil_sponsor_tiers(*), organization:organizations(id, name), contact:contacts(id, first_name, last_name)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase.from('organizations').select('id, name').order('name'),
      supabase.from('contacts').select('id, first_name, last_name').order('last_name'),
      supabase.from('contact_organizations').select('contact_id, organization_id'),
    ]);

    if (tiersRes.data) setTiers(tiersRes.data as PhilSponsorTier[]);
    if (sponsorsRes.data) setSponsors(sponsorsRes.data as PhilSponsor[]);
    if (orgsRes.data) setOrgs(orgsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (contactOrgsRes.data) setContactOrgs(contactOrgsRes.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Summary Stats ───────────────────────────────────────

  const totalSponsors = sponsors.length;
  const totalCommitted = sponsors.reduce((s, sp) => s + (sp.payment_amount || 0), 0);
  const totalReceived = sponsors
    .filter((sp) => sp.payment_status === 'paid')
    .reduce((s, sp) => s + (sp.payment_amount || 0), 0);
  const holesAssigned = sponsors.filter((sp) => sp.hole_assignment).length;

  // ─── Tier CRUD ───────────────────────────────────────────

  const handleTierFormChange = (field: keyof TierFormData, value: string) => {
    setTierForm((prev) => ({ ...prev, [field]: value }));
  };

  const openTierEdit = (tier: PhilSponsorTier) => {
    setEditingTierId(tier.id);
    setTierForm({
      name: tier.name,
      amount: String(tier.amount),
      benefits: (tier.benefits || []).join(', '),
      max_sponsors: tier.max_sponsors != null ? String(tier.max_sponsors) : '',
    });
    setShowTierForm(true);
  };

  const cancelTierForm = () => {
    setShowTierForm(false);
    setEditingTierId(null);
    setTierForm(EMPTY_TIER_FORM);
  };

  const saveTier = async () => {
    if (!tierForm.name.trim()) return;
    setSavingTier(true);

    const payload = {
      event_id: eventId,
      name: tierForm.name.trim(),
      amount: parseFloat(tierForm.amount) || 0,
      benefits: tierForm.benefits
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean),
      max_sponsors: tierForm.max_sponsors ? parseInt(tierForm.max_sponsors, 10) : null,
      sort_order: editingTierId
        ? tiers.find((t) => t.id === editingTierId)?.sort_order ?? tiers.length
        : tiers.length,
      created_by: user!.id,
    };

    if (editingTierId) {
      await supabase.from('phil_sponsor_tiers').update(payload).eq('id', editingTierId);
    } else {
      await supabase.from('phil_sponsor_tiers').insert(payload);
    }

    cancelTierForm();
    setSavingTier(false);
    fetchAll();
  };

  const deleteTier = async (id: string) => {
    if (!confirm('Delete this tier? Sponsors in this tier will become unassigned.')) return;
    await supabase.from('phil_sponsor_tiers').delete().eq('id', id);
    fetchAll();
  };

  // ─── Sponsor CRUD ────────────────────────────────────────

  const handleSponsorFormChange = (field: keyof SponsorFormData, value: string | boolean) => {
    setSponsorForm((prev) => ({ ...prev, [field]: value }));
  };

  const openSponsorEdit = (sp: PhilSponsor) => {
    setEditingSponsorId(sp.id);
    setSponsorForm({
      organization_id: sp.organization_id || '',
      contact_id: sp.contact_id || '',
      tier_id: sp.tier_id || '',
      payment_status: sp.payment_status,
      payment_amount: String(sp.payment_amount || ''),
      hole_assignment: sp.hole_assignment || '',
      logo_received: sp.logo_received,
      notes: sp.notes || '',
    });
    setShowSponsorForm(true);
  };

  const cancelSponsorForm = () => {
    setShowSponsorForm(false);
    setEditingSponsorId(null);
    setSponsorForm(EMPTY_SPONSOR_FORM);
  };

  const saveSponsor = async () => {
    setSavingSponsor(true);

    const payload = {
      event_id: eventId,
      organization_id: sponsorForm.organization_id || null,
      contact_id: sponsorForm.contact_id || null,
      tier_id: sponsorForm.tier_id || null,
      payment_status: sponsorForm.payment_status,
      payment_amount: parseFloat(sponsorForm.payment_amount) || 0,
      hole_assignment: sponsorForm.hole_assignment.trim() || null,
      logo_received: sponsorForm.logo_received,
      notes: sponsorForm.notes.trim() || null,
      created_by: user!.id,
    };

    if (editingSponsorId) {
      await supabase.from('phil_sponsors').update(payload).eq('id', editingSponsorId);
    } else {
      await supabase.from('phil_sponsors').insert(payload);
    }

    cancelSponsorForm();
    setSavingSponsor(false);
    fetchAll();
  };

  const deleteSponsor = async (id: string) => {
    if (!confirm('Remove this sponsor?')) return;
    await supabase.from('phil_sponsors').delete().eq('id', id);
    fetchAll();
  };

  const updatePaymentStatus = async (id: string, status: PhilPaymentStatus) => {
    await supabase.from('phil_sponsors').update({ payment_status: status }).eq('id', id);
    setEditingPaymentId(null);
    fetchAll();
  };

  // ─── Inline Create Org ────────────────────────────────────

  const createNewOrg = async () => {
    if (!newOrgName.trim()) return;
    setSavingNewOrg(true);
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name: newOrgName.trim(), created_by: user!.id })
      .select('id, name')
      .single();
    setSavingNewOrg(false);
    if (data && !error) {
      setOrgs((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      handleSponsorFormChange('organization_id', data.id);
      // Reset contact when org changes
      handleSponsorFormChange('contact_id', '');
      setNewOrgName('');
      setShowNewOrg(false);
    }
  };

  // ─── Inline Create Contact ──────────────────────────────

  const createNewContact = async () => {
    if (!newContactFirst.trim() || !newContactLast.trim()) return;
    setSavingNewContact(true);
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        first_name: newContactFirst.trim(),
        last_name: newContactLast.trim(),
        email_work: newContactEmail.trim() || null,
        title: newContactTitle.trim() || null,
        created_by: user!.id,
      })
      .select('id, first_name, last_name')
      .single();
    setSavingNewContact(false);
    if (data && !error) {
      setContacts((prev) => [...prev, data].sort((a, b) => (a.last_name || '').localeCompare(b.last_name || '')));
      handleSponsorFormChange('contact_id', data.id);
      setNewlyCreatedContactId(data.id);
      setNewContactFirst('');
      setNewContactLast('');
      setNewContactEmail('');
      setNewContactTitle('');
      setShowNewContact(false);
      // If org is selected, prompt to link
      if (sponsorForm.organization_id) {
        setPromptLinkContact(true);
      }
    }
  };

  const linkContactToOrg = async () => {
    if (!newlyCreatedContactId || !sponsorForm.organization_id) return;
    await supabase.from('contact_organizations').insert({
      contact_id: newlyCreatedContactId,
      organization_id: sponsorForm.organization_id,
      is_primary: true,
      created_by: user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setContactOrgs((prev) => [...prev, { contact_id: newlyCreatedContactId!, organization_id: sponsorForm.organization_id }]);
    setPromptLinkContact(false);
    setNewlyCreatedContactId(null);
  };

  // ─── Filtered contacts based on selected org ────────────

  const filteredContacts = sponsorForm.organization_id
    ? (() => {
        const linkedContactIds = new Set(
          contactOrgs
            .filter((co) => co.organization_id === sponsorForm.organization_id)
            .map((co) => co.contact_id)
        );
        return contacts.filter((c) => linkedContactIds.has(c.id));
      })()
    : contacts;

  // ─── Helpers ─────────────────────────────────────────────

  const sponsorName = (sp: PhilSponsor) => {
    const org = (sp as any).organization;
    const ct = (sp as any).contact;
    const parts: string[] = [];
    if (org?.name) parts.push(org.name);
    if (ct) parts.push(`${ct.first_name || ''} ${ct.last_name || ''}`.trim());
    return parts.join(' / ') || '(unnamed)';
  };

  const tierSponsorCount = (tierId: string) =>
    sponsors.filter((sp) => sp.tier_id === tierId).length;

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Sponsors', value: totalSponsors },
          { label: 'Total Committed', value: `$${totalCommitted.toLocaleString()}` },
          { label: 'Total Received', value: `$${totalReceived.toLocaleString()}` },
          { label: 'Holes Assigned', value: holesAssigned },
        ].map((s) => (
          <div key={s.label} className="bg-rose-50 rounded-xl p-4 text-center">
            <p className="text-xs text-rose-600 font-medium">{s.label}</p>
            <p className="text-xl font-bold text-rose-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tier Management ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-600" />
            Sponsor Tiers
          </h3>
          {!showTierForm && (
            <button
              onClick={() => {
                setEditingTierId(null);
                setTierForm(EMPTY_TIER_FORM);
                setShowTierForm(true);
              }}
              className="flex items-center gap-1.5 text-sm bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Tier
            </button>
          )}
        </div>

        {/* Tier inline form */}
        {showTierForm && (
          <div className="bg-white border-2 border-rose-200 rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tier Name *</label>
                <input
                  type="text"
                  value={tierForm.name}
                  onChange={(e) => handleTierFormChange('name', e.target.value)}
                  placeholder="e.g. Gold"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($)</label>
                <input
                  type="number"
                  value={tierForm.amount}
                  onChange={(e) => handleTierFormChange('amount', e.target.value)}
                  placeholder="5000"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Sponsors</label>
                <input
                  type="number"
                  value={tierForm.max_sponsors}
                  onChange={(e) => handleTierFormChange('max_sponsors', e.target.value)}
                  placeholder="Unlimited"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Benefits (comma-separated)</label>
                <input
                  type="text"
                  value={tierForm.benefits}
                  onChange={(e) => handleTierFormChange('benefits', e.target.value)}
                  placeholder="Logo on banner, 4 tickets"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveTier}
                disabled={savingTier || !tierForm.name.trim()}
                className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {savingTier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingTierId ? 'Update Tier' : 'Save Tier'}
              </button>
              <button
                onClick={cancelTierForm}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tiers list */}
        {tiers.length === 0 && !showTierForm ? (
          <p className="text-sm text-gray-400 italic">No tiers defined yet.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map((tier) => {
              const count = tierSponsorCount(tier.id);
              return (
                <div
                  key={tier.id}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">{tier.name}</span>
                      <span className="text-sm text-gray-500">${tier.amount.toLocaleString()}</span>
                      <span className="text-xs text-gray-400">
                        {count}
                        {tier.max_sponsors != null ? ` / ${tier.max_sponsors}` : ''} sponsors
                      </span>
                    </div>
                    {tier.benefits && tier.benefits.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {tier.benefits.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() => openTierEdit(tier)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 transition"
                      title="Edit tier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTier(tier.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition"
                      title="Delete tier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Sponsors List ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Gem className="w-5 h-5 text-rose-600" />
            Sponsors
          </h3>
          {!showSponsorForm && (
            <button
              onClick={() => {
                setEditingSponsorId(null);
                setSponsorForm(EMPTY_SPONSOR_FORM);
                setShowSponsorForm(true);
              }}
              className="flex items-center gap-1.5 text-sm bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Sponsor
            </button>
          )}
        </div>

        {/* Sponsor form */}
        {showSponsorForm && (
          <div className="bg-white border-2 border-rose-200 rounded-xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Organization */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Organization</label>
                {showNewOrg ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Organization name"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button onClick={createNewOrg} disabled={savingNewOrg || !newOrgName.trim()}
                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50 transition">
                        {savingNewOrg ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add to CRM
                      </button>
                      <button onClick={() => { setShowNewOrg(false); setNewOrgName(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={sponsorForm.organization_id}
                      onChange={(e) => {
                        handleSponsorFormChange('organization_id', e.target.value);
                        // Reset contact when org changes
                        handleSponsorFormChange('contact_id', '');
                      }}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                    >
                      <option value="">-- Select --</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                    <button onClick={() => setShowNewOrg(true)}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium">
                      <Building2 className="w-3 h-3" /> Add new organization to CRM
                    </button>
                  </div>
                )}
              </div>

              {/* Contact — filtered by selected org */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Contact
                  {sponsorForm.organization_id && filteredContacts.length === 0 && !showNewContact && (
                    <span className="text-amber-600 font-normal ml-1">(no contacts linked to this org)</span>
                  )}
                </label>
                {showNewContact ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="text" value={newContactFirst} onChange={(e) => setNewContactFirst(e.target.value)}
                        placeholder="First name *" autoFocus
                        className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none" />
                      <input type="text" value={newContactLast} onChange={(e) => setNewContactLast(e.target.value)}
                        placeholder="Last name *"
                        className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none" />
                    </div>
                    <input type="email" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)}
                      placeholder="Email (optional)"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none" />
                    <input type="text" value={newContactTitle} onChange={(e) => setNewContactTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none" />
                    <div className="flex gap-1.5">
                      <button onClick={createNewContact} disabled={savingNewContact || !newContactFirst.trim() || !newContactLast.trim()}
                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50 transition">
                        {savingNewContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Add to CRM
                      </button>
                      <button onClick={() => { setShowNewContact(false); setNewContactFirst(''); setNewContactLast(''); setNewContactEmail(''); setNewContactTitle(''); }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={sponsorForm.contact_id}
                      onChange={(e) => handleSponsorFormChange('contact_id', e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                    >
                      <option value="">-- Select --</option>
                      {filteredContacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                      ))}
                      {sponsorForm.organization_id && filteredContacts.length > 0 && (
                        <option disabled>───────────</option>
                      )}
                      {sponsorForm.organization_id && (
                        <option disabled className="text-gray-400">
                          {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} linked to this org
                        </option>
                      )}
                    </select>
                    <button onClick={() => setShowNewContact(true)}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium">
                      <User className="w-3 h-3" /> Add new contact to CRM
                    </button>
                  </div>
                )}

                {/* Prompt to link newly created contact to selected org */}
                {promptLinkContact && sponsorForm.organization_id && (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <p className="text-sm text-purple-900 font-medium">
                      Link this contact to {orgs.find((o) => o.id === sponsorForm.organization_id)?.name}?
                    </p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      This will assign the contact to the organization in the CRM.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={linkContactToOrg}
                        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition">
                        Yes, link them
                      </button>
                      <button onClick={() => { setPromptLinkContact(false); setNewlyCreatedContactId(null); }}
                        className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-xs transition">
                        No, skip
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tier */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
                <select
                  value={sponsorForm.tier_id}
                  onChange={(e) => handleSponsorFormChange('tier_id', e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                >
                  <option value="">-- Select --</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (${t.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
                <select
                  value={sponsorForm.payment_status}
                  onChange={(e) => handleSponsorFormChange('payment_status', e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                >
                  {PAYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  value={sponsorForm.payment_amount}
                  onChange={(e) => handleSponsorFormChange('payment_amount', e.target.value)}
                  placeholder="0"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>

              {/* Hole Assignment */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hole Assignment</label>
                <input
                  type="text"
                  value={sponsorForm.hole_assignment}
                  onChange={(e) => handleSponsorFormChange('hole_assignment', e.target.value)}
                  placeholder="e.g. Hole 7"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
            </div>

            {/* Logo + Notes row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sponsorForm.logo_received}
                  onChange={(e) => handleSponsorFormChange('logo_received', e.target.checked)}
                  className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                />
                Logo Received
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={sponsorForm.notes}
                  onChange={(e) => handleSponsorFormChange('notes', e.target.value)}
                  placeholder="Optional notes"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-rose-400 focus:ring-0 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={saveSponsor}
                disabled={savingSponsor}
                className="flex items-center gap-1.5 bg-rose-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {savingSponsor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingSponsorId ? 'Update Sponsor' : 'Save Sponsor'}
              </button>
              <button
                onClick={cancelSponsorForm}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Sponsors table */}
        {sponsors.length === 0 && !showSponsorForm ? (
          <p className="text-sm text-gray-400 italic">No sponsors added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 font-medium text-gray-500">Organization / Contact</th>
                  <th className="pb-2 font-medium text-gray-500">Tier</th>
                  <th className="pb-2 font-medium text-gray-500">Status</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Amount</th>
                  <th className="pb-2 font-medium text-gray-500">Hole</th>
                  <th className="pb-2 font-medium text-gray-500 text-center">Logo</th>
                  <th className="pb-2 font-medium text-gray-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((sp) => (
                  <tr key={sp.id} className="border-b border-gray-100 hover:bg-rose-50/40 transition">
                    <td className="py-2.5 font-medium text-gray-800">{sponsorName(sp)}</td>
                    <td className="py-2.5 text-gray-600">{sp.tier?.name || '—'}</td>
                    <td className="py-2.5">
                      {editingPaymentId === sp.id ? (
                        <select
                          value={sp.payment_status}
                          onChange={(e) =>
                            updatePaymentStatus(sp.id, e.target.value as PhilPaymentStatus)
                          }
                          onBlur={() => setEditingPaymentId(null)}
                          autoFocus
                          className="text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:border-rose-400 outline-none"
                        >
                          {PAYMENT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingPaymentId(sp.id)}
                          className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${PAYMENT_COLORS[sp.payment_status]}`}
                          title="Click to change status"
                        >
                          {sp.payment_status.replace(/_/g, ' ')}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-gray-700">
                      {sp.payment_amount ? `$${sp.payment_amount.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5 text-gray-600">{sp.hole_assignment || '—'}</td>
                    <td className="py-2.5 text-center">
                      {sp.logo_received ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openSponsorEdit(sp)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 transition"
                          title="Edit sponsor"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSponsor(sp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition"
                          title="Remove sponsor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SponsorManagerTab;
