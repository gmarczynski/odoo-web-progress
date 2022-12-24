/** @odoo-module **/

import { jsonrpc } from "@web/core/network/rpc_service";
import { registry } from "@web/core/registry";
import { BlockUI } from "@web/core/ui/block_ui";
import * as legacyEnv from "web.env";
import * as legacyProgressAjax from "web.progress.ajax";

const {tags} = owl;


import * as legacyProgressBar from "web.progress.bar";

function registerProgressBarBLockUI() {
    var BlockUIcomp = registry.category("main_components").get("BlockUI");

    if (BlockUIcomp && BlockUIcomp.props) {
        BlockUIcomp.props.bus.on("BLOCK", null, function() {legacyProgressBar.addProgressBarToBlockedUI(BlockUIcomp)});
        BlockUIcomp.props.bus.on("UNBLOCK", null, function() {legacyProgressBar.removeProgressBarFrmBlockedUI(BlockUIcomp)});
    }

BlockUI.template = tags.xml`
    <div t-att-class="state.blockUI ? 'o_blockUI' : ''">
      <t t-if="state.blockUI">
        <div class="o_spinner">
            <img src="/web/static/img/spin.png" alt="Loading..."/>
        </div>
        <div class="o_progress_blockui" style="min-width: 500px;text-align: center">
            <div class="o_message">
                <t t-raw="state.line1"/> <br/>
                <t t-raw="state.line2"/>
            </div>    
        </div>
      </t>
    </div>`;
}

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
        // make sure the progress bar is registered
        registerProgressBarBLockUI();
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