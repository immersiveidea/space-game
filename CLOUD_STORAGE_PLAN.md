# Cloud Leaderboard Implementation Plan

## Overview

Implement a global cloud-based leaderboard using **Supabase** with existing **Auth0** authentication. No backend server required - uses direct client-to-database communication with Row Level Security.

## Architecture

```
┌─────────────┐     ┌─────────┐     ┌───────────┐
│  Browser    │────▶│  Auth0  │────▶│ JWT Token │
│  (Game)     │     └─────────┘     └─────┬─────┘
│             │                           │
│  Supabase   │◀──────────────────────────┘
│  JS Client  │
│             │     ┌───────────────────────────┐
│             │────▶│  Supabase (Postgres + RLS)│
└─────────────┘     │  - leaderboard table      │
                    │  - Row Level Security     │
                    └───────────────────────────┘
```

## Implementation Steps

### Phase 1: Supabase Project Setup (Manual - Dashboard)

1. Create free Supabase project at https://supabase.com
2. Get project credentials:
   - `SUPABASE_URL` (e.g., `https://xxx.supabase.co`)
   - `SUPABASE_ANON_KEY` (public, safe for client)
3. Configure Third-Party Auth for Auth0:
   - Navigate to Authentication → Third-Party Auth
   - Add Auth0 integration with your tenant ID
4. Create `leaderboard` table:

```sql
CREATE TABLE leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,              -- Auth0 sub claim
  player_name TEXT NOT NULL,
  level_id TEXT NOT NULL,
  level_name TEXT NOT NULL,
  completed BOOLEAN NOT NULL,
  end_reason TEXT NOT NULL,           -- 'victory' | 'death' | 'stranded'

  -- Stats
  game_time_seconds NUMERIC NOT NULL,
  asteroids_destroyed INTEGER NOT NULL,
  total_asteroids INTEGER NOT NULL,
  accuracy NUMERIC NOT NULL,
  hull_damage_taken NUMERIC NOT NULL,
  fuel_consumed NUMERIC NOT NULL,

  -- Scoring
  final_score INTEGER NOT NULL,
  star_rating INTEGER NOT NULL,       -- 0-12

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for leaderboard queries
CREATE INDEX idx_leaderboard_score ON leaderboard(final_score DESC);
CREATE INDEX idx_leaderboard_user ON leaderboard(user_id);
```

5. Enable Row Level Security:

```sql
-- Enable RLS
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read leaderboard (global leaderboard)
CREATE POLICY "Anyone can read leaderboard" ON leaderboard
  FOR SELECT USING (true);

-- Authenticated users can insert their own scores
CREATE POLICY "Users can insert own scores" ON leaderboard
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = user_id
  );
```

### Phase 2: Auth0 Action Configuration (Manual - Auth0 Dashboard)

Create a Post-Login Action to add required claims to JWT:

```javascript
// Auth0 Action: Add Supabase Claims
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://supabase.com/';

  // Add the 'authenticated' role claim for Supabase RLS
  api.accessToken.setCustomClaim(`${namespace}role`, 'authenticated');

  // Supabase expects 'sub' claim which Auth0 already provides
};
```

### Phase 3: Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Phase 4: Create Supabase Service

