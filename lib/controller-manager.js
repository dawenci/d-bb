var Dbb = require('./dbb'),
    DbbObj = Dbb.DbbObject,
    emptyFn = function() {};


var DbbCtrlMgr = Dbb.DbbObject.extend({

    constructor: function DbbCtrlMgr(options) {
        DbbObj.call(this);

        options = _.extend({}, options || {});
        _.extend(this, _.pick(options, ['params']));
        this.options = _.omit(options, []);
        this.cid = _.uniqueId('ctrl_mgr');

        if (options.el) this.$setEl(options.el);
        this.initialize.apply(this, _.toArray(arguments));
    },

    initialize: emptyFn,

    $dealloc: function(options) {
        if (!this.$isRetained()) return this;
        this.$callHook('willDealloc');
        _.each(this._map, function(item){
            if (item.instance) item.instance.$dealloc();
        });
        DbbObj.prototype.$dealloc.call(this, options);
        return this;
    },

    $setEl: function(el) {
        if (_.isString(el)) el = document.querySelector(el);
        this.el = el;
        return this;
    },

    $getCtrl: function(name) {
        return this._map && this._map[name];
    },

    $addCtrl: function(name, ctrl, options) {
        options = _.extend({}, this.options, options || {});

        if (options.autoRelease === undefined) options.autoRelease = true;
        if (!this._map) this._map = {};
        if (this._map[name]) return this; // console.error('已存在名为' +name+ '的控制器，请先使用$removeCtrl再$addCtrl');

        this._map[name] = {name: name, ctrlClass: ctrl, instance: null, options: options};
        return this;
    },

    $removeCtrl: function(name) {
        if (!this._map || !this._map[name]) return this;
        if (this._map[name].instance) this._map[name].instance.$dealloc();
        delete this._map[name];
        return this;
    },

    $load: function(name, options, callback) {
        var self, ctrl;

        self = this;

        if (!this.el) throw new Error('ControllerManager('+ this.cid +')必须配置关联的DOM元素');
        ctrl = this.$getCtrl(name);
        if (!ctrl) throw new Error('未找到名为' + name + '的控制器');

        options = _.extend({}, ctrl.options, options || {});

        // 实例未创建过，或已经销毁，则重新创建实例
        // 实例已经存在，但使用强制重新加载，也销毁当前存在的实例并重新创建
        if (ctrl.instance === null) {
            ctrl.instance = new ctrl.ctrlClass(options);
        } else if (options.forceReload) {
            ctrl.instance.$dealloc();
            ctrl.instance = new ctrl.ctrlClass(options);
        }
        this.broadcast('controllerWillLoad', ctrl);
        ctrl.instance.$callHook('controllerWillLoad', ctrl);

        ctrl.instance.view.el.style.opacity = '0';
        ctrl.instance.view.el.style.transition = 'opacity .15s';

        // 存在激活状态的控制器，先取消激活状态再处理需要load的控制器
        // 否则直接将需要load的控制器设置为激活状态。
        if (this._current) {
            this.$unload(this._current, options, function() {
                self._current = ctrl;
                ctrl.instance.view.$mountToEl(self.el);
                ctrl.instance.view.el.style.opacity = '1';
                if (callback) callback();

                ctrl.instance.$callHook('controllerDidLoad', ctrl);
                self.broadcast('controllerDidLoad', ctrl);
            });
        } else {
            this._current = ctrl;
            ctrl.instance.view.$mountToEl(this.el);
            ctrl.instance.view.el.style.opacity = '1';
            if (callback) callback();

            ctrl.instance.$callHook('controllerDidLoad', ctrl);
            this.broadcast('controllerDidLoad', ctrl);
        }

        // 发射控制器加载完毕的全局事件
        return this;
    },

    $unload: function(ctrl, options, callback) {
        var self = this;

        ctrl = ctrl || this._current;

        // 外部手工调用时，可能出现这种情况
        if (!ctrl) return this;

        this.broadcast('controllerWillUnload', ctrl);
        ctrl.instance.$callHook('controllerWillUnload');

        options = _.extend({}, ctrl.options, options || {});
        this._current = null;

        ctrl.instance.view.el.style.opacity = '0'; // transition .15s
        setTimeout(function() {
            if (_.isFunction(callback)) callback();


            ctrl.instance.$callHook('controllerDidUnload', ctrl);
            self.broadcast('controllerDidUnload', ctrl);
            if (options.autoRelease) {
                ctrl.instance.$dealloc();
                ctrl.instance = null;
            }
        }, 150);

        return this;
    },


});

module.exports = DbbCtrlMgr;
