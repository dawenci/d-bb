var Dbb = {}

Dbb.Collection = Backbone.Collection
Dbb.Model = Backbone.Model
Dbb.Events = Backbone.Events
Dbb.eventBus = _.extend({}, Dbb.Events)
Dbb.$ = Backbone.$


Dbb.$callHook = function(name) {
    if (_.isFunction(this[name])) this[name].apply(this, _.rest(arguments))
    if (_.isFunction(this.trigger)) this.trigger.apply(this, _.toArray(arguments))
}

// 检查对象是否被retained，即是否未被销毁
// 1. has own property '__isRetained__' ?  2. __isRetained__ == true ?
Dbb.$isRetained = function() {
    return _.has(this, '__isRetained__') && !!this.__isRetained__
}

// 检查对象是否已经销毁
Dbb.$isDealloc = function() {
    return !this.__isRetained__ || !_.has(this, '__isRetained__')
}


// DbbObject 对象基类，控制器等由此派生
function DbbObject() {
    this.__isRetained__ = 1
    this.__eventBus__ = Dbb.eventBus
}

DbbObject.extend = Dbb.Model.extend

_.extend(DbbObject.prototype, Dbb.Events, {

    $dealloc: function () {
        if (!this.$isRetained()) return this

        delete this.__isRetained__
        this.stopListening()
        this.$callHook('didDealloc')
        this.__eventBus__.off(null, null, this)
        this.off()
        _.each(_.keys(this), function(prop) { delete this[prop]; }, this)
        return this
    },

    broadcast: function() {
        this.__eventBus__.trigger.apply(this.__eventBus__, _.toArray(arguments))
        return this
    },

    listenToBus: function(name, callback) {
        this.listenTo(this.__eventBus__, name, callback)
        return this
    },

    $isRetained: Dbb.$isRetained,

    $isDealloc: Dbb.$isDealloc,

    $callHook: Dbb.$callHook,
});

Dbb.DbbObject = DbbObject


module.exports = Dbb