**New file: `src/services/supabaseService.ts`**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './authService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient;

  private constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // Update client with Auth0 token for authenticated requests
  async setAuthToken(): Promise<void> {
    const authService = AuthService.getInstance();
    const token = await authService.getAccessToken();
    if (token) {
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
```

### Phase 5: Create Cloud Leaderboard Service

**New file: `src/services/cloudLeaderboardService.ts`**

```typescript
import { SupabaseService } from './supabaseService';
import { AuthService } from './authService';
import type { GameResult } from './gameResultsService';

export interface CloudLeaderboardEntry {
  id: string;
  user_id: string;
  player_name: string;
  level_id: string;
  level_name: string;
  completed: boolean;
  end_reason: string;
  game_time_seconds: number;
  asteroids_destroyed: number;
  total_asteroids: number;
  accuracy: number;
  hull_damage_taken: number;
  fuel_consumed: number;
  final_score: number;
  star_rating: number;
  created_at: string;
}

export class CloudLeaderboardService {
  private static instance: CloudLeaderboardService;

  static getInstance(): CloudLeaderboardService {
    if (!CloudLeaderboardService.instance) {
      CloudLeaderboardService.instance = new CloudLeaderboardService();
    }
    return CloudLeaderboardService.instance;
  }

  // Submit a score to cloud leaderboard
  async submitScore(result: GameResult): Promise<boolean> {
    const supabase = SupabaseService.getInstance();
    await supabase.setAuthToken();

    const authService = AuthService.getInstance();
    const user = authService.getUser();

    if (!user?.sub) {
      console.warn('Cannot submit score: user not authenticated');
      return false;
    }

    const entry = {
      user_id: user.sub,
      player_name: result.playerName,
      level_id: result.levelId,
      level_name: result.levelName,
      completed: result.completed,
      end_reason: result.endReason,
      game_time_seconds: result.gameTimeSeconds,
      asteroids_destroyed: result.asteroidsDestroyed,
      total_asteroids: result.totalAsteroids,
      accuracy: result.accuracy,
      hull_damage_taken: result.hullDamageTaken,
      fuel_consumed: result.fuelConsumed,
      final_score: result.finalScore,
      star_rating: result.starRating
    };

    const { error } = await supabase.getClient()
      .from('leaderboard')
      .insert(entry);

    if (error) {
      console.error('Failed to submit score:', error);
      return false;
    }

    return true;
  }

  // Fetch global leaderboard (top scores)
  async getGlobalLeaderboard(limit = 20): Promise<CloudLeaderboardEntry[]> {
    const supabase = SupabaseService.getInstance();

    const { data, error } = await supabase.getClient()
      .from('leaderboard')
      .select('*')
      .order('final_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch leaderboard:', error);
      return [];
    }

    return data || [];
  }

  // Get user's personal best scores
  async getUserScores(userId: string, limit = 10): Promise<CloudLeaderboardEntry[]> {
    const supabase = SupabaseService.getInstance();

    const { data, error } = await supabase.getClient()
      .from('leaderboard')
      .select('*')
      .eq('user_id', userId)
      .order('final_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch user scores:', error);
      return [];
    }

    return data || [];
  }
}
```

### Phase 6: Integrate with Existing Code

**Modify: `src/services/gameResultsService.ts`**

Add cloud submission after local save:

```typescript
import { CloudLeaderboardService } from './cloudLeaderboardService';

// In saveResult() method, after localStorage save:
async saveResult(result: GameResult): Promise<void> {
  // Existing localStorage save
  const results = this.getAllResults();
  results.push(result);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(results));

  // NEW: Submit to cloud leaderboard
  try {
    const cloudService = CloudLeaderboardService.getInstance();
    await cloudService.submitScore(result);
  } catch (error) {
    console.warn('Cloud leaderboard submission failed:', error);
    // Don't block on cloud failure - local save succeeded
  }
}
```

**Modify: `src/components/leaderboard/Leaderboard.svelte`**

Add toggle between local and cloud leaderboard:

```svelte
<script>
  import { CloudLeaderboardService } from '../../services/cloudLeaderboardService';

  let showCloud = true;
  let cloudResults = [];

  async function loadCloudLeaderboard() {
    const service = CloudLeaderboardService.getInstance();
    cloudResults = await service.getGlobalLeaderboard(20);
  }

  onMount(() => {
    if (showCloud) loadCloudLeaderboard();
  });
</script>

<!-- Add toggle UI and display cloudResults when showCloud is true -->
```

### Phase 7: Environment Variables

**Create/update: `.env`**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/services/supabaseService.ts` | CREATE | Supabase client singleton |
| `src/services/cloudLeaderboardService.ts` | CREATE | Cloud leaderboard API |
| `src/services/gameResultsService.ts` | MODIFY | Add cloud submission |
| `src/components/leaderboard/Leaderboard.svelte` | MODIFY | Add cloud data source |
| `.env` | CREATE/MODIFY | Add Supabase credentials |
| `package.json` | MODIFY | Add @supabase/supabase-js |

## External Setup Required (Manual)

1. **Supabase Dashboard**: Create project, table, RLS policies, Auth0 integration
2. **Auth0 Dashboard**: Create Post-Login Action for role claim

## Cost Analysis

- **Supabase Free Tier**: 500MB database, 10k MAU, 1GB file storage
- **Your usage** (<100 players): Well within free tier
- **Cost**: $0/month

## Considerations

- **Offline/failure handling**: Falls back to localStorage if cloud fails
- **Inactivity pause**: Free tier projects pause after 7 days inactivity (easy to unpause)
- **No anti-cheat**: Scores submitted directly from client (per your requirements)
