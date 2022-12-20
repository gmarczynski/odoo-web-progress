/** @odoo-module **/

import { jsonrpc } from "@web/core/network/rpc_service";
import { registry } from "@web/core/registry";
import * as legacyEnv from "web.env";
import * as legacyProgressAjax from "web.progress.ajax";

const { Component, useState } = owl;

// -----------------------------------------------------------------------------
// RPC service adapted to handle progress reporting
// -----------------------------------------------------------------------------
export const rpcServiceProgress = {
    async: true,
    start(env) {
        let rpcId = 0;
        // redirect bus messages from OWL bus to the legacy bus
        env.bus.on("RPC:REQUEST", null, function(rId) {
            legacyEnv.bus.trigger('RPC:REQUEST', rId);
        });
        env.bus.on("RPC:RESPONSE", null, function(rId) {
            legacyEnv.bus.trigger('RPC:RESPONSE', rId);
        });
        return function rpc(route, params = {}, settings) {
            var rId = rpcId++;
            // add progress_code to the context
            legacyProgressAjax.genericRelayEvents(route, 'call', params);
            return jsonrpc(env, rId, route, params, settings);
        };
    },
};

registry.category("services").remove("rpc");
registry.category("services").add("rpc", rpcServiceProgress);