var _slice = Array.prototype.slice;
var Events = Backbone.Events;
var _hasOwnProperty = Object.prototype.hasOwnProperty;

var Dbb = {};
Dbb.Collection = Backbone.Collection;
Dbb.Model = Backbone.Model;
Dbb.Events = Events;
Dbb.eventBus = _.extend({}, Events);
Dbb.$ = Backbone.$;
Dbb.triggerEventMethod = function(age) {
    if (typeof this[age] === 'function') {
        this[age].apply(this, _slice.call(arguments, 1));
    }
    if (typeof this.trigger === 'function') {
        this.trigger.apply(this, _slice.call(arguments, 0));
    }
};


function DbbObject(options) {
    options = _.extend({}, options || {});
    this.options = options;
    this.initialize.apply(this, arguments);
}
DbbObject.extend = Dbb.Model.extend;
_.extend(DbbObject.prototype, Dbb.Events, {
    initialize: function () {},

    triggerEventMethod: Dbb.triggerEventMethod,

    dealloc: function (options) {
        if (this._isDealloc) return this;
        options = _.extend({}, this.options, options || {});
        this.triggerEventMethod('willDealloc');
        this.triggerEventMethod('didDealloc');
        this.stopListening();
        this.off();
        for (var p in this) {
            if (_hasOwnProperty.call(this, p)) delete this[p];
        }
        this._isDealloc = true;
    }
});
Dbb.DbbObject = DbbObject;


module.exports = Dbb;
