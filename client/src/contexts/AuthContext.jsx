import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export function getHomePathForRole(role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'LECTURER') return '/lecturer/dashboard';
  return '/dashboard';
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async (activeToken) => {
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser(token);
  }, [token, loadCurrentUser]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      return { success: true, role: userData.role };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Unable to connect to EduRisk server',
      };
    }
  };

  const completeAuthSession = (newToken, userData) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, completeAuthSession, loading, refreshUser: () => loadCurrentUser(token) }}>
      {!loading ? (
        children
      ) : (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center text-slate-300">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            <span className="text-sm font-medium">Loading EduRisk...</span>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
