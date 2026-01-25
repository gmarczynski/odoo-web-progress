/** @odoo-module **/

import { BlockUI } from "@web/core/ui/block_ui";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { ProgressBar } from "./progress_bar";

patch(BlockUI, {
    components: {
        ...(BlockUI.components || {}),
        ProgressBar
    },
});

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

            // Listen for progress events from progress service
            this.progressService.bus.addEventListener('web_progress_set_code', this._onProgressSet.bind(this));
            this.progressService.bus.addEventListener('web_progress_destroy', this._onProgressDestroy.bind(this));
            this.progressService.bus.addEventListener('web_progress_update', this._onProgressUpdate.bind(this));
        } catch (error) {
            console.warn('ProgressService not available in BlockUI patch');
        }
    },

    /**
     * Override to set progress when blocking
     */
    block(ev) {
        super.block(ev);
        // Check if progressCode was passed in the event detail
        const progressCode = ev.detail?.progressCode;
        if (progressCode) {
            this.state.showProgress = true;
            this.state.progressCode = progressCode;
        }
    },

    /**
     * Override to clear progress code when unblocking
     */
    unblock() {
        super.unblock();
        this.state.showProgress = false;
        this.state.progressCode = null;
    },

    /**
     * Handle progress code being set from progress service
     */
    _onProgressSet(event) {
        const progressCode = event.detail;
        if (progressCode && this.state.blockState !== this.BLOCK_STATES.UNBLOCKED) {
            this.state.showProgress = true;
            this.state.progressCode = progressCode;
        }
    },

    /**
     * Handle progress updates - show progress if UI is blocked
     */
    _onProgressUpdate(event) {
        const progressList = event.detail;
        if (progressList?.length > 0 && this.state.blockState !== this.BLOCK_STATES.UNBLOCKED) {
            const topProgress = progressList[0];
            if (topProgress.code && topProgress.state === 'ongoing') {
                this.state.showProgress = true;
                this.state.progressCode = topProgress.code;
            }
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
