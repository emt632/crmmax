import React, { useState } from 'react';
import { Search, X, Download, Loader2 } from 'lucide-react';
import { searchBills, getBillDetail, legiscanBillToFormData } from '../../lib/legiscan-api';
import type { LegiscanSearchResult } from '../../lib/legiscan-api';
import { formatBillNumber } from '../../lib/bill-format';
import { US_STATES } from '../../lib/bill-format';

interface LegiScanSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (billData: ReturnType<typeof legiscanBillToFormData>) => void;
  ourStates?: string[];
}

type Phase = 'search' | 'results' | 'importing';

const LegiScanSearchModal: React.FC<LegiScanSearchModalProps> = ({ isOpen, onClose, onImport, ourStates = [] }) => {
  const [phase, setPhase] = useState<Phase>('search');
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [results, setResults] = useState<LegiscanSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const data = await searchBills(query, jurisdiction || undefined);
      setResults(data);
      setPhase('results');
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (result: LegiscanSearchResult) => {
    setImporting(result.bill_id);
    setError('');
    try {
      const detail = await getBillDetail(result.bill_id);
      if (!detail) {
        setError('Failed to fetch bill details');
        return;
      }
      const formData = legiscanBillToFormData(detail);
      onImport(formData);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(null);
    }
  };

  const handleClose = () => {
    setPhase('search');
    setQuery('');
    setJurisdiction('');
    setResults([]);
    setError('');
    setImporting(null);
    onClose();
  };

  const handleBack = () => {
    setPhase('search');
    setResults([]);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">LegiScan Bill Search</h2>
            <p className="text-sm text-gray-500 mt-1">
              {phase === 'search' ? 'Search for a bill to import' : `${results.length} results found`}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {phase === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Query</label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter bill number, keyword, or topic..."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction (optional)</label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all"
                >
                  <option value="">All Jurisdictions</option>
                  {(ourStates.length > 0
                    ? US_STATES.filter((s) => ourStates.includes(s.value))
                    : US_STATES
                  ).map((s) => (
                    <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div className="space-y-2">
              {results.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No bills found matching your search.</p>
                  <button
                    onClick={handleBack}
                    className="mt-3 text-sm text-teal-600 hover:text-teal-700"
                  >
                    Try another search
                  </button>
                </div>
              ) : (
                results.map((r) => (
                  <div
                    key={r.bill_id}
                    className="flex items-start justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{formatBillNumber(r.bill_number)}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.state}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{r.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Last action: {r.last_action_date} — {r.last_action}
                      </p>
                    </div>
                    <button
                      onClick={() => handleImport(r)}
                      disabled={importing === r.bill_id}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {importing === r.bill_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Import
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          {phase === 'results' ? (
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              Back to Search
            </button>
          ) : (
            <div />
          )}
          {phase === 'search' && (
            <button
              onClick={handleSearch}
              disabled={!query.trim() || searching}
              className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search LegiScan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegiScanSearchModal;
