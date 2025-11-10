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
        this.container.id = 'preloader';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.95);
            z-index: 10000;
            padding: 20px;
        `;

        this.container.innerHTML = `
            <div style="
                text-align: center;
                max-width: 600px;
                width: 100%;
            ">
                <h1 style="
                    font-size: 3em;
                    margin-bottom: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                ">
                    🚀 Space Combat VR
                </h1>

                <div id="preloaderStatus" style="
                    font-size: 1.2em;
                    color: #aaa;
                    margin: 30px 0 20px 0;
                    min-height: 30px;
                ">
                    Initializing...
                </div>

                <div style="
                    width: 100%;
                    height: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 40px;
                ">
                    <div id="preloaderProgress" style="
                        width: 0%;
                        height: 100%;
                        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                        transition: width 0.3s ease;
                        box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
                    "></div>
                </div>

                <button id="preloaderStartBtn" style="
                    display: none;
                    padding: 20px 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 1.5em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
                "
                onmouseover="this.style.transform='translateY(-3px) scale(1.05)'; this.style.boxShadow='0 8px 30px rgba(102, 126, 234, 0.7)';"
                onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 6px 25px rgba(102, 126, 234, 0.5)';">
                    Start Game
                </button>

                <div style="
                    margin-top: 30px;
                    font-size: 0.9em;
                    color: #666;
                ">
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
