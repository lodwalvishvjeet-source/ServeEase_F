import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, userApi } from '../services/api';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  firebaseSignInWithEmail,
  firebaseRegisterWithEmail,
  firebaseSignInWithGoogle,
  firebaseSignOut,
  isFirebaseReady
} from '../services/firebaseAuth';

const AuthContext = createContext(null);

// Inactivity threshold: 15 minutes of zero user actions
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

// Record user activity timestamp (throttled)
const recordUserActivity = () => {
  const now = Date.now();
  try {
    const last = parseInt(localStorage.getItem('serveease_last_activity') || '0', 10);
    // Throttle writes to localStorage every 3 seconds
    if (now - last > 3000) {
      localStorage.setItem('serveease_last_activity', String(now));
    }
  } catch {
    // ignore storage access errors
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /**
   * Check current session on application mount or background verification
   */
  const checkAuthStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await authApi.getMe();
      if (data && data.success && data.user) {
        setUser((prev) => {
          if (prev && prev._id === data.user._id && prev.updatedAt === data.user.updatedAt) {
            return prev;
          }
          return data.user;
        });
      } else {
        setUser(null);
      }
    } catch {
      // 401 or network error indicates unauthenticated guest state
      setUser(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /**
   * Logout and terminate current session
   */
  const logout = useCallback(async (reason = null) => {
    try {
      await firebaseSignOut().catch(() => {});
      await authApi.logout();
    } catch (err) {
      console.warn('Logout API request error:', err.message);
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('serveease_last_activity');
      } catch {
        // ignore
      }
      setAuthError(reason || null);
    }
  }, []);

  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // Initial mount authentication check (runs strictly ONCE on mount)
  useEffect(() => {
    checkAuthStatus(false);
  }, [checkAuthStatus]);

  // Synchronize Firebase auth state if available
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && !userRef.current) {
        checkAuthStatus(true);
      }
    });
    return () => unsubscribe();
  }, [checkAuthStatus]);

  // Idle detection and activity tracking listeners
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleUserInteraction = () => {
      recordUserActivity();
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    const handleIdleAndRenewal = () => {
      if (!userRef.current) return;

      let lastActivity = Date.now();
      try {
        const stored = localStorage.getItem('serveease_last_activity');
        if (stored) {
          lastActivity = parseInt(stored, 10);
        }
      } catch {
        // ignore
      }

      const idleTime = Date.now() - lastActivity;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        logoutRef.current('You have been logged out due to 15 minutes of inactivity. Please sign in again.');
      } else if (document.visibilityState === 'visible') {
        checkAuthStatus(true);
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        handleIdleAndRenewal();
      }
    };

    const handleSessionExpired = (e) => {
      setUser(null);
      if (e?.detail?.message) {
        setAuthError(e.detail.message);
      }
    };

    // Check idle status every 15 seconds
    const intervalId = setInterval(handleIdleAndRenewal, 15000);

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, [checkAuthStatus]);

  /**
   * Login with email, password, and optional role
   * Tries Firebase Authentication first if available, with graceful fallback to legacy MongoDB auth
   */
  const login = async (email, password, role) => {
    setAuthError(null);
    try {
      if (isFirebaseReady()) {
        try {
          const { idToken } = await firebaseSignInWithEmail(email, password);
          const data = await authApi.firebaseLogin(idToken, { role });
          if (data && data.success && data.user) {
            setUser(data.user);
            try {
              localStorage.setItem('serveease_last_activity', String(Date.now()));
            } catch {
              // ignore
            }
            return data.user;
          }
        } catch (fbErr) {
          // If Firebase rejects credentials because user was created pre-Firebase in legacy database,
          // fallback to legacy login
          const isUserNotFoundInFirebase =
            fbErr.code === 'auth/user-not-found' ||
            fbErr.code === 'auth/invalid-credential';

          if (!isUserNotFoundInFirebase) {
            throw fbErr;
          }
        }
      }

      // Legacy fallback
      const data = await authApi.login(email, password, role);
      if (!data || !data.success) {
        throw new Error(data?.error || 'Authentication failed. Please verify your credentials.');
      }
      setUser(data.user);
      try {
        localStorage.setItem('serveease_last_activity', String(Date.now()));
      } catch {
        // ignore
      }
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  /**
   * Sign In or Sign Up with Google
   */
  const loginWithGoogle = async (role = 'customer', profileData = {}) => {
    setAuthError(null);
    try {
      if (!isFirebaseReady()) {
        throw new Error('Google Sign-In is not configured. Please check client Firebase environment variables.');
      }
      const { idToken } = await firebaseSignInWithGoogle();
      const data = await authApi.firebaseLogin(idToken, { role, ...profileData });
      if (!data || !data.success || !data.user) {
        throw new Error(data?.error || 'Failed to authenticate with Google.');
      }
      setUser(data.user);
      try {
        localStorage.setItem('serveease_last_activity', String(Date.now()));
      } catch {
        // ignore
      }
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  /**
   * Register a customer or provider account (supports both Firebase and legacy flow)
   */
  const register = async (userData) => {
    setAuthError(null);
    try {
      if (isFirebaseReady() && userData.password) {
        try {
          const { idToken } = await firebaseRegisterWithEmail(userData.email, userData.password);
          const data = await authApi.firebaseLogin(idToken, userData);
          if (data && data.success && data.user) {
            setUser(data.user);
            try {
              localStorage.setItem('serveease_last_activity', String(Date.now()));
            } catch {
              // ignore
            }
            return data;
          }
        } catch (fbErr) {
          // If Firebase creation fails due to existing email or config, surface cleanly
          if (fbErr.code === 'auth/email-already-in-use') {
            throw new Error('An account with this email address already exists. Please sign in instead.');
          }
          throw fbErr;
        }
      }

      // Standard legacy registration
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
    loginWithGoogle,
    register,
    logout,
    updateProfile,
    verifyEmailOtp,
    refreshUser: checkAuthStatus,
    isFirebaseReady: isFirebaseReady()
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
