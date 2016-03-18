(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Dbb = window.Dbb = require('../index.js');

},{"../index.js":2}],2:[function(require,module,exports){
var Dbb = require('./lib/dbb');
require('./lib/view');
require('./lib/collection-view');
require('./lib/item-view');
require('./lib/scroll-view');
require('./lib/view-manager');
require('./lib/helpers');

module.exports = Dbb;

},{"./lib/collection-view":3,"./lib/dbb":4,"./lib/helpers":5,"./lib/item-view":6,"./lib/scroll-view":7,"./lib/view":9,"./lib/view-manager":8}],3:[function(require,module,exports){
var Dbb = require('./dbb');

Dbb.CollectionView = Dbb.View.extend({
    initialize: function() {
        this.listenTo(this.collection, 'add', this._addItem);
        this.listenTo(this.collection, 'remove', this._removeItem);
        this.listenTo(this.collection, 'reset', this._resetItems);
        this.listenTo(this.collection, 'sort', this._sortItems);
    },

    _addItem: function(model, collection, options) {
        var view = this.viewForItem(model);
        view.render().el.style.opacity = .5;
        this.addSubView(view);
        setTimeout(function(){ view.el.style.opacity = 1; },150);
        return this;
    },

    _removeItem: function(model, collection, options) {
        this._hasSubView() && this.removeSubView({atIndex: options.index});
        return this;
    },

    _resetItems: function(collection, options) {
        var views = [];
        var self = this;
        this.emptySubViews();
        collection.each(function(model, i, collection){
            var view = this.viewForItem(model);
            views.push(view);
        }, this);

        this.el.style.opacity = .5;
        this.addSubView(views);

        setTimeout(function(){
            self.el.style.opacity = 1;
        },150);

        return this;
    },

    _sortItems: function(collection, options) {
        var fragment, tempArr, subViews, len, i, mountPoint, display;
        if (!this._hasSubView()) {
            return this;
        }
        // 先排序
        tempArr = [];
        subViews = this._subViews;
        len = subViews.length;
        for (i = 0; i < len; i += 1) {
            tempArr[collection.indexOf(subViews[i].model)] = subViews[i];
        }

        // 执行变更
        this._subViews = tempArr;
        mountPoint = this.mountPointForSubView();
        display = mountPoint.style.display;
        mountPoint.style.display = 'none';
        fragment = document.createDocumentFragment();
        this._subViews.forEach(function(view) {
            fragment.appendChild(view.el);
        });
        mountPoint.style.display = display;
        mountPoint.appendChild(fragment);
        return this;
    },

    viewForItem: function(model) {
        Dbb.error('collectionView 的 viewForItem 必须实现');
    },

    // 可重写，如何获取子view的el挂载dom容器
    mountPointForSubView: function() {
        return this.el;
    }

});



// View的基类
module.exports = Dbb;

},{"./dbb":4}],4:[function(require,module,exports){
var _slice = Array.prototype.slice;

function Dbb(options) {
    if (!(this instanceof Dbb)) {
        return new Dbb(options);
    }

    this.options = _.extend({}, options || {});
    this.initialize.apply(this, arguments);
}

Dbb.extend = Backbone.Model.extend;

_.extend(Dbb.prototype, Backbone.Events, {
    initialize: function () {},

    dealloc: function (options) {
        options = options || {};
        Dbb.triggerEventMethod('willDealloc');
        Dbb.triggerEventMethod('didDealloc');
        this.stopListening();
        return this;
    }
});

Dbb.Events = Backbone.Events;


Dbb.triggerEventMethod = function(age) {
    if (typeof this[age] === 'function') {
        this[age].apply(this, _slice.call(arguments, 1));
    }
    if (typeof this.trigger === 'function') {
        this.trigger.apply(this, _slice.call(arguments, 0));
    }
};


Dbb.log = function() {
    try {
        if (window.console && window.console.log) {
            window.console.log.apply(window.console, Array.prototype.slice.call(arguments, 0));
        }
    } catch(e) {}
};


Dbb.error = function() {
    try {
        if (window.console && window.console.error) {
            window.console.error.apply(window.console, Array.prototype.slice.call(arguments, 0));
        }
    } catch(e) {}
};

module.exports = Dbb;

},{}],5:[function(require,module,exports){
var Dbb = require('./dbb');



module.exports = Dbb;

},{"./dbb":4}],6:[function(require,module,exports){
var Dbb = require('./dbb');

var _slice = Array.prototype.slice;

Dbb.ItemView = Dbb.View.extend({

});

// View的基类
module.exports = Dbb;

},{"./dbb":4}],7:[function(require,module,exports){
var Dbb = require('./dbb');
var DScroll = require('dscroll');

Dbb.ScrollView = Dbb.View.extend({
    className: 'v-scroll-wrapper',

    optionsForScroll: function() {
        return {};
    },

    shouldRefresh: true,

    refresh: function() {
        var self = this;
        if (!this.scroll) {
            return this;
        }
        // 阻止10ms内的其他refresh调用
        window.clearTimeout(this.refreshTimer);
        // 延迟10ms后refresh
        this.shouldRefresh = true;
        this.refreshTimer = window.setTimeout(function() {
            if (self.shouldRefresh) {
                self.scroll.refresh();
            }
        }, 10);
    },

    mountPointForSubView: function() {
        return this.$el.find('.content').get(0);
    },

    viewDidMount: function() {
        this.scroll = new DScroll(this.el, _.extend({
            probeType: 1,
            mouseWheel: true,
            click: true,
            ev: Dbb.Events
        }, this.optionsForScroll()));
    },

    viewDidRefresh: function() {
        this.scroll = new DScroll(this.el, _.extend({
            probeType: 1,
            mouseWheel: true,
            click: true,
            ev: Dbb.Events
        }, this.optionsForScroll()));
    },

    setPullDownAction: function(action) {
        if (!this.scroll) {
            return this;
        }
        this.scroll.setPullDownAction(action);
        return this;
    },

    setPullUpAction: function(action) {
        if (!this.scroll) {
            return this;
        }
        this.scroll.setPullUpAction(action);
        return this;
    },

    scrollTo: function() {
        if (!this.scroll) {
            return this;
        }
        this.scroll.scrollTo.apply(this.scroll, Array.prototype.slice.call(arguments, 0));
    },

    template: _.template('\
    <div class="scroller v-scroll-scroller">\
        <div class="content v-scroll-content"></div>\
    </div>')
});

module.exports = Dbb;

},{"./dbb":4,"dscroll":12}],8:[function(require,module,exports){
var Dbb = require('./dbb');

Dbb.ViewManager = Dbb.extend({
    initialize: function() {
        console.log('layout init....');
    },

    addMountPoint: function() {
        console.log('add mount point')
    }
});

module.exports = Dbb;

},{"./dbb":4}],9:[function(require,module,exports){
var Dbb = require('./dbb');

var _slice = Array.prototype.slice;

/**
 * @description
 *
 * a View's life cycle:
 *
 * initialize: view 初始化
 * viewWillRender(self): view 即将渲染（生成view.el）
 * viewDidRender(self): view 已经完成渲染
 * viewWillMount(self): view.el 即将挂载到mount chian(顶点是document.documentElement)
 * viewDidMount(self): view.el 已经挂载到mount chain
 * viewWillRefresh(self): 视图即将刷新
 * viewDidRefresh(self): 视图完成刷新
 * viewWillUnMount(self): view.el 即将从mount chain上卸载
 * viewDidUnMount(self): view.el 已经从mount chain上卸载
 * viewWillDealloc(self): view即将销毁
 * viewDidDealloc(self): view已经销毁
 *
 * subView events
 * subViewWillAdd(subView, self, options): 即将添加子视图
 * subViewDidAdd(subView, self, options): 完成添加子视图
 * subViewWillRemove(subView, self, options): 子视图即将移除
 * subViewDidRemove(subView, self, options): 子视图完成移除
 * subViewsWillSort(self): 子视图即将排序
 * subViewsDidSort(self): 子视图完成排序
 *
**/

Dbb.View = Backbone.View.extend({
    constructor: function DbbView(options) {
        // 使用options的拷贝而非引用
        options = _.extend({
            supportLifeCycle: true
        }, options || {});

        Backbone.View.call(this, options);

        // 新版的backbone不会自动创建this.options，这里手工创建
        this.options = options;
    },

    // 确认视图的el是否渲染就绪
    _isRendered: false,

    // 标记已经销毁的视图，已经销毁了就不能再使用
    _isDealloc: false,


    /**
     * @method View#render
     * @description
     * 模板渲染
     */
    render: function(options) {
        var template, fragment, slen, i, _isRefresh;

        // 已经挂载，说明这次render是refresh
        _isRefresh = this._isMounted();

        if (this.options.supportLifeCycle) {
            _isRefresh ?
                this._lifeCycleTrigger('viewWillRefresh', this) :
                this._lifeCycleTrigger('viewWillRender', this);
        }

        // 把子视图移到 fragment 里，以便后续重新渲染当前视图后加回来
        if (this._hasSubView()) {
            slen = this._subViews.length;
            fragment = document.createDocumentFragment();
            for (i = 0; i < slen; i += 1) {
                fragment.appendChild(this._subViews[i].el);
            }
        }

        // render开始，如果存在模板，则渲染相关html
        if ((template = this.templateForView())) {
            this.el.innerHTML = template(this.dataForView(this.model));
        }

        // 将子View 的el 插回来
        fragment && this.mountPointForSubView().appendChild(fragment);

        if (this.options.supportLifeCycle) {
            _isRefresh ?
                this._lifeCycleTrigger('viewDidRefresh', this) :
                this._lifeCycleTrigger('viewDidRender', this);
        }

        this._isRendered = true;
        return this;
    },


    /**
     * @method View#dealloc
     * @description
     * 视图销毁
     */
    dealloc: function () {
        if (this._isDealloc) {
            return this;
        }

        this.options.supportLifeCycle && this._lifeCycleTrigger('viewWillDealloc', this);

        // 递归子视图的清理
        this._hasSubView() && this._subViews.forEach(function(view) {
            view.dealloc();
        });

        this._isDealloc = true;

        this._isRendered = false;

        this.options.supportLifeCycle && this._lifeCycleTrigger('viewDidDealloc', this);

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做dealloc

        // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。
        this.remove();

        // 移除用this.on绑定的事件
        this.off();

        return this;
    },


    /**
     * @method View#mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    mountToEl: function(el, options) {
        if (!this._isElMounted(el)) {
            Dbb.error('the mountPoint is unmounted.');
            return this;
        }
        if (this._isDealloc) {
            Dbb.error('DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.');
            return this;
        }
        if (this._isMounted()) {
            return this;
        }

        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true
        }, options || {});

        if (!this._isRendered) {
            this.render();
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('viewWillMount', this);
        options.shouldPropagateViewWillMount &&
            this._propagateLifeCycleMethod('viewWillMount');

        el.appendChild(this.el);

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('viewDidMount', this);
        options.shouldPropagateViewWillMount &&
            this._propagateLifeCycleMethod('viewDidMount');

        return this;
    },


    /**
     * @method View#addSubView
     * @param {Dbb.View} subView
     * @param {Object} options
     *
     * addSubView(view, options)
     *
     * parent.addSubView(subView, {...});
     * parent.addSubView(subView, {atIndex: index}); // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillMount {Boolean}
     * options.shouldPropagateViewDidMount {bool}
     *
     */
    addSubView: function (views, options) {
        var subViews, subViewsCount,
            viewsCount,
            len, i,
            tempArr, current,
            el,
            atIndex;

        // 处理参数：过滤无效视图
        // views 可能是一个单独的视图，也可能是一个视图数组，分别处理
        if ((len = views.length) === undefined) {
            if (views._isDealloc) {
                Dbb.error('视图 (cid: "' + views.cid + '") 已销毁，无法使用。');
                return this;
            }
            if (views._superview && views._superview === this) {
                return this;
            }
            views = [views];
            viewsCount = 1;
        } else {
            tempArr = views.slice(0);
            views = [];
            for (i = 0; i < len; i += 1) {
                current = tempArr[i];
                if(current._isDealloc) {
                    Dbb.error('视图 (cid: "' + current.cid + '") 已销毁，无法使用。');
                    continue;
                }
                if (current._superview && current._superview === this) {
                    continue;
                }
                views.push(current);
            }
            if (!(viewsCount = views.length)) {
                return this;
            }
        }

        // 处理参数：处理options
        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true,
            atIndex: 'last',
        }, options || {});


        // 局部变量缓存
        subViews = this._subViews || (this._subViews = []);
        subViewsCount = subViews.length;
        el = document.createDocumentFragment();


        // 确定插入点
        atIndex = options.atIndex;
        if (atIndex !== 'first' && atIndex !== 'last' && typeof atIndex !== 'number') {
            Dbb.error('子视图插入点(options.atIndex:' + atIndex + ')无效！重设为last');
            atIndex = 'last';
        }
        if (typeof atIndex === 'number') {
            if(atIndex < 0 || atIndex >= subViewsCount) {
                Dbb.error('子视图插入点(options.atIndex:' + atIndex + ')无效！重设为last');
                atIndex = 'last';
            }
        } else if (atIndex === 'first') {
            atIndex = 0;
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subViewWillAdd', views, this, options);

        // 渲染好模板，准备好DOM以便插入
        if (!this._isRendered) {
            this.render();
        }
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            if (!current._isRendered) {
                current.render();
            }
            el.appendChild(current.el);
        }


        // 如果当前view已经mounted，向所有子类传播viewWillMount
        if (this._isMounted()) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                current.options.supportLifeCycle && current._lifeCycleTrigger('viewWillMount', current);
                options.shouldPropagateViewWillMount && current._propagateLifeCycleMethod('viewWillMount');
            }
        }

        // 先挂载DOM，在插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this.mountPointForSubView().appendChild(el);
            this._subViews = subViews.concat(views);
        } else {
            this.mountPointForSubView().insertBefore(el, subViews[atIndex].el);
            // this._subViews.splice(atIndex, 0, subViews[0]);
            this._subViews = subViews.slice(0, atIndex).concat(views).concat(subViews.slice(atIndex));
        }
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            current._superview = this;
        }


        // 如subView已经mounted，向所有子类传播viewDidMount
        if (this._isMounted()) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                current.options.supportLifeCycle && current._lifeCycleTrigger('viewDidMount', current);
                options.shouldPropagateViewWillMount && current._propagateLifeCycleMethod('viewDidMount');
            }
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subViewDidAdd', views, this, options);

        return this;
    },


    /**
     * @method View#removeSubView
     * @param {Dbb.View} view
     * @param {Object} options
     *
     * @description
     * 移除一个子视图
     *
     * removeSubView([view,] options)
     *
     * parent.removeSubView(subView, {...});
     * parent.removeSubView({atIndex: index}); // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillUnMount {Boolean}
     * options.shouldPropagateViewDidUnMount {bool}
     * options.shouldPreventDealloc {bool}
     *
     */
    removeSubView: function(view, options) {
        var subViews, subViewsCount,
            len, i,
            atIndex;

        if (arguments.length === 1) {
            if (!(view instanceof Dbb.View)) {
                options = view;
                view = null;
            } else {
                options = {};
            }
        }

        if (!this._hasSubView()) {
            return this;
        }

        options = _.extend({
            shouldPropagateViewWillUnMount: true,
            shouldPropagateViewDidUnMount: true,
            shouldPreventDealloc: false
        }, options);

        subViews = this._subViews;
        subViewsCount = subViews.length;


        // 确定atIndex的值
        if (view !== null) {
            if (view._superview === this) {
                atIndex = subViews.indexOf(view);
                if (atIndex === -1) {
                    atIndex = undefined;
                }
            } else {
                Dbb.error('removeSubView参数中的view不是当前View的子视图');
            }
        }
        // options中的atIndex 可能不合法，需要检查
        if (atIndex === undefined) {
            atIndex = options.atIndex;
            if (atIndex === 'first') {
                atIndex = 0;
            } else if (atIndex === 'last') {
                atIndex = subViewsCount - 1;
            } else if (typeof atIndex === 'number') {
                if (atIndex < 0 || atIndex > subViewsCount - 1) {
                    Dbb.error('子视图移除点的值(options.atIndex:' + atIndex + ')无效');
                    return this;
                }
            } else {
                Dbb.error('子视图移除点的值(options.atIndex:' + atIndex + ')无效');
                return this;
            }
        }

        if (view === null) {
            view = subViews[atIndex];
        }

        // 即将移除的subView及index附加到options里，传递给事件处理器
        options.view = view;
        options.atIndex = atIndex;


        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subViewWillRemove', view, this, options);
        subViews.splice(atIndex, 1);
        delete view._superview;


        // 如果当前subView已经mounted，向所有子类传播viewWillUnMount
        if (view._isMounted()) {
            view.options.supportLifeCycle &&
                view._lifeCycleTrigger('viewWillUnMount', view);
            options.shouldPropagateViewWillUnMount &&
                view._propagateLifeCycleMethod('viewWillUnMount');
        }

        this.mountPointForSubView().removeChild(view.el);

        // 如果当前subView已经unmounted，向所有子类传播viewDidUnMount
        if (!view._isMounted()) {
            view.options.supportLifeCycle &&
                view._lifeCycleTrigger('viewDidUnMount', view);
            options.shouldPropagateViewWillUnMount &&
                view._propagateLifeCycleMethod('viewDidUnMount');
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subViewDidRemove', view, this, options);

        if (!options.shouldPreventDealloc) {
            view.dealloc();
        }

        return this;
    },


    emptySubViews: function() {
        var subViews, len, i;
        if (!this._hasSubView()) {
            return this;
        }
        subViews = this._subViews;
        len = subViews.length;
        for (i = 0; i < len; i += 1) {
            subViews[i].dealloc();
        }
        subViews.length = 0;
        return this;
    },


    sortSubViews: function(comparator) {
        var fragment, subViews, len, i, mountPoint, display;
        if (!this._hasSubView() || typeof comparator !== 'function') {
            return this;
        }
        subViews = this._subViews;
        len = subViews.length;
        // 先排序
        subViews.sort(comparator);

        // 执行变更
        mountPoint = this.mountPointForSubView();
        display = mountPoint.style.display;
        mountPoint.style.display = 'none';
        fragment = document.createDocumentFragment();
        for (i = 0; i < len; i += 1) {
            fragment.appendChild(subViews[i].el);
        }
        mountPoint.style.display = display;
        mountPoint.appendChild(fragment);
        return this;
    },


    /**
     * @method View#dataForView
     * @description 视图渲染所需的数据
     */
    dataForView: function(model) {
        var data;
        if (model instanceof Backbone.Model) {
            data = model.toJSON.apply(model, _.rest(arguments));
            data.cid = model.cid;
        } else if (model instanceof Object) {
            data = _.extend({}, model);
        } else {
            data = {};
        }
        return data;
    },


    // 可重写，返回模板
    templateForView: function () {
        var template;
        template = this.options.template || this.template;
        return template;
    },


    // 可重写，如何获取子view的el挂载dom容器
    mountPointForSubView: function() {
        return this.el;
    },


    _lifeCycleTrigger: Dbb.triggerEventMethod,


    _isMounted: function() {
        return this.el && this._isElMounted(this.el);
    },

    _isElMounted: function(el) {
        var docEl = document.documentElement;
        var parent;

        if (docEl.contains) {
            return docEl.contains(el);
        }
        if (docEl.compareDocumentPosition) {
            return !!(docEl.compareDocumentPosition(el) & 16);
        }
        parent = el.parentNode;
        while (parent) {
            if (parent == docEl) {
                return true;
            }
            parent = parent.parentNode;
        }
        return false;
    },

    _hasSubView: function() {
        return !!this._subViews && !!this._subViews.length;
    },

    _propagateLifeCycleMethod: function(method) {
        var subViews, len, i;
        if (this._hasSubView()) {
            subViews = this._subViews;
            len = subViews.length;
            for (i = 0; i < len; i += 1) {
                subViews[i]._lifeCycleTrigger(method, subViews[i]);
                subViews[i]._propagateLifeCycleMethod(method);
            }
        }
    }

});



