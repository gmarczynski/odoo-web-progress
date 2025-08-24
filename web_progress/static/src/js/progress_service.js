/** @odoo-module **/

import {registry} from "@web/core/registry";
import { rpc, rpcBus } from "@web/core/network/rpc";
import { user } from "@web/core/user";

const UI_BLOCK_TIMEOUT = 1000; // 1 second before showing UI block

const progressService = {
    dependencies: ["bus_service", "orm", "ui"],
    start(env, {bus_service, orm, ui}) {
        const REFRESH_PERIOD = 5000; // 5 seconds
        const CACHE_TIMEOUT = REFRESH_PERIOD * 2; // 10 seconds - twice the refresh period
        const BUS_TIMEOUT = REFRESH_PERIOD * 2; // 10 seconds - detect bus failure

        // Initialize state
        const state = {
            progressBars: {},
            blockTimeouts: {},
            uiBlocked: false,
            blockUIProgressCode: null,
            progressCache: {}, // Cache for progress data
            lastBusUpdate: {}, // Track last bus update per progress code
            busFailureDetected: false,
            pollingInterval: null,
            queryRecentInterval: null, // Regular querying for recent operations
            hasReceivedBusData: false, // Track if we ever received bus data
        };

        const channel = 'web_progress';

        // Monitor RPC requests
        rpcBus.addEventListener("RPC:REQUEST", (ev) => {
            const {data, url, settings} = ev.detail;
            const params = data.params;
            if (settings.progress_code &&
                validateCall(url, data.method, params, settings)) {
                env.bus.trigger('web_progress_request', settings.progress_code);
                startProgressTracking(settings.progress_code);
            }
        });

        rpcBus.addEventListener("RPC:RESPONSE", (ev) => {
            const {data, error, settings} = ev.detail;
            if (settings.progress_code) {
                env.bus.trigger('web_progress_response', settings.progress_code);
                clearProgressTracking(settings.progress_code);
            }
        });

        /**
         * Start tracking a progress code for potential UI blocking
         */
        function startProgressTracking(code) {
            // Clear any existing timeout
            if (state.blockTimeouts[code]) {
                clearTimeout(state.blockTimeouts[code]);
            }

            // Set a new timeout for UI blocking
            state.blockTimeouts[code] = setTimeout(async () => {
                // Only block if we have a progress entry and it's ongoing
                let progressBar = findProgressBar(code);

                // If no progress bar found and we haven't received bus data,
                // query recent operations to make sure we have latest data
                if (!progressBar && !state.hasReceivedBusData) {
                    await queryRecentOperations();
                    // Check again after querying
                    progressBar = findProgressBar(code);
                }

                if (progressBar) {
                    blockUI(code);
                }
                delete state.blockTimeouts[code];
            }, UI_BLOCK_TIMEOUT);
        }

        /**
         * Clear progress tracking timeout for a specific code
         */
        function clearProgressTracking(code) {
            if (state.blockTimeouts[code]) {
                clearTimeout(state.blockTimeouts[code]);
                delete state.blockTimeouts[code];
            }
        }

        /**
         * Block the UI and show progress for a specific code
         */
        function blockUI(progressCode) {
            if (state.uiBlocked) {
                return;
            }

            state.uiBlocked = true;
            state.blockUIProgressCode = progressCode;

            // Use Odoo's UI blocking with progress
            ui.block({progressCode: progressCode});
        }

        /**
         * Unblock the UI if it was blocked
         */
        function unblockUI() {
            if (!state.uiBlocked) {
                return;
            }

            state.uiBlocked = false;
            const progressCode = state.blockUIProgressCode;
            state.blockUIProgressCode = null;

            // Call Odoo's UI unblocking mechanism
            ui.unblock();

            // Clear any related timeouts
            if (progressCode && state.blockTimeouts[progressCode]) {
                clearTimeout(state.blockTimeouts[progressCode]);
                delete state.blockTimeouts[progressCode];
            }
        }


        /**
         * Add progress bar
         */
        function addProgressBar(code) {
            if (state.progressBars[code]) {
                return state.progressBars[code];
            }

            // Create a new progress bar state entry
            state.progressBars[code] = {
                code: code,
                visible: true,
            };

            // Notify about progress bar creation
            env.bus.trigger('web_progress_set_code', code);
            return state.progressBars[code];
        }

        /**
         * Remove progress bar
         */
        function removeProgressBar(code) {
            if (state.progressBars[code]) {
                delete state.progressBars[code];
                env.bus.trigger('web_progress_destroy', code);
            }

            // If this was the code blocking the UI, unblock it
            if (state.blockUIProgressCode === code) {
                unblockUI();
            }

            // Clear any timeouts related to this code
            if (state.blockTimeouts[code]) {
                clearTimeout(state.blockTimeouts[code]);
                delete state.blockTimeouts[code];
            }
        }

        /**
         * Find progress bar
         */
        function findProgressBar(code) {
            return state.progressBars[code] || false;
        }

        /**
         * Get all progress bars
         */
        function getProgressBars() {
            return state.progressBars;
        }

        /**
         * Process and display progress details
         */
        function processProgressData(code, progressState, uid) {
            const sessionUid = user.userId;
            const sessionIsSystem = user.isSystem;
            const progressBar = findProgressBar(code);

            if (sessionUid !== uid && !sessionIsSystem) {
                return;
            }

            if (!progressBar && progressState === 'ongoing') {
                addProgressBar(code);
            }

            if (progressBar && (progressState === 'done' || progressState === 'cancel')) {
                removeProgressBar(code);
            }
        }

        /**
         * Handle bus notifications
         */
        function handleNotification(progresses) {
            const progress = progresses[0];

            // Update last bus update timestamp for this progress code
            const now = Date.now();
            state.lastBusUpdate[progress.code] = now;

            // Reset bus failure detection since we received an update
            state.busFailureDetected = false;

            // Cache the progress data from bus notification with current timestamp
            state.progressCache[progress.code] = {
                data: progresses,
                timestamp: now
            };

            // Process the progress data
            processProgressData(progress.code, progress.state, progress.uid);

            // Trigger progress updates if state is relevant
            if (['ongoing', 'done', 'cancel'].indexOf(progress.state) >= 0) {
                env.bus.trigger('web_progress_update', progresses);
            }

            // Mark that we have received bus data
            state.hasReceivedBusData = true;

            // Stop regular querying since we now have bus data
            stopRegularQuerying();
        }

        /**
         * Start regular querying for recent operations
         */
        function startRegularQuerying() {
            if (state.queryRecentInterval) {
                return; // Already running
            }

            state.queryRecentInterval = setInterval(async () => {
                // Check if we should continue querying
                const hasCachedData = Object.keys(state.progressCache).length > 0;

                // Only query if:
                // 1. No bus data received yet, AND
                // 2. No cached data (no active progress)
                // Do NOT query if longpolling failed but we have cached data - RPC polling handles that
                if (!state.hasReceivedBusData && !hasCachedData) {
                    await queryRecentOperations();
                } else if (state.hasReceivedBusData || hasCachedData) {
                    // We have bus data OR cached data, stop regular querying
                    stopRegularQuerying();
                }
            }, CACHE_TIMEOUT); // Every 10 seconds (twice the refresh period)
        }

        /**
         * Stop regular querying for recent operations
         */
        function stopRegularQuerying() {
            if (state.queryRecentInterval) {
                clearInterval(state.queryRecentInterval);
                state.queryRecentInterval = null;
            }
        }

        /**
         * Query server for recent operations in progress
         */
        async function queryRecentOperations() {
            try {
                const codesList = await orm.call(
                    'web.progress',
                    'get_all_progress',
                    [],
                    {}
                );

                if (codesList.length > 0) {
                    codesList.forEach(item => {
                        if (item.code) {
                            const pb = addProgressBar(item.code);
                            if (pb) {
                                env.bus.trigger('web_progress_refresh', item.code);
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error querying recent operations:', error);
            }
        }

        /**
         * Get cached progress data or fetch from server if cache is expired
         */
        async function getProgressData(progressCode) {
            if (!progressCode) {
                return null;
            }

            const now = Date.now();
            const cached = state.progressCache[progressCode];

            // Check if we have valid cached data
            if (cached && (now - cached.timestamp) < CACHE_TIMEOUT) {
                return cached.data;
            }

            // Fetch fresh data from server
            try {
                const resultList = await orm.call(
                    'web.progress',
                    'get_progress_rpc',
                    [progressCode],
                    {}
                );

                // Cache the result
                state.progressCache[progressCode] = {
                    data: resultList,
                    timestamp: now
                };

                return resultList;
            } catch (error) {
                console.error('Error fetching progress data:', error);
                return null;
            }
        }

        /**
         * Clear cache for a specific progress code
         */
        function clearProgressCache(progressCode) {
            if (state.progressCache[progressCode]) {
                delete state.progressCache[progressCode];
            }
        }

        /**
         * Clear all expired cache entries
         */
        function cleanupCache() {
            const now = Date.now();
            Object.keys(state.progressCache).forEach(code => {
                const cached = state.progressCache[code];
                if (now - cached.timestamp >= CACHE_TIMEOUT) {
                    delete state.progressCache[code];
                }
            });
        }

        /**
         * Check if bus is working and start RPC polling if needed
         */
        function checkBusHealth() {
            const now = Date.now();
            const activeProgressCodes = Object.keys(state.progressBars);

            if (activeProgressCodes.length === 0) {
                // No active progress bars, stop polling if running
                stopRPCPolling();
                return;
            }

            // Check if any active progress hasn't received bus updates in BUS_TIMEOUT
            let busFailureDetected = false;
            activeProgressCodes.forEach(code => {
                const lastUpdate = state.lastBusUpdate[code];
                if (!lastUpdate || (now - lastUpdate) > BUS_TIMEOUT) {
                    busFailureDetected = true;
                }
            });

            if (busFailureDetected && !state.busFailureDetected) {
                console.warn('Progress bus notifications timeout detected, switching to RPC polling');
                state.busFailureDetected = true;
                startRPCPolling();
            } else if (!busFailureDetected && state.busFailureDetected) {
                console.log('Progress bus notifications restored, stopping RPC polling');
                state.busFailureDetected = false;
                stopRPCPolling();
            }
        }

        /**
         * Start RPC polling for all active progress bars
         */
        function startRPCPolling() {
            if (state.pollingInterval) {
                return; // Already polling
            }

            state.pollingInterval = setInterval(async () => {
                // Query for recent operations before each polling cycle
                await queryRecentOperations();

                const activeProgressCodes = Object.keys(state.progressBars);

                for (const code of activeProgressCodes) {
                    try {
                        // Force refresh by clearing cache and fetching fresh data
                        clearProgressCache(code);
                        const resultList = await getProgressData(code);

                        if (resultList && resultList.length > 0) {
                            const result = resultList[0];
                            if (['ongoing', 'done', 'cancel'].indexOf(result.state) >= 0) {
                                // Simulate bus notification by triggering the same events
                                env.bus.trigger('web_progress_update', resultList);

                                // Handle completion and cancellation
                                if (result.state === 'done' || result.state === 'cancel') {
                                    removeProgressBar(code);
                                }
                            }
                        } else {
                            // No data returned - progress might have been cancelled or completed
                            // Remove it from our tracking
                            removeProgressBar(code);
                        }
                    } catch (error) {
                        console.error(`Error polling progress ${code}:`, error);
                        // On error, also consider removing the progress bar
                        // as it might indicate the progress no longer exists
                        removeProgressBar(code);
                    }
                }
            }, REFRESH_PERIOD);
        }

        /**
         * Stop RPC polling
         */
        function stopRPCPolling() {
            if (state.pollingInterval) {
                clearInterval(state.pollingInterval);
                state.pollingInterval = null;
            }
        }

        // Clean up cache periodically
        setInterval(cleanupCache, CACHE_TIMEOUT);

        // Monitor bus health periodically
        setInterval(checkBusHealth, BUS_TIMEOUT);

        // Set up bus handling
        bus_service.addChannel(channel);
        bus_service.subscribe(channel, handleNotification);

        // Initialize cache and start regular querying
        queryRecentOperations(); // Initial call at service startup
        startRegularQuerying(); // Start regular polling until bus data is received

        /**
         * Cancel a progress operation
         */
        async function cancelProgress(progressCode) {
            if (!progressCode) {
                return false;
            }

            try {
                await rpc("/web/progress/cancel", {
                    progress_code: progressCode,
                });
                return true;
            } catch (error) {
                console.error('Error canceling progress:', error);
                return false;
            }
        }

        // Exposed methods and properties
        return {
            bus: env.bus,
            busService: bus_service,
            addProgressBar,
            removeProgressBar,
            findProgressBar,
            getProgressBars,
            processProgressData,
            blockUI,
            unblockUI,
            clearProgressTracking,
            getProgressData,
            clearProgressCache,
            cancelProgress,
            getProgressBarCount() {
                return Object.keys(state.progressBars).length;
            },
            getProgressBarCodes() {
                return Object.keys(state.progressBars);
            },
            isUIBlocked() {
                return state.uiBlocked;
            }
        };
    },
};

function validateCall(url, method, params, settings) {
    if (settings && settings.silent) {
        // do not track if silent
        return false;
    }
    return url.startsWith('/web/') && method === 'call' && params.model !== 'web.progress';
}

registry.category("services").add("progressService", progressService);

// register the same dialog for CancelledProgress as there is for UserError
registry.category("error_dialogs")
    .add("odoo.addons.web_progress.models.web_progress.CancelledProgress",
        registry.category("error_dialogs").get("odoo.exceptions.UserError"));
