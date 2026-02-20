import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileUp,
  ArrowLeft,
  Check,
  Trash2,
  Users
} from 'lucide-react';
import { parseVCardFile } from '../lib/vcard-parser';
import type { ParsedContact } from '../lib/vcard-parser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const BATCH_SIZE = 50;

const ContactImport: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParseError(null);
    setImportResult(null);

    const allContacts: ParsedContact[] = [];
    let filesRead = 0;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          const contacts = parseVCardFile(text);
          allContacts.push(...contacts);
        } catch {
          setParseError(`Failed to parse ${file.name}`);
        }
        filesRead++;
        if (filesRead === files.length) {
          if (allContacts.length === 0 && !parseError) {
            setParseError('No contacts found in the uploaded file(s).');
          }
          setParsedContacts(allContacts);
        }
      };
      reader.onerror = () => {
        filesRead++;
        setParseError(`Failed to read ${file.name}`);
      };
      reader.readAsText(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const toggleSelect = (index: number) => {
    setParsedContacts(prev =>
      prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c)
    );
  };

  const toggleSelectAll = () => {
    const allSelected = parsedContacts.every(c => c.selected);
    setParsedContacts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const updateField = (index: number, field: string, value: string) => {
    setParsedContacts(prev =>
      prev.map((c, i) => i === index ? { ...c, [field]: value } : c)
    );
  };

  const removeContact = (index: number) => {
    setParsedContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const selected = parsedContacts.filter(c => c.selected);
    if (selected.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed = 0;

    const userId = user!.id;

    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE).map(c => ({
        first_name: c.first_name,
        last_name: c.last_name,
        title: c.title || null,
        email_work: c.email_work || null,
        email_personal: c.email_personal || null,
        phone_mobile: c.phone_mobile || null,
        phone_office: c.phone_office || null,
        phone_home: c.phone_home || null,
        address_line1: c.address_line1 || null,
        address_line2: c.address_line2 || null,
        city: c.city || null,
        state: c.state || null,
        zip: c.zip || null,
        notes: c.notes || null,
        is_donor: false,
        is_vip: false,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('contacts').insert(batch).select();
      if (error) {
        failed += batch.length;
      } else {
        success += data?.length || 0;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
  };

  const selectedCount = parsedContacts.filter(c => c.selected).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Upload className="w-8 h-8 mr-3" />
              Import Contacts
            </h1>
            <p className="mt-2 text-blue-100">
              Import contacts from vCard (.vcf) files
            </p>
          </div>
          <button
            onClick={() => navigate('/contacts')}
            className="inline-flex items-center px-4 py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-sm font-medium text-white hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </button>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className={`rounded-xl p-4 border ${
          importResult.failed === 0
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <Check className={`w-5 h-5 mr-2 ${importResult.failed === 0 ? 'text-green-600' : 'text-yellow-600'}`} />
            <p className={`text-sm font-medium ${importResult.failed === 0 ? 'text-green-800' : 'text-yellow-800'}`}>
              {importResult.success} contact{importResult.success !== 1 ? 's' : ''} imported successfully
              {importResult.failed > 0 && `, ${importResult.failed} failed`}.
            </p>
          </div>
          <button
            onClick={() => navigate('/contacts')}
            className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            View all contacts
          </button>
        </div>
      )}

      {/* Parse Error */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{parseError}</p>
        </div>
      )}

      {/* Drag & Drop Zone (show when no contacts parsed or after import) */}
      {parsedContacts.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50 scale-[1.01]'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FileUp className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drag & drop .vcf files here
          </p>
          <p className="text-sm text-gray-500 mb-4">
            or click to browse your files
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            Browse Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.vcard"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <p className="text-xs text-gray-400 mt-4">
            Supports vCard 3.0 and 4.0 formats (.vcf files)
          </p>
        </div>
      )}

      {/* Preview Table */}
      {parsedContacts.length > 0 && !importResult && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-gray-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {parsedContacts.length} Contact{parsedContacts.length !== 1 ? 's' : ''} Found
                </h2>
                <span className="ml-3 text-sm text-gray-500">
                  {selectedCount} selected
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setParsedContacts([]);
                    setParseError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Add More Files
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Import {selectedCount} Contact{selectedCount !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,.vcard"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFiles(e.target.files);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={parsedContacts.every(c => c.selected)}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parsedContacts.map((contact, index) => (
                  <tr key={index} className={`hover:bg-gray-50 ${!contact.selected ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={contact.selected}
                        onChange={() => toggleSelect(index)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    {(['first_name', 'last_name', 'title', 'email_work', 'phone_mobile', 'org_name', 'city', 'state'] as const).map(field => (
                      <td key={field} className="px-4 py-3">
                        {editingCell?.row === index && editingCell?.field === field ? (
                          <input
                            type="text"
                            value={(contact as any)[field] || ''}
                            onChange={(e) => updateField(index, field, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingCell(null)}
                            className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => field !== 'org_name' && setEditingCell({ row: index, field })}
                            className={`text-sm text-gray-900 ${field !== 'org_name' ? 'cursor-text hover:bg-blue-50 px-1 py-0.5 rounded' : ''}`}
                          >
                            {(contact as any)[field] || <span className="text-gray-300">—</span>}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeContact(index)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactImport;
