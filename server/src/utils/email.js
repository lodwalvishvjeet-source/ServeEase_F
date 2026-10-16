import nodemailer from 'nodemailer';

// Create a reusable transporter using environment variables if present
let transporter = null;
if (process.env.EMAIL_HOST) {
  // If the host indicates Gmail, use the built‑in Gmail service which handles OAuth/APP‑passwords correctly
  if (process.env.EMAIL_HOST.includes('gmail.com')) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
}

// Verify transporter configuration on startup for easier debugging
if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error.message);
    } else {
      console.log('✅ Email transporter verified – ready to send emails');
    }
  });
}

// Verify transporter configuration on startup for easier debugging
if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email transporter verification failed:', error.message);
    } else {
      console.log('✅ Email transporter verified – ready to send emails');
    }
  });
}

/**
 * Send an email. If email configuration is missing, this becomes a no‑op to avoid crashing the server during local development.
 * @param {Object} options - Email options.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject.
 * @param {string} [options.text] - Plain text body.
 * @param {string} [options.html] - HTML body.
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    console.warn('Email configuration missing – logging email to console for development.');
    console.log('[DEV EMAIL]', { to, subject, text, html });
    return;
  }
  const mailOptions = {
    from: `"ServeEase" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };
  await transporter.sendMail(mailOptions);
};
