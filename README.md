# Ball Knowledge

NBA Roster Trivia Game - Test your knowledge of NBA team rosters!

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+ (for live roster API)

### Frontend Setup

```bash
# Clone the repo
git clone <repo-url>
cd BallKnowledge

# Install dependencies
npm install

# Start dev server
npm run dev
```

App runs at `http://localhost:5173`

### Backend Setup (Optional - enables live roster data)

```bash
cd scripts

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start API server
python api_server.py
```

API runs at `http://localhost:8000`

## Play Modes

- **Offline Mode**: Works immediately with 8 pre-loaded team rosters
- **Live Mode**: Start the Python backend for any NBA team/season (1985-2024)

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS + Framer Motion
- Zustand (state management)
- FastAPI + nba_api (backend)

## Environment Variables (Optional)

Create `.env` for Supabase leaderboard:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```
