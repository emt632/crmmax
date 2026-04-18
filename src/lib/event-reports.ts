/**
 * PhilanthropyMax Event Reports — printable PDF generation for events.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// ─── Shared Helper ─────────────────────────────────────────

function addHeader(doc: jsPDF, eventName: string, eventDate: string | null, reportTitle: string): number {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(eventName, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(eventDate ? format(new Date(eventDate), 'MMMM d, yyyy') : '', 14, 28);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, 14, 38);
  return 44; // startY for content
}

// ─── 1. Cart Signs ─────────────────────────────────────────

interface CartTeam {
  team_name: string;
  starting_hole: number | null;
  tee_time: string | null;
  cart_number: string | null;
  organization_name?: string;
  members: { name: string; role: string; is_vip: boolean; is_sponsor: boolean }[];
}

export function generateCartSigns(
  eventName: string,
  _eventDate: string | null,
  teams: CartTeam[]
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const cutY = 108; // ~4.25 inches from top

  teams.forEach((team, idx) => {
    if (idx > 0) doc.addPage();

    // ── Top Half ──
    let y = 16;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`TEAM: ${team.team_name}`, 14, y);
    y += 8;

    const infoParts: string[] = [];
    if (team.starting_hole != null) infoParts.push(`Hole: #${team.starting_hole}`);
    if (team.tee_time) infoParts.push(`Tee: ${team.tee_time}`);
    if (team.cart_number) infoParts.push(`Cart: ${team.cart_number}`);
    if (infoParts.length) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(infoParts.join('  |  '), 14, y);
    }
    y += 6;

    const tableBody = team.members.map((m, i) => {
      const badges: string[] = [];
      if (m.is_vip) badges.push('\u2605VIP');
      if (m.is_sponsor) badges.push('\u2605Sponsor');
      return [(i + 1).toString(), m.name, badges.join(' ')];
    });

    autoTable(doc, {
      startY: y,
      head: [['#', 'Name', 'Badges']],
      body: tableBody,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 12 },
        2: { cellWidth: 30 },
      },
    });

    if (team.organization_name) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? y + 30;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(`Sponsored by: ${team.organization_name}`, 14, finalY + 6);
    }

    // ── Dashed Cut Line ──
    doc.setDrawColor(100, 100, 100);
    doc.setLineDashPattern([4, 3], 0);
    doc.line(10, cutY, pageWidth - 10, cutY);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const cutText = '--- CUT HERE ---';
    const cutTextWidth = doc.getTextWidth(cutText);
    doc.text(cutText, (pageWidth - cutTextWidth) / 2, cutY - 1);
    doc.setTextColor(0, 0, 0);

    // ── Bottom Half — Big Team Name ──
    const bottomMidY = cutY + (doc.internal.pageSize.getHeight() - cutY) / 2;
    doc.setFontSize(72);
    doc.setFont('helvetica', 'bold');
    const teamTextWidth = doc.getTextWidth(team.team_name);
    doc.text(team.team_name, (pageWidth - teamTextWidth) / 2, bottomMidY);
  });

  doc.save(`${eventName} - Cart Signs.pdf`);
}

// ─── 2. Volunteer Assignment Sheet ─────────────────────────

interface VolunteerRole {
  role_name: string;
  shifts: {
    shift_label: string;
    start_time: string | null;
    end_time: string | null;
    assignments: { name: string; checked_in: boolean }[];
  }[];
  directAssignments: { name: string; checked_in: boolean }[];
}

export function generateVolunteerSheet(
  eventName: string,
  eventDate: string | null,
  roles: VolunteerRole[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  let y = addHeader(doc, eventName, eventDate, 'Volunteer Assignments');

  roles.forEach((role) => {
    // Role name header
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(role.role_name, 14, y);
    y += 4;

    const tableBody: string[][] = [];

    // Shift-based assignments
    role.shifts.forEach((shift) => {
      shift.assignments.forEach((a) => {
        tableBody.push([
          a.name,
          shift.shift_label,
          shift.start_time ?? '',
          shift.end_time ?? '',
          a.checked_in ? '\u2611' : '\u2610',
        ]);
      });
    });

    // Direct assignments (no shift)
    role.directAssignments.forEach((a) => {
      tableBody.push([
        a.name,
        '\u2014',
        '\u2014',
        '\u2014',
        a.checked_in ? '\u2611' : '\u2610',
      ]);
    });

    if (tableBody.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Name', 'Shift', 'Start', 'End', 'Checked In']],
        body: tableBody,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          4: { cellWidth: 22, halign: 'center' },
        },
      });
      y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    }
    y += 8;
  });

  doc.save(`${eventName} - Volunteer Assignments.pdf`);
}

// ─── 3. Contest Score Sheets ───────────────────────────────

interface Contest {
  contest_type: string;
  hole_number: number | null;
  prize_description: string | null;
  prize_value: number | null;
  sponsor_name?: string;
}

export function generateContestSheet(
  eventName: string,
  eventDate: string | null,
  contests: Contest[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  let y = addHeader(doc, eventName, eventDate, 'Contest Score Sheets');

  contests.forEach((contest) => {
    if (y > 210) {
      doc.addPage();
      y = 20;
    }

    // Contest header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    let label = contest.contest_type;
    if (contest.hole_number != null) label += ` — Hole #${contest.hole_number}`;
    doc.text(label, 14, y);
    y += 5;

    const detailParts: string[] = [];
    if (contest.prize_description) detailParts.push(`Prize: ${contest.prize_description}`);
    if (contest.prize_value != null) detailParts.push(`Value: $${contest.prize_value.toFixed(2)}`);
    if (contest.sponsor_name) detailParts.push(`Sponsor: ${contest.sponsor_name}`);
    if (detailParts.length) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(detailParts.join('  |  '), 14, y);
      y += 4;
    }

    // Empty rows for writing
    const emptyRows = Array.from({ length: 10 }, (_, i) => [(i + 1).toString(), '', '']);

    autoTable(doc, {
      startY: y,
      head: [['Rank', 'Player Name', 'Result']],
      body: emptyRows,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, minCellHeight: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
      },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 60;
    y += 10;
  });

  doc.save(`${eventName} - Contest Score Sheets.pdf`);
}

// ─── 4. Raffle & Auction Sheet ─────────────────────────────

interface RaffleItem {
  item_description: string;
  donor_name: string;
  fair_market_value: number;
}

interface AuctionItem {
  item_description: string;
  donor_name: string;
  fair_market_value: number;
}

export function generateRaffleAuctionSheet(
  eventName: string,
  eventDate: string | null,
  raffleItems: RaffleItem[],
  auctionItems: AuctionItem[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  let y = addHeader(doc, eventName, eventDate, 'Raffle & Auction');

  // ── Raffle Section ──
  if (raffleItems.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RAFFLE PRIZES', 14, y);
    y += 4;

    const raffleBody = raffleItems.map((item) => [
      item.item_description,
      item.donor_name,
      `$${item.fair_market_value.toFixed(2)}`,
      '',
      '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Donor', 'Value', 'Winner Name', 'Ticket #']],
      body: raffleBody,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, minCellHeight: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 40;
    y += 10;
  }

  // ── Auction Section ──
  if (auctionItems.length > 0) {
    if (y > 210) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('AUCTION ITEMS', 14, y);
    y += 4;

    const auctionBody = auctionItems.map((item) => [
      item.item_description,
      item.donor_name,
      `$${item.fair_market_value.toFixed(2)}`,
      '',
      '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Item', 'Donor', 'FMV', 'Winner Name', 'Winning Bid']],
      body: auctionBody,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 9, minCellHeight: 8 },
      headStyles: { fillColor: [41, 128, 185] },
      theme: 'grid',
    });
  }

  doc.save(`${eventName} - Raffle & Auction.pdf`);
}

// ─── 5. Registration List ──────────────────────────────────

interface Registration {
  name: string;
  organization: string;
  role: string;
  team_name: string;
  fee_paid: boolean;
  waiver_signed: boolean;
  is_vip: boolean;
  is_sponsor: boolean;
}

export function generateRegistrationList(
  eventName: string,
  eventDate: string | null,
  registrations: Registration[]
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const y = addHeader(doc, eventName, eventDate, 'Registration List');

  // Sort alphabetically by name
  const sorted = [...registrations].sort((a, b) => a.name.localeCompare(b.name));

  const tableBody = sorted.map((r) => {
    const badges: string[] = [];
    if (r.is_vip) badges.push('VIP');
    if (r.is_sponsor) badges.push('Sponsor');
    return [
      '', // empty checkbox column
      r.name,
      r.organization,
      r.role,
      r.team_name,
      r.fee_paid ? 'Paid' : 'Unpaid',
      r.waiver_signed ? 'Yes' : 'No',
      badges.join(', '),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['\u2610', 'Name', 'Organization', 'Role', 'Team', 'Fees', 'Waiver', 'Badges']],
    body: tableBody,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, minCellHeight: 7 },
    headStyles: { fillColor: [41, 128, 185] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
    },
    theme: 'grid',
  });

  doc.save(`${eventName} - Registration List.pdf`);
}
