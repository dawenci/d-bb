var Dbb = require('./dbb');
var DbbView = require('./view');

var addTransition = {
    subviewWillAdd: function(el) {
        el.style.transition = ''
        el.style.opacity = 0
    },
    subviewDidAdd: function(el) {
        el.style.transition = 'opacity .2s'
        el.style.opacity = 1
    }
}
var addTransitionAndSort = {
    subviewWillAdd: function(el) {
        el.style.transition = ''
        el.style.opacity = 0
    },
    subviewDidAdd: function(el) {
        el.style.transition = 'opacity .2s'
    }
}
var removeTransition = {
    subviewWillRemove: function(el) {
        el.style.transition = ''
        el.style.opacity = 1
    },
    subviewDidRemove: function(el, done) {
        el.style.transition = 'opacity .2s'
        el.style.opacity = 0
        setTimeout(done, 200)
    },
}


var DbbCollectionView = DbbView.extend({
    constructor: function DbbCollectionView(options) {
        if (options.collection) this.$setCollection(options.collection);
        DbbView.call(this, options);
    },

    $setCollection: function(collection) {
        if (this.collection) this.stopListening(this.collection);
        this.collection = collection;
        this.listenTo(collection, 'add', this._addItemHandle);
        this.listenTo(collection, 'remove', this._removeItemHandle);
        this.listenTo(collection, 'reset', this._resetItemsHandle);
        this.listenTo(collection, 'sort', this._sortItemsHandle);
    },

    // override
    $viewForItem: function(model, collection) {
        return new DbbView({ model: model });
    },

    $renderItems: function() {
        // collection 有原始数据，则渲染
        if (this.collection.length) {
            this.$emptySubviews();
            views = [];
            this.collection.each(function(model, i, collection){
                views.push(this.$viewForItem(model, collection));
            }, this);
            this.$addSubview(views, {
                shouldDelegateEvents: true,
                transition: addTransition
            });
        }
    },

    

    _addItemHandle: function(model, collection, options) {
        var self, view;

        options = options || {};
        self = this;
        view = this.$viewForItem(model, collection).$render();
        clearTimeout(this._addTimer);
        if (!this._buffer) this._buffer = [];
        this._buffer.push(view);

        this._addTimer = setTimeout(function() {
            // 修复add时，不会重新排序
            // 确保如果没有传入sort:false的option, 才重新排序
            // 排序动画，跟add动画只一个生效
            if (options.sort !== false) {
                self.$addSubview(self._buffer, {
                    shouldDelegateEvents: true,
                    transition: addTransitionAndSort
                });
                self._sortItemsHandle(self.collection, {});
            } else {
                self.$addSubview(self._buffer, {
                    shouldDelegateEvents: true,
                    transition: addTransition
                });
            }

            self._buffer.length = 0;
            self.trigger('itemDidAdd');

        }, 16);
        return this;
    },

    _removeItemHandle: function(model, collection, options) {
        this.$removeSubview(options.index, {
            transition: removeTransition
        });
        this.trigger('itemDidRemove');
        return this;
    },

    _resetItemsHandle: function(collection, options) {
        var self, views;

        self = this;
        this.$emptySubviews();

        views = [];
        collection.each(function(model, i, collection){
            views.push(this.$viewForItem(model, collection));
        }, this);

        this.$addSubview(views, {
            shouldDelegateEvents: true,
            transition: addTransition
        });

        self.trigger('itemDidReset');

        return this;
    },

    _sortItemsHandle: function(collection, options) {
        var self;

        self = this;
        if (!this.$isNotEmpty()) return this;

        // add用了定时器，sort会发生在add前，subview的数量会比model少，所以要处理下
        this._sortTimer = setTimeout(function(){
            var len, i, tempArr, subviews, mountPoint, display, fragment;
            len = self.$count();

            if (collection.length === len) {
                subviews = self.$getSubviews();
                tempArr = new Array(len);

                // 先排序
                for (i = 0; i < len; i += 1) {
                    tempArr[collection.indexOf(subviews[i].model)] = subviews[i];
                }

                // 执行变更
                self.__subviews__ = tempArr;
                mountPoint = _.result(self, '$mountPointForSubview', self.el);
                fragment = document.createDocumentFragment();
                self.$eachSubview(function(view){
                    fragment.appendChild(view.el);
                });
                mountPoint.appendChild(fragment);

                // force reflow
                mountPoint.offsetHeight
                // transition
                self.$eachSubview(function(view){
                    view.el.style.opacity = 1
                })

                self.trigger('itemDidSort');
            } else {
                self._sortItemsHandle(collection, options);
            }
        }, 16);

        return this;
    }
});

module.exports = DbbCollectionView;
