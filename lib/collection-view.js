var Dbb = require('./dbb');
var DbbView = require('./view');

var DbbCollectionView = DbbView.extend({
    constructor: function DbbCollectionView(options) {
        if (!options.collection) {
            throw new Error('Collection View 必须传入collection 创建');
        }
        this.listenTo(options.collection, 'add', this._addItem);
        this.listenTo(options.collection, 'remove', this._removeItem);
        this.listenTo(options.collection, 'reset', this._resetItems);
        this.listenTo(options.collection, 'sort', this._sortItems);
        DbbView.call(this, options);
    },

    _addItem: function _addItem(model, collection, options) {
        var self = this;
        if (!this._buffer) {
            this._buffer = [];
        }
        var view = this.viewForItem(model);
        view.render().el.style.opacity = 0.5;
        this._buffer.push(view);

        window.clearTimeout(this._addTimer);
        this._shouldAdd = true;
        this._addTimer = window.setTimeout(function(){
            if (self._shouldAdd) {
                self.addSubview(self._buffer, { shouldDelegateEvents: true });
                setTimeout(function(){
                    self._buffer.forEach(function(view){
                        view.el.style.opacity = 1;
                    });
                    self._buffer.length = 0;
                },150);
            }
        }, 16);
        return this;
    },

    _removeItem: function _removeItem(model, collection, options) {
        if (this.hasSubview()) this.removeSubview(options.index);
        return this;
    },

    _resetItems: function _resetItems(collection, options) {
        var views = [];
        var self = this;
        this.emptySubviews();
        collection.each(function(model, i, collection){
            var view = this.viewForItem(model);
            views.push(view);
        }, this);

        this.el.style.opacity = 0.5;
        this.addSubview(views, { shouldDelegateEvents: true });

        setTimeout(function(){
            self.el.style.opacity = 1;
        },150);

        return this;
    },

    _sortItems: function _sortItems(collection, options) {
        var self = this;
        var fragment, tempArr, subviews, len, i, mountPoint, display;
        if (!this.hasSubview()) {
            return this;
        }
        // 先排序
        tempArr = [];
        subviews = this.getSubviews();
        len = this.count();

        // add用了定时器，sort会发生在add前，subview的数量会比model少，所以要处理下
        this._sortTimer = window.setTimeout(function(){
            if (collection.length === len) {
                for (i = 0; i < len; i += 1) {
                    tempArr[collection.indexOf(subviews[i].model)] = subviews[i];
                }

                // 执行变更
                self._subviews = tempArr;
                mountPoint = self._mountPoint;
                display = mountPoint.style.display;
                mountPoint.style.display = 'none';
                fragment = document.createDocumentFragment();
                self.eachSubview(function(view){
                    fragment.appendChild(view.el);
                });
                mountPoint.style.display = display;
                mountPoint.appendChild(fragment);
            } else {
                self._sortItems(collection, options);
            }
        }, 16);

        return this;
    },

    viewForItem: function viewForItem(model) {
        throw new Error('collectionView 的 viewForItem 必须实现');
    }
});

module.exports = DbbCollectionView;
