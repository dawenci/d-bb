
// 检查对象是否被retained，即是否未被销毁
// 1. has own property '__isRetained__' ?
// 2. __isRetained__ == true ?
exports.isRetained = function() {
    return _.has(this, '__isRetained__') && !!this.__isRetained__
}


// 检查对象是否已经销毁
exports.isDealloc = function() {
    return !this.__isRetained__ || !_.has(this, '__isRetained__')
}