odoo.define('web.progress.bar', function (require) {
"use strict";

/**
 * Display Progress Bar when blocking UI
 */

var core = require('web.core');
var Widget = require('web.Widget');
var progress_loading = require('web.progress.loading');
var framework = require('web.framework');

var _t = core._t;
var progress_timeout = progress_loading.progress_timeout;
var framework_blockUI = framework.blockUI;
var framework_unblockUI = framework.unblockUI;


var ProgressBar = Widget.extend({
    template: "ProgressBar",
    init: function() {
        this._super(parent);
        core.bus.on('rpc_progress', this, this.show_progress);
    },
    show_progress: function(progress_list) {
        var progress_html = "";
        var progress = 0;
        var progress_total = 100;
        var progress_code = -1;
        var cancellable = true;
        _.each(progress_list, function(el) {
            var message = el.msg || "";
            progress_html += "<div>" + _t("Progress") + " " +
                el.progress + "%" + " (" + el.done + "/" + el.total + ")" + " " + message + "</div>"
            if (el.progress && el.total) {
                progress += el.progress * progress_total / 100;
            }
            if (el.total) {
                progress_total /= el.total;
            }
            progress_code = el.code;
            cancellable = cancellable && el.cancellable;
            });
        self.$("#progress_frame").css("visibility", 'visible');
        if (cancellable) {
            self.$("button#progress_cancel").css("visibility", 'visible');
            self.$("button#progress_cancel").remove();
            self.$("button#progress_cancel").one('click', function () {
                core.bus.trigger('rpc_progress_cancel', progress_code);
            });
        } else {
            self.$("button#progress_cancel").remove();
        }
        self.$("#progress_bar").animate({width: progress + '%'}, progress_timeout / 2);
        if (progress_html) {
            self.$(".oe_progress_message").html(progress_html);
        }
        },
});

var progress_bars = [];

function blockUI() {
    var tmp = framework_blockUI();
    var progress_bar = new ProgressBar();
    progress_bars.push(progress_bar);
    progress_bar.appendTo($(".oe_blockui_spin_container"));
    return tmp;
}

function unblockUI() {
    _.invoke(progress_bars, 'destroy');
    progress_bars = [];
    return framework_unblockUI();
}

framework.blockUI = blockUI;
framework.unblockUI = unblockUI;

return {
    blockUI: blockUI,
    unblockUI: unblockUI,
    ProgressBar: ProgressBar,
};

});
