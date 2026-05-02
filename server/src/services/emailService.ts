/**
 * Email service for verification, password reset, etc.
 * Uses Resend when RESEND_API_KEY is set; otherwise no-op (logs warning).
 */

import { Resend } from 'resend';
import { getLogger } from '../utils/logger.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Nuggets <onboarding@resend.dev>';

let resendClient: Resend | null = null;
if (RESEND_API_KEY) {
  resendClient = new Resend(RESEND_API_KEY);
}
let missingResendWarningLogged = false;

function logMissingResendOnce(reason: string): void {
  if (missingResendWarningLogged) return;
  if (process.env.NODE_ENV !== 'development' || RESEND_API_KEY) return;
  missingResendWarningLogged = true;
  getLogger().warn({ reason }, '[emailService] RESEND_API_KEY not set; email delivery disabled');
}

/**
 * Send a verification email with a link to verify the user's email.
 * No-op if RESEND_API_KEY is not set (logs once at first call).
 */
export async function sendVerificationEmail(to: string, verificationUrl: string): Promise<void> {
  if (!resendClient) {
    logMissingResendOnce('verification_email');
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
/**
 * Send an email to an existing user when someone tries to sign up with their email.
 * Prevents email enumeration by making the signup response identical for new and existing emails.
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendAccountExistsEmail(to: string, loginUrl: string): Promise<void> {
  if (!resendClient) {
    logMissingResendOnce('account_exists_email');
    return;
  }

  await resendClient.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: 'Sign-in attempt for your Nuggets account',
    html: `
      <p>Someone tried to create a new account using this email address.</p>
      <p>If this was you, you already have an account. You can sign in here:</p>
      <p><a href="${loginUrl}" style="color:#0ea5e9;text-decoration:underline;">Sign in to Nuggets</a></p>
      <p>If you didn't request this, you can safely ignore this email. Your account is secure.</p>
      <p>— The Nuggets team</p>
    `,
  });
}

/**
 * Notify the *old* email address that the account email was changed. Gives
 * the rightful owner a chance to react if the change was unauthorized
 * (the new address gets the verification email; the old address gets this).
 * No-op if RESEND_API_KEY is not set.
 */
export async function sendEmailChangedNoticeEmail(to: string, params: {
  newEmail: string;
  supportUrl?: string;
}): Promise<void> {
  if (!resendClient) {
    logMissingResendOnce('email_changed_notice');
    return;
  }

  const supportLine = params.supportUrl
    ? `<p>If you didn't make this change, please <a href="${params.supportUrl}" style="color:#0ea5e9;text-decoration:underline;">contact support</a> immediately.</p>`
    : `<p>If you didn't make this change, please contact support immediately.</p>`;

  await resendClient.emails.send({
    from: EMAIL_FROM,
    to: [to],
    subject: 'Your Nuggets account email was changed',
    html: `
      <p>The email address on your Nuggets account was just changed to <strong>${params.newEmail}</strong>.</p>
      <p>If this was you, no further action is needed.</p>
      ${supportLine}
      <p>— The Nuggets team</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!resendClient) {
    logMissingResendOnce('password_reset_email');
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
