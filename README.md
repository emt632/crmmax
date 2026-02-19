# Life Link III CRM

A modern, mobile-friendly CRM system for Life Link III built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

### CRM Module (Active)
- **Contacts Management**: Full CRUD operations with support for multiple emails, phones, and addresses per contact
- **Organization Management**: Track service-using and non-using organizations
- **Touchpoint Tracking**: Log all interactions (phone, email, in-person, virtual)
- **Ride-Along Management**: Track attendance, flights, eligibility, and hiring interest
- **PR Request Management**: Handle event requests with location and aircraft details
- **User Tracking**: All records track who logged them and when (per build rules)

### Philanthropy Module (Coming Soon)
- Donor Management
- Campaign Tracking
- Grant Management

### ADVO-LINK Module (Future)
- Advocacy Campaigns
- Bill Tracking
- Lawmaker Contacts

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Hosting**: Vercel (recommended)
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Git

## Setup Instructions

### 1. Clone and Install

```bash
# Clone the repository
git clone [your-repo-url]
cd lifelink3-crm

# Install dependencies
npm install
```

### 2. Configure Supabase

1. Create a new Supabase project at [https://supabase.com](https://supabase.com)

2. Run the database schema:
   - Go to the SQL Editor in your Supabase dashboard
   - Copy the contents of `supabase/schema.sql`
   - Run the SQL to create all tables and policies

3. Configure environment variables:
   ```bash
   # Copy the example env file
   cp .env.example .env
   
   # Edit .env with your Supabase credentials
   # Find these in your Supabase project settings > API
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### 3. Run the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Contacts/       # Contact-related components
│   └── Layout/         # Layout components (Sidebar, etc.)
├── lib/                # Utilities and configurations
│   └── supabase.ts     # Supabase client configuration
├── pages/              # Page components
│   └── Dashboard.tsx   # Main dashboard
├── types/              # TypeScript type definitions
└── App.tsx            # Main app component with routing
```

## Database Schema

The database follows these key principles from the build rules:

- **Contacts** support multiple emails, phones, and addresses
- **Organizations** can be flagged as service-using or non-using
- **All records** track who logged them and when
- **Touchpoints** track interaction type and follow-ups
- **Ride-alongs** track attendance, flights, and hiring potential
- **PR Requests** track event details and fulfillment status

## User Roles and Permissions

The system supports the following roles (as defined in build rules):
- Executive Leader
- Partner Engagement Manager
- Clinical Manager
- Base Lead
- Philanthropy
- Advocacy
- Maintenance
- Supervisor
- Marketing
- General

Permissions are managed at both module and feature levels.

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

### Manual Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Development Guidelines

1. **Follow the build rules**: Always reference `claude_build_rules.md` for requirements
2. **Mobile-first**: Ensure all components are responsive
3. **Modular design**: Keep CRM, Philanthropy, and ADVO-LINK loosely coupled
4. **Track everything**: Log who created/modified records and when
5. **Test with sample data**: The app includes sample data when Supabase isn't configured

## Troubleshooting

### Database not configured warning
The app will show sample data if Supabase is not configured. This is normal for initial development.

### Authentication issues
Ensure your Supabase anon key has the correct permissions and RLS policies are properly configured.

### Build errors
Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Contributing

1. Create a feature branch
2. Make your changes following the build rules
3. Test thoroughly on mobile and desktop
4. Submit a pull request

## License

Private - Life Link III

## Support

For support, please contact the Life Link III development team.