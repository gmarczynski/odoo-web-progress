/** @odoo-module **/

import {download} from "@web/core/network/download";
import {registry} from "@web/core/registry";
import {jsonrpc} from "@web/core/network/rpc_service";

// -----------------------------------------------------------------------------
// download adapted to handle progress reporting
// -----------------------------------------------------------------------------

const org_download = download._download;

function _download(options) {

    let BlockUI  = registry.category("main_components").get("BlockUI");
    // add progress_code to the context
    if (options.data) {
        var data = false;
        if (options.data.context) {
            // reports
            data = {'context': JSON.parse(options.data.context)};
            data.context.progress_code = pseudoUuid();
            options.data.context = JSON.stringify(data.context);
        } else if (options.data.data) {
            // export
            data = JSON.parse(options.data.data);
            data.context.progress_code = pseudoUuid();
            options.data.data = JSON.stringify(data);
        }
        if (data.context) {
            // block UI
            BlockUI.props.bus.trigger("BLOCK", {
                progressCode: data.context.progress_code,
            });
        }
        return org_download(options).finally(() => {
            // unblock UI
            BlockUI.props.bus.trigger("UNBLOCK", {});
        })
    }
}

download._download = _download;

// -----------------------------------------------------------------------------
// RPC service with progress code
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
registry.category("services").add("rpc", rpcService, {force: true});