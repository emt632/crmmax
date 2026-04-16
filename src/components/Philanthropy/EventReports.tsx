import React, { useState } from 'react';
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

export default function EventReports({ eventId, eventName, eventDate }: EventReportsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const formattedDate = eventDate ? format(new Date(eventDate), 'MMMM d, yyyy') : '';

  const setLoading = (key: string, val: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: val }));
  };

  // ── 1. Team Cart Signs ──────────────────────────────────────────
  const handleCartSigns = async () => {
    setLoading('cartSigns', true);
    try {
      const { data: teams, error } = await supabase
        .from('phil_teams')
        .select(`
          id, name,
          organization:organizations ( id, name ),
          phil_team_members (
            id,
            registration:phil_registrations (
              id,
              contact:contacts ( id, first_name, last_name )
            )
          )
        `)
        .eq('event_id', eventId)
        .order('name');

      if (error) throw error;
      generateCartSigns(eventName, formattedDate, teams ?? []);
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
          id, name, description,
          phil_volunteer_shifts (
            id, start_time, end_time, location,
            phil_volunteer_assignments (
              id, checked_in,
              contact:contacts ( id, first_name, last_name, phone, email )
            )
          )
        `)
        .eq('event_id', eventId)
        .order('name');

      if (error) throw error;

      // Also fetch direct assignments (shift_id is null)
      const { data: directAssignments, error: directErr } = await supabase
        .from('phil_volunteer_assignments')
        .select(`
          id, checked_in,
          role:phil_volunteer_roles ( id, name ),
          contact:contacts ( id, first_name, last_name, phone, email )
        `)
        .eq('event_id', eventId)
        .is('shift_id', null);

      if (directErr) throw directErr;

      // Attach direct assignments to their roles
      const rolesWithDirect = (roles ?? []).map((role: any) => ({
        ...role,
        directAssignments: (directAssignments ?? []).filter(
          (a: any) => a.role?.id === role.id
        ),
      }));

      generateVolunteerSheet(eventName, formattedDate, rolesWithDirect);
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
      const { data: contests, error } = await supabase
        .from('phil_contests')
        .select(`
          id, name, contest_type, hole_number, description,
          sponsor:phil_sponsors (
            id,
            organization:organizations ( id, name )
          )
        `)
        .eq('event_id', eventId)
        .order('hole_number');

      if (error) throw error;
      generateContestSheet(eventName, formattedDate, contests ?? []);
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
      const { data: donations, error } = await supabase
        .from('phil_inkind_donations')
        .select(`
          id, description, estimated_value, intended_use,
          contact:contacts ( id, first_name, last_name ),
          organization:organizations ( id, name )
        `)
        .eq('event_id', eventId)
        .or('intended_use.ilike.%raffle%,intended_use.ilike.%auction%')
        .order('description');

      if (error) throw error;

      const raffleItems = (donations ?? []).filter((d: any) =>
        d.intended_use?.toLowerCase().includes('raffle')
      );
      const auctionItems = (donations ?? []).filter((d: any) =>
        d.intended_use?.toLowerCase().includes('auction')
      );

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
      const { data: registrations, error } = await supabase
        .from('phil_registrations')
        .select(`
          id, checked_in, registration_type, amount_paid,
          contact:contacts ( id, first_name, last_name, phone, email ),
          organization:organizations ( id, name ),
          phil_team_members (
            team:phil_teams ( id, name )
          )
        `)
        .eq('event_id', eventId)
        .order('contacts(last_name)');

      if (error) throw error;
      generateRegistrationList(eventName, formattedDate, registrations ?? []);
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
        'Half-page signs for each team \u2014 top half for registration desk, bottom half with giant team name for cart windshield',
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
      {reports.map(report => (
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
