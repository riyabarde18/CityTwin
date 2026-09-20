import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types';
import { getStoredUser, getStoredToken, getMe, logout as apiLogout } from '../api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Trust the cached user for instant UI, but confirm the token is still
    // valid in the background (it may have expired since the last visit).
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    getMe()
      .then((u) => setUserState(u))
      .catch(() => {
        apiLogout();
        setUserState(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setUser = useCallback((u: User | null) => setUserState(u), []);

  const logout = useCallback(() => {
    apiLogout();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
