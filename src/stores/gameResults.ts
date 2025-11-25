import { writable } from 'svelte/store';
import { GameResultsService, GameResult } from '../services/gameResultsService';

/**
 * Svelte store for game results
 * Provides reactive access to leaderboard data
 */
function createGameResultsStore() {
    const service = GameResultsService.getInstance();
    const { subscribe, set } = writable<GameResult[]>(service.getTopResults(20));

    return {
        subscribe,

        /**
         * Refresh the store with latest top results
         */
        refresh: () => {
            set(service.getTopResults(20));
        },

        /**
         * Add a new result and refresh the store
         */
        addResult: (result: GameResult) => {
            service.saveResult(result);
            set(service.getTopResults(20));
        },

        /**
         * Get all results (not just top 20)
         */
        getAll: () => {
            return service.getAllResults();
        },

        /**
         * Clear all results (for testing/reset)
         */
        clear: () => {
            service.clearAll();
            set([]);
        }
    };
}

export const gameResultsStore = createGameResultsStore();
