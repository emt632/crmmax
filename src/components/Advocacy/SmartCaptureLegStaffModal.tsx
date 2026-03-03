import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X, Sparkles, Camera, Upload, FileText, Check, ArrowLeft, Plus, Search, Building2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LegislativeOffice, LegislativeOfficeStaff } from '../../types';

interface SmartCaptureLegStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (staff: LegislativeOfficeStaff | null, office: LegislativeOffice) => void;
  existingOffices: LegislativeOffice[];
  userId: string;
  targetOffice?: LegislativeOffice;
}

const SYSTEM_PROMPT = `You are a legislative staff information extractor. Given text from a business card, email signature, or staff directory, extract structured information. The card may belong to a legislator themselves OR to one of their staff members.

Return a JSON object with ONLY these fields (omit fields you cannot determine):
{
  "first_name": "string (the person on the card)",
  "last_name": "string",
  "title": "string (job title, e.g., Chief of Staff, Legislative Director, United States Senator)",
  "email": "string",
  "phone": "string",
  "office_name": "string (the legislator's full name with title, e.g., 'Senator John Smith', 'Representative Jane Doe' — NOT generic titles like 'United States Senator'. For committees use the committee name, e.g., 'Senate Finance Committee')",
  "state": "string (2-letter state abbreviation)",
  "chamber": "string (senate, house, or assembly)",
  "address": "string (street address)",
  "city": "string",
  "zip": "string",
  "is_legislator": "boolean (true if the card belongs to the legislator/senator/representative themselves, false if it belongs to a staff member)"
}

IMPORTANT: If the card belongs to the legislator themselves (e.g., 'Senator John Hoeven'), set is_legislator to true. The office_name should still be their titled name (e.g., 'Senator John Hoeven'). The first_name and last_name should be the legislator's name.

IMPORTANT casing rules:
- Convert ALL CAPS text to proper Title Case (e.g. "JOHN SMITH" → "John Smith").
- Preserve well-known abbreviations in uppercase: CEO, CFO, COO, CTO, VP, EVP, SVP, MD, RN, PhD, LLC, LLP, Inc, Jr, Sr, II, III, IV, SE, NE, NW, SW, STE, APT, FL, PO.
- Preserve state abbreviations as 2-letter uppercase (MN, CA, DC, etc.).
- Keep email addresses exactly as-is (lowercase).
- Preserve titles like "Sen.", "Rep.", "Hon." as-is.
Return ONLY valid JSON, no markdown or explanation.`;

const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400';

// Strip title/office prefixes to get just the name
function stripName(name: string): string {
  return name
    .replace(/^Office of\s+(Sen\.\s*|Rep\.\s*|Senator\s+|Representative\s+|Congressman\s+|Congresswoman\s+)?/i, '')
    .replace(/^Senator\s+/i, '')
    .replace(/^Representative\s+/i, '')
    .replace(/^Congressman\s+/i, '')
    .replace(/^Congresswoman\s+/i, '')
    .replace(/^Congressperson\s+/i, '')
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
  const display = office.office_type === 'legislator' && title ? `${title} ${clean}` : office.name;
  return display + (office.state ? ` (${office.state})` : '');
}

// Fuzzy match: check if any significant words from the query appear in the office name
function fuzzyMatchOffice(office: LegislativeOffice, query: string): boolean {
  const oName = stripName(office.name).toLowerCase();
  const oState = (office.state || '').toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  // Check if every word in the query matches part of the office name or state
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  return words.every((w) => oName.includes(w) || oState.includes(w) || (office.name || '').toLowerCase().includes(w));
}

