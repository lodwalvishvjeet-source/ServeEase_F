# ServeEase: Firebase Authentication Integration Audit & Architecture Specification

**Project:** ServeEase — Smart Local Service Booking Platform  
**Document:** Technical Audit, Security Specification & Implementation Plan  
**Date:** October 26, 2026  
**Status:** Pending Approval (Pre-Implementation Audit)

---

## 1. Executive Summary

This document presents a comprehensive technical audit of the current authentication, data modeling, middleware, and protected routing architecture of ServeEase, along with the precise, minimal-footprint design for integrating **Firebase Authentication** (Email/Password and Google Sign-In).

### Core Architectural Invariants:
1. **Preserve MongoDB / Mongoose:** MongoDB Atlas remains the sole database of record for all entities (Users, Bookings, Services, Reviews, Conversations, Messages, Notifications). **No data will be migrated to Cloud Firestore.**
2. **Preserve ObjectIds & Relational Integrity:** Existing MongoDB `_id` (`ObjectId`) references and relational foreign keys (`ref: 'User'`) across Bookings, Reviews, Conversations, Messages, and Verification Documents remain 100% intact.
3. **Preserve Role Architecture:** Customer, Provider, and Administrator roles with their respective permission guards, dashboard flows, and onboarding rules remain strictly enforced.
4. **Credential Security:** Firebase service-account private credentials will **never** be exposed in client bundles or committed to source control; verification is handled exclusively server-side via the Firebase Admin SDK.
5. **Dual-Mode / Backward-Compatible Verification:** The backend will support Firebase ID Token verification while preserving compatibility for existing integration tests (`server/test/*.test.js`) and administrative bootstrap scripts.

---

## 2. Current State Audit

### 2.1 Existing Authentication Implementation
* **Password Hashing:** Salted and hashed using `bcryptjs` with cost factor 12 in `server/src/models/User.js`.
* **Session Management:** Stateless JSON Web Tokens (`jsonwebtoken`).
  * **Access Token:** Short-lived (default: 15 minutes) containing `{ userId, role }`, delivered via HttpOnly `token` cookie and `Authorization: Bearer <token>` header.
  * **Refresh Token:** Long-lived (default: 1 day) containing `{ userId, role, type: 'refresh' }`, delivered via HttpOnly `refreshToken` cookie.
  * **Session Refresh Endpoint:** `POST /api/auth/refresh` checks idle inactivity (15-minute client threshold) and issues renewed tokens.
* **Email Verification Flow:**
  * When a customer or provider registers, they are **not** immediately created in the `User` collection.
  * Credentials and metadata are stored in a temporary MongoDB collection (`PendingRegistration`) with a 15-minute TTL.
  * A 6-digit cryptographic OTP is generated and sent via Nodemailer.
  * Only upon successful submission to `POST /api/auth/verify-email-otp` is the permanent `User` record created in MongoDB.
* **Password Recovery Flow:**
  * `POST /api/auth/forgot-password` generates a 6-digit OTP stored on the user document (`resetPasswordOtp`).
  * `POST /api/auth/verify-otp` verifies the OTP and returns a single-use `resetPasswordToken`.
  * `POST /api/auth/reset-password` updates `passwordHash` and invalidates the reset token.
* **WebSocket Authentication:**
  * `server/src/socket/index.js` hooks into the Socket.IO handshake (`io.use`) and verifies the JWT against `getJwtSecret()`, loading `User.findById(userId)`.

### 2.2 User Model & Schemas (`server/src/models/User.js`)
* **Primary Key:** `_id` (`mongoose.Schema.Types.ObjectId`).
* **Attributes:**
  * `name`: String (2–100 chars, required).
  * `email`: String (normalized lowercase, unique, indexed, required).
  * `passwordHash`: String (bcrypt hash, `select: false`, currently required).
  * `role`: String (`'customer' | 'provider' | 'admin'`, default: `'customer'`).
  * `status`: String (`'active' | 'suspended'`, default: `'active'`).
  * `phoneNumber`: String (10-digit Indian mobile format).
  * `city`: String (canonical identifier: `sangli`, `mumbai`, `pune`, `nagpur`, `chhatrapati-sambhajinagar`).
  * `emailVerified`: Boolean (default: `false`).
  * `providerDetails`: Sub-document containing `category`, `categorySlug`, `servicesOffered`, `experienceYears`, `city`, `serviceArea`, `hourlyRate`, `isAvailable`, `isVerified`, `verificationStatus`, geo-coordinates (`location.latitude`, `location.longitude`), etc.
