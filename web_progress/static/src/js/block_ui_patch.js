/** @odoo-module **/

import { BlockUI } from "@web/core/ui/block_ui";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { xml } from "@odoo/owl";
import { ProgressBar } from "./progress_bar";

patch(BlockUI, {
    components: {
        ...(BlockUI.components || {}),
        ProgressBar
    },
})

patch(BlockUI.prototype, {
    setup() {
        super.setup();

        // Add progress-related state to existing state
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

    /**
     * Override to set progress
     */
    block(ev) {
        super.block(ev);
        this.state.showProgress = true;
        this.state.progressCode = ev.detail?.progressCode || this.state.progressCode || null;
    },

    /**
     * Override to clear progress code
     */
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
        if (progressCode) {
            this.state.progressCode = progressCode;
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
            if (this.state.blockState !== this.BLOCK_STATES.UNBLOCKED) {
                this.unblock();
            }
        }
    },

    get hasProgress() {
        return this.state.showProgress && this.state.progressCode;
    }
});

// Patch the template to include progress bar in the Odoo 18 structure
patch(BlockUI, {
    template: xml`
        <t t-if="state.blockState === BLOCK_STATES.UNBLOCKED">
            <div/>
        </t>
        <t t-else="">
            <t t-set="visiblyBlocked" t-value="state.blockState === BLOCK_STATES.VISIBLY_BLOCKED"/>
            <div class="o_blockUI fixed-top d-flex justify-content-center align-items-center flex-column vh-100"
                 t-att-class="visiblyBlocked ? '' : 'o_blockUI_invisible'">
                <t t-if="visiblyBlocked">
                    <div class="o_spinner mb-4">
                        <img src="/web/static/img/spin.svg" alt="Loading..."/>
                    </div>
                    <div t-if="hasProgress" class="o_web_progress_blockui_progress mt-4">
                       <ProgressBar t-props="{ code: state.progressCode, systray: false }"/>
                    </div>
                    <div t-else="" class="o_message text-center px-4">
                        <t t-esc="state.line1"/><br/>
                        <t t-esc="state.line2"/>
                    </div>
                </t>
            </div>
        </t>
    `
});
