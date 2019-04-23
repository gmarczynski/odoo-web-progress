odoo.define('web_progress.ProgressMenu', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var SystrayMenu = require('web.SystrayMenu');
var Widget = require('web.Widget');

var QWeb = core.qweb;

/**
 * Progress menu item in the systray part of the navbar
 */
var ProgressMenu = Widget.extend({
    template:'web_progress.ProgressMenu',
    events: {
        "click": "_onProgressMenuClick",
        // "click .o_progress_preview": "_onProgressFilterClick",
    },
    start: function () {
        this.$progresses_preview = this.$('.o_progress_navbar_dropdown_channels');
        // chat_manager.is_ready.then(this._updateCounterPlus.bind(this));
        this._updateProgressPreview();
        return this._super();
    },

    // Private

    /**
     * Make RPC and get progress details
     * @private
     */
    _getProgressData: function(){
        var self = this;

        return self._rpc({
            model: 'web.progress',
            method: 'get_all_ongoing_progress',
            kwargs: {
                context: session.user_context,
            },
        }).then(function (data) {
            self.progress_data = data;
            self.progressCounter = data.length;
            self.$('.o_notification_counter').text(self.progressCounter);
            if (self.progressCounter > 0) {
                self.$('.fa-spinner').addClass('fa-spin');
            } else {
                self.$('.fa-spinner').removeClass('fa-spin');
            }
            self.$el.toggleClass('o_no_notification', !self.progressCounter);
        });
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
    /**
     * Update(render) progress system tray view on progress updation.
     * @private
     */
    _updateProgressPreview: function () {
        var self = this;
        self._getProgressData().then(function (){
            var html = QWeb.render('web_progress.ProgressMenuPreview', {
                progress_data : self.progress_data
            });
            self.$progresses_preview.html(html);
        });
    },
    /**
     * When menu clicked update progress preview if counter updated
     * @private
     * @param {MouseEvent} event
     */
    _onProgressMenuClick: function () {
        if (!this._isOpen()) {
            this._updateProgressPreview();
        }
    },

});

SystrayMenu.Items.push(ProgressMenu);

return {
    ProgressMenu: ProgressMenu,
};
});
