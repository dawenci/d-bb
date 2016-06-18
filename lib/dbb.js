var Dbb = {};

Dbb.Collection = Backbone.Collection;
Dbb.Model = Backbone.Model;
Dbb.Events = Backbone.Events;
Dbb.eventBus = _.extend({}, Dbb.Events);
Dbb.$ = Backbone.$;


Dbb.triggerEventMethod = function(name) {
    if (_.isFunction(this[name])) this[name].apply(this, _.rest(arguments));
    if (_.isFunction(this.trigger)) this.trigger.apply(this, _.toArray(arguments));
};


// DbbObject 对象基类，控制器等由此派生
function DbbObject() {
    this._isRetained = 1;
    this._eventBus = Dbb.eventBus;
}

DbbObject.extend = Dbb.Model.extend;

_.extend(DbbObject.prototype, Dbb.Events, {

    dealloc: function () {
        if (!this.isRetained()) return this;

        delete this._isRetained;
        this.stopListening();
        this.triggerEventMethod('didDealloc');
        this._eventBus.off(null, null, this);
        this.off();
        _.each(_.keys(this), function(prop) { delete this[prop]; }, this);
        return this;
    },

    broadcast: function broadcast() {
        this._eventBus.trigger.apply(this._eventBus, _.toArray(arguments));
        return this;
    },

    listenToBus: function listenToBus(name, callback) {
        this.listenTo(this._eventBus, name, callback);
        return this;
    },

    isRetained: function isRetained() { return _.has(this, '_isRetained') && this._isRetained; },
    isDealloc: function isDealloc() { return !this._isRetained || !_.has(this, '_isRetained'); },

    triggerEventMethod: Dbb.triggerEventMethod,
});

Dbb.DbbObject = DbbObject;


module.exports = Dbb;
