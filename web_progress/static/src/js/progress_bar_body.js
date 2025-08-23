/** @odoo-module **/

import { Component } from "@odoo/owl";
import {ProgressBarHeader} from "./progress_bar_header";
import {ProgressBarSubList} from "./progress_bar_sub_list";

export class ProgressBarBody extends Component {
    static template = "web_progress.ProgressBarBody";
    static props = {
        systray: { type: Boolean, optional: true },
        style: { type: String },
        progressBarStyle: { type: String },
        progressPercentage: { type: String },
        timeEta: { type: Object, optional: true },
        timeEta2: { type: Object, optional: true },
        message: { type: Object, optional: true },
        hasSubProgress: { type: Boolean },
        showSubProgress: { type: Boolean },
        onToggleSubProgress: { type: Function },
        // Added control props
        cancellable: { type: Boolean },
        ongoingCancel: { type: Boolean },
        onCancelClick: { type: Function },
        onCancelConfirmYes: { type: Function },
        onCancelConfirmNo: { type: Function },
        onMinimizeToSystray: { type: Function },
    };
}