const SmartCaptureLegStaffModal: React.FC<SmartCaptureLegStaffModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  existingOffices,
  userId,
  targetOffice,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [signatureText, setSignatureText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState<'input' | 'preview'>('input');
  const [parsedStaff, setParsedStaff] = useState<{
    first_name: string; last_name: string; title: string;
    email: string; phone: string;
    office_name: string; state: string; chamber: string;
    address: string; city: string; zip: string;
  }>({ first_name: '', last_name: '', title: '', email: '', phone: '', office_name: '', state: '', chamber: '', address: '', city: '', zip: '' });

  const [isLegislatorCard, setIsLegislatorCard] = useState(false);
  const [matchedOfficeId, setMatchedOfficeId] = useState<string>('');
  const [createNewOffice, setCreateNewOffice] = useState(false);
  const [saving, setSaving] = useState(false);

  // Office search state
  const [officeSearchQuery, setOfficeSearchQuery] = useState('');
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const officeSearchRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  // Close office dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (officeSearchRef.current && !officeSearchRef.current.contains(e.target as Node)) {
        setShowOfficeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filtered offices for the searchable dropdown
  const filteredOffices = useMemo(() => {
    if (!officeSearchQuery.trim()) return existingOffices;
    return existingOffices.filter((o) => fuzzyMatchOffice(o, officeSearchQuery));
  }, [existingOffices, officeSearchQuery]);

  // Pre-configure when targetOffice is provided (scan card for specific office)
  useEffect(() => {
    if (targetOffice && isOpen) {
      setIsLegislatorCard(true);
      setMatchedOfficeId(targetOffice.id);
      setCreateNewOffice(false);
    }
  }, [targetOffice, isOpen]);

  // Auto-match office when parsed data changes — fuzzy match on legislator name
  useEffect(() => {
    if (targetOffice) return; // Skip auto-match when target is pre-selected
    if (parsedStaff.office_name && existingOffices.length > 0) {
      const q = parsedStaff.office_name.toLowerCase();
      const stripped = stripName(parsedStaff.office_name).toLowerCase();
      // Try exact match first, then fuzzy match on stripped name
      const match =
        existingOffices.find((o) => o.name.toLowerCase() === q) ||
        existingOffices.find((o) => stripName(o.name).toLowerCase() === stripped) ||
        existingOffices.find((o) => {
          const oStripped = stripName(o.name).toLowerCase();
          return stripped.length >= 3 && (oStripped.includes(stripped) || stripped.includes(oStripped));
        });
      if (match) {
        setMatchedOfficeId(match.id);
        setCreateNewOffice(false);
      } else {
        setMatchedOfficeId('');
        setCreateNewOffice(true); // Auto-show create form so user can edit
      }
    }
  }, [parsedStaff.office_name, existingOffices]);

  const resetState = () => {
    setActiveTab('text');
    setSignatureText('');
    setImageFile(null);
    setImagePreviewUrl(null);
    setParsing(false);
    setError('');
    setPhase('input');
    setParsedStaff({ first_name: '', last_name: '', title: '', email: '', phone: '', office_name: '', state: '', chamber: '', address: '', city: '', zip: '' });
    setIsLegislatorCard(false);
    setMatchedOfficeId('');
    setCreateNewOffice(false);
    setOfficeSearchQuery('');
    setShowOfficeDropdown(false);
    setSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelected = (file: File) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const parseResponse = (content: string) => {
    const jsonString = content.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const parsed = JSON.parse(jsonString);
    setParsedStaff({
      first_name: parsed.first_name || '',
      last_name: parsed.last_name || '',
      title: parsed.title || '',
      email: parsed.email || '',
      phone: parsed.phone || '',
      office_name: parsed.office_name || '',
      state: parsed.state || '',
      chamber: parsed.chamber || '',
      address: parsed.address || '',
      city: parsed.city || '',
      zip: parsed.zip || '',
    });
    if (parsed.is_legislator) {
      setIsLegislatorCard(true);
    }
    setPhase('preview');
  };

  const handleParseText = async () => {
    if (!signatureText.trim()) return;
    setParsing(true);
    setError('');

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        setError('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your .env file.');
        setParsing(false);
        return;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: signatureText },
          ],
          temperature: 0,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      parseResponse(content);
    } catch (err: any) {
      setError(err.message || 'Failed to parse text');
    } finally {
      setParsing(false);
    }
  };

  const handleParseImage = async () => {
    if (!imageFile) return;
    setParsing(true);
    setError('');

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        setError('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your .env file.');
        setParsing(false);
        return;
      }

      const base64 = await fileToBase64(imageFile);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: SYSTEM_PROMPT },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${imageFile.type};base64,${base64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error?.message || `API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error('No response from AI');

      parseResponse(content);
    } catch (err: any) {
      setError(err.message || 'Failed to parse image');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!isLegislatorCard && (!parsedStaff.first_name.trim() || !parsedStaff.last_name.trim())) {
      setError('First and last name are required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let officeId = matchedOfficeId;
      let office: LegislativeOffice;

      const officeContactFields = {
        phone: parsedStaff.phone.trim() || null,
        email: parsedStaff.email.trim() || null,
        address: parsedStaff.address.trim() || null,
        city: parsedStaff.city.trim() || null,
        office_state: parsedStaff.state || null,
        zip: parsedStaff.zip.trim() || null,
      };

      if (isLegislatorCard) {
        // Legislator's own card — create or update office with contact info
        const officeName = parsedStaff.office_name.trim() || `${parsedStaff.first_name} ${parsedStaff.last_name}`.trim();
        if (!officeName) {
          setError('Office name is required.');
          setSaving(false);
          return;
        }

        if (matchedOfficeId) {
          // Update existing office with contact info from card
          const { data: updated, error: updErr } = await supabase
            .from('legislative_offices')
            .update(officeContactFields)
            .eq('id', matchedOfficeId)
            .select('*')
            .single();

          if (updErr || !updated) throw new Error('Failed to update office');
          office = updated as LegislativeOffice;
        } else {
          // Create new office with contact info
          const officeType = officeName.toLowerCase().includes('committee') ? 'committee' : 'legislator';
          const { data: newOffice, error: offErr } = await supabase
            .from('legislative_offices')
            .insert({
              office_type: officeType,
              name: officeName,
              state: parsedStaff.state || null,
              chamber: parsedStaff.chamber || null,
              created_by: userId,
              ...officeContactFields,
            })
            .select('*')
            .single();

          if (offErr || !newOffice) throw new Error('Failed to create office');
          office = newOffice as LegislativeOffice;
        }

        onCreated(null, office);
        resetState();
        onClose();
        return;
      }

      // Staff card flow
      if (createNewOffice && parsedStaff.office_name.trim()) {
        // Create new office
        const officeType = parsedStaff.office_name.toLowerCase().includes('committee') ? 'committee' : 'legislator';
        const { data: newOffice, error: offErr } = await supabase
          .from('legislative_offices')
          .insert({
            office_type: officeType,
            name: parsedStaff.office_name.trim(),
            state: parsedStaff.state || null,
            chamber: parsedStaff.chamber || null,
            created_by: userId,
          })
          .select('*')
          .single();

        if (offErr || !newOffice) throw new Error('Failed to create office');
        officeId = newOffice.id;
        office = newOffice as LegislativeOffice;
      } else if (matchedOfficeId) {
        office = existingOffices.find((o) => o.id === matchedOfficeId)!;
      } else {
        setError('Please select or create an office.');
        setSaving(false);
        return;
      }

      // Create staff member
      const { data: staffData, error: staffErr } = await supabase
        .from('legislative_office_staff')
        .insert({
          office_id: officeId,
          first_name: parsedStaff.first_name.trim(),
          last_name: parsedStaff.last_name.trim(),
          title: parsedStaff.title.trim() || null,
          email: parsedStaff.email.trim() || null,
          phone: parsedStaff.phone.trim() || null,
          created_by: userId,
        })
        .select('*')
        .single();

      if (staffErr || !staffData) throw new Error('Failed to create staff');

      onCreated(staffData as LegislativeOfficeStaff, office!);
      resetState();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white shadow-lg w-full h-full sm:h-auto sm:rounded-xl sm:max-w-lg sm:mx-4 overflow-hidden sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            {phase === 'preview' && (
              <button
                onClick={() => setPhase('input')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {phase === 'input'
                ? (targetOffice ? 'Scan Card' : 'Smart Capture — Staff')
                : (targetOffice ? 'Review & Update' : 'Review & Create')}
            </h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        {phase === 'input' && (
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'text'
                  ? 'border-b-2 border-teal-600 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 mr-2 inline" />
              Paste Text
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'image'
                  ? 'border-b-2 border-teal-600 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Camera className="w-4 h-4 mr-2 inline" />
              Scan Image
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* INPUT PHASE */}
          {phase === 'input' && (
            <div className="p-4 sm:p-6 space-y-4">
              {activeTab === 'text' && (
                <>
                  <p className="text-sm text-gray-600">
                    Paste a staff directory entry, business card text, or email signature.
                  </p>
                  <textarea
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    rows={6}
                    placeholder={"Jane Doe\nChief of Staff\nSenator John Smith\n(555) 123-4567\njane.doe@senate.gov"}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-mono text-sm"
                  />
                </>
              )}

              {activeTab === 'image' && (
                <>
                  <p className="text-sm text-gray-600">
                    Upload or take a photo of a business card.
                  </p>
                  {imagePreviewUrl ? (
                    <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50 text-center">
                      <img src={imagePreviewUrl} alt="Card" className="max-h-40 sm:max-h-48 mx-auto rounded-lg shadow-md" />
                      <button
                        onClick={() => {
                          if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                          setImageFile(null);
                          setImagePreviewUrl(null);
                        }}
                        className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file?.type.startsWith('image/')) handleImageSelected(file);
                      }}
                      className={`hidden sm:block border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                        isDragOver ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Drag & drop an image here</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelected(file);
                        }}
                      />
                      <span className="flex items-center justify-center px-4 py-3 sm:py-2.5 border-2 border-teal-200 rounded-xl text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer">
                        <Camera className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                        Take Photo
                      </span>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelected(file);
                        }}
                      />
                      <span className="flex items-center justify-center px-4 py-3 sm:py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                        <Upload className="w-5 h-5 sm:w-4 sm:h-4 mr-2" />
                        Choose from Library
                      </span>
                    </label>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW PHASE */}
          {phase === 'preview' && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Card type toggle */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setIsLegislatorCard(false)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    !isLegislatorCard ? 'bg-white shadow-sm text-teal-700 ring-1 ring-teal-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Staff Card
                </button>
                <button
                  type="button"
                  onClick={() => setIsLegislatorCard(true)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isLegislatorCard ? 'bg-white shadow-sm text-teal-700 ring-1 ring-teal-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Legislator Card
                </button>
              </div>

              {isLegislatorCard ? (
                <>
                  {/* Legislator card — office info */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Office Information</p>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Office Name *</label>
                      <input
                        value={parsedStaff.office_name}
                        onChange={(e) => setParsedStaff((p) => ({ ...p, office_name: e.target.value }))}
                        placeholder="e.g., Senator John Hoeven"
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">State</label>
                        <input
                          value={parsedStaff.state}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, state: e.target.value }))}
                          placeholder="e.g., ND"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Chamber</label>
                        <select
                          value={parsedStaff.chamber}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, chamber: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="">Select...</option>
                          <option value="senate">Senate</option>
                          <option value="house">House</option>
                          <option value="assembly">Assembly</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Office Phone</label>
                        <input
                          type="tel"
                          value={parsedStaff.phone}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, phone: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Office Email</label>
                        <input
                          type="email"
                          value={parsedStaff.email}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, email: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Street Address</label>
                      <input
                        value={parsedStaff.address}
                        onChange={(e) => setParsedStaff((p) => ({ ...p, address: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">City</label>
                        <input
                          value={parsedStaff.city}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, city: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Zip</label>
                        <input
                          value={parsedStaff.zip}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, zip: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Match to existing or create new */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link to Existing Office?</p>
                    <div ref={officeSearchRef} className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={officeSearchQuery}
                          onChange={(e) => { setOfficeSearchQuery(e.target.value); setShowOfficeDropdown(true); }}
                          onFocus={() => setShowOfficeDropdown(true)}
                          placeholder="Search to update existing office, or leave empty to create new"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      {showOfficeDropdown && (
                        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredOffices.map((o) => (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => {
                                setMatchedOfficeId(o.id);
                                setOfficeSearchQuery('');
                                setShowOfficeDropdown(false);
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-teal-50 transition-colors ${
                                matchedOfficeId === o.id ? 'bg-teal-50' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-900">{displayOfficeName(o)}</span>
                              </div>
                              {matchedOfficeId === o.id && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                            </button>
                          ))}
                          {filteredOffices.length === 0 && (
                            <div className="px-3 py-3 text-xs text-gray-400 text-center">No offices match</div>
                          )}
                        </div>
                      )}
                    </div>
                    {matchedOfficeId && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                        <p className="text-xs text-green-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Will update: <strong>{displayOfficeName(existingOffices.find((o) => o.id === matchedOfficeId)!)}</strong>
                        </p>
                        <button onClick={() => setMatchedOfficeId('')} className="text-green-600 hover:text-green-800">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {!matchedOfficeId && (
                      <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                        <p className="text-xs text-teal-700 flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Will create a new office
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Staff card — existing flow */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Staff Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">First Name *</label>
                        <input
                          value={parsedStaff.first_name}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, first_name: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Last Name *</label>
                        <input
                          value={parsedStaff.last_name}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, last_name: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input
                        value={parsedStaff.title}
                        onChange={(e) => setParsedStaff((p) => ({ ...p, title: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Email</label>
                        <input
                          type="email"
                          value={parsedStaff.email}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, email: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={parsedStaff.phone}
                          onChange={(e) => setParsedStaff((p) => ({ ...p, phone: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Office assignment */}
                  <div className="space-y-3 border-t border-gray-200 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link to Legislator / Office</p>

                {/* Searchable office picker */}
                <div ref={officeSearchRef} className="relative">
                  <label className="block text-xs text-gray-500 mb-1">Search existing offices</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={officeSearchQuery}
                      onChange={(e) => { setOfficeSearchQuery(e.target.value); setShowOfficeDropdown(true); }}
                      onFocus={() => setShowOfficeDropdown(true)}
                      placeholder="Type legislator name, state..."
                      className={`${inputClass} pl-9`}
                    />
                    {matchedOfficeId && !createNewOffice && (
                      <button
                        onClick={() => { setMatchedOfficeId(''); setOfficeSearchQuery(''); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showOfficeDropdown && (
                    <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredOffices.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setMatchedOfficeId(o.id);
                            setCreateNewOffice(false);
                            setOfficeSearchQuery('');
                            setShowOfficeDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-teal-50 transition-colors ${
                            matchedOfficeId === o.id ? 'bg-teal-50' : ''
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-900">{displayOfficeName(o)}</span>
                            {o.district && (
                              <span className="ml-2 text-xs text-gray-400">District {o.district}</span>
                            )}
                          </div>
                          {matchedOfficeId === o.id && (
                            <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                      {filteredOffices.length === 0 && (
                        <div className="px-3 py-3 text-xs text-gray-400 text-center">No offices match your search</div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCreateNewOffice(true);
                          setMatchedOfficeId('');
                          setShowOfficeDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-teal-700 hover:bg-teal-50 border-t border-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Create new office</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Selected office confirmation */}
                {matchedOfficeId && !createNewOffice && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Will be added to: <strong>{displayOfficeName(existingOffices.find((o) => o.id === matchedOfficeId)!)}</strong>
                    </p>
                  </div>
                )}

                {/* Create new office form */}
                {createNewOffice && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-teal-700 flex items-center gap-1 font-medium">
                      <Plus className="w-3 h-3" />
                      Create new office
                    </p>
                    <input
                      value={parsedStaff.office_name}
                      onChange={(e) => setParsedStaff((p) => ({ ...p, office_name: e.target.value }))}
                      placeholder="Office name (e.g., Senator Jane Doe)"
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={parsedStaff.state}
                        onChange={(e) => setParsedStaff((p) => ({ ...p, state: e.target.value }))}
                        placeholder="State (e.g., MN)"
                        className={inputClass}
                      />
                      <select
                        value={parsedStaff.chamber}
                        onChange={(e) => setParsedStaff((p) => ({ ...p, chamber: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Chamber...</option>
                        <option value="senate">Senate</option>
                        <option value="house">House</option>
                        <option value="assembly">Assembly</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>

          {phase === 'input' && activeTab === 'text' && (
            <button
              onClick={handleParseText}
              disabled={parsing || !signatureText.trim()}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center transition-colors text-sm font-medium"
            >
              {parsing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract
                </>
              )}
            </button>
          )}

          {phase === 'input' && activeTab === 'image' && (
            <button
              onClick={handleParseImage}
              disabled={parsing || !imageFile}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center transition-colors text-sm font-medium"
            >
              {parsing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Scanning...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Extract
                </>
              )}
            </button>
          )}

          {phase === 'preview' && (
            <button
              onClick={handleConfirm}
              disabled={saving || (isLegislatorCard ? !parsedStaff.office_name.trim() : (!parsedStaff.first_name.trim() || !parsedStaff.last_name.trim() || (!matchedOfficeId && !createNewOffice)))}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center transition-colors text-sm font-medium"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartCaptureLegStaffModal;
