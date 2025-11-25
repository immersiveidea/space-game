<script lang="ts">
  import { onMount } from 'svelte';
  import { Link } from 'svelte-routing';
  import { gameResultsStore } from '../../stores/gameResults';
  import type { GameResult } from '../../services/gameResultsService';
  import { formatStars } from '../../game/scoreCalculator';

  // Refresh data on mount
  onMount(() => {
    gameResultsStore.refresh();
  });

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Format date as readable string
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Get color for end reason badge
  function getEndReasonColor(result: GameResult): string {
    if (result.endReason === 'victory') return '#4ade80';
    if (result.endReason === 'death') return '#ef4444';
    return '#f59e0b'; // stranded
  }

  // Get emoji for end reason
  function getEndReasonEmoji(result: GameResult): string {
    if (result.endReason === 'victory') return '';
    if (result.endReason === 'death') return '';
    return '';
  }
</script>

<div class="editor-container">
  <Link to="/" class="back-link">← Back to Game</Link>

  <h1>Leaderboard</h1>
  <p class="subtitle">Top 20 High Scores</p>

  <div class="leaderboard-wrapper">
    {#if $gameResultsStore.length === 0}
      <div class="no-results">
        <p>No game results yet!</p>
        <p class="muted">Play a level to see your scores here.</p>
      </div>
    {:else}
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="rank-col">Rank</th>
            <th class="player-col">Player</th>
            <th class="level-col">Level</th>
            <th class="score-col">Score</th>
            <th class="stars-col">Stars</th>
            <th class="result-col">Result</th>
            <th class="time-col">Time</th>
            <th class="date-col">Date</th>
          </tr>
        </thead>
        <tbody>
          {#each $gameResultsStore as result, i}
            <tr class:victory={result.completed}>
              <td class="rank-col">
                <span class="rank-badge" class:gold={i === 0} class:silver={i === 1} class:bronze={i === 2}>
                  {i + 1}
                </span>
              </td>
              <td class="player-col">{result.playerName}</td>
              <td class="level-col">{result.levelName}</td>
              <td class="score-col">
                <span class="score-value">{result.finalScore.toLocaleString()}</span>
              </td>
              <td class="stars-col">
                <span class="star-display">{formatStars(result.starRating)}</span>
                <span class="star-count">{result.starRating}/12</span>
              </td>
              <td class="result-col">
                <span class="result-badge" style="background-color: {getEndReasonColor(result)}">
                  {getEndReasonEmoji(result)} {result.endReason}
                </span>
              </td>
              <td class="time-col">{formatTime(result.gameTimeSeconds)}</td>
              <td class="date-col">{formatDate(result.timestamp)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="leaderboard-footer">
    <p class="muted">Showing top 20 scores sorted by highest score</p>
  </div>
</div>

<style>
  .leaderboard-wrapper {
    background: var(--color-bg-card, rgba(20, 20, 40, 0.9));
    border: 1px solid var(--color-border-default, rgba(255, 255, 255, 0.2));
    border-radius: var(--radius-lg, 10px);
    overflow: hidden;
    margin-top: var(--space-xl, 32px);
  }

  .no-results {
    text-align: center;
    padding: var(--space-3xl, 64px) var(--space-xl, 32px);
    color: var(--color-text-secondary, #e8e8e8);
  }

  .no-results .muted {
    color: var(--color-text-muted, #aaaaaa);
    margin-top: var(--space-md, 16px);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm, 0.9rem);
  }

  .leaderboard-table thead {
    background: rgba(0, 0, 0, 0.4);
  }

  .leaderboard-table th {
    padding: var(--space-md, 16px) var(--space-sm, 8px);
    text-align: left;
    font-weight: bold;
    color: var(--color-text-secondary, #e8e8e8);
    text-transform: uppercase;
    font-size: var(--font-size-xs, 0.8rem);
    letter-spacing: 0.5px;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .leaderboard-table td {
    padding: var(--space-md, 16px) var(--space-sm, 8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }

  .leaderboard-table tbody tr {
    transition: background var(--transition-fast, 0.2s ease);
  }

  .leaderboard-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .leaderboard-table tbody tr.victory {
    background: rgba(74, 222, 128, 0.05);
  }

  .leaderboard-table tbody tr.victory:hover {
    background: rgba(74, 222, 128, 0.1);
  }

  /* Column widths */
  .rank-col { width: 60px; text-align: center; }
  .player-col { min-width: 120px; }
  .level-col { min-width: 140px; }
  .score-col { width: 100px; text-align: right; }
  .stars-col { width: 100px; text-align: center; }
  .result-col { width: 100px; text-align: center; }
  .time-col { width: 70px; text-align: center; }
  .date-col { width: 100px; text-align: right; }

  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    font-weight: bold;
    font-size: var(--font-size-sm, 0.9rem);
  }

  .rank-badge.gold {
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #000;
    box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
  }

  .rank-badge.silver {
    background: linear-gradient(135deg, #C0C0C0, #A0A0A0);
    color: #000;
    box-shadow: 0 2px 8px rgba(192, 192, 192, 0.5);
  }

  .rank-badge.bronze {
    background: linear-gradient(135deg, #CD7F32, #B87333);
    color: #000;
    box-shadow: 0 2px 8px rgba(205, 127, 50, 0.5);
  }

  .score-value {
    color: #FFD700;
    font-weight: bold;
    font-size: var(--font-size-base, 1rem);
  }

  .star-display {
    display: block;
    font-size: var(--font-size-sm, 0.9rem);
    color: #FFD700;
  }

  .star-count {
    display: block;
    font-size: var(--font-size-xs, 0.8rem);
    color: var(--color-text-muted, #aaaaaa);
  }

  .result-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-xs, 0.8rem);
    font-weight: bold;
    text-transform: uppercase;
    color: #000;
  }

  .leaderboard-footer {
    text-align: center;
    padding: var(--space-lg, 24px);
  }

  .leaderboard-footer .muted {
    color: var(--color-text-muted, #aaaaaa);
    font-size: var(--font-size-sm, 0.9rem);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .leaderboard-table {
      display: block;
      overflow-x: auto;
    }

    .leaderboard-table th,
    .leaderboard-table td {
      padding: var(--space-sm, 8px) var(--space-xs, 4px);
    }

    .level-col, .date-col {
      display: none;
    }
  }
</style>
