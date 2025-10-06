# RWA Tokenization Platform

Real-World Asset (RWA) tokenization platform built on Stellar blockchain. Users pledge physical assets (real estate, art, commodities, vehicles, equipment) and receive PLAT tokens representing fractional ownership.

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **Blockchain**: Stellar Testnet (moving to mainnet)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Token**: PLAT (issued on Stellar)

### Core Components

**1. Pledge System**
- Users submit asset information (type, description, location, appraised value)
- Request tokens at 65-70% LTV (Loan-to-Value ratio)
- Pledge requests stored in database with 'pending' status
- Located: `src/app/pledge/page.tsx`

**2. Admin Approval & Minting**
- Admin reviews pending pledges
- Approval triggers Stellar blockchain transaction
- PLAT tokens minted and sent to user's wallet
- Transaction logged in database
- Located: `src/app/admin/page.tsx`

**3. Liquidity Pools**
- Users can create PLAT trading pairs (PLAT/XLM, PLAT/USDC)
- Uses Stellar's native AMM (Automated Market Maker)
- Multi-fee tier support (0.1%, 0.3%, 1.0%)
- Liquidity aggregator discovers existing pools
- Located: `src/app/liquidity/`

**4. User Dashboard**
- View PLAT balance
- See pledged assets
- Monitor transaction history
- Located: `src/app/dashboard/page.tsx`

**5. Marketplace** (Basic)
- Browse available tokenized assets
- View asset details and prices
- Located: `src/app/marketplace/page.tsx`

## Database Schema

### Key Tables
- `profiles` - User account data
- `pledge_requests` - Asset pledge submissions (pending/approved/rejected)
- `assets` - Tokenized assets and their metadata
- `transactions` - User transaction history
- `transaction_log` - Stellar blockchain transaction records
- `liquidity_pools` - Pool metadata and aggregator settings

## Stellar Integration

### Token (PLAT)
- Asset Code: `PLAT`
- Issuer: Configured via environment variable
- 1 PLAT = $1 USD (pegged to asset value)
- Minted only when pledges approved by admin

### Smart Features
- Trustline management
- Liquidity pool creation (constant product AMM)
- Multi-hop swap routing
- Price discovery via orderbooks and pools

## Setup Instructions

### Prerequisites
- Node.js 18+
- Stellar testnet account with funded XLM
- Supabase project

### Environment Variables
Create `.env.local`:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_STELLAR_ISSUER_PUBLIC=GAXVSETFOP...
NEXT_PUBLIC_STELLAR_ISSUER_SECRET=SABC123...
STELLAR_ISSUER_SECRET=SABC123...

### Installation
```bash
npm install
npm run dev
Database Setup

Run Supabase migrations (SQL files in /supabase/migrations/)
Create admin user manually in Supabase dashboard
Set is_admin = true for admin accounts

Current Status
✅ Completed Features

User authentication and registration
Asset pledge submission form
Admin panel for pledge approval
PLAT token minting on Stellar
Transaction logging and history
Basic dashboard with user positions
Liquidity pool creation UI
Liquidity aggregator discovery system
Multi-fee tier pool support

🚧 In Progress

Liquidity pool testing and deployment
Bootstrap liquidity from aggregated sources
Pool position management interface

❌ Not Yet Implemented

Asset verification workflow
KYC/AML integration
Professional appraisal upload system
Oracle price feeds for assets
Advanced marketplace (bidding, offers)
Cross-chain bridge
Governance/DAO structure
Mobile app
Real-world asset redemption process
OTC desk for PLAT redemption
Fiat on/off ramps

Known Issues
TypeScript

Some Supabase type inference issues resolved with // @ts-ignore comments
ESLint warnings for unused variables (non-breaking)

Stellar SDK

Updated to use LiquidityPoolAsset instead of deprecated LiquidityPoolParameters
Pool creation requires funded testnet account

Testing Requirements

Need real users to test pledge → approval → minting flow
Liquidity pools need initial bootstrap liquidity ($1,000+ recommended)
Marketplace has no listings yet (no approved pledges)

Security Considerations
Current Risks

Issuer secret key stored in environment variables (move to HSM/KMS for production)
Admin approval is centralized (no multi-sig yet)
No rate limiting on pledge submissions
Oracle price feeds not implemented (manual appraisal only)

Before Production

 Move secret keys to secure key management system
 Implement multi-signature admin approval
 Add rate limiting and DDoS protection
 Integrate price oracles (e.g., Chainlink, Band Protocol)
 Smart contract audits (if moving to EVM chain)
 Legal compliance review (securities regulations)
 Insurance for pledged assets

Roadmap
Phase 1: Core Functionality (Current)

Pledge submission ✅
Admin approval ✅
Token minting ✅
Basic liquidity pools 🚧

Phase 2: Liquidity & Trading (Next 30 days)

Bootstrap initial pools with $5K-$10K
Test swap functionality
Add liquidity position management
Implement OTC redemption desk

Phase 3: Scale & Compliance (60-90 days)

KYC/AML integration
Professional appraisal system
Asset verification workflow
Legal entity formation

Phase 4: Advanced Features (90+ days)

Governance token and DAO
Cross-chain bridges
Mobile application
Institutional partnerships

Contributing
This is a private project. Contact repository owner for collaboration inquiries.
File Structure
src/
├── app/
│   ├── admin/           # Admin pledge approval panel
│   ├── auth/            # Authentication pages
│   ├── dashboard/       # User dashboard
│   ├── liquidity/       # Pool creation and management
│   │   ├── create/      # Create new pools
│   │   ├── positions/   # User pool positions
│   │   └── add/         # Add liquidity to existing pools
│   ├── marketplace/     # Asset marketplace
│   └── pledge/          # Asset pledge submission
├── lib/
│   ├── auth/            # Auth context and utilities
│   ├── stellar/         # Stellar SDK integration
│   │   ├── liquidity.ts           # Core pool functions
│   │   └── liquidityAggregator.ts # Multi-source discovery
│   └── supabase/        # Supabase client
└── components/          # Reusable UI components
Testing Checklist
Before Deploying

 Test pledge submission end-to-end
 Verify admin can approve and mint tokens
 Confirm Stellar transactions appear on testnet
 Test liquidity pool creation with real XLM
 Verify aggregator discovers existing pools
 Test wallet integration (Freighter, Albedo)
 Check mobile responsiveness
 Load test with 100+ concurrent users

License
Proprietary - All Rights Reserved
Contact
For questions or support, contact the development team.

Last Updated: January 2025
Version: 0.1.0 (Alpha)
Network: Stellar Testnet

**Save and close.**

This README is honest about current state, doesn't oversell features, and clearly documents what works, what doesn't, and what needs to happen next.