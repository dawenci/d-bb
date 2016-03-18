var _slice = Array.prototype.slice;
var Events = Backbone.Events;

var Dbb = {};
Dbb.Collection = Backbone.Collection;
Dbb.Model = Backbone.Model;
Dbb.Events = Events;
Dbb.eventBus = _.extend({}, Events);
Dbb.$ = Backbone.$;
Dbb.Velocity = $.Velocity;

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

Dbb.guid = function(prefix, numLen) {
    prefix || (prefix = '');
    numLen || (numLen = 4);
    return prefix + (new Date().getTime()) + String(Math.random()).slice(numLen * -1);
};

module.exports = Dbb;
