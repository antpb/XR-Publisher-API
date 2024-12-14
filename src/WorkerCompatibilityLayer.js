// Cloudflare Worker Compatibility Layer
class WorkerCompatibilityLayer {
    static init() {
        // Stub missing request properties
        if (!Request.prototype.hasOwnProperty('referrerPolicy')) {
            Object.defineProperty(Request.prototype, 'referrerPolicy', {
                get() {
                    return 'strict-origin-when-cross-origin'; // Default value
                },
                set() { /* No-op */ },
                configurable: true
            });
        }

        // Add missing RequestInit properties
        const originalRequest = global.Request;
        global.Request = function(...args) {
            // Remove referrerPolicy from options if present
            if (args[1] && args[1].referrerPolicy) {
                const [input, init = {}] = args;
                const { referrerPolicy, ...cleanInit } = init;
                args[1] = cleanInit;
            }
            return new originalRequest(...args);
        };
        global.Request.prototype = originalRequest.prototype;

        // Patch fetch to clean up unsupported options
        const originalFetch = global.fetch;
        global.fetch = function(...args) {
            if (args[1] && args[1].referrerPolicy) {
                const [input, init = {}] = args;
                const { referrerPolicy, ...cleanInit } = init;
                return originalFetch(input, cleanInit);
            }
            return originalFetch(...args);
        };
    }

    static cleanRequestInit(init) {
        if (!init) return init;
        
        const {
            referrerPolicy,
            ...cleanInit
        } = init;

        return cleanInit;
    }
}

// Export a helper function to wrap initialization
export function initializeWorkerCompat() {
    WorkerCompatibilityLayer.init();
}