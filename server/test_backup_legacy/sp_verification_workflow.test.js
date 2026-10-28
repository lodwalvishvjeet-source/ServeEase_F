import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import AuditLog from '../src/models/AuditLog.js';
import VerificationDocument from '../src/models/VerificationDocument.js';

let mongoServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
  await mongoose.connect(uri);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  await User.deleteMany({});
  await Booking.deleteMany({});
  await Notification.deleteMany({});
  await AuditLog.deleteMany({});
  await VerificationDocument.deleteMany({});
});

// Helper: Register standard customer
const registerCustomer = async (customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `customer.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Customer Test',
    email,
    password: 'Password123',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '+91 9822100001'
  });
  if (res.body?.user) {
    await User.findByIdAndUpdate(res.body.user._id, { emailVerified: true });
    res.body.user.emailVerified = true;
  }
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Register standard provider
const registerProvider = async (customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `provider.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Technician Test',
    email,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '+91 9822100002',
    providerDetails: {
      category: 'Plumbing Services',
      title: 'Certified Plumber',
      servicesOffered: ['Pipe Leakage', 'Tap Fitting'],
      serviceArea: 'Vishrambag',
      startingPrice: 350,
      hourlyRate: 400
    }
  });
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Create admin account
const createAndLoginAdmin = async (customEmail = 'admin@serveease.com') => {
  const passwordHash = await User.hashPassword('AdminPass123!');
  const admin = await User.create({
    name: 'Admin Reviewer',
    email: customEmail,
    passwordHash,
    role: 'admin',
    city: 'sangli',
    status: 'active'
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email: customEmail,
    password: 'AdminPass123!'
  });

  return { token: loginRes.body.token, user: admin, res: loginRes };
};

// Sample valid buffers
const sampleSmallPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF'
);

const sampleJpegBuffer = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
  0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xD9
]);

const samplePngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
  0x44, 0xAE, 0x42, 0x60, 0x82
]);

// ============================================================================
// 1. SP Registration without verification documents
// ============================================================================
test('1. SP registration initializes account with isVerified: false and verificationStatus: pending without documents', async () => {
  const { res, user } = await registerProvider('new.provider@example.com');
  assert.equal(res.status, 201);
  assert.equal(user.role, 'provider');
  assert.equal(user.providerDetails.isVerified, false, 'Newly registered SP must not be verified');
  assert.equal(user.providerDetails.verificationStatus, 'pending', 'Status must be pending');

  // Verify database record
  const dbUser = await User.findById(user._id);
  assert.equal(dbUser.providerDetails.isVerified, false);
  assert.equal(dbUser.providerDetails.verificationStatus, 'pending');
  assert.equal(dbUser.providerDetails.verifiedAt, null);
  assert.equal(dbUser.providerDetails.verifiedBy, null);

  // No documents created yet
  const docs = await VerificationDocument.find({ provider: user._id });
  assert.equal(docs.length, 0);
});

// ============================================================================
// 2. Successful valid document upload (GridFS storage and metadata)
// ============================================================================
test('2. Successful document upload stores content in GridFS and records metadata', async () => {
  const { token: providerToken, user: provider } = await registerProvider();

  const res = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'license.pdf');

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.document);
  assert.equal(res.body.document.documentType, 'trade_license');
  assert.equal(res.body.document.mimeType, 'application/pdf');
  assert.equal(res.body.document.status, 'pending');
  assert.equal(res.body.document.gridFsFileId, undefined, 'GridFS ID must not be exposed');

  // Verify metadata record in MongoDB
  const docInDb = await VerificationDocument.findOne({ provider: provider._id });
  assert.ok(docInDb);
  assert.equal(docInDb.originalFilename, 'license.pdf');
  assert.equal(docInDb.fileSize, sampleSmallPdfBuffer.length);
  assert.ok(docInDb.gridFsFileId);

  // Provider details updated with submission timestamp
  const updatedProvider = await User.findById(provider._id);
  assert.ok(updatedProvider.providerDetails.submittedAt);
  assert.equal(updatedProvider.providerDetails.verificationDocuments.length, 1);
});

