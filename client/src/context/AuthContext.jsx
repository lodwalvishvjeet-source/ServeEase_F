import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, userApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Check current session on application mount
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authApi.getMe();
      if (data && data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      // 401 or network error indicates unauthenticated guest state
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  /**
   * Login with email, password, and optional role
   */
  const login = async (email, password, role) => {
    setAuthError(null);
    try {
      const data = await authApi.login(email, password, role);
      if (!data || !data.success) {
        throw new Error(data?.error || 'Authentication failed. Please verify your credentials.');
      }
      setUser(data.user);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  /**
   * Register a customer or provider account
   */
  const register = async (userData) => {
    setAuthError(null);
    try {
      const data = await authApi.register(userData);
      if (!data || !data.success) {
        throw new Error(data?.error || 'Registration failed. Please check form details.');
      }
      if (data.user) {
        setUser(data.user);
      }
      return data;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  /**
   * Logout and terminate current session
   */
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout API request error:', err.message);
    } finally {
      setUser(null);
      setAuthError(null);
    }
  };

  /**
   * Update allowed profile fields
   */
  const updateProfile = async (profileData) => {
    const data = await userApi.updateProfile(profileData);
    if (!data || !data.success) {
      throw new Error(data?.error || 'Failed to update profile.');
    }
    setUser(data.user);
    return data.user;
  };

  /**
   * Verify email OTP and update active user
   */
  const verifyEmailOtp = async (email, otp) => {
    const data = await authApi.verifyEmailOtp(email, otp);
    if (!data || !data.success) {
      throw new Error(data?.error || 'Verification failed. Please check the code.');
    }
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const value = {
    user,
    setUser,
    loading,
    authError,
    isAuthenticated: !!user,
    role: user?.role || null,
    login,
    register,
    logout,
    updateProfile,
    verifyEmailOtp,
    refreshUser: checkAuthStatus
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
