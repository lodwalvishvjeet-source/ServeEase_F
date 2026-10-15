import React from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ChatInterface from '../components/chat/ChatInterface';

/**
 * Customer Messages Page (/customer/messages)
 * Direct real-time messaging hub for consulting with service providers.
 */
export default function CustomerMessages() {
  return (
    <DashboardLayout
      title="Direct Technician Messages"
      subtitle="Consult with booked service specialists regarding job scope, estimated arrival times, and diagnostic details"
    >
      <div className="customer-messages-content">
        <ChatInterface role="customer" />
      </div>
    </DashboardLayout>
  );
}
