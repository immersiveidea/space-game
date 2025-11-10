/**
 * Discord Widget Integration using Widgetbot Crate
 * Dynamically loads the widget script to avoid npm bundling issues
 */

export interface DiscordWidgetOptions {
  server: string;
  channel: string;
  location?: string[];
  color?: string;
  glyph?: string[];
  notifications?: boolean;
  indicator?: boolean;
  allChannelNotifications?: boolean;
}

export class DiscordWidget {
  private crate: any = null;
  private scriptLoaded = false;
  private isVisible = false;

  /**
   * Initialize the Discord widget
   * @param options - Widget configuration
   */
  async initialize(options: DiscordWidgetOptions): Promise<void> {
    // Load the Crate script if not already loaded
    if (!this.scriptLoaded) {
      console.log('[DiscordWidget] Loading Crate script...');
      await this.loadCrateScript();
      this.scriptLoaded = true;
    }

    // Wait for Crate to be available on window
    await this.waitForCrate();

    // Initialize the Crate widget
    const defaultOptions: DiscordWidgetOptions = {
      location: ['bottom', 'right'],
      color: '#7289DA',
      glyph: ['💬', '✖️'],
      notifications: true,
      indicator: true,
      ...options
    };

    console.log('[DiscordWidget] Initializing Crate with options:', defaultOptions);

    // @ts-ignore - Crate is loaded from CDN
    this.crate = new window.Crate(defaultOptions);

    this.setupEventListeners();
    console.log('[DiscordWidget] Successfully initialized');
  }

  /**
   * Dynamically load the Crate script from CDN
   */
  private loadCrateScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="widgetbot"]');
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@widgetbot/crate@3';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log('[DiscordWidget] Script loaded successfully');
        resolve();
      };

      script.onerror = () => {
        console.error('[DiscordWidget] Failed to load script');
        reject(new Error('Failed to load Widgetbot Crate script'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Wait for Crate constructor to be available on window
   */
  private waitForCrate(): Promise<void> {
    return new Promise((resolve) => {
      const checkCrate = () => {
        // @ts-ignore
        if (window.Crate) {
          resolve();
        } else {
          setTimeout(checkCrate, 50);
        }
      };
      checkCrate();
    });
  }

  /**
   * Setup event listeners for widget events
   */
  private setupEventListeners(): void {
    if (!this.crate) return;

    // Listen for when user signs in
    this.crate.on('signIn', (user: any) => {
      console.log('[DiscordWidget] User signed in:', user.username);
    });

    // Listen for widget visibility changes
    this.crate.on('toggleChat', (visible: boolean) => {
      this.isVisible = visible;
      console.log('[DiscordWidget] Chat visibility:', visible);
    });
  }

  /**
   * Toggle the Discord chat widget
   */
  toggle(): void {
    if (this.crate) {
      this.crate.toggle();
    }
  }

  /**
   * Show a notification on the widget button
   * @param message - Notification message
   */
  notify(message: string): void {
    if (this.crate) {
      this.crate.notify(message);
    }
  }

  /**
   * Show the widget
   */
  show(): void {
    if (this.crate && !this.isVisible) {
      this.crate.show();
      this.isVisible = true;
    }
  }

  /**
   * Hide the widget
   */
  hide(): void {
    if (this.crate && this.isVisible) {
      this.crate.hide();
      this.isVisible = false;
    }
  }

  /**
   * Check if widget is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Emit a custom event to the widget
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data?: any): void {
    if (this.crate) {
      this.crate.emit(event, data);
    }
  }

  /**
   * Listen for widget events
   * @param event - Event name
   * @param callback - Event callback
   */
  on(event: string, callback: (data: any) => void): void {
    if (this.crate) {
      this.crate.on(event, callback);
    }
  }

  /**
   * Send a message to the Discord channel (if user is signed in)
   * @param message - Message text
   */
  sendMessage(message: string): void {
    if (this.crate) {
      this.emit('sendMessage', message);
    }
  }
}
