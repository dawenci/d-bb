var Dbb = require('./dbb');
var _hasOwnProperty = Object.prototype.hasOwnProperty;
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
 * subview events
 * subviewWillAdd(subview, self, options): 即将添加子视图
 * subviewDidAdd(subview, self, options): 完成添加子视图
 * subviewWillRemove(subview, self, options): 子视图即将移除
 * subviewDidRemove(subview, self, options): 子视图完成移除
 * subviewsWillSort(self): 子视图即将排序
 * subviewsDidSort(self): 子视图完成排序
 *
**/

Dbb.View = Backbone.View.extend({
    constructor: function DbbView(options) {
        // 使用options的拷贝而非引用
        options = _.extend({
            supportLifeCycle: true
        }, options || {});

        // 新版的backbone不会自动创建this.options，这里手工创建
        this.options = options;

        // 最后才调用父类构造函数
        // 顺序不能变，否则在继承Dbb.View的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options);
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
    render: function render(model, options) {
        var template, fragment, slen, i, _isRefresh, data;

        model = model || this.model || {};
        options = _.extend({}, options || {});

        // 已经挂载，说明这次render是refresh
        _isRefresh = this._isMounted();

        if (this.options.supportLifeCycle) {
            this._lifeCycleTrigger('viewWillRender', this);
            if (_isRefresh) {
                this._lifeCycleTrigger('viewWillRefresh', this);
            }
        }

        // 把子视图移到 fragment 里，以便后续重新渲染当前视图后加回来
        if (this._hasSubview()) {
            slen = this._subviews.length;
            fragment = document.createDocumentFragment();
            for (i = 0; i < slen; i += 1) {
                fragment.appendChild(this._subviews[i].el);
            }
        }

        // render开始，如果存在模板，则渲染相关html
        if ((template = this.templateForView())) {
            data = this.dataForView(model);
            this.el.innerHTML = template(data);
        }
        this._mountPoint = this.mountPointForSubview();

        // 将子View 的el 插回来
        fragment && this._mountPoint.appendChild(fragment);

        if (this.options.supportLifeCycle) {
            this._lifeCycleTrigger('viewDidRender', this);
            if (_isRefresh) {
                this._lifeCycleTrigger('viewDidRefresh', this);
            }
        }

        this._isRendered = true;
        return this;
    },


    /**
     * @method View#dealloc
     * @description
     * 视图销毁
     */
    dealloc: function dealloc() {
        if (this._isDealloc) { return this;}

        this.options.supportLifeCycle && this._lifeCycleTrigger('viewWillDealloc', this);

        // 递归子视图的清理
        this._hasSubview() && this._subviews.forEach(function(view) {
            view.dealloc();
        });

        this._isDealloc = true;

        // this._isRendered = false;

        this.options.supportLifeCycle && this._lifeCycleTrigger('viewDidDealloc', this);

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做dealloc

        // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。
        this.remove();

        // 移除用this.on绑定的事件
        this.off();

        for (var p in this) {
            if (p === '_isDealloc') {
                continue;
            }
            if (_hasOwnProperty.call(this, p)) {
                delete this[p];
            }
        }
        // delete this._superview;
        // delete this._subviews;
        // delete this.el;
        // delete this.$el;
        // delete this.model;
        // delete this.collection;
        // delete this.options;

        return this;
    },


    /**
     * @method View#mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    mountToEl: function mountToEl(el, options) {
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
     * @method View#addSubview
     * @param {Dbb.View} subview
     * @param {Object} options
     *
     * addSubview(view, options)
     *
     * parent.addSubview(subview, {...});
     * parent.addSubview(subview, {atIndex: index}); // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillMount {Boolean}
     * options.shouldPropagateViewDidMount {bool}
     *
     */
    addSubview: function addSubview(views, options) {
        var subviews, subviewsCount,
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
        subviews = this._subviews || (this._subviews = []);
        subviewsCount = subviews.length;
        el = document.createDocumentFragment();


        // 确定插入点
        atIndex = options.atIndex;
        if (atIndex !== 'first' && atIndex !== 'last' && typeof atIndex !== 'number') {
            Dbb.error('子视图插入点(options.atIndex:' + atIndex + ')无效！重设为last');
            atIndex = 'last';
        }
        if (typeof atIndex === 'number') {
            if(atIndex < 0 || atIndex >= subviewsCount) {
                Dbb.error('子视图插入点(options.atIndex:' + atIndex + ')无效！重设为last');
                atIndex = 'last';
            }
        } else if (atIndex === 'first') {
            atIndex = 0;
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subviewWillAdd', views, this, options);

        // 代理子视图事件
        if (options.shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                this._delegateEvents(current);
            }
        }

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

        // 先挂载DOM，再插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this._mountPoint.appendChild(el);
            this._subviews = subviews.concat(views);
        } else {
            this._mountPoint.insertBefore(el, subviews[atIndex].el);
            // this._subviews.splice(atIndex, 0, subviews[0]);
            this._subviews = subviews.slice(0, atIndex).concat(views).concat(subviews.slice(atIndex));
        }
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            current._superview = this;
        }


        // 如subview已经mounted，向所有子类传播viewDidMount
        if (this._isMounted()) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                current.options.supportLifeCycle && current._lifeCycleTrigger('viewDidMount', current);
                options.shouldPropagateViewWillMount && current._propagateLifeCycleMethod('viewDidMount');
            }
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subviewDidAdd', views, this, options);

        return this;
    },


    /**
     * @method View#removeSubview
     * @param {Dbb.View} view
     * @param {Object} options
     *
     * @description
     * 移除一个子视图
     *
     * removeSubview([view,] options)
     *
     * parent.removeSubview(subview, {...});
     * parent.removeSubview({atIndex: index}); // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillUnMount {Boolean}
     * options.shouldPropagateViewDidUnMount {bool}
     * options.shouldPreventDealloc {bool}
     *
     */
    removeSubview: function removeSubview(view, options) {
        var subviews, subviewsCount,
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

        if (!this._hasSubview()) {
            return this;
        }

        options = _.extend({
            shouldPropagateViewWillUnMount: true,
            shouldPropagateViewDidUnMount: true,
            shouldPreventDealloc: false
        }, options);

        subviews = this._subviews;
        subviewsCount = subviews.length;


        // 确定atIndex的值
        if (view !== null) {
            if (view._superview === this) {
                atIndex = subviews.indexOf(view);
                if (atIndex === -1) {
                    atIndex = undefined;
                }
            } else {
                Dbb.error('removeSubview参数中的view不是当前View的子视图');
            }
        }
        // options中的atIndex 可能不合法，需要检查
        if (atIndex === undefined) {
            atIndex = options.atIndex;
            if (atIndex === 'first') {
                atIndex = 0;
            } else if (atIndex === 'last') {
                atIndex = subviewsCount - 1;
            } else if (typeof atIndex === 'number') {
                if (atIndex < 0 || atIndex > subviewsCount - 1) {
                    Dbb.error('子视图移除点的值(options.atIndex:' + atIndex + ')无效');
                    return this;
                }
            } else {
                Dbb.error('子视图移除点的值(options.atIndex:' + atIndex + ')无效');
                return this;
            }
        }

        if (view === null) {
            view = subviews[atIndex];
        }

        // 即将移除的subview及index附加到options里，传递给事件处理器
        options.view = view;
        options.atIndex = atIndex;


        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subviewWillRemove', view, this, options);

        subviews.splice(atIndex, 1);
        delete view._superview;

        // 移除对subview的事件代理
        this._unDelegateEvents(view);

        // 如果当前subview已经mounted，向所有子类传播viewWillUnMount
        if (view._isMounted()) {
            view.options.supportLifeCycle &&
                view._lifeCycleTrigger('viewWillUnMount', view);
            options.shouldPropagateViewWillUnMount &&
                view._propagateLifeCycleMethod('viewWillUnMount');
        }

        this._mountPoint.removeChild(view.el);

        // 如果当前subview已经unmounted，向所有子类传播viewDidUnMount
        if (!view._isMounted()) {
            view.options.supportLifeCycle &&
                view._lifeCycleTrigger('viewDidUnMount', view);
            options.shouldPropagateViewWillUnMount &&
                view._propagateLifeCycleMethod('viewDidUnMount');
        }

        this.options.supportLifeCycle &&
            this._lifeCycleTrigger('subviewDidRemove', view, this, options);

        if (!options.shouldPreventDealloc) {
            view.dealloc();
        }

        return this;
    },


    emptySubviews: function emptySubviews() {
        var subviews, len, i;
        if (!this._hasSubview()) {
            return this;
        }
        subviews = this._subviews;
        len = subviews.length;
        for (i = 0; i < len; i += 1) {
            this._unDelegateEvents(subviews[i]);
            subviews[i].dealloc();
        }
        subviews.length = 0;
        return this;
    },


    sortSubviews: function sortSubviews(comparator) {
        var fragment, subviews, len, i, _mountPoint, display;
        if (!this._hasSubview() || typeof comparator !== 'function') {
            return this;
        }
        subviews = this._subviews;
        len = subviews.length;
        // 先排序
        subviews.sort(comparator);

        // 执行变更
        _mountPoint = this._mountPoint;
        display = _mountPoint.style.display;
        _mountPoint.style.display = 'none';
        fragment = document.createDocumentFragment();
        for (i = 0; i < len; i += 1) {
            fragment.appendChild(subviews[i].el);
        }
        _mountPoint.style.display = display;
        _mountPoint.appendChild(fragment);
        return this;
    },


    getSupperView: function getSupperView() {
        return this._superview || null;
    },

    getSubviewAt: function getSubviewAt(index) {
        if (!this._hasSubview()) {
            return null;
        }
        return this._subviews[index] || null;
    },

    getFirstSubview: function getFirstSubview() {
        return this.getSubviewAt(0);
    },

    getLastSubview: function getLastSubview() {
        return this.getSubviewAt(this.count() - 1);
    },

    getNextSibling: function getNextSibling() {
        var superview, idx;
        if (superview = this.getSupperView()) {
        	if (this === superview.getLastSubview()) {
        		return null;
        	}
            idx = superview.indexOfSubview(this);
            return superview.getSubviewAt(idx + 1);
        } else {
            return null;
        }
    },

    getPrevSibling: function getPrevSibling() {
    	var superview, idx;
        if (superview = this.getSupperView()) {
        	if (this === superview.getFirstSubview()) {
        		return null;
        	}
            idx = superview.indexOfSubview(this);
            return superview.getSubviewAt(idx - 1);
        } else {
            return null;
        }
    },

    getSubviews: function getSubviews() {
        return this._subviews || null;
    },

    eachSubview: function eachSubview(callback) {
        if (this._hasSubview()) {
            this._subviews.forEach(callback);
        }
        return this;
    },

    count: function count() {
        if (this._hasSubview()) {
            return this._subviews.length;
        } else {
            return 0;
        }
    },

    // 查询视图在子视图中的index
    indexOfSubview: function indexOfSubview(subview) {
        if (!this._hasSubview()) {
            return -1;
        }
        return this._subviews.indexOf(subview);
    },

    indexInSuperview: function indexInSuperview() {
        if (!this._superview) {
            return -1;
        }
        return this._superview.indexOfSubview(this);
    },


    /**
     * @method View#dataForView
     * @description 视图渲染所需的数据
     */
    dataForView: function dataForView(model) {
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
    templateForView: function templateForView() {
        var template;
        template = this.options.template || this.template;
        return template;
    },


    // 可重写，如何获取子view的el挂载dom容器
    mountPointForSubview: function mountPointForSubview() {
        var el = this.el.querySelector('.dbbview-mountpoint') || this.el;
        return el;
    },

    isRendered: function isRendered() {
        return this._isRendered;
    },

    _lifeCycleTrigger: Dbb.triggerEventMethod,


    _isMounted: function _isMounted() {
        return this.el && this._isElMounted(this.el);
    },

    _isElMounted: function _isElMounted(el) {
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

    _hasSubview: function _hasSubview() {
        return !!this._subviews && !!this._subviews.length;
    },

    _propagateLifeCycleMethod: function _propagateLifeCycleMethod(method) {
        var subviews, len, i;
        if (this._hasSubview()) {
            subviews = this._subviews;
            len = subviews.length;
            for (i = 0; i < len; i += 1) {
                subviews[i]._lifeCycleTrigger(method, subviews[i]);
                subviews[i]._propagateLifeCycleMethod(method);
            }
        }
    },

    _delegateEvents: function _delegateEvents(subview) {
        this.listenTo(subview, 'all', this._delegateEventsCB);
        return this;
    },
    _delegateEventsCB: function _delegateEventsCB(name) {
        var args = [];
        args.push('subview.' + name);
        args = args.concat(_slice.call(arguments, 1));
        this.trigger.apply(this, args);
    },
    _unDelegateEvents: function _unDelegateEvents(subview) {
        this.stopListening(subview);
        return this;
    }

});



// View的基类
module.exports = Dbb;
