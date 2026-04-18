import { useState } from 'react';
import { UsersRound, UserCheck, Trophy, Gift, ClipboardList, FileDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import {
  generateCartSigns,
  generateVolunteerSheet,
  generateContestSheet,
  generateRaffleAuctionSheet,
  generateRegistrationList,
} from '../../lib/event-reports';

interface EventReportsProps {
  eventId: string;
  eventName: string;
  eventDate: string | null;
}

// Supabase's nested select returns arrays for joined tables; normalize to first element
function first<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const ROLE_LABEL: Record<string, string> = {
  golfer: 'Golfer',
  dinner_only: 'Dinner Only',
  volunteer: 'Volunteer',
  vip: 'VIP',
  speaker: 'Speaker',
};

const CONTEST_LABEL: Record<string, string> = {
  longest_drive: 'Longest Drive',
  closest_to_pin: 'Closest to Pin',
  hole_in_one: 'Hole in One',
  putting: 'Putting Contest',
  other: 'Other',
};

export default function EventReports({ eventId, eventName, eventDate }: EventReportsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const formattedDate = eventDate ? format(new Date(eventDate), 'MMMM d, yyyy') : '';

  const setLoading = (key: string, val: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: val }));
  };

  // ── 1. Team Cart Signs ──────────────────────────────────────────
  const handleCartSigns = async () => {
    setLoading('cartSigns', true);
    try {
      const { data, error } = await supabase
        .from('phil_teams')
        .select(`
          id, team_name, starting_hole, tee_time, cart_number,
          organization:organizations ( id, name ),
          members:phil_team_members (
            id,
            registration:phil_registrations (
              id, role, is_vip, is_sponsor,
              contact:contacts ( id, first_name, last_name )
            )
          )
        `)
        .eq('event_id', eventId)
        .order('team_name');

      if (error) throw error;

      const teams = (data ?? []).map((t: any) => {
        const org = first<{ name: string }>(t.organization);
        const members = (t.members ?? [])
          .map((m: any) => {
            const reg = first<any>(m.registration);
            if (!reg) return null;
            const contact = first<{ first_name: string; last_name: string }>(reg.contact);
            const name = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '(unknown)';
            return {
              name,
              role: ROLE_LABEL[reg.role] ?? reg.role ?? '',
              is_vip: !!reg.is_vip,
              is_sponsor: !!reg.is_sponsor,
            };
          })
          .filter((m: any) => m !== null) as { name: string; role: string; is_vip: boolean; is_sponsor: boolean }[];

        return {
          team_name: t.team_name ?? '(unnamed team)',
          starting_hole: t.starting_hole ?? null,
          tee_time: t.tee_time ?? null,
          cart_number: t.cart_number ?? null,
          organization_name: org?.name,
          members,
        };
      });

      generateCartSigns(eventName, formattedDate, teams);
    } catch (err) {
      console.error('Failed to generate cart signs:', err);
    } finally {
      setLoading('cartSigns', false);
    }
  };

  // ── 2. Volunteer Assignments ────────────────────────────────────
  const handleVolunteerSheet = async () => {
    setLoading('volunteers', true);
    try {
      const { data: roles, error } = await supabase
        .from('phil_volunteer_roles')
        .select(`
          id, role_name,
          shifts:phil_volunteer_shifts (
            id, shift_label, start_time, end_time,
            assignments:phil_volunteer_assignments (
              id, checked_in,
              contact:contacts ( id, first_name, last_name )
            )
          )
        `)
        .eq('event_id', eventId)
        .order('role_name');

      if (error) throw error;

      const roleIds = (roles ?? []).map((r: any) => r.id);
      let directByRole: Record<string, { name: string; checked_in: boolean }[]> = {};
      if (roleIds.length > 0) {
        const { data: directData } = await supabase
          .from('phil_volunteer_assignments')
          .select(`
            id, role_id, checked_in,
            contact:contacts ( id, first_name, last_name )
          `)
          .in('role_id', roleIds)
          .is('shift_id', null);

        directByRole = {};
        for (const a of (directData ?? []) as any[]) {
          const contact = first<{ first_name: string; last_name: string }>(a.contact);
          const name = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '(unknown)';
          if (!directByRole[a.role_id]) directByRole[a.role_id] = [];
          directByRole[a.role_id].push({ name, checked_in: !!a.checked_in });
        }
      }

      const transformed = (roles ?? []).map((r: any) => ({
        role_name: r.role_name ?? '(unnamed role)',
        shifts: (r.shifts ?? []).map((s: any) => ({
          shift_label: s.shift_label ?? '',
          start_time: s.start_time ?? null,
          end_time: s.end_time ?? null,
          assignments: (s.assignments ?? []).map((a: any) => {
            const contact = first<{ first_name: string; last_name: string }>(a.contact);
            const name = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '(unknown)';
            return { name, checked_in: !!a.checked_in };
          }),
        })),
        directAssignments: directByRole[r.id] ?? [],
      }));

      generateVolunteerSheet(eventName, formattedDate, transformed);
    } catch (err) {
      console.error('Failed to generate volunteer sheet:', err);
    } finally {
      setLoading('volunteers', false);
    }
  };

  // ── 3. Contest Score Sheets ─────────────────────────────────────
  const handleContestSheet = async () => {
    setLoading('contests', true);
    try {
      const { data, error } = await supabase
        .from('phil_contests')
        .select(`
          id, contest_type, hole_number, prize_description, prize_value,
          sponsor:phil_sponsors (
            id,
            organization:organizations ( id, name )
          )
        `)
        .eq('event_id', eventId)
        .order('hole_number');

      if (error) throw error;

      const contests = (data ?? []).map((c: any) => {
        const sponsor = first<any>(c.sponsor);
        const sponsorOrg = sponsor ? first<{ name: string }>(sponsor.organization) : null;
        return {
          contest_type: CONTEST_LABEL[c.contest_type] ?? c.contest_type ?? '',
          hole_number: c.hole_number ?? null,
          prize_description: c.prize_description ?? null,
          prize_value: c.prize_value ?? null,
          sponsor_name: sponsorOrg?.name,
        };
      });

      generateContestSheet(eventName, formattedDate, contests);
    } catch (err) {
      console.error('Failed to generate contest sheet:', err);
    } finally {
      setLoading('contests', false);
    }
  };

  // ── 4. Raffle & Auction Winners ─────────────────────────────────
  const handleRaffleAuction = async () => {
    setLoading('raffle', true);
    try {
      const { data, error } = await supabase
        .from('phil_inkind_donations')
        .select(`
          id, item_description, fair_market_value, intended_use,
          contact:contacts ( id, first_name, last_name ),
          organization:organizations ( id, name )
        `)
        .eq('event_id', eventId)
        .or('intended_use.ilike.%raffle%,intended_use.ilike.%auction%')
        .order('item_description');

      if (error) throw error;

      const mapItem = (d: any) => {
        const contact = first<{ first_name: string; last_name: string }>(d.contact);
        const org = first<{ name: string }>(d.organization);
        const donor = org?.name
          || (contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '')
          || '—';
        return {
          item_description: d.item_description ?? '',
          donor_name: donor,
          fair_market_value: Number(d.fair_market_value ?? 0),
          _use: (d.intended_use ?? '').toLowerCase(),
        };
      };

      const mapped = (data ?? []).map(mapItem);
      const raffleItems = mapped.filter((d: any) => d._use.includes('raffle')).map(({ _use, ...rest }: any) => rest);
      const auctionItems = mapped.filter((d: any) => d._use.includes('auction')).map(({ _use, ...rest }: any) => rest);

      generateRaffleAuctionSheet(eventName, formattedDate, raffleItems, auctionItems);
    } catch (err) {
      console.error('Failed to generate raffle/auction sheet:', err);
    } finally {
      setLoading('raffle', false);
    }
  };

  // ── 5. Registration Check-In List ──────────────────────────────
  const handleRegistrationList = async () => {
    setLoading('registration', true);
    try {
      const { data, error } = await supabase
        .from('phil_registrations')
        .select(`
          id, role, fee_paid, waiver_signed, is_vip, is_sponsor,
          contact:contacts ( id, first_name, last_name ),
          organization:organizations ( id, name ),
          phil_team_members (
            team:phil_teams ( id, team_name )
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;

      const registrations = (data ?? []).map((r: any) => {
        const contact = first<{ first_name: string; last_name: string }>(r.contact);
        const org = first<{ name: string }>(r.organization);
        const teamMember = first<any>(r.phil_team_members);
        const team = teamMember ? first<{ team_name: string }>(teamMember.team) : null;
        const name = contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '(unknown)';
        return {
          name,
          organization: org?.name ?? '',
          role: ROLE_LABEL[r.role] ?? r.role ?? '',
          team_name: team?.team_name ?? '',
          fee_paid: !!r.fee_paid,
          waiver_signed: !!r.waiver_signed,
          is_vip: !!r.is_vip,
          is_sponsor: !!r.is_sponsor,
        };
      });

      // Sort alphabetically by last name / full name
      registrations.sort((a, b) => a.name.localeCompare(b.name));

      generateRegistrationList(eventName, formattedDate, registrations);
    } catch (err) {
      console.error('Failed to generate registration list:', err);
    } finally {
      setLoading('registration', false);
    }
  };

  // ── Report card definitions ────────────────────────────────────
  const reports = [
    {
      key: 'cartSigns',
      icon: UsersRound,
      title: 'Team Cart Signs',
      description:
        'Half-page signs for each team — top half for registration desk, bottom half with giant team name for cart windshield',
      generate: handleCartSigns,
    },
    {
      key: 'volunteers',
      icon: UserCheck,
      title: 'Volunteer Assignments',
      description:
        'Complete volunteer roster grouped by role with shift times and check-in status',
      generate: handleVolunteerSheet,
    },
    {
      key: 'contests',
      icon: Trophy,
      title: 'Contest Score Sheets',
      description:
        'Blank score sheets for on-course contest monitors to record results',
      generate: handleContestSheet,
    },
    {
      key: 'raffle',
      icon: Gift,
      title: 'Raffle & Auction Winners',
      description: 'Winner tracking sheets for raffle prizes and auction items',
      generate: handleRaffleAuction,
    },
    {
      key: 'registration',
      icon: ClipboardList,
      title: 'Registration Check-In List',
      description:
        'Alphabetical registration list with check-in boxes for the registration table',
      generate: handleRegistrationList,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {reports.map((report) => (
        <div
          key={report.key}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg">
              <report.icon className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="font-semibold text-gray-900">{report.title}</h3>
          </div>
          <p className="text-sm text-gray-500">{report.description}</p>
          <button
            onClick={report.generate}
            disabled={loadingStates[report.key]}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {loadingStates[report.key] ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Generate PDF
          </button>
        </div>
      ))}
    </div>
  );
}
