'use strict'

var utils = require('./mixin/utils')
var lifeCircle = require('./mixin/life-circle')
var eventbus = require('./mixin/eventbus')

// DbbObject 对象基类，控制器等由此派生
function DbbObject() {
    this.__isRetained__ = 1
}

// 定义原型方法
_.extend(DbbObject.prototype, Dbb.Events, {
    $isRetained: lifeCircle.isRetained,
    $isDealloc: lifeCircle.isDealloc,
    $callHook: utils.callHook,
    $broadcast: eventbus.broacast,
    $listenToBus: eventbus.listenToBus,
    $dealloc: function () {
        if (!this.$isRetained()) return this

        delete this.__isRetained__
        this.stopListening()
        this.$callHook('didDealloc')
        this.off()
        _.each(_.keys(this), function(prop) { delete this[prop]; }, this)
        return this
    }
})

// 可以基于 DbbObject 派生出子类
DbbObject.extend = Dbb.Model.extend

module.exports = DbbObject
