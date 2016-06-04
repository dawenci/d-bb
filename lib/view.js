var Dbb = require('./dbb'),
    _hasOwnProperty = Object.prototype.hasOwnProperty,
    _slice = Array.prototype.slice,
    viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

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
// View的基类
var DbbView = Backbone.View.extend({
    constructor: function DbbView(options) {
        // 使用options的拷贝而非引用
        var opts = _.extend({
            supportLifeCycle: true
        }, options || {});

        // 新版的backbone不会自动创建this.options，这里手工创建
        this.options = _.omit(opts, viewOptions);

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
        options = _.extend({}, this.options, options || {});

        // 已经挂载，说明这次render是refresh
        _isRefresh = this.isMounted();

        if (options.supportLifeCycle) {
            this._lifeCycleTrigger('viewWillRender', this);
            if (_isRefresh) this._lifeCycleTrigger('viewWillRefresh', this);
        }

        template = this.templateForView();

        // render开始，如果存在模板，则渲染相关html
        if (template) {
            // 把子视图移到 fragment 里，以便后续重新渲染当前视图后加回来
            if (this.hasSubview()) {
                slen = this._subviews.length;
                fragment = document.createDocumentFragment();
                for (i = 0; i < slen; i += 1) {
                    fragment.appendChild(this._subviews[i].el);
                }
            }

            // 使用数据渲染模板，并刷新dom
            data = this.dataForView(model);
            this.el.innerHTML = template(data);

            // 刷新挂载点
            this._mountPoint = this.mountPointForSubview();

            // 将子View 的el 插回来
            if (fragment) this._mountPoint.appendChild(fragment);
        } else {
            // 设置挂载点
            this._mountPoint = this.mountPointForSubview();
        }

        if (options.supportLifeCycle) {
            this._lifeCycleTrigger('viewDidRender', this);
            if (_isRefresh) this._lifeCycleTrigger('viewDidRefresh', this);
        }

        this.setRendered();
        return this;
    },


    /**
     * @method View#dealloc
     * @description
     * 视图销毁
     */
    dealloc: function dealloc(options) {
        if (this._isDealloc) { return this;}

        options = _.extend({}, this.options, options || {});

        if (options.supportLifeCycle) this._lifeCycleTrigger('viewWillDealloc', this);

        // 递归子视图的清理
        if (this.hasSubview()) this._subviews.forEach(function(view) {
            view.dealloc();
        });

        this._isDealloc = true;

        if (options.supportLifeCycle) this._lifeCycleTrigger('viewDidDealloc', this);

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做dealloc

        // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。
        this.remove();

        // 移除用this.on绑定的事件
        this.off();

        for (var p in this) {
            if (p === '_isDealloc') continue;
            if (_.has(this, p)) delete this[p];
        }

        return this;
    },


    /**
     * @method View#mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    mountToEl: function mountToEl(el, options) {
        // the mountPoint is unmounted.
        if (!this._isElMounted(el)) return this;

        // 'DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
        if (this._isDealloc) return this;

        if (this.isMounted()) return this;

        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true
        }, this.options, options || {});

        if (!this._isRendered) this.render();

        if (options.supportLifeCycle) this._lifeCycleTrigger('viewWillMount', this);
        if (options.shouldPropagateViewWillMount) this._propagateLifeCycleMethod('viewWillMount');

        el.appendChild(this.el);

        if (options.supportLifeCycle) this._lifeCycleTrigger('viewDidMount', this);
        if (options.shouldPropagateViewWillMount) this._propagateLifeCycleMethod('viewDidMount');

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
        var viewsCount,
            subviews, subviewsCount,
            len, i, current,
            frag,
            atIndex,
            isMounted;

        // 处理参数：过滤无效视图
        // views 可能是一个单独的视图，也可能是一个视图数组，分别处理
        if (_.isArray(views)) {
            views = _.filter(views, function(view) {
                if (view._isDealloc) return false;
                if (view._superview && view._superview === this) return false;
                return true;
            }, this);
            if (!(viewsCount = views.length)) return this;
        } else {
            if (!views) return this;
            if (views._isDealloc) return this;
            if (views._superview && views._superview === this) return this;
            views = [views];
            viewsCount = 1;
        }

        // 处理参数：处理options
        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true,
            atIndex: 'last',
        }, this.options, options || {});


        // 局部变量缓存
        subviews = this._subviews || (this._subviews = []);
        subviewsCount = subviews.length;
        frag = document.createDocumentFragment();


        // 确定插入点
        atIndex = options.atIndex;
        // 字符串的情况，非'first'的全重置为'last'。
        if (typeof atIndex === 'string') {
            if (atIndex === 'first') {
                atIndex = 0;
            } else {
                atIndex = 'last';
            }
        } else if (typeof atIndex === 'number') { // 数字的情况，非合法index重置为'last'
            if(atIndex < 0 || atIndex >= subviewsCount) atIndex = 'last';
        } else { // 任何其他值都是非法的，全部重置为'last'
            atIndex = 'last';
        }


        if (options.supportLifeCycle) this._lifeCycleTrigger('subviewWillAdd', views, this, options);

        // 代理子视图事件
        if (options.shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) { this._delegateEvents(views[i]); }
        }

        // 渲染好模板，以便子view的DOM插入
        if (!this._isRendered) this.render();
        // 渲染好subview的模板，并插入
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            if (!current._isRendered) current.render();
            frag.appendChild(current.el);
        }


        // 如果当前view已经mounted，向所有子类传播viewWillMount
        if ((isMounted = this.isMounted())) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                if (current.options.supportLifeCycle) current._lifeCycleTrigger('viewWillMount', current);
                if (options.shouldPropagateViewWillMount) current._propagateLifeCycleMethod('viewWillMount');
            }
        }

        // 先挂载DOM，再插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this._mountPoint.appendChild(frag);
            this._subviews = subviews.concat(views);
        } else {
            this._mountPoint.insertBefore(frag, subviews[atIndex].el);
            this._subviews = subviews.slice(0, atIndex).concat(views).concat(subviews.slice(atIndex));
        }

        // 插入的subview 全部附加上_superview的属性
        for (i = 0; i < viewsCount; i += 1) { views[i]._superview = this; }


        // 如subview已经mounted，向所有子类传播viewDidMount
        if (isMounted) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                if (current.options.supportLifeCycle) current._lifeCycleTrigger('viewDidMount', current);
                if (options.shouldPropagateViewWillMount) current._propagateLifeCycleMethod('viewDidMount');
            }
        }

        if (options.supportLifeCycle) this._lifeCycleTrigger('subviewDidAdd', views, this, options);

        return this;
    },


    /**
     * @method View#removeSubview
     * @param {Dbb.View | Number | String} view // subview or index number or 'first', 'last'
     * @param {Object} options
     *
     * @description
     * 移除一个子视图
     *
     * removeSubview(view [,options])
     *
     * parent.removeSubview(subview [,options]);
     * parent.removeSubview(indexNumber [,options]);
     * parent.removeSubview('first' [,options]);
     * parent.removeSubview('last' [,options]);
     *
     * options.shouldPropagateViewWillUnMount {Boolean}
     * options.shouldPropagateViewDidUnMount {bool}
     * options.shouldPreventDealloc {bool}
     *
     */
    removeSubview: function removeSubview(view, options) {
        var subviews, count, atIndex;

        if (!this.hasSubview()) return this;
        if (!view) return this;

        options = _.extend({
            shouldPropagateViewWillUnMount: true,
            shouldPropagateViewDidUnMount: true,
            shouldPreventDealloc: false
        }, this.options, options || {});

        subviews = this._subviews;
        count = subviews.length;

        // 确定atIndex的值
        if (view instanceof DbbView) {
            atIndex = this.indexOfSubview(view);
        } else {
            if (typeof view === 'number') {
                if (view < 0 || view >= count) atIndex = -1; else atIndex = view;
            } else if (view === 'first') {
                atIndex = 0;
            } else if (view === 'last') {
                atIndex = this.count() - 1;
            } else {
                atIndex = -1;
            }
            view = null;
        }

        if (atIndex === -1) return this;

        if (view === null) view = subviews[atIndex];

        // 即将移除的subview及index附加到options里，传递给事件处理器
        options.view = view;
        options.atIndex = atIndex;


        if (options.supportLifeCycle) this._lifeCycleTrigger('subviewWillRemove', view, this, options);

        subviews.splice(atIndex, 1);
        delete view._superview;

        // 移除对subview的事件代理
        this._unDelegateEvents(view);

        // 如果当前subview已经mounted，向所有子类传播viewWillUnMount
        if (view.isMounted()) {
            if (view.options.supportLifeCycle) view._lifeCycleTrigger('viewWillUnMount', view);
            if (options.shouldPropagateViewWillUnMount) view._propagateLifeCycleMethod('viewWillUnMount');
        }

        this._mountPoint.removeChild(view.el);

        // 如果当前subview已经unmounted，向所有子类传播viewDidUnMount
        if (!view.isMounted()) {
            if (view.options.supportLifeCycle) view._lifeCycleTrigger('viewDidUnMount', view);
            if (options.shouldPropagateViewWillUnMount) view._propagateLifeCycleMethod('viewDidUnMount');
        }

        if (options.supportLifeCycle) this._lifeCycleTrigger('subviewDidRemove', view, this, options);

        if (!options.shouldPreventDealloc) view.dealloc();

        return this;
    },


    emptySubviews: function emptySubviews() {
        var self = this;
        if (!this.hasSubview()) return this;
        this.eachSubview(function(view) {
            self._unDelegateEvents(view);
            view.dealloc();
        });
        this._subviews.length = 0;
        return this;
    },


    sortSubviews: function sortSubviews(comparator) {
        var fragment, subviews, len, i, _mountPoint, display;
        if (!this.hasSubview() || typeof comparator !== 'function') return this;

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
        if (!this.hasSubview()) return null;
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

        superview = this.getSupperView();
        if (superview) {
            idx = superview.indexOfSubview(this);
            if (idx === superview.count() - 1) return null;
            return superview.getSubviewAt(idx + 1);
        } else {
            return null;
        }
    },

    getPrevSibling: function getPrevSibling() {
    	var superview, idx;

        superview = this.getSupperView();
        if (superview) {
            idx = superview.indexOfSubview(this);
            if (idx === 0) return null;
            return superview.getSubviewAt(idx - 1);
        } else {
            return null;
        }
    },

    getSubviews: function getSubviews() {
        return this._subviews || null;
    },

    eachSubview: function eachSubview(callback) {
        if (this.hasSubview()) this._subviews.forEach(callback);
        return this;
    },

    count: function count() {
        if (this.hasSubview()) return this._subviews.length;
        return 0;
    },

    // 查询视图在子视图中的index
    indexOfSubview: function indexOfSubview(subview) {
        if (!this.hasSubview()) return -1;
        return this._subviews.indexOf(subview);
    },

    indexInSuperview: function indexInSuperview() {
        if (!this._superview) return -1;
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
        return this.options.template || this.template;
    },


    // 可重写，如何获取子view的el挂载dom容器
    mountPointForSubview: function mountPointForSubview() {
        return this.el.querySelector('.dbbview-mountpoint') || this.el;
    },

    isRendered: function isRendered() {
        return this._isRendered;
    },

    setRendered: function setRendered() {
        this._isRendered = true;
    },

    _lifeCycleTrigger: Dbb.triggerEventMethod,


    isMounted: function isMounted() {
        return this.el && this._isElMounted(this.el);
    },

    _isElMounted: function _isElMounted(el) {
        var docEl = document.documentElement;
        var parent;

        if (docEl.contains) return docEl.contains(el);
        if (docEl.compareDocumentPosition) return !!(docEl.compareDocumentPosition(el) & 16);
        parent = el.parentNode;
        while (parent) {
            if (parent == docEl) return true;
            parent = parent.parentNode;
        }
        return false;
    },

    hasSubview: function hasSubview() {
        return !!this._subviews && !!this._subviews.length;
    },

    _propagateLifeCycleMethod: function _propagateLifeCycleMethod(method) {
        var subviews, len, i;
        if (this.hasSubview()) {
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

module.exports = DbbView;
