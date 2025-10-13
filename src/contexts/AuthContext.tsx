import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { externalAuth } from '../lib/externalAuth';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (externalAuth.isAuthenticated()) {
        const storedUser = externalAuth.getStoredUser();
        const token = externalAuth.getStoredToken();

        if (storedUser && token) {
          if (externalAuth.isTokenExpired(token)) {
            const refreshToken = externalAuth.getStoredRefreshToken();
            if (refreshToken) {
              const newToken = await externalAuth.refreshAccessToken(refreshToken);
              if (newToken) {
                const updatedUser = externalAuth.getStoredUser();
                setUser(updatedUser);
              } else {
                externalAuth.clearAuthData();
                setUser(null);
              }
            } else {
              externalAuth.clearAuthData();
              setUser(null);
            }
          } else {
            setUser(storedUser);
          }
        }
      }
    } catch (error) {
      externalAuth.clearAuthData();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = () => {
    externalAuth.redirectToLogin();
  };

  const signOut = async () => {
    await externalAuth.logout();
    setUser(null);
    window.location.href = '/login';
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenStr = externalAuth.getStoredRefreshToken();
      if (!refreshTokenStr) return false;

      const newToken = await externalAuth.refreshAccessToken(refreshTokenStr);
      if (newToken) {
        const updatedUser = externalAuth.getStoredUser();
        setUser(updatedUser);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    signIn,
    signOut,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
