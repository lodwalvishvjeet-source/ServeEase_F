import React from 'react';
import { 
  GraduationCap, 
  Code2, 
  Layers, 
  Database, 
  CheckCircle2
} from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';

/**
 * About Page Component
 * Outlines project motivation, architecture design, problem statement,
 * and academic mini-project background for viva and presentation defense.
 */
export default function About() {
  return (
    <div className="about-page section-spacing">
      <div className="container">
        {/* Page Heading */}
        <SectionHeading
          eyebrow="Academic Mini-Project"
          title="About ServeEase Platform"
          subtitle="A modern full-stack MERN application engineered to organize and empower local neighborhood service discovery with trust, speed, and upfront transparency."
        />

        {/* Project Mission Banner */}
        <div className="card" style={{ padding: '2.5rem', marginBottom: '3rem', backgroundColor: '#ffffff' }}>
          <div className="grid-2" style={{ alignItems: 'center', gap: '2.5rem' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>
                Core Objective
              </span>
              <h2 style={{ fontSize: '1.85rem', marginBottom: '1rem' }}>
                Bridging Customers and Local Skilled Professionals
              </h2>
              <p style={{ color: 'var(--color-text-body)', lineHeight: 1.7, marginBottom: '1rem' }}>
                In many tier-1 and tier-2 cities, finding an honest, skilled plumber, electrician, or appliance technician remains an unorganized, word-of-mouth struggle. Customers frequently face arbitrary pricing, delayed responses, and safety uncertainty.
              </p>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                <strong>ServeEase</strong> addresses these challenges by offering a structured platform where local technicians present verified profiles and upfront rate cards, while customers enjoy swift discovery and transparent bookings.
              </p>
            </div>

            <div style={{ backgroundColor: 'var(--color-bg-page)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary-700)' }}>
                Key Project Principles
              </h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.92rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Accessible to Everyone:</strong> Clean, high-contrast UI usable on all devices.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Zero Hidden Charges:</strong> Transparent base visit and hourly rates.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Two-Sided Marketplace:</strong> Equal dignity and tools for both customers and tradespeople.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Modular Architecture:</strong> Engineered with structured React components ready for API integration.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Technical Architecture Overview (Viva Ready) */}
        <div style={{ marginBottom: '3.5rem' }}>
          <SectionHeading
            eyebrow="System Design"
            title="Full-Stack MERN Architecture"
            subtitle="Engineered following clean architecture, separation of concerns, and robust security practices."
          />

          <div className="grid-4">
            <div className="card">
              <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Code2 size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>React 19 & Vite</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Fast SPA client utilizing modern declarative components, client-side routing via React Router DOM, and responsive Vanilla CSS.
              </p>
            </div>

            <div className="card">
              <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: '#f0fdf4', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Layers size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Node.js & Express</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Modular RESTful backend API handling authentication, controller routes, validation middleware, and business logic.
              </p>
            </div>

            <div className="card">
              <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fefce8', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Database size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>MongoDB & Mongoose</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Production NoSQL document models for multi-role Users, Service Categories, verified Bookings, and customer Reviews.
              </p>
            </div>

            <div className="card">
              <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)', backgroundColor: '#faf5ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <GraduationCap size={24} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Full Stack Architecture</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                Modular architecture connecting a responsive React SPA with an Express REST API, JWT authentication, and MongoDB Atlas.
              </p>
            </div>
          </div>
        </div>

        {/* Academic Project Credits */}
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <span className="badge badge-prototype" style={{ marginBottom: '0.5rem' }}>
            3rd Year Computer Science Mini-Project
          </span>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>ServeEase Engineering Summary</h2>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto 1.5rem auto', fontSize: '0.95rem' }}>
            Built systematically with clean code practices, clear separation of mock data from views, and complete keyboard & mobile accessibility.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button to="/services" variant="primary">
              Test Services Catalog
            </Button>
            <Button to="/contact" variant="outline">
              Project Inquiries
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
