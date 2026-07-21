import { Resend } from 'resend';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';

let resend = null;

function getClient() {
  if (!resend && config.resend.apiKey) {
    resend = new Resend(config.resend.apiKey);
  }
  return resend;
}

export async function sendEmail({ to, subject, html }) {
  const client = getClient();
  if (!client) {
    logger.warn('Resend not configured — skipping email', { to, subject });
    return;
  }

  try {
    const result = await client.emails.send({
      from: config.resend.from,
      to,
      subject,
      html,
    });
    logger.info('Email sent', { to, subject, id: result.id });
    return result;
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    throw err;
  }
}

export function buildVerificationEmail(link) {
  return {
    subject: 'Verify your Lumora account',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Welcome to Lumora</h2>
        <p>Click the button below to verify your email address.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 14px;">Or paste this link: ${link}</p>
        <p style="color: #666; font-size: 14px;">This link expires in 24 hours.</p>
      </div>
    `,
  };
}

export function buildPasswordResetEmail(link) {
  return {
    subject: 'Reset your Lumora password',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 14px;">Or paste this link: ${link}</p>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  };
}
