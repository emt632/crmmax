import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Check,
  Loader2,
  Mail,
  Phone,
  Building2,
  MapPin,
  Briefcase,
  FileUp,
  ContactRound,
} from 'lucide-react';
import { parseVCardFile } from '../lib/vcard-parser';
import type { ParsedContact } from '../lib/vcard-parser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Contact Picker API types (Chrome Android)
interface ContactPickerContact {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: Array<{
    addressLine?: string[];
    city?: string;
    region?: string;
    postalCode?: string;
  }>;
}

declare global {
  interface ContactsManager {
    select(
      properties: string[],
      options?: { multiple?: boolean }
    ): Promise<ContactPickerContact[]>;
    getProperties(): Promise<string[]>;
  }
  interface Navigator {
    contacts?: ContactsManager;
  }
}

const ShareTarget: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [hasContactPicker] = useState(() => 'contacts' in navigator && 'ContactsManager' in window);

  useEffect(() => {
    // Check for cached vCard from share target (Android PWA)
    loadSharedVCard();
  }, []);

  const loadSharedVCard = async () => {
    try {
      if ('caches' in window) {
        const cache = await caches.open('share-target');
        const response = await cache.match('/shared-vcf');

        if (response) {
          const text = await response.text();
          await cache.delete('/shared-vcf');
          const parsed = parseVCardFile(text);
          if (parsed.length > 0) {
            setContacts(parsed);
            setLoading(false);
            return;
          }
        }
      }
    } catch {
      // No cached data, that's fine — show the picker UI
    }
    setLoading(false);
  };

  const handleContactPicker = async () => {
    if (!navigator.contacts) return;

    try {
      const properties = await navigator.contacts.getProperties();
      const selected = await navigator.contacts.select(
        properties,
        { multiple: false }
      );

      if (selected.length === 0) return;

      const c = selected[0];
      const nameParts = (c.name?.[0] || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const parsed: ParsedContact = {
        first_name: firstName,
        last_name: lastName,
        email_work: c.email?.[0] || undefined,
        email_personal: c.email?.[1] || undefined,
        phone_mobile: c.tel?.[0] || undefined,
        phone_office: c.tel?.[1] || undefined,
        phone_home: c.tel?.[2] || undefined,
        address_line1: c.address?.[0]?.addressLine?.join(', ') || undefined,
        city: c.address?.[0]?.city || undefined,
        state: c.address?.[0]?.region || undefined,
        zip: c.address?.[0]?.postalCode || undefined,
        selected: true,
      };

      setContacts([parsed]);
    } catch {
      // User cancelled or API error — do nothing
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseVCardFile(text);
        if (parsed.length === 0) {
          setError('No contacts found in this file.');
          return;
        }
        setContacts(parsed);
      } catch {
        setError('Could not parse the contact file.');
      }
    };
    reader.readAsText(files[0]);
  };

  const handleSave = async (contact: ParsedContact) => {
    if (!user) return;

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('contacts')
      .insert({
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title || null,
        email_work: contact.email_work || null,
        email_personal: contact.email_personal || null,
        phone_mobile: contact.phone_mobile || null,
        phone_office: contact.phone_office || null,
        phone_home: contact.phone_home || null,
        address_line1: contact.address_line1 || null,
        address_line2: contact.address_line2 || null,
        city: contact.city || null,
        state: contact.state || null,
        zip: contact.zip || null,
        notes: contact.notes || null,
        is_donor: false,
        is_vip: false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      setError(`Failed to save: ${insertError.message}`);
      return;
    }

    setSaved(true);
    setSavedId(data?.id || null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Saved!</h2>
          <p className="text-gray-600 mb-6">Added to your CRM.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {savedId && (
              <button
                onClick={() => navigate(`/contacts/${savedId}`)}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                View Contact
              </button>
            )}
            <button
              onClick={() => {
                setSaved(false);
                setSavedId(null);
                setContacts([]);
              }}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Import Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No contacts loaded yet — show the picker UI
  if (contacts.length === 0) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-blue-600 rounded-xl p-6 sm:p-8 text-white shadow-sm">
          <h1 className="text-2xl font-bold flex items-center">
            <UserPlus className="w-7 h-7 mr-3" />
            Quick Import
          </h1>
          <p className="mt-2 text-blue-100">
            Add a contact from your phone to the CRM
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Contact Picker (Android Chrome) */}
          {hasContactPicker && (
            <button
              onClick={handleContactPicker}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:bg-blue-50 hover:border-blue-200 transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                <ContactRound className="w-7 h-7 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Choose from Contacts</p>
                <p className="text-sm text-gray-500">Pick a contact directly from your phone</p>
              </div>
            </button>
          )}

          {/* File picker (universal fallback) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 hover:bg-blue-50 hover:border-blue-200 transition-all group"
          >
            <div className="w-14 h-14 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileUp className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900">Import .vcf File</p>
              <p className="text-sm text-gray-500">Upload a vCard from Files</p>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.vcard,text/vcard,text/x-vcard"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {/* iOS instructions */}
          {!hasContactPicker && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-sm font-medium text-blue-900 mb-2">iPhone tip:</p>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Open <strong>Contacts</strong> on your iPhone</li>
                <li>Tap the contact, then tap <strong>Share Contact</strong></li>
                <li>Choose <strong>Save to Files</strong></li>
                <li>Come back here and tap <strong>Import .vcf File</strong></li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Contacts loaded — show review cards
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-blue-600 rounded-xl p-6 sm:p-8 text-white shadow-sm">
        <h1 className="text-2xl font-bold flex items-center">
          <UserPlus className="w-7 h-7 mr-3" />
          {contacts.length === 1 ? 'Review Contact' : `${contacts.length} Contacts`}
        </h1>
        <p className="mt-2 text-blue-100">
          Review and save to your CRM
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {contacts.map((contact, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h2>
              {contact.title && (
                <p className="text-gray-600 flex items-center mt-1">
                  <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.title}
                </p>
              )}
              {contact.org_name && (
                <p className="text-gray-600 flex items-center mt-1">
                  <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.org_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              {contact.email_work && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.email_work}
                  <span className="ml-2 text-xs text-gray-400">Work</span>
                </div>
              )}
              {contact.email_personal && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.email_personal}
                  <span className="ml-2 text-xs text-gray-400">Personal</span>
                </div>
              )}
              {contact.phone_mobile && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.phone_mobile}
                  <span className="ml-2 text-xs text-gray-400">Mobile</span>
                </div>
              )}
              {contact.phone_office && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.phone_office}
                  <span className="ml-2 text-xs text-gray-400">Office</span>
                </div>
              )}
              {contact.phone_home && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-4 h-4 mr-2 text-gray-400" />
                  {contact.phone_home}
                  <span className="ml-2 text-xs text-gray-400">Home</span>
                </div>
              )}
            </div>

            {(contact.address_line1 || contact.city) && (
              <div className="flex items-start text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-400" />
                <div>
                  {contact.address_line1 && <p>{contact.address_line1}</p>}
                  {contact.address_line2 && <p>{contact.address_line2}</p>}
                  {(contact.city || contact.state || contact.zip) && (
                    <p>
                      {[contact.city, contact.state].filter(Boolean).join(', ')}
                      {contact.zip && ` ${contact.zip}`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {contact.notes && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                {contact.notes}
              </p>
            )}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => handleSave(contact)}
              disabled={saving}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Save to CRM
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShareTarget;
