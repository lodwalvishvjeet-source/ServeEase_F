import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isFirebaseConfigured = false;
let firebaseApp = null;
let firebaseAuth = null;

try {
  // Option A: Individual Environment Variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    // Correctly parse escaped newlines in multiline private key string
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Option B: Service Account JSON File Path
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (projectId && clientEmail && privateKey) {
    firebaseApp = getApps().length === 0
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        })
      : getApps()[0];
    firebaseAuth = getAuth(firebaseApp);
    isFirebaseConfigured = true;
    console.log('🔥 [Firebase Admin] Initialized successfully using environment credentials.');
  } else if (serviceAccountPath) {
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(__dirname, '../../', serviceAccountPath);

    if (fs.existsSync(resolvedPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      firebaseApp = getApps().length === 0
        ? initializeApp({
            credential: cert(serviceAccount)
          })
        : getApps()[0];
      firebaseAuth = getAuth(firebaseApp);
      isFirebaseConfigured = true;
      console.log('🔥 [Firebase Admin] Initialized successfully using service account JSON.');
    } else {
      console.warn(`⚠️ [Firebase Admin] Configured service account file not found at: ${resolvedPath}`);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseApp = getApps().length === 0
      ? initializeApp({
          credential: applicationDefault()
        })
      : getApps()[0];
    firebaseAuth = getAuth(firebaseApp);
    isFirebaseConfigured = true;
    console.log('🔥 [Firebase Admin] Initialized using application default credentials.');
  } else {
    console.log('ℹ️  [Firebase Admin] Service account credentials not provided in server/.env. Firebase token verification in standby.');
  }
} catch (initErr) {
  console.error('❌ [Firebase Admin Initialization Error]:', initErr.message);
  isFirebaseConfigured = false;
}

/**
 * Verifies a Firebase ID token.
 * Returns decoded token or null if invalid / unconfigured.
 */
export const verifyFirebaseIdToken = async (idToken) => {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return {
      isValid: false,
      error: 'Firebase Admin SDK is not configured on this server.'
    };
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken, true);
    return {
      isValid: true,
      decodedToken
    };
  } catch (verifyErr) {
    return {
      isValid: false,
      error: verifyErr.message,
      code: verifyErr.code || 'INVALID_FIREBASE_TOKEN'
    };
  }
};

export { firebaseApp, firebaseAuth, isFirebaseConfigured };
export default firebaseAuth;
