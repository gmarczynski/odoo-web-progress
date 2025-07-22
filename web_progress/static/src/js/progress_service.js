/** @odoo-module **/

import {registry} from "@web/core/registry";
import {jsonrpc} from "@web/core/network/rpc_service";

const progressService = {
    dependencies: ["rpc", "bus_service"],
    start(env, {rpc, bus_service}) {
        env.bus.addEventListener("RPC:REQUEST", (ev) => {
            const {data, url, settings} = ev.detail;
            const params = data.params;
            if (settings.progress_code &&
                this.validateCall(url, data.method, params, settings)) {
                env.bus.trigger('web_progress_request', settings.progress_code);
            }
        });
        env.bus.addEventListener("RPC:RESPONSE", (ev) => {
            const {data, error, settings} = ev.detail;
            if (settings.progress_code) {
                env.bus.trigger('web_progress_response', settings.progress_code)
            }
        });
        return {
            bus: env.bus,
            busService: bus_service,
        }
    },

    validateCall(url, method, params, settings) {
        if (settings && settings.silent) {
            // do not track if silent
            return false;
        }
        return url.startsWith('/web/') && method === 'call' && params.model !== 'web.progress';
    },

};

registry.category("services").add("progressService", progressService);

// -----------------------------------------------------------------------------
// RPC service with progres code
// -----------------------------------------------------------------------------

function pseudoUuid(a) {
    return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, pseudoUuid)
}

function findContext(params) {
    var ret = false;
    if ('context' in params) {
        ret = params.context;
    } else if ('kwargs' in params) {
        if ('context' in params.kwargs) {
            ret = params.kwargs.context;
        }
    } else if ('args' in params && params.args.length > 0) {
        ret = params.args[params.args.length - 1];
    }
    return ret;
}

export const rpcService = {
    async: true,
    start: function (env) {
        /**
         * @param {string} route
         * @param {Object} params
         * @param {Object} [settings]
         * @param {boolean} settings.silent
         * @param {XMLHttpRequest} settings.xhr
         */
        return function rpc(route, params = {}, settings = {}) {
            if (!settings.progress_code) {
                settings.progress_code = pseudoUuid();
            }
            var context = findContext(params);
            if (context) {
                context.progress_code = settings.progress_code;
            }
            return jsonrpc(route, params, {bus: env.bus, ...settings});
        };
    },
};

// replace RPC services
registry.category("services").add("rpc", rpcService, { force: true });

// register the same disalog for CancelledProgress as there is for UserError
registry .category("error_dialogs")
    .add("odoo.addons.web_progress.models.web_progress.CancelledProgress",
        registry .category("error_dialogs").get("odoo.exceptions.UserError"))