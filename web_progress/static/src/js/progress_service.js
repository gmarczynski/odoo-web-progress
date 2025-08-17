/** @odoo-module **/

import {registry} from "@web/core/registry";

const UI_BLOCK_TIMEOUT = 1000; // 1 second before showing UI block

const progressService = {
    dependencies: ["rpc", "bus_service", "orm", "user", "ui"],
    start(env, {rpc, bus_service, orm, user, ui}) {
        // Initialize state
        const state = {
            progressBars: {},
            blockTimeouts: {},
            uiBlocked: false,
            blockUIProgressCode: null,
        };

        const channel = 'web_progress';

        // Monitor RPC requests
        env.bus.addEventListener("RPC:REQUEST", (ev) => {
            const {data, url, settings} = ev.detail;
            const params = data.params;
            if (settings.progress_code &&
                validateCall(url, data.method, params, settings)) {
                env.bus.trigger('web_progress_request', settings.progress_code);
                startProgressTracking(settings.progress_code);
            }
        });

        env.bus.addEventListener("RPC:RESPONSE", (ev) => {
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
            state.blockTimeouts[code] = setTimeout(() => {
                // Only block if we have a progress entry and it's ongoing
                const progressBar = findProgressBar(code);
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
            ui.block({});
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
        function processProgressData(code, state, uid) {
            const sessionUid = user.userId;
            const sessionIsSystem = user.isSystem;
            const progressBar = findProgressBar(code);

            if (sessionUid !== uid && !sessionIsSystem) {
                return;
            }

            if (!progressBar && state === 'ongoing') {
                addProgressBar(code);
            }

            if (progressBar && state === 'done') {
                removeProgressBar(code);
                env.bus.trigger('web_progress_destroy', code);
            }
        }

        /**
         * Handle bus notifications
         */
        function handleNotification(progresses) {
            const progress = progresses[0];
            processProgressData(progress.code, progress.state, progress.uid);
            if (['ongoing', 'done'].indexOf(progress.state) >= 0) {
                env.bus.trigger('web_progress_update', progresses);
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

        // Set up bus handling
        bus_service.addChannel(channel);
        bus_service.subscribe(channel, handleNotification);

        // Initial state update
        queryRecentOperations();

        // Exposed methods and properties
        return {
            bus: env.bus,
            busService: bus_service,
            addProgressBar,
            removeProgressBar,
            findProgressBar,
            getProgressBars,
            processProgressData,
            queryRecentOperations,
            blockUI,
            unblockUI,
            clearProgressTracking,
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