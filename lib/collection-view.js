var Dbb = require('./dbb');

Dbb.CollectionView = Dbb.View.extend({
    initialize: function() {
        this.listenTo(this.collection, 'add', this._addItem);
        this.listenTo(this.collection, 'remove', this._removeItem);
        this.listenTo(this.collection, 'reset', this._resetItems);
        this.listenTo(this.collection, 'sort', this._sortItems);
    },

    _addItem: function(model, collection, options) {
        var view = this.viewForItem(model);
        view.render().el.style.opacity = .5;
        this.addSubView(view);
        setTimeout(function(){ view.el.style.opacity = 1; },150);
        return this;
    },

    _removeItem: function(model, collection, options) {
        this._hasSubView() && this.removeSubView({atIndex: options.index});
        return this;
    },

    _resetItems: function(collection, options) {
        var views = [];
        var self = this;
        this.emptySubViews();
        collection.each(function(model, i, collection){
            var view = this.viewForItem(model);
            views.push(view);
        }, this);

        this.el.style.opacity = .5;
        this.addSubView(views);

        setTimeout(function(){
            self.el.style.opacity = 1;
        },150);

        return this;
    },

    _sortItems: function(collection, options) {
        var fragment, tempArr, subViews, len, i, mountPoint, display;
        if (!this._hasSubView()) {
            return this;
        }
        // 先排序
        tempArr = [];
        subViews = this._subViews;
        len = subViews.length;
        for (i = 0; i < len; i += 1) {
            tempArr[collection.indexOf(subViews[i].model)] = subViews[i];
        }

        // 执行变更
        this._subViews = tempArr;
        mountPoint = this.mountPointForSubView();
        display = mountPoint.style.display;
        mountPoint.style.display = 'none';
        fragment = document.createDocumentFragment();
        this._subViews.forEach(function(view) {
            fragment.appendChild(view.el);
        });
        mountPoint.style.display = display;
        mountPoint.appendChild(fragment);
        return this;
    },

    viewForItem: function(model) {
        Dbb.error('collectionView 的 viewForItem 必须实现');
    },

    // 可重写，如何获取子view的el挂载dom容器
    mountPointForSubView: function() {
        return this.el;
    }

});



// View的基类
module.exports = Dbb;
