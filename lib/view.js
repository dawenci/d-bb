var Dbb = require('./dbb')

// 有效的 view fields
var viewFields = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events']

// 有效的 view options
var viewOptions = ['supportLifeCycle', 'mountPointSelector']


function isElMounted(el) {
    var docEl = document.documentElement
    var parent

    if (docEl.contains) return docEl.contains(el)
    if (docEl.compareDocumentPosition) return !!(docEl.compareDocumentPosition(el) & 16)
    parent = el.parentNode
    while (parent) {
        if (parent == docEl) return true
        parent = parent.parentNode
    }
    return false
}



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
        this.__isRetained__ = 1

        // 视图options数据
        this.options = _.extend({
            supportLifeCycle: true,
            mountPointSelector: '.dbbview-mountpoint'
        }, _.pick(options, viewOptions))

        // options 及默认fields 以外的数据，合并入view
        _.extend(this, _.omit(options, viewFields.concat(viewOptions)))

        // 最后才调用父类构造函数
        // 顺序不能变，否则在继承Dbb.View的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options)
        // this.init.apply(this, arguments);
    },

    $isRetained: Dbb.$isRetained,

    $isDealloc: Dbb.$isDealloc,

    $callHook: Dbb.$callHook,

    /**
     * @method View#$dealloc
     * @description
     * 视图销毁
     */
    $dealloc: function(options) {
        var count

        if (this.$isDealloc()) return this

        options = _.extend({}, this.options, options || {})

        if (options.supportLifeCycle) this.$callHook('viewWillDealloc', this)

        // 递归子视图的清理
        count = this.$count()
        if (this.$isNotEmpty()) while(count--) this.__subviews__[count].$dealloc()


        delete this.__isRetained__

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做$dealloc
        this.remove() // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。

        // 必须放在off前，off会一并移除通过listenTo监听此事件的其他对象的相应事件
        // a.listenTo(b,...), a.stopListening 相当于 b.off(null,null,a); b.off()相当于a.stopListening
        if (options.supportLifeCycle) this.$callHook('viewDidDealloc', this)

        this.off() // 移除用this.on绑定的事件

        // 清空属性
        _.each(_.keys(this), function(prop) { if (prop !== 'cid') delete this[prop] }, this)

        return this
    },


    /**
     * @method View#$render
     * @description
     * 模板渲染
     */
    $render: function(model, options) {
        var template, fragment, isRefresh, data

        model = model || this.model || {}
        options = _.extend({}, this.options, options || {})

        // 已经挂载，说明这次$render是refresh
        isRefresh = this.$isMounted()

        if (options.supportLifeCycle) {
            this.$callHook('viewWillRender', this)
            if (isRefresh) this.$callHook('viewWillRefresh', this)
        }

        template = _.result(this, '$templateForView')

        // $render开始，如果存在模板，则渲染相关html
        if (_.isFunction(template)) {
            // 把subview.el 暂移到 fragment 里，以便后续重新渲染当前视图后append回来
            if (this.$isNotEmpty()) {
                fragment = document.createDocumentFragment()
                this.$eachSubview(function(view) {
                    fragment.appendChild(view.el)
                })
            }

            // 使用数据渲染模板，并刷新dom
            data = this.$dataForView(model)

            this.el.innerHTML = template(data)

            this.__mountPoint__ = _.result(this, '$mountPointForSubview', this.el) // 刷新/设置挂载点

            // 将子View 的el 插回来
            if (fragment) this.__mountPoint__.appendChild(fragment)

        } else {
            this.__mountPoint__ = _.result(this, '$mountPointForSubview', this.el) // 设置挂载点
        }

        if (options.supportLifeCycle) {
            this.$callHook('viewDidRender', this)
            if (isRefresh) this.$callHook('viewDidRefresh', this)
        }

        // 标记当前view rendered
        this.$setRendered()

        return this
    },


    /**
     * @method View#$dataForView
     * @description 视图渲染所需的数据
     * 可 override
     */
    $dataForView: function(model) {
        var data

        if (model instanceof Backbone.Model) {
            data = model.toJSON()
            data.cid = model.cid
        } else if (model instanceof Object) {
            data = _.clone(model)
        } else {
            data = {}
        }
        return data
    },


    // 可override，返回模板渲染函数
    $templateForView: function() {
        return this.options.template || this.template
    },


    // 可override，如何获取子view的el挂载dom容器
    $mountPointForSubview: function() {
        return this.el.querySelector(this.options.mountPointSelector) || this.el
    },

    // 检查视图是否挂载到文档
    $isMounted: function() {
        return isElMounted(this.el)
    },

    // 确认视图的模板是否渲染
    $isRendered: function() {
        return this.__isRendered__
    },

    // 标记视图已经渲染过
    $setRendered: function() {
        this.__isRendered__ = true
        return this
    },


    /**
     * @method View#$mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    $mountToEl: function(el, options) {
        // the mountPoint is unmounted.
        if (!isElMounted(el)) return this;

        // 'DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
        if(this.$isDealloc()) return this;

        if (this.$isMounted()) return this;

        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true
        }, this.options, options || {});

        if (!this.$isRendered()) this.$render();

        if (options.supportLifeCycle) this.$callHook('viewWillMount', this);
        if (options.shouldPropagateViewWillMount) this.$propagateLifeCycleHook('viewWillMount');

        el.appendChild(this.el);

        if (options.supportLifeCycle) this.$callHook('viewDidMount', this);
        if (options.shouldPropagateViewWillMount) this.$propagateLifeCycleHook('viewDidMount');

        return this;
    },



    /**
     * @method View#$addSubview
     * @param {Dbb.View} subview
     * @param {Object} options
     *
     * $addSubview(view, options)
     *
     * parent.$addSubview(subview, {...});
     * parent.$addSubview(subview, {atIndex: index}); // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillMount {Boolean}
     * options.shouldPropagateViewDidMount {bool}
     *
     */
    $addSubview: function(views, options) {
        var viewsCount,
            subviews, subviewsCount,
            len, i, current,
            frag,
            atIndex,
            isMounted

        // views 参数接受一个单独的视图，或一个视图数组，需要分别处理
        // 1. 过滤掉无效的视图
        // 2. 如果是一个单独的视图，也转换成只有一个元素的数组统一处理
        if (_.isArray(views)) {
            views = _.filter(views, function(view) {
                return view instanceof DbbView && view.$isRetained() && !this.$hasSubview(view)
            }, this)

            if (!(viewsCount = views.length)) return this
        } else {
            if (!(views && views instanceof DbbView && views.$isRetained() && !this.$hasSubview(view))) return this
            views = [views]
            viewsCount = 1
        }

        // 处理参数：处理options
        options = _.extend({
            shouldPropagateViewWillMount: true,
            shouldPropagateViewDidMount: true,
            atIndex: 'last',
            transition: {}
        }, this.options, options || {})


        // 局部变量缓存
        subviews = this.__subviews__ || (this.__subviews__ = [])
        subviewsCount = subviews.length
        frag = document.createDocumentFragment()


        // 确定插入点
        atIndex = options.atIndex
        // 字符串的情况，非'first'的全重置为'last'。
        if (typeof atIndex === 'string') {
            if (atIndex === 'first') atIndex = 0; else atIndex = 'last'
        } else if (typeof atIndex === 'number') { // 数字的情况，非合法index重置为'last'
            if(atIndex < 0 || atIndex >= subviewsCount) atIndex = 'last'
        } else { // 任何其他值都是非法的，全部重置为'last'
            atIndex = 'last'
        }


        if (options.supportLifeCycle) this.$callHook('subviewWillAdd', views, this, options)

        // 代理子视图事件
        if (options.shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) { this._delegateEvents(views[i]) }
        }

        // 渲染好superview模板，待subview的DOM插入
        if (!this.$isRendered()) this.$render()

        // 渲染好subview的模板，待插入
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i]
            if (!current.$isRendered()) current.$render()
            frag.appendChild(current.el)
        }

        // 如果当前view已经mounted，向所有子类传播viewWillMount
        if ((isMounted = this.$isMounted())) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                if (current.options.supportLifeCycle) current.$callHook('viewWillMount', current)
                if (options.shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewWillMount')
            }
        }

        // transition 开始状态
        if (_.isFunction(options.transition.subviewWillAdd)) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                options.transition.subviewWillAdd(current.el)
            }
        }

        // 先挂载DOM，再插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this.__mountPoint__.appendChild(frag)
            this.__subviews__ = subviews.concat(views)
        } else {
            this.__mountPoint__.insertBefore(frag, subviews[atIndex].el)
            this.__subviews__ = subviews.slice(0, atIndex).concat(views).concat(subviews.slice(atIndex))
        }

        // transition 结束状态
        if (_.isFunction(options.transition.subviewDidAdd)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                options.transition.subviewDidAdd(current.el)
            }
        }


        // 插入的subview 全部附加上__superview__的属性
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i]
            current.__superview__ = this
        }


        // 如subview已经mounted，向所有子类传播viewDidMount
        if (isMounted) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                if (current.options.supportLifeCycle) current.$callHook('viewDidMount', current)
                if (options.shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewDidMount')
            }
        }

        if (options.supportLifeCycle) this.$callHook('subviewDidAdd', views, this, options)

        return this;
    },


    /**
     * @method View#$removeSubview
     * @param {Dbb.View | Number | String} view // subview or index number or 'first', 'last'
     * @param {Object} options
     *
     * @description
     * 移除一个子视图
     *
     * $removeSubview(view [,options])
     *
     * parent.$removeSubview(subview [,options]);
     * parent.$removeSubview(indexNumber [,options]);
     * parent.$removeSubview('first' [,options]);
     * parent.$removeSubview('last' [,options]);
     *
     * options.shouldPropagateViewWillUnMount {Boolean}
     * options.shouldPropagateViewDidUnMount {bool}
     * options.shouldPreventDealloc {bool}
     *
     */
    $removeSubview: function(view, options) {
        var subviews, atIndex;

        if (!this.$isNotEmpty()) return this;
        if (view === undefined) return this;

        options = _.extend({
            shouldPropagateViewWillUnMount: true,
            shouldPropagateViewDidUnMount: true,
            shouldPreventDealloc: false,
            transition: {}
        }, this.options, options || {});

        subviews = this.__subviews__;

        // 确定atIndex的值
        if (view instanceof DbbView) {
            atIndex = this.$indexOfSubview(view);
        } else {
            if (typeof view === 'number') {
                if (view < 0 || view >= this.$count()) atIndex = -1; else atIndex = view;
            } else if (view === 'first') {
                atIndex = 0;
            } else if (view === 'last') {
                atIndex = this.$count() - 1;
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

        if (options.supportLifeCycle) this.$callHook('subviewWillRemove', view, this, options);

        subviews.splice(atIndex, 1);
        delete view.__superview__;

        // 移除对subview的事件代理
        this._unDelegateEvents(view);

        // 如果当前subview已经mounted，向所有子类传播viewWillUnMount
        if (view.$isMounted()) {
            if (view.options.supportLifeCycle) view.$callHook('viewWillUnMount', view);
            if (options.shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewWillUnMount');
        }

        // transition 开始状态
        if (_.isFunction(options.transition.subviewWillRemove)) {
            options.transition.subviewWillRemove(view.el)
        }

        // transition 结束状态
        if (_.isFunction(options.transition.subviewDidRemove)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight
            options.transition.subviewDidRemove(view.el, function() {
                // transition end

                this.__mountPoint__.removeChild(view.el);

                // 如果当前subview已经unmounted，向所有子类传播viewDidUnMount
                if (!view.$isMounted()) {
                    if (view.options.supportLifeCycle) view.$callHook('viewDidUnMount', view);
                    if (options.shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewDidUnMount');
                }

                if (options.supportLifeCycle) this.$callHook('subviewDidRemove', view, this, options);

                if (!options.shouldPreventDealloc) view.$dealloc();

            }.bind(this))
        } else {
            this.__mountPoint__.removeChild(view.el);

            // 如果当前subview已经unmounted，向所有子类传播viewDidUnMount
            if (!view.$isMounted()) {
                if (view.options.supportLifeCycle) view.$callHook('viewDidUnMount', view);
                if (options.shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewDidUnMount');
            }

            if (options.supportLifeCycle) this.$callHook('subviewDidRemove', view, this, options);

            if (!options.shouldPreventDealloc) view.$dealloc();
        }

        return this;
    },

    $count: function() {
        return _.size(this.__subviews__)
    },

    $isEmpty: function() {
        return !this.$count()
    },

    $isNotEmpty: function() {
        return !!this.$count()
    },

    $hasSubview: function(subview) {
        return subview.__superview__ && subview.__superview__ === this
    },

    $eachSubview: function(callback, context) {
        var i

        if (this.$isEmpty()) return

        if (!context) {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                callback(this.__subviews__[i], i, this.__subviews__);
            }
        } else {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                callback.call(context, this.__subviews__[i], i, this.__subviews__);
            }
        }
    },

    // 查询视图在子视图中的index
    $indexOfSubview: function(subview, isSort) {
        return _.indexOf(this.__subviews__, subview, isSort);
    },

    $indexInSuperview: function(isSort) {
        if (!this.__superview__) return -1;
        return this.__superview__.$indexOfSubview(this, isSort);
    },

    $getSubviews: function() {
        if (this.$isEmpty()) return null;
        return this.__subviews__;
    },

    $getSubviewAt: function(index) {
        if (this.$isEmpty()) return null;
        return this.__subviews__[index] || null;
    },

    $getSupperview: function() {
        return this.__superview__ || null
    },

    $getFirstSubview: function() {
        return this.$getSubviewAt(0)
    },

    $getLastSubview: function() {
        return this.$getSubviewAt(this.$count() - 1)
    },

    $getNextSibling: function() {
        var superview, idx

        if ((superview = this.$getSupperview())) {
            idx = superview.$indexOfSubview(this)
            if (idx === superview.$count() - 1) return null
            return superview.$getSubviewAt(idx + 1)
        }
        return null
    },

    $getPrevSibling: function() {
    	var superview, idx

        if ((superview = this.$getSupperview())) {
            idx = superview.$indexOfSubview(this)
            if (idx === 0) return null
            return superview.$getSubviewAt(idx - 1)
        }
        return null
    },

    $emptySubviews: function() {
        var display

        if (this.$isEmpty()) return this

        display = this.__mountPoint__.style.display
        this.__mountPoint__.style.display = 'none'
        while (this.__subviews__.length) this.$removeSubview(0)
        this.__subviews__.length = 0
        this.__mountPoint__.style.display = display

        return this
    },

    $sortSubviews: function(comparator) {
        var fragment, mountPoint, display

        if (this.$isEmpty() || !_.isFunction(comparator)) return this

        this.$getSubviews().sort(comparator) // 先排序

        // 执行变更
        fragment = document.createDocumentFragment()
        mountPoint = this.__mountPoint__
        display = mountPoint.style.display
        mountPoint.style.display = 'none'
        this.$eachSubview(function(view) { fragment.appendChild(view.el) })
        mountPoint.style.display = display
        mountPoint.appendChild(fragment)

        return this
    },

    // 向内传播事件
    $propagate: function(name, options) {
        options = _.extend(options || {}, { currentTarget: this }) // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this // target 为传播起点

        this.$callHook(name, options)
        this.$eachSubview(function(view) {
            view.$propagate(name, options)
        })

        return this
    },

    // 向外冒泡事件
    $dispatch: function(name, options) {
        options = _.extend(options || {}, { currentTarget: this }) // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this // target 为冒泡起点

        this.$callHook(name, options)
        if (this.__superview__) this.__superview__.$dispatch(name, options)

        return this
    },

    $propagateLifeCycleHook: function(method) {
        _.each(this.__subviews__, function(view) {
            view.$callHook(method, view)
            view.$propagateLifeCycleHook(method)
        });
    },

    _delegateEvents: function(subview) {
        this.listenTo(subview, 'all', this._delegateEventsCB);
        return this;
    },
    _delegateEventsCB: function(name) {
        var args = ['subview.' + name].concat( _.rest(arguments) );
        this.trigger.apply(this, args);
    },
    _unDelegateEvents: function(subview) {
        this.stopListening(subview);
        return this;
    },

});

module.exports = DbbView;
