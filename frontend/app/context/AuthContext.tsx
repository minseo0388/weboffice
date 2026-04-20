'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthUser {
  token: string;
  name: string;
  email: string;
  provider: string;
}

interface AuthContextType {
  user: AuthUser | null;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, check sessionStorage for a previously stored token
    const stored = sessionStorage.getItem('hc_auth');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const logout = () => {
    sessionStorage.removeItem('hc_auth');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

/**
 * Helper: parse a JWT payload (base64url) without verifying signature.
 * Signature is verified server-side on every API call.
 */
export function parseJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}