// View的基类
module.exports = Dbb;

},{"./dbb":4}],10:[function(require,module,exports){
var DEvent = require('./lib/devent');

module.exports = DEvent;

},{"./lib/devent":11}],11:[function(require,module,exports){
'use strict';

var pt,
    toString = Object.prototype.toString,
    isArray = Array.isArray || function(obj) { return toString.call(obj) === '[object Array]'; };


/**
 * @name DEvent
 * @description 事件构造函数（类），可以直接使用，或者作为基类被继承使用
 * @constructor
 */
function DEvent() {
    this._events = {};
}
pt = DEvent.prototype;


/**
 * @method emit
 * @description 发射事件
 */
pt.emit = function (evType) {
    var evList, ev, eLen, aLen, args, a1, a2, i;

    this._events || (this._events = {});

    // 假设该evType下，只有一个事件处理器
    ev = this._events[evType];

    if (!ev) {
        return this;
    }

    aLen = arguments.length;

    // 确认该evType下确实只有一个处理器
    if (typeof ev.callback === 'function') {
        // 把常用的情况单独处理，比全部都使用apply调用执行更快
        switch (aLen) {
        case 1:
            ev.callback.call(ev.ctx);
            break;
        case 2:
            ev.callback.call(ev.ctx, arguments[1]);
            break;
        case 3:
            ev.callback.call(ev.ctx, arguments[1], arguments[2]);
            break;
        default:
            args = new Array(aLen - 1);
            for (i = 1; i < aLen; i += 1) {
                args[i - 1] = arguments[i];
            }
            ev.callback.apply(ev.ctx, args);
        }

    // 该evType其实是个数组的情况（2个事件处理器以上）
    } else if (isArray(ev)) {
        // evList = ev.slice();
        evList = ev;
        eLen = evList.length;

        switch (aLen) {
        case 1:
            for (i = 0; i < eLen; i += 1) {
                (ev = evList[i]).callback.call(ev.ctx);
            }
            break;
        case 2:
            a1 = arguments[1]; // 缓存再参与循环
            for (i = 0; i < eLen; i += 1) {
                (ev = evList[i]).callback.call(ev.ctx, a1);
            }
            break;
        case 3:
            a1 = arguments[1];
            a2 = arguments[2];
            for (i = 0; i < eLen; i += 1) {
                (ev = evList[i]).callback.call(ev.ctx, a1, a2);
            }
            break;
        default:
            args = new Array(aLen - 1);
            for (i = 1; i < aLen; i += 1) {
                args[i - 1] = arguments[i];
            }
            for (i = 0; i < eLen; i += 1) {
                (ev = evList[i]).callback.apply(ev.ctx, args);
            }
        }
    }

    return this;
};


/**
 * @method addListener
 * @description 注册一个事件处理器
 * @param {String} evType 事件类型（名称）
 * @param {Function} fn 事件处理器
 * @param {Object} context 事件处理器的执行上下文
 * @return {DEvent} this
 */
pt.addListener = function (evType, fn, context) {
    var ev, evList, eLen;

    if (typeof fn !== 'function') {
        throw new TypeError('listener must be a function');
    }

    this._events || (this._events = {});

    ev = this._events[evType];

    // 只有一个事件处理器，则不需要保存在数组
    if (!ev) {
        // ev是undefined, 此处只能用this._events[evType]
        this._events[evType] = {callback: fn, context: context, ctx: context || this};

    // 已经是个数组了，则检查是否重复，不重复就push进去
    } else if (isArray(ev)) {
        evList = ev;
        eLen = evList.length;
        while(eLen--) {
            ev = evList[eLen];
            if (ev.context === context && ev.callback === fn) {
                throw new Error('listener cannot be added more than once');
            }
        }

        evList.push({callback: fn, context: context, ctx: context || this});

    // 也不是一个数组，就是说当前传入的是第二个事件处理器。检查不重复的话，转成数组存放两个事件处理器
    } else {
        if (ev.context === context && ev.callback === fn) {
            throw new Error('listener cannot be added more than once');
        }
        // 此处只能赋值给this._events[evType]
        this._events[evType] = [ev, {callback: fn, context: context, ctx: context || this}];
    }

    return this;
};


/**
 * @method removeListener
 * @description 移除事件处理器
 * 不传入参数，移除所有的事件处理器
 * 只传入evType，移除该evType下的所有事件处理器
 * 传入evType基础上，有传入fn或者context，则各需满足fn、context一样的情况才移除
 * @param {String} evType 事件类型（名称）
 * @param {Function} fn 事件处理器
 * @param {Object} context 事件处理器的上下文
 * @return this
 */
pt.removeListener = function (evType, fn, context) {
    var handler, len, i, retain, ev;

    if (!this._events) {
        return false;
    }

    // 无参数，即删除所有
    if (!evType && !fn && !context) {
        this._events = void 0;
        return this;
    }

    // handler 可能是数组，也可能已经是我们要的事件对象了
    if (handler = this._events[evType]) {
        // 只有一个事件处理器的情况
        if (handler.callback) {
            // 只要满足一种不匹配的情况，就可以不用移除事件处理器
            if ((fn && fn !== handler.callback) || (context && context !== handler.context)) {
                return false;
            } else {
                delete this._events[evType];
            }

        //数组的情况
        } else if (isArray(handler)) {
            len = handler.length;

            this._events[evType] = retain = [];

            for (i = 0; i < len; i += 1) {
                ev = handler[i];

                // 注意在once注册的事件中，ev.callback中存放的是中间函数，ev.callback.callbackOnce存放的才是事件处理器
                if ((fn && fn !== ev.callback && fn !== ev.callback.callbackOnce) || (context && context !== ev.context)) {
                    retain.push(ev);
                }
            }
            if (!retain.length) {
                delete this._events[evType];
            }
        }
    }

    return this;
};


pt.once = function once(evType, fn, context) {
    var fired, ctx, self;
    if (typeof fn !== 'function') {
        throw new TypeError('listener must be a function');
    }

    self = this;
    fired = false;
    ctx = context || this;

    function g() {
        self.removeListener(evType, g);

        if (!fired) {
            fired = true;
            fn.apply(ctx, arguments);
        }
    }

    g.callbackOnce = fn;

    this.on(evType, g);

    return this;
};


pt.on = pt.addListener;
pt.off = pt.removeListener;
pt.trigger = pt.emit;


module.exports = DEvent;

},{}],12:[function(require,module,exports){
// 图片ready、loaded时提供回调功能
var imageReady = require('image-ready');

// IScroll 需要使用iscroll-probe 版本
// 默认的IScroll npm包使用的是iscroll 版，需要切换
var IScroll = require('iscroll');

// 事件支持
var DEvent = require('devent');

// 缓存
var forEach = Array.prototype.forEach;


 /**
  * @descript 局部滚动功能、下拉刷新、上拉加载更多
  * @require Zepto
  * @require imageReady
  * html结构: div.v-scroll-wrapper>div.v-scroll-scroller>div.v-scroll-content，
  * 原版IScroll 的html结构：div.v-scroll-wrapper>div.v-scroll-scroller，
  * 其中v-scroll是外容器，v-scroll-content是唯一的内容容器
  *
  * userConfig.pullDownAction(ev)，userConfig.pullUpAction(ev)这两个回调
  * 里面的参数是一个通知对象，用在回调末尾通知主函数已经完成内容刷新，以便后续恢复初始状态
  * --------------------------------------------------
  * @param {HTMLElement} wrapper 滚动的外容器（视口）元素
  * @param {Object} opts 配置选项
  */
function DScroll(wrapper, opts) {
    var S = this, pullDown, pullUp, i;

    // 默认配置
    opts = $.extend({
        // probeType：1对性能没有影响。
        // probeType：2总执行滚动事件（除了惯性运动，反弹运动）。这类似于原生的onscroll事件。
        // probeType：3滚动事件精确到像素级。滚动使用性能更差的requestAnimationFrame（相当于配置：useTransition：假）。
        probeType: 1,
        scrollbars: true, // 显示滚动条
        fadeScrollbars: true, // 滚动时显示滚动条，默认影藏，并且是淡出淡入效果
        startY: 0,

        // 内容容器
        contentClass: 'v-scroll-content',

        // 下拉功能
        enablePullDown: false, // 下拉功能是否启用
        pullDownEmbed: true, // 在顶部嵌入pullDownBar, 分离设计，显示在其他地方则设置为false，分离设计时确保pullDownHeight设置为0
        pullDownHeight: 40, // pullDownBar的高度
        pullDownFlipOffset: 20, // 下拉到pullDownBar完整显示后，再超过多少才切换到Flip State
        pullDownSkipFlip: false, // 下拉到临界点，是否跳过显示高亮高亮状态而直接触发，启用高亮状态需要释放才触发
        pullDownBarClass: 'v-scroll-pulldown',
        pullDownHtmlDefault: '<i class="icon ion-ios-refresh-outline"></i>',
        pullDownHtmlHighlight: '<i class="icon ion-ios-refresh"></i>',
        pullDownHtmlActive: '<i class="icon ion-load-a"></i>',
        pullDownHtmlResult: '<i class="icon ion-ios-information"></i> 网络不稳定，请稍后再试',
        pullDownAction: function(ev) {
            ev.trigger('pullDownActionDidComplete->DScroll');
        },

        // 上拉功能
        enablePullUp: false,
        pullUpEmbed: true, // 在底部嵌入pullUpBar, 分离设计，显示在其他地方则设置为false，分离设计确保pullUpHeight设置为0
        pullUpHeight: 40,
        pullUpFlipOffset: 0, // 上拉到pullUpBar完整显示后，再超过多少才切换到Flip State
        pullUpSkipFlip: true,
        pullUpBarClass: 'v-scroll-pullup',
        pullUpHtmlDefault: '<i class="icon ion-ios-refresh-outline"></i>',
        pullUpHtmlHighlight: '<i class="icon ion-ios-refresh"></i>',
        pullUpHtmlActive: '<i class="icon ion-load-a"></i>',
        pullUpHtmlResult: '<i class="icon ion-ios-information"></i> 网络不稳定，请稍后再试',
        pullUpAction: function(ev) {
            ev.trigger('pullUpActionDidComplete->DScroll');
        },

        // 图片加载完成是否刷新scroll高度
        refreshAfterImagesReady: false,

        // 传入一个事件总线
        ev: new DEvent()
    }, opts);


    // 继承自IScroll, 借用构造函数
    IScroll.call(S, wrapper, opts);
    opts = S.options;
    ev = S.ev = opts.ev;


    /**
     * imageReady前，页面高度随着图片加载随时会变化，可以通过这个方法自动刷新
     * @param {HTMLElement} images
     * 参数可以是：
     * 1. 单一图片
     * 2. 图片数组（或节点列表）
     * 3. 包含图片的容器节点
     */
    S.refreshAfterImagesReady = function(images) {
        // 无传元素，则处理整个滚动条区域
        images = images || S.wrapper;

        // 保证只处理单个Element，如果不是单个，则解开，递归调用
        if (images.length) {
            forEach.call(images, function(item) {
                if (item) { // 避免数组里有可以转成false的东西
                    S.refreshAfterImagesReady(item);
                }
            });

        // 处理单个Element的逻辑部分
        } else {
            // 若是图片，执行imageReady刷新
            if (images.nodeName.toUpperCase() === 'IMG') {
                imageReady(images, function(){ S.refresh(); });
                // console.log('Scroll.refreshAfterImagesReady: img ready...');

            // 若不是图片，则检查子元素里的图片
            } else {
                images = images.querySelectorAll('img');
                forEach.call(images, function(img) {
                    imageReady(img, function(){ S.refresh(); });
                    // console.log('Scroll.refreshAfterImagesReady: img ready...');
                });
            }
        }
    };

    // 暴露两个设置pull操作的接口
    S.setPullDownAction = function(fn) {
        opts.pullDownAction = fn;
    };

    S.setPullUpAction = function(fn) {
        opts.pullUpAction = fn;
    };


    // 创建content容器
    // 确保S.scroller高度不小于S.wrapper [+pulldown] [+pullup], 避免无限触发pull动作
    // 设置内容区域最小高度，没内容的时候，把上拉bar撑下去，以免空荡荡显示个上拉bar
    S.content = S.wrapper.querySelector('.' + opts.contentClass);
    if (S.content === null) {
        S.content = document.createElement('div');
        S.content.className = opts.contentClass;
        S.scroller.appendChild(S.content);
    }
    S.content.style.minHeight = S.wrapperHeight + 'px';


    pullDown = S.pullDown = {
        currentState: 'default',
        top: function() { return 0; },
        bot: function() { return -opts.pullDownHeight; }
    };
    pullDown.createBar = function() {
        // dom结构中已存在pullDownBar，则直接使用，否则创建一个
        if( (S.pullDownBar = S.scroller.querySelector('.' + opts.pullDownBarClass)) !== null) {
            opts.pullDownHeight = S.pullDownBar.offsetHeight;
        } else {
            S.pullDownBar = document.createElement('div');
            S.pullDownBar.className = opts.pullDownBarClass;
            S.pullDownBar.innerHTML = opts.pullDownHtmlDefault;
            S.scroller.insertBefore(S.pullDownBar, S.content);
            // 嵌入到顶部的设计，才指定样式，分离设计可能有定制样式的需求
            if (opts.pullDownEmbed) {
                S.pullDownBar.style.width = '100%';
                S.pullDownBar.style.height = opts.pullDownHeight + 'px';
                S.pullDownBar.style.lineHeight = opts.pullDownHeight + 'px';
                S.pullDownBar.textAlign = 'center';
            }
        };
        return pullDown;
    };
    pullDown.stateChangeTo = function(state, text) {
        switch (state) {
        case 'default': // 初始状态，显示未激活的刷新icon
            pullDown.ignorePull = false;
            pullDown.currentState = 'default';
            S.pullDownBar.innerHTML = opts.pullDownHtmlDefault;
            S.pullDownBar.className = opts.pullDownBarClass + ' default';
            break;
        case 'flip': // 激活临界点，此时释放滚动会激发active，显示激活的刷新icon
            pullDown.currentState = 'flip';
            S.pullDownBar.innerHTML = opts.pullDownHtmlHighlight;
            S.pullDownBar.className = opts.pullDownBarClass + ' flip';
            break;
        case 'active': // 激活状态，在转换状态前，不再处理后续的滚动事件，显示忙icon
            pullDown.ignorePull = true; // 锁定
            pullDown.currentState = 'active';
            S.pullDownBar.innerHTML = opts.pullUpHtmlActive;
            S.pullDownBar.className = opts.pullDownBarClass + ' active';
            opts.pullDownAction(ev); // 执行回调
            break;
        case 'result': // 信息展示状态，显示指定的内容
            pullDown.currentState = 'result';
            S.pullDownBar.innerHTML = text || opts.pullDownHtmlResult;
            S.pullDownBar.className = opts.pullDownBarClass + ' result';
            break;
        }
        return pullDown;
    };
    pullDown.hideBar = function() {
        // 若用户已经滚动到看不到pullDownBar了，则不回弹，否则回弹以隐藏结果
        if (S.y <= pullDown.bot()) { return pullDown; }
        S.scrollTo(0, pullDown.bot(), 800);
        return pullDown;
    };
    pullDown.resetBar = function() {
        return pullDown.stateChangeTo('default').hideBar();
    };
    pullDown.scrollCB = function () {
        // 上下拉激发的临界Y轴值
        var downThreshold;

        if (!pullDown.ignorePull) {
            downThreshold = pullDown.top() + opts.pullDownFlipOffset; // 设置阈值
            if (opts.pullDownSkipFlip) {
                // 滚动到阈值及以上时，default -> active
                if (pullDown.currentState === 'default' && S.y >= downThreshold) {
                    pullDown.stateChangeTo('active');
                }
            } else {
                // 滚动到阈值及以上时，default -> flip
                if (pullDown.currentState === 'default' && S.y >= downThreshold) {
                    pullDown.stateChangeTo('flip');
                // 滚动小于阈值，flip -> default
                } else if (pullDown.currentState === 'flip' && S.y < downThreshold) {
                    pullDown.stateChangeTo('default');
                }
            }
        }
    };
    pullDown.scrollEndCB = function() {
        if (!pullDown.ignorePull) {
            // 下拉的程度不够，回弹，否则flip状态 -> active
            if (pullDown.currentState === 'default') { pullDown.hideBar(); }
            if (pullDown.currentState === 'flip') { pullDown.stateChangeTo('active'); }
        }
    };
    pullDown.start = function() {
        if (!S.pullDownBar) {
            // 插入pullDownBar，并消除高度变化引起的抖动
            pullDown.createBar();
            S.refresh();
            S.scrollTo(0, S.y - opts.pullDownHeight);
        }
        S.on('scroll', pullDown.scrollCB);
        S.on('scrollEnd', pullDown.scrollEndCB);
        opts.enablePullDown = true;
    };
    pullDown.stop = function() {
        if (S.pullDownBar) {
            // 删掉pullDownBar，并消除高度变化引起的抖动
            S.pullDownBar.parentNode.removeChild(S.pullDownBar);
            delete S.pullDownBar;
            S.refresh();
            S.scrollTo(0, S.y + opts.pullDownHeight);
        }
        S.off('scroll', pullDown.scrollCB);
        S.off('scrollEnd', pullDown.scrollEndCB);
        opts.enablePullDown = false;
    };


    pullUp = S.pullUp = {
        currentState: 'default',
        top: function() { return S.maxScrollY + opts.pullUpHeight; },
        bot: function() { return S.maxScrollY; }
    };
    pullUp.createBar = function() {
        // dom结构中已存在pullUpBar，则直接使用，否则创建一个
        if ( (S.pullUpBar = S.scroller.querySelector('.' + opts.pullUpBarClass)) !== null ) {
            opts.pullUpHeight = S.pullUpBar.offsetHeight;
        } else {
            S.pullUpBar = document.createElement('div');
            S.pullUpBar.className = opts.pullUpBarClass;
            S.pullUpBar.innerHTML = opts.pullUpHtmlDefault;
            S.scroller.appendChild(S.pullUpBar);
            // 嵌入到底部的设计，才指定样式，分离设计可能有定制样式的需求
            if (opts.pullUpEmbed) {
                S.pullUpBar.style.width = '100%';
                S.pullUpBar.style.height = opts.pullUpHeight + 'px';
                S.pullUpBar.style.lineHeight = opts.pullUpHeight + 'px';
                S.pullUpBar.style.textAlign = 'center';
            }
        }
        return pullUp;
    };
    pullUp.stateChangeTo = function(state, text) {
        switch (state) {
        case 'default':
            pullUp.ignorePull = false;
            pullUp.currentState = 'default';
            S.pullUpBar.innerHTML = opts.pullUpHtmlDefault;
            S.pullUpBar.className = opts.pullUpBarClass + ' default';
            break;
        case 'flip':
            pullUp.currentState = 'flip';
            S.pullUpBar.innerHTML = opts.pullUpHtmlHighlight;
            S.pullUpBar.className = opts.pullUpBarClass + ' flip';
            break;
        case 'active':
            pullUp.ignorePull = true; // 锁定
            pullUp.currentState = 'active';
            S.pullUpBar.innerHTML = opts.pullUpHtmlActive;
            S.pullUpBar.className = opts.pullUpBarClass + ' active';
            opts.pullUpAction(ev); // 执行回调
            break;
        case 'result':
            pullUp.currentState = 'result';
            S.pullUpBar.innerHTML = text || opts.pullUpHtmlResult;
            S.pullUpBar.className = opts.pullUpBarClass + ' result';
            break;
        }
        return pullUp;
    };
    pullUp.hideBar = function() {
        // 如果用户已经滚上去看不到pullUpBar了，则不回弹，否则，回弹隐藏pullUpBar
        if (S.y >= pullUp.top()) { return pullUp; }
        S.scrollTo(0, pullUp.top(), 800);
        return pullUp;
    };
    pullUp.resetBar = function() {
        return pullUp.stateChangeTo('default').hideBar();
    };
    pullUp.scrollCB = function() {
        var upThreshold;
        if (pullUp && !pullUp.ignorePull) {
            upThreshold = pullUp.bot() - opts.pullUpFlipOffset; // 设置阈值
            if (opts.pullUpSkipFlip) {
                // 滚到阈值及以下时，default -> active
                if (pullUp.currentState === 'default' && S.y <= upThreshold) {
                    pullUp.stateChangeTo('active');
                }
            } else {
                // 滚动到阈值及以下时，default -> flip
                if (pullUp.currentState === 'default' && S.y <= upThreshold) {
                    pullUp.stateChangeTo('flip');
                // 滚动大于阈值，flip -> default
                } else if (pullUp.currentState === 'flip' && S.y > upThreshold) {
                    pullUp.stateChangeTo('default');
                }
            }
        }
    };
    pullUp.scrollEndCB = function () {
        if (!pullUp.ignorePull) {
            // 上拉的程度不够，回弹，否则flip状态 -> active
            if (pullUp.currentState === 'default') { pullUp.hideBar(); }
            if (pullUp.currentState === 'flip') { pullUp.stateChangeTo('active'); }
        }
    };
    pullUp.start = function() {
        if (!S.pullUpBar) {
            pullUp.createBar();
            S.refresh();
        }
        S.on('scroll', pullUp.scrollCB);
        S.on('scrollEnd', pullUp.scrollEndCB);
        opts.enablePullUp = true;
    };
    pullUp.stop = function() {
        if (S.pullUpBar) {
            S.pullUpBar.parentNode.removeChild(S.pullUpBar);
            delete S.pullUpBar;
            S.refresh();
        }
        S.off('scroll', pullUp.scrollCB);
        S.off('scrollEnd', pullUp.scrollEndCB);
        opts.enablePullUp = false;
    };


    // 初始滚动逻辑 =================================================
    if (opts.enablePullDown) {
        // 默认的startY 要算上pullDownBar的高度
        opts.startY -= opts.pullDownHeight;
        pullDown.start();
    }
    if (opts.enablePullUp) {
        pullUp.start();
    }
    // refresh后，高度后续有任何修改的话，会导致startY的作用不正确，
    // 因此初始滚动后，不管前面高度是否有修改过、是否滚动过，
    // 这里手动设置scrollTo(0, opts.startY)兜底，确保startY起作用。
    S.refresh();
    S.scrollTo(0, opts.startY);
    // 每个图片加载完毕，再自动刷新一次
    opts.refreshAfterImagesReady && S.refreshAfterImagesReady();



    // 事件监听 ==========================================================
    // 开关滚动功能
    ev.on('stopPullDown->DScroll', function() { pullDown.stop(); });
    ev.on('startPullDown->DScroll', function(){ pullDown.start(); });
    ev.on('stopPullUp->DScroll', function() { pullUp.stop(); });
    ev.on('startPullUp->DScroll', function(){ pullUp.start(); });
    // 刷新滚动条高度
    ev.on('heightDidChange->DScroll', function(){ S.refresh(); });
    // 下拉操作完成
    ev.on('pullDownActionDidComplete->DScroll', function(){
        S.refresh();
        opts.enablePullDown && pullDown.resetBar();
    });
    // 上拉操作完成
    ev.on('pullUpActionDidComplete->DScroll', function() {
        S.refresh();
        opts.enablePullUp && pullUp.resetBar();
    });
    // 下拉操作结果信息（默认提醒网络不佳）
    ev.on('pullDownResultDidSet->DScroll', function(text){
        opts.enablePullDown && pullDown.stateChangeTo('result', text);
    });
    // 上拉操作结果（默认提醒网络不佳）
    ev.on('pullUpResultDidSet->DScroll', function(text){
        opts.enablePullUp && pullUp.stateChangeTo('result', text);
    });
}

DScroll.prototype = Object.create(IScroll.prototype);
DScroll.prototype.constructor = IScroll;


module.exports = DScroll;

},{"devent":10,"image-ready":14,"iscroll":13}],13:[function(require,module,exports){
/*! iScroll v5.1.3 ~ (c) 2008-2014 Matteo Spinelli ~ http://cubiq.org/license */
(function (window, document, Math) {
var rAF = window.requestAnimationFrame	||
	window.webkitRequestAnimationFrame	||
	window.mozRequestAnimationFrame		||
	window.oRequestAnimationFrame		||
	window.msRequestAnimationFrame		||
	function (callback) { window.setTimeout(callback, 1000 / 60); };

var utils = (function () {
	var me = {};

	var _elementStyle = document.createElement('div').style;
	var _vendor = (function () {
		var vendors = ['t', 'webkitT', 'MozT', 'msT', 'OT'],
			transform,
			i = 0,
			l = vendors.length;

		for ( ; i < l; i++ ) {
			transform = vendors[i] + 'ransform';
			if ( transform in _elementStyle ) return vendors[i].substr(0, vendors[i].length-1);
		}

		return false;
	})();

	function _prefixStyle (style) {
		if ( _vendor === false ) return false;
		if ( _vendor === '' ) return style;
		return _vendor + style.charAt(0).toUpperCase() + style.substr(1);
	}

	me.getTime = Date.now || function getTime () { return new Date().getTime(); };

	me.extend = function (target, obj) {
		for ( var i in obj ) {
			target[i] = obj[i];
		}
	};

	me.addEvent = function (el, type, fn, capture) {
		el.addEventListener(type, fn, !!capture);
	};

	me.removeEvent = function (el, type, fn, capture) {
		el.removeEventListener(type, fn, !!capture);
	};

	me.prefixPointerEvent = function (pointerEvent) {
		return window.MSPointerEvent ? 
			'MSPointer' + pointerEvent.charAt(9).toUpperCase() + pointerEvent.substr(10):
			pointerEvent;
	};

	me.momentum = function (current, start, time, lowerMargin, wrapperSize, deceleration) {
		var distance = current - start,
			speed = Math.abs(distance) / time,
			destination,
			duration;

		deceleration = deceleration === undefined ? 0.0006 : deceleration;

		destination = current + ( speed * speed ) / ( 2 * deceleration ) * ( distance < 0 ? -1 : 1 );
		duration = speed / deceleration;

		if ( destination < lowerMargin ) {
			destination = wrapperSize ? lowerMargin - ( wrapperSize / 2.5 * ( speed / 8 ) ) : lowerMargin;
			distance = Math.abs(destination - current);
			duration = distance / speed;
		} else if ( destination > 0 ) {
			destination = wrapperSize ? wrapperSize / 2.5 * ( speed / 8 ) : 0;
			distance = Math.abs(current) + destination;
			duration = distance / speed;
		}

		return {
			destination: Math.round(destination),
			duration: duration
		};
	};

	var _transform = _prefixStyle('transform');

	me.extend(me, {
		hasTransform: _transform !== false,
		hasPerspective: _prefixStyle('perspective') in _elementStyle,
		hasTouch: 'ontouchstart' in window,
		hasPointer: window.PointerEvent || window.MSPointerEvent, // IE10 is prefixed
		hasTransition: _prefixStyle('transition') in _elementStyle
	});

	// This should find all Android browsers lower than build 535.19 (both stock browser and webview)
	me.isBadAndroid = /Android /.test(window.navigator.appVersion) && !(/Chrome\/\d/.test(window.navigator.appVersion));

	me.extend(me.style = {}, {
		transform: _transform,
		transitionTimingFunction: _prefixStyle('transitionTimingFunction'),
		transitionDuration: _prefixStyle('transitionDuration'),
		transitionDelay: _prefixStyle('transitionDelay'),
		transformOrigin: _prefixStyle('transformOrigin')
	});

	me.hasClass = function (e, c) {
		var re = new RegExp("(^|\\s)" + c + "(\\s|$)");
		return re.test(e.className);
	};

	me.addClass = function (e, c) {
		if ( me.hasClass(e, c) ) {
			return;
		}

		var newclass = e.className.split(' ');
		newclass.push(c);
		e.className = newclass.join(' ');
	};

	me.removeClass = function (e, c) {
		if ( !me.hasClass(e, c) ) {
			return;
		}

		var re = new RegExp("(^|\\s)" + c + "(\\s|$)", 'g');
		e.className = e.className.replace(re, ' ');
	};

	me.offset = function (el) {
		var left = -el.offsetLeft,
			top = -el.offsetTop;

		// jshint -W084
		while (el = el.offsetParent) {
			left -= el.offsetLeft;
			top -= el.offsetTop;
		}
		// jshint +W084

		return {
			left: left,
			top: top
		};
	};

	me.preventDefaultException = function (el, exceptions) {
		for ( var i in exceptions ) {
			if ( exceptions[i].test(el[i]) ) {
				return true;
			}
		}

		return false;
	};

	me.extend(me.eventType = {}, {
		touchstart: 1,
		touchmove: 1,
		touchend: 1,

		mousedown: 2,
		mousemove: 2,
		mouseup: 2,

		pointerdown: 3,
		pointermove: 3,
		pointerup: 3,

		MSPointerDown: 3,
		MSPointerMove: 3,
		MSPointerUp: 3
	});

	me.extend(me.ease = {}, {
		quadratic: {
			style: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
			fn: function (k) {
				return k * ( 2 - k );
			}
		},
		circular: {
			style: 'cubic-bezier(0.1, 0.57, 0.1, 1)',	// Not properly "circular" but this looks better, it should be (0.075, 0.82, 0.165, 1)
			fn: function (k) {
				return Math.sqrt( 1 - ( --k * k ) );
			}
		},
		back: {
			style: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
			fn: function (k) {
				var b = 4;
				return ( k = k - 1 ) * k * ( ( b + 1 ) * k + b ) + 1;
			}
		},
		bounce: {
			style: '',
			fn: function (k) {
				if ( ( k /= 1 ) < ( 1 / 2.75 ) ) {
					return 7.5625 * k * k;
				} else if ( k < ( 2 / 2.75 ) ) {
					return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;
				} else if ( k < ( 2.5 / 2.75 ) ) {
					return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;
				} else {
					return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;
				}
			}
		},
		elastic: {
			style: '',
			fn: function (k) {
				var f = 0.22,
					e = 0.4;

				if ( k === 0 ) { return 0; }
				if ( k == 1 ) { return 1; }

				return ( e * Math.pow( 2, - 10 * k ) * Math.sin( ( k - f / 4 ) * ( 2 * Math.PI ) / f ) + 1 );
			}
		}
	});

	me.tap = function (e, eventName) {
		var ev = document.createEvent('Event');
		ev.initEvent(eventName, true, true);
		ev.pageX = e.pageX;
		ev.pageY = e.pageY;
		e.target.dispatchEvent(ev);
	};

	me.click = function (e) {
		var target = e.target,
			ev;

		if ( !(/(SELECT|INPUT|TEXTAREA)/i).test(target.tagName) ) {
			ev = document.createEvent('MouseEvents');
			ev.initMouseEvent('click', true, true, e.view, 1,
				target.screenX, target.screenY, target.clientX, target.clientY,
				e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
				0, null);

			ev._constructed = true;
			target.dispatchEvent(ev);
		}
	};

	return me;
})();

function IScroll (el, options) {
	this.wrapper = typeof el == 'string' ? document.querySelector(el) : el;
	this.scroller = this.wrapper.children[0];
	this.scrollerStyle = this.scroller.style;		// cache style for better performance

	this.options = {

		resizeScrollbars: true,

		mouseWheelSpeed: 20,

		snapThreshold: 0.334,

// INSERT POINT: OPTIONS 

		startX: 0,
		startY: 0,
		scrollY: true,
		directionLockThreshold: 5,
		momentum: true,

		bounce: true,
		bounceTime: 600,
		bounceEasing: '',

		preventDefault: true,
		preventDefaultException: { tagName: /^(INPUT|TEXTAREA|BUTTON|SELECT)$/ },

		HWCompositing: true,
		useTransition: true,
		useTransform: true
	};

	for ( var i in options ) {
		this.options[i] = options[i];
	}

	// Normalize options
	this.translateZ = this.options.HWCompositing && utils.hasPerspective ? ' translateZ(0)' : '';

	this.options.useTransition = utils.hasTransition && this.options.useTransition;
	this.options.useTransform = utils.hasTransform && this.options.useTransform;

	this.options.eventPassthrough = this.options.eventPassthrough === true ? 'vertical' : this.options.eventPassthrough;
	this.options.preventDefault = !this.options.eventPassthrough && this.options.preventDefault;

	// If you want eventPassthrough I have to lock one of the axes
	this.options.scrollY = this.options.eventPassthrough == 'vertical' ? false : this.options.scrollY;
	this.options.scrollX = this.options.eventPassthrough == 'horizontal' ? false : this.options.scrollX;

	// With eventPassthrough we also need lockDirection mechanism
	this.options.freeScroll = this.options.freeScroll && !this.options.eventPassthrough;
	this.options.directionLockThreshold = this.options.eventPassthrough ? 0 : this.options.directionLockThreshold;

	this.options.bounceEasing = typeof this.options.bounceEasing == 'string' ? utils.ease[this.options.bounceEasing] || utils.ease.circular : this.options.bounceEasing;

	this.options.resizePolling = this.options.resizePolling === undefined ? 60 : this.options.resizePolling;

	if ( this.options.tap === true ) {
		this.options.tap = 'tap';
	}

	if ( this.options.shrinkScrollbars == 'scale' ) {
		this.options.useTransition = false;
	}

	this.options.invertWheelDirection = this.options.invertWheelDirection ? -1 : 1;

	if ( this.options.probeType == 3 ) {
		this.options.useTransition = false;	}

// INSERT POINT: NORMALIZATION

	// Some defaults	
	this.x = 0;
	this.y = 0;
	this.directionX = 0;
	this.directionY = 0;
	this._events = {};

// INSERT POINT: DEFAULTS

	this._init();
	this.refresh();

	this.scrollTo(this.options.startX, this.options.startY);
	this.enable();
}

IScroll.prototype = {
	version: '5.1.3',

	_init: function () {
		this._initEvents();

		if ( this.options.scrollbars || this.options.indicators ) {
			this._initIndicators();
		}

		if ( this.options.mouseWheel ) {
			this._initWheel();
		}

		if ( this.options.snap ) {
			this._initSnap();
		}

		if ( this.options.keyBindings ) {
			this._initKeys();
		}

// INSERT POINT: _init

	},

	destroy: function () {
		this._initEvents(true);

		this._execEvent('destroy');
	},

	_transitionEnd: function (e) {
		if ( e.target != this.scroller || !this.isInTransition ) {
			return;
		}

		this._transitionTime();
		if ( !this.resetPosition(this.options.bounceTime) ) {
			this.isInTransition = false;
			this._execEvent('scrollEnd');
		}
	},

	_start: function (e) {
		// React to left mouse button only
		if ( utils.eventType[e.type] != 1 ) {
			if ( e.button !== 0 ) {
				return;
			}
		}

		if ( !this.enabled || (this.initiated && utils.eventType[e.type] !== this.initiated) ) {
			return;
		}

		if ( this.options.preventDefault && !utils.isBadAndroid && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
			e.preventDefault();
		}

		var point = e.touches ? e.touches[0] : e,
			pos;

		this.initiated	= utils.eventType[e.type];
		this.moved		= false;
		this.distX		= 0;
		this.distY		= 0;
		this.directionX = 0;
		this.directionY = 0;
		this.directionLocked = 0;

		this._transitionTime();

		this.startTime = utils.getTime();

		if ( this.options.useTransition && this.isInTransition ) {
			this.isInTransition = false;
			pos = this.getComputedPosition();
			this._translate(Math.round(pos.x), Math.round(pos.y));
			this._execEvent('scrollEnd');
		} else if ( !this.options.useTransition && this.isAnimating ) {
			this.isAnimating = false;
			this._execEvent('scrollEnd');
		}

		this.startX    = this.x;
		this.startY    = this.y;
		this.absStartX = this.x;
		this.absStartY = this.y;
		this.pointX    = point.pageX;
		this.pointY    = point.pageY;

		this._execEvent('beforeScrollStart');
	},

	_move: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		if ( this.options.preventDefault ) {	// increases performance on Android? TODO: check!
			e.preventDefault();
		}

		var point		= e.touches ? e.touches[0] : e,
			deltaX		= point.pageX - this.pointX,
			deltaY		= point.pageY - this.pointY,
			timestamp	= utils.getTime(),
			newX, newY,
			absDistX, absDistY;

		this.pointX		= point.pageX;
		this.pointY		= point.pageY;

		this.distX		+= deltaX;
		this.distY		+= deltaY;
		absDistX		= Math.abs(this.distX);
		absDistY		= Math.abs(this.distY);

		// We need to move at least 10 pixels for the scrolling to initiate
		if ( timestamp - this.endTime > 300 && (absDistX < 10 && absDistY < 10) ) {
			return;
		}

		// If you are scrolling in one direction lock the other
		if ( !this.directionLocked && !this.options.freeScroll ) {
			if ( absDistX > absDistY + this.options.directionLockThreshold ) {
				this.directionLocked = 'h';		// lock horizontally
			} else if ( absDistY >= absDistX + this.options.directionLockThreshold ) {
				this.directionLocked = 'v';		// lock vertically
			} else {
				this.directionLocked = 'n';		// no lock
			}
		}

		if ( this.directionLocked == 'h' ) {
			if ( this.options.eventPassthrough == 'vertical' ) {
				e.preventDefault();
			} else if ( this.options.eventPassthrough == 'horizontal' ) {
				this.initiated = false;
				return;
			}

			deltaY = 0;
		} else if ( this.directionLocked == 'v' ) {
			if ( this.options.eventPassthrough == 'horizontal' ) {
				e.preventDefault();
			} else if ( this.options.eventPassthrough == 'vertical' ) {
				this.initiated = false;
				return;
			}

			deltaX = 0;
		}

		deltaX = this.hasHorizontalScroll ? deltaX : 0;
		deltaY = this.hasVerticalScroll ? deltaY : 0;

		newX = this.x + deltaX;
		newY = this.y + deltaY;

		// Slow down if outside of the boundaries
		if ( newX > 0 || newX < this.maxScrollX ) {
			newX = this.options.bounce ? this.x + deltaX / 3 : newX > 0 ? 0 : this.maxScrollX;
		}
		if ( newY > 0 || newY < this.maxScrollY ) {
			newY = this.options.bounce ? this.y + deltaY / 3 : newY > 0 ? 0 : this.maxScrollY;
		}

		this.directionX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
		this.directionY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

		if ( !this.moved ) {
			this._execEvent('scrollStart');
		}

		this.moved = true;

		this._translate(newX, newY);

/* REPLACE START: _move */
		if ( timestamp - this.startTime > 300 ) {
			this.startTime = timestamp;
			this.startX = this.x;
			this.startY = this.y;

			if ( this.options.probeType == 1 ) {
				this._execEvent('scroll');
			}
		}

		if ( this.options.probeType > 1 ) {
			this._execEvent('scroll');
		}
/* REPLACE END: _move */

	},

	_end: function (e) {
		if ( !this.enabled || utils.eventType[e.type] !== this.initiated ) {
			return;
		}

		if ( this.options.preventDefault && !utils.preventDefaultException(e.target, this.options.preventDefaultException) ) {
			e.preventDefault();
		}

		var point = e.changedTouches ? e.changedTouches[0] : e,
			momentumX,
			momentumY,
			duration = utils.getTime() - this.startTime,
			newX = Math.round(this.x),
			newY = Math.round(this.y),
			distanceX = Math.abs(newX - this.startX),
			distanceY = Math.abs(newY - this.startY),
			time = 0,
			easing = '';

		this.isInTransition = 0;
		this.initiated = 0;
		this.endTime = utils.getTime();

		// reset if we are outside of the boundaries
		if ( this.resetPosition(this.options.bounceTime) ) {
			return;
		}

		this.scrollTo(newX, newY);	// ensures that the last position is rounded

		// we scrolled less than 10 pixels
		if ( !this.moved ) {
			if ( this.options.tap ) {
				utils.tap(e, this.options.tap);
			}

			if ( this.options.click ) {
				utils.click(e);
			}

			this._execEvent('scrollCancel');
			return;
		}

		if ( this._events.flick && duration < 200 && distanceX < 100 && distanceY < 100 ) {
			this._execEvent('flick');
			return;
		}

		// start momentum animation if needed
		if ( this.options.momentum && duration < 300 ) {
			momentumX = this.hasHorizontalScroll ? utils.momentum(this.x, this.startX, duration, this.maxScrollX, this.options.bounce ? this.wrapperWidth : 0, this.options.deceleration) : { destination: newX, duration: 0 };
			momentumY = this.hasVerticalScroll ? utils.momentum(this.y, this.startY, duration, this.maxScrollY, this.options.bounce ? this.wrapperHeight : 0, this.options.deceleration) : { destination: newY, duration: 0 };
			newX = momentumX.destination;
			newY = momentumY.destination;
			time = Math.max(momentumX.duration, momentumY.duration);
			this.isInTransition = 1;
		}


		if ( this.options.snap ) {
			var snap = this._nearestSnap(newX, newY);
			this.currentPage = snap;
			time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(newX - snap.x), 1000),
						Math.min(Math.abs(newY - snap.y), 1000)
					), 300);
			newX = snap.x;
			newY = snap.y;

			this.directionX = 0;
			this.directionY = 0;
			easing = this.options.bounceEasing;
		}

// INSERT POINT: _end

		if ( newX != this.x || newY != this.y ) {
			// change easing function when scroller goes out of the boundaries
			if ( newX > 0 || newX < this.maxScrollX || newY > 0 || newY < this.maxScrollY ) {
				easing = utils.ease.quadratic;
			}

			this.scrollTo(newX, newY, time, easing);
			return;
		}

		this._execEvent('scrollEnd');
	},

	_resize: function () {
		var that = this;

		clearTimeout(this.resizeTimeout);

		this.resizeTimeout = setTimeout(function () {
			that.refresh();
		}, this.options.resizePolling);
	},

	resetPosition: function (time) {
		var x = this.x,
			y = this.y;

		time = time || 0;

		if ( !this.hasHorizontalScroll || this.x > 0 ) {
			x = 0;
		} else if ( this.x < this.maxScrollX ) {
			x = this.maxScrollX;
		}

		if ( !this.hasVerticalScroll || this.y > 0 ) {
			y = 0;
		} else if ( this.y < this.maxScrollY ) {
			y = this.maxScrollY;
		}

		if ( x == this.x && y == this.y ) {
			return false;
		}

		this.scrollTo(x, y, time, this.options.bounceEasing);

		return true;
	},

	disable: function () {
		this.enabled = false;
	},

	enable: function () {
		this.enabled = true;
	},

	refresh: function () {
		var rf = this.wrapper.offsetHeight;		// Force reflow

		this.wrapperWidth	= this.wrapper.clientWidth;
		this.wrapperHeight	= this.wrapper.clientHeight;

/* REPLACE START: refresh */

		this.scrollerWidth	= this.scroller.offsetWidth;
		this.scrollerHeight	= this.scroller.offsetHeight;

		this.maxScrollX		= this.wrapperWidth - this.scrollerWidth;
		this.maxScrollY		= this.wrapperHeight - this.scrollerHeight;

/* REPLACE END: refresh */

		this.hasHorizontalScroll	= this.options.scrollX && this.maxScrollX < 0;
		this.hasVerticalScroll		= this.options.scrollY && this.maxScrollY < 0;

		if ( !this.hasHorizontalScroll ) {
			this.maxScrollX = 0;
			this.scrollerWidth = this.wrapperWidth;
		}

		if ( !this.hasVerticalScroll ) {
			this.maxScrollY = 0;
			this.scrollerHeight = this.wrapperHeight;
		}

		this.endTime = 0;
		this.directionX = 0;
		this.directionY = 0;

		this.wrapperOffset = utils.offset(this.wrapper);

		this._execEvent('refresh');

		this.resetPosition();

// INSERT POINT: _refresh

	},

	on: function (type, fn) {
		if ( !this._events[type] ) {
			this._events[type] = [];
		}

		this._events[type].push(fn);
	},

	off: function (type, fn) {
		if ( !this._events[type] ) {
			return;
		}

		var index = this._events[type].indexOf(fn);

		if ( index > -1 ) {
			this._events[type].splice(index, 1);
		}
	},

	_execEvent: function (type) {
		if ( !this._events[type] ) {
			return;
		}

		var i = 0,
			l = this._events[type].length;

		if ( !l ) {
			return;
		}

		for ( ; i < l; i++ ) {
			this._events[type][i].apply(this, [].slice.call(arguments, 1));
		}
	},

	scrollBy: function (x, y, time, easing) {
		x = this.x + x;
		y = this.y + y;
		time = time || 0;

		this.scrollTo(x, y, time, easing);
	},

	scrollTo: function (x, y, time, easing) {
		easing = easing || utils.ease.circular;

		this.isInTransition = this.options.useTransition && time > 0;

		if ( !time || (this.options.useTransition && easing.style) ) {
			this._transitionTimingFunction(easing.style);
			this._transitionTime(time);
			this._translate(x, y);
		} else {
			this._animate(x, y, time, easing.fn);
		}
	},

	scrollToElement: function (el, time, offsetX, offsetY, easing) {
		el = el.nodeType ? el : this.scroller.querySelector(el);

		if ( !el ) {
			return;
		}

		var pos = utils.offset(el);

		pos.left -= this.wrapperOffset.left;
		pos.top  -= this.wrapperOffset.top;

		// if offsetX/Y are true we center the element to the screen
		if ( offsetX === true ) {
			offsetX = Math.round(el.offsetWidth / 2 - this.wrapper.offsetWidth / 2);
		}
		if ( offsetY === true ) {
			offsetY = Math.round(el.offsetHeight / 2 - this.wrapper.offsetHeight / 2);
		}

		pos.left -= offsetX || 0;
		pos.top  -= offsetY || 0;

		pos.left = pos.left > 0 ? 0 : pos.left < this.maxScrollX ? this.maxScrollX : pos.left;
		pos.top  = pos.top  > 0 ? 0 : pos.top  < this.maxScrollY ? this.maxScrollY : pos.top;

		time = time === undefined || time === null || time === 'auto' ? Math.max(Math.abs(this.x-pos.left), Math.abs(this.y-pos.top)) : time;

		this.scrollTo(pos.left, pos.top, time, easing);
	},

	_transitionTime: function (time) {
		time = time || 0;

		this.scrollerStyle[utils.style.transitionDuration] = time + 'ms';

		if ( !time && utils.isBadAndroid ) {
			this.scrollerStyle[utils.style.transitionDuration] = '0.001s';
		}


		if ( this.indicators ) {
			for ( var i = this.indicators.length; i--; ) {
				this.indicators[i].transitionTime(time);
			}
		}


// INSERT POINT: _transitionTime

	},

	_transitionTimingFunction: function (easing) {
		this.scrollerStyle[utils.style.transitionTimingFunction] = easing;


		if ( this.indicators ) {
			for ( var i = this.indicators.length; i--; ) {
				this.indicators[i].transitionTimingFunction(easing);
			}
		}


// INSERT POINT: _transitionTimingFunction

	},

	_translate: function (x, y) {
		if ( this.options.useTransform ) {

/* REPLACE START: _translate */

			this.scrollerStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.translateZ;

/* REPLACE END: _translate */

		} else {
			x = Math.round(x);
			y = Math.round(y);
			this.scrollerStyle.left = x + 'px';
			this.scrollerStyle.top = y + 'px';
		}

		this.x = x;
		this.y = y;


	if ( this.indicators ) {
		for ( var i = this.indicators.length; i--; ) {
			this.indicators[i].updatePosition();
		}
	}


// INSERT POINT: _translate

	},

	_initEvents: function (remove) {
		var eventType = remove ? utils.removeEvent : utils.addEvent,
			target = this.options.bindToWrapper ? this.wrapper : window;

		eventType(window, 'orientationchange', this);
		eventType(window, 'resize', this);

		if ( this.options.click ) {
			eventType(this.wrapper, 'click', this, true);
		}

		if ( !this.options.disableMouse ) {
			eventType(this.wrapper, 'mousedown', this);
			eventType(target, 'mousemove', this);
			eventType(target, 'mousecancel', this);
			eventType(target, 'mouseup', this);
		}

		if ( utils.hasPointer && !this.options.disablePointer ) {
			eventType(this.wrapper, utils.prefixPointerEvent('pointerdown'), this);
			eventType(target, utils.prefixPointerEvent('pointermove'), this);
			eventType(target, utils.prefixPointerEvent('pointercancel'), this);
			eventType(target, utils.prefixPointerEvent('pointerup'), this);
		}

		if ( utils.hasTouch && !this.options.disableTouch ) {
			eventType(this.wrapper, 'touchstart', this);
			eventType(target, 'touchmove', this);
			eventType(target, 'touchcancel', this);
			eventType(target, 'touchend', this);
		}

		eventType(this.scroller, 'transitionend', this);
		eventType(this.scroller, 'webkitTransitionEnd', this);
		eventType(this.scroller, 'oTransitionEnd', this);
		eventType(this.scroller, 'MSTransitionEnd', this);
	},

	getComputedPosition: function () {
		var matrix = window.getComputedStyle(this.scroller, null),
			x, y;

		if ( this.options.useTransform ) {
			matrix = matrix[utils.style.transform].split(')')[0].split(', ');
			x = +(matrix[12] || matrix[4]);
			y = +(matrix[13] || matrix[5]);
		} else {
			x = +matrix.left.replace(/[^-\d.]/g, '');
			y = +matrix.top.replace(/[^-\d.]/g, '');
		}

		return { x: x, y: y };
	},

	_initIndicators: function () {
		var interactive = this.options.interactiveScrollbars,
			customStyle = typeof this.options.scrollbars != 'string',
			indicators = [],
			indicator;

		var that = this;

		this.indicators = [];

		if ( this.options.scrollbars ) {
			// Vertical scrollbar
			if ( this.options.scrollY ) {
				indicator = {
					el: createDefaultScrollbar('v', interactive, this.options.scrollbars),
					interactive: interactive,
					defaultScrollbars: true,
					customStyle: customStyle,
					resize: this.options.resizeScrollbars,
					shrink: this.options.shrinkScrollbars,
					fade: this.options.fadeScrollbars,
					listenX: false
				};

				this.wrapper.appendChild(indicator.el);
				indicators.push(indicator);
			}

			// Horizontal scrollbar
			if ( this.options.scrollX ) {
				indicator = {
					el: createDefaultScrollbar('h', interactive, this.options.scrollbars),
					interactive: interactive,
					defaultScrollbars: true,
					customStyle: customStyle,
					resize: this.options.resizeScrollbars,
					shrink: this.options.shrinkScrollbars,
					fade: this.options.fadeScrollbars,
					listenY: false
				};

				this.wrapper.appendChild(indicator.el);
				indicators.push(indicator);
			}
		}

		if ( this.options.indicators ) {
			// TODO: check concat compatibility
			indicators = indicators.concat(this.options.indicators);
		}

		for ( var i = indicators.length; i--; ) {
			this.indicators.push( new Indicator(this, indicators[i]) );
		}

		// TODO: check if we can use array.map (wide compatibility and performance issues)
		function _indicatorsMap (fn) {
			for ( var i = that.indicators.length; i--; ) {
				fn.call(that.indicators[i]);
			}
		}

		if ( this.options.fadeScrollbars ) {
			this.on('scrollEnd', function () {
				_indicatorsMap(function () {
					this.fade();
				});
			});

			this.on('scrollCancel', function () {
				_indicatorsMap(function () {
					this.fade();
				});
			});

			this.on('scrollStart', function () {
				_indicatorsMap(function () {
					this.fade(1);
				});
			});

			this.on('beforeScrollStart', function () {
				_indicatorsMap(function () {
					this.fade(1, true);
				});
			});
		}


		this.on('refresh', function () {
			_indicatorsMap(function () {
				this.refresh();
			});
		});

		this.on('destroy', function () {
			_indicatorsMap(function () {
				this.destroy();
			});

			delete this.indicators;
		});
	},

	_initWheel: function () {
		utils.addEvent(this.wrapper, 'wheel', this);
		utils.addEvent(this.wrapper, 'mousewheel', this);
		utils.addEvent(this.wrapper, 'DOMMouseScroll', this);

		this.on('destroy', function () {
			utils.removeEvent(this.wrapper, 'wheel', this);
			utils.removeEvent(this.wrapper, 'mousewheel', this);
			utils.removeEvent(this.wrapper, 'DOMMouseScroll', this);
		});
	},

	_wheel: function (e) {
		if ( !this.enabled ) {
			return;
		}

		e.preventDefault();
		e.stopPropagation();

		var wheelDeltaX, wheelDeltaY,
			newX, newY,
			that = this;

		if ( this.wheelTimeout === undefined ) {
			that._execEvent('scrollStart');
		}

		// Execute the scrollEnd event after 400ms the wheel stopped scrolling
		clearTimeout(this.wheelTimeout);
		this.wheelTimeout = setTimeout(function () {
			that._execEvent('scrollEnd');
			that.wheelTimeout = undefined;
		}, 400);

		if ( 'deltaX' in e ) {
			if (e.deltaMode === 1) {
				wheelDeltaX = -e.deltaX * this.options.mouseWheelSpeed;
				wheelDeltaY = -e.deltaY * this.options.mouseWheelSpeed;
			} else {
				wheelDeltaX = -e.deltaX;
				wheelDeltaY = -e.deltaY;
			}
		} else if ( 'wheelDeltaX' in e ) {
			wheelDeltaX = e.wheelDeltaX / 120 * this.options.mouseWheelSpeed;
			wheelDeltaY = e.wheelDeltaY / 120 * this.options.mouseWheelSpeed;
		} else if ( 'wheelDelta' in e ) {
			wheelDeltaX = wheelDeltaY = e.wheelDelta / 120 * this.options.mouseWheelSpeed;
		} else if ( 'detail' in e ) {
			wheelDeltaX = wheelDeltaY = -e.detail / 3 * this.options.mouseWheelSpeed;
		} else {
			return;
		}

		wheelDeltaX *= this.options.invertWheelDirection;
		wheelDeltaY *= this.options.invertWheelDirection;

		if ( !this.hasVerticalScroll ) {
			wheelDeltaX = wheelDeltaY;
			wheelDeltaY = 0;
		}

		if ( this.options.snap ) {
			newX = this.currentPage.pageX;
			newY = this.currentPage.pageY;

			if ( wheelDeltaX > 0 ) {
				newX--;
			} else if ( wheelDeltaX < 0 ) {
				newX++;
			}

			if ( wheelDeltaY > 0 ) {
				newY--;
			} else if ( wheelDeltaY < 0 ) {
				newY++;
			}

			this.goToPage(newX, newY);

			return;
		}

		newX = this.x + Math.round(this.hasHorizontalScroll ? wheelDeltaX : 0);
		newY = this.y + Math.round(this.hasVerticalScroll ? wheelDeltaY : 0);

		if ( newX > 0 ) {
			newX = 0;
		} else if ( newX < this.maxScrollX ) {
			newX = this.maxScrollX;
		}

		if ( newY > 0 ) {
			newY = 0;
		} else if ( newY < this.maxScrollY ) {
			newY = this.maxScrollY;
		}

		this.scrollTo(newX, newY, 0);

		if ( this.options.probeType > 1 ) {
			this._execEvent('scroll');
		}

// INSERT POINT: _wheel
	},

	_initSnap: function () {
		this.currentPage = {};

		if ( typeof this.options.snap == 'string' ) {
			this.options.snap = this.scroller.querySelectorAll(this.options.snap);
		}

		this.on('refresh', function () {
			var i = 0, l,
				m = 0, n,
				cx, cy,
				x = 0, y,
				stepX = this.options.snapStepX || this.wrapperWidth,
				stepY = this.options.snapStepY || this.wrapperHeight,
				el;

			this.pages = [];

			if ( !this.wrapperWidth || !this.wrapperHeight || !this.scrollerWidth || !this.scrollerHeight ) {
				return;
			}

			if ( this.options.snap === true ) {
				cx = Math.round( stepX / 2 );
				cy = Math.round( stepY / 2 );

				while ( x > -this.scrollerWidth ) {
					this.pages[i] = [];
					l = 0;
					y = 0;

					while ( y > -this.scrollerHeight ) {
						this.pages[i][l] = {
							x: Math.max(x, this.maxScrollX),
							y: Math.max(y, this.maxScrollY),
							width: stepX,
							height: stepY,
							cx: x - cx,
							cy: y - cy
						};

						y -= stepY;
						l++;
					}

					x -= stepX;
					i++;
				}
			} else {
				el = this.options.snap;
				l = el.length;
				n = -1;

				for ( ; i < l; i++ ) {
					if ( i === 0 || el[i].offsetLeft <= el[i-1].offsetLeft ) {
						m = 0;
						n++;
					}

					if ( !this.pages[m] ) {
						this.pages[m] = [];
					}

					x = Math.max(-el[i].offsetLeft, this.maxScrollX);
					y = Math.max(-el[i].offsetTop, this.maxScrollY);
					cx = x - Math.round(el[i].offsetWidth / 2);
					cy = y - Math.round(el[i].offsetHeight / 2);

					this.pages[m][n] = {
						x: x,
						y: y,
						width: el[i].offsetWidth,
						height: el[i].offsetHeight,
						cx: cx,
						cy: cy
					};

					if ( x > this.maxScrollX ) {
						m++;
					}
				}
			}

			this.goToPage(this.currentPage.pageX || 0, this.currentPage.pageY || 0, 0);

			// Update snap threshold if needed
			if ( this.options.snapThreshold % 1 === 0 ) {
				this.snapThresholdX = this.options.snapThreshold;
				this.snapThresholdY = this.options.snapThreshold;
			} else {
				this.snapThresholdX = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].width * this.options.snapThreshold);
				this.snapThresholdY = Math.round(this.pages[this.currentPage.pageX][this.currentPage.pageY].height * this.options.snapThreshold);
			}
		});

		this.on('flick', function () {
			var time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(this.x - this.startX), 1000),
						Math.min(Math.abs(this.y - this.startY), 1000)
					), 300);

			this.goToPage(
				this.currentPage.pageX + this.directionX,
				this.currentPage.pageY + this.directionY,
				time
			);
		});
	},

	_nearestSnap: function (x, y) {
		if ( !this.pages.length ) {
			return { x: 0, y: 0, pageX: 0, pageY: 0 };
		}

		var i = 0,
			l = this.pages.length,
			m = 0;

		// Check if we exceeded the snap threshold
		if ( Math.abs(x - this.absStartX) < this.snapThresholdX &&
			Math.abs(y - this.absStartY) < this.snapThresholdY ) {
			return this.currentPage;
		}

		if ( x > 0 ) {
			x = 0;
		} else if ( x < this.maxScrollX ) {
			x = this.maxScrollX;
		}

		if ( y > 0 ) {
			y = 0;
		} else if ( y < this.maxScrollY ) {
			y = this.maxScrollY;
		}

		for ( ; i < l; i++ ) {
			if ( x >= this.pages[i][0].cx ) {
				x = this.pages[i][0].x;
				break;
			}
		}

		l = this.pages[i].length;

		for ( ; m < l; m++ ) {
			if ( y >= this.pages[0][m].cy ) {
				y = this.pages[0][m].y;
				break;
			}
		}

		if ( i == this.currentPage.pageX ) {
			i += this.directionX;

			if ( i < 0 ) {
				i = 0;
			} else if ( i >= this.pages.length ) {
				i = this.pages.length - 1;
			}

			x = this.pages[i][0].x;
		}

		if ( m == this.currentPage.pageY ) {
			m += this.directionY;

			if ( m < 0 ) {
				m = 0;
			} else if ( m >= this.pages[0].length ) {
				m = this.pages[0].length - 1;
			}

			y = this.pages[0][m].y;
		}

		return {
			x: x,
			y: y,
			pageX: i,
			pageY: m
		};
	},

	goToPage: function (x, y, time, easing) {
		easing = easing || this.options.bounceEasing;

		if ( x >= this.pages.length ) {
			x = this.pages.length - 1;
		} else if ( x < 0 ) {
			x = 0;
		}

		if ( y >= this.pages[x].length ) {
			y = this.pages[x].length - 1;
		} else if ( y < 0 ) {
			y = 0;
		}

		var posX = this.pages[x][y].x,
			posY = this.pages[x][y].y;

		time = time === undefined ? this.options.snapSpeed || Math.max(
			Math.max(
				Math.min(Math.abs(posX - this.x), 1000),
				Math.min(Math.abs(posY - this.y), 1000)
			), 300) : time;

		this.currentPage = {
			x: posX,
			y: posY,
			pageX: x,
			pageY: y
		};

		this.scrollTo(posX, posY, time, easing);
	},

	next: function (time, easing) {
		var x = this.currentPage.pageX,
			y = this.currentPage.pageY;

		x++;

		if ( x >= this.pages.length && this.hasVerticalScroll ) {
			x = 0;
			y++;
		}

		this.goToPage(x, y, time, easing);
	},

	prev: function (time, easing) {
		var x = this.currentPage.pageX,
			y = this.currentPage.pageY;

		x--;

		if ( x < 0 && this.hasVerticalScroll ) {
			x = 0;
			y--;
		}

		this.goToPage(x, y, time, easing);
	},

	_initKeys: function (e) {
		// default key bindings
		var keys = {
			pageUp: 33,
			pageDown: 34,
			end: 35,
			home: 36,
			left: 37,
			up: 38,
			right: 39,
			down: 40
		};
		var i;

		// if you give me characters I give you keycode
		if ( typeof this.options.keyBindings == 'object' ) {
			for ( i in this.options.keyBindings ) {
				if ( typeof this.options.keyBindings[i] == 'string' ) {
					this.options.keyBindings[i] = this.options.keyBindings[i].toUpperCase().charCodeAt(0);
				}
			}
		} else {
			this.options.keyBindings = {};
		}

		for ( i in keys ) {
			this.options.keyBindings[i] = this.options.keyBindings[i] || keys[i];
		}

		utils.addEvent(window, 'keydown', this);

		this.on('destroy', function () {
			utils.removeEvent(window, 'keydown', this);
		});
	},

	_key: function (e) {
		if ( !this.enabled ) {
			return;
		}

		var snap = this.options.snap,	// we are using this alot, better to cache it
			newX = snap ? this.currentPage.pageX : this.x,
			newY = snap ? this.currentPage.pageY : this.y,
			now = utils.getTime(),
			prevTime = this.keyTime || 0,
			acceleration = 0.250,
			pos;

		if ( this.options.useTransition && this.isInTransition ) {
			pos = this.getComputedPosition();

			this._translate(Math.round(pos.x), Math.round(pos.y));
			this.isInTransition = false;
		}

		this.keyAcceleration = now - prevTime < 200 ? Math.min(this.keyAcceleration + acceleration, 50) : 0;

		switch ( e.keyCode ) {
			case this.options.keyBindings.pageUp:
				if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
					newX += snap ? 1 : this.wrapperWidth;
				} else {
					newY += snap ? 1 : this.wrapperHeight;
				}
				break;
			case this.options.keyBindings.pageDown:
				if ( this.hasHorizontalScroll && !this.hasVerticalScroll ) {
					newX -= snap ? 1 : this.wrapperWidth;
				} else {
					newY -= snap ? 1 : this.wrapperHeight;
				}
				break;
			case this.options.keyBindings.end:
				newX = snap ? this.pages.length-1 : this.maxScrollX;
				newY = snap ? this.pages[0].length-1 : this.maxScrollY;
				break;
			case this.options.keyBindings.home:
				newX = 0;
				newY = 0;
				break;
			case this.options.keyBindings.left:
				newX += snap ? -1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.up:
				newY += snap ? 1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.right:
				newX -= snap ? -1 : 5 + this.keyAcceleration>>0;
				break;
			case this.options.keyBindings.down:
				newY -= snap ? 1 : 5 + this.keyAcceleration>>0;
				break;
			default:
				return;
		}

		if ( snap ) {
			this.goToPage(newX, newY);
			return;
		}

		if ( newX > 0 ) {
			newX = 0;
			this.keyAcceleration = 0;
		} else if ( newX < this.maxScrollX ) {
			newX = this.maxScrollX;
			this.keyAcceleration = 0;
		}

		if ( newY > 0 ) {
			newY = 0;
			this.keyAcceleration = 0;
		} else if ( newY < this.maxScrollY ) {
			newY = this.maxScrollY;
			this.keyAcceleration = 0;
		}

		this.scrollTo(newX, newY, 0);

		this.keyTime = now;
	},

	_animate: function (destX, destY, duration, easingFn) {
		var that = this,
			startX = this.x,
			startY = this.y,
			startTime = utils.getTime(),
			destTime = startTime + duration;

		function step () {
			var now = utils.getTime(),
				newX, newY,
				easing;

			if ( now >= destTime ) {
				that.isAnimating = false;
				that._translate(destX, destY);
				
				if ( !that.resetPosition(that.options.bounceTime) ) {
					that._execEvent('scrollEnd');
				}

				return;
			}

			now = ( now - startTime ) / duration;
			easing = easingFn(now);
			newX = ( destX - startX ) * easing + startX;
			newY = ( destY - startY ) * easing + startY;
			that._translate(newX, newY);

			if ( that.isAnimating ) {
				rAF(step);
			}

			if ( that.options.probeType == 3 ) {
				that._execEvent('scroll');
			}
		}

		this.isAnimating = true;
		step();
	},

	handleEvent: function (e) {
		switch ( e.type ) {
			case 'touchstart':
			case 'pointerdown':
			case 'MSPointerDown':
			case 'mousedown':
				this._start(e);
				break;
			case 'touchmove':
			case 'pointermove':
			case 'MSPointerMove':
			case 'mousemove':
				this._move(e);
				break;
			case 'touchend':
			case 'pointerup':
			case 'MSPointerUp':
			case 'mouseup':
			case 'touchcancel':
			case 'pointercancel':
			case 'MSPointerCancel':
			case 'mousecancel':
				this._end(e);
				break;
			case 'orientationchange':
			case 'resize':
				this._resize();
				break;
			case 'transitionend':
			case 'webkitTransitionEnd':
			case 'oTransitionEnd':
			case 'MSTransitionEnd':
				this._transitionEnd(e);
				break;
			case 'wheel':
			case 'DOMMouseScroll':
			case 'mousewheel':
				this._wheel(e);
				break;
			case 'keydown':
				this._key(e);
				break;
			case 'click':
				if ( !e._constructed ) {
					e.preventDefault();
					e.stopPropagation();
				}
				break;
		}
	}
};
function createDefaultScrollbar (direction, interactive, type) {
	var scrollbar = document.createElement('div'),
		indicator = document.createElement('div');

	if ( type === true ) {
		scrollbar.style.cssText = 'position:absolute;z-index:9999';
		indicator.style.cssText = '-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;position:absolute;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);border-radius:3px';
	}

	indicator.className = 'iScrollIndicator';

	if ( direction == 'h' ) {
		if ( type === true ) {
			scrollbar.style.cssText += ';height:7px;left:2px;right:2px;bottom:0';
			indicator.style.height = '100%';
		}
		scrollbar.className = 'iScrollHorizontalScrollbar';
	} else {
		if ( type === true ) {
			scrollbar.style.cssText += ';width:7px;bottom:2px;top:2px;right:1px';
			indicator.style.width = '100%';
		}
		scrollbar.className = 'iScrollVerticalScrollbar';
	}

	scrollbar.style.cssText += ';overflow:hidden';

	if ( !interactive ) {
		scrollbar.style.pointerEvents = 'none';
	}

	scrollbar.appendChild(indicator);

	return scrollbar;
}

