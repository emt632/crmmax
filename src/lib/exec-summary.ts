/**
 * Executive Summary report generation — AI summarization + PDF/DOCX output.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from 'docx';
import { format } from 'date-fns';
import { COMMITTEE_ROLE_LABELS, US_STATES } from './bill-format';
import ll3LogoUrl from '../assets/ll3-logo.png';

// ─── Types ──────────────────────────────────────────────────

export interface ExecSummaryConfig {
  title: string;
  subtitle: string;
  orgName: string;
  format: 'pdf' | 'docx';
}

interface EnrichedEngagement {
  id: string;
  type: string;
  date: string;
  subject: string;
  notes?: string;
  topics_covered?: string;
  meeting_level?: 'member' | 'staff';
  jurisdiction?: string;
  initiative?: string;
  duration?: number;
  meeting_location?: string;
  meeting_location_detail?: string;
  association_name?: string;
  entity_name?: string;
  committee_of_jurisdiction?: string;
  committee_role?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_completed?: boolean;
  bills: { id: string; bill_number: string; title: string }[];
  staff: { id: string; full_name: string | null; email: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  legislators: { people_id: number; name: string; party?: string; chamber?: string; state?: string; district?: string }[];
  legStaff: { id: string; first_name: string; last_name: string; title?: string }[];
}

const MEETING_LOCATION_LABELS: Record<string, string> = {
  virtual: 'Virtual',
  in_person: 'In-Person',
  other: 'Other',
};

interface MeetingData {
  legislatorName: string;
  legislatorTitle: string;
  meetingType: string;
  committeeRole: string;
  staffPresent: string;
  attendees: string;
  date: string;
  location: string;
  duration: string;
  subject: string;
  initiative: string;
  bullets: string[];
}

interface SummaryData {
  coreIssues: string[];
  meetings: MeetingData[];
  nextSteps: string[];
  delegation: string[];
}

// ─── Logo loading ───────────────────────────────────────────

async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(ll3LogoUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadLogoAsArrayBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(ll3LogoUrl);
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// ─── Legislator title formatting ────────────────────────────

function stateFullName(abbr?: string): string {
  if (!abbr) return '';
  const found = US_STATES.find(s => s.value === abbr.toUpperCase());
  return found ? found.label : abbr;
}

function formatLegislatorTitle(
  leg: { name: string; party?: string; chamber?: string; state?: string; district?: string },
  jurisdiction?: string,
  stateHint?: string,
): string {
  const isFederal = jurisdiction === 'US' || leg.state === 'US';
  // LegiScan stores chamber as "Sen"/"Rep" (from the role field)
  const ch = (leg.chamber || '').toLowerCase();
  const isSenate = ch === 'sen' || ch === 'senate' || ch === 's';
  const isRep = ch === 'rep' || ch === 'house' || ch === 'h' || ch === 'asm' || ch === 'assembly' || ch === 'a';

  let role: string;
  if (isFederal) {
    role = isSenate ? 'US Senator' : isRep ? 'US Representative' : 'US Official';
  } else {
    role = isSenate ? 'State Senator' : isRep ? 'State Representative' : 'State Official';
  }

  const parts: string[] = [role];

  // State — use leg.state if it's a real state, otherwise fall back to stateHint
  const stateCode = (leg.state && leg.state !== 'US') ? leg.state : stateHint;
  const state = stateCode ? stateFullName(stateCode) : '';
  if (state) parts.push(state);

  // District — include for Representatives/House members, not Senators
  if (leg.district && !isSenate) {
    parts.push(`District ${leg.district}`);
  }

  // Party
  if (leg.party) {
    const partyAbbr = leg.party.length > 1 ? leg.party.charAt(0).toUpperCase() : leg.party.toUpperCase();
    return parts.join(', ') + ` (${partyAbbr})`;
  }

  return parts.join(', ');
}

// ─── OpenAI helpers ─────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userContent: string, maxTokens: number): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch {
    return null;
  }
}

function parseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ─── AI Summarization ───────────────────────────────────────

async function summarizeForExecReport(
  engagements: EnrichedEngagement[],
): Promise<{ coreIssues: string[]; meetingSummaries: string[][]; nextSteps: string[] }> {
  // Build context strings — include initiative in context
  const allNotes = engagements.map((e, i) => {
    const leg = e.legislators.map(l => l.name).join(', ') || e.subject;
    const date = e.date ? format(new Date(e.date + 'T00:00:00'), 'MMM d, yyyy') : '';
    const initiative = e.initiative ? `\nInitiative: ${e.initiative}` : '';
    const notes = e.notes || e.topics_covered || '(no notes)';
    return `Meeting ${i + 1} — ${leg} (${date}): ${e.subject}${initiative}\n${notes}`;
  }).join('\n\n');

  // Call 1: Core issues + next steps
  const aggregatePrompt = `Analyze these legislative meeting notes from a lobbying delegation. Extract:
(1) coreIssues: 5-8 bullet points of common policy themes and issues presented across all meetings. Each should be a concise, professional statement.
(2) nextSteps: 5-8 consolidated follow-up action items based on commitments made and needs identified. Each should be actionable.
Return JSON: { "coreIssues": string[], "nextSteps": string[] }`;

  const aggregateResult = callOpenAI(aggregatePrompt, allNotes, 1500);

  // Call 2: Per-meeting summaries for ALL engagements
  const meetingNotesStr = engagements.map((e, i) => {
    const leg = e.legislators.map(l => l.name).join(', ') || e.subject;
    const initiative = e.initiative ? `\nInitiative: ${e.initiative}` : '';
    const notes = e.notes || e.topics_covered || '(no detailed notes)';
    return `Meeting ${i + 1} — ${leg}: ${e.subject}${initiative}\n${notes}`;
  }).join('\n\n');

  const meetingPrompt = `For each numbered meeting/engagement below, produce 4-8 professional bullet points summarizing key discussion topics, positions taken, outcomes, and any commitments made. Incorporate the initiative context into the summary when provided. Be specific and concise. Return a JSON array of string arrays: [["bullet1", "bullet2", ...], ...]`;

  const meetingResult = engagements.length > 0
    ? callOpenAI(meetingPrompt, meetingNotesStr, 4500)
    : Promise.resolve(null);

  const [aggRaw, meetRaw] = await Promise.all([aggregateResult, meetingResult]);

  const aggData = parseJSON<{ coreIssues: string[]; nextSteps: string[] }>(aggRaw);
  const meetData = parseJSON<string[][]>(meetRaw);

  // Fallback: use raw notes as bullets
  const fallbackBullets = (e: EnrichedEngagement): string[] => {
    const text = e.notes || e.topics_covered || '';
    if (!text.trim()) return ['Meeting notes not available'];
    return text.split(/\n+/).filter(l => l.trim()).map(l => l.trim());
  };

  const fallbackCoreIssues = (): string[] => {
    const subjects = [...new Set(engagements.map(e => e.subject).filter(Boolean))];
    return subjects.length > 0 ? subjects : ['See individual meeting summaries for details'];
  };

  const fallbackNextSteps = (): string[] => {
    const steps: string[] = [];
    for (const e of engagements) {
      if (e.follow_up_required && e.follow_up_notes) {
        steps.push(e.follow_up_notes);
      }
    }
    return steps.length > 0 ? steps : ['Review meeting outcomes and plan next actions'];
  };

  return {
    coreIssues: aggData?.coreIssues || fallbackCoreIssues(),
    nextSteps: aggData?.nextSteps || fallbackNextSteps(),
    meetingSummaries: engagements.map((e, i) =>
      meetData?.[i] || fallbackBullets(e)
    ),
  };
}

// ─── Data Extraction ────────────────────────────────────────

function buildSummaryData(
  engagements: EnrichedEngagement[],
  aiResult: { coreIssues: string[]; meetingSummaries: string[][]; nextSteps: string[] },
): SummaryData {
  // Delegation: deduplicated attendees across all engagements
  const delegationSet = new Set<string>();
  for (const e of engagements) {
    for (const s of e.staff) {
      if (s.full_name) delegationSet.add(s.full_name);
    }
    for (const c of e.contacts) {
      delegationSet.add(`${c.first_name} ${c.last_name}`);
    }
  }
  const delegation = Array.from(delegationSet).sort();

  // Build a global state lookup by people_id — if a legislator appears on ANY
  // engagement with a real state (not "US"), use that for all engagements
  const legislatorStateMap = new Map<number, string>();
  for (const e of engagements) {
    for (const l of e.legislators) {
      if (l.state && l.state !== 'US' && !legislatorStateMap.has(l.people_id)) {
        legislatorStateMap.set(l.people_id, l.state);
      }
    }
  }

  // Per-meeting data for ALL engagement types
  const meetings: MeetingData[] = engagements.map((e, i) => {
    // Build heading name based on engagement type
    let legName: string;
    if (e.type === 'legislator_office' && e.legislators.length > 0) {
      legName = e.legislators.map(l => l.name).join(', ');
    } else if (e.type === 'federal_state_entity' && e.entity_name) {
      legName = e.entity_name;
    } else if (e.type === 'ga_committee' && e.association_name) {
      legName = e.association_name;
    } else {
      legName = e.subject || 'Unknown';
    }

    // Title line — only for legislator_office with legislator data
    const legislatorTitle = (e.type === 'legislator_office' && e.legislators.length > 0)
      ? e.legislators.map(l => formatLegislatorTitle(l, e.jurisdiction, legislatorStateMap.get(l.people_id))).join('; ')
      : '';

    const meetingType = e.meeting_level === 'member' ? 'Member-Level Meeting'
      : e.meeting_level === 'staff' ? 'Staff-Level Meeting'
      : 'Meeting';

    const committeeRole = [
      e.committee_role ? (COMMITTEE_ROLE_LABELS[e.committee_role] || e.committee_role) : '',
      e.committee_of_jurisdiction || '',
    ].filter(Boolean).join(', ');

    const staffPresent = e.legStaff
      .map(s => [s.first_name, s.last_name].filter(Boolean).join(' ') + (s.title ? ` (${s.title})` : ''))
      .join('; ') || '—';

    const attendees = [
      ...e.staff.map(s => s.full_name || '').filter(Boolean),
      ...e.contacts.map(c => `${c.first_name} ${c.last_name}`),
    ].join('; ') || '—';

    const dateStr = e.date ? format(new Date(e.date + 'T00:00:00'), 'MMMM d, yyyy') : '';

    // Location
    const locLabel = e.meeting_location ? (MEETING_LOCATION_LABELS[e.meeting_location] || e.meeting_location) : '';
    const locDetail = e.meeting_location_detail || '';
    const location = [locLabel, locDetail].filter(Boolean).join(' — ') || '';

    // Duration
    const duration = e.duration != null ? `${e.duration} min` : '';

    return {
      legislatorName: legName,
      legislatorTitle,
      meetingType,
      committeeRole,
      staffPresent,
      attendees,
      date: dateStr,
      location,
      duration,
      subject: e.subject,
      initiative: e.initiative || '',
      bullets: aiResult.meetingSummaries[i] || [],
    };
  });

  return {
    coreIssues: aiResult.coreIssues,
    meetings,
    nextSteps: aiResult.nextSteps,
    delegation,
  };
}

// ─── Shared: build metadata rows (skip blank committee) ─────

function buildMetaRows(m: MeetingData): string[][] {
  const rows: string[][] = [
    ['Meeting Type', m.meetingType],
  ];
  if (m.committeeRole) {
    rows.push(['Committee Role', m.committeeRole]);
  }
  if (m.initiative) {
    rows.push(['Initiative', m.initiative]);
  }
  rows.push(['Staff Present', m.staffPresent]);
  rows.push(['Attendees', m.attendees]);
  return rows;
}

// ─── Shared: build meeting heading line ─────────────────────

function buildMeetingSubline(m: MeetingData): string {
  const parts: string[] = [];
  if (m.date) parts.push(m.date);
  if (m.location) parts.push(m.location);
  if (m.duration) parts.push(m.duration);
  return parts.join('  |  ');
}

// ─── PDF Generation ─────────────────────────────────────────

function buildExecPDF(config: ExecSummaryConfig, data: SummaryData, logoDataUrl: string | null): void {
  const doc = new jsPDF({ orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 25;

  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      y = 20;
    }
  };

  // Header — logo or text
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin, y - 8, 50, 10);
    y += 8;
  } else {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(config.orgName.toUpperCase(), margin, y);
    y += 8;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title, margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text(config.subtitle, margin, y);
  doc.setTextColor(0);
  y += 12;

  // Core Policy Issues
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Core Policy Issues Presented', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const issue of data.coreIssues) {
    checkPageBreak(12);
    const lines = doc.splitTextToSize(`\u2022  ${issue}`, contentW - 5);
    doc.text(lines, margin + 3, y);
    y += lines.length * 4.5 + 1.5;
  }
  y += 6;

  // Legislative Meeting Summaries
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Legislative Meeting Summaries', margin, y);
  y += 8;

  data.meetings.forEach((m) => {
    checkPageBreak(50);

    // Legislator name heading
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(m.legislatorName, margin, y);
    y += 5;

    // Legislator title (e.g., "US Senator, Wisconsin (D)")
    if (m.legislatorTitle) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60);
      doc.text(m.legislatorTitle, margin, y);
      doc.setTextColor(0);
      y += 4.5;
    }

    // Date | Location | Duration subline
    const subline = buildMeetingSubline(m);
    if (subline) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(subline, margin, y);
      doc.setTextColor(0);
      y += 4;
    }

    // Metadata table (committee row omitted if blank)
    const metaRows = buildMetaRows(m);
    autoTable(doc, {
      body: metaRows,
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold', fillColor: [240, 240, 240] },
        1: { cellWidth: contentW - 35 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Bullet points
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const bullet of m.bullets) {
      checkPageBreak(12);
      const lines = doc.splitTextToSize(`\u2022  ${bullet}`, contentW - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 4.5 + 1.5;
    }
    y += 8;
  });

  // Next Steps
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Next Steps & Follow-Up Actions', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const step of data.nextSteps) {
    checkPageBreak(12);
    const lines = doc.splitTextToSize(`\u2022  ${step}`, contentW - 5);
    doc.text(lines, margin + 3, y);
    y += lines.length * 4.5 + 1.5;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  const footerText = `Prepared by ${config.orgName} | ${format(new Date(), 'MMMM d, yyyy')} | Confidential`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(footerText, pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    doc.setTextColor(0);
  }

  doc.save(`executive-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// ─── DOCX Generation ────────────────────────────────────────

function makeTableCell(text: string, bold = false, shading?: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold, size: 18, font: 'Calibri' })],
        spacing: { before: 40, after: 40 },
      }),
    ],
    ...(shading ? { shading: { fill: shading } } : {}),
    width: { size: 50, type: WidthType.PERCENTAGE },
  });
}

async function buildExecDOCX(config: ExecSummaryConfig, data: SummaryData, logoBuffer: ArrayBuffer | null): Promise<void> {
  const children: (Paragraph | Table)[] = [];

  // Header — logo or text
  if (logoBuffer) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 200, height: 40 },
            type: 'png',
          }),
        ],
        spacing: { after: 100 },
      }),
    );
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: config.orgName.toUpperCase(), bold: true, size: 32, font: 'Calibri' })],
        spacing: { after: 100 },
      }),
    );
  }
  children.push(
    new Paragraph({
      children: [new TextRun({ text: config.title, bold: true, size: 26, font: 'Calibri' })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: config.subtitle, size: 20, font: 'Calibri', color: '666666' })],
      spacing: { after: 300 },
    }),
  );

  // Core Policy Issues
  children.push(
    new Paragraph({
      text: 'Core Policy Issues Presented',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }),
  );
  for (const issue of data.coreIssues) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: issue, size: 20, font: 'Calibri' })],
        bullet: { level: 0 },
        spacing: { after: 60 },
      }),
    );
  }

  // Legislative Meeting Summaries
  children.push(
    new Paragraph({
      text: 'Legislative Meeting Summaries',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }),
  );

  data.meetings.forEach((m) => {
    // Legislator name heading
    const headingRuns: TextRun[] = [
      new TextRun({ text: m.legislatorName, bold: true, size: 24, font: 'Calibri' }),
    ];
    children.push(
      new Paragraph({ children: headingRuns, spacing: { before: 240, after: 40 } }),
    );

    // Legislator title line
    if (m.legislatorTitle) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: m.legislatorTitle, size: 20, font: 'Calibri', color: '444444' })],
          spacing: { after: 30 },
        }),
      );
    }

    // Date | Location | Duration subline
    const subline = buildMeetingSubline(m);
    if (subline) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: subline, size: 18, font: 'Calibri', color: '777777' })],
          spacing: { after: 60 },
        }),
      );
    }

    // Metadata table (committee row omitted if blank)
    const metaRows = buildMetaRows(m);
    children.push(
      new Table({
        rows: metaRows.map(([label, value]) =>
          new TableRow({
            children: [
              makeTableCell(label, true, 'F0F0F0'),
              makeTableCell(value),
            ],
          }),
        ),
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );

    // Bullets
    for (const bullet of m.bullets) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: bullet, size: 20, font: 'Calibri' })],
          bullet: { level: 0 },
          spacing: { after: 40 },
        }),
      );
    }
  });

  // Next Steps
  children.push(
    new Paragraph({
      text: 'Next Steps & Follow-Up Actions',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }),
  );
  for (const step of data.nextSteps) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: step, size: 20, font: 'Calibri' })],
        bullet: { level: 0 },
        spacing: { after: 60 },
      }),
    );
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Prepared by ${config.orgName} | ${format(new Date(), 'MMMM d, yyyy')} | Confidential`,
          size: 16,
          font: 'Calibri',
          color: '888888',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  );

  const docx = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(docx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `executive-summary-${format(new Date(), 'yyyy-MM-dd')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Entry Point ───────────────────────────────────────

export async function generateExecSummary(
  config: ExecSummaryConfig,
  engagements: EnrichedEngagement[],
): Promise<void> {
  // Load logo + AI summaries in parallel
  const [aiResult, logoDataUrl, logoBuffer] = await Promise.all([
    summarizeForExecReport(engagements),
    loadLogoAsDataUrl(),
    loadLogoAsArrayBuffer(),
  ]);
  const data = buildSummaryData(engagements, aiResult);

  if (config.format === 'pdf') {
    buildExecPDF(config, data, logoDataUrl);
  } else {
    await buildExecDOCX(config, data, logoBuffer);
  }
}
