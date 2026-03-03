import React, { useState, useMemo } from 'react';
import { X, Loader2, GitMerge, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LegislativeOffice, LegislativeOfficeStaff } from '../../types';

interface MergeLegOfficeModalProps {
  offices: LegislativeOffice[];
  staffMap: Record<string, LegislativeOfficeStaff[]>;
  onMerged: () => void;
  onClose: () => void;
}

// Strip title/office prefixes to get just the person's name for matching
function stripName(name: string): string {
  return name
    .replace(/^Office of\s+(Sen\.\s*|Rep\.\s*|Senator\s+|Representative\s+)?/i, '')
    .replace(/^Senator\s+/i, '')
    .replace(/^Representative\s+/i, '')
    .replace(/^Sen\.\s*/i, '')
    .replace(/^Rep\.\s*/i, '')
    .trim();
}

function displayOfficeName(office: LegislativeOffice): string {
  const clean = stripName(office.name);
  const c = (office.chamber || '').toLowerCase();
  let title = '';
  if (c === 'senate' || c === 'sen') title = 'Senator';
  else if (c === 'house' || c === 'assembly' || c === 'rep') title = 'Representative';
  return office.office_type === 'legislator' && title ? `${title} ${clean}` : office.name;
}

type DuplicateGroup = {
  key: string;
  offices: LegislativeOffice[];
};

// Find groups of offices with matching stripped names
function findDuplicateGroups(offices: LegislativeOffice[]): DuplicateGroup[] {
  const map = new Map<string, LegislativeOffice[]>();
  for (const o of offices) {
    const key = stripName(o.name).toLowerCase().trim();
    if (!key) continue;
    const group = map.get(key) || [];
    group.push(o);
    map.set(key, group);
  }
  return Array.from(map.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, offices: group }));
}

const MERGE_FIELDS: { key: keyof LegislativeOffice; label: string }[] = [
  { key: 'name', label: 'Office Name' },
  { key: 'state', label: 'State' },
  { key: 'chamber', label: 'Chamber' },
  { key: 'district', label: 'District' },
  { key: 'legislator_people_id', label: 'LegiScan ID' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'office_state', label: 'Office Location' },
  { key: 'zip', label: 'Zip' },
];