function Indicator (scroller, options) {
	this.wrapper = typeof options.el == 'string' ? document.querySelector(options.el) : options.el;
	this.wrapperStyle = this.wrapper.style;
	this.indicator = this.wrapper.children[0];
	this.indicatorStyle = this.indicator.style;
	this.scroller = scroller;

	this.options = {
		listenX: true,
		listenY: true,
		interactive: false,
		resize: true,
		defaultScrollbars: false,
		shrink: false,
		fade: false,
		speedRatioX: 0,
		speedRatioY: 0
	};

	for ( var i in options ) {
		this.options[i] = options[i];
	}

	this.sizeRatioX = 1;
	this.sizeRatioY = 1;
	this.maxPosX = 0;
	this.maxPosY = 0;

	if ( this.options.interactive ) {
		if ( !this.options.disableTouch ) {
			utils.addEvent(this.indicator, 'touchstart', this);
			utils.addEvent(window, 'touchend', this);
		}
		if ( !this.options.disablePointer ) {
			utils.addEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
			utils.addEvent(window, utils.prefixPointerEvent('pointerup'), this);
		}
		if ( !this.options.disableMouse ) {
			utils.addEvent(this.indicator, 'mousedown', this);
			utils.addEvent(window, 'mouseup', this);
		}
	}

	if ( this.options.fade ) {
		this.wrapperStyle[utils.style.transform] = this.scroller.translateZ;
		this.wrapperStyle[utils.style.transitionDuration] = utils.isBadAndroid ? '0.001s' : '0ms';
		this.wrapperStyle.opacity = '0';
	}
}

