odoo.define('web.progress.loading', function (require) {
"use strict";

/**
 * Loading Progress Bar
 */

var core = require('web.core');
var Loading = require('web.Loading');

var _t = core._t;
var progress_timeout = 5000;

Loading.include({

    init: function(parent) {
        this._super(parent);
        this.progress_timers = {};
        core.bus.on('rpc_progress_request', this, this.add_progress);
        core.bus.on("rpc_progress_result", this, this.remove_progress);
        core.bus.on("rpc_progress_cancel", this, this.cancel_progress);
        core.bus.on("rpc_progress_background", this, this.move_to_background);
    },
    destroy: function() {
        for (var key in this.progress_timers) {
            if (this.progress_timers.hasOwnProperty(key)) {
                clearTimeout(this.progress_timers[key]);
            }
        }
        this._super();
    },
    progress: function(progress_code) {
        var self = this;
        this._rpc({
                model: 'web.progress',
                method: 'get_progress',
                args: [progress_code]
            }, {'shadow': true}).then(function (result_list) {
                // console.debug(result_list);
                if (result_list.length > 0) {
                    var result = result_list[0];
                    if (['ongoing', 'done'].indexOf(result.state) >= 0) {
                        core.bus.trigger('rpc_progress', result_list)
                    }
                    if (progress_code in self.progress_timers) {
                        self.progress_timers[progress_code] = setTimeout(function () {
                            if ('progress' in self) {
                                self.progress(progress_code)
                            }
                        }, progress_timeout);
                    }
                }
        })
    },
    move_to_background: function() {
        this.count = 0;
        // TODO: add move to background
    },
    cancel_progress: function(progress_code) {
        var self = this;
        this._rpc({
                model: 'web.progress',
                method: 'cancel_progress',
                args: [progress_code]
            }, {'shadow': true}).then(function() {})
    },
    add_progress: function(progress_code) {
        var self = this;
        this.progress_timers[progress_code] = setTimeout(function () {
            if ('progress' in self) {
                self.progress(progress_code)
            }
        }, progress_timeout);
    },
    remove_progress: function(progress_code) {
        if (progress_code in this.progress_timers) {
            clearTimeout(this.progress_timers[progress_code]);
            delete this.progress_timers[progress_code];
        }
    }
});

return {
    Loading: Loading,
    progress_timeout: progress_timeout,
};
});

