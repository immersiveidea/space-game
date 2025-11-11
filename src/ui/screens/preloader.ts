/**
 * Preloader UI - Shows loading progress and start button
 */

export class Preloader {
    private container: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;
    private startButton: HTMLElement | null = null;
    private onStartCallback: (() => void) | null = null;

    constructor() {
        this.createUI();
    }

    private createUI(): void {
        const levelSelect = document.getElementById('levelSelect');
        if (!levelSelect) return;

        // Create preloader container
        this.container = document.createElement('div');
        this.container.className = 'preloader';

        this.container.innerHTML = `
            <div class="preloader-content">
                <h1 class="preloader-title">
                    🚀 Space Combat VR
                </h1>

                <div id="preloaderStatus" class="preloader-status">
                    Initializing...
                </div>

                <div class="preloader-progress-container">
                    <div id="preloaderProgress" class="preloader-progress"></div>
                </div>

                <button id="preloaderStartBtn" class="preloader-button">
                    Start Game
                </button>

                <div class="preloader-info">
                    <p>Initializing game engine... Assets will load when you select a level.</p>
                </div>
            </div>
        `;

        levelSelect.appendChild(this.container);

        // Get references
        this.progressBar = document.getElementById('preloaderProgress');
        this.statusText = document.getElementById('preloaderStatus');
        this.startButton = document.getElementById('preloaderStartBtn');

        // Add start button click handler
        if (this.startButton) {
            this.startButton.addEventListener('click', () => {
                if (this.onStartCallback) {
                    this.onStartCallback();
                }
            });
        }
    }

    /**
     * Update loading progress
     * @param percent - Progress from 0 to 100
     * @param message - Status message to display
     */
    public updateProgress(percent: number, message: string): void {
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        if (this.statusText) {
            this.statusText.textContent = message;
        }
    }

    /**
     * Show the start button when loading is complete
     * @param onStart - Callback to invoke when user clicks start
     */
    public showStartButton(onStart: () => void): void {
        this.onStartCallback = onStart;

        if (this.statusText) {
            this.statusText.textContent = 'All systems ready!';
        }

        if (this.progressBar) {
            this.progressBar.style.width = '100%';
        }

        if (this.startButton) {
            this.startButton.style.display = 'block';

            // Animate button appearance
            this.startButton.style.opacity = '0';
            this.startButton.style.transform = 'translateY(20px)';

            setTimeout(() => {
                if (this.startButton) {
                    this.startButton.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    this.startButton.style.opacity = '1';
                    this.startButton.style.transform = 'translateY(0)';
                }
            }, 100);
        }
    }

    /**
     * Hide and remove the preloader
     */
    public hide(): void {
        if (this.container) {
            this.container.style.transition = 'opacity 0.5s ease';
            this.container.style.opacity = '0';

            setTimeout(() => {
                if (this.container && this.container.parentElement) {
                    this.container.remove();
                }
            }, 500);
        }
    }

    /**
     * Check if preloader exists
     */
    public isVisible(): boolean {
        return this.container !== null && this.container.parentElement !== null;
    }
}
