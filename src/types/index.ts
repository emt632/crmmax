export type UserRole =
  | 'admin'
  | 'Executive Leader'
  | 'Partner Engagement Manager'
  | 'Clinical Manager'
  | 'Base Lead'
  | 'Philanthropy'
  | 'Advocacy'
  | 'Maintenance'
  | 'Supervisor'
  | 'Marketing'
  | 'General';

export interface ModuleAccess {
  crm: boolean;
  philanthropy: boolean;
  advoLink: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  is_active: boolean;
  reports_to: string | null;
  last_login: string | null;
  module_access?: ModuleAccess;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role?: UserRole;
  permissions?: {
    modules: {
      crm: boolean;
      philanthropy: boolean;
      advoLink: boolean;
    };
    features: {
      rideAlongRubricUpload?: boolean;
      [key: string]: boolean | undefined;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  title?: string;
  notes?: string;
  photo_url?: string;

  // Email fields
  email_work?: string;
  email_personal?: string;
  
  // Phone fields
  phone_mobile?: string;
  phone_office?: string;
  phone_home?: string;
  
  // Address fields
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Status flags
  is_donor: boolean;
  is_vip: boolean;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type?: string;
  
  // Contact information
  phone?: string;
  email?: string;
  website?: string;
  
  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Donor flag
  is_donor: boolean;
  
  // Additional fields
  notes?: string;

  // CMS Hospital data
  cms_certification_number?: string;
  hospital_type?: string;
  hospital_ownership?: string;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactOrganization {
  id: string;
  contact_id: string;
  organization_id: string;
  role?: string;
  department?: string;
  is_primary: boolean;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  goal_amount?: number;
  start_date?: string;
  end_date?: string;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  donor_contact_id?: string;
  donor_organization_id?: string;
  amount: number;
  donation_type: 'one-time' | 'recurring' | 'in-kind' | 'employee-giving';
  donation_method?: 'cash' | 'check' | 'credit-card' | 'ach' | 'wire' | 'stock' | 'crypto' | 'other';
  donation_date: string;
  campaign_id?: string;
  receipt_number?: string;
  tax_deductible: boolean;
  acknowledgement_sent: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  contact_id?: string;
  organization_id?: string;
  activity_type: 'call' | 'email' | 'meeting' | 'event' | 'note' | 'task' | 'other';
  activity_date: string;
  subject: string;
  description?: string;
  outcome?: string;
  follow_up_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Pledge {
  id: string;
  donor_contact_id?: string;
  donor_organization_id?: string;
  campaign_id?: string;
  amount: number;
  frequency?: 'one-time' | 'monthly' | 'quarterly' | 'annually';
  start_date: string;
  end_date?: string;
  status: 'active' | 'fulfilled' | 'cancelled' | 'defaulted';
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Grant {
  id: string;
  organization_id?: string;
  name: string;
  amount_requested?: number;
  amount_awarded?: number;
  application_date?: string;
  decision_date?: string;
  status: 'researching' | 'writing' | 'submitted' | 'awarded' | 'declined' | 'withdrawn';
  reporting_requirements?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  event_type?: string;
  start_datetime: string;
  end_datetime?: string;
  location?: string;
  capacity?: number;
  registration_required: boolean;
  is_fundraising: boolean;
  campaign_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventAttendee {
  id: string;
  event_id: string;
  contact_id?: string;
  organization_id?: string;
  registration_status: 'registered' | 'attended' | 'no-show' | 'cancelled';
  registration_date?: string;
  attendance_confirmed: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VolunteerHours {
  id: string;
  contact_id: string;
  date: string;
  hours: number;
  activity_type?: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactRelationship {
  id: string;
  contact_id: string;
  related_contact_id: string;
  relationship_type: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRelationship {
  id: string;
  organization_id: string;
  related_organization_id: string;
  relationship_type: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactType {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContactTypeAssignment {
  id: string;
  contact_type_id: string;
  entity_type: 'contact' | 'organization';
  entity_id: string;
  created_by: string;
  created_at: string;
  contact_type?: ContactType;
}

export type TouchpointType = 'phone' | 'email' | 'in-person' | 'virtual' | 'other';

export interface Touchpoint {
  id: string;
  type: TouchpointType;
  date: string;
  duration?: number;
  subject: string;
  notes?: string;
  follow_up_required: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_completed: boolean;
  assigned_to?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined arrays from junction tables
  contacts?: { id: string; first_name: string; last_name: string }[];
  organizations?: { id: string; name: string }[];
  // Display fields (built from joined arrays)
  contact_names?: string;
  organization_names?: string;
  // Display fields for assignment
  assigned_to_name?: string;
  created_by_name?: string;
}

export interface TouchpointContact {
  touchpoint_id: string;
  contact_id: string;
  created_by: string;
  created_at: string;
}

export interface TouchpointOrganization {
  touchpoint_id: string;
  organization_id: string;
  created_by: string;
  created_at: string;
}

export interface RideAlong {
  id: string;
  participantName: string;
  contactId?: string;
  organizationId?: string;
  organizationName?: string;
  
  date: string;
  baseLocation: string;
  
  attendance: 'present' | 'absent' | 'partial';
  numberOfFlights: number;
  eligibleForFuture: boolean;
  potentialHiringStatus: 'interested' | 'not-interested' | 'maybe' | 'not-applicable';
  
  rubricFileUrl?: string;
  rubricUploadedBy?: string;
  rubricUploadedAt?: string;
  
  notes?: string;
  
  loggedBy: string;
  loggedByName: string;
  loggedAt: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface PRRequest {
  id: string;
  eventName: string;
  organizationId?: string;
  organizationName?: string;
  contactId?: string;
  contactName?: string;
  
  location: {
    venue: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    lzCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  eventDate: string;
  startTime: string;
  endTime: string;
  expectedHours: number;
  
  aircraftRequested: boolean;
  aircraftType?: string;
  
  status: 'pending' | 'approved' | 'declined' | 'completed' | 'cancelled';
  fulfillmentStatus: 'unfulfilled' | 'partially-fulfilled' | 'fulfilled';
  
  description: string;
  specialRequirements?: string;
  
  loggedBy: string;
  loggedByName: string;
  loggedAt: string;
  
  approvedBy?: string;
  approvedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface SmartCaptureResult {
  contactData: Partial<Contact>;
  organizationId?: string;
  organizationRole?: string;
  savedContactId?: string;
}

// ─── AdvoLink Types ──────────────────────────────────────────

export type BillStatus =
  | 'introduced'
  | 'in_committee'
  | 'passed_house'
  | 'passed_senate'
  | 'enrolled'
  | 'signed'
  | 'vetoed'
  | 'failed';

export interface BillCommittee {
  committee_id?: number;
  name: string;
  chamber?: string;
}

export interface BillCosponsor {
  people_id?: number;
  name: string;
  party?: string;
  state?: string;
  district?: string;
}

export interface BillGroup {
  id: string;
  label: string;
  created_by: string;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  title: string;
  description?: string;
  status: BillStatus;
  jurisdiction: string;
  session_id?: number;
  author?: string;
  committees: BillCommittee[];
  cosponsors: BillCosponsor[];
  bill_group_id?: string;
  legiscan_bill_id?: number;
  legiscan_raw?: any;
  is_priority: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  bill_group?: BillGroup;
  companion_bills?: Bill[];
}

export type GAEngagementType =
  | 'lobby_team'
  | 'ga_committee'
  | 'legislator_office'
  | 'committee_meeting'
  | 'federal_state_entity';

export interface GAEngagement {
  id: string;
  type: GAEngagementType;
  date: string;
  duration?: number;
  subject: string;
  notes?: string;
  topics_covered?: string;
  jurisdiction?: string;
  // Legislator fields
  legislator_people_id?: number;
  legislator_name?: string;
  meeting_level?: 'member' | 'staff';
  // Association fields
  association_name?: string;
  // Entity fields
  entity_name?: string;
  initiative?: string;
  committee_office_id?: string;
  meeting_location?: string;
  meeting_location_detail?: string;
  guests?: { name: string; organization: string }[];
  // Committee context
  committee_of_jurisdiction?: string;
  committee_role?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Follow-up fields
  follow_up_required?: boolean;
  follow_up_date?: string;
  follow_up_notes?: string;
  follow_up_completed?: boolean;
  follow_up_assigned_to?: string;
  // Joined
  bills?: { id: string; bill_number: string; title: string }[];
  staff?: { id: string; full_name: string | null; email: string }[];
  contacts?: { id: string; first_name: string; last_name: string }[];
  attachments?: GAEngagementAttachment[];
}

export interface GAEngagementAttachment {
  id: string;
  engagement_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  public_url: string;
  uploaded_by: string;
  created_at: string;
}

export interface LegiscanLegislator {
  people_id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  party?: string;
  state?: string;
  chamber?: string;
  district?: string;
  committee_ids?: number[];
  fetched_at?: string;
}

export interface LegiscanSession {
  session_id: number;
  jurisdiction: string;
  name: string;
  year_start?: number;
  year_end?: number;
  fetched_at?: string;
}

export interface LegislativeOffice {
  id: string;
  office_type: 'legislator' | 'committee';
  name: string;
  state?: string;
  chamber?: string;
  district?: string;
  legislator_people_id?: number;
  address?: string;
  city?: string;
  office_state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface LegislativeOfficeStaff {
  id: string;
  office_id: string;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Engagement Mention Types ────────────────────────────

export type MentionType = 'legislator' | 'leg_staff' | 'contact' | 'user' | 'committee';

export interface GAEngagementMention {
  id: string;
  engagement_id: string;
  mention_type: MentionType;
  legislator_people_id?: number;
  leg_staff_id?: string;
  contact_id?: string;
  user_id?: string;
  committee_office_id?: string;
  created_by: string;
  created_at: string;
}

// ─── Support Campaign Types ─────────────────────────────

export type SupportAskTargetType =
  | 'legislator'
  | 'contact'
  | 'organization'
  | 'leg_staff'
  | 'other';

export type SupportAskOutreachMethod =
  | 'virtual'
  | 'in_person'
  | 'email'
  | 'phone'
  | 'letter'
  | 'other';

export type SupportTypeRequested =
  | 'letter_of_support'
  | 'testimonial'
  | 'reach_out_on_behalf'
  | 'sign_on_letter'
  | 'public_statement'
  | 'event_attendance'
  | 'funding_commitment'
  | 'other';

export type SupportStatus =
  | 'pending'
  | 'follow_up_needed'
  | 'committed'
  | 'received'
  | 'declined';

export type ThankYouMethod =
  | 'letter'
  | 'email'
  | 'phone'
  | 'in_person'
  | 'other';

export interface SupportAsk {
  id: string;
  requester_id: string;

  target_type: SupportAskTargetType;
  target_legislator_people_id?: number;
  target_contact_id?: string;
  target_organization_id?: string;
  target_leg_staff_id?: string;
  target_name?: string;

  ask_date: string;
  outreach_method: SupportAskOutreachMethod;
  initiative?: string;
  support_type_requested: SupportTypeRequested;
  ask_notes?: string;
  engagement_id?: string;

  support_status: SupportStatus;
  follow_up_date?: string;
  follow_up_notes?: string;
  support_type_provided?: string;
  support_received_date?: string;

  thank_you_sent: boolean;
  thank_you_date?: string;
  thank_you_method?: ThankYouMethod;
  invited_to_event: boolean;
  event_invitation_details?: string;
  stewardship_notes?: string;

  created_by: string;
  created_at: string;
  updated_at: string;

  // Enriched display fields
  requester_name?: string;
  target_display_name?: string;
  target_contact_display_name?: string;
  bills?: { id: string; bill_number: string; title: string }[];
}