* **Relational Foreign Key Map:**
  * **`Booking.js`:** `customer` (`ref: 'User'`), `provider` (`ref: 'User'`).
  * **`Review.js`:** `customer` (`ref: 'User'`), `provider` (`ref: 'User'`), `booking` (`ref: 'Booking'`).
  * **`Conversation.js`:** `participants` (`[ref: 'User']`), `lastMessage.sender` (`ref: 'User'`).
  * **`Message.js`:** `sender` (`ref: 'User'`), `recipient` (`ref: 'User'`).
  * **`Notification.js`:** `recipient` (`ref: 'User'`), `actor` (`ref: 'User'`).
  * **`VerificationDocument.js`:** `provider` (`ref: 'User'`), `reviewedBy` (`ref: 'User'`).
  * **`AuditLog.js`:** `actor` (`ref: 'User'`).

### 2.3 Roles & Permissions Architecture
* **`customer`:** Service seeker. Can browse catalogs, create bookings, manage personal bookings, submit reviews, participate in chats, and receive real-time notifications.
* **`provider`:** Verified tradesperson or technician. Can manage offered service items, accept/reject booking requests, track booking arrival OTPs, update location coordinates, and upload identity verification documents.
* **`admin`:** System operator. Bootstrap-only via CLI (`npm run bootstrap:admin`). Has platform analytics oversight, provider verification controls, review moderation, and account suspension authority.
* **Role Mismatch Enforcement:** The login endpoint checks `role` against authentic MongoDB records and rejects mismatched logins (e.g., customer attempting provider login) with HTTP 403.

### 2.4 Middleware Pipeline
* **`authenticate` (`server/src/middleware/authenticate.js`):**
  1. Inspects `req.cookies.token` or `Authorization: Bearer <token>`.
  2. Verifies token signature and validity.
  3. Queries MongoDB `User.findById(decoded.userId)`.
  4. Enforces account status check (`user.status !== 'suspended'`).
  5. Attaches active user document to `req.user`.
* **`authorizeRole` (`server/src/middleware/authorizeRole.js`):**
  * Evaluates `allowedRoles.includes(req.user.role)`.
  * Returns HTTP 403 if unauthorized.
* **Rate Limiters (`server/src/middleware/rateLimiter.js`):**
  * `authLimiter`: 10 requests per 15 minutes.
  * `otpLimiter`: 5 requests per 15 minutes.
  * `adminLimiter`: 100 requests per 15 minutes.

### 2.5 Protected Routes Matrix

| Scope | Method & Route | Middleware Protection |
| :--- | :--- | :--- |
| **Profile** | `GET /api/users/me`, `PATCH /api/users/me` | `authenticate` |
| **Provider** | `GET, PATCH /api/providers/me` | `authenticate`, `authorizeRole('provider')` |
| **Provider** | `GET, POST, PUT, DELETE /api/providers/my-services` | `authenticate`, `authorizeRole('provider')` |
| **Provider** | `POST /api/providers/documents` | `authenticate`, `authorizeRole('provider')`, `upload` |
| **Bookings** | `POST /api/bookings` | `authenticate`, `authorizeRole('customer')` |
| **Bookings** | `GET /api/bookings/my` | `authenticate`, `authorizeRole('customer')` |
| **Bookings** | `GET /api/bookings/provider` | `authenticate`, `authorizeRole('provider')` |
| **Bookings** | `PATCH /api/bookings/:id/{accept,reject,start,complete}` | `authenticate`, `authorizeRole('provider')` |
| **Bookings** | `PATCH /api/bookings/:id/cancel` | `authenticate` (Customer or assigned Provider) |
| **Reviews** | `POST /api/reviews` | `authenticate`, `authorizeRole('customer')` |
| **Reviews** | `GET /api/reviews/my` | `authenticate`, `authorizeRole('customer')` |
| **Chat** | `GET, POST /api/conversations` | `authenticate` |
| **Chat** | `GET, POST /api/conversations/:id/messages` | `authenticate` |
| **Notifications** | `GET /api/notifications`, `PATCH /:id/read` | `authenticate` |
| **Admin** | `ALL /api/admin/*` | `adminLimiter`, `authenticate`, `authorizeRole('admin')` |

