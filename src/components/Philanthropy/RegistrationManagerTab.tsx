import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Search,
  Loader2,
  Check,
  X,
  DollarSign,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type {
  PhilRegistration,
  PhilRegistrationRole,
  Contact,
  Organization,
} from '../../types';

// ─── Constants ──────────────────────────────────────────────

const ROLE_OPTIONS: { value: PhilRegistrationRole; label: string }[] = [
  { value: 'golfer', label: 'Golfer' },
  { value: 'dinner_only', label: 'Dinner Only' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'vip', label: 'VIP' },
  { value: 'speaker', label: 'Speaker' },
];

const ROLE_BADGE_COLORS: Record<PhilRegistrationRole, string> = {
  golfer: 'bg-blue-100 text-blue-700',
  dinner_only: 'bg-purple-100 text-purple-700',
  volunteer: 'bg-teal-100 text-teal-700',
  vip: 'bg-amber-100 text-amber-700',
  speaker: 'bg-rose-100 text-rose-700',
};

const ROLE_LABELS: Record<PhilRegistrationRole, string> = {
  golfer: 'Golfer',
  dinner_only: 'Dinner Only',
  volunteer: 'Volunteer',
  vip: 'VIP',
  speaker: 'Speaker',
};

const SHIRT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

type PaymentFilter = 'all' | 'paid' | 'unpaid';

type RegistrationWithJoins = Omit<PhilRegistration, 'contact' | 'organization'> & {
  contact?: Pick<Contact, 'id' | 'first_name' | 'last_name'> | null;
  organization?: Pick<Organization, 'id' | 'name'> | null;
  _autoSponsor?: boolean; // display-only: auto-detected from phil_sponsors
};

interface FormData {
  contact_id: string;
  organization_id: string;
  role: PhilRegistrationRole;
  fee_amount: string;
  fee_paid: boolean;
  is_vip: boolean;
  promo_code: string;
  dietary_restrictions: string;
  shirt_size: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  contact_id: '',
  organization_id: '',
  role: 'golfer',
  fee_amount: '',
  fee_paid: false,
  is_vip: false,
  promo_code: '',
  dietary_restrictions: '',
  shirt_size: '',
  notes: '',
};

// ─── Helpers ────────────────────────────────────────────────

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function contactDisplayName(
  c: Pick<Contact, 'first_name' | 'last_name'> | null | undefined,
): string {
  if (!c) return '—';
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || '—';
}

// ─── Component ──────────────────────────────────────────────