// ============================================================================
// 3. Small valid documents (< 50 KB) are NOT rejected solely for being small
// ============================================================================
test('3. Small valid documents (< 50 KB) are accepted without arbitrary minimum size limit', async () => {
  const { token: providerToken } = await registerProvider();

  // sampleSmallPdfBuffer is ~80 bytes (well below 50 KB)
  assert.ok(sampleSmallPdfBuffer.length < 50 * 1024);

  const res = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'certification')
    .attach('document', sampleSmallPdfBuffer, 'small_valid_cert.pdf');

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
});

// ============================================================================
// 4. Rejection of unsupported file types and spoofed extensions
// ============================================================================
test('4. Rejects unsupported formats and files with spoofed extensions', async () => {
  const { token: providerToken } = await registerProvider();

  // Case A: Disallowed extension (.txt)
  const textBuffer = Buffer.from('Plain text file content');
  const resTxt = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .attach('document', textBuffer, 'notes.txt');

  assert.equal(resTxt.status, 400);
  assert.equal(resTxt.body.success, false);
  assert.ok(resTxt.body.error.includes('Unsupported file extension'));

  // Case B: Disallowed content claiming to be PDF (magic bytes mismatch)
  const fakePdfBuffer = Buffer.from('<html><body>Fake PDF with HTML content</body></html>');
  const resFake = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .attach('document', fakePdfBuffer, 'fake.pdf');

  assert.equal(resFake.status, 400);
  assert.equal(resFake.body.success, false);
  assert.ok(resFake.body.error.includes('Invalid file format') || resFake.body.error.includes('signature'));
});

// ============================================================================
// 5. Rejection of files larger than 5 MB
// ============================================================================
test('5. Rejects files larger than 5 MB', async () => {
  const { token: providerToken } = await registerProvider();

  // Create oversized buffer (5 MB + 1 KB) starting with PDF magic bytes
  const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024);
  oversizedBuffer.write('%PDF-1.4');

  const res = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .attach('document', oversizedBuffer, 'huge.pdf');

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(
    res.body.error.includes('exceeds') || res.body.error.includes('5 MB') || res.body.error.includes('limit')
  );
});

// ============================================================================
// 6. Uploading a document does NOT auto-approve the SP
// ============================================================================
test('6. Uploading a document leaves provider unverified until admin approval', async () => {
  const { token: providerToken, user: provider } = await registerProvider();

  await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleJpegBuffer, 'trade_id.jpg');

  // Verify provider remains unverified
  const checkProvider = await User.findById(provider._id);
  assert.equal(checkProvider.providerDetails.isVerified, false, 'SP must NOT be auto-approved on upload');
  assert.equal(checkProvider.providerDetails.verificationStatus, 'pending');

  // Audit log must NOT contain an approval entry
  const audit = await AuditLog.findOne({ targetId: provider._id });
  assert.equal(audit, null, 'No approval audit log must exist before admin decision');
});

// ============================================================================
// 7. Admin approval blocked when no qualifying document exists
// ============================================================================
test('7. Admin approval is strictly blocked when provider has no uploaded documents', async () => {
  const { token: adminToken } = await createAndLoginAdmin();
  const { user: provider } = await registerProvider();

  const res = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: true,
      notes: 'Attempting to approve without documents'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('at least one uploaded and valid verification document'));

  // Record must remain unverified
  const dbProv = await User.findById(provider._id);
  assert.equal(dbProv.providerDetails.isVerified, false);
});

