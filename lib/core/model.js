'use strict'

const utils = require('./mixin/utils')
const eventbus = require('./mixin/eventbus')

const DbbModel = Backbone.Model.extend({
  constructor: function DbbModel(options) {
    if (!(this instanceof DbbModel)) return new DbbModel(options)

    // 调用父类构造函数
    // 顺序不能变，否则在继承DbbView的子类中，initialize会早于constructor执行，
    // 导致this.options的值是undefined
    Backbone.Model.call(this, options)    
  },

  $broadcast: eventbus.broacast,
  $listenToBus: eventbus.listenToBus,

  $callHook: utils.callHook,

  // 可覆盖，视图数据优先读取改属性，
  // 其次才是读取 .toJSON() 的数据
  // 这样就可以在共享 model 的多个 view 中
  // 统一输出一些个性化定制的数据
  $toDataForView() {
    return this.toJSON()
  }
})

module.exports = DbbModel
