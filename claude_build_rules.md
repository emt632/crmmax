# Claude Code Build Rules – Life Link III CRM & Philanthropy Platform

**Project:** Life Link III – CRM, Philanthropy, and (eventually) Advocacy (ADVO-LINK) Platform  
**Last Updated:** 2025-08-06  
**Tech Stack:** Supabase (DB/Auth), Vercel (Frontend), Claude Code (build assistant), React (frontend), Tailwind (styling), optional Zapier/Make integrations.

---

## 🚦 Primary Modules

1. **CRM Module**
2. **Philanthropy Module**
3. **Upcoming:** ADVO-LINK (Advocacy Module)

---

## 🧠 Rules & Development Principles

### 🔁 Database Rules
- Every new form field must be **mirrored in Supabase schema**
- Every contact must support:
  - Multiple address lines
  - Personal & work email
  - Mobile, office, and home numbers
  - A "Logged By" and "Logged At" timestamp
- Contacts can belong to **multiple organizations** and organization types
- Organizations can be flagged as **service-using** or **non-using (e.g. vendors)**
- Touchpoints must track: who logged it, when, and type (phone, in-person, etc.)

### 🔐 Permissions Rules
- Roles defined in Supabase and referenced in the app UI:
  - Executive Leader, Partner Engagement Manager, Clinical Manager, Base Lead, Philanthropy, Advocacy, Maintenance, Supervisor, Marketing, General
- Admins can edit roles and use **checkbox-based permission management**
- Permissions cover:
  - Module access (CRM, Philanthropy, ADVO-LINK)
  - Field-level access (e.g. ride-along rubric upload)

### 📋 PR Event & Ride-Along Rules
- Ride-alongs must track:
  - Attendance, number of flights, eligibility for future, potential hiring status
  - Rubric upload (optional)
- PR requests must track:
  - Location, expected aircraft presence, LZ coordinates, hours, and status
  - Fulfillment status linked to orgs
- Embedded **Supabase-connected public form** will replace current Wix form

### 📊 Reporting Rules
- Power BI dashboards will eventually embed/visualize:
  - YTD call volume, transports, missed transports
- PR activity visualized by location and frequency
- Donor conversions tracked against campaign targets
- Grant renewal alerts based on previous cycle

### 📁 Documentation & Guidance
- Claude Code should always reference this file before major operations
- Use modular design: CRM, Philanthropy, and ADVO-LINK should be loosely coupled but connected by shared schema (e.g. `contacts`, `organizations`)

---

## 🔜 ADVO-LINK Planning (Placeholder)

- Advocacy campaigns
- Bill tracking + lawmaker contacts
- Action logs tied to contacts and legislation
