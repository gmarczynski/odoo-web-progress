/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { useService, useBus } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { ProgressBar } from "./progress_bar";

/**
 * Progress menu item in the systray part of the navbar
 */
export class ProgressMenu extends Component {
    static template = "web_progress.ProgressMenu";
    static components = { Dropdown, DropdownItem, ProgressBar };
    static props = {};

    setup() {
        this.state = useState({
            progressCounter: 0,
        });

        this.user = useService("user");
        this.progressService = useService("progressService");
        this.bus = this.progressService.bus;

        // Use useBus to subscribe to progress changes
        useBus(this.bus, 'web_progress_destroy', this._handleProgressBarChange);
        useBus(this.bus, 'web_progress_set_code', this._handleProgressBarChange);
        useBus(this.bus, 'web_progress_request', this._handleProgressBarChange);
        useBus(this.bus, 'web_progress_response', this._handleProgressBarChange);
        useBus(this.bus, 'web_progress_minimize_to_systray', this._handleMinimizeToSystray);

        onMounted(() => {
            // Update the counter when the component is mounted
            this._updateProgressCounter();
        });
    }

    /**
     * Called when dropdown is opened
     * @private
     */
    onDropdownOpened = () => {
        // No need to query recent operations - bus notifications handle updates
        // and RPC polling handles fallback when bus fails
    }

    /**
     * Handle any progress bar change event
     * @private
     */
    _handleProgressBarChange = () => {
        this._updateProgressCounter();
    }

    /**
     * Handle minimize to systray event
     * @private
     */
    _handleMinimizeToSystray = (event) => {
        // Update counter first
        this._updateProgressCounter();

        // Open the dropdown after a short delay
        setTimeout(() => {
            const globalDropdown =
                document.querySelector('.o_mail_systray_item button.dropdown-toggle');
            if (globalDropdown &&
                globalDropdown.closest('.o_mail_systray_item').querySelector('i.fa-refresh')) {
                const clickEvent = new Event('click', {bubbles: true});
                globalDropdown.dispatchEvent(clickEvent);
            }
        }, 200);
    }

    /**
     * Update the progress counter
     * @private
     */
    _updateProgressCounter() {
        this.state.progressCounter = this.progressService.getProgressBarCount();
    }

    get isVisible() {
        return this.user.isSystem || this.state.progressCounter > 0;
    }

    get hasProgressBars() {
        return this.state.progressCounter > 0;
    }

    /*
    * Used in template to iterate existing progress codes
    */
    get progressBarCodes() {
        return this.progressService.getProgressBarCodes();
    }
}

// Register in systray
export const systrayItem = {
    Component: ProgressMenu,
    isDisplayed: () => true,
};

registry.category("systray").add("ProgressMenu", systrayItem, { sequence: 100 });