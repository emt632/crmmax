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

export type ModuleLevel = 'none' | 'view' | 'edit' | 'admin';

export interface ModuleAccess {
  crm: ModuleLevel;
  philanthropy: ModuleLevel;
  advoLink: ModuleLevel;
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

// ─── PhilanthropyMax Types ──────────────────────────────────────────────────

export type PhilEventType = 'golf_outing' | 'gala' | '5k' | 'auction' | 'walkathon' | 'other';
export type PhilEventStatus = 'planning' | 'open_registration' | 'sold_out' | 'in_progress' | 'completed' | 'cancelled';
export type PhilPaymentStatus = 'pending' | 'partial' | 'paid' | 'waived';
export type PhilRegistrationRole = 'golfer' | 'dinner_only' | 'volunteer' | 'vip' | 'speaker';
export type PhilDonationMethod = 'cash' | 'check' | 'credit_card' | 'ach' | 'other';
export type PhilInkindCategory = 'goods' | 'services' | 'experiences' | 'food_beverage' | 'printing' | 'venue' | 'other';
export type PhilContestType = 'longest_drive' | 'closest_to_pin' | 'hole_in_one' | 'putting' | 'other';

export interface PhilEvent {
  id: string;
  name: string;
  event_type: PhilEventType;
  status: PhilEventStatus;
  start_date: string | null;
  end_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  venue_state: string | null;
  venue_zip: string | null;
  budget_amount: number | null;
  goal_amount: number | null;
  capacity: number | null;
  description: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PhilSponsorTier {
  id: string;
  event_id: string;
  name: string;
  amount: number;
  sort_order: number;
  benefits: string[];
  max_sponsors: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PhilSponsor {
  id: string;
  event_id: string;
  organization_id: string | null;
  contact_id: string | null;
  tier_id: string | null;
  payment_status: PhilPaymentStatus;
  payment_amount: number;
  hole_assignment: string | null;
  logo_received: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  tier?: PhilSponsorTier;
  organization?: Organization;
  contact?: Contact;
}

export interface PhilRegistration {
  id: string;
  event_id: string;
  contact_id: string | null;
  organization_id: string | null;
  role: PhilRegistrationRole;
  registration_date: string;
  fee_amount: number;
  fee_paid: boolean;
  promo_code: string | null;
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  dietary_restrictions: string | null;
  shirt_size: string | null;
  is_sponsor: boolean;
  is_vip: boolean;
  checked_in: boolean;
  checked_in_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  organization?: Organization;
}

export interface PhilTeam {
  id: string;
  event_id: string;
  team_name: string;
  tee_time: string | null;
  starting_hole: number | null;
  cart_number: string | null;
  organization_id?: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  members?: PhilTeamMember[];
  organization?: Organization;
}

export interface PhilTeamMember {
  id: string;
  team_id: string;
  registration_id: string;
  position: number | null;
  created_by: string;
  created_at: string;
  // Joined
  registration?: PhilRegistration;
}

export interface PhilCashDonation {
  id: string;
  event_id: string;
  contact_id: string | null;
  organization_id: string | null;
  amount: number;
  donation_date: string;
  method: PhilDonationMethod;
  receipt_number: string | null;
  tax_deductible: boolean;
  acknowledgement_sent: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  organization?: Organization;
}

export interface PhilInkindDonation {
  id: string;
  event_id: string;
  contact_id: string | null;
  organization_id: string | null;
  item_description: string;
  category: PhilInkindCategory;
  fair_market_value: number;
  intended_use: string | null;
  quantity: number;
  acknowledgement_sent: boolean;
  receipt_issued: boolean;
  form_8283_required: boolean;
  form_8283_completed: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  organization?: Organization;
}

export interface PhilVolunteerRole {
  id: string;
  event_id: string;
  role_name: string;
  description: string | null;
  slots_needed: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  shifts?: PhilVolunteerShift[];
}

export interface PhilVolunteerShift {
  id: string;
  role_id: string;
  shift_label: string;
  start_time: string | null;
  end_time: string | null;
  slots_needed: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  role?: PhilVolunteerRole;
  assignments?: PhilVolunteerAssignment[];
}

export interface PhilVolunteerAssignment {
  id: string;
  shift_id: string | null;
  role_id?: string | null;
  contact_id: string;
  checked_in: boolean;
  checked_in_at: string | null;
  hours_logged: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: Contact;
  shift?: PhilVolunteerShift;
}

export interface PhilContest {
  id: string;
  event_id: string;
  contest_type: PhilContestType;
  hole_number: number | null;
  prize_description: string | null;
  prize_value: number | null;
  winner_registration_id: string | null;
  winning_result: string | null;
  sponsor_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined
  winner?: PhilRegistration;
  sponsor?: PhilSponsor;
}