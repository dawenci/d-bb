'use strict'

const utils = require('./mixin/utils')
const lifeCircle = require('./mixin/life-circle')
const eventbus = require('./mixin/eventbus')
const binder = require('./binder')

// 有效的 view fields
const viewFields = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events']

// 有效的 view options
const viewOptions = [
    'supportLifeCycle',
    'mountPointSelector',
    'shouldPropagateViewWillMount',
    'shouldPropagateViewDidMount',
    'shouldPropagateViewWillUnmount',
    'shouldPropagateViewDidUnmount',
    'shouldDelegateEvents',
    'transition',
    'shouldPreventDealloc'
]

const viewKeywords = viewFields.concat(viewOptions)

function isElMounted(el) {
    return $.contains(document.documentElement, (el instanceof $) ? el[0] : el )
    // if (!el) return false
    // const docEl = document.documentElement
    // let parent

    // if (docEl.contains) return docEl.contains(el)
    // if (docEl.compareDocumentPosition) return !!(docEl.compareDocumentPosition(el) & 16)
    // parent = el.parentNode
    // while (parent) {
    //     if (parent == docEl) return true
    //     parent = parent.parentNode
    // }
    // return false
}


// delegate subview's events
function delegateEvents(subview) {
    this.listenTo(subview, 'all', delegateEventsCB)
    return this
}
function delegateEventsCB(name) {
    let args = ['subview.' + name].concat( _.rest(arguments) )
    this.trigger.apply(this, args)
}
function unDelegateEvents(subview) {
    this.stopListening(subview)
    return this
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
 * viewWillUnmount(self): view.el 即将从mount chain上卸载
 * viewDidUnmount(self): view.el 已经从mount chain上卸载
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
const DbbView = Backbone.View.extend({
    constructor: function DbbView(options) {
        if (!(this instanceof DbbView)) return new DbbView(options)

        // view生存中，不可回收
        this.__isRetained__ = 1

        // 视图options数据
        this.options = _.extend({},
            this.__defaultOptions__, // 默认配置
            _.pick(this.options || {}, viewOptions), // extend 出子类的时候，可以直接通过 options 字段配置
            _.pick(options, viewOptions) // 实例化的时候传入的数据中提取 options 部分
        )

        // options 及默认fields 以外的数据，合并入view
        _.extend(this, _.omit(options, viewKeywords))

        // 调用父类构造函数
        // 顺序不能变，否则在继承Dbb.View的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options)
    },

    __defaultOptions__: {
        supportLifeCycle: true, // should callHook
        mountPointSelector: '.dbbview-mountpoint', // as subview's mountpoint
        shouldPropagateViewWillMount: true, // $el mount
        shouldPropagateViewDidMount: true, // $el mount
        shouldPropagateViewWillUnmount: true, // $el unmount
        shouldPropagateViewDidUnmount: true, // $el unmount
        shouldDelegateEvents: false, // add subview
        transition: {}, // dom insert or remove
        shouldPreventDealloc: false // remove subview
    },


    // 默认实现，通常会重写
    initialize(options) {
        if (this.bindings) this.$render()
    },


    $broadcast: eventbus.broacast,
    $listenToBus: eventbus.listenToBus,

    $callHook: utils.callHook,

    $isRetained: lifeCircle.isRetained,
    $isDealloc: lifeCircle.isDealloc,


    $getOption(options, fields) {
        if (!fields) return
        options = _.extend({}, this.options, options || {})
        if (typeof fields === 'string') return _.result(options, fields)
        return _.pick(options, fields)
    },

    
    /**
     * @method View#$dealloc
     * @description
     * 视图销毁
     */
    $dealloc(options) {
        if (this.$isDealloc()) return this

        let supportLifeCycle = this.$getOption(options, 'supportLifeCycle')

        if (supportLifeCycle) this.$callHook('viewWillDealloc', this)

        // 递归子视图的清理
        let count = this.$count()
        if (this.$isNotEmpty()) while(count--) this.__subviews__[count].$dealloc()


        delete this.__isRetained__

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做$dealloc
        this.remove() // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。

        // 必须放在off前，off会一并移除通过listenTo监听此事件的其他对象的相应事件
        // a.listenTo(b,...),
        // a.stopListening 相当于 b.off(null,null,a)
        // b.off()相当于a.stopListening
        if (supportLifeCycle) this.$callHook('viewDidDealloc', this)

        this.off() // 移除用this.on绑定的事件

        // 清空属性
        _.each(
            _.keys(this),
            prop => { if (prop !== 'cid') delete this[prop] },
            this
        )

        return this
    },


    // 绑定数据、视图，自动将模型变化反映到视图。对于表单控件，双向绑定
    // 必须在 $render 之后才可使用
    $bind(model, bindings) {
        model = model || this.model
        bindings = bindings || _.result(this, 'bindings')
        if (!model || !bindings) return this
        binder.bind(this, model, bindings)
        return this
    },


    // 取消数据、视图绑定
    $unbind(model, records) {
        model = model || this.model
        records = records || this.__bindingRecords__
        if (!model || !records) return this
        binder.unbind(this, model, records)
        return this
    },

    $syncBindingData(isToModel) {
        binder.syncData(this, isToModel)
        return this
    },


    /**
     * @method View#$render
     * @description
     * 模板渲染
     */
    $render(model, options) {
        model = model || this.model || {}
        let supportLifeCycle =this.$getOption(options, 'supportLifeCycle')

        // 已经挂载，说明这次$render是refresh
        let isRefresh = this.$isMounted()

        if (supportLifeCycle) {
            this.$callHook('viewWillRender', this)
            if (isRefresh) this.$callHook('viewWillRefresh', this)

        }

        let template = _.result(this, '$templateForView')

        // $render开始，如果存在模板，则渲染相关html
        if (_.isFunction(template)) {
            let $childrenFragment

            // 把subview.el 暂移到 fragment 里，以便后续重新渲染当前视图后append回来
            if (this.$isNotEmpty()) {
                $childrenFragment = $(document.createDocumentFragment())
                this.$eachSubview(view => $childrenFragment.append(view.$el))
            }

            // 使用数据渲染模板，并刷新dom
            let data = this.$dataForView(model)

            this.$el.html(template(data))

            this.__$mountPoint__ = _.result(this, '$mountPointForSubview', this.$el).eq(0) // 刷新/设置挂载点

            // 将子View 的el 插回来
            if ($childrenFragment) this.__$mountPoint__.append($childrenFragment)

        } else {
            this.__$mountPoint__ = _.result(this, '$mountPointForSubview', this.$el).eq(0) // 设置挂载点
        }

        if (supportLifeCycle) {
            this.$callHook('viewDidRender', this)
            if (isRefresh) this.$callHook('viewDidRefresh', this)
        }

        // 标记当前view rendered
        this.$setRendered()

        // 绑定 view、model
        if (this.bindings && this.model) this.$unbind().$bind()

        return this
    },


    /**
     * @method View#$dataForView
     * @description 视图渲染所需的数据
     * 可 override
     */
    $dataForView(model) {
        return _.result(model, 'toJSON', Object(model))
    },


    // 可override，返回模板渲染函数
    $templateForView() {
        if (this.__templateFunctionCache__) {
            return this.__templateFunctionCache__

        } else {
            let template = this.options.template || this.template
            if (typeof template === 'string') template = _.template(template)
            if (_.isFunction(template)) {
                this.__templateFunctionCache__ = template
                return template
            }
        }
    },


    // 可override，如何获取子view的el挂载dom容器
    $mountPointForSubview(options) {
        let $mountPoint = this.$(this.$getOption(options, 'mountPointSelector'))
        if ($mountPoint.length) return $mountPoint
        return this.$el
    },

    // 检查视图是否挂载到文档
    $isMounted() {
        return isElMounted(this.el)
    },

    // 确认视图的模板是否渲染
    $isRendered() {
        return this.__isRendered__
    },

    // 标记视图已经渲染过
    $setRendered() {
        this.__isRendered__ = true
        return this
    },


    /**
     * @method View#$mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    $mountToEl($el, options) {
        // 'DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
        if(this.$isDealloc()) return this
        if (this.$isMounted()) return this

        if (!($el instanceof $)) $el = $($el)

        // the mountPoint is unmounted.
        if (!isElMounted($el.get(0))) return this

        let {
            supportLifeCycle,
            shouldPropagateViewWillMount,
            shouldPropagateViewDidMount,
            transition
        } = this.$getOption(options, [
            'supportLifeCycle',
            'shouldPropagateViewWillMount',
            'shouldPropagateViewDidMount',
            'transition'
        ])

        if (!this.$isRendered()) this.$render()

        if (supportLifeCycle) this.$callHook('viewWillMount', this)

        if (shouldPropagateViewWillMount)
            this.$propagateLifeCycleHook('viewWillMount')

        // transition 开始状态
        if (_.isFunction(transition.viewWillMount))
            transition.viewWillMount(this.$el)

        $el.eq(0).append(this.$el)

        // transition 开始结束
        if (_.isFunction(transition.viewDidMount)) {
            // 强制reflow，让transition动画生效
            // this.el.offsetHeight
            transition.viewDidMount(this.$el)
        }

        if (supportLifeCycle)
            this.$callHook('viewDidMount', this)

        if (shouldPropagateViewDidMount)
            this.$propagateLifeCycleHook('viewDidMount')

        return this
    },


    $unmount(options) {
        if(this.$isDealloc()) return this
        if (!this.$isMounted()) return this

        let {
            supportLifeCycle,
            shouldPropagateViewWillUnmount,
            shouldPropagateViewDidUnmount,
            transition
        } = this.$getOption(options, [
            'supportLifeCycle',
            'shouldPropagateViewWillUnmount',
            'shouldPropagateViewDidUnmount',
            'transition'
        ])

        if (supportLifeCycle)
            this.$callHook('viewWillUnmount', this)
        if (shouldPropagateViewWillUnmount)
            this.$propagateLifeCycleHook('viewWillUnmount')

        // transition 开始状态
        if (_.isFunction(options.transition.viewWillUnmount))
            transition.viewWillUnmount(this.$el)

        this.$el.detach()

        // transition 结束
        if (_.isFunction(transition.viewDidUnmount)) {
            // 强制reflow，让transition动画生效
            // this.el.offsetHeight
            transition.viewDidUnmount(this.$el)
        }

        if (supportLifeCycle)
            this.$callHook('viewDidUnmount', this)
        if (shouldPropagateViewDidUnmount)
            this.$propagateLifeCycleHook('viewDidUnmount')

        return this
    },



    /**
     * @method View#$addSubview
     * @param {Dbb.View} subview
     * @param {Object} options
     *
     * $addSubview(view, options)
     *
     * parent.$addSubview(subview, {...})
     * parent.$addSubview(subview, {atIndex: index}) // index: number || 'first' || 'last'
     *
     * options.shouldPropagateViewWillMount {Boolean}
     * options.shouldPropagateViewDidMount {bool}
     *
     */
    $addSubview(views, options) {
        if (!options) options = {}

        // console.log('addSubview')
        let viewsCount
        // views 参数接受一个单独的视图，或一个视图数组，需要分别处理
        // 1. 过滤掉无效的视图
        // 2. 如果是一个单独的视图，也转换成只有一个元素的数组统一处理
        if (_.isArray(views)) {
            views = _.filter(views, view => (view instanceof DbbView && view.$isRetained() && !this.$hasSubview(view)), this)

            if (!(viewsCount = views.length)) return this

        } else {
            if (
                !(views
                && views instanceof DbbView
                && views.$isRetained()
                && !this.$hasSubview(views))
            ) return this

            views = [views]
            viewsCount = 1
        }

        // 处理参数：处理options
        let {
            supportLifeCycle,
            shouldPropagateViewWillMount,
            shouldPropagateViewDidMount,
            shouldDelegateEvents,
            transition,
            atIndex
        } = this.$getOption(options, [
            'supportLifeCycle',
            'shouldPropagateViewWillMount',
            'shouldPropagateViewDidMount',
            'shouldDelegateEvents',
            'transition',
            'atIndex'
        ])

        // 局部变量缓存
        let subviews = this.__subviews__ || (this.__subviews__ = [])
        let subviewsCount = subviews.length
        let $frag = $(document.createDocumentFragment())


        // 确定插入点
        // 字符串的情况，非'first'的全重置为'last'。
        if (typeof atIndex === 'string') {
            atIndex = (atIndex === 'first') ? 0 : 'last'

        } else if (typeof atIndex === 'number') { // 数字的情况，非合法index重置为'last'
            if(atIndex < 0 || atIndex >= subviewsCount) atIndex = 'last'

        } else { // 任何其他值都是非法的，全部重置为'last'
            atIndex = 'last'

        }
        options.atIndex = atIndex


        if (supportLifeCycle) this.$callHook('subviewWillAdd', views, this, options)

        // 代理子视图事件
        let i
        if (shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) { delegateEvents.call(this, views[i]) }
        }

        // 渲染好superview模板，待subview的DOM插入
        if (!this.$isRendered()) this.$render()

        // 渲染好subview的模板，待插入
        let current
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i]
            if (!current.$isRendered()) current.$render()
            $frag.append(current.$el)
        }

        // 如果当前view已经mounted，向所有子类传播viewWillMount
        let isMounted = this.$isMounted()
        if ((isMounted)) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                if (current.options.supportLifeCycle) current.$callHook('viewWillMount', current)
                if (shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewWillMount')
            }
        }

        // transition 开始状态
        if (_.isFunction(transition.subviewWillAdd)) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                transition.subviewWillAdd(current.$el)
            }
        }

        // 先挂载DOM，再插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this.__$mountPoint__.append($frag)
            this.__subviews__ = subviews.concat(views)

        } else {
            subviews[atIndex].$el.before($frag)
            // this.__$mountPoint__.insertBefore(frag, subviews[atIndex].el)            
            this.__subviews__ = subviews.slice(0, atIndex).concat(views).concat(subviews.slice(atIndex))

        }

        // transition 结束状态
        if (_.isFunction(transition.subviewDidAdd)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i]
                transition.subviewDidAdd(current.$el)
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
                if (shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewDidMount')
            }
        }

        if (supportLifeCycle) this.$callHook('subviewDidAdd', views, this, options)

        return this
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
     * parent.$removeSubview(subview [,options])
     * parent.$removeSubview(indexNumber [,options])
     * parent.$removeSubview('first' [,options])
     * parent.$removeSubview('last' [,options])
     *
     * options.shouldPropagateViewWillUnMount {Boolean}
     * options.shouldPropagateViewDidUnMount {bool}
     * options.shouldPreventDealloc {bool}
     *
     */
    $removeSubview(view, options) {
        if (!options) options = {}

        // console.log('removeSubview')
        if (!this.$isNotEmpty()) return this
        if (view === undefined) return this


        let {
            supportLifeCycle,
            shouldPropagateViewWillUnMount,
            shouldPropagateViewDidUnMount,
            shouldPreventDealloc,
            transition
        } = this.$getOption(options, [
            'supportLifeCycle',
            'shouldPropagateViewWillUnMount',
            'shouldPropagateViewDidUnMount',
            'shouldPreventDealloc',
            'transition'
        ])

        let subviews = this.__subviews__

        // 确定atIndex的值
        let atIndex
        if (view instanceof DbbView) {
            atIndex = this.$indexOfSubview(view)

        } else {
            if (typeof view === 'number') {
                atIndex = (view < 0 || view >= this.$count()) ? -1 : view

            } else if (view === 'first') {
                atIndex = 0

            } else if (view === 'last') {
                atIndex = this.$count() - 1

            } else {
                atIndex = -1

            }
            view = null
        }

        if (atIndex === -1) return this

        if (view === null) view = subviews[atIndex]

        // 即将移除的subview及index附加到options里，传递给事件处理器
        options.view = view
        options.atIndex = atIndex

        if (supportLifeCycle) this.$callHook('subviewWillRemove', view, this, options)

        subviews.splice(atIndex, 1)
        delete view.__superview__

        // 移除对subview的事件代理
        unDelegateEvents.call(this, view)

        // 如果当前subview已经mounted，向所有子类传播viewWillUnmount
        if (view.$isMounted()) {
            if (view.options.supportLifeCycle) view.$callHook('viewWillUnmount', view)
            if (shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewWillUnmount')
        }

        // transition 开始状态
        if (_.isFunction(transition.subviewWillRemove)) {
            transition.subviewWillRemove(view.$el)
        }

        // transition 结束状态
        if (_.isFunction(transition.subviewDidRemove)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight
            transition.subviewDidRemove(view.$el, function() {
                // transition end

                view.$el.detach()
                // this.__$mountPoint__.removeChild(view.el)

                // 如果当前subview已经unmounted，向所有子类传播viewDidUnmount
                if (!view.$isMounted()) {
                    if (view.options.supportLifeCycle)
                        view.$callHook('viewDidUnmount', view)

                    if (shouldPropagateViewWillUnMount)
                        view.$propagateLifeCycleHook('viewDidUnmount')
                }

                if (supportLifeCycle)
                    this.$callHook('subviewDidRemove', view, this, options)

                if (!shouldPreventDealloc)
                    view.$dealloc()

            }.bind(this))
            
        } else {
            view.$el.detach()
            // this.__$mountPoint__.removeChild(view.el)

            // 如果当前subview已经unmounted，向所有子类传播viewDidUnmount
            if (!view.$isMounted()) {
                if (view.options.supportLifeCycle)
                    view.$callHook('viewDidUnmount', view)
                if (shouldPropagateViewWillUnMount)
                    view.$propagateLifeCycleHook('viewDidUnmount')
            }

            if (supportLifeCycle)
                this.$callHook('subviewDidRemove', view, this, options)

            if (!shouldPreventDealloc)
                view.$dealloc()
        }

        return this
    },

    $count() {
        return _.size(this.__subviews__)
    },

    $isEmpty() {
        return !this.$count()
    },

    $isNotEmpty() {
        return !!this.$count()
    },

    $hasSubview(subview) {
        return subview.__superview__ && subview.__superview__ === this
    },

    $eachSubview(iteratee, context) {
        if (this.$isEmpty()) return
        let i
        if (!context) {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                iteratee(this.__subviews__[i], i, this.__subviews__)
            }

        } else {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                iteratee.call(context, this.__subviews__[i], i, this.__subviews__)
            }

        }
    },

    // 查询视图在子视图中的index
    $indexOfSubview(subview, isSort) {
        return _.indexOf(this.__subviews__, subview, isSort)
    },

    $indexInSuperview(isSort) {
        if (!this.__superview__) return -1
        return this.__superview__.$indexOfSubview(this, isSort)
    },

    $getSubviews() {
        if (this.$isEmpty()) return null
        return this.__subviews__
    },

    $getSubviewAt(index) {
        if (this.$isEmpty()) return null
        return this.__subviews__[index] || null
    },

    $getSupperview() {
        return this.__superview__ || null
    },

    $getFirstSubview() {
        return this.$getSubviewAt(0)
    },

    $getLastSubview() {
        return this.$getSubviewAt(this.$count() - 1)
    },

    $getNextSibling() {
        var superview, idx

        if ((superview = this.$getSupperview())) {
            idx = superview.$indexOfSubview(this)
            if (idx === superview.$count() - 1) return null
            return superview.$getSubviewAt(idx + 1)
        }
        return null
    },

    $getPrevSibling() {
    	var superview, idx

        if ((superview = this.$getSupperview())) {
            idx = superview.$indexOfSubview(this)
            if (idx === 0) return null
            return superview.$getSubviewAt(idx - 1)
        }
        return null
    },

    $emptySubviews(options) {
        var display

        if (this.$isEmpty()) return this

        display = this.__$mountPoint__.hide()
        while (this.__subviews__.length) this.$removeSubview(0, options)
        this.__subviews__.length = 0
        this.__$mountPoint__.show()

        return this
    },

    $sortSubviews(comparator) {
        var $fragment, $mountPoint, display

        if (this.$isEmpty() || !_.isFunction(comparator)) return this

        this.$getSubviews().sort(comparator) // 先排序

        // 执行变更
        $fragment = $(document.createDocumentFragment())
        $mountPoint = this.__$mountPoint__
        $mountPoint.hide()
        this.$eachSubview(subview => $fragment.append(subview.$el))
        $mountPoint.show()
        $mountPoint.append($fragment)

        return this
    },

    // 向内传播事件
    $propagate(name, options) {
        options = _.extend(options || {}, { currentTarget: this }) // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this // target 为传播起点

        this.$callHook(name, options)
        this.$eachSubview(function(subview) {
            subview.$propagate(name, options)
        })

        return this
    },

    // 向外冒泡事件
    $dispatch(name, options) {
        options = _.extend(options || {}, { currentTarget: this }) // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this // target 为冒泡起点

        this.$callHook(name, options)
        if (this.__superview__) this.__superview__.$dispatch(name, options)

        return this
    },

    $propagateLifeCycleHook(method) {
        _.each(this.__subviews__, function(subview) {
            subview.$callHook(method, subview)
            subview.$propagateLifeCycleHook(method)
        })
    }
})


