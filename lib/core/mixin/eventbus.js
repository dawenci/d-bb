var eventbus = _.extend({}, Backbone.Events)

exports.broacast = function broacast() {
  eventbus.trigger.apply(eventbus, _.toArray(arguments))
  return this
}

exports.listenToBus = function listenToBus(name, callback) {
  var ctx = _.isFunction(this.listenTo) ? this : eventbus 
  ctx.listenTo(eventbus, name, callback)
  return this
}