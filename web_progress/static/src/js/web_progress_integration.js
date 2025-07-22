/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { ProgressBar } from "./progress_bar";

/**
 * Service to handle web progress integration with Odoo's blocking UI
 */
// export const webProgressService = {
//     start(env, { bus, rpc, ui }) {
//         let progressBars = [];
//         let blockUITimeout = false;
//
//         // Store original blockUI function
//         const originalBlockUI = ui.block;
//         const originalUnblockUI = ui.unblock;
//
//         function addProgressBarToBlockedUI(progressCode = false) {
//             removeProgressBarFromBlockedUI();
//
//             // Find the blocking UI container
//             let $el = document.querySelector('.o_progress_blockui');
//             if (!$el) {
//                 $el = document.querySelector(".oe_blockui_spin_container");
//                 if (!$el) {
//                     $el = document.querySelector(".o_import_progress_dialog");
//                     if (!$el) {
//                         // Wait for the state propagation
//                         blockUITimeout = setTimeout(() => {
//                             addProgressBarToBlockedUI(progressCode);
//                         }, 100);
//                         return;
//                     }
//                 }
//             }
//             blockUITimeout = false;
//
//             // Create progress bar component instance
//             const progressBarData = {
//                 code: progressCode,
//                 systray: false,
//             };
//             progressBars.push(progressBarData);
//
//             // Mount progress bar to the container
//             if ($el) {
//                 const progressBarEl = document.createElement('div');
//                 progressBarEl.setAttribute('data-progress-code', progressCode || 'default');
//                 $el.appendChild(progressBarEl);
//
//                 // Trigger progress bar creation event
//                 bus.trigger('web_progress_set_code', progressCode);
//             }
//         }
//
//         function removeProgressBarFromBlockedUI() {
//             // Clean up progress bars
//             progressBars.forEach(bar => {
//                 if (bar.destroy) {
//                     bar.destroy();
//                 }
//             });
//             progressBars = [];
//
//             if (blockUITimeout) {
//                 clearTimeout(blockUITimeout);
//                 blockUITimeout = false;
//             }
//
//             // Remove progress bar elements
//             document.querySelectorAll('[data-progress-code]').forEach(el => {
//                 el.remove();
//             });
//         }
//
//         // Override blockUI to add progress bar
//         function blockUI() {
//             const result = originalBlockUI.call(ui);
//             addProgressBarToBlockedUI();
//             return result;
//         }
//
//         // Override unblockUI to remove progress bar
//         function unblockUI() {
//             removeProgressBarFromBlockedUI();
//             return originalUnblockUI.call(ui);
//         }
//
//         // Replace the original functions
//         ui.block = blockUI;
//         ui.unblock = unblockUI;
//
//         // Handle RPC progress events
//         bus.addEventListener('rpc_progress_set_code', (event) => {
//             const progressCode = event.detail;
//             addProgressBarToBlockedUI(progressCode);
//         });
//
//         bus.addEventListener('rpc_progress_destroy', (event) => {
//             const progressCode = event.detail;
//             removeProgressBarFromBlockedUI();
//         });
//
//         return {
//             addProgressBarToBlockedUI,
//             removeProgressBarFromBlockedUI,
//             progressBars,
//         };
//     },
// };

// registry.category("services").add("webProgress", webProgressService);

/**
 * Enhanced RPC service to relay progress events
 */
const originalRpc = registry.category("services").get("rpc");

function findContext(params) {
    let context = {};
    if (params.kwargs && params.kwargs.context) {
        context = params.kwargs.context;
    } else if (params.context) {
        context = params.context;
    } else if (params.args && params.args.length > 0) {
        // Look for context in args
        const lastArg = params.args[params.args.length - 1];
        if (lastArg && typeof lastArg === 'object' && lastArg.context) {
            context = lastArg.context;
        }
    }
    return context;
}

function genericRelayEvents(url, method, params) {
    const context = findContext(params);
    if (context.progress_code) {
        const bus = registry.category("services").get("bus");
        if (bus) {
            bus.trigger('rpc_progress_set_code', context.progress_code);
        }
    }
}

// Extend the RPC service
const enhancedRpcService = {
    ...originalRpc,
    start(env, deps) {
        const rpcService = originalRpc.start(env, deps);
        
        // Wrap the original RPC function
        const originalRpcFn = rpcService.rpc || rpcService;
        
        function enhancedRpc(url, params, options = {}) {
            // Relay progress events for certain operations
            if (params && (params.method === 'execute_import' || params.method === 'import_data')) {
                genericRelayEvents(url, 'call', params);
            }
            
            return originalRpcFn.call(this, url, params, options);
        }

        return {
            ...rpcService,
            rpc: enhancedRpc,
        };
    },
};

// Replace the RPC service
registry.category("services").add("rpc", enhancedRpcService, { force: true });
