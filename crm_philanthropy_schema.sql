
-- Contacts Table
CREATE TABLE contacts (
    id UUID PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email_personal TEXT,
    email_work TEXT,
    phone_mobile TEXT,
    phone_home TEXT,
    phone_office TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    is_donor BOOLEAN DEFAULT FALSE
);

-- Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    email TEXT,
    is_donor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Donations Table
CREATE TABLE donations (
    id UUID PRIMARY KEY,
    donor_contact_id UUID REFERENCES contacts(id),
    donor_organization_id UUID REFERENCES organizations(id),
    amount DECIMAL(10,2) NOT NULL,
    donation_type TEXT CHECK (donation_type IN ('one-time', 'recurring', 'in-kind', 'employee-giving')),
    donation_method TEXT,
    donation_date DATE NOT NULL,
    campaign_id UUID REFERENCES campaigns(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Contact Relationships Table
CREATE TABLE contact_relationships (
    id UUID PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id),
    related_contact_id UUID REFERENCES contacts(id),
    relationship_type TEXT,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization Relationships Table
CREATE TABLE organization_relationships (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id),
    related_organization_id UUID REFERENCES organizations(id),
    relationship_type TEXT,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