export default function RegistrationManagerTab({ eventId }: { eventId: string }) {
  const { user } = useAuth();

  // Data
  const [registrations, setRegistrations] = useState<RegistrationWithJoins[]>([]);
  const [contacts, setContacts] = useState<Pick<Contact, 'id' | 'first_name' | 'last_name'>[]>([]);
  const [organizations, setOrganizations] = useState<Pick<Organization, 'id' | 'name'>[]>([]);
  const [sponsorContactIds, setSponsorContactIds] = useState<Set<string>>(new Set());
  const [sponsorOrgIds, setSponsorOrgIds] = useState<Set<string>>(new Set());
  const [teamAssignedIds, setTeamAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<PhilRegistrationRole | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [checkinFilter, setCheckinFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [contactSearch, setContactSearch] = useState('');
  const [orgSearch, setOrgSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Fetch registrations ──

  const fetchRegistrations = useCallback(async () => {
    const { data, error } = await supabase
      .from('phil_registrations')
      .select('*, contact:contacts(id, first_name, last_name), organization:organizations(id, name)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRegistrations(data as RegistrationWithJoins[]);
    }
  }, [eventId]);

  // ── Initial load ──

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      const [, contactsRes, orgsRes, sponsorsRes, teamMembersRes] = await Promise.all([
        fetchRegistrations(),
        supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .order('last_name', { ascending: true })
          .limit(500),
        supabase
          .from('organizations')
          .select('id, name')
          .order('name', { ascending: true })
          .limit(500),
        supabase
          .from('phil_sponsors')
          .select('contact_id, organization_id')
          .eq('event_id', eventId),
        supabase
          .from('phil_team_members')
          .select('registration_id, team:phil_teams!inner(event_id)')
          .eq('team.event_id', eventId),
      ]);

      if (contactsRes.data) setContacts(contactsRes.data);
      if (orgsRes.data) setOrganizations(orgsRes.data);

      // Build sponsor lookup sets
      if (sponsorsRes.data) {
        const cIds = new Set<string>();
        const oIds = new Set<string>();
        for (const s of sponsorsRes.data) {
          if (s.contact_id) cIds.add(s.contact_id);
          if (s.organization_id) oIds.add(s.organization_id);
        }
        setSponsorContactIds(cIds);
        setSponsorOrgIds(oIds);
      }

      // Build team-assigned registration set (for green/red golfer name coloring)
      if (teamMembersRes.data) {
        const assigned = new Set<string>();
        for (const m of teamMembersRes.data as { registration_id: string }[]) {
          if (m.registration_id) assigned.add(m.registration_id);
        }
        setTeamAssignedIds(assigned);
      }

      setLoading(false);
    }

    loadAll();
  }, [fetchRegistrations, eventId]);

  // ── Enrich registrations with auto-sponsor detection ──

  const enrichedRegistrations = useMemo(() => {
    return registrations.map((r) => {
      const autoSponsor =
        (r.contact_id && sponsorContactIds.has(r.contact_id)) ||
        (r.organization_id && sponsorOrgIds.has(r.organization_id)) ||
        false;
      return { ...r, _autoSponsor: autoSponsor };
    });
  }, [registrations, sponsorContactIds, sponsorOrgIds]);

  // ── Summary stats ──

  const stats = useMemo(() => {
    const total = enrichedRegistrations.length;
    const roleCounts: Record<PhilRegistrationRole, number> = {
      golfer: 0,
      dinner_only: 0,
      volunteer: 0,
      vip: 0,
      speaker: 0,
    };
    let feesCollected = 0;
    let feesOutstanding = 0;
    let sponsorCount = 0;
    let vipCount = 0;
    let checkedInCount = 0;

    for (const r of enrichedRegistrations) {
      if (r.role in roleCounts) roleCounts[r.role]++;
      const amt = r.fee_amount || 0;
      if (r.fee_paid) {
        feesCollected += amt;
      } else {
        feesOutstanding += amt;
      }
      if (r.is_sponsor || r._autoSponsor) sponsorCount++;
      if (r.is_vip) vipCount++;
      if (r.checked_in) checkedInCount++;
    }

    return { total, roleCounts, feesCollected, feesOutstanding, sponsorCount, vipCount, checkedInCount };
  }, [enrichedRegistrations]);

  // ── Filtered list ──

  const filtered = useMemo(() => {
    return enrichedRegistrations.filter((r) => {
      // Role filter
      if (roleFilter !== 'all' && r.role !== roleFilter) return false;

      // Payment filter
      if (paymentFilter === 'paid' && !r.fee_paid) return false;
      if (paymentFilter === 'unpaid' && r.fee_paid) return false;

      // Check-in filter
      if (checkinFilter === 'checked_in' && r.checked_in !== true) return false;
      if (checkinFilter === 'not_checked_in' && r.checked_in === true) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = contactDisplayName(r.contact).toLowerCase();
        const org = r.organization?.name?.toLowerCase() || '';
        const promo = r.promo_code?.toLowerCase() || '';
        if (!name.includes(q) && !org.includes(q) && !promo.includes(q)) return false;
      }

      return true;
    });
  }, [enrichedRegistrations, roleFilter, paymentFilter, checkinFilter, searchQuery]);

  // ── Contact / Org dropdowns filtered ──

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter((c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q),
    );
  }, [contacts, contactSearch]);

  const filteredOrgs = useMemo(() => {
    if (!orgSearch.trim()) return organizations;
    const q = orgSearch.toLowerCase();
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [organizations, orgSearch]);

  // ── Toggle fee paid ──

  const toggleFeePaid = async (reg: RegistrationWithJoins) => {
    setTogglingId(reg.id);
    const { error } = await supabase
      .from('phil_registrations')
      .update({ fee_paid: !reg.fee_paid })
      .eq('id', reg.id);

    if (!error) {
      setRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, fee_paid: !r.fee_paid } : r)),
      );
    }
    setTogglingId(null);
  };

  // ── Toggle check-in ──

  const toggleCheckIn = async (regId: string, currentlyCheckedIn: boolean) => {
    const now = new Date().toISOString();
    await supabase.from('phil_registrations').update({
      checked_in: !currentlyCheckedIn,
      checked_in_at: !currentlyCheckedIn ? now : null,
    }).eq('id', regId);
    await fetchRegistrations();
  };

  // ── Handle form input ──

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Save registration ──

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      event_id: eventId,
      contact_id: formData.contact_id || null,
      organization_id: formData.organization_id || null,
      role: formData.role,
      registration_date: new Date().toISOString().split('T')[0],
      fee_amount: formData.fee_amount ? parseFloat(formData.fee_amount) : 0,
      fee_paid: formData.fee_paid,
      is_vip: formData.is_vip,
      promo_code: formData.promo_code || null,
      dietary_restrictions: formData.dietary_restrictions || null,
      shirt_size: formData.shirt_size || null,
      notes: formData.notes || null,
      waiver_signed: false,
      created_by: user.id,
    };

    const { error } = await supabase.from('phil_registrations').insert(payload);

    if (!error) {
      setFormData(EMPTY_FORM);
      setShowForm(false);
      setContactSearch('');
      setOrgSearch('');
      await fetchRegistrations();
    }

    setSaving(false);
  };

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
      {/* ─── Summary Stats ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        {ROLE_OPTIONS.map(({ value, label }) => (
          <div key={value} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{stats.roleCounts[value]}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Fees Collected</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.feesCollected)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Fees Outstanding</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.feesOutstanding)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Sponsors</p>
          <p className="text-2xl font-bold text-amber-700">{stats.sponsorCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">VIPs</p>
          <p className="text-2xl font-bold text-rose-700">{stats.vipCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-50 text-green-600">
            <Check className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Checked In</p>
            <p className="text-xl font-bold text-gray-900">{stats.checkedInCount}/{stats.total}</p>
          </div>
        </div>
      </div>

      {/* ─── Search / Filter / Add ──────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, org, or promo code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as PhilRegistrationRole | 'all')}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          >
            <option value="all">All Roles</option>
            {ROLE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* Payment filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>

          {/* Check-in filter */}
          <div className="flex gap-1.5">
            {(['all', 'not_checked_in', 'checked_in'] as const).map((f) => (
              <button key={f} onClick={() => setCheckinFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  checkinFilter === f ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {f === 'all' ? 'All' : f === 'checked_in' ? 'Checked In' : 'Not Checked In'}
              </button>
            ))}
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors whitespace-nowrap"
          >
            {showForm ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Registration
              </>
            )}
          </button>
        </div>

        {/* ─── Add Registration Form ────────────────────── */}
        {showForm && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 mb-1"
                />
                <select
                  value={formData.contact_id}
                  onChange={(e) => handleInputChange('contact_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="">Select contact...</option>
                  {filteredContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                <input
                  type="text"
                  placeholder="Search organizations..."
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 mb-1"
                />
                <select
                  value={formData.organization_id}
                  onChange={(e) => handleInputChange('organization_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="">Select organization...</option>
                  {filteredOrgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                >
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fee Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.fee_amount}
                    onChange={(e) => handleInputChange('fee_amount', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Fee Paid + VIP */}
              <div className="flex items-end pb-2 gap-5">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.fee_paid}
                    onChange={(e) => handleInputChange('fee_paid', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Fee Paid</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_vip}
                    onChange={(e) => handleInputChange('is_vip', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-sm font-medium text-gray-700">VIP</span>
                </label>
              </div>

              {/* Promo Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
                <input
                  type="text"
                  value={formData.promo_code}
                  onChange={(e) => handleInputChange('promo_code', e.target.value)}
                  placeholder="Enter promo code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              {/* Dietary Restrictions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dietary Restrictions
                </label>
                <input
                  type="text"
                  value={formData.dietary_restrictions}
                  onChange={(e) => handleInputChange('dietary_restrictions', e.target.value)}
                  placeholder="e.g. vegetarian, gluten-free"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              {/* Shirt Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shirt Size</label>
                <select
                  value={formData.shirt_size}
                  onChange={(e) => handleInputChange('shirt_size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="">Select size...</option>
                  {SHIRT_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save Registration
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Registration Table ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">No registrations found</p>
            <p className="text-sm text-gray-500 mt-1">
              {registrations.length === 0
                ? 'Add the first registration for this event.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fee
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waiver
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Promo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check In
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((reg) => {
                  const isGolfer = reg.role === 'golfer';
                  const isOnTeam = teamAssignedIds.has(reg.id);
                  const nameColor = isGolfer
                    ? (isOnTeam ? 'text-green-700 font-medium' : 'text-red-600 font-medium')
                    : 'text-gray-900';
                  return (
                  <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                    {/* Contact */}
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${nameColor}`}
                      title={isGolfer ? (isOnTeam ? 'Assigned to a team' : 'Unassigned — not on a team') : undefined}>
                      {contactDisplayName(reg.contact)}
                      {(reg.is_sponsor || reg._autoSponsor) && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-1">Sponsor</span>
                      )}
                      {reg.is_vip && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 ml-1">VIP</span>
                      )}
                    </td>

                    {/* Organization */}
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {reg.organization?.name || '—'}
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${
                          ROLE_BADGE_COLORS[reg.role] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ROLE_LABELS[reg.role] || reg.role.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Fee */}
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {reg.fee_amount ? formatCurrency(reg.fee_amount) : '—'}
                    </td>

                    {/* Fee Paid toggle */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => toggleFeePaid(reg)}
                        disabled={togglingId === reg.id}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
                          reg.fee_paid
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={reg.fee_paid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        {togglingId === reg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : reg.fee_paid ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>

                    {/* Waiver */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {reg.waiver_signed ? (
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                          Signed
                        </span>
                      ) : (
                        <span className="inline-flex text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Promo Code */}
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {reg.promo_code || '—'}
                    </td>

                    {/* Check In */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => toggleCheckIn(reg.id, reg.checked_in)}
                        className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                          reg.checked_in
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {reg.checked_in ? '✓ Checked In' : 'Check In'}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