const MergeLegOfficeModal: React.FC<MergeLegOfficeModalProps> = ({
  offices,
  staffMap,
  onMerged,
  onClose,
}) => {
  const duplicateGroups = useMemo(() => findDuplicateGroups(offices), [offices]);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [primaryId, setPrimaryId] = useState<string>('');
  const [merging, setMerging] = useState(false);
  const [mergedCount, setMergedCount] = useState(0);
  const [error, setError] = useState('');

  // Initialize primary when group changes
  const currentGroup = duplicateGroups[selectedGroupIdx] || null;
  const groupOffices = currentGroup?.offices || [];

  // Auto-pick primary: prefer one with legislator_people_id (API-imported), then most data
  useState(() => {
    if (groupOffices.length >= 2 && !primaryId) {
      const best = pickBestPrimary(groupOffices);
      setPrimaryId(best.id);
    }
  });

  function pickBestPrimary(group: LegislativeOffice[]): LegislativeOffice {
    // Prefer: has legislator_people_id > has more non-null fields > newer
    return [...group].sort((a, b) => {
      const aApi = a.legislator_people_id ? 1 : 0;
      const bApi = b.legislator_people_id ? 1 : 0;
      if (bApi !== aApi) return bApi - aApi;
      const countFields = (o: LegislativeOffice) =>
        MERGE_FIELDS.reduce((n, f) => n + (o[f.key] ? 1 : 0), 0);
      return countFields(b) - countFields(a);
    })[0];
  }

  // When group changes, re-pick primary
  const handleGroupChange = (idx: number) => {
    setSelectedGroupIdx(idx);
    const g = duplicateGroups[idx];
    if (g) setPrimaryId(pickBestPrimary(g.offices).id);
    setError('');
  };

  // Compute merged result preview
  const mergePreview = useMemo(() => {
    if (!primaryId || groupOffices.length < 2) return null;
    const primary = groupOffices.find((o) => o.id === primaryId)!;
    const secondaries = groupOffices.filter((o) => o.id !== primaryId);

    // For each field, take primary value, fall back to first secondary with a value
    const merged: Record<string, any> = {};
    for (const f of MERGE_FIELDS) {
      let val = primary[f.key];
      if (!val) {
        for (const sec of secondaries) {
          if (sec[f.key]) { val = sec[f.key]; break; }
        }
      }
      merged[f.key] = val;
    }

    // Collect all staff from all records in the group
    const allStaff: LegislativeOfficeStaff[] = [];
    for (const o of groupOffices) {
      allStaff.push(...(staffMap[o.id] || []));
    }

    return { merged, allStaff, primary, secondaries };
  }, [primaryId, groupOffices, staffMap]);

  const handleMerge = async () => {
    if (!mergePreview) return;
    setMerging(true);
    setError('');

    const { merged, primary, secondaries } = mergePreview;
    const secondaryIds = secondaries.map((s) => s.id);

    try {
      // 1. Update primary office with merged field values
      const updatePayload: Record<string, any> = {};
      for (const f of MERGE_FIELDS) {
        if (f.key === 'legislator_people_id') {
          updatePayload[f.key] = merged[f.key] || null;
        } else {
          updatePayload[f.key] = merged[f.key] || null;
        }
      }
      const { error: updateErr } = await supabase
        .from('legislative_offices')
        .update(updatePayload)
        .eq('id', primary.id);
      if (updateErr) throw updateErr;

      // 2. Move staff from secondary offices to primary
      for (const secId of secondaryIds) {
        const { error: staffErr } = await supabase
          .from('legislative_office_staff')
          .update({ office_id: primary.id })
          .eq('office_id', secId);
        if (staffErr) throw staffErr;
      }

      // 3. Update ga_engagements.committee_office_id references
      for (const secId of secondaryIds) {
        await supabase
          .from('ga_engagements')
          .update({ committee_office_id: primary.id })
          .eq('committee_office_id', secId);
      }

      // 4. Delete secondary offices (staff already moved, cascade won't lose anything)
      for (const secId of secondaryIds) {
        const { error: delErr } = await supabase
          .from('legislative_offices')
          .delete()
          .eq('id', secId);
        if (delErr) throw delErr;
      }

      setMergedCount((c) => c + 1);

      // Move to next group or finish
      const remaining = duplicateGroups.filter(
        (_, i) => i !== selectedGroupIdx
      );
      if (remaining.length > 0) {
        // Refresh from parent
        onMerged();
      } else {
        onMerged();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Merge failed');
      setMerging(false);
    }
  };

  if (duplicateGroups.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 sm:p-4">
        <div className="bg-white shadow-xl w-full h-full sm:h-auto sm:rounded-xl sm:max-w-md p-6 text-center">
          <GitMerge className="w-10 h-10 mx-auto text-teal-600 mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-2">No Duplicates Found</h3>
          <p className="text-xs text-gray-500 mb-4">
            All offices have unique names. No merging needed.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 sm:p-4">
      <div className="bg-white shadow-xl w-full h-full sm:h-auto sm:rounded-xl sm:max-w-2xl sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4.5 h-4.5 text-teal-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Merge Duplicate Offices
            </h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {duplicateGroups.length} group{duplicateGroups.length > 1 ? 's' : ''} found
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Group selector (if multiple) */}
          {duplicateGroups.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Duplicate groups:</span>
              {duplicateGroups.map((g, i) => (
                <button
                  key={g.key}
                  onClick={() => handleGroupChange(i)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    i === selectedGroupIdx
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {stripName(g.offices[0].name)} ({g.offices.length})
                </button>
              ))}
            </div>
          )}

          {currentGroup && (
            <>
              {/* Pick primary */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Select Primary Record (keep this one)
                </p>
                <div className="space-y-2">
                  {groupOffices.map((o) => {
                    const staff = staffMap[o.id] || [];
                    const isPrimary = o.id === primaryId;
                    const fieldCount = MERGE_FIELDS.reduce((n, f) => n + (o[f.key] ? 1 : 0), 0);
                    return (
                      <button
                        key={o.id}
                        onClick={() => setPrimaryId(o.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isPrimary
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isPrimary && <Check className="w-4 h-4 text-teal-600" />}
                            <span className="text-sm font-medium text-gray-900">{displayOfficeName(o)}</span>
                            {o.state && (
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o.state}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            {o.legislator_people_id && (
                              <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">API</span>
                            )}
                            <span>{staff.length} staff</span>
                            <span>{fieldCount} fields</span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 truncate">
                          {o.name}
                          {o.phone ? ` | ${o.phone}` : ''}
                          {o.email ? ` | ${o.email}` : ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Merge preview */}
              {mergePreview && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Merged Result Preview
                  </p>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase tracking-wide">
                          <th className="text-left py-1 pr-2 font-medium">Field</th>
                          <th className="text-left py-1 font-medium">Merged Value</th>
                          <th className="text-left py-1 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MERGE_FIELDS.map((f) => {
                          const val = mergePreview.merged[f.key];
                          if (!val && !mergePreview.primary[f.key]) return null;
                          const fromPrimary = !!mergePreview.primary[f.key];
                          const source = fromPrimary
                            ? 'Primary'
                            : mergePreview.secondaries.find((s) => s[f.key])
                              ? 'Merged in'
                              : '';
                          return (
                            <tr key={f.key} className="border-t border-gray-100">
                              <td className="py-1.5 pr-2 text-gray-500">{f.label}</td>
                              <td className="py-1.5 text-gray-900 font-medium">
                                {String(val || '—')}
                              </td>
                              <td className="py-1.5">
                                {source === 'Merged in' ? (
                                  <span className="text-teal-600 flex items-center gap-0.5">
                                    <ArrowRight className="w-3 h-3" /> merged in
                                  </span>
                                ) : (
                                  <span className="text-gray-400">{source}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Staff preview */}
                    {mergePreview.allStaff.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 font-medium mb-1">
                          Combined Staff ({mergePreview.allStaff.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {mergePreview.allStaff.map((s) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-700"
                            >
                              {s.first_name} {s.last_name}
                              {s.title && <span className="text-gray-400">({s.title})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warning */}
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-700">
                      <strong>This will delete {mergePreview.secondaries.length} duplicate record{mergePreview.secondaries.length > 1 ? 's' : ''}.</strong>{' '}
                      Staff members and engagement links will be moved to the primary record. This action cannot be undone.
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            {mergedCount > 0 && `${mergedCount} group${mergedCount > 1 ? 's' : ''} merged`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mergedCount > 0 ? 'Done' : 'Cancel'}
            </button>
            {currentGroup && (
              <button
                type="button"
                onClick={handleMerge}
                disabled={merging || !primaryId}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {merging ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitMerge className="w-3.5 h-3.5" />
                )}
                Merge
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeLegOfficeModal;