// ============================================================================
// 8. Authorized admin approval persists decision and audit metadata
// ============================================================================
test('8. Authorized admin approval persists approval metadata and updates document review status', async () => {
  const { token: adminToken, user: admin } = await createAndLoginAdmin();
  const { token: providerToken, user: provider } = await registerProvider();

  // Upload document
  const uploadRes = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', samplePngBuffer, 'license.png');
  assert.equal(uploadRes.status, 201);
  const docId = uploadRes.body.document._id;

  // Admin approves
  const approveRes = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: true,
      notes: 'Aadhaar ID and Government Trade License verified.'
    });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.success, true);
  assert.equal(approveRes.body.provider.providerDetails.isVerified, true);

  // Check persisted Mongoose fields
  const updatedProv = await User.findById(provider._id);
  assert.equal(updatedProv.providerDetails.isVerified, true);
  assert.equal(updatedProv.providerDetails.verificationStatus, 'approved');
  assert.ok(updatedProv.providerDetails.verifiedAt);
  assert.equal(updatedProv.providerDetails.verifiedBy.toString(), admin._id.toString());
  assert.equal(updatedProv.providerDetails.verificationNotes, 'Aadhaar ID and Government Trade License verified.');

  // Check document status was updated to approved
  const updatedDoc = await VerificationDocument.findById(docId);
  assert.equal(updatedDoc.status, 'approved');
  assert.equal(updatedDoc.reviewedBy.toString(), admin._id.toString());

  // Check audit log
  const audit = await AuditLog.findOne({
    targetId: provider._id,
    action: 'provider_verified'
  });
  assert.ok(audit);
  assert.equal(audit.admin.toString(), admin._id.toString());
  assert.equal(audit.reason, 'Aadhaar ID and Government Trade License verified.');
});

// ============================================================================
// 9. Authorized admin rejection persists rejection reason and audit metadata
// ============================================================================
test('9. Authorized admin rejection persists rejection reason and notes', async () => {
  const { token: adminToken, user: admin } = await createAndLoginAdmin();
  const { token: providerToken, user: provider } = await registerProvider();

  // Upload document
  await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'unclear_scan.pdf');

  // Admin rejects
  const rejectRes = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: false,
      notes: 'Document scan is blurry and trade registration number is unreadable.'
    });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.success, true);
  assert.equal(rejectRes.body.provider.providerDetails.isVerified, false);

  // Check persisted Mongoose fields
  const updatedProv = await User.findById(provider._id);
  assert.equal(updatedProv.providerDetails.isVerified, false);
  assert.equal(updatedProv.providerDetails.verificationStatus, 'rejected');
  assert.equal(
    updatedProv.providerDetails.rejectionReason,
    'Document scan is blurry and trade registration number is unreadable.'
  );

  // Check audit log
  const audit = await AuditLog.findOne({
    targetId: provider._id,
    action: 'provider_rejected'
  });
  assert.ok(audit);
  assert.equal(audit.admin.toString(), admin._id.toString());
  assert.equal(audit.reason, 'Document scan is blurry and trade registration number is unreadable.');
});

// ============================================================================
// 10. Unauthorized users cannot review applications or retrieve private documents
// ============================================================================
test('10. Unauthorized users cannot review applications or access document endpoints', async () => {
  const { token: customerToken } = await registerCustomer();
  const { token: providerToken, user: provider } = await registerProvider();

  // Provider uploads a document
  const uploadRes = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'license.pdf');
  const docId = uploadRes.body.document._id;

  // Customer cannot access admin review queue
  const resCustQueue = await request(app)
    .get('/api/admin/providers')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(resCustQueue.status, 403);

  // Customer cannot access admin provider documents
  const resCustDocs = await request(app)
    .get(`/api/admin/providers/${provider._id}/documents`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(resCustDocs.status, 403);

  // Customer cannot verify provider
  const resCustVerify = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ isVerified: true });
  assert.equal(resCustVerify.status, 403);

  // Unauthenticated user cannot download document
  const resNoAuth = await request(app).get(`/api/admin/documents/${docId}`);
  assert.equal(resNoAuth.status, 401);

  // Customer cannot download document directly
  const resCustDownload = await request(app)
    .get(`/api/providers/documents/${docId}`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(resCustDownload.status, 403);
});

