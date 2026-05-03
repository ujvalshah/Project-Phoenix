/**
 * Sentry Error Tracking Configuration
 *
 * Initializes Sentry for backend error tracking
 * Captures uncaught exceptions, unhandled rejections, and Express errors
 */
import * as Sentry from '@sentry/node';
import { httpIntegration, expressIntegration } from '@sentry/node';
import { getEnv } from '../config/envValidation.js';
import { getLogger } from './logger.js';
// Track whether Sentry was successfully initialized
let sentryInitialized = false;
/**
 * Check if Sentry is enabled and initialized
 */
export function isSentryEnabled() {
    return sentryInitialized;
}
/**
 * Initialize Sentry if DSN is provided
 * Must be called after validateEnv() has been executed
 */
export function initSentry() {
    const env = getEnv();
    const dsn = env.SENTRY_DSN;
    let logger = null;
    try {
        logger = getLogger().child({ module: 'sentry' });
    }
    catch {
        logger = null;
    }
    if (!dsn) {
        logger?.warn({ msg: '[Sentry] DSN not provided, error tracking disabled' });
        sentryInitialized = false;
        return;
    }
    // Disable in development unless explicitly enabled
    if (env.NODE_ENV === 'development' && !env.SENTRY_ENABLE_DEV) {
        logger?.info({ msg: '[Sentry] Disabled in development mode' });
        sentryInitialized = false;
        return;
    }
    Sentry.init({
        dsn,
        environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development',
        release: env.SENTRY_RELEASE || undefined,
        tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
        integrations: [
            // Enable HTTP instrumentation
            httpIntegration(),
            // Enable Express integration
            expressIntegration(),
        ],
        beforeSend(event, hint) {
            // Sanitize sensitive data
            if (event.request) {
                if (event.request.headers) {
                    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
                    sensitiveHeaders.forEach((header) => {
                        if (event.request?.headers?.[header]) {
                            event.request.headers[header] = '[REDACTED]';
                        }
                    });
                }
            }
            return event;
        },
    });
    sentryInitialized = true;
    logger?.info({
        msg: '[Sentry] Initialized for error tracking',
        environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'development',
        release: env.SENTRY_RELEASE || 'not-set',
    });
}
/**
 * Capture exception with context
 */
export function captureException(error, context) {
    Sentry.withScope((scope) => {
        if (context?.requestId) {
            scope.setTag('requestId', context.requestId);
        }
        if (context?.route) {
            scope.setTag('route', context.route);
        }
        if (context?.userId) {
            scope.setUser({ id: context.userId });
        }
        if (context?.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }
        Sentry.captureException(error);
    });
}
/**
 * Capture message with context
 */
export function captureMessage(message, level = 'info', context) {
    Sentry.withScope((scope) => {
        if (context?.requestId) {
            scope.setTag('requestId', context.requestId);
        }
        if (context?.route) {
            scope.setTag('route', context.route);
        }
        if (context?.userId) {
            scope.setUser({ id: context.userId });
        }
        if (context?.extra) {
            Object.entries(context.extra).forEach(([key, value]) => {
                scope.setExtra(key, value);
            });
        }
        Sentry.captureMessage(message, level);
    });
}
//# sourceMappingURL=sentry.js.map