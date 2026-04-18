import React, { useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { generateExecSummary } from '../../lib/exec-summary';

interface EnrichedEngagement {
  id: string;
  type: string;
  date: string;
  subject: string;
  notes?: string;
  topics_covered?: string;
  meeting_level?: 'member' | 'staff';
  jurisdiction?: string;
  committee_of_jurisdiction?: string;
  committee_role?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_completed?: boolean;
  bills: { id: string; bill_number: string; title: string }[];
  staff: { id: string; full_name: string | null; email: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  legislators: { people_id: number; name: string; party?: string; chamber?: string; state?: string }[];
  legStaff: { id: string; first_name: string; last_name: string; title?: string }[];
}

interface ExecSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagements: EnrichedEngagement[];
}

const ExecSummaryModal: React.FC<ExecSummaryModalProps> = ({ isOpen, onClose, engagements }) => {
  const [title, setTitle] = useState('State Capitol Legislative Briefing');
  const [subtitle, setSubtitle] = useState(`Executive Summary | ${format(new Date(), 'MMMM yyyy')}`);
  const [orgName, setOrgName] = useState('Life Link III');
  const [docFormat, setDocFormat] = useState<'pdf' | 'docx'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      await generateExecSummary(
        { title, subtitle, orgName, format: docFormat },
        engagements,
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const legOfficeCount = engagements.filter(e => e.type === 'legislator_office').length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Executive Summary</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Generate a polished executive summary from {engagements.length} engagement{engagements.length !== 1 ? 's' : ''} ({legOfficeCount} legislator meeting{legOfficeCount !== 1 ? 's' : ''}).
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <div className="flex gap-4">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={docFormat === 'pdf'}
                  onChange={() => setDocFormat('pdf')}
                  className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <span className="ml-2 text-sm text-gray-700">PDF</span>
              </label>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="docx"
                  checked={docFormat === 'docx'}
                  onChange={() => setDocFormat('docx')}
                  className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <span className="ml-2 text-sm text-gray-700">Word (.docx)</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || engagements.length === 0}
            className="inline-flex items-center px-5 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating summary...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExecSummaryModal;
