import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';
import PhaseNoticeModal from '../components/common/PhaseNoticeModal';

/**
 * Contact Page Component
 * Direct support inquiry form and expandable FAQ section
 */
export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Question',
    message: ''
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(0);

  const faqs = [
    {
      q: "What is ServeEase and what problem does it solve?",
      a: "ServeEase is a college mini-project designed to solve the problem of unorganized local service hiring. It provides a transparent marketplace where customers find vetted professionals (electricians, plumbers, mechanics) with upfront rates."
    },
    {
      q: "How will technician verification work?",
      a: "Technicians submit government-issued identification (such as Aadhaar or trade certificates) during registration. Platform administrators review submitted documents through the admin verification dashboard before granting verified status."
    },
    {
      q: "What is the technical architecture of ServeEase?",
      a: "ServeEase uses the MERN stack: React 19 for the frontend single-page application (SPA), Node.js and Express for the REST API backend, and MongoDB with Mongoose for document persistence."
    },
    {
      q: "How does ServeEase ensure service quality and security?",
      a: "ServeEase features verified provider profiles, phone validation, transparent rate cards, secure role-based access, and genuine customer feedback."
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert("Please complete all required fields.");
      return;
    }
    setModalOpen(true);
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? -1 : index);
  };

  return (
    <div className="contact-page section-spacing">
      <div className="container">
        <SectionHeading
          eyebrow="Get In Touch"
          title="Contact & Platform Support"
          subtitle="Have questions about the project, suggestions for features, or experiencing any issue? Reach out to our student development team."
        />

        <div className="grid-2" style={{ gap: '3rem', marginBottom: '4rem', alignItems: 'flex-start' }}>
          {/* Left Column: Contact Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.4rem' }}>Send Us a Message</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Fill in your details below and we will get back to you shortly.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-name">
                  Your Full Name <span className="required">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ananya Sen"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-email">
                  Email Address <span className="required">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className="form-input"
                  placeholder="ananya@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-subject">
                  Inquiry Category
                </label>
                <select
                  id="contact-subject"
                  className="form-select"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                >
                  <option value="General Question">General Question</option>
                  <option value="Provider Onboarding">Provider Onboarding Question</option>
                  <option value="Feedback / Bug Report">Feedback / Bug Report</option>
                  <option value="Academic Evaluation">Academic Evaluation Inquiry</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-message">
                  Your Message <span className="required">*</span>
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  className="form-textarea"
                  placeholder="Type your question or remarks here..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" variant="primary" size="lg" block>
                <Send size={16} /> Submit Message
              </Button>
            </form>
          </div>

          {/* Right Column: Contact Details & Campus Info */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Email Support</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-title)' }}>support@serveease.local</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Help Desk Line</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-title)' }}>+91 98765 43210 (Mon-Sat, 9am - 7pm)</div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-50)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={22} />
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Department & Location</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-title)' }}>Department of Computer Science & Engineering</div>
                </div>
              </div>
            </div>

            {/* Support Guarantee */}
            <div className="card" style={{ backgroundColor: 'var(--primary-50)', borderColor: 'var(--primary-100)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary-800)', fontWeight: 700 }}>
                <CheckCircle2 size={18} />
                <span>Student Project Evaluation Standard</span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--primary-900)', lineHeight: 1.6, margin: 0 }}>
                ServeEase is maintained according to software engineering guidelines: clean repository layout, clear component decomposition, and zero hardcoded secrets.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <SectionHeading
            eyebrow="Common Questions"
            title="Frequently Asked Questions"
            subtitle="Quick answers to common questions about the platform and technical choices."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {faqs.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div key={index} className="card" style={{ padding: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'var(--color-text-title)'
                    }}
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {isOpen && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.92rem', color: 'var(--color-text-body)', lineHeight: 1.6 }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <PhaseNoticeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Message Sent"
        featureName="Contact Form"
        description="Thank you for reaching out! Your message has been received and our team will get in touch with you shortly."
      />
    </div>
  );
}
