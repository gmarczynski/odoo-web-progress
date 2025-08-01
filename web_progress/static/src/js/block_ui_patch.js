/** @odoo-module **/

import { BlockUI } from "@web/core/ui/block_ui";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { xml } from "@odoo/owl";
import {ProgressBar} from "./progress_bar";

patch(BlockUI, {
    components: {
        ...(BlockUI.components || {}),
        ProgressBar
    },
})

patch(BlockUI.prototype, {
    setup() {
        super.setup();

        // Add progress-related state
        Object.assign(this.state, {
            showProgress: false,
            progressCode: null,
        });

        // Try to get progress service
        try {
            this.progressService = useService("progressService");

            // Listen for progress events
            this.progressService.bus.addEventListener('web_progress_set_code', this._onProgressSet.bind(this));
            this.progressService.bus.addEventListener('web_progress_destroy', this._onProgressDestroy.bind(this));
        } catch (error) {
            console.warn('ProgressService not available in BlockUI patch');
        }

    },

    block(ev) {
        super.block(ev);
        this.state.blockUI = true;
        this.state.showProgress = true;
        this.state.progressCode = ev.detail?.progressCode || this.state.progressCode || null;
        if (ev.detail?.message) {
            this.state.line1 = ev.detail.message;
        } else {
            this.replaceMessage(0);
        }
    },

    unblock() {
        super.unblock();
        this.state.showProgress = false;
        this.state.progressCode = null;
    },

    /**
     * Handle progress code being set
     */
    _onProgressSet(event) {
        const progressCode = event.detail;
        if (progressCode && !this.state.showProgress) {
            this.state.progressCode = progressCode;
            this.state.showProgress = true;
        }
    },

    /**
     * Handle progress being destroyed
     */
    _onProgressDestroy(event) {
        const progressCode = event.detail;
        if (progressCode === this.state.progressCode) {
            this.state.showProgress = false;
            this.state.progressCode = null;
        }
    },

    get hasProgress() {
        return this.state.showProgress && this.state.progressCode;
    }
});

// Patch the template to include progress bar
patch(BlockUI, {
    template: xml`
        <div t-att-class="state.blockUI ? 'o_blockUI fixed-top d-flex justify-content-center align-items-center flex-column vh-100' : ''">
          <t t-if="state.blockUI">
            <div class="o_spinner mb-4">
                <img src="/web/static/img/spin.svg" alt="Loading..."/>
            </div>
            <div t-if="hasProgress" class="o_web_progress_blockui_progress mt-4">
               <ProgressBar t-props="{ code: state.progressCode, systray: false }"/> 
            </div>
          </t>
        </div>`
});