Indicator.prototype = {
	handleEvent: function (e) {
		switch ( e.type ) {
			case 'touchstart':
			case 'pointerdown':
			case 'MSPointerDown':
			case 'mousedown':
				this._start(e);
				break;
			case 'touchmove':
			case 'pointermove':
			case 'MSPointerMove':
			case 'mousemove':
				this._move(e);
				break;
			case 'touchend':
			case 'pointerup':
			case 'MSPointerUp':
			case 'mouseup':
			case 'touchcancel':
			case 'pointercancel':
			case 'MSPointerCancel':
			case 'mousecancel':
				this._end(e);
				break;
		}
	},

	destroy: function () {
		if ( this.options.interactive ) {
			utils.removeEvent(this.indicator, 'touchstart', this);
			utils.removeEvent(this.indicator, utils.prefixPointerEvent('pointerdown'), this);
			utils.removeEvent(this.indicator, 'mousedown', this);

			utils.removeEvent(window, 'touchmove', this);
			utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
			utils.removeEvent(window, 'mousemove', this);

			utils.removeEvent(window, 'touchend', this);
			utils.removeEvent(window, utils.prefixPointerEvent('pointerup'), this);
			utils.removeEvent(window, 'mouseup', this);
		}

		if ( this.options.defaultScrollbars ) {
			this.wrapper.parentNode.removeChild(this.wrapper);
		}
	},

	_start: function (e) {
		var point = e.touches ? e.touches[0] : e;

		e.preventDefault();
		e.stopPropagation();

		this.transitionTime();

		this.initiated = true;
		this.moved = false;
		this.lastPointX	= point.pageX;
		this.lastPointY	= point.pageY;

		this.startTime	= utils.getTime();

		if ( !this.options.disableTouch ) {
			utils.addEvent(window, 'touchmove', this);
		}
		if ( !this.options.disablePointer ) {
			utils.addEvent(window, utils.prefixPointerEvent('pointermove'), this);
		}
		if ( !this.options.disableMouse ) {
			utils.addEvent(window, 'mousemove', this);
		}

		this.scroller._execEvent('beforeScrollStart');
	},

	_move: function (e) {
		var point = e.touches ? e.touches[0] : e,
			deltaX, deltaY,
			newX, newY,
			timestamp = utils.getTime();

		if ( !this.moved ) {
			this.scroller._execEvent('scrollStart');
		}

		this.moved = true;

		deltaX = point.pageX - this.lastPointX;
		this.lastPointX = point.pageX;

		deltaY = point.pageY - this.lastPointY;
		this.lastPointY = point.pageY;

		newX = this.x + deltaX;
		newY = this.y + deltaY;

		this._pos(newX, newY);


		if ( this.scroller.options.probeType == 1 && timestamp - this.startTime > 300 ) {
			this.startTime = timestamp;
			this.scroller._execEvent('scroll');
		} else if ( this.scroller.options.probeType > 1 ) {
			this.scroller._execEvent('scroll');
		}


// INSERT POINT: indicator._move

		e.preventDefault();
		e.stopPropagation();
	},

	_end: function (e) {
		if ( !this.initiated ) {
			return;
		}

		this.initiated = false;

		e.preventDefault();
		e.stopPropagation();

		utils.removeEvent(window, 'touchmove', this);
		utils.removeEvent(window, utils.prefixPointerEvent('pointermove'), this);
		utils.removeEvent(window, 'mousemove', this);

		if ( this.scroller.options.snap ) {
			var snap = this.scroller._nearestSnap(this.scroller.x, this.scroller.y);

			var time = this.options.snapSpeed || Math.max(
					Math.max(
						Math.min(Math.abs(this.scroller.x - snap.x), 1000),
						Math.min(Math.abs(this.scroller.y - snap.y), 1000)
					), 300);

			if ( this.scroller.x != snap.x || this.scroller.y != snap.y ) {
				this.scroller.directionX = 0;
				this.scroller.directionY = 0;
				this.scroller.currentPage = snap;
				this.scroller.scrollTo(snap.x, snap.y, time, this.scroller.options.bounceEasing);
			}
		}

		if ( this.moved ) {
			this.scroller._execEvent('scrollEnd');
		}
	},

	transitionTime: function (time) {
		time = time || 0;
		this.indicatorStyle[utils.style.transitionDuration] = time + 'ms';

		if ( !time && utils.isBadAndroid ) {
			this.indicatorStyle[utils.style.transitionDuration] = '0.001s';
		}
	},

	transitionTimingFunction: function (easing) {
		this.indicatorStyle[utils.style.transitionTimingFunction] = easing;
	},

	refresh: function () {
		this.transitionTime();

		if ( this.options.listenX && !this.options.listenY ) {
			this.indicatorStyle.display = this.scroller.hasHorizontalScroll ? 'block' : 'none';
		} else if ( this.options.listenY && !this.options.listenX ) {
			this.indicatorStyle.display = this.scroller.hasVerticalScroll ? 'block' : 'none';
		} else {
			this.indicatorStyle.display = this.scroller.hasHorizontalScroll || this.scroller.hasVerticalScroll ? 'block' : 'none';
		}

		if ( this.scroller.hasHorizontalScroll && this.scroller.hasVerticalScroll ) {
			utils.addClass(this.wrapper, 'iScrollBothScrollbars');
			utils.removeClass(this.wrapper, 'iScrollLoneScrollbar');

			if ( this.options.defaultScrollbars && this.options.customStyle ) {
				if ( this.options.listenX ) {
					this.wrapper.style.right = '8px';
				} else {
					this.wrapper.style.bottom = '8px';
				}
			}
		} else {
			utils.removeClass(this.wrapper, 'iScrollBothScrollbars');
			utils.addClass(this.wrapper, 'iScrollLoneScrollbar');

			if ( this.options.defaultScrollbars && this.options.customStyle ) {
				if ( this.options.listenX ) {
					this.wrapper.style.right = '2px';
				} else {
					this.wrapper.style.bottom = '2px';
				}
			}
		}

		var r = this.wrapper.offsetHeight;	// force refresh

		if ( this.options.listenX ) {
			this.wrapperWidth = this.wrapper.clientWidth;
			if ( this.options.resize ) {
				this.indicatorWidth = Math.max(Math.round(this.wrapperWidth * this.wrapperWidth / (this.scroller.scrollerWidth || this.wrapperWidth || 1)), 8);
				this.indicatorStyle.width = this.indicatorWidth + 'px';
			} else {
				this.indicatorWidth = this.indicator.clientWidth;
			}

			this.maxPosX = this.wrapperWidth - this.indicatorWidth;

			if ( this.options.shrink == 'clip' ) {
				this.minBoundaryX = -this.indicatorWidth + 8;
				this.maxBoundaryX = this.wrapperWidth - 8;
			} else {
				this.minBoundaryX = 0;
				this.maxBoundaryX = this.maxPosX;
			}

			this.sizeRatioX = this.options.speedRatioX || (this.scroller.maxScrollX && (this.maxPosX / this.scroller.maxScrollX));	
		}

		if ( this.options.listenY ) {
			this.wrapperHeight = this.wrapper.clientHeight;
			if ( this.options.resize ) {
				this.indicatorHeight = Math.max(Math.round(this.wrapperHeight * this.wrapperHeight / (this.scroller.scrollerHeight || this.wrapperHeight || 1)), 8);
				this.indicatorStyle.height = this.indicatorHeight + 'px';
			} else {
				this.indicatorHeight = this.indicator.clientHeight;
			}

			this.maxPosY = this.wrapperHeight - this.indicatorHeight;

			if ( this.options.shrink == 'clip' ) {
				this.minBoundaryY = -this.indicatorHeight + 8;
				this.maxBoundaryY = this.wrapperHeight - 8;
			} else {
				this.minBoundaryY = 0;
				this.maxBoundaryY = this.maxPosY;
			}

			this.maxPosY = this.wrapperHeight - this.indicatorHeight;
			this.sizeRatioY = this.options.speedRatioY || (this.scroller.maxScrollY && (this.maxPosY / this.scroller.maxScrollY));
		}

		this.updatePosition();
	},

	updatePosition: function () {
		var x = this.options.listenX && Math.round(this.sizeRatioX * this.scroller.x) || 0,
			y = this.options.listenY && Math.round(this.sizeRatioY * this.scroller.y) || 0;

		if ( !this.options.ignoreBoundaries ) {
			if ( x < this.minBoundaryX ) {
				if ( this.options.shrink == 'scale' ) {
					this.width = Math.max(this.indicatorWidth + x, 8);
					this.indicatorStyle.width = this.width + 'px';
				}
				x = this.minBoundaryX;
			} else if ( x > this.maxBoundaryX ) {
				if ( this.options.shrink == 'scale' ) {
					this.width = Math.max(this.indicatorWidth - (x - this.maxPosX), 8);
					this.indicatorStyle.width = this.width + 'px';
					x = this.maxPosX + this.indicatorWidth - this.width;
				} else {
					x = this.maxBoundaryX;
				}
			} else if ( this.options.shrink == 'scale' && this.width != this.indicatorWidth ) {
				this.width = this.indicatorWidth;
				this.indicatorStyle.width = this.width + 'px';
			}

			if ( y < this.minBoundaryY ) {
				if ( this.options.shrink == 'scale' ) {
					this.height = Math.max(this.indicatorHeight + y * 3, 8);
					this.indicatorStyle.height = this.height + 'px';
				}
				y = this.minBoundaryY;
			} else if ( y > this.maxBoundaryY ) {
				if ( this.options.shrink == 'scale' ) {
					this.height = Math.max(this.indicatorHeight - (y - this.maxPosY) * 3, 8);
					this.indicatorStyle.height = this.height + 'px';
					y = this.maxPosY + this.indicatorHeight - this.height;
				} else {
					y = this.maxBoundaryY;
				}
			} else if ( this.options.shrink == 'scale' && this.height != this.indicatorHeight ) {
				this.height = this.indicatorHeight;
				this.indicatorStyle.height = this.height + 'px';
			}
		}

		this.x = x;
		this.y = y;

		if ( this.scroller.options.useTransform ) {
			this.indicatorStyle[utils.style.transform] = 'translate(' + x + 'px,' + y + 'px)' + this.scroller.translateZ;
		} else {
			this.indicatorStyle.left = x + 'px';
			this.indicatorStyle.top = y + 'px';
		}
	},

	_pos: function (x, y) {
		if ( x < 0 ) {
			x = 0;
		} else if ( x > this.maxPosX ) {
			x = this.maxPosX;
		}

		if ( y < 0 ) {
			y = 0;
		} else if ( y > this.maxPosY ) {
			y = this.maxPosY;
		}

		x = this.options.listenX ? Math.round(x / this.sizeRatioX) : this.scroller.x;
		y = this.options.listenY ? Math.round(y / this.sizeRatioY) : this.scroller.y;

		this.scroller.scrollTo(x, y);
	},

	fade: function (val, hold) {
		if ( hold && !this.visible ) {
			return;
		}

		clearTimeout(this.fadeTimeout);
		this.fadeTimeout = null;

		var time = val ? 250 : 500,
			delay = val ? 0 : 300;

		val = val ? '1' : '0';

		this.wrapperStyle[utils.style.transitionDuration] = time + 'ms';

		this.fadeTimeout = setTimeout((function (val) {
			this.wrapperStyle.opacity = val;
			this.visible = +val;
		}).bind(this, val), delay);
	}
};

