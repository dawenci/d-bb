'use strict'

const utils = require('./mixin/utils')
const eventbus = require('./mixin/eventbus')

const DbbCollection = Backbone.Collection.extend({
  constructor: function DbbCollection(options) {
    if (!(this instanceof DbbCollection)) return new DbbCollection(options)

    // 调用父类构造函数
    // 顺序不能变，否则在继承DbbView的子类中，initialize会早于constructor执行，
    // 导致this.options的值是undefined
    Backbone.Collection.call(this, options)    
  },

  $broadcast: eventbus.broacast,
  $listenToBus: eventbus.listenToBus,

  $callHook: utils.callHook
})

module.exports = DbbCollection