// 将 underscore 的部分集合方法加入 view 的原型，用以操作子视图
_.each({
    map: '_$map',
    reduce: '_$reduce',
    find: '_$find',
    filter: '_$filter',
    reject: '_$reject',
    every: '_$every',
    some: '_$some',
    includes: '_$includes'
}, (viewMethod, _method)=>{
    DbbView.prototype[viewMethod] = function() {
        let args = _.toArray(arguments)
        args.unshift(this.__subviews__ || [])
        return _[_method].apply(_, args)
    }
})


// 扩展 extend 方法
const extend = DbbView.extend = function(protoProps, staticProps) {
    const Parent = this

    var DbbView
    if (protoProps && _.has(protoProps, 'constructor')) {
        DbbView = protoProps.constructor

    } else {
        DbbView = function DbbView() {
            return Parent.apply(this, arguments)
        }
    }

    // Dbb 额外扩展功能 ----
    // 合并 events
    if (protoProps.shouldMergeEvents) {
        protoProps.events = _.extend({},
            _.result(Parent.prototype, 'events'),
            _.result(protoProps, 'events')
        )
    }
    // 合并 initialize
    if (protoProps.shouldMergeInitialize) {
        let _init = protoProps.initialize
        protoProps.initialize = function(options) {
            Parent.prototype.initialize.call(this, options)
            _init.call(this, options)
        }
    }
    protoProps = _.omit(protoProps, ['shouldMergeEvents', 'shouldMergeInitialize'])
    // -------------------

    _.extend(DbbView, Parent, staticProps)
    DbbView.prototype = _.create(Parent.prototype, protoProps)
    DbbView.prototype.constructor = DbbView
    DbbView.__super__ = Parent.prototype
    return DbbView
}


module.exports = DbbView
