import React, { useState, useEffect, useCallback } from 'react';
import { UsersRound, Plus, X, Loader2, Clock, Hash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { PhilTeam, PhilTeamMember, PhilRegistration } from '../../types';

// ─── Props ────────────────────────────────────────────────

interface TeamBuilderTabProps {
  eventId: string;
}

// ─── Component ────────────────────────────────────────────

export default function TeamBuilderTab({ eventId }: TeamBuilderTabProps) {
  const { user } = useAuth();

  const [teams, setTeams] = useState<PhilTeam[]>([]);
  const [allGolfers, setAllGolfers] = useState<PhilRegistration[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // ── Derived ──

  const assignedRegistrationIds = new Set(
    teams.flatMap((t) => t.members?.map((m) => m.registration_id) ?? [])
  );

  const unassignedGolfers = allGolfers.filter(
    (r) => !assignedRegistrationIds.has(r.id)
  );

  const teamsWithTeeTime = teams.filter((t) => t.tee_time).length;
  const teamsWithHole = teams.filter((t) => t.starting_hole !== null).length;
  const teamsWithOrg = teams.filter((t) => t.organization_id).length;

  // ── Fetch ──

  const fetchData = useCallback(async () => {
    const [teamsRes, golfersRes, orgsRes] = await Promise.all([
      supabase
        .from('phil_teams')
        .select(
          '*, organization:organizations(id, name), members:phil_team_members(*, registration:phil_registrations(*, contact:contacts(*)))'
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabase
        .from('phil_registrations')
        .select('*, contact:contacts(*)')
        .eq('event_id', eventId)
        .eq('role', 'golfer')
        .order('registration_date', { ascending: true }),
      supabase
        .from('organizations')
        .select('id, name')
        .order('name'),
    ]);

    if (teamsRes.data) setTeams(teamsRes.data);
    if (golfersRes.data) setAllGolfers(golfersRes.data);
    if (orgsRes.data) setOrganizations(orgsRes.data);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Actions ──

  async function createTeam() {
    if (!user) return;
    setCreating(true);

    // Auto-name: find next available number
    const existingNumbers = teams
      .map((t) => {
        const match = t.team_name.match(/^Team (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(Boolean);
    const nextNum =
      existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

    const { error } = await supabase.from('phil_teams').insert({
      event_id: eventId,
      team_name: `Team ${nextNum}`,
      created_by: user.id,
    });

    if (!error) await fetchData();
    setCreating(false);
  }

  async function deleteTeam(teamId: string) {
    const { error } = await supabase
      .from('phil_teams')
      .delete()
      .eq('id', teamId);
    if (!error) await fetchData();
  }

  async function addMember(teamId: string, registrationId: string) {
    if (!user) return;
    setAddingMember(teamId);

    const team = teams.find((t) => t.id === teamId);
    const nextPosition = (team?.members?.length ?? 0) + 1;

    const { error } = await supabase.from('phil_team_members').insert({
      team_id: teamId,
      registration_id: registrationId,
      position: nextPosition,
      created_by: user.id,
    });

    if (!error) await fetchData();
    setAddingMember(null);
    setOpenDropdown(null);
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('phil_team_members')
      .delete()
      .eq('id', memberId);
    if (!error) await fetchData();
  }

  async function updateTeamField(
    teamId: string,
    field: keyof Pick<PhilTeam, 'team_name' | 'tee_time' | 'starting_hole' | 'cart_number' | 'organization_id'>,
    value: string | number | null
  ) {
    const { error } = await supabase
      .from('phil_teams')
      .update({ [field]: value })
      .eq('id', teamId);
    if (!error) {
      setTeams((prev) =>
        prev.map((t) => {
          if (t.id !== teamId) return t;
          const updated = { ...t, [field]: value };
          if (field === 'organization_id') {
            updated.organization = value
              ? organizations.find((o) => o.id === value) as any
              : undefined;
          }
          return updated;
        })
      );
    }
  }

  // ── Helpers ──

  function getContactName(reg: PhilRegistration): string {
    if (reg.contact) {
      const parts = [reg.contact.first_name, reg.contact.last_name].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : reg.contact.email || 'Unknown';
    }
    return 'Unknown Golfer';
  }

  function getRoleBadge(reg: PhilRegistration) {
    const label =
      reg.role === 'golfer'
        ? 'Golfer'
        : reg.role === 'vip'
          ? 'VIP'
          : reg.role.replace(/_/g, ' ');
    return (
      <span className="ml-2 inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700 uppercase tracking-wide">
        {label}
      </span>
    );
  }

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Teams" value={teams.length} />
        <StatCard label="Unassigned Golfers" value={unassignedGolfers.length} />
        <StatCard label="Teams with Tee Times" value={teamsWithTeeTime} />
        <StatCard label="Teams with Holes" value={teamsWithHole} />
        <StatCard label="Teams with Org" value={teamsWithOrg} />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Teams</h3>
        <button
          onClick={createTeam}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New Team
        </button>
      </div>

      {/* ── Team Cards Grid ── */}
      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <UsersRound className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">
            No teams yet. Click "New Team" to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              organizations={organizations}
              unassignedGolfers={unassignedGolfers}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              addingMember={addingMember}
              onUpdateField={updateTeamField}
              onAddMember={addMember}
              onRemoveMember={removeMember}
              onDelete={deleteTeam}
              getContactName={getContactName}
              getRoleBadge={getRoleBadge}
            />
          ))}
        </div>
      )}

      {/* ── Unassigned Players Section ── */}
      {unassignedGolfers.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-900">
            Unassigned Players ({unassignedGolfers.length})
          </h3>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
            {unassignedGolfers.map((reg) => (
              <div
                key={reg.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                    {getContactName(reg)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {getContactName(reg)}
                  </span>
                  {getRoleBadge(reg)}
                </div>
                {reg.organization?.name && (
                  <span className="text-xs text-gray-500">
                    {reg.organization.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-rose-700">{value}</p>
    </div>
  );
}

// ─── TeamCard ─────────────────────────────────────────────

interface TeamCardProps {
  team: PhilTeam;
  organizations: { id: string; name: string }[];
  unassignedGolfers: PhilRegistration[];
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  addingMember: string | null;
  onUpdateField: (
    teamId: string,
    field: keyof Pick<PhilTeam, 'team_name' | 'tee_time' | 'starting_hole' | 'cart_number' | 'organization_id'>,
    value: string | number | null
  ) => Promise<void>;
  onAddMember: (teamId: string, registrationId: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onDelete: (teamId: string) => Promise<void>;
  getContactName: (reg: PhilRegistration) => string;
  getRoleBadge: (reg: PhilRegistration) => React.ReactNode;
}

function TeamCard({
  team,
  organizations,
  unassignedGolfers,
  openDropdown,
  setOpenDropdown,
  addingMember,
  onUpdateField,
  onAddMember,
  onRemoveMember,
  onDelete,
  getContactName,
  getRoleBadge,
}: TeamCardProps) {
  const members = team.members ?? [];
  const isFull = members.length >= 4;
  const isDropdownOpen = openDropdown === team.id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
      {/* ── Header: Team Name (editable) + Delete ── */}
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          defaultValue={team.team_name}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val && val !== team.team_name) {
              onUpdateField(team.id, 'team_name', val);
            }
          }}
          className="text-base font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-rose-500 focus:ring-0 outline-none px-0 py-0.5 w-full max-w-[200px] transition-colors"
        />
        <button
          onClick={() => onDelete(team.id)}
          className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Delete team"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Sponsoring Organization ── */}
      <div className="mb-3">
        <select
          value={team.organization_id || ''}
          onChange={(e) => {
            const val = e.target.value || null;
            onUpdateField(team.id, 'organization_id', val);
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
        >
          <option value="">No sponsoring org</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {team.organization?.name && (
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            Sponsored by {team.organization.name}
          </span>
        )}
      </div>

      {/* ── Team Settings Row ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Starting Hole */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            <Hash className="h-3 w-3" />
            Hole
          </label>
          <select
            value={team.starting_hole ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null;
              onUpdateField(team.id, 'starting_hole', val);
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          >
            <option value="">Not assigned</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        {/* Tee Time */}
        <div>
          <label className="flex items-center gap-1 text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">
            <Clock className="h-3 w-3" />
            Tee Time
          </label>
          <input
            type="time"
            defaultValue={team.tee_time ?? ''}
            onBlur={(e) => {
              const val = e.target.value || null;
              onUpdateField(team.id, 'tee_time', val);
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          />
        </div>

        {/* Cart Number */}
        <div>
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1 block">
            Cart #
          </label>
          <input
            type="text"
            defaultValue={team.cart_number ?? ''}
            onBlur={(e) => {
              const val = e.target.value.trim() || null;
              onUpdateField(team.id, 'cart_number', val);
            }}
            placeholder="--"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── Member Slots ── */}
      <div className="space-y-2 flex-1">
        {Array.from({ length: 4 }).map((_, idx) => {
          const member = members[idx];
          if (member?.registration) {
            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {getContactName(member.registration)}
                  </span>
                  {getRoleBadge(member.registration)}
                  {member.registration.is_sponsor && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">S</span>
                  )}
                  {member.registration.is_vip && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">VIP</span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveMember(member.id)}
                  className="ml-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                  title="Remove member"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return (
            <div
              key={`empty-${idx}`}
              className="flex items-center rounded-lg border border-dashed border-gray-200 px-3 py-2"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 text-[10px] font-semibold">
                {idx + 1}
              </span>
              <span className="ml-2 text-sm text-gray-400 italic">Empty slot</span>
            </div>
          );
        })}
      </div>

      {/* ── Add Member Button + Dropdown ── */}
      {!isFull && (
        <div className="relative mt-3">
          <button
            onClick={() =>
              setOpenDropdown(isDropdownOpen ? null : team.id)
            }
            disabled={unassignedGolfers.length === 0 || addingMember === team.id}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addingMember === team.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Member
          </button>

          {isDropdownOpen && unassignedGolfers.length > 0 && (
            <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {unassignedGolfers.map((reg) => (
                <button
                  key={reg.id}
                  onClick={() => onAddMember(team.id, reg.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold shrink-0">
                    {getContactName(reg)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  {getContactName(reg)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
