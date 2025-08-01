/** @odoo-module **/

import { Component } from "@odoo/owl";

export class ProgressBarSubItem extends Component {
    static template = "web_progress.ProgressBarSubItem";
    static props = {
        item: { type: Object },
        style: { type: String },
        level: { type: Number },
    };

    get progressPercentage() {
        return Number.parseFloat(this.props.item.progress || 0).toFixed(1) + '%';
    }

    get progressBarStyle() {
        return `width: ${this.props.item.progress || 0}%`;
    }

    get levelIndent() {
        return '  '.repeat(this.props.level);
    }

    get itemStyle() {
        // Add margin-left for indentation based on level
        const indentPx = this.props.level * 20; // 20px per level
        return `margin-left: ${indentPx}px;`;
    }
}