### 2.6 Frontend Protected Routes (`client/src/App.jsx`)
Guarded by `<ProtectedRoute allowedRoles={[...]}>`:
* **Customer:** `/customer/dashboard`, `/customer/bookings`, `/customer/messages`, `/customer/notifications`, `/customer/profile`, `/customer/map`.
* **Provider:** `/provider/dashboard`, `/provider/services`, `/provider/requests`, `/provider/bookings`, `/provider/messages`, `/provider/notifications`, `/provider/profile`, `/provider/map`.
* **Admin:** `/admin/dashboard`.

---

## 3. Firebase Authentication Integration Strategy

```
┌────────────────────────────────────────────────────────┐
│                      React Client                      │
│                                                        │
│   Firebase Web SDK               ServeEase AuthContext │
│   (Email/Pass & Google Auth)     (Manages MongoDB User)│
│               │                                │       │
└───────────────┼────────────────────────────────┼───────┘
                │ Firebase ID Token              │
                ▼                                ▼
┌────────────────────────────────────────────────────────┐
│                   Express API Server                   │
│                                                        │
│   authenticate Middleware                              │
│   1. admin.auth().verifyIdToken(idToken)               │
│   2. User.findOne({ firebaseUid }) || by email         │
│   3. req.user = mongoUser  (Preserves _id, role, etc.) │
│                                                        │
│   Existing Controllers & Services                      │
│   (Bookings, Reviews, Chat, Admin — ZERO API CHANGES)  │
└───────────────────────────────────┬────────────────────┘
                                    │ Mongoose
                                    ▼
┌────────────────────────────────────────────────────────┐
│                     MongoDB Atlas                      │
│                                                        │
│   User Schema:                                         │
│   • _id (ObjectId) - UNCHANGED                         │
│   • firebaseUid (String, indexed, sparse) - NEW        │
│   • role: 'customer' | 'provider' | 'admin' - UNCHANGED│
│   • Bookings, Reviews, Messages, Docs - UNCHANGED      │
└────────────────────────────────────────────────────────┘
```

### 3.1 The Identity Bridging Mechanism
1. **User Sign-In / Registration:**
   * Handled on the client via the Firebase Web SDK (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, or `signInWithPopup(auth, googleProvider)`).
   * Upon successful authentication, Firebase issues an RS256-signed **Firebase ID Token**.
2. **Backend Authentication & Synchronization:**
   * The client transmits the Firebase ID Token in the `Authorization: Bearer <idToken>` header.
   * Express middleware verifies the token using `admin.auth().verifyIdToken(idToken)`.
   * **Lookup Strategy:**
     * Query MongoDB for `firebaseUid: decodedToken.uid`.
     * If not found by `firebaseUid`, query by `email: decodedToken.email.toLowerCase()`.
     * If found by email, attach `user.firebaseUid = decodedToken.uid` and save (automatic account linking).
     * If user does not exist in MongoDB (first-time Google Sign-In or new registration):
       * A lightweight synchronization endpoint (`POST /api/auth/firebase-sync`) creates the MongoDB user record using the Firebase identity details plus required profile attributes (`role`, `city`, `phoneNumber`, `providerDetails`).
3. **Preservation of `req.user`:**
   * The MongoDB document is attached directly to `req.user`.
   * Every downstream controller accessing `req.user._id`, `req.user.role`, `req.user.city`, etc., continues operating without modifications.

---

## 4. Minimal Required Changes

### 4.1 Backend (`server/`)

1. **Dependency:** Install `firebase-admin` in `server/package.json`.
2. **Environment Configuration (`server/.env` & `server/.env.example`):**
   * Support individual environment variables:
     * `FIREBASE_PROJECT_ID`
     * `FIREBASE_CLIENT_EMAIL`
     * `FIREBASE_PRIVATE_KEY` (properly handling escaped `\n`)
   * OR support `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json`.
   * Add service account patterns to `.gitignore`: `*serviceAccount*.json`, `*firebase-adminsdk*.json`.
