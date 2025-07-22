/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ProgressBarSubItem } from "./progress_bar_sub_item";

export class ProgressBarSubList extends Component {
    static template = "web_progress.ProgressBarSubList";
    static components = { ProgressBarSubItem };
    static props = {
        subProgressList: { type: Array },
        style: { type: String },
        showSubProgress: { type: Boolean },
    };
}