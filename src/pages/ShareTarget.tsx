import React, { useState, useEffect } from 'react';
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
  AlertCircle,
} from 'lucide-react';
import { parseVCardFile } from '../lib/vcard-parser';
import type { ParsedContact } from '../lib/vcard-parser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ShareTarget: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    loadSharedVCard();
  }, []);

  const loadSharedVCard = async () => {
    try {
      const cache = await caches.open('share-target');
      const response = await cache.match('/shared-vcf');

      if (!response) {
        setError('No shared contact found. Try sharing a contact again.');
        setLoading(false);
        return;
      }

      const text = await response.text();
      // Clear the cache entry
      await cache.delete('/shared-vcf');

      const parsed = parseVCardFile(text);
      if (parsed.length === 0) {
        setError('Could not parse the shared contact. Make sure you shared a valid vCard file.');
        setLoading(false);
        return;
      }

      setContacts(parsed);
    } catch {
      setError('Failed to read shared contact data.');
    }
    setLoading(false);
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
      setError(`Failed to save contact: ${insertError.message}`);
      return;
    }

    setSaved(true);
    setSavedId(data?.id || null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-600">Loading shared contact...</p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Saved!</h2>
          <p className="text-gray-600 mb-6">The contact has been added to your CRM.</p>
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
              onClick={() => navigate('/contacts')}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              All Contacts
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && contacts.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Contact Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/contacts')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Contacts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <h1 className="text-2xl font-bold flex items-center">
          <UserPlus className="w-7 h-7 mr-3" />
          Shared Contact{contacts.length > 1 ? 's' : ''}
        </h1>
        <p className="mt-2 text-blue-100">
          {contacts.length === 1
            ? 'Review and save this contact to your CRM'
            : `${contacts.length} contacts shared — tap to save`}
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
          className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
        >
          <div className="p-6 space-y-4">
            {/* Name */}
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

            {/* Contact Info */}
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

            {/* Address */}
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

            {/* Notes */}
            {contact.notes && (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                {contact.notes}
              </p>
            )}
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => handleSave(contact)}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center"
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
