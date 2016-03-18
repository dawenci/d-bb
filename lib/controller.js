var Dbb = require('./dbb');
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var _slice = Array.prototype.slice;

var emptyFn = function() {};

Dbb.Controller = Dbb.DbbObject.extend({
    constructor: function DbbCtrl(options) {
        options || (options = {});
        this.cid = _.uniqueId('ctrl');
        this.setView(new Dbb.View({}));
        this._eventBus = Dbb.eventBus;
        _.extend(this, options);
        // _.extend(this, _.pick(options, [
        //     'viewWillRender',
        //     'viewDidRender',
        //     'viewWillMount',
        //     'viewDidMount',
        //     'viewWillRefresh',
        //     'viewDidRefresh',
        //     'viewWillUnMount',
        //     'viewDidUnMount',
        //     'viewWillDealloc',
        //     'viewDidDealloc',
        //     'willDealloc',
        //     'didDealloc'
        //     ]));
        Dbb.DbbObject.call(this, options);
    },

    broadcast: function() {
        this._eventBus.trigger.apply(this._eventBus, _slice.call(arguments, 0));
    },

    listenToBus: function(name, callback) {
        this.listenTo(this._eventBus, name, callback);
    },

    setView: function(view) {
        if (this.view) {
            this.stopListening(this.view);
            this.view.dealloc();
        }
        this.view = view;
        this.listenTo(view, 'viewWillRender', this.viewWillRender);
        this.listenTo(view, 'viewDidRender', this.viewDidRender);
        this.listenTo(view, 'viewWillMount', this.viewWillMount);
        this.listenTo(view, 'viewDidMount', this.viewDidMount);
        this.listenTo(view, 'viewWillRefresh', this.viewWillRefresh);
        this.listenTo(view, 'viewDidRefresh', this.viewDidRefresh);
        this.listenTo(view, 'viewWillUnMount', this.viewWillUnMount);
        this.listenTo(view, 'viewDidUnMount', this.viewDidUnMount);
        this.listenTo(view, 'viewWillDealloc', this.viewWillDealloc);
        this.listenTo(view, 'viewDidDealloc', this.viewDidDealloc);
    },

    dealloc: function(options) {
        if (this._isDealloc) { return this; }
        this.view.dealloc();
        this._eventBus.off(null, null, this);
        Dbb.DbbObject.prototype.dealloc.call(this, options);
    },

    initialize: emptyFn,
    viewWillRender: emptyFn,
    viewDidRender: emptyFn,
    viewWillMount: emptyFn,
    viewDidMount: emptyFn,
    viewWillRefresh: emptyFn,
    viewDidRefresh: emptyFn,
    viewWillUnMount: emptyFn,
    viewDidUnMount: emptyFn,
    viewWillDealloc: emptyFn,
    viewDidDealloc: emptyFn,
    willDealloc: emptyFn,
    didDealloc: emptyFn
});


module.exports = Dbb;
