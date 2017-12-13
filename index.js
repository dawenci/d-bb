'use strict'

// 导入配置
require('./lib/config')

const Events = require('./lib/core/events')
const eventbus = require('./lib/core/mixin/eventbus')
const Dbb = {}

Dbb.$broadcast     = eventbus.broacast
Dbb.$listenToBus   = eventbus.listenToBus
Dbb.$              = Backbone.$
Dbb.Events         = Events
Dbb.Collection     = require('./lib/core/collection')
Dbb.Model          = require('./lib/core/model')
Dbb.View           = require('./lib/core/view')
Dbb.CollectionView = require('./lib/collection-view')

module.exports = window.Dbb = Dbb
