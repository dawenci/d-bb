var _slice = Array.prototype.slice;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var Events = Backbone.Events;


function Dbb(options) {
    if (!(this instanceof Dbb)) {
        return new Dbb(options);
    }
    options = _.extend({}, options || {});
    this.options = options;
    this.initialize.apply(this, arguments);
}

Dbb.extend = Backbone.Model.extend;
Dbb.Events = Events;

_.extend(Dbb.prototype, Events, {
    initialize: function () {},

    dealloc: function (options) {
        options = options || {};
        Dbb.triggerEventMethod('willDealloc');
        Dbb.triggerEventMethod('didDealloc');
        this.stopListening();
        this.off();
        for (var p in this) {
            if (_hasOwnProperty.call(this, p)) {
                delete this[p];
            }
        }
        return this;
    }
});
_.extend(Dbb, Events);



Dbb.triggerEventMethod = function(age) {
    if (typeof this[age] === 'function') {
        this[age].apply(this, _slice.call(arguments, 1));
    }
    if (typeof this.trigger === 'function') {
        this.trigger.apply(this, _slice.call(arguments, 0));
    }
};


Dbb.log = function() {
    try {
        if (window.console && window.console.log) {
            window.console.log.apply(window.console, Array.prototype.slice.call(arguments, 0));
        }
    } catch(e) {}
};


Dbb.error = function() {
    try {
        if (window.console && window.console.error) {
            window.console.error.apply(window.console, Array.prototype.slice.call(arguments, 0));
        }
    } catch(e) {}
};

module.exports = Dbb;
