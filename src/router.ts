/**
 * Simple hash-based client-side router
 */
export class Router {
    private routes: Map<string, () => void> = new Map();
    private currentRoute: string = '';
    private started: boolean = false;

    constructor() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    /**
     * Start the router (call after registering all routes)
     */
    public start(): void {
        if (!this.started) {
            this.started = true;
            this.handleRoute();
        }
    }

    /**
     * Register a route handler
     */
    public on(path: string, handler: () => void): void {
        this.routes.set(path, handler);
    }

    /**
     * Navigate to a route programmatically
     */
    public navigate(path: string): void {
        window.location.hash = path;
    }

    /**
     * Get current route path (without #)
     */
    public getCurrentRoute(): string {
        return this.currentRoute;
    }

    /**
     * Handle route changes
     */
    private handleRoute(): void {
        // Get hash without the #
        let hash = window.location.hash.slice(1) || '/';

        // Normalize route
        if (!hash.startsWith('/')) {
            hash = '/' + hash;
        }

        this.currentRoute = hash;

        // Find and execute route handler
        const handler = this.routes.get(hash);
        if (handler) {
            handler();
        } else {
            // Default to root if route not found
            const defaultHandler = this.routes.get('/');
            if (defaultHandler) {
                defaultHandler();
            }
        }
    }
}

// Global router instance
export const router = new Router();

/**
 * Helper to show/hide views
 */
export function showView(viewId: string): void {
    // Hide all views
    const views = document.querySelectorAll('[data-view]');
    views.forEach(view => {
        (view as HTMLElement).style.display = 'none';
    });

    // Show requested view
    const targetView = document.querySelector(`[data-view="${viewId}"]`);
    if (targetView) {
        (targetView as HTMLElement).style.display = 'block';
    }
}