// ============================================================================
// 11. Cross-provider isolation: SP cannot access or replace other SP's documents
// ============================================================================
test('11. SPs cannot access or delete documents belonging to another provider', async () => {
  const { token: prov1Token } = await registerProvider('prov1@example.com');
  const { token: prov2Token } = await registerProvider('prov2@example.com');

  // Prov 1 uploads document
  const uploadRes = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${prov1Token}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'prov1_id.pdf');
  const docId = uploadRes.body.document._id;

  // Prov 2 attempts to download Prov 1's document -> 403
  const resDownload = await request(app)
    .get(`/api/providers/documents/${docId}`)
    .set('Authorization', `Bearer ${prov2Token}`);
  assert.equal(resDownload.status, 403);

  // Prov 2 attempts to delete Prov 1's document -> 403
  const resDelete = await request(app)
    .delete(`/api/providers/documents/${docId}`)
    .set('Authorization', `Bearer ${prov2Token}`);
  assert.equal(resDelete.status, 403);
});

// ============================================================================
// 12. Discovery, booking creation, and acceptance enforcement
// ============================================================================
test('12. Unverified SP excluded from discovery and blocked from booking; approved SP works seamlessly', async () => {
  const { token: adminToken } = await createAndLoginAdmin();
  const { token: customerToken, user: customer } = await registerCustomer();
  const { token: providerToken, user: provider } = await registerProvider('active.tech@example.com');

  // 1. Discovery Check: Unverified provider must not appear in search results
  const searchUnverified = await request(app).get('/api/providers?city=sangli');
  assert.equal(searchUnverified.status, 200);
  const foundUnverified = searchUnverified.body.providers.find(
    (p) => p._id.toString() === provider._id.toString()
  );
  assert.equal(foundUnverified, undefined, 'Unverified provider must be excluded from discovery');

  // 2. Booking Creation Check: Customer attempting to book unverified provider is rejected
  const bookUnverified = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Pipe Leakage',
      city: 'sangli',
      serviceAddress: 'Flat 101, Sangli Heights',
      bookingDate: '2026-10-30',
      bookingTime: '10:00 AM - 11:00 AM'
    });
  assert.equal(bookUnverified.status, 400);
  assert.equal(bookUnverified.body.success, false);
  assert.ok(bookUnverified.body.error.includes('not yet verified') || bookUnverified.body.error.includes('verification'));

  // 3. Provider uploads document and admin approves
  await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'license.pdf');

  const approveRes = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ isVerified: true, notes: 'Approved after document review' });
  assert.equal(approveRes.status, 200);

  // 4. Discovery Check: Now approved provider appears in search results
  const searchApproved = await request(app).get('/api/providers?city=sangli');
  assert.equal(searchApproved.status, 200);
  const foundApproved = searchApproved.body.providers.find(
    (p) => p._id.toString() === provider._id.toString()
  );
  assert.ok(foundApproved, 'Approved provider must now appear in discovery');
  assert.equal(foundApproved.isVerified, true);

  // 5. Booking Creation Check: Now customer can successfully book approved provider
  const bookApproved = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Pipe Leakage',
      city: 'sangli',
      serviceAddress: 'Flat 101, Sangli Heights',
      bookingDate: '2026-10-30',
      bookingTime: '10:00 AM - 11:00 AM',
      description: 'Kitchen sink pipe leaking heavily'
    });
  assert.equal(bookApproved.status, 201);
  assert.equal(bookApproved.body.success, true);
  const bookingId = bookApproved.body.booking._id;

  // 6. Provider Acceptance Check: Approved provider can accept booking
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.booking.status, 'accepted');
});

