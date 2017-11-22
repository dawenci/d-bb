
// 调用钩子函数、触发同名事件
exports.callHook = function(name) {
    // 'after:send' => 'afterSend'
    let method = _.map(String(name).split(':'),
    (s,i)=>i>0?s.charAt(0).toUpperCase()+s.slice(1):s).join('')

    if (_.isFunction(this[method])) {
        this[method].apply(this, _.rest(arguments))
    } 
    if (_.isFunction(this.trigger)) this.trigger.apply(this, _.toArray(arguments))
    return this
}
