/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
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
            progressBars: {},
        });

        this.rpc = useService("rpc");
        this.orm = useService("orm");
        this.user = useService("user");
        this.progressService = useService("progressService");
        this.busService = this.progressService.busService;
        this.bus = this.progressService.bus;

        this.channel = 'web_progress';

        // Use useBus instead of manual event listeners
        useBus(this.bus, 'web_progress_destroy', this._handleDestroyProgressBar);
        useBus(this.bus, 'web_progress_response', this._handleDestroyProgressBar);
        useBus(this.bus, 'web_progress_request', this._handleAddProgressBar);

        onWillStart(async () => {
            this.busService.addChannel(this.channel);
        });

        onMounted(() => {
            this.busService.subscribe(this.channel, this._onNotification.bind(this));
            this._updateProgressMenu();
            this._queryRecentOperations();
        });
    }

    /**
     * Called when dropdown is opened
     * @private
     */
    onDropdownOpened = () => {
        this._queryRecentOperations();
    }
    /**
     * Iterate bus notifications
     * @private
     */
    _onNotification = (notifications) => {
        this._handleNotification(notifications);
        this._updateProgressMenu();
    }

    /**
     * On every bus notification schedule update of all progress and pass progress message to progress bar
     * @private
     */
    _handleNotification(progresses) {
        const progress = progresses[0];
        this._processProgressData(progress.code, progress.state, progress.uid);
        if (['ongoing', 'done'].indexOf(progress.state) >= 0) {
            this.bus.trigger('web_progress_update', progresses);
        }
    }

    /**
     * Add progress bar
     * @private
     */
    _addProgressBar(code) {
        if (this.state.progressBars[code]) {
            return this.state.progressBars[code];
        }

        // Create a new progress bar state entry
        this.state.progressBars[code] = {
            code: code,
            visible: true,
        };

        this._updateProgressMenu();
        this.bus.trigger('web_progress_set_code', code);
        return this.state.progressBars[code];
    }

    /**
     * Remove progress bar
     * @private
     */
    _handleDestroyProgressBar = (event) => {
        const code = event.detail;
        if (this.state.progressBars[code]) {
            delete this.state.progressBars[code];
            this._updateProgressMenu();
        }
    }

    /**
     * Add progress bar
     * @private
     */
    _handleAddProgressBar = (event) => {
        const code = event.detail;
        if (!this.state.progressBars[code]) {
            this._addProgressBar(code);
            this._updateProgressMenu();
        }
    }

    /**
     * Find progress bar
     * @private
     */
    _findProgressBar(code) {
        return this.state.progressBars[code] || false;
    }

    /**
     * Update counter and style of progress menu
     * @private
     */
    _updateProgressMenu() {
        this.state.progressCounter = Object.keys(this.state.progressBars).length;
    }

    /**
     * Query server for recent operations in progress
     * @private
     */
    async _queryRecentOperations() {
        try {
            const codesList = await this.orm.call(
                'web.progress',
                'get_all_progress',
                [],
                {}
            );

            if (codesList.length > 0) {
                codesList.forEach(item => {
                    if (item.code) {
                        const pb = this._addProgressBar(item.code);
                        if (pb) {
                            this.bus.trigger('web_progress_refresh', item.code);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error querying recent operations:', error);
        }
    }

    /**
     * Process and display progress details
     * @private
     */
    _processProgressData(code, state, uid) {
        const sessionUid = this.user.userId;
        const sessionIsSystem = this.user.isSystem;
        const progressBar = this._findProgressBar(code);

        if (sessionUid !== uid && !sessionIsSystem) {
            return;
        }

        if (!progressBar && state === 'ongoing') {
            this._addProgressBar(code);
        }

        if (progressBar && state === 'done') {
            this.bus.trigger('web_progress_destroy', code);
        }
    }

    get isVisible() {
        return this.user.isSystem || this.state.progressCounter > 0;
    }

    get hasProgressBars() {
        return this.state.progressCounter > 0;
    }

    get progressBarCodes() {
        return Object.keys(this.state.progressBars);
    }
}

// Register in systray
export const systrayItem = {
    Component: ProgressMenu,
    isDisplayed: () => true,
};

registry.category("systray").add("ProgressMenu", systrayItem, { sequence: 100 });