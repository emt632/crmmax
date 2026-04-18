import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CalendarDays, ArrowLeft, Save, Loader2, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { US_STATES } from '../../lib/bill-format';
import type { PhilEvent, PhilEventType, PhilEventStatus } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<PhilEventType, string> = {
  golf_outing: 'Golf Outing',
  gala: 'Gala',
  '5k': '5K Run/Walk',
  auction: 'Auction',
  walkathon: 'Walkathon',
  other: 'Other',
};

const EVENT_STATUS_LABELS: Record<PhilEventStatus, string> = {
  planning: 'Planning',
  open_registration: 'Open Registration',
  sold_out: 'Sold Out',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ─── Style tokens ────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all';
const selectClass =
  'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all bg-white';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
const sectionClass = 'bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4';

// ─── Form Data Shape ─────────────────────────────────────────────────────────

interface EventFormData {
  name: string;
  event_type: PhilEventType;
  status: PhilEventStatus;
  start_date: string;
  end_date: string;
  venue_name: string;
  venue_address: string;
  venue_city: string;
  venue_state: string;
  venue_zip: string;
  budget_amount: string;
  goal_amount: string;
  capacity: string;
  description: string;
  notes: string;
}

const emptyForm: EventFormData = {
  name: '',
  event_type: 'golf_outing',
  status: 'planning',
  start_date: '',
  end_date: '',
  venue_name: '',
  venue_address: '',
  venue_city: '',
  venue_state: '',
  venue_zip: '',
  budget_amount: '',
  goal_amount: '',
  capacity: '',
  description: '',
  notes: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canEditModule } = useAuth();

  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<EventFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Access gate — redirect away if user can't edit
  useEffect(() => {
    if (!canEditModule('philanthropy')) {
      navigate('/philanthropy/events', { replace: true });
    }
  }, [canEditModule, navigate]);

  // ── Fetch existing event for edit mode ──────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchEvent = async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('phil_events')
        .select('*')
        .eq('id', id)
        .single();

      if (cancelled) return;
      setLoading(false);

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Event not found');
        return;
      }

      const evt = data as PhilEvent;
      setFormData({
        name: evt.name,
        event_type: evt.event_type,
        status: evt.status,
        start_date: evt.start_date ?? '',
        end_date: evt.end_date ?? '',
        venue_name: evt.venue_name ?? '',
        venue_address: evt.venue_address ?? '',
        venue_city: evt.venue_city ?? '',
        venue_state: evt.venue_state ?? '',
        venue_zip: evt.venue_zip ?? '',
        budget_amount: evt.budget_amount != null ? String(evt.budget_amount) : '',
        goal_amount: evt.goal_amount != null ? String(evt.goal_amount) : '',
        capacity: evt.capacity != null ? String(evt.capacity) : '',
        description: evt.description ?? '',
        notes: evt.notes ?? '',
      });
    };

    fetchEvent();
    return () => { cancelled = true; };
  }, [id]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const handleInputChange = (field: keyof EventFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Event name is required.');
      return;
    }

    setSaving(true);

    const payload = {
      name: formData.name.trim(),
      event_type: formData.event_type,
      status: formData.status,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      venue_name: formData.venue_name.trim() || null,
      venue_address: formData.venue_address.trim() || null,
      venue_city: formData.venue_city.trim() || null,
      venue_state: formData.venue_state || null,
      venue_zip: formData.venue_zip.trim() || null,
      budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
      goal_amount: formData.goal_amount ? parseFloat(formData.goal_amount) : null,
      capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
      description: formData.description.trim() || null,
      notes: formData.notes.trim() || null,
    };

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('phil_events')
          .update(payload)
          .eq('id', id);

        if (updateError) throw updateError;
        navigate('/philanthropy/events');
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('phil_events')
          .insert({ ...payload, created_by: user?.id })
          .select('id')
          .single();

        if (insertError) throw insertError;
        navigate(`/philanthropy/events/${inserted.id}`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-rose-700 rounded-xl p-4 sm:p-5 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6" />
            <h1 className="text-xl font-bold">{isEdit ? 'Edit Event' : 'New Event'}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/philanthropy/events')}
            className="p-1.5 hover:bg-rose-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Basic Info ─────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Basic Info</h2>

          <div>
            <label className={labelClass}>
              Event Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g. Annual Charity Gala 2026"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Event Type</label>
              <select
                className={selectClass}
                value={formData.event_type}
                onChange={(e) => handleInputChange('event_type', e.target.value)}
              >
                {(Object.keys(EVENT_TYPE_LABELS) as PhilEventType[]).map((key) => (
                  <option key={key} value={key}>{EVENT_TYPE_LABELS[key]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select
                className={selectClass}
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {(Object.keys(EVENT_STATUS_LABELS) as PhilEventStatus[]).map((key) => (
                  <option key={key} value={key}>{EVENT_STATUS_LABELS[key]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Dates ──────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Dates</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input
                type="date"
                className={inputClass}
                value={formData.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>End Date</label>
              <input
                type="date"
                className={inputClass}
                value={formData.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Venue ──────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Venue</h2>

          <div>
            <label className={labelClass}>Venue Name</label>
            <input
              type="text"
              className={inputClass}
              value={formData.venue_name}
              onChange={(e) => handleInputChange('venue_name', e.target.value)}
              placeholder="e.g. Grand Ballroom"
            />
          </div>

          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text"
              className={inputClass}
              value={formData.venue_address}
              onChange={(e) => handleInputChange('venue_address', e.target.value)}
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>City</label>
              <input
                type="text"
                className={inputClass}
                value={formData.venue_city}
                onChange={(e) => handleInputChange('venue_city', e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>State</label>
              <select
                className={selectClass}
                value={formData.venue_state}
                onChange={(e) => handleInputChange('venue_state', e.target.value)}
              >
                <option value="">--</option>
                {US_STATES.filter((s) => s.value !== 'US').map((s) => (
                  <option key={s.value} value={s.value}>{s.value}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>ZIP</label>
              <input
                type="text"
                className={inputClass}
                value={formData.venue_zip}
                onChange={(e) => handleInputChange('venue_zip', e.target.value)}
                maxLength={10}
                placeholder="00000"
              />
            </div>
          </div>
        </div>

        {/* ── Financial ──────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Financial</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Budget ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={formData.budget_amount}
                onChange={(e) => handleInputChange('budget_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Goal ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={formData.goal_amount}
                onChange={(e) => handleInputChange('goal_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <label className={labelClass}>Capacity</label>
              <input
                type="number"
                min="0"
                step="1"
                className={inputClass}
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', e.target.value)}
                placeholder="e.g. 200"
              />
            </div>
          </div>
        </div>

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Notes</h2>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={inputClass}
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Public-facing event description..."
            />
          </div>

          <div>
            <label className={labelClass}>Internal Notes</label>
            <textarea
              className={inputClass}
              rows={3}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Internal planning notes..."
            />
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            type="button"
            onClick={() => navigate('/philanthropy/events')}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
