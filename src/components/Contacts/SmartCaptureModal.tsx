import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Camera,
  Upload,
  FileText,
  Check,
  ArrowLeft,
  User,
  Building2
} from 'lucide-react';
import type { Contact, Organization, SmartCaptureResult } from '../../types';
import { supabase } from '../../lib/supabase';

interface SmartCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (result: SmartCaptureResult) => void;
  existingOrganizations: Organization[];
  userId: string;
}

const SYSTEM_PROMPT = `You are a contact information extractor. Given an email signature or business card, extract structured contact and organization information. Return a JSON object with ONLY these fields (omit fields you cannot determine):
{
  "first_name": "string",
  "last_name": "string",
  "title": "string (job title)",
  "email_work": "string",
  "email_personal": "string",
  "phone_mobile": "string",
  "phone_office": "string",
  "phone_home": "string",
  "address_line1": "string",
  "address_line2": "string",
  "city": "string",
  "state": "string (2-letter abbreviation if US)",
  "zip": "string",
  "organization_name": "string",
  "organization_phone": "string",
  "organization_email": "string",
  "organization_website": "string"
}
Return ONLY valid JSON, no markdown or explanation.`;

const SmartCaptureModal: React.FC<SmartCaptureModalProps> = ({
  isOpen,
  onClose,
  onResult,
  existingOrganizations,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [signatureText, setSignatureText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  const [phase, setPhase] = useState<'input' | 'preview'>('input');
  const [parsedContact, setParsedContact] = useState<Partial<Contact>>({});
  const [parsedOrg, setParsedOrg] = useState({ name: '', phone: '', email: '', website: '' });
  const [createContact, setCreateContact] = useState(true);
  const [createOrg, setCreateOrg] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const resetState = () => {
    setActiveTab('text');
    setSignatureText('');
    setImageFile(null);
    setImagePreviewUrl(null);
    setParsing(false);
    setError('');
    setPhase('input');
    setParsedContact({});
    setParsedOrg({ name: '', phone: '', email: '', website: '' });
    setCreateContact(true);
    setCreateOrg(false);
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

    const contactFields = [
      'first_name', 'last_name', 'title',
      'email_work', 'email_personal',
      'phone_mobile', 'phone_office', 'phone_home',
      'address_line1', 'address_line2', 'city', 'state', 'zip'
    ];

    const contactData: Partial<Contact> = {};
    for (const field of contactFields) {
      if (parsed[field]) {
        (contactData as any)[field] = parsed[field];
      }
    }

    const orgData = {
      name: parsed.organization_name || '',
      phone: parsed.organization_phone || '',
      email: parsed.organization_email || '',
      website: parsed.organization_website || '',
    };

    setParsedContact(contactData);
    setParsedOrg(orgData);
    setCreateContact(true);
    setCreateOrg(!!orgData.name);
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
            { role: 'user', content: signatureText }
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
      setError(err.message || 'Failed to parse signature');
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
    let organizationId: string | undefined;

    if (createOrg && parsedOrg.name.trim()) {
      setSaving(true);
      try {
        // Check for existing org by name
        const existingOrg = existingOrganizations.find(
          o => o.name.toLowerCase() === parsedOrg.name.trim().toLowerCase()
        );

        if (existingOrg) {
          organizationId = existingOrg.id;
        } else {
          const { data, error: insertError } = await supabase
            .from('organizations')
            .insert([{
              name: parsedOrg.name.trim(),
              phone: parsedOrg.phone || null,
              email: parsedOrg.email || null,
              website: parsedOrg.website || null,
              is_donor: false,
              created_by: userId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (insertError) throw insertError;
          organizationId = data.id;
        }
      } catch (err: any) {
        setError(`Failed to create organization: ${err.message}`);
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    const result: SmartCaptureResult = {
      contactData: createContact ? parsedContact : {},
      organizationId,
      organizationRole: parsedContact.title,
    };

    onResult(result);
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-2">
            {phase === 'preview' && (
              <button
                onClick={() => setPhase('input')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {phase === 'input' ? 'Smart Capture' : 'Review & Create'}
            </h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs — only in input phase */}
        {phase === 'input' && (
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'text'
                  ? 'border-b-2 border-purple-600 text-purple-600'
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
                  ? 'border-b-2 border-purple-600 text-purple-600'
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
            <div className="p-6 space-y-4">
              {/* Text Tab */}
              {activeTab === 'text' && (
                <>
                  <p className="text-sm text-gray-600">
                    Paste an email signature or business card text below.
                  </p>
                  <textarea
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    rows={8}
                    placeholder={"John Smith\nDirector of Operations\nAcme Corp\n(555) 123-4567\njohn.smith@acme.com\n123 Main St, Suite 100\nAnytown, MN 55001"}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 transition-all font-mono text-sm"
                    autoFocus
                  />
                </>
              )}

              {/* Image Tab */}
              {activeTab === 'image' && (
                <>
                  <p className="text-sm text-gray-600">
                    Upload or take a photo of a business card.
                  </p>

                  {/* Drag & drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file?.type.startsWith('image/')) handleImageSelected(file);
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      isDragOver
                        ? 'border-purple-500 bg-purple-50'
                        : imagePreviewUrl
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    {imagePreviewUrl ? (
                      <div>
                        <img
                          src={imagePreviewUrl}
                          alt="Business card"
                          className="max-h-48 mx-auto rounded-lg shadow-md"
                        />
                        <button
                          onClick={() => {
                            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                            setImageFile(null);
                            setImagePreviewUrl(null);
                          }}
                          className="mt-3 text-sm text-red-600 hover:text-red-800"
                        >
                          Remove image
                        </button>
                      </div>
                    ) : (
                      <>
                        <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Drag & drop an image here</p>
                      </>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex space-x-3">
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
                      <span className="flex items-center justify-center px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </span>
                    </label>
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
                      <span className="flex items-center justify-center px-4 py-2.5 border-2 border-purple-200 rounded-xl text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors cursor-pointer">
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
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
            <div className="p-6 space-y-5">
              {/* Contact Section */}
              <div className="space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createContact}
                    onChange={(e) => setCreateContact(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Create Contact</span>
                </label>
                {createContact && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">First Name</label>
                      <input
                        value={parsedContact.first_name || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, first_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                      <input
                        value={parsedContact.last_name || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, last_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input
                        value={parsedContact.title || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Work Email</label>
                      <input
                        value={parsedContact.email_work || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, email_work: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Personal Email</label>
                      <input
                        value={parsedContact.email_personal || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, email_personal: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Mobile Phone</label>
                      <input
                        value={parsedContact.phone_mobile || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, phone_mobile: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Office Phone</label>
                      <input
                        value={parsedContact.phone_office || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, phone_office: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Address</label>
                      <input
                        value={parsedContact.address_line1 || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, address_line1: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">City</label>
                      <input
                        value={parsedContact.city || ''}
                        onChange={(e) => setParsedContact(prev => ({ ...prev, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">State</label>
                        <input
                          value={parsedContact.state || ''}
                          onChange={(e) => setParsedContact(prev => ({ ...prev, state: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">ZIP</label>
                        <input
                          value={parsedContact.zip || ''}
                          onChange={(e) => setParsedContact(prev => ({ ...prev, zip: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Organization Section */}
              <div className="space-y-3 border-t border-gray-200 pt-5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createOrg}
                    onChange={(e) => setCreateOrg(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Building2 className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-gray-900">Create Organization</span>
                  {parsedOrg.name && !createOrg && (
                    <span className="text-xs text-gray-400">({parsedOrg.name} detected)</span>
                  )}
                </label>
                {createOrg && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Organization Name</label>
                      <input
                        value={parsedOrg.name}
                        onChange={(e) => setParsedOrg(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                      {existingOrganizations.some(
                        o => o.name.toLowerCase() === parsedOrg.name.trim().toLowerCase()
                      ) && (
                        <p className="text-xs text-amber-600 mt-1">
                          This organization already exists — it will be linked instead of creating a duplicate.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Phone</label>
                      <input
                        value={parsedOrg.phone}
                        onChange={(e) => setParsedOrg(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Email</label>
                      <input
                        value={parsedOrg.email}
                        onChange={(e) => setParsedOrg(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Website</label>
                      <input
                        value={parsedOrg.website}
                        onChange={(e) => setParsedOrg(prev => ({ ...prev, website: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>

          {phase === 'input' && activeTab === 'text' && (
            <button
              onClick={handleParseText}
              disabled={parsing || !signatureText.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center transition-all"
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
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center transition-all"
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
              disabled={saving || (!createContact && !createOrg)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 flex items-center transition-all"
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

export default SmartCaptureModal;
