# VisionMe 

> *Building sustainable saving habits through emotional connection and blockchain technology*

[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-black?style=flat&logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-purple?style=flat)](https://soroban.stellar.org)
[![USDC](https://img.shields.io/badge/Stablecoin-USDC-blue?style=flat)](https://www.circle.com/usdc)

##  Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [Why Stellar?](#why-stellar)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Smart Contracts](#smart-contracts)
- [Team](#team)

##  Overview

FutureMe is an emotional savings application: a habit-building platform guided by an avatar representing the user’s Future Self, built on the Stellar network, with Soroban smart contracts that automate micro-savings in a secure, transparent, and efficient way.

### Target User: Lucia's Story

**Lucia, 29** — Freelance Designer from Argentina
- **Monthly Income**: USD 800–1,500 (variable)
- **Challenge**: Emotional relationship with money (guilt, anxiety, avoidance)
- **Pattern**: Motivation → Effort → Distraction → Guilt → Giving up
- **Dreams**: Travel to Brazil, buy better equipment, create an emergency fund

**VisionMe transforms her story from cycles of guilt to sustainable progress.**

##  The Problem

### Critical Statistics
- **70%+** of LATAM population cannot maintain monthly savings habits
- Most abandon savings plans within **90 days**
- Millions lack emergency funds, vulnerable to economic shocks

### Root Causes
This isn't about willpower—it's behavioral:
- Human minds are biased toward the present
- Financial management creates mental overload
- Traditional tools fail to address emotional barriers
- High fees prevent meaningful micro-savings

### Who's Affected?
- Informal workers and freelancers with variable income
- Families without access to financial security mechanisms
- Anyone seeking financial inclusion in LATAM

##  Our Solution

VisionMe creates a **simple, emotionally secure, and sustainable savings system** that doesn't depend on constant discipline or high motivation.

### Core Innovation: The Future Self Avatar

Your Future Self acts as a personal financial mentor:
-  **Tracks progress** toward your goals
-  **Celebrates milestones** and maintains motivation
-  **Provides education** through contextual insights
-  **Offers encouragement** during the journey

### User Journey

```
1. Create Future Self Avatar
   ↓
2. Set Financial Goal (emergency fund, travel, education)
   ↓
3. Schedule Automated Micro-Savings 
   ↓
4. Avatar Guides & Celebrates Progress
   ↓
5. Achieve Goal with Transparent On-Chain Tracking
```

##  Why Stellar?

Stellar makes VisionMe possible by solving critical technical barriers:

| Challenge | Stellar Solution |
|-----------|------------------|
| **High fees eating micro-savings** | Near-zero transaction costs |
| **Slow confirmations** | 3-5 second finality |
| **Price volatility** | USDC stablecoin integration |
| **Complex onboarding** | Social Wallet (Web2 login) |
| **Lack of transparency** | Horizon API for real-time tracking |
| **Smart contract needs** | Soroban for automated savings logic |

### Stellar Ecosystem Components

- **Stellar Network**: Fast, low-cost transactions
- **Soroban Smart Contracts**: On-chain Vision Pockets
- **Freighter Wallet**: User-controlled transaction signing
- **Horizon API**: Real-time operation status
- **SBTs**: Non-transferable achievement tokens
- **Social Wallet SDK**: Frictionless Web2 authentication

## 🎨 Core Features

### 1. Web2 Authentication with Stellar Social Wallet
- **Google login** with automatic Stellar account creation
- Frictionless entry into Stellar ecosystem
- No crypto knowledge required

### 2. Future Self Avatar — Habit Motivation Engine
- Visual representation of user's future self
- Progress tracking and streak visualization
- Emotional layer driving savings behavior
- Personalized encouragement system

### 3. PocketContract (Soroban Smart Contracts)
- Create savings pockets for specific goals
- Make contributions of any size 
- Query pocket state on-chain
- Transparent, immutable savings structure

### 4. Streak System + Financial Identity SBT
- **Off-chain**: Backend tracks contributions and calculates streaks
- **On-chain**: SBT minting when key milestones are achieved
- Non-transferable "VisionMe Financial Identity" token
- Gamification meets verifiable achievement

### 5. End-to-End Demo (Testnet)
Complete workflow demonstration:
```
Web2 Login → Avatar Activation → Create Pocket → 
Contribute → Streak Increases → Avatar Celebrates → SBT Earned
```

##  Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      Frontend (React/Next.js)                    │
│  • Crossmint Social Wallet UI                                    │
│  • Avatar visualization                                          │
│  • Pocket CRUD, Deposit flow                                     │
│  • Streak & SBT display                                          │
│                                                                  │
│  TOKENS USED BY FRONTEND:                                        │
│  • JWT (VisionMe) - stored in localStorage, used for API calls   │
│  • Crossmint Token - from SDK, used for transaction signing      │
└────────────────┬─────────────────────────────────┬───────────────┘
                 │                                 │
        ┌────────▼──────────┐           ┌─────────▼──────────┐
        │  Crossmint SDK    │           │  Backend API       │
        │  (Social Wallet)  │           │  (Express/Next.js) │
        │                   │           │                    │
        │ • Auth (OAuth)    │           │ • Auth endpoint    │
        │ • Stellar acct    │           │   (JWT issue)      │
        │ • Transaction     │           │ • Pocket CRU D     │
        │   signing         │           │ • Deposit-swap     │
        │ • Token export    │           │ • Streaks          │
        └────────┬──────────┘           │ • SBT check        │
                 │                      └─────────┬──────────┘
                 │                                │
        ┌────────▼────────────────────────────────▼──────────┐
        │            Stellar Testnet (Soroban RPC)           │
        │                                                    │
        │  ┌──────────────────────────────────────────────┐  │
        │  │     PocketContract (Habit Tracker)           │  │
        │  │     - Requires require_auth(owner)           │  │
        │  │     - Does NOT hold token balances           │  │
        │  │     - Only tracks progress counter           │  │
        │  │                                              │  │
        │  │ Functions (all require user signature):      │  │
        │  │ • create_pocket(owner, asset, goal)          │  │
        │  │ • deposit(pocket_id, from, amount)           │  │
        │  │ • withdraw(pocket_id, to, amount)            │  │
        │  │ • get_pocket(pocket_id)                      │  │
        │  └──────────────────────────────────────────────┘  │
        │                                                    │
        │  ┌──────────────────────────────────────────────┐  │
        │  │     SBTContract (Achievement Token)          │  │
        │  │     - Requires require_auth(admin)           │  │
        │  │     - Issues non-transferable SBTs           │  │
        │  │                                              │  │
        │  │ Functions:                                   │  │
        │  │ • mint(to, metadata) - admin only            │  │
        │  │ • has_sbt(owner)                             │  │
        │  │ • update_admin(new_admin) - admin only       │  │
        │  └──────────────────────────────────────────────┘  │
        │                                                    │
        │  Soroswap Router (liquidity for swaps)             │
        │  Horizon API (read-only Stellar state)             │
        └────────────────────────────────────────────────────┘
                 │
        ┌────────▼──────────────┐
        │  Supabase PostgreSQL  │
        │                       │
        │ • users               │
        │ • pockets             │
        │ • deposits            │
        │ • streaks             │
        │ • sbt_status          │
        └───────────────────────┘
```

### Folder Structure

```
apps/web/
├── app/
│   ├── layout.tsx              
│   ├── page.tsx                
│   ├── auth/
│   │   └── callback.tsx        
│   ├── dashboard/
│   │   ├── page.tsx            
│   │   ├── pockets/
│   │   │   ├── page.tsx        
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx    
│   │   │   │   └── deposit.tsx 
│   │   │   └── create.tsx      
│   │   ├── streaks/
│   │   │   └── page.tsx        
│   │   └── avatar/
│   │       └── page.tsx        
│   └── api/
│       ├── auth/
│       │   ├── callback.ts     
│       │   └── user.ts         
│       ├── pockets/
│       │   ├── route.ts        
│       │   ├── [id]/
│       │   │   ├── route.ts    
│       │   │   └── deposit.ts  
│       │   └── create.ts       
│       ├── avatar/
│       │   └── route.ts        
│       └── streaks/
│           └── route.ts        
│
├── hooks/
│   ├── useCrossmintAuth.ts     
│   ├── usePockets.ts           
│   ├── useDeposit.ts           
│   ├── useStreaks.ts           
│   └── useStellarBalance.ts    
│
├── contexts/
│   ├── AuthContext.tsx         
│   ├── PocketsContext.tsx      
│   └── StreamsContext.tsx      
│
├── components/
│   ├── Navbar.tsx              
│   ├── WalletDisplay.tsx       
│   ├── PocketCard.tsx          
│   ├── DepositForm.tsx         
│   ├── StreakBar.tsx           
│   ├── AvatarPreview.tsx       
│   ├── LoadingSpinner.tsx      
│   └── ErrorBoundary.tsx       
│
├── lib/
│   ├── config.ts               
│   ├── crossmint.ts            
│   ├── soroban.ts              
│   └── types.ts                
│
├── styles/
│   └── globals.css             
│
└── package.json

```

apps/backend/
├── src/
│   ├── main.ts                    
│   ├── config/
│   │   ├── env.ts                
│   │   ├── stellar.ts             
│   │   └── database.ts           
│   │
│   ├── routes/
│   │   ├── auth.ts                
│   │   ├── pockets.ts             
│   │   ├── deposits.ts            
│   │   ├── streaks.ts             
│   │   └── sbt.ts                 
│   │
│   ├── services/
│   │   ├── authService.ts         
│   │   ├── pocketService.ts       
│   │   ├── sbtService.ts          
│   │   ├── depositService.ts      
│   │   ├── soroswapService.ts     
│   │   ├── streakService.ts       
│   │   └── horizonService.ts      
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.ts      
│   │   ├── errorHandler.ts        
│   │   └── logging.ts             
│   │
│   ├── jobs/
│   │   ├── calculateStreaks.ts    
│   │   └── mintSBTs.ts            
│   │
│   └── types/
│       ├── auth.ts
│       ├── pocket.ts
│       ├── deposit.ts
│       ├── streak.ts
│       └── sbt.ts
│
├── migrations/
│   ├── 001_init_schema.sql
│   ├── 002_add_streaks_table.sql
│   └── 003_add_sbt_status.sql
│
├── prisma/
│   └── schema.prisma              
│
├── .env.example
├── package.json
└── tsconfig.json
```

### Component Responsibilities

#### Frontend (React + Next.js)
- **Framework**: Next.js 16 (React 19)
- **Styling**: CSS
- **Wallet Integration**: Crossmint Social Wallet SDK
- **Blockchain SDK**: @stellar/stellar-sdk
- **State Management**: React Context + hooks
- **HTTP Client**: fetch API



#### Backend (Next.js API + Supabase)
- Map Web2 identity ↔ Stellar publicKey
- Record pocket contributions
- Calculate streaks and eligibility
- Trigger SBT minting events
- Serve real-time data to frontend

#### Smart Contracts (Soroban)
Two independent contracts on Stellar testnet:

1. **PocketContract**
   - Create savings pockets
   - Process deposits
   - Query pocket state

2. **SBTContract**
   - Mint VisionMe Financial Identity SBT
   - Non-transferable achievement tokens
   - Triggered by backend when criteria met

#### Data Storage
- **Supabase Postgres**: User data, mappings, streaks, SBT status
- **On-chain (Soroban)**: Canonical pocket state and SBT ownership
- **Social Wallet**: Account abstraction and key custody

## Technology Stack

### Frontend
- React.js
- Next.js
- Stellar Social Wallet SDK
- Soroban Contract Clients

### Backend
- Next.js API Routes
- Supabase (Backend-as-a-Service)
- PostgreSQL

### Blockchain
- Stellar Network (Testnet)
- Soroban Smart Contracts
- Freighter Wallet
- Horizon API

### DevOps & Tools
- Git & GitHub
- Vercel (deployment)
- Stellar CLI
- Soroban CLI

## 👥 Team

| Name                | Role                     | LinkedIn                                                |
|---------------------|---------------------------|----------------------------------------------------------|
| **Natalia Loreto**  | Product Manager           | [Profile](https://www.linkedin.com/in/soylaloreto/)     |
| **Fabiana Fernández** | Backend Developer        | [Profile](https://www.linkedin.com/in/fabiana-fernandez/) |
| **Julieta Heit**    | Smart Contract Developer  | [Profile](https://www.linkedin.com/in/julieta-heit/)     |
| **Verónica Rebolleda** | Frontend Developer     | [Profile](https://www.linkedin.com/in/m-veronica-rebolleda/) |
| **Sol Gayarin**     | Designer                  | [Profile](https://www.linkedin.com/in/sol-gayarin/)      |


## License

MIT License - see [LICENSE](LICENSE) file for details

---

<p align="center">
  <strong>Built with ❤️‍🔥 for Stellar Hack+ 2025</strong>
  <br>
  <em>Transforming financial habits, one micro-saving at a time</em>
</p>
