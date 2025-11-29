import { AuthService } from '../../services/authService';

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
