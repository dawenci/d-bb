var Dbb = require('./dbb'),
    DbbView = require('./view'),
    DbbObj = Dbb.DbbObject,
    emptyFn = function() {},
    ctrlFields = ['setView', 'dealloc'],
    ctrlOptions = [];

var DbbCtrl = DbbObj.extend({

    constructor: function DbbCtrl(options) {
        DbbObj.call(this);

        options = _.extend({}, options || {});
        _.extend(this, _.omit(options, ctrlFields.concat(ctrlOptions) ));
        this.options = _.pick(options, ctrlOptions);
        this.cid = _.uniqueId('ctrl');
        this.setView(options.view || new DbbView({}));
        this.initialize.apply(this, _.toArray(arguments));
    },

    dealloc: function dealloc(options) {
        if (!this.isRetained()) return this;
        this.triggerEventMethod('willDealloc');
        this.view.dealloc();
        DbbObj.prototype.dealloc.call(this);
    },

    initialize: emptyFn,

    setView: function setView(view) {
        if (this.view) {
            this.stopListening(this.view);
            this.view.dealloc();
        }
        this.view = view;
        this.listenTo(view, 'viewWillRender', this.viewWillRender || emptyFn);
        this.listenTo(view, 'viewDidRender', this.viewDidRender || emptyFn);
        this.listenTo(view, 'viewWillMount', this.viewWillMount || emptyFn);
        this.listenTo(view, 'viewDidMount', this.viewDidMount || emptyFn);
        this.listenTo(view, 'viewWillRefresh', this.viewWillRefresh || emptyFn);
        this.listenTo(view, 'viewDidRefresh', this.viewDidRefresh || emptyFn);
        this.listenTo(view, 'viewWillUnMount', this.viewWillUnMount || emptyFn);
        this.listenTo(view, 'viewDidUnMount', this.viewDidUnMount || emptyFn);
        this.listenTo(view, 'viewWillDealloc', this.viewWillDealloc || emptyFn);
        this.listenTo(view, 'viewDidDealloc', this.viewDidDealloc || emptyFn);
    },
});


module.exports = DbbCtrl;
