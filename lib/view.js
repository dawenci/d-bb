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
    render: function(options) {
        var template, fragment, slen, i, _isRefresh;

        // 已经挂载，说明这次render是refresh
        _isRefresh = this._isMounted();

        if (this.options.supportLifeCycle) {
            this._lifeCycleTrigger('viewWillRender', this);
            if (_isRefresh) {
                this._lifeCycleTrigger('viewWillRefresh', this);
            }
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
    dealloc: function () {
        if (this._isDealloc) { return this;}

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

        delete this._superView;
        delete this._subViews;
        delete this.el;
        delete this.$el;
        delete this.model;
        delete this.collection;
        delete this.options;

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
            if (views._superView && views._superView === this) {
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
                if (current._superView && current._superView === this) {
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
            current._superView = this;
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
            if (view._superView === this) {
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
        delete view._superView;


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


    getSupperView: function() {
        return this._superView || null;
    },

    getSubViewAt: function(index) {
        if (!this._hasSubView) {
            return null;
        }
        return this._subViews[index] || null;
    },

    getSubViews: function() {
        return this._subViews || null;
    },

    eachSubView: function(callback) {
        if (this._hasSubView) {
            this._subViews.forEach(callback);
        }
        return this;
    },

    count: function() {
        if (this._hasSubView()) {
            return this._subViews.length;
        } else {
            return 0;
        }
    },

    // 查询视图在子视图中的index
    indexOfSubView: function(subView) {
        return this._subViews.indexOf(subView);
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
