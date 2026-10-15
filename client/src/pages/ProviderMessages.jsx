import React from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ChatInterface from '../components/chat/ChatInterface';

/**
 * Provider Messages Page (/provider/messages)
 * Direct real-time messaging hub for consulting with clients.
 */
export default function ProviderMessages() {
  return (
    <DashboardLayout
      title="Client Inquiries & Messages"
      subtitle="Communicate directly with clients regarding appliance issues, diagnostic requirements, and appointment times"
    >
      <div className="provider-messages-content">
        <ChatInterface role="provider" />
      </div>
    </DashboardLayout>
  );
}
