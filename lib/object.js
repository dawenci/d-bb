var Dbb = require('./dbb');
var _hasOwnProperty = Object.prototype.hasOwnProperty;

Dbb.DbbObject = function DbbObject(options) {
    options = _.extend({}, options || {});
    this.options = options;
    this.initialize.apply(this, arguments);
}

Dbb.DbbObject.extend = Dbb.Model.extend;

_.extend(Dbb.DbbObject.prototype, Dbb.Events, {
    initialize: function () {},

    triggerEventMethod: Dbb.triggerEventMethod,

    dealloc: function (options) {
        if (this._isDealloc) {
            return this;
        }
        options = options || {};
        this.triggerEventMethod('willDealloc');
        this.triggerEventMethod('didDealloc');
        this.stopListening();
        this.off();
        for (var p in this) {
            if (_hasOwnProperty.call(this, p)) {
                delete this[p];
            }
        }
        this._isDealloc = true;
    }
});

module.exports = Dbb;
