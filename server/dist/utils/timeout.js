/**
 * Centralized Timeout Utility
 *
 * Provides a clean way to handle timeouts with proper cleanup.
 * Prevents race conditions and ensures timeouts are always cleared.
 */
/**
 * Execute a promise with a timeout
 * Returns null if timeout is exceeded
 */
export async function withTimeout(promise, timeoutMs, signal) {
    if (timeoutMs <= 0) {
        return promise.catch(() => null);
    }
    let timeoutId = null;
    let isCleared = false;
    const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
            if (!isCleared) {
                isCleared = true;
                resolve(null);
            }
        }, timeoutMs);
    });
    const cleanup = () => {
        if (timeoutId && !isCleared) {
            clearTimeout(timeoutId);
            isCleared = true;
        }
    };
    // If external signal is provided, listen to it
    if (signal) {
        signal.addEventListener('abort', cleanup);
    }
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        cleanup();
        if (signal) {
            signal.removeEventListener('abort', cleanup);
        }
        return result;
    }
    catch (error) {
        cleanup();
        if (signal) {
            signal.removeEventListener('abort', cleanup);
        }
        // If it's an abort error, return null (timeout)
        if (error?.name === 'AbortError') {
            return null;
        }
        // Re-throw other errors
        throw error;
    }
}
/**
 * Create an AbortController with automatic timeout
 */
export function createTimeoutController(timeoutMs) {
    const controller = new AbortController();
    let timeoutId = null;
    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
    }
    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };
    return { controller, cleanup };
}
//# sourceMappingURL=timeout.js.map