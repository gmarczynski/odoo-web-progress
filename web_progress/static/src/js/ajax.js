odoo.define('web.progress.ajax', function (require) {
"use strict";

/**
 * Add progress code into Ajax RPC and relay events
 */

var core = require('web.core');
var ajax = require('web.ajax');
var ServicesMixin = require('web.ServicesMixin');

var ajax_jsonRpc = ajax.jsonRpc;
var ajax_jsonpRpc = ajax.jsonpRpc;
var ajax_rpc = ajax.rpc;
var progress_codes = {};

function pseudo_uuid(a){
    return a?(a^Math.random()*16>>a/4).toString(16):([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,pseudo_uuid)
}

var RelayRequest = core.Class.extend(ServicesMixin, {
    init: function (url, fct_name, params, progress_code) {
        this._super(parent);
        core.bus.on('rpc_request', this, function () {
            if (url.startsWith('/web/dataset/') && fct_name === 'call' && params.model !== 'web.progress') {
                core.bus.trigger('rpc_progress_request', fct_name, params, progress_code);
            }
            this.destroy();
        });
    }
});

var RelayResult = core.Class.extend(ServicesMixin, {
    init: function () {
        this._super(parent);
        core.bus.on('rpc:result', this, function (data, result) {
            var progress_code = -1;
            if ('kwargs' in data.params && 'context' in data.params.kwargs
                && 'progress_code' in data.params.kwargs.context) {
                progress_code = data.params.kwargs.context.progress_code;
            } else if ('args' in data.params && data.params.args.length > 0) {
                progress_code = data.params.args[data.params.args.length - 1]['progress_code'];
            }
            if (progress_code in progress_codes) {
                delete progress_codes[progress_code];
                core.bus.trigger('rpc_progress_result', progress_code);
            }
        });
    }
});

var relay_result = new RelayResult();

function genericRelayEvents(url, fct_name, params) {
    if (url.startsWith('/web/dataset/') && fct_name === 'call' && params.model !== 'web.progress') {
        var relay = false;
        var progress_code = pseudo_uuid();
        if ('kwargs' in params) {
            if ('context' in params.kwargs) {
                params.kwargs.context['progress_code'] = progress_code;
                relay = true;
            }
        } else if ('args' in params && params.args.length > 0) {
            params.args[params.args.length - 1]['progress_code'] = progress_code;
            relay = true;
        }
        if (relay) {
            progress_codes[progress_code] = new RelayRequest(url, fct_name, params, progress_code);
        }
    }
    return params;
}

function jsonRpc(url, fct_name, params, settings) {
    var new_params = genericRelayEvents(url, fct_name, params);
    return ajax_jsonRpc(url, fct_name, new_params, settings);
}

function jsonpRpc(url, fct_name, params, settings) {
    var new_params = genericRelayEvents(url, fct_name, params);
    return ajax_jsonpRpc(url, fct_name, new_params, settings);
}

// helper function to make a rpc with a function name hardcoded to 'call'
function rpc(url, params, settings) {
    var new_params = genericRelayEvents(url, 'call', params);
    return ajax_rpc(url, new_params, settings);
}

ajax.jsonRpc = jsonRpc;
ajax.jsonpRpc = jsonpRpc;
ajax.rpc = rpc;

return {
    jsonRpc: jsonRpc,
    jsonpRpc: jsonpRpc,
    rpc: rpc,
    RelayRequest: RelayRequest,
    RelayResult: RelayResult,
    genericRelayEvents: genericRelayEvents,
    relay_result: relay_result,
    pseudo_uuid: pseudo_uuid,
}
});

