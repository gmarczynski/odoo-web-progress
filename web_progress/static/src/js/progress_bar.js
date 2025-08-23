/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillDestroy } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";
import { ProgressBarHeader } from "./progress_bar_header";
import { ProgressBarBody } from "./progress_bar_body";
import { ProgressBarSubList } from "./progress_bar_sub_list";

export class ProgressBar extends Component {
    static template = "web_progress.ProgressBar";
    static components = {
        ProgressBarHeader,
        ProgressBarBody,
        ProgressBarSubList
    };
    static props = {
        code: { type: String, optional: true },
        systray: { type: Boolean, optional: true },
    };

    setup() {
        this.state = useState({
            visible: false,
            progress: 0,
            message: "",
            timeEta: "",
            timeEta2: "",
            cancellable: true,
            style: "standard",
            user: "",
            ongoingCancel: false,
            subProgressList: [],
            showSubProgress: false,
        });

        this.notification = useService("notification");
        this.orm = useService("orm");
        this.progressService = useService("progressService");
        this.busService = this.progressService.busService;
        this.bus = this.progressService.bus;

        this.progressCode = this.props.code || false;
        this.systray = this.props.systray || false;
        this.lastProgressList = null;

        onWillStart(async () => {
            this.styleLocalStorageKey = 'web_progress_style';
            const storedStyle = localStorage.getItem(this.styleLocalStorageKey);
            if (storedStyle) {
                this.state.style = storedStyle;
            }
        });

        onMounted(() => {
            this.bus.addEventListener('web_progress_set_code', this.defineProgressCode.bind(this));
            this.bus.addEventListener('web_progress_update', this.showProgress.bind(this));
            this.bus.addEventListener('web_progress_cancel', this.handleCancel.bind(this));
            this.bus.addEventListener('web_progress_destroy', this.handleDestroy.bind(this));
            this.getProgressData();
        });

        onWillDestroy(() => {
            // No timeout cleanup needed anymore
        });
    }

    defineProgressCode = (event) => {
        const progressCode = event.detail;
        if (!this.state.user) {
            this.progressCode = progressCode;
            this.getProgressData();
        }
    }

    showProgress = (event) => {
        const progressList = event.detail;
        this.lastProgressList = progressList;

        const topProgress = progressList[0];
        const progressCode = topProgress.code;

        if (this.progressCode !== progressCode) {
            return;
        }

        if (topProgress.style) {
            this.setStyle(topProgress.style);
        }

        // Calculate overall progress
        let progress = 0.0;
        let progressTotal = 100;
        let cancellable = true;

        progressList.forEach(el => {
            if (el.total) {
                progress += (el.done / el.total) * progressTotal;
                progressTotal /= el.total;
            }
            cancellable = cancellable && el.cancellable;
        });

        // Update time estimates
        if (topProgress.time_left) {
            let etaMsg = '';
            let etaMsg2 = '';
            if (this.state.style !== 'standard') {
                etaMsg = `${topProgress.time_left}<br/>${topProgress.time_total}`;
            } else {
                etaMsg2 = _t("Est. time left: ") + `${topProgress.time_left} / ${topProgress.time_total}`;
            }
            this.state.timeEta = etaMsg;
            this.state.timeEta2 = etaMsg2;
        }

        // Update state
        this.state.visible = true;
        this.state.progress = progress;
        this.state.message = topProgress.msg || "";
        this.state.cancellable = cancellable;
        this.state.user = topProgress.user || "";
        this.state.subProgressList = progressList;
    }

    setStyle = (styleName) => {
        this.state.style = styleName;
        localStorage.setItem(this.styleLocalStorageKey, styleName);
    }

    onStyleClick = (event) => {
        const styleName = event.target.id;
        this.setStyle(styleName);
        event.stopPropagation();
        event.preventDefault(); // Add this to prevent default link behavior
    }

    onCancelClick = () => {
        if (this.state.ongoingCancel) {
            return;
        }
        this.state.ongoingCancel = true;
    }

    onCancelConfirmYes = () => {
        this.bus.trigger('web_progress_cancel', this.progressCode);
        this.state.ongoingCancel = false;
        this.notification.add(_t("Cancelling..."), { type: "info" });
    }

    onCancelConfirmNo = () => {
        this.state.ongoingCancel = false;
    }

    onMinimizeToSystray = () => {
        this.notification.add(_t("Progress moved to background"), {
            type: "info",
            sticky: false
        });
        this.progressService.unblockUI();

        // Trigger event to open systray menu
        this.bus.trigger('web_progress_minimize_to_systray', this.progressCode);
    }

    onToggleSubProgress = () => {
        this.state.showSubProgress = !this.state.showSubProgress;
    }

    handleCancel = (event) => {
        const progressCode = event.detail;
        if (this.progressCode === progressCode) {
            this._confirmCancelYes();
        }
    }

    handleDestroy = (event) => {
        const progressCode = event.detail;
        if (this.progressCode === progressCode) {
            this.state.visible = false;
        }
    }

    async getProgressData() {
        // Check if component is still mounted before making service call
        if (this.__owl__.status === "destroyed" || !this.progressCode) {
            return;
        }

        try {
            // Use the cached service method instead of direct RPC call
            const resultList = await this.progressService.getProgressData(this.progressCode);

            // Check again if component is still mounted before processing results
            if (this.__owl__.status === "destroyed") {
                return;
            }

            if (resultList && resultList.length > 0) {
                const result = resultList[0];
                if (['ongoing', 'done'].indexOf(result.state) >= 0) {
                    this.bus.trigger('web_progress_update', resultList);
                }
                if (result.state === 'done') {
                    this.bus.trigger('web_progress_destroy', this.progressCode);
                }
            }
        } catch (error) {
            // Only log error if component is still mounted
            if (this.__owl__.status !== "destroyed") {
                console.error('Error fetching progress:', error);
            }
        }
    }

    async _confirmCancelYes() {
        // Use the progress service's cancel method instead of direct RPC
        const success = await this.progressService.cancelProgress(this.progressCode);
        if (!success) {
            console.error('Failed to cancel progress operation');
        }
    }

    get progressPercentage() {
        return Number.parseFloat(this.state.progress).toFixed(2) + '%';
    }

    get progressBarStyle() {
        return `width: ${this.state.progress}%`;
    }

    get timeEta() {
        return markup(this.state.timeEta);
    }

    get timeEta2() {
        return markup(this.state.timeEta2);
    }

    get message() {
        return markup(this.state.message);
    }

    get hasSubProgress() {
        return this.state.subProgressList.length >= 1;
    }
}

registry.category("components").add("ProgressBar", ProgressBar);
