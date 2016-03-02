var Dbb = require('./dbb');

Dbb.ControllerManager = Dbb.extend({
    constructor: function DbbCtrlMgr(options) {
        options || (options = {});
        this.cid = _.uniqueId('ctrl_mgr');
        if (options.el) {
            this.el = (typeof options.el === 'function') ? options.el() : options.el;
        }
        Dbb.call(this, options);
    },

    setEl: function(el) {
        this.el = el;
    },

    setCtrl: function(name, ctrl, options) {
        options || (options = {});
        if (options.autoRelease === undefined) {
            options.autoRelease = true;
        }
        this._map || (this._map = {});
        this._map[name] = {ctrlClass: ctrl, instance: null, options: options};
    },

    load: function(name, options) {
        var manager = this;
        var ctrl, prevCtrl;

        options = _.extend({}, options || {});
        if (!manager.el) {
            return Dbb.error('ControllerManager('+ manager.cid +')必须配置关联的DOM元素');
        }
        if (!manager._map || !manager._map[name]) {
            return Dbb.error('未找到名为'+ name +'的控制器');
        }


        ctrl = manager._map[name];
        // 实例未创建过，或已经销毁，则重新创建实例
        // 实例已经存在，但使用强制重新加载，也销毁当前存在的实例并重新创建
        if (ctrl.instance === null || ctrl.instance._isDealloc) {
            ctrl.instance = new ctrl.ctrlClass();
        } else if (options.forceReload) {
            ctrl.instance.dealloc();
            ctrl.instance = new ctrl.ctrlClass();
        }

        // 存在激活状态的控制器，先取消激活状态再处理需要load的控制器
        // 否则直接将需要load的控制器设置为激活状态。
        if (prevCtrl = manager._current) {
            manager._animateOut(prevCtrl, function(){
                if (prevCtrl.options.autoRelease) {
                    prevCtrl.instance.dealloc();
                }

                ctrl.instance.view.el.style.display = 'none';
                ctrl.instance.view.mountToEl(manager.el);
                manager._animateIn(ctrl);
                manager._current = ctrl;
            });
        } else {
            ctrl.instance.view.mountToEl(manager.el);
            manager._current = ctrl;
        }
    },

    _animateOut: function(ctrl, cb) {
        ctrl.instance.view.$el.stop(false, true).fadeOut(130, cb);
    },

    _animateIn: function(ctrl, cb) {
        ctrl.instance.view.$el.stop(false, true).fadeIn(130, cb);
    },

});

module.exports = Dbb;