IScroll.utils = utils;

if ( typeof module != 'undefined' && module.exports ) {
	module.exports = IScroll;
} else {
	window.IScroll = IScroll;
}

})(window, document, Math);
},{}],14:[function(require,module,exports){
/**
 * @param {String | HTMLImageElement} _img
 * @param {Function} onready 图片已可获取到尺寸，但不一定加载完成了
 * @param {Function} onload  图片已经加载完成时调用
 * @param {Function} onerror 加载出错(图片地址不可用或者网络不可用)
 *
 * imageReady=function(img, onready, onload, onerror){}
 * onready、onload、onerror的参数只有一个，都是Image对象:
 * https://github.com/qiqiboy/imageReady
 */
var imageReady = (function () {
    var list = [], // 存放需要定期检查ready状态的图片
        timer = null, // 检查图片ready状态的定时器
        tick, // 定时器脉动函数，定期触发检查list里的图片状态
        check, // 函数，用来检测图片的ready状态（通过图片.complete || .readyState，或者尺寸变动检测）

        // 是否支持HTML5新增的 naturalHeight, 支持返回1，不支持返回0，通过这分支读取prop中的不同属性
        natural = Number('naturalWidth' in new Image),
        prop = [ ['width', 'height'], ['naturalWidth', 'naturalHeight'] ],
        w = prop[natural][0],
        h = prop[natural][1];

    tick = function () {
        var i = 0;
        while (i < list.length) {
            // 已经执行过onready的图片弹出队列，未执行过的图片check后再自增序号i
            list[i].hasFireReady ? list.splice(i, 1) : check.call(list[i++]);
        }
        // 完成一次列表循环后，检查列表是否空，未空则递归调用，否则清理掉计时器
        list.length && (timer = setTimeout(tick, 50)) || (timer = null);
    };

    check = function() {
        // 1. HTMLImageElement.complete 说明已缓存
        // 2. img.__width和img.__height是初载入时的尺寸，如果跟实时获取的值不一致，说明图片已经加载到新尺寸
        // 3. HTMLImageElement.readyState 为loading时，也已经得到尺寸了
        if (this.complete || this[w] !== this.__width || this[h] !== this.__height || this.readyState == 'loading') {
            this.hasFireReady = true;
            this.onready(this); // fire!
        }
    };


    return function (_img, onready, onload, onerror) {
        onready = onready || new Function();
        onload = onload || new Function();
        onerror = onerror || new Function();

        // 传入的是src 还是 element
        var img = typeof _img === 'string' ? new Image() : _img;
        // 开始处理img...

        // ie && ie<=8 的浏览器必须在src赋予前定义onerror
        // 一旦出错，则完成任务了，标记成已经执行过ready了，执行错误处理函数，并做清理工作
        img.onerror = function() {
            img.hasFireReady = true;
            img.onload = img.onerror = img.onreadystatechange = null;
            onerror.call(img, img);
            img = null;
        };

        if (typeof _img === 'string') {
            img.src = _img;
        }


        // 出错了，直接退出 （onerror 触发后 img为null）
        if (!img) {
            return;
        }


        // 命中缓存，执行回调并退出
        // HTMLImageElement.complete 返回浏览器是否完成了该图片的加载（不论是否成功）；
        // 如果图片没有src属性，也会直接返回true。
        if (img.complete) {
            img.onerror = null;
            onready.call(img, img);
            onload.call(img, img);
            img = null;
            return;
        }


        // 将一些信息绑定到img中，以便本次处理周期未能完成处理的图片，加入外部list后，在外部的定期处理中仍能访问本闭包里的变量
        // __width、__height 保存了图片初始尺寸，onready指向用户指定的回调
        img.__width = img[w];
        img.__height = img[h];
        img.onready = onready;


        // 先check一次，若ready了可以尽早调用onready函数，并设置hasFireReady
        check.call(img);


        img.onload = img.onreadystatechange = function() {
            if (img && img.readyState && img.readyState != 'loaded' && img.readyState != 'complete') {
                return;
            }
            // IE gif动画会循环执行onload，需要置空
            img.onload = img.onerror = img.onreadystatechange = null;

            // 由于定时器时间差，首次check时可能未ready，而未到下次定时check时可能已经onload了
            // 确保执行顺序，这里再实时check一次
            !img.hasFireReady && check.call(img);
            onload.call(img, img);

            img = null;
        }

        if (!img.hasFireReady) {
            // 未ready的图片，存入外部函数的list队列变量中定期检查
            list.push(img);

            // 若外部的timer已经停止（list空），则新启动一个timer，这样始终只有一个timer，减少资源消耗
            !timer && (timer = setTimeout(tick, 50));
        }
    }
})();


module.exports = imageReady;
},{}]},{},[1]);
