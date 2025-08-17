/** @odoo-module **/

import { ImportBlockUI } from "@base_import/import_block_ui";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import {useState, xml} from "@odoo/owl";
import { ProgressBar } from "./progress_bar";


patch(ImportBlockUI, {
    components: {
        ...(ImportBlockUI.components || {}),
        ProgressBar
    },
});

patch(ImportBlockUI.prototype, {
    setup() {
        super.setup();

        // Add progress-related state
        this.state = useState({
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
            console.warn('ProgressService not available in ImportBlockUI patch');
        }
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

// Patch the template to include progress bar below the import data progress
patch(ImportBlockUI, {
    template: xml`
        <div class="o_blockUI fixed-top d-flex justify-content-center align-items-center flex-column vh-100 bg-black-50">
            <div class="o_spinner mb-4">
                <img src="/web/static/img/spin.svg" alt="Loading..."/>
            </div>
            <div t-if="props.message or props.blockComponent">
                <div class="o_message text-center px-4" t-esc="props.message" />
                <t t-if="props.blockComponent" t-component="props.blockComponent.class" t-props="props.blockComponent.props"/>
            </div>
            <div t-if="hasProgress" class="o_web_progress_blockui_progress mt-4">
               <ProgressBar t-props="{ code: state.progressCode, systray: false }"/> 
            </div>
        </div>`
});

