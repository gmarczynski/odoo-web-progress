// Part of web_progress. See LICENSE file for full copyright and licensing details.
odoo.define('web.progress.bar', function (require) {
"use strict";

/**
 * Display Progress Bar when blocking UI
 */

var core = require('web.core');
var Widget = require('web.Widget');
var progress_loading = require('web.progress.loading');
var framework = require('web.framework');
var session = require('web.session');

var _t = core._t;
var progress_timeout = progress_loading.progress_timeout;
var framework_blockUI = framework.blockUI;
var framework_unblockUI = framework.unblockUI;


var ProgressBar = Widget.extend({
    template: "ProgressBar",
    progress_code: false,
    init: function(parent, code, $spin_container) {
        this._super(parent);
        this.progress_code = code;
        this.$spin_container = $spin_container;
        core.bus.on('rpc_progress_set_code', this, this.defineProgressCode);
        core.bus.on('rpc_progress', this, this.showProgress);
    },
    defineProgressCode: function(progress_code) {
        if (!this.progress_code) {
            this.progress_code = progress_code;
        }
    },
    showProgress: function(progress_list) {
        var self = this;
        var top_progress = progress_list[0];
        var progress_code = top_progress.code;
        var uid = session.uid;
        if (this.progress_code !== progress_code || uid !== 1 && uid !== top_progress.uid) {
            return;
        }
        var progress_html = '<div class="text-left">';
        var progress = 0.0;
        var progress_total = 100;
        var cancellable = true;
        var level = '';
        _.each(progress_list, function(el) {
            var message = el.msg || "";
            progress_html += "<div>" + level + " " + el.progress + "%" + " (" + el.done + "/" + el.total + ")" + " " + message + "</div>"
            if (el.progress && el.total) {
                progress += el.progress * progress_total / 100;
            }
            if (el.total) {
                progress_total /= el.total;
            }
            cancellable = cancellable && el.cancellable;
            level += '▶';
            });
        progress_html += '</div>'
        self.$("#progress_frame").css("visibility", 'visible');
        if (self.$spin_container) {
            // this is main progress bar
            self.$spin_container.find(".oe_throbber_message").css("display", 'none');
        } else {
            // this is a systray progress bar
            self.$("#progress_message").removeClass('o_progress_message');
            self.$("#progress_message").addClass('o_progress_message_systray');
            self.$("#progress_cancel").addClass('btn-default');
            self.$("#progress_user").css("visibility", 'visible');
            if (uid === 1) {
                self.$("#progress_user").html(top_progress.user);
            }
        }
        if (cancellable) {
            self.$("#progress_cancel").off();
            self.$("#progress_cancel").css("visibility", 'visible');
            self.$("#progress_cancel").one('click', function () {
                core.bus.trigger('rpc_progress_cancel', progress_code);
                self.$("#progress_cancel").replaceWith("");
                self.$("#progress_message").html(_t("Cancelling..."));
            });
        } else {
            self.$("#progress_cancel").remove();
        }
        self.$("#progress_bar").animate({width: progress + '%'}, progress_timeout);
        self.$("#progress_message").html(progress_html);
        },
});

var progress_bars = [];

function blockUI() {
    var tmp = framework_blockUI();
    var $spin_container = $(".oe_blockui_spin_container");
    var progress_bar = new ProgressBar(false, false, $spin_container);
    progress_bars.push(progress_bar);
    progress_bar.appendTo($spin_container);
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
