/**
 * Email service for verification, password reset, etc.
 * Uses Resend when RESEND_API_KEY is set; otherwise no-op (logs warning).
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Nuggets <onboarding@resend.dev>';

let resendClient: Resend | null = null;
if (RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY);
}

/**
 * Send a verification email with a link to verify the user's email.
 * No-op if RESEND_API_KEY is not set (logs once at first call).
 */
export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  if (!resendClient) {
    // Avoid spamming logs; only log at debug or when env suggests email was intended
    if (process.env.NODE_ENV === 'development' && !RESEND_API_KEY) {
      // eslint-disable-next-line no-console
      console.warn('[emailService] RESEND_API_KEY not set; skipping verification email. Set it to enable email verification.');
    }
    return;
  }

  await resendClient.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: 'Verify your email – Nuggets',
    html: `
      <p>Thanks for signing up for Nuggets.</p>
      <p>Please verify your email by clicking the link below:</p>
      <p><a href="${verificationUrl}" style="color:#0ea5e9;text-decoration:underline;">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      <p>— The Nuggets team</p>
    `,
  });
}

/**
 * Send a password reset email with a link to reset the user's password.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resendClient) {
    if (process.env.NODE_ENV === 'development' && !RESEND_API_KEY) {
      // eslint-disable-next-line no-console
      console.warn('[emailService] RESEND_API_KEY not set; skipping password reset email.');
    }
    return;
  }

  await resendClient.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: 'Reset your password – Nuggets',
    html: `
      <p>You requested to reset your password for your Nuggets account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="color:#0ea5e9;text-decoration:underline;">Reset my password</a></p>
      <p><strong>This link expires in 1 hour.</strong></p>
      <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
      <p>— The Nuggets team</p>
    `,
  });
}