// ============================================================================
// 13. Admin Document Preview: ID propagation & Bearer null/cookie auth resilience
// ============================================================================
test('13. Admin document retrieval verifies document ID presence, resolves GridFS, and handles auth headers securely', async () => {
  const { token: adminToken, res: adminLoginRes } = await createAndLoginAdmin();
  const { token: providerToken, user: provider } = await registerProvider('preview.tech@example.com');

  // 1. Provider uploads a verification document
  const uploadRes = await request(app)
    .post('/api/providers/documents')
    .set('Authorization', `Bearer ${providerToken}`)
    .field('documentType', 'trade_license')
    .attach('document', sampleSmallPdfBuffer, 'Assignment_No_8.pdf');
  assert.equal(uploadRes.status, 201);
  const uploadedDoc = uploadRes.body.document;
  assert.ok(uploadedDoc._id, 'Document must have _id');
  assert.ok(uploadedDoc.id, 'Document must have id');
  assert.equal(uploadedDoc.id, uploadedDoc._id.toString());

  // 2. Admin retrieves provider documents via /api/admin/providers/:id/documents
  const adminDocsRes = await request(app)
    .get(`/api/admin/providers/${provider._id}/documents`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminDocsRes.status, 200);
  assert.equal(adminDocsRes.body.count, 1);
  const docMetadata = adminDocsRes.body.documents[0];
  assert.ok(docMetadata._id, 'Admin metadata must have _id');
  assert.ok(docMetadata.id, 'Admin metadata must have id');
  assert.equal(docMetadata.id, docMetadata._id.toString());
  assert.equal(docMetadata.originalFilename, 'Assignment_No_8.pdf');

  // 3. Admin provider list endpoint also populates document IDs
  const adminProvidersRes = await request(app)
    .get(`/api/admin/providers?q=preview.tech`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminProvidersRes.status, 200);
  const foundProv = adminProvidersRes.body.providers[0];
  assert.ok(foundProv.documents.length >= 1);
  assert.ok(foundProv.documents[0]._id, 'Provider list document must have _id');
  assert.ok(foundProv.documents[0].id, 'Provider list document must have id');

  // 4. Missing document ID produces 400 Bad Request
  const undefinedRes = await request(app)
    .get('/api/admin/documents/undefined')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(undefinedRes.status, 400);
  assert.equal(undefinedRes.body.success, false);
  assert.equal(undefinedRes.body.error, 'Invalid document identifier.');

  // 5. Admin fetches document with Bearer token header -> 200 OK & binary stream
  const docContentBearer = await request(app)
    .get(`/api/admin/documents/${docMetadata.id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(docContentBearer.status, 200);
  assert.equal(docContentBearer.headers['content-type'], 'application/pdf');
  assert.ok(docContentBearer.body.length > 0);

  // 6. Admin fetches document with HttpOnly cookie -> 200 OK
  const adminCookie = adminLoginRes.headers['set-cookie'];
  assert.ok(adminCookie, 'Admin login must set HttpOnly cookie');
  const docContentCookie = await request(app)
    .get(`/api/admin/documents/${docMetadata.id}`)
    .set('Cookie', adminCookie);
  assert.equal(docContentCookie.status, 200);
  assert.equal(docContentCookie.headers['content-type'], 'application/pdf');

  // 7. Request with valid cookie + "Authorization: Bearer null" ignores 'null' and uses cookie -> 200 OK
  const docContentFallback = await request(app)
    .get(`/api/admin/documents/${docMetadata.id}`)
    .set('Cookie', adminCookie)
    .set('Authorization', 'Bearer null');
  assert.equal(docContentFallback.status, 200);

  // 8. Request with only "Authorization: Bearer null" and NO cookie -> 401 Unauthorized
  const docContentNoAuth = await request(app)
    .get(`/api/admin/documents/${docMetadata.id}`)
    .set('Authorization', 'Bearer null');
  assert.equal(docContentNoAuth.status, 401);
});

