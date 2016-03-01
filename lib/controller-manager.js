var Dbb = require('./dbb');

Dbb.ControllerManager = Dbb.extend({
    loadCtrl: function(ctrl, options) {
        if (this._controller) {
            this.unLoadCtrl(options);
        }
        this._controller = new ctrl();
        this._controller.view.mountToEl(window.document.body);
    },

    unLoadCtrl: function(options) {
        this._controller.dealloc();
        this._controller = null;
    }
});

module.exports = Dbb;
