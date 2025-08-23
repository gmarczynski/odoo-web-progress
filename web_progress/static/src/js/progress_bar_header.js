/** @odoo-module **/

import { Component } from "@odoo/owl";

export class ProgressBarHeader extends Component {
    static template = "web_progress.ProgressBarHeader";
    static props = {
        systray: { type: Boolean },
        user: { type: String, optional: true },
        style: { type: String },
        onStyleClick: { type: Function },
    };
}