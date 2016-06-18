var Dbb = require('./dbb'),
    viewFields = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'],
    viewOptions = ['supportLifeCycle'];

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
        // view生存中，不可回收
        this._isRetained = 1;

        // 视图options数据
        this.options = _.extend({ supportLifeCycle: true }, _.pick(options, viewOptions));

        // options 及默认fields 以外的数据，合并入view
        _.extend(this, _.omit(options, viewFields.concat(viewOptions) ));

        // 最后才调用父类构造函数
        // 顺序不能变，否则在继承Dbb.View的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options);
    },


    // 确认视图的模板是否渲染
    _isRendered: false,


    /**
     * @method View#dealloc
     * @description
     * 视图销毁
     */
    dealloc: function dealloc(options) {
        var count;

        if (this.isDealloc()) return this;

        options = _.extend({}, this.options, options || {});

        if (options.supportLifeCycle) this.triggerEventMethod('viewWillDealloc', this);

        // 递归子视图的清理
        count = this.count();
        if (this.hasSubview()) {
            while (count--) { this._subviews[count].dealloc();}
        }

        delete this._isRetained;
        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做dealloc
        this.remove(); // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。

        // 必须放在off前，off会一并移除通过listenTo监听此事件的其他对象的相应事件
        // a.listenTo(b,...), a.stopListening 相当于 b.off(null,null,a); b.off()相当于a.stopListening
        if (options.supportLifeCycle) this.triggerEventMethod('viewDidDealloc', this);

        this.off(); // 移除用this.on绑定的事件
        _.each(_.keys(this), function(prop) { if (prop !== 'cid') delete this[prop]; }, this);

        return this;
    },


    /**
     * @method View#render
     * @description
     * 模板渲染
     */
    render: function render(model, options) {
        var template, fragment, isRefresh, data;

        model = model || this.model || {};
        options = _.extend({}, this.options, options || {});

        // 已经挂载，说明这次render是refresh
        isRefresh = this.isMounted();

        if (options.supportLifeCycle) {
            this.triggerEventMethod('viewWillRender', this);
            if (isRefresh) this.triggerEventMethod('viewWillRefresh', this);
        }

        template = _.result(this, 'templateForView');
        // render开始，如果存在模板，则渲染相关html
        if (_.isFunction(template)) {
            // 把子视图移到 fragment 里，以便后续重新渲染当前视图后加回来
            if (this.hasSubview()) {
                fragment = document.createDocumentFragment();
                this.eachSubview(function(view) {
                    fragment.appendChild(view.el);
                });
            }

            // 使用数据渲染模板，并刷新dom
            data = this.dataForView(model);
            this.el.innerHTML = template(data);

            this._mountPoint = _.result(this, 'mountPointForSubview', this.el); // 刷新挂载点

            // 将子View 的el 插回来
            if (fragment) this._mountPoint.appendChild(fragment);
        } else {
            this._mountPoint = _.result(this, 'mountPointForSubview', this.el); // 设置挂载点
        }

        if (options.supportLifeCycle) {
            this.triggerEventMethod('viewDidRender', this);
            if (isRefresh) this.triggerEventMethod('viewDidRefresh', this);
        }

        this.setRendered();
        return this;
    },


    /**
     * @method View#dataForView
     * @description 视图渲染所需的数据
     * 可 override
     */
    dataForView: function dataForView(model) {
        var data;
        if (model instanceof Backbone.Model) {
            data = model.toJSON();
            data.cid = model.cid;
        } else if (model instanceof Object) { data = _.clone(model); } else { data = {}; }
        return data;
    },


    // 可override，返回模板
    templateForView: function templateForView() {
        return this.options.template || this.template;
    },


    // 可override，如何获取子view的el挂载dom容器
    mountPointForSubview: function mountPointForSubview() {
        return this.el.querySelector('.dbbview-mountpoint') || this.el;
    },


    isMounted: function isMounted() { return this.isElMounted(this.el); },

    isRendered: function isRendered() { return this._isRendered; },

    setRendered: function setRendered() { this._isRendered = true; },

    // 1. has own property '_isRetained' ?  2. _isRetained == true ?
    isRetained: function isRetained() { return _.has(this, '_isRetained') && !!this._isRetained; },
    isDealloc: function isDealloc() { return !this._isRetained || !_.has(this, '_isRetained'); },

    /**
     * @method View#mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    mountToEl: function mountToEl(el, options) {
        // the mountPoint is unmounted.
        if (!this.isElMounted(el)) return this;

        // 'DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
        if(this.isDealloc()) return this;

        if (this.isMounted()) return this;

        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true
        }, this.options, options || {});

        if (!this.isRendered()) this.render();

        if (options.supportLifeCycle) this.triggerEventMethod('viewWillMount', this);
        if (options.shouldPropagateViewWillMount) this.propagateLifeCycleMethod('viewWillMount');

        el.appendChild(this.el);

        if (options.supportLifeCycle) this.triggerEventMethod('viewDidMount', this);
        if (options.shouldPropagateViewWillMount) this.propagateLifeCycleMethod('viewDidMount');

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
                if (!(view instanceof DbbView)) return false;
                if (view.isDealloc()) return false;
                if (view._superview && view._superview === this) return false;
                return true;
            }, this);
            if (!(viewsCount = views.length)) return this;
        } else {
            if (!views) return this;
            if (!(views instanceof DbbView)) return false;
            if (views.isDealloc()) return this;
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
            if (atIndex === 'first') atIndex = 0; else atIndex = 'last';
        } else if (typeof atIndex === 'number') { // 数字的情况，非合法index重置为'last'
            if(atIndex < 0 || atIndex >= subviewsCount) atIndex = 'last';
        } else { // 任何其他值都是非法的，全部重置为'last'
            atIndex = 'last';
        }


        if (options.supportLifeCycle) this.triggerEventMethod('subviewWillAdd', views, this, options);

        // 代理子视图事件
        if (options.shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) { this._delegateEvents(views[i]); }
        }

        // 渲染好模板，以便子view的DOM插入
        if (!this.isRendered()) this.render();
        // 渲染好subview的模板，并插入
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            if (!current.isRendered()) current.render();
            frag.appendChild(current.el);
        }


        // 如果当前view已经mounted，向所有子类传播viewWillMount
        if ((isMounted = this.isMounted())) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                if (current.options.supportLifeCycle) current.triggerEventMethod('viewWillMount', current);
                if (options.shouldPropagateViewWillMount) current.propagateLifeCycleMethod('viewWillMount');
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
                if (current.options.supportLifeCycle) current.triggerEventMethod('viewDidMount', current);
                if (options.shouldPropagateViewWillMount) current.propagateLifeCycleMethod('viewDidMount');
            }
        }

        if (options.supportLifeCycle) this.triggerEventMethod('subviewDidAdd', views, this, options);

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
        var subviews, atIndex;

        if (!this.hasSubview()) return this;
        if (view === undefined) return this;

        options = _.extend({
            shouldPropagateViewWillUnMount: true,
            shouldPropagateViewDidUnMount: true,
            shouldPreventDealloc: false
        }, this.options, options || {});

        subviews = this._subviews;

        // 确定atIndex的值
        if (view instanceof DbbView) {
            atIndex = this.indexOfSubview(view);
        } else {
            if (typeof view === 'number') {
                if (view < 0 || view >= this.count()) atIndex = -1; else atIndex = view;
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


        if (options.supportLifeCycle) this.triggerEventMethod('subviewWillRemove', view, this, options);

        subviews.splice(atIndex, 1);
        delete view._superview;

        // 移除对subview的事件代理
        this._unDelegateEvents(view);

        // 如果当前subview已经mounted，向所有子类传播viewWillUnMount
        if (view.isMounted()) {
            if (view.options.supportLifeCycle) view.triggerEventMethod('viewWillUnMount', view);
            if (options.shouldPropagateViewWillUnMount) view.propagateLifeCycleMethod('viewWillUnMount');
        }

        this._mountPoint.removeChild(view.el);

        // 如果当前subview已经unmounted，向所有子类传播viewDidUnMount
        if (!view.isMounted()) {
            if (view.options.supportLifeCycle) view.triggerEventMethod('viewDidUnMount', view);
            if (options.shouldPropagateViewWillUnMount) view.propagateLifeCycleMethod('viewDidUnMount');
        }

        if (options.supportLifeCycle) this.triggerEventMethod('subviewDidRemove', view, this, options);

        if (!options.shouldPreventDealloc) view.dealloc();

        return this;
    },

    hasSubview: function hasSubview() { return !!this.count(); },
    count: function count() { return _.size(this._subviews); },
    eachSubview: function eachSubview(callback, context) {
        var i;
        if (!this.hasSubview()) return;
        if (!context) {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this._subviews.length; i += 1) {
                callback(this._subviews[i], i, this._subviews);
            }
        } else {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this._subviews.length; i += 1) {
                callback.call(context, this._subviews[i], i, this._subviews);
            }
        }
    },
    // 查询视图在子视图中的index
    indexOfSubview: function indexOfSubview(subview, isSort) {
        return _.indexOf(this._subviews, subview, isSort);
    },
    indexInSuperview: function indexInSuperview(isSort) {
        if (!this._superview) return -1;
        return this._superview.indexOfSubview(this, isSort);
    },
    getSubviews: function getSubviews() {
        if (this.hasSubview()) return this._subviews;
        return null;
    },
    getSubviewAt: function getSubviewAt(index) {
        if (!this.hasSubview()) return null;
        return this._subviews[index] || null;
    },
    getSupperview: function getSupperview() { return this._superview || null; },
    getFirstSubview: function getFirstSubview() { return this.getSubviewAt(0); },
    getLastSubview: function getLastSubview() { return this.getSubviewAt(this.count() - 1); },
    getNextSibling: function getNextSibling() {
        var superview, idx;
        if ((superview = this.getSupperview())) {
            idx = superview.indexOfSubview(this);
            if (idx === superview.count() - 1) return null;
            return superview.getSubviewAt(idx + 1);
        }
        return null;
    },

    getPrevSibling: function getPrevSibling() {
    	var superview, idx;
        if ((superview = this.getSupperview())) {
            idx = superview.indexOfSubview(this);
            if (idx === 0) return null;
            return superview.getSubviewAt(idx - 1);
        }
        return null;
    },

    emptySubviews: function emptySubviews() {
        var display;
        if (!this.hasSubview()) return this;
        display = this._mountPoint.style.display;
        this._mountPoint.style.display = 'none';
        while (this._subviews.length) { this.removeSubview(0); }
        this._subviews.length = 0;
        this._mountPoint.style.display = display;
        return this;
    },

    sortSubviews: function sortSubviews(comparator) {
        var fragment, mountPoint, display;
        if (!this.hasSubview() || !_.isFunction(comparator)) return this;

        this.getSubviews().sort(comparator); // 先排序

        // 执行变更
        fragment = document.createDocumentFragment();
        mountPoint = this._mountPoint;
        display = mountPoint.style.display;
        mountPoint.style.display = 'none';
        this.eachSubview(function(view) { fragment.appendChild(view.el); });
        mountPoint.style.display = display;
        mountPoint.appendChild(fragment);
        return this;
    },





    triggerEventMethod: Dbb.triggerEventMethod,

    propagateLifeCycleMethod: function propagateLifeCycleMethod(method) {
        _.each(this._subviews, function(view) {
            view.triggerEventMethod(method, view);
            view.propagateLifeCycleMethod(method);
        });
    },

    _delegateEvents: function _delegateEvents(subview) {
        this.listenTo(subview, 'all', this._delegateEventsCB);
        return this;
    },
    _delegateEventsCB: function _delegateEventsCB(name) {
        var args = ['subview.' + name].concat( _.rest(arguments) );
        this.trigger.apply(this, args);
    },
    _unDelegateEvents: function _unDelegateEvents(subview) {
        this.stopListening(subview);
        return this;
    },

    isElMounted: function isElMounted(el) {
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

});

module.exports = DbbView;
