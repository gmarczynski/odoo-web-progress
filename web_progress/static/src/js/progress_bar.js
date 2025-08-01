/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillDestroy } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { markup } from "@odoo/owl";
import { ProgressBarHeader } from "./progress_bar_header";
import { ProgressBarBody } from "./progress_bar_body";
import { ProgressBarSubList } from "./progress_bar_sub_list";

const progressTimeout = 5000;
const progressTimeoutWarn = progressTimeout * 2;

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

        this.rpc = useService("rpc");
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.progressService = useService("progressService");
        this.busService = this.progressService.busService;
        this.bus = this.progressService.bus;

        this.progressCode = this.props.code || false;
        this.systray = this.props.systray || false;
        this.progressTimer = false;
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
            this.bus.addEventListener('web_progress_refresh', this.handleRefresh.bind(this));
        });

        onWillDestroy(() => {
            this._cancelTimeout();
        });
    }

    defineProgressCode = (event) => {
        const progressCode = event.detail;
        if (!this.state.user) {
            this.progressCode = progressCode;
            this._setTimeout();
            this._getProgressViaRPC();
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
            // if (this.state.style !== 'standard') {
                etaMsg = `${topProgress.time_left}<br/>${topProgress.time_total}`;
            // } else {
            //     etaMsg2 = _t("Est. time left: ") + `${topProgress.time_left} / ${topProgress.time_total}`;
            // }
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

        this._cancelTimeout();
        this._setTimeout();
    }

    setStyle = (styleName) => {
        this.state.style = styleName;
        localStorage.setItem(this.styleLocalStorageKey, styleName);
    }

    onStyleClick = (event) => {
        const styleName = event.target.id;
        this.setStyle(styleName);
        event.stopPropagation();
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
            this._cancelTimeout();
        }
    }

    handleRefresh = (event) => {
        const progressCode = event.detail;
        if (this.progressCode === progressCode) {
            this._getProgressViaRPC();
        }
    }

    _setTimeout() {
        if (!this.progressTimer) {
            this.progressTimer = setTimeout(() => {
                this._notifyTimeoutWarn();
            }, progressTimeoutWarn);
        }
    }

    _cancelTimeout() {
        if (this.progressTimer) {
            clearTimeout(this.progressTimer);
            this.progressTimer = false;
        }
    }

    _notifyTimeoutWarn() {
        this._getProgressViaRPC();
        this.progressTimer = setTimeout(() => {
            this._notifyTimeoutDestr();
        }, progressTimeoutWarn);
    }

    _notifyTimeoutDestr() {
        this.progressTimer = setTimeout(() => {
            this.bus.trigger('web_progress_destroy', this.progressCode);
        }, progressTimeoutWarn);
    }

    async _getProgressViaRPC() {
        if (!this.progressCode) {
            return;
        }

        // Clear existing timer if any
        if (this.progressTimer) {
            clearTimeout(this.progressTimer);
            this.progressTimer = false;
        }

        try {
            const resultList = await this.orm.call(
                'web.progress',
                'get_progress_rpc',
                [this.progressCode],
                {}
            );

            if (resultList.length > 0) {
                const result = resultList[0];
                if (['ongoing', 'done'].indexOf(result.state) >= 0) {
                    this.bus.trigger('web_progress_update', resultList);
                }
                if (result.state === 'done') {
                    this.bus.trigger('web_progress_destroy', this.progressCode);
                }
            }
        } catch (error) {
            console.error('Error fetching progress:', error);
        }
    }

    async _confirmCancelYes() {
        await this.rpc("/web/progress/cancel", {
            progress_code: this.progressCode,
        });
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