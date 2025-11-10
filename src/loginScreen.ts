import { AuthService } from './authService';

/**
 * Creates and displays the login screen UI
 * Shown when user is not authenticated
 */
export function showLoginScreen(): void {
    const container = document.querySelector('#levelSelect');
    if (!container) {
        console.error('Level select container not found');
        return;
    }

    container.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
            padding: 40px 20px;
            text-align: center;
        ">
            <div style="
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid rgba(102, 126, 234, 0.5);
                border-radius: 12px;
                padding: 60px 40px;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
            ">
                <h1 style="
                    font-size: 2.5em;
                    margin: 0 0 20px 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                ">
                    Space Combat VR
                </h1>

                <p style="
                    margin: 30px 0;
                    color: #aaa;
                    font-size: 1.1em;
                    line-height: 1.6;
                ">
                    Welcome, pilot! Authentication required to access your mission data and track your progress across the galaxy.
                </p>

                <button id="loginBtn" style="
                    padding: 18px 50px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.3em;
                    cursor: pointer;
                    font-weight: bold;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                "
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)';"
                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)';">
                    Log In / Sign Up
                </button>

                <p style="
                    margin-top: 30px;
                    color: #666;
                    font-size: 0.9em;
                ">
                    Secured by Auth0
                </p>
            </div>
        </div>
    `;

    // Attach login handler
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            loginBtn.textContent = 'Redirecting...';
            loginBtn.setAttribute('disabled', 'true');
            const authService = AuthService.getInstance();
            await authService.login();
        });
    }
}

/**
 * Updates the user profile display in the header
 * Shows username and logout button when authenticated, or login button when not
 * @param username - The username to display, or null to show login button
 */
export function updateUserProfile(username: string | null): void {
    const profileContainer = document.getElementById('userProfile');
    if (!profileContainer) return;

    if (username) {
        // User is authenticated - show profile and logout
        profileContainer.innerHTML = `
            <span style="margin-right: 15px; color: #aaa;">
                Welcome, ${username}
            </span>
            <button id="logoutBtn" style="
                padding: 8px 20px;
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: background 0.2s;
            "
            onmouseover="this.style.background='rgba(255, 255, 255, 0.2)';"
            onmouseout="this.style.background='rgba(255, 255, 255, 0.1)';">
                Log Out
            </button>
        `;

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const authService = AuthService.getInstance();
                await authService.logout();
            });
        }
    } else {
        // User not authenticated - show login/signup button
        profileContainer.innerHTML = `
            <button id="loginBtn" style="
                padding: 10px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.95em;
                font-weight: 600;
                transition: transform 0.2s, box-shadow 0.2s;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)';"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)';">
                Sign Up / Log In
            </button>
        `;

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const authService = AuthService.getInstance();
                await authService.login();
            });
        }
    }
}
