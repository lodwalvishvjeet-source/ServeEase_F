import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../config/firebase';

/**
 * Standardized Firebase Authentication Service
 */

export const isFirebaseReady = () => isFirebaseConfigured && auth !== null;

/**
 * Sign in with Email and Password via Firebase
 */
export const firebaseSignInWithEmail = async (email, password) => {
  if (!isFirebaseReady()) {
    throw new Error('Firebase Authentication is not configured in client/.env.');
  }
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
};

/**
 * Register user with Email and Password via Firebase
 */
export const firebaseRegisterWithEmail = async (email, password) => {
  if (!isFirebaseReady()) {
    throw new Error('Firebase Authentication is not configured in client/.env.');
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Optionally trigger email verification in background
  try {
    await sendEmailVerification(credential.user);
  } catch (verifyErr) {
    console.warn('Could not dispatch Firebase email verification:', verifyErr.message);
  }

  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
};

/**
 * Sign in or Sign up with Google via Firebase Popup
 */
export const firebaseSignInWithGoogle = async () => {
  if (!isFirebaseReady()) {
    throw new Error('Firebase Authentication is not configured in client/.env.');
  }
  const credential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken();
  return { user: credential.user, idToken };
};

/**
 * Send password reset email via Firebase
 */
export const firebaseSendPasswordReset = async (email) => {
  if (!isFirebaseReady()) {
    throw new Error('Firebase Authentication is not configured in client/.env.');
  }
  await sendPasswordResetEmail(auth, email);
};

/**
 * Get current Firebase user ID token
 */
export const getFirebaseIdToken = async (forceRefresh = false) => {
  if (!isFirebaseReady() || !auth.currentUser) {
    return null;
  }
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
};

/**
 * Sign out from Firebase
 */
export const firebaseSignOut = async () => {
  if (isFirebaseReady() && auth.currentUser) {
    await signOut(auth);
  }
};
