interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, any>;
  last_login?: string;
}

interface AuthResponse {
  success: boolean;
  data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: AuthUser;
    application: {
      id: string;
      name: string;
      domain: string;
    };
  };
}

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  app_id: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const APP_ID = import.meta.env.VITE_AUTH_APP_ID;
const API_KEY = import.meta.env.VITE_AUTH_API_KEY;
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export const externalAuth = {
  redirectToLogin() {
    const redirectUri = `${APP_URL}/callback`;
    const loginUrl = `${AUTH_URL}/login?app_id=${encodeURIComponent(APP_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&api_key=${encodeURIComponent(API_KEY)}`;
    window.location.href = loginUrl;
  },

  parseCallbackUrl(url: string): { token: string; refreshToken: string; userId: string; state: string } | null {
    try {
      const urlObj = new URL(url);
      const token = urlObj.searchParams.get('token');
      const refreshToken = urlObj.searchParams.get('refresh_token');
      const userId = urlObj.searchParams.get('user_id');
      const state = urlObj.searchParams.get('state');

      if (!token || !userId) {
        return null;
      }

      return {
        token: decodeURIComponent(token),
        refreshToken: refreshToken ? decodeURIComponent(refreshToken) : '',
        userId,
        state: state || 'authenticated'
      };
    } catch (error) {
      return null;
    }
  },

  decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;

      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload) as TokenPayload;
    } catch (error) {
      return null;
    }
  },

  getUserFromToken(token: string): AuthUser | null {
    const payload = this.decodeToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      permissions: payload.permissions || []
    };
  },

  isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  },

  storeAuthData(token: string, refreshToken: string, userId: string) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_id', userId);

    const user = this.getUserFromToken(token);
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
  },

  getStoredToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  getStoredRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  },

  getStoredUser(): AuthUser | null {
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr) as AuthUser;
    } catch {
      return null;
    }
  },

  clearAuthData() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_user');
  },

  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`
        },
        body: JSON.stringify({
          app_id: APP_ID,
          api_key: API_KEY
        })
      });

      if (!response.ok) {
        return null;
      }

      const data: AuthResponse = await response.json();
      if (data.success && data.data.access_token) {
        this.storeAuthData(
          data.data.access_token,
          data.data.refresh_token,
          data.data.user.id
        );
        return data.data.access_token;
      }

      return null;
    } catch (error) {
      return null;
    }
  },

  async logout() {
    try {
      const token = this.getStoredToken();
      if (token) {
        await fetch(`${AUTH_URL}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            app_id: APP_ID,
            api_key: API_KEY
          })
        });
      }
    } catch (error) {
    } finally {
      this.clearAuthData();
    }
  },

  isAuthenticated(): boolean {
    const token = this.getStoredToken();
    if (!token) return false;

    if (this.isTokenExpired(token)) {
      const refreshToken = this.getStoredRefreshToken();
      if (refreshToken) {
        return true;
      }
      return false;
    }

    return true;
  },

  getUserRole(): string {
    const user = this.getStoredUser();
    if (!user || !user.roles || user.roles.length === 0) {
      return 'agent';
    }

    const roleMap: Record<string, number> = {
      admin: 3,
      manager: 2,
      agent: 1
    };

    const highestRole = user.roles.reduce((highest, role) => {
      const currentLevel = roleMap[role.toLowerCase()] || 0;
      const highestLevel = roleMap[highest.toLowerCase()] || 0;
      return currentLevel > highestLevel ? role : highest;
    }, 'agent');

    return highestRole.toLowerCase();
  }
};
