import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, Loader2, Award, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilContest, PhilRegistration, PhilSponsor, PhilContestType, Contact } from '../../types';

interface ContestsTabProps { eventId: string; }

const CONTEST_LABELS: Record<PhilContestType, string> = {
  longest_drive: 'Longest Drive',
  closest_to_pin: 'Closest to Pin',
  hole_in_one: 'Hole in One',
  putting: 'Putting Contest',
  other: 'Other',
};

const CONTEST_COLORS: Record<PhilContestType, string> = {
  longest_drive: 'bg-green-100 text-green-700',
  closest_to_pin: 'bg-blue-100 text-blue-700',
  hole_in_one: 'bg-amber-100 text-amber-700',
  putting: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-700',
};

const ContestsTab: React.FC<ContestsTabProps> = ({ eventId }) => {
  const { user } = useAuth();
  const [contests, setContests] = useState<(PhilContest & { winner_name?: string; sponsor_name?: string })[]>([]);
  const [registrations, setRegistrations] = useState<(PhilRegistration & { contact?: Contact })[]>([]);
  const [sponsors, setSponsors] = useState<PhilSponsor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    contest_type: 'longest_drive' as PhilContestType,
    hole_number: '' as string,
    prize_description: '',
    prize_value: '' as string,
    sponsor_id: '',
    notes: '',
  });

  // Record winner
  const [recordingWinnerId, setRecordingWinnerId] = useState<string | null>(null);
  const [winnerRegId, setWinnerRegId] = useState('');
  const [winnerResult, setWinnerResult] = useState('');

  useEffect(() => { fetchData(); }, [eventId]);

  const fetchData = async () => {
    setLoading(true);
    const [contestsRes, regsRes, sponsorsRes] = await Promise.all([
      supabase.from('phil_contests').select('*').eq('event_id', eventId).order('hole_number'),
      supabase.from('phil_registrations').select('*, contact:contact_id(id, first_name, last_name)').eq('event_id', eventId).eq('role', 'golfer'),
      supabase.from('phil_sponsors').select('*, organization:organization_id(name)').eq('event_id', eventId),
    ]);

    const contestList = (contestsRes.data || []) as PhilContest[];
    const regList = (regsRes.data || []) as any[];
    const sponsorList = (sponsorsRes.data || []) as any[];

    setRegistrations(regList);
    setSponsors(sponsorList);

    // Enrich contests with winner/sponsor names
    const regMap: Record<string, string> = {};
    for (const r of regList) {
      if (r.contact) regMap[r.id] = `${r.contact.first_name} ${r.contact.last_name}`;
    }
    const sponsorMap: Record<string, string> = {};
    for (const s of sponsorList) {
      sponsorMap[s.id] = s.organization?.name || 'Sponsor';
    }

    setContests(contestList.map((c) => ({
      ...c,
      winner_name: c.winner_registration_id ? regMap[c.winner_registration_id] : undefined,
      sponsor_name: c.sponsor_id ? sponsorMap[c.sponsor_id] : undefined,
    })));
    setLoading(false);
  };

  const addContest = async () => {
    await supabase.from('phil_contests').insert({
      event_id: eventId,
      contest_type: form.contest_type,
      hole_number: form.hole_number ? Number(form.hole_number) : null,
      prize_description: form.prize_description || null,
      prize_value: form.prize_value ? Number(form.prize_value) : null,
      sponsor_id: form.sponsor_id || null,
      notes: form.notes || null,
      created_by: user!.id,
    });
    setForm({ contest_type: 'longest_drive', hole_number: '', prize_description: '', prize_value: '', sponsor_id: '', notes: '' });
    setShowAdd(false);
    fetchData();
  };

  const deleteContest = async (id: string) => {
    await supabase.from('phil_contests').delete().eq('id', id);
    fetchData();
  };

  const recordWinner = async (contestId: string) => {
    if (!winnerRegId) return;
    await supabase.from('phil_contests').update({
      winner_registration_id: winnerRegId,
      winning_result: winnerResult || null,
    }).eq('id', contestId);
    setRecordingWinnerId(null);
    setWinnerRegId('');
    setWinnerResult('');
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Contests & Prizes</h3>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Contest
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Contest Type *</label>
              <select value={form.contest_type} onChange={(e) => setForm({ ...form, contest_type: e.target.value as PhilContestType })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm">
                {Object.entries(CONTEST_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Hole #</label>
              <input type="number" min={1} max={18} value={form.hole_number} onChange={(e) => setForm({ ...form, hole_number: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm" placeholder="1-18" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Prize Value ($)</label>
              <input type="number" min={0} step="0.01" value={form.prize_value} onChange={(e) => setForm({ ...form, prize_value: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Prize Description</label>
              <input value={form.prize_description} onChange={(e) => setForm({ ...form, prize_description: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm" placeholder="e.g., $500 Gift Card" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Sponsored By</label>
              <select value={form.sponsor_id} onChange={(e) => setForm({ ...form, sponsor_id: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm">
                <option value="">None</option>
                {sponsors.map((s: any) => <option key={s.id} value={s.id}>{s.organization?.name || 'Sponsor'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-100 focus:border-rose-500 transition-all text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={addContest} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">Save Contest</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Contest Cards */}
      {contests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No contests set up yet. Add a contest to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contests.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CONTEST_COLORS[c.contest_type]}`}>
                    {CONTEST_LABELS[c.contest_type]}
                  </span>
                  {c.hole_number && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" /> Hole {c.hole_number}
                    </span>
                  )}
                </div>
                <button onClick={() => deleteContest(c.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {c.prize_description && <p className="text-sm text-gray-900 font-medium">{c.prize_description}</p>}
              {c.prize_value && <p className="text-sm text-gray-600">${Number(c.prize_value).toLocaleString()} value</p>}
              {c.sponsor_name && <p className="text-xs text-gray-500">Sponsored by {c.sponsor_name}</p>}

              {/* Winner */}
              {c.winner_name ? (
                <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">{c.winner_name}</p>
                    {c.winning_result && <p className="text-xs text-amber-700">{c.winning_result}</p>}
                  </div>
                </div>
              ) : recordingWinnerId === c.id ? (
                <div className="space-y-2">
                  <select value={winnerRegId} onChange={(e) => setWinnerRegId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm">
                    <option value="">Select winner...</option>
                    {registrations.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.contact?.first_name} {r.contact?.last_name}</option>
                    ))}
                  </select>
                  <input value={winnerResult} onChange={(e) => setWinnerResult(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm" placeholder="Result (e.g., 285 yards)" />
                  <div className="flex gap-2">
                    <button onClick={() => recordWinner(c.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700">Save</button>
                    <button onClick={() => setRecordingWinnerId(null)} className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setRecordingWinnerId(c.id); setWinnerRegId(''); setWinnerResult(''); }}
                  className="w-full text-xs text-rose-600 hover:text-rose-700 font-medium py-2 border border-dashed border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
                  Record Winner
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContestsTab;
