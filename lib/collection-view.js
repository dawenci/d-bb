var Dbb = require('./dbb');
var DbbView = require('./view');

var DbbCollectionView = DbbView.extend({
    constructor: function DbbCollectionView(options) {
        if (options.collection) this.setCollection(options.collection);
        DbbView.call(this, options);
    },

    setCollection: function setCollection(collection) {
        if (this.collection) this.stopListening(this.collection);
        this.collection = collection;
        this.listenTo(collection, 'add', this._addItem);
        this.listenTo(collection, 'remove', this._removeItem);
        this.listenTo(collection, 'reset', this._resetItems);
        this.listenTo(collection, 'sort', this._sortItems);
    },

    // override
    viewForItem: function viewForItem(model, collection) {
        return new DbbView({ model: model });
    },

    renderItems: function renderItems() {
        // collection 有原始数据，则渲染
        if (this.collection.length) {
            this.emptySubviews();
            views = [];
            this.collection.each(function(model, i, collection){
                views.push(this.viewForItem(model, collection));
            }, this);
            this.addSubview(views, { shouldDelegateEvents: true });
        }
    },

    _addItem: function _addItem(model, collection, options) {
        var self, view;

        options = options || {};
        self = this;
        view = this.viewForItem(model, collection).render();
        clearTimeout(this._addTimer);
        if (!this._buffer) this._buffer = [];
        this._buffer.push(view);
        view.el.style.transition = '';
        view.el.style.opacity = 0;

        this._addTimer = setTimeout(function() {
            self.addSubview(self._buffer, { shouldDelegateEvents: true });

            // 修复add时，不会重新排序
            // 确保如果没有传入sort:false的option, 才重新排序
            if (options.sort !== false) {
                self._sortItems(self.collection, {});
            }

            // next tick
            setTimeout(function(){
                _.each(self._buffer, function(view) {
                    view.el.style.transition = 'opacity .2s';
                    view.el.style.opacity = 1;
                });
                self._buffer.length = 0;
                self.trigger('itemDidAdd');
            }, 0);
        }, 16);
        return this;
    },

    _removeItem: function _removeItem(model, collection, options) {
        this.removeSubview(options.index);
        this.trigger('itemDidRemove');
        return this;
    },

    _resetItems: function _resetItems(collection, options) {
        var self, views;

        self = this;
        this.emptySubviews();

        views = [];
        collection.each(function(model, i, collection){
            views.push(this.viewForItem(model, collection));
        }, this);

        this.el.style.transition = '';
        this.el.style.opacity = 0;
        this.addSubview(views, { shouldDelegateEvents: true });

        // next tick
        setTimeout(function() {
            self.el.style.transition = 'opacity .2s';
            self.el.style.opacity = 1;
            self.trigger('itemDidReset');
        }, 0);

        return this;
    },

    _sortItems: function _sortItems(collection, options) {
        var self;

        self = this;
        if (!this.hasSubview()) return this;

        // add用了定时器，sort会发生在add前，subview的数量会比model少，所以要处理下
        this._sortTimer = setTimeout(function(){
            var len, i, tempArr, subviews, mountPoint, display, fragment;
            len = self.count();

            if (collection.length === len) {
                subviews = self.getSubviews();
                tempArr = new Array(len);

                // 先排序
                for (i = 0; i < len; i += 1) {
                    tempArr[collection.indexOf(subviews[i].model)] = subviews[i];
                }

                // 执行变更
                self._subviews = tempArr;
                mountPoint = _.result(self, 'mountPointForSubview', self.el);
                display = mountPoint.style.display;
                mountPoint.style.transition = '';
                mountPoint.style.opacity = 0;
                mountPoint.style.display = 'none';
                fragment = document.createDocumentFragment();
                self.eachSubview(function(view){
                    fragment.appendChild(view.el);
                });
                mountPoint.style.display = display;

                // next tick
                setTimeout(function(){
                    mountPoint.style.transition = 'opacity .2s';
                    mountPoint.style.opacity = 1;
                    self.trigger('itemDidSort');
                }, 0);

                mountPoint.appendChild(fragment);
            } else {
                self._sortItems(collection, options);
            }
        }, 16);

        return this;
    }
});

module.exports = DbbCollectionView;
