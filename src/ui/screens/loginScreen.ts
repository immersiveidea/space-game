import { AuthService } from '../../services/authService';

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
        <div class="login-screen" style="position: relative; z-index: 1;">
            <div class="login-container">
                <h1 class="login-title">Space Combat VR</h1>

                <p class="login-subtitle">
                    Welcome, pilot! Authentication required to access your mission data and track your progress across the galaxy.
                </p>

                <button id="loginBtn" class="login-button">
                    Log In / Sign Up
                </button>

                <p class="login-skip" style="color: #666; font-size: 0.9em; margin-top: 30px;">
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
        profileContainer.className = 'user-profile';
        profileContainer.innerHTML = `
            <span class="user-profile-name">
                Welcome, ${username}
            </span>
            <button id="logoutBtn" class="user-profile-button">
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
        profileContainer.className = '';
        profileContainer.innerHTML = `
            <button id="loginBtn" class="user-profile-button">
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
