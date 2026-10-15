import React from 'react';
import { Link } from 'react-router-dom';
import { 
   Shield, 
   Lock, 
   Eye, 
   MapPin, 
   MessageSquare, 
   FileText, 
   AlertTriangle, 
   ArrowLeft, 
   CheckCircle2, 
   Database,
   UserCheck
 } from 'lucide-react';

/**
 * Privacy Policy Page (/privacy)
 * 
 * Outlines personal data governance, location privacy, and communication safeguards.
 * Clearly labeled as an academic demonstration draft requiring legal review.
 */
export default function PrivacyPolicy() {
  return (
    <div className="privacy-page section-spacing" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.25rem 5rem' }}>
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          <Shield size={16} /> Privacy & Data Governance
        </div>
        <h1 style={{ fontSize: '2.25rem', color: 'var(--color-text-title)', marginBottom: '0.75rem' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
          Effective Date: October 2026 • Version 1.0 (Academic Demonstration Release)
        </p>
      </div>

      {/* Draft Notice Banner */}
      <div className="alert-box alert-warning" style={{ marginBottom: '2.5rem', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
        <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', fontSize: '1rem', color: '#92400e', marginBottom: '0.25rem' }}>
            Draft Privacy Policy — For Academic Demonstration Only
          </strong>
          <span style={{ fontSize: '0.9rem', color: '#78350f', lineHeight: 1.5 }}>
            This Privacy Policy was prepared for the ServeEase B.Tech Mini-Project. It details how customer and service provider data is processed, isolated, and safeguarded. This document is a draft and requires formal legal counsel review before commercial deployment.
          </span>
        </div>
      </div>

      {/* Content Sections */}
      <div className="privacy-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Section 1 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Database size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              1. Information We Collect
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            ServeEase collects minimal data strictly required to facilitate verified doorstep services:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Account Identity:</strong> Full legal name, verified email address, Indian mobile phone number, and operating municipal city.</li>
            <li><strong>Provider Professional Credentials:</strong> Trade category, experience years, offered service items, starting rates, operating neighborhood, and verification documents.</li>
            <li><strong>Booking & Transaction Records:</strong> Service requests, scheduled date/time, service address, agreed pricing, and completion status.</li>
            <li><strong>Technical Session Data:</strong> Authentication tokens stored in secure HttpOnly cookies, browser agent, and session timestamps.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <MapPin size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              2. Location Data & Geolocation Safeguards
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Location information is treated with strict access boundaries:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Customer Doorstep Location:</strong> Precise residential coordinates provided during booking are revealed ONLY to the specific service professional assigned to that confirmed booking.</li>
            <li><strong>Public Provider Coverage:</strong> On discovery maps, only the provider's general neighborhood/service area is displayed to unauthenticated or browsing users.</li>
            <li><strong>No Continuous Background Tracking:</strong> ServeEase does not track or store continuous background location when the application is idle or closed.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <MessageSquare size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              3. In-App Communication & Messaging Privacy
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Customer-provider communication is protected by role-based authorization:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Direct messages are accessible solely to the conversation participants. Third-party users cannot view or intercept chat transcripts.</li>
            <li>Chat history is retained for booking verification, dispute resolution, and harassment moderation purposes.</li>
            <li>Users can flag inappropriate or abusive messages to platform administrators for investigation.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <UserCheck size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              4. Service Provider Verification & Badge Governance
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Technician verification safeguards platform trust:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Providers cannot self-assign verification badges. All badges require manual administrator verification of trade skills and identification.</li>
            <li>Identity documents submitted for verification are stored in secured storage and accessed only by authorized platform evaluators.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Lock size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              5. Data Security, Retention & User Rights
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Our technical controls follow industry best practices:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Credential Protection:</strong> Passwords are protected using bcrypt salt hashing (factor 12). Plaintext passwords are never logged or stored.</li>
            <li><strong>Transport Security:</strong> All API requests run over encrypted HTTPS channels in production environments.</li>
            <li><strong>User Rights:</strong> You have the right to inspect your stored account details, update your contact details, and request complete account removal.</li>
            <li><strong>No Third-Party Sale:</strong> ServeEase never sells user contact numbers, emails, or booking data to third-party advertisers.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <FileText size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              6. Grievance Officer & Contact
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            For privacy inquiries, data deletion requests, or grievance redressal under Indian Information Technology guidelines:
          </p>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7 }}>
            Academic Project Grievance Desk:<br />
            Email: <strong>privacy@serveease.local</strong> or <strong>support@serveease.local</strong><br />
            Address: Campus Technology Center, Maharashtra, India
          </p>
        </section>
      </div>

      {/* Footer Navigation */}
      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
        <Link to="/terms" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
          ← Read Terms of Service
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/" className="btn btn-outline btn-sm">
            Home
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Return to Registration
          </Link>
        </div>
      </div>
    </div>
  );
}
