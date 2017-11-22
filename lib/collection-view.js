'use strict'

const DbbView = require('./core/view')

const addTransition = {
    subviewWillAdd($el) {
        $el.css('transition','')
        $el.css('opacity', 0)
    },
    subviewDidAdd($el) {
        $el.css('transition', 'opacity .2s')
        $el.css('opacity', 1)
    }
}
const addTransitionAndSort = {
    subviewWillAdd($el) {
        $el.css('transition','')
        $el.css('opacity', 0)
    },
    subviewDidAdd($el) {
        $el.css('transition', 'opacity .2s')
    }
}
const removeTransition = {
    subviewWillRemove($el) {
        $el.css('transition','')
        $el.css('opacity', 1)
    },
    subviewDidRemove($el, done) {
        $el.css('transition', 'opacity .2s')
        $el.css('opacity', 0)
        setTimeout(done, 200)
    }
}


function appendPlaceholder() {
    let placeholder = _.result(this, 'placeholder')
    if (placeholder) {
        let $mountPoint = _.result(this, '$mountPointForSubview')
        if (!$mountPoint.find(placeholder).length) {
            $mountPoint.append(placeholder)
        }
    }
}
function removePlaceholder() {
    let placeholder = _.result(this, 'placeholder')
    if (placeholder) {
        let $mountPoint = _.result(this, '$mountPointForSubview')
        if ($mountPoint.find(placeholder).length) {
            (placeholder instanceof $) ? placeholder.detach() : $(placeholder).detach()
        }
    }
}
function updatePlaceholder() {
    if (this.$count()) removePlaceholder.call(this)
    else appendPlaceholder.call(this)
}


function onItemAdded(model, collection, options) {
    options = options || {}
    let view = this.$viewForItem(model, collection).$render()
    clearTimeout(this._addTimer)
    if (!this._buffer) this._buffer = []
    this._buffer.push(view)
    this._addTimer = setTimeout(() => {
        // console.log('add timeout')
        // 修复add时，不会重新排序
        // 确保如果没有传入sort:false的option, 才重新排序
        // 排序动画，跟add动画只一个生效
        if (options.sort !== false) {
            this.$addSubview(this._buffer, {
                shouldDelegateEvents: true,
                transition: addTransitionAndSort
            })
            onItemsSorted.call(this, this.collection, {})
        } else {
            this.$addSubview(this._buffer, {
                shouldDelegateEvents: true,
                transition: addTransition
            })
        }
    
        this._buffer.length = 0
        this.trigger('itemDidAdd')

    }, 0)

    updatePlaceholder.call(this)

    return this
}


function onItemRemoved(model, collection, options) {
    this.$removeSubview(options.index, {
        transition: removeTransition
    })
    this.trigger('itemDidRemove')

    updatePlaceholder.call(this)

    return this
}


function onItemsReset(collection, options) {
    updatePlaceholder.call(this)
    
    this.$emptySubviews()

    let views = []
    collection.each(function(model, i, collection){
        views.push(this.$viewForItem(model, collection))
    }, this)

    this.$addSubview(views, {
        shouldDelegateEvents: true,
        transition: addTransition
    })

    this.trigger('itemDidReset')

    updatePlaceholder.call(this)

    return this
}

function onItemsSorted(collection, options) {
    if (!this.$isNotEmpty()) return this

    let self = this
    // add用了定时器，sort会发生在add前，subview的数量会比model少，所以要处理下
    this._sortTimer = setTimeout(() => {
        // console.log('sort timeout')
        var subviews, $mountPoint, display, $fragment
        let tempArr
        let len = self.$count()
        if (collection.length === len) {
            subviews = self.$getSubviews()
            tempArr = new Array(len)

            // 先排序
            for (let i = 0; i < len; i += 1) {
                let index = collection.indexOf(subviews[i].model)
                tempArr[index] = subviews[i]
            }

            // 执行变更
            self.__subviews__ = tempArr
            $mountPoint = _.result(self, '$mountPointForSubview', self.$el)
            $fragment = $(document.createDocumentFragment())
            self.$eachSubview(function(view){
                $fragment.append(view.$el)
            })
            $mountPoint.append($fragment)

            // force reflow
            $mountPoint.get(0).offsetHeight
            // transition
            self.$eachSubview(function(view){
                view.$el.css('opacity', 1)
                // view.el.style.opacity = 1
            })

            self.trigger('itemDidSort')

        } else {
            onItemsSorted.call(self, collection, options)

        }
    }, 0)

    updatePlaceholder.call(this)

    return this
}


const DbbCollectionView = DbbView.extend({
    constructor: function DbbCollectionView(options) {
        if (!(this instanceof DbbCollectionView)) return new DbbCollectionView(options)

        if (options.collection) this.$setCollection(options.collection)
        DbbView.call(this, options)
    },

    $setCollection(collection) {
        if (this.collection) this.stopListening(this.collection)
        this.collection = collection
        this.listenTo(collection, 'add', onItemAdded)
        this.listenTo(collection, 'remove', onItemRemoved)
        this.listenTo(collection, 'reset', onItemsReset)
        this.listenTo(collection, 'sort', onItemsSorted)
        return this
    },

    // override
    $viewForItem(model, collection) {
        return new DbbView({ model })
    },

    $renderItems() {
        this.$updatePlaceholder.call(this)

        // collection 有原始数据，则渲染
        if (this.collection.length) {
            this.$emptySubviews()

            var views = []
            this.collection.each(function(model, i, collection){
                views.push(this.$viewForItem(model, collection))
            }, this)

            this.$addSubview(views, {
                shouldDelegateEvents: true,
                transition: addTransition
            })
        }
        return this
    },

    $updatePlaceholder() {
        updatePlaceholder.call(this)
        return this
    }
})

module.exports = DbbCollectionView