3. **Firebase Admin Module (`server/src/config/firebase.js`):**
   * Initialize Firebase Admin app singleton with conditional credential resolution.
4. **User Model Update (`server/src/models/User.js`):**
   * Add `firebaseUid: { type: String, unique: true, sparse: true, index: true }`.
   * Relax `passwordHash` requirement (`required: false`) to allow Google Sign-In users without local passwords.
5. **Authentication Middleware (`server/src/middleware/authenticate.js`):**
   * Intercept Bearer tokens. If a token is a Firebase ID Token, verify using `admin.auth().verifyIdToken()`, locate the MongoDB user, and populate `req.user`.
   * Keep fallback for legacy JWTs so internal integration tests continue running smoothly.
6. **Controller & Route Updates (`authController.js` & `authRoutes.js`):**
   * Add `POST /api/auth/firebase-sync`: Accepts profile payload (`role`, `city`, `phoneNumber`, `providerDetails`) alongside verified Firebase ID Token, provisions or links the MongoDB user, and returns the full safe user object.
   * Ensure `GET /api/auth/me` responds cleanly with the active MongoDB user profile.
7. **WebSocket Security (`server/src/socket/index.js`):**
   * Allow `io.use()` to authenticate incoming connections using Firebase ID Tokens in handshake auth.

### 4.2 Frontend (`client/`)

1. **Dependency:** Install `firebase` in `client/package.json`.
2. **Environment Configuration (`client/.env` & `client/.env.example`):**
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```
3. **Firebase Client Module (`client/src/config/firebase.js`):**
   * Initialize Firebase App and export `auth` and `googleProvider`.
4. **Firebase Auth Service (`client/src/services/firebaseAuth.js`):**
   * Export standardized wrappers: `signInWithEmail`, `registerWithEmail`, `signInWithGoogle`, `sendPasswordResetEmail`, and `getIdToken`.
5. **API Client (`client/src/services/api.js`):**
   * Automatically append `Authorization: Bearer <idToken>` on outgoing HTTP requests when a Firebase session is active.
6. **Auth Context (`client/src/context/AuthContext.jsx`):**
   * Listen to Firebase `onAuthStateChanged()`.
   * When authenticated in Firebase, fetch/synchronize the MongoDB profile via `/api/auth/me` or `/api/auth/firebase-sync`.
   * Set `user` state to the returned MongoDB user object (retaining `_id`, `role`, `city`, `providerDetails`).
7. **Pages:**
   * **`Login.jsx`:** Add "Sign in with Google" button; delegate Email/Password submission to Firebase Auth.
   * **`Register.jsx`:** Add "Sign up with Google" button; submit profile fields (`role`, `city`, `phoneNumber`, `providerDetails`) to `/api/auth/firebase-sync`.
   * **`ForgotPassword.jsx`:** Leverage Firebase `sendPasswordResetEmail` for password resets.
8. **Socket Client (`client/src/services/socket.js`):**
   * Pass the current Firebase ID token in `socket.auth = { token: idToken }`.

---

## 5. Security & Credential Protection Checklist

- [x] **No Service Account In Bundle:** Service account private key is strictly isolated to backend environment variables.
- [x] **Git Protection:** `.gitignore` includes all JSON credential patterns (`*serviceAccount*.json`, `*firebase*.json`).
- [x] **Public Web Configuration:** Frontend environment variables (`VITE_FIREBASE_*`) only contain public identifiers intended for web distribution.
- [x] **Token Verification:** Server-side token verification cryptographically validates signatures, issuers, audiences, and expiration timestamps.
- [x] **Role Tampering Guard:** Registration of administrative accounts via Google or public registration remains strictly forbidden; admin roles must still be provisioned via backend bootstrap.

---

## 6. Implementation Readiness & Approval

No files have been modified yet. Awaiting user approval to proceed with:
1. Installing dependencies (`firebase-admin` on server, `firebase` on client).
2. Implementing the backend Firebase configuration, User schema updates, and token verification.
3. Implementing the frontend Firebase configuration, AuthContext synchronization, and UI buttons.
4. Verifying end-to-end functionality across Customer, Provider, and Admin roles.
