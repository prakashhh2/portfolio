// Project content, written from each project's own README. These strings become
// files under ~/projects/<id>/ in the virtual filesystem.

export type Project = {
  id: string
  title: string
  tagline: string
  repo: string | null
  demo: string | null
  tech: string[]
  readme: string
  architecture: string
}

export const projects: Project[] = [
  {
    id: 'relay4',
    title: 'Relay4',
    tagline: 'AI-assisted emergency voice intake and dispatcher console',
    repo: 'https://github.com/prakashhh2/Relay-4',
    demo: null,
    tech: ['React', 'Vite', 'FastAPI', 'SQLite', 'ElevenLabs voice agent', 'Cloudflare Tunnel'],
    readme: `# Relay4

1st place — GeauxHack 2026. Built by a team of four.

Relay4 is a Louisiana-focused emergency voice-intake and incident-coordination
MVP. It turns an AI voice conversation into a shared incident record that a
single dispatcher can review, correct, and assign from one workspace.

## Problem
One dispatcher juggling several incoming calls has to capture facts, spot
missing details, and coordinate responders at the same time.

## What it does
- Captures structured incident facts from an ElevenLabs voice conversation.
- Keeps caller evidence, conversation IDs, corrections, and event history.
- Shows incidents, severity suggestions, missing facts, locations, related
  reports, and responder availability.
- Lets the dispatcher explicitly assign a unit and record response events.
- Uses Louisiana landmarks, parish context, and geocoding to clarify location.

## Safety
Relay4 is a synthetic hackathon system. It does not contact 911, emergency
services, or real responders. The voice agent records facts; a human
dispatcher controls every assignment.
`,
    architecture: `# Relay4 architecture

Caller + ElevenLabs voice agent
        |
        | authenticated webhook tools
        v
FastAPI backend -- SQLite: records, evidence, history, assignments
        |
        | REST polling
        v
React/Vite dispatcher console
        |
        +-- human review, correction, assignment, response updates

Design rules
- The voice webhook can open and update an incident, but cannot assign a
  responder. The API returns dispatch_confirmed: false until a dispatcher acts.
- Intake/review status is kept separate from operational response status.
- A conversation is marked ended after 20 seconds without a new update.
- Straight-line distances are labelled as such; no road ETA is claimed.
`,
  },
  {
    id: 'solpos',
    title: 'SolPOS',
    tagline: 'Solana Pay point of sale for small merchants',
    repo: 'https://github.com/prakashhh2/solpos',
    demo: null,
    tech: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Solana Pay', 'Phantom wallet', 'Gemini AI'],
    readme: `# SolPOS

A mobile-first point-of-sale terminal that lets a merchant accept USDC through
Solana Pay: no card reader, no bank account, just a QR code and a wallet.

## Problem
Card processors charge about 2.9% + $0.30 per sale, which eats 15-33% of a
$1-$2.50 purchase. Solana network fees are a fraction of a cent.

## What it does
- Cashier enters an amount; a Solana Pay QR code appears for the customer.
- Cart builder with AI product lookup (Gemini).
- Checkout screen compares card fees against Solana Pay in real time.
- Optional automatic revenue split (owner / tip / tax).
- Transaction history with Solana Explorer links, CSV export, and refunds.
- One-click AI daily report: revenue narrative, top products, hourly chart.
- Devnet demo mode for showing the full flow without real funds.
`,
    architecture: `# SolPOS architecture

Next.js app (App Router)
  /dashboard          stats, transaction feed, cart
  /dashboard/charge   keypad -> Solana Pay QR
  /dashboard/history  history, filters, CSV export, refunds
  /dashboard/report   AI daily report
  /dashboard/account  USDC / SOL balances, withdraw

API routes (server side, keeps the Gemini key private)
  POST /api/daily-report    end-of-day analysis
  POST /api/lookup-product  product name lookup
  POST /api/analytics       sales analytics

Payment flow
  amount -> Solana Pay transfer request -> QR -> customer wallet signs
  -> POS watches for the transaction -> confirmed -> recorded in history
`,
  },
  {
    id: 'credence',
    title: 'Credence',
    tagline: 'Tamper-proof certificates on Solana and IPFS',
    repo: 'https://github.com/prakashhh2/Credence',
    demo: null,
    tech: ['React', 'Rust', 'Anchor', 'Solana (devnet)', 'IPFS via Pinata', 'Phantom wallet'],
    readme: `# Credence

A certificate issuance and verification platform. Universities issue
certificate records on Solana; anyone with the reference can verify them.

## Problem
Paper and PDF credentials are easy to fake and slow to verify by email.

## What it does
- Admin issuance: upload the certificate PDF to IPFS and write proof metadata
  (student, certificate data, IPFS CID) on-chain.
- Student portal: connect a wallet, view proofs, download the certificate.
- Verification page: employers enter a reference, the app reads the on-chain
  proof, matches the data, and resolves the file from IPFS.
`,
    architecture: `# Credence architecture

UI form -> Pinata (IPFS CID) -> Anchor RPC -> Solana account -> verify/read

Frontend (React)
  admin issuance, student portal, verification; Phantom wallet

Service layer (JS)
  IPFS service: upload/retrieve files through Pinata
  Anchor service: provider/program setup, send instructions

Blockchain (Rust, Anchor)
  program credence_cert on Solana devnet
  instruction create_certificate stores normalized fields + timestamp

Storage
  file content -> IPFS (Pinata)
  immutable proof metadata -> Solana account
`,
  },
]
