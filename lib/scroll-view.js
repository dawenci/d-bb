var Dbb = require('./dbb');
var DScroll = require('dscroll');

Dbb.ScrollView = Dbb.View.extend({
    className: 'v-scroll-wrapper',

    optionsForScroll: function() {
        return {};
    },

    shouldRefresh: true,

    refresh: function() {
        var self = this;
        if (!this.scroll) {
            return this;
        }
        // 阻止16ms内的其他refresh调用
        window.clearTimeout(this.refreshTimer);
        // 延迟10ms后refresh
        this.shouldRefresh = true;
        this.refreshTimer = window.setTimeout(function() {
            if (self.shouldRefresh) {
                self.scroll.refresh();
            }
        }, 16);
    },

    mountPointForSubview: function() {
        return this.$el.find('.content').get(0);
    },

    viewDidMount: function() {
        this.scroll = new DScroll(this.el, _.extend({
            probeType: 1,
            mouseWheel: true,
            click: true,
            ev: Dbb.Events
        }, this.optionsForScroll()));
    },

    viewDidRefresh: function() {
        this.scroll = new DScroll(this.el, _.extend({
            probeType: 1,
            mouseWheel: true,
            click: true,
            ev: Dbb.Events
        }, this.optionsForScroll()));
    },

    setPullDownAction: function(action) {
        if (!this.scroll) {
            return this;
        }
        this.scroll.setPullDownAction(action);
        return this;
    },

    setPullUpAction: function(action) {
        if (!this.scroll) {
            return this;
        }
        this.scroll.setPullUpAction(action);
        return this;
    },

    scrollTo: function() {
        if (!this.scroll) {
            return this;
        }
        this.scroll.scrollTo.apply(this.scroll, Array.prototype.slice.call(arguments, 0));
    },

    template: _.template('\
    <div class="scroller v-scroll-scroller">\
        <div class="content v-scroll-content"></div>\
    </div>')
});

module.exports = Dbb;
