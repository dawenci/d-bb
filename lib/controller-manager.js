var Dbb = require('./dbb');

Dbb.ControllerManager = Dbb.DbbObject.extend({
    constructor: function DbbCtrlMgr(options) {
        options || (options = {});
        this.cid = _.uniqueId('ctrl_mgr');
        options.el && this.setEl(options.el);
        Dbb.DbbObject.call(this, options);
    },

    setEl: function(el) {
        if (typeof el === 'function') {
            el = el();
        } else if (typeof el === 'string') {
            el = document.querySelector(el);
        }
        this.el = el;
        return this;
    },

    getCtrl: function(name) {
        return this._map && this._map[name];
    },

    setCtrl: function(name, ctrl, options) {
        options || (options = {});
        if (options.autoRelease === undefined) {
            options.autoRelease = true;
        }
        this._map || (this._map = {});
        if (this._map[name]) {
            Dbb.error('已存在名为' +name+ '的控制器，请先使用removeCtrl再setCtrl');
            return this;
        }
        this._map[name] = {name: name, ctrlClass: ctrl, instance: null, options: options};
        return this;
    },

    removeCtrl: function(name) {
        if (!this._map || !this._map[name]) {
            return this;
        }
        this._map[name].instance && this._map[name].instance.dealloc();
        this._map[name] = undefined;
        return this;
    },

    load: function(name, options) {
        var manager = this;
        var ctrl;

        if (!manager.el) {
            return Dbb.error('ControllerManager('+manager.cid+')必须配置关联的DOM元素');
        }
        if (!manager._map || !manager._map[name]) {
            return Dbb.error('未找到名为'+name+'的控制器');
        }

        ctrl = manager._map[name];
        options = _.extend({}, ctrl.options, options || {});
        // 实例未创建过，或已经销毁，则重新创建实例
        // 实例已经存在，但使用强制重新加载，也销毁当前存在的实例并重新创建
        if (ctrl.instance === null) {
            ctrl.instance = new ctrl.ctrlClass(options);
        } else if (options.forceReload) {
            ctrl.instance.dealloc();
            ctrl.instance = new ctrl.ctrlClass(options);
        }

        // 存在激活状态的控制器，先取消激活状态再处理需要load的控制器
        // 否则直接将需要load的控制器设置为激活状态。
        if (manager._current) {
            manager.unload(options);
            ctrl.instance.view.$el.velocity('fadeIn', {
                delay: 100,
                duration: 200,
                display: '',
                complete: function(el) {
                    ctrl.instance.view.mountToEl(manager.el);
                    manager._current = ctrl;
                }
            });
        } else {
            ctrl.instance.view.mountToEl(manager.el);
            manager._current = ctrl;
        }

        // 发射控制器加载完毕的全局事件
        Dbb.eventBus.trigger('controllerDidLoad', { name: name, controller: ctrl });

        return this;
    },

    unload: function(options) {
        var manager = this;
        var ctrl = this._current;
        // 外部手工调用时，可能出现这种情况
        if (!ctrl) {
            return this;
        }
        options = _.extend({}, ctrl.options, options || {});
        ctrl.instance.view.$el.velocity('fadeOut', {
            duration: 100,
            complete: function(el) {
                if (options.autoRelease) {
                    ctrl.instance.dealloc();
                    ctrl.instance = null;
                    manager._current = null; // 必须
                }
            }
        });
    },

    dealloc: function(options) {
        if (this._isDealloc) { return this; }

        if (this._map) {
            for (var name in this._map) {
                this._map[name].instance && this._map[name].instance.dealloc();
            }
        }
        Dbb.DbbObject.prototype.dealloc.call(this, options);
        return this;
    }
});

module.exports = Dbb;
