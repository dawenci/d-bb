'use strict'

// 执行配置
require('./lib/config')


var eventbus = require('./lib/core/mixin/eventbus')
var Dbb = window.Dbb = {}
Dbb.$broadcast = eventbus.broacast
Dbb.$listenToBus = eventbus.listenToBus

Dbb.Collection     = Backbone.Collection
Dbb.Model          = Backbone.Model
Dbb.Events         = Backbone.Events
Dbb.$              = Backbone.$
Dbb.View           = require('./lib/core/view')
Dbb.CollectionView = require('./lib/collection-view')

module.exports = Dbb
