
// 调用钩子函数、触发同名事件
exports.callHook = function(name) {
    // 'after:send' => 'afterSend'
    let method = _.map(
        String(name).split(':'),
        (part, index) => (index > 0) ? part.charAt(0).toUpperCase() + part.slice(1) : part
    ).join('')

    if (_.isFunction(this[method])) {
        this[method].apply(this, _.rest(arguments))
    } 
    if (_.isFunction(this.trigger)) {
        // this.trigger(...arguments)
        this.trigger.apply(this, _.toArray(arguments))
    }
    return this
}
