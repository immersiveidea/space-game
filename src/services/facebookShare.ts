import log from '../core/logger';

/**
 * Facebook Share Integration
 * Handles sharing game results to Facebook when user is authenticated via Facebook
 */

export interface ShareData {
    levelName: string;
    gameTime: string;
    asteroidsDestroyed: number;
    accuracy: number;
    completed: boolean;
}

export class FacebookShare {
    private static _instance: FacebookShare;
    private _fbInitialized: boolean = false;
    private _appId: string = '';

    private constructor() {
        this._appId = import.meta.env.VITE_FACEBOOK_APP_ID || '';
    }

    public static getInstance(): FacebookShare {
        if (!FacebookShare._instance) {
            FacebookShare._instance = new FacebookShare();
        }
        return FacebookShare._instance;
    }

    /**
     * Initialize Facebook SDK
     * Should be called after detecting Facebook authentication
     */
    public async initialize(): Promise<boolean> {
        if (this._fbInitialized) {
            return true;
        }

        if (!this._appId) {
            log.warn('Facebook App ID not configured');
            return false;
        }

        return new Promise((resolve) => {
            // Check if SDK already loaded
            if ((window as any).FB) {
                this._fbInitialized = true;
                resolve(true);
                return;
            }

            // Load Facebook SDK
            const script = document.createElement('script');
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';

            script.onload = () => {
                (window as any).fbAsyncInit = () => {
                    (window as any).FB.init({
                        appId: this._appId,
                        autoLogAppEvents: true,
                        xfbml: true,
                        version: 'v18.0'
                    });
                    this._fbInitialized = true;
                    resolve(true);
                };

                // Trigger initialization if fbAsyncInit wasn't called
                if ((window as any).FB) {
                    (window as any).FB.init({
                        appId: this._appId,
                        autoLogAppEvents: true,
                        xfbml: true,
                        version: 'v18.0'
                    });
                    this._fbInitialized = true;
                    resolve(true);
                }
            };

            script.onerror = () => {
                log.error('Failed to load Facebook SDK');
                resolve(false);
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Check if Facebook SDK is initialized
     */
    public isInitialized(): boolean {
        return this._fbInitialized;
    }

    /**
     * Share game completion results to Facebook
     * @param shareData - Game statistics and level info
     */
    public async shareResults(shareData: ShareData): Promise<boolean> {
        if (!this._fbInitialized) {
            log.warn('Facebook SDK not initialized');
            return false;
        }

        const FB = (window as any).FB;
        if (!FB) {
            log.error('Facebook SDK not available');
            return false;
        }

        // Create share message
        const _message = this.generateShareMessage(shareData);
        const quote = this.generateShareQuote(shareData);

        return new Promise((resolve) => {
            // Use Facebook Share Dialog
            FB.ui({
                method: 'share',
                href: window.location.origin,
                quote: quote,
                hashtag: '#SpaceCombatVR'
            }, (response: any) => {
                if (response && !response.error_message) {
                    log.info('Successfully shared to Facebook');
                    resolve(true);
                } else {
                    log.error('Error sharing to Facebook:', response?.error_message || 'Unknown error');
                    resolve(false);
                }
            });
        });
    }

    /**
     * Share using Web Share API as fallback
     * @param shareData - Game statistics and level info
     */
    public async shareWithWebAPI(shareData: ShareData): Promise<boolean> {
        if (!navigator.share) {
            log.warn('Web Share API not supported');
            return false;
        }

        try {
            const message = this.generateShareMessage(shareData);

            await navigator.share({
                title: 'Space Combat VR - Mission Complete!',
                text: message,
                url: window.location.origin
            });

            return true;
        } catch (error) {
            // User cancelled or error occurred
            log.info('Share cancelled or failed:', error);
            return false;
        }
    }

    /**
     * Generate share message from game data
     */
    private generateShareMessage(data: ShareData): string {
        if (data.completed) {
            return `🚀 I just completed "${data.levelName}" in Space Combat VR!\n\n` +
                   `⏱️ Time: ${data.gameTime}\n` +
                   `💥 Asteroids Destroyed: ${data.asteroidsDestroyed}\n` +
                   `🎯 Accuracy: ${data.accuracy}%\n\n` +
                   `Think you can beat my score?`;
        } else {
            return `🚀 I'm playing "${data.levelName}" in Space Combat VR!\n\n` +
                   `💥 Asteroids Destroyed: ${data.asteroidsDestroyed}\n` +
                   `🎯 Accuracy: ${data.accuracy}%`;
        }
    }

    /**
     * Generate Facebook quote (shown in share dialog)
     */
    private generateShareQuote(data: ShareData): string {
        const emoji = data.accuracy >= 80 ? '🏆' : data.accuracy >= 60 ? '⭐' : '🚀';

        return `${emoji} Just completed ${data.levelName} in ${data.gameTime} ` +
               `with ${data.accuracy}% accuracy! ${data.asteroidsDestroyed} asteroids destroyed!`;
    }

    /**
     * Copy share message to clipboard
     * @param shareData - Game statistics and level info
     */
    public async copyToClipboard(shareData: ShareData): Promise<boolean> {
        try {
            const message = this.generateShareMessage(shareData);
            await navigator.clipboard.writeText(message);
            return true;
        } catch (error) {
            log.error('Failed to copy to clipboard:', error);
            return false;
        }
    }
}
