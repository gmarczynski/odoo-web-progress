// Part of web_progress. See LICENSE file for full copyright and licensing details.
odoo.define('web_progress.ProgressMenu', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var SystrayMenu = require('web.SystrayMenu');
var Widget = require('web.Widget');
var ProgressBar = require('web.progress.bar').ProgressBar;

var QWeb = core.qweb;
var progress_timeout = 10000;

/**
 * Progress menu item in the systray part of the navbar
 */
var ProgressMenu = Widget.extend({
    template:'web_progress.ProgressMenu',
    channel: 'web_progress',
    progress_bars: [],
    init: function(parent) {
        this._super(parent);
        this.call('bus_service', 'addChannel', this.channel);
        this.call('bus_service', 'startPolling');
    },
    start: function () {
        core.bus.on('rpc_progress_destroy', this, this._removeProgressBar);
        this.progressCounter = 0;
        this.$progresses_preview = this.$('.o_mail_systray_dropdown_items');
        if (this.getSession().uid !== 1) {
            this.$el.toggleClass('hidden', !this.progressCounter);
        }
        this.call('bus_service', 'onNotification', this, this._onNotification);
        this._updateProgressMenu();
        return this._super();
    },

    // Private
    /**
     * Iterate bus notifications
     * @private
     */
    _onNotification: function (notifications) {
        var self = this;
        _.each(notifications, function (notification) {
            self._handleNotification(notification);
        });
    },
    /**
     * On every bus notification schedule update of all progress and pass progress message to progress bar
     * @private
     */
    _handleNotification: function(notification){
        if (this.channel && (notification[0] === this.channel)) {
            // this._setTimerProgressPreview();
            var progress = notification[1][0];
            this._processProgressData(progress.code, progress.state, progress.uid);
            if (['ongoing', 'done'].indexOf(progress.state) >= 0) {
                core.bus.trigger('rpc_progress', notification[1])
            }
        }
    },
    // /**
    //  * Make RPC and get progress details
    //  * @private
    //  */
    // _getProgressData: function(){
    //     var self = this;
    //
    //     return self._rpc({
    //         model: 'web.progress',
    //         method: 'get_all_progress',
    //         kwargs: {
    //             context: session.user_context,
    //         },
    //     },{'shadow': true}).then(function (data) {
    //         self.progress_data = data;
    //     });
    // },
    /**
     * Add progress bar
     * @private
     */
    _addProgressBar: function(code) {
        var progress_bar = this._findProgressBar(code);
        if (progress_bar) {
            return;
        }
        progress_bar = new ProgressBar(this, code);
        this.progress_bars[code] = progress_bar;
        progress_bar.appendTo(this.$progresses_preview);
        this._updateProgressMenu();
    },
    /**
     * Remove progress bar
     * @private
     */
    _removeProgressBar: function(code) {
        var progress_bar = this._findProgressBar(code);
        if (progress_bar) {
            progress_bar.destroy();
            delete this.progress_bars[code];
            this._updateProgressMenu();
        }
    },
    /**
     * Find progress bar
     * @private
     */
    _findProgressBar: function(code) {
        var found_bar = false;
        if (this.progress_bars.hasOwnProperty(code)) {
            found_bar = this.progress_bars[code];
        }
        return found_bar;
    },
    /**
     * Update counter and style of progress menu
     * @private
     */
    _updateProgressMenu: function() {
        var session_uid = this.getSession().uid;
        this.progressCounter = Object.keys(this.progress_bars).length;
        this.$('.o_notification_counter').text(this.progressCounter);
        if (this.progressCounter > 0) {
            this.$('.fa-spinner').addClass('fa-spin');
            this.$el.removeClass('o_no_notification');
        } else {
            this.$('.fa-spinner').removeClass('fa-spin');
            this.$el.addClass('o_no_notification');
        }
        if (!this.getSession().is_admin) {
            this.$el.toggleClass('hidden', !this.progressCounter);
        }
    },
    /**
     * Process and display progress details
     * @private
     */
    _processProgressData: function(code, state, uid) {
        var session_uid = this.getSession().uid;
        var session_is_admin = this.getSession().is_admin;
        var progress_bar = this._findProgressBar(code);
        if (session_uid !== uid && !session_is_admin) {
            return;
        }
        if (!progress_bar && state === 'ongoing') {
            this._addProgressBar(code);
        }
        if (progress_bar && state === 'done') {
            this._removeProgressBar(code);
        }
    },
    /**
     * Get particular model view to redirect on click of progress scheduled on that model.
     * @private
     * @param {string} model
     */
    _getProgressModelViewID: function (model) {
        return this._rpc({
            model: model,
            method: 'get_progress_view_id'
        });
    },
    /**
     * Check wether progress systray dropdown is open or not
     * @private
     * @returns {boolean}
     */
    _isOpen: function () {
        return this.$el.hasClass('open');
    },
    // /**
    //  * Schedule update of all progress
    //  * @private
    //  */
    // _setTimerProgressPreview: function () {
    //     var self = this;
    //     if (!self.progress_timer) {
    //         self.progress_timer = setTimeout(function () {
    //             self.progress_timer = true;
    //             self._updateProgressPreview();
    //         }, progress_timeout);
    //     }
    // },
    // /**
    //  * Update(render) progress system tray view on progress update.
    //  * @private
    //  */
    // _updateProgressPreview: function () {
    //     var self = this;
    //     self._getProgressData().then(function (){
    //         self.progress_timer = false;
    //         self._processProgressData();
    //     });
    // },
    // /**
    //  * When menu clicked update progress preview if counter updated
    //  * @private
    //  * @param {MouseEvent} event
    //  */
    // _onProgressMenuClick: function () {
    //     if (!this._isOpen()) {
    //         this._updateProgressMenu();
    //     }
    // },

});

SystrayMenu.Items.push(ProgressMenu);

return {
    ProgressMenu: ProgressMenu,
};
});
