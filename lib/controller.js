var Dbb = require('./dbb');
var _hasOwnProperty = Object.prototype.hasOwnProperty;


Dbb.Controller = Dbb.extend({
    constructor: function DbbCtrl(options) {
        options || (options = {});
        this.cid = _.uniqueId('ctrl');
        this.setView(new Dbb.View({}));
        _.extend(this, _.pick(options, [
            'viewWillRender',
            'viewDidRender',
            'viewWillMount',
            'viewDidMount',
            'viewWillRefresh',
            'viewDidRefresh',
            'viewWillUnMount',
            'viewDidUnMount',
            'viewWillDealloc',
            'viewDidDealloc'
            ]));
        Dbb.call(this, options);
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
        this.stopListening(this.view);
        this.view.dealloc();
        Dbb.prototype.dealloc.call(this, options);
    },

    initialize: function(){},
    viewWillRender: function(){},
    viewDidRender: function(){},
    viewWillMount: function(){},
    viewDidMount: function(){},
    viewWillRefresh: function(){},
    viewDidRefresh: function(){},
    viewWillUnMount: function(){},
    viewDidUnMount: function(){},
    viewWillDealloc: function(){},
    viewDidDealloc: function(){}
});


module.exports = Dbb;
