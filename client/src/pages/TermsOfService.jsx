import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, ArrowLeft, Users, Calendar, MessageSquare, MapPin, Award, Lock } from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';

/**
 * Terms of Service Page (/terms)
 * 
 * Provides clear contractual, operational, and ethical guidelines for ServeEase users:
 * - Accounts, verification & credentials
 * - Service appointments & booking cancellations
 * - Customer & technician communications
 * - Location sharing & privacy safeguards
 * - Professional quality standards & fair pricing
 * 
 * NOTE: Clearly labeled as a draft agreement created for academic project demonstration.
 */
export default function TermsOfService() {
  return (
    <div className="terms-page section-spacing" style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.25rem 5rem' }}>
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)', fontWeight: 600, fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-600)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          <FileText size={16} /> Legal & Platform Governance
        </div>
        <h1 style={{ fontSize: '2.25rem', color: 'var(--color-text-title)', marginBottom: '0.75rem' }}>
          Terms of Service
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
          Effective Date: October 2026 • Version 1.0 (Academic Demonstration Release)
        </p>
      </div>

      {/* Legal Draft Notice Banner */}
      <div className="alert-box alert-warning" style={{ marginBottom: '2.5rem', padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
        <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ display: 'block', fontSize: '1rem', color: '#92400e', marginBottom: '0.25rem' }}>
            Draft Policy Notice — For Academic Evaluation Only
          </strong>
          <span style={{ fontSize: '0.9rem', color: '#78350f', lineHeight: 1.5 }}>
            This Terms of Service document is an academic demonstration policy developed for the ServeEase B.Tech Mini-Project. It outlines the operational contract, user commitments, and dispute policies for the platform. This draft requires formal legal review before commercial enterprise deployment.
          </span>
        </div>
      </div>

      {/* Content Sections */}
      <div className="terms-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Section 1 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Users size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              1. User Accounts, Eligibility & Security
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            ServeEase connects service seekers ("Customers") with local trade professionals ("Service Providers") across supported municipal regions in India (Sangli, Mumbai, Pune, Nagpur, Chhatrapati Sambhajinagar).
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>You must be at least 18 years old to create an account or request service appointments.</li>
            <li>Users must provide accurate, verifiable identity information (full legal name, active Indian mobile number, and valid email).</li>
            <li>You are responsible for maintaining the confidentiality of your authentication credentials. ServeEase will never ask for your password via phone, email, or chat.</li>
            <li>Platform administrators reserve the right to suspend or terminate accounts found engaging in fraudulent bookings, abusive communication, or identity falsification.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Calendar size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              2. Service Bookings, Pricing & Cancellations
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Our booking workflow governs scheduled appointments and transparent pricing:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Upfront Rates & Inspection Quotes:</strong> Starting rates displayed on provider profiles represent initial diagnostic and minor repair charges. Additional material costs or extensive labor must be quoted and agreed upon prior to job execution.</li>
            <li><strong>Status Transitions:</strong> A service appointment begins in a <code>pending</code> state, transitions to <code>accepted</code> upon provider confirmation, and concludes as <code>completed</code> when on-site work is verified.</li>
            <li><strong>Cancellation Policy:</strong> Customers and providers may cancel appointments during <code>pending</code> and <code>accepted</code> states. Repeated last-minute cancellations without valid reasons may lead to account scheduling restrictions. Completed jobs cannot be cancelled.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Award size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              3. Service Provider Verification & Quality Standards
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            Technicians operating on ServeEase commit to professional, safe, and courteous service:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Providers undergo verification checks before receiving verified badges. Falsifying trade licenses or experience years is strictly grounds for suspension.</li>
            <li>Providers operate as independent contractors and must exercise reasonable care, technical safety, and compliance with local municipal codes.</li>
            <li>Customers have the right to inspect technician credentials upon doorstep arrival.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <MapPin size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              4. Location Sharing & Map Geolocation
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            ServeEase incorporates interactive map coordinates to coordinate neighborhood dispatching:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Customer doorstep coordinates are shared exclusively with the technician explicitly assigned to that booking request.</li>
            <li>Unrelated public visitors can view approximate provider service areas but never exact private residence markers of other users.</li>
            <li>Coordinates are retained solely for appointment transit routing and are governed by our Privacy Policy.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <MessageSquare size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              5. Communications, Reviews & Code of Conduct
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            All platform interactions must remain civil and respectful:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>In-app chat is provided to coordinate logistics, timing, and job scope. Harassment, threats, or hate speech are strictly prohibited.</li>
            <li>Reviews can only be submitted by verified customers who booked and completed an appointment with that provider. Fabricated or incentivized reviews are removed by moderators.</li>
            <li>Users may report inappropriate reviews, messages, or provider behavior through the integrated moderation reporting system.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <Lock size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              6. Personal Data Handling, Privacy & Retention
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            ServeEase prioritizes responsible user data governance across our digital infrastructure:
          </p>
          <ul style={{ paddingLeft: '1.5rem', color: 'var(--color-text-body)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>We collect only necessary personal data: full name, active Indian mobile number, email, and municipal city to facilitate verified appointments.</li>
            <li>Passwords are hashed using salted cryptographic algorithms (bcrypt) and are never stored in plaintext.</li>
            <li>Authentication sessions utilize secure HttpOnly tokens to mitigate cross-site script vulnerabilities.</li>
            <li>Users may request account deletion or data anonymization by contacting our grievance desk.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
            <ShieldCheck size={22} />
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              7. Limitation of Liability, Grievances & Contact
            </h2>
          </div>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
            ServeEase acts as a smart matching platform. While we enforce strict provider verification and moderation, ServeEase is not directly liable for unforeseen property damages resulting from on-site service delivery beyond our dispute resolution assistance.
          </p>
          <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7 }}>
            For questions or grievance redressal regarding these Terms, contact our academic project team at <strong>legal@serveease.local</strong> or <strong>support@serveease.local</strong>.
          </p>
        </section>
      </div>

      {/* Footer Navigation */}
      <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
        <Link to="/privacy" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
          Read Privacy Policy →
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
