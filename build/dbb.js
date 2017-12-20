(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

// 导入配置

require('./lib/config');

var Events = require('./lib/core/events');
var eventbus = require('./lib/core/mixin/eventbus');
var Dbb = {};

Dbb.$broadcast = eventbus.broacast;
Dbb.$listenToBus = eventbus.listenToBus;
Dbb.$ = Backbone.$;
Dbb.Events = Events;
Dbb.Object = require('./lib/core/object');
Dbb.Collection = require('./lib/core/collection');
Dbb.Model = require('./lib/core/model');
Dbb.View = require('./lib/core/view');
Dbb.CollectionView = require('./lib/collection-view');

module.exports = window.Dbb = Dbb;

},{"./lib/collection-view":2,"./lib/config":3,"./lib/core/collection":6,"./lib/core/events":7,"./lib/core/mixin/eventbus":8,"./lib/core/model":11,"./lib/core/object":12,"./lib/core/view":13}],2:[function(require,module,exports){
'use strict';

var DbbView = require('./core/view');

var addTransition = {
    subviewWillAdd: function subviewWillAdd($el) {
        $el.css('transition', '');
        $el.css('opacity', 0);
    },
    subviewDidAdd: function subviewDidAdd($el) {
        $el.css('transition', 'opacity .2s');
        $el.css('opacity', 1);
    }
};
var addTransitionAndSort = {
    subviewWillAdd: function subviewWillAdd($el) {
        $el.css('transition', '');
        $el.css('opacity', 0);
    },
    subviewDidAdd: function subviewDidAdd($el) {
        $el.css('transition', 'opacity .2s');
    }
};
var removeTransition = {
    subviewWillRemove: function subviewWillRemove($el) {
        $el.css('transition', '');
        $el.css('opacity', 1);
    },
    subviewDidRemove: function subviewDidRemove($el, done) {
        $el.css('transition', 'opacity .2s');
        $el.css('opacity', 0);
        setTimeout(done, 200);
    }
};

function appendPlaceholder() {
    var placeholder = _.result(this, 'placeholder');
    if (placeholder) {
        var $mountPoint = _.result(this, '$mountPointForSubview');
        if (!$mountPoint.find(placeholder).length) {
            $mountPoint.append(placeholder);
        }
    }
}
function removePlaceholder() {
    var placeholder = _.result(this, 'placeholder');
    if (placeholder) {
        var $mountPoint = _.result(this, '$mountPointForSubview');
        if ($mountPoint.find(placeholder).length) {
            placeholder instanceof $ ? placeholder.detach() : $(placeholder).detach();
        }
    }
}
function updatePlaceholder() {
    if (this.$count()) removePlaceholder.call(this);else appendPlaceholder.call(this);
}

function onItemAdded(model, collection, options) {
    var _this = this;

    options = options || {};
    var view = this.$viewForItem(model, collection).$render();
    clearTimeout(this._addTimer);
    if (!this._buffer) this._buffer = [];
    this._buffer.push(view);
    this._addTimer = setTimeout(function () {
        // console.log('add timeout')
        // 修复add时，不会重新排序
        // 确保如果没有传入sort:false的option, 才重新排序
        // 排序动画，跟add动画只一个生效
        if (options.sort !== false) {
            _this.$addSubview(_this._buffer, {
                shouldDelegateEvents: true,
                transition: addTransitionAndSort
            });
            onItemsSorted.call(_this, _this.collection, {});
        } else {
            _this.$addSubview(_this._buffer, {
                shouldDelegateEvents: true,
                transition: addTransition
            });
        }

        _this._buffer.length = 0;
        _this.trigger('itemDidAdd');
    }, 0);

    updatePlaceholder.call(this);

    return this;
}

function onItemRemoved(model, collection, options) {
    this.$removeSubview(options.index, {
        transition: removeTransition
    });
    this.trigger('itemDidRemove');

    updatePlaceholder.call(this);

    return this;
}

function onItemsReset(collection, options) {
    updatePlaceholder.call(this);

    this.$emptySubviews();

    var views = [];
    collection.each(function (model, i, collection) {
        views.push(this.$viewForItem(model, collection));
    }, this);

    this.$addSubview(views, {
        shouldDelegateEvents: true,
        transition: addTransition
    });

    this.trigger('itemDidReset');

    updatePlaceholder.call(this);

    return this;
}

function onItemsSorted(collection, options) {
    if (!this.$isNotEmpty()) return this;

    var self = this;
    // add用了定时器，sort会发生在add前，subview的数量会比model少，所以要处理下
    this._sortTimer = setTimeout(function () {
        // console.log('sort timeout')
        var subviews, $mountPoint, display, $fragment;
        var tempArr = void 0;
        var len = self.$count();
        if (collection.length === len) {
            subviews = self.$getSubviews();
            tempArr = new Array(len);

            // 先排序
            for (var i = 0; i < len; i += 1) {
                var index = collection.indexOf(subviews[i].model);
                tempArr[index] = subviews[i];
            }

            // 执行变更
            self.__subviews__ = tempArr;
            $mountPoint = _.result(self, '$mountPointForSubview', self.$el);
            $fragment = $(document.createDocumentFragment());
            self.$eachSubview(function (view) {
                $fragment.append(view.$el);
            });
            $mountPoint.append($fragment);

            // force reflow
            $mountPoint.get(0).offsetHeight;
            // transition
            self.$eachSubview(function (view) {
                view.$el.css('opacity', 1);
                // view.el.style.opacity = 1
            });

            self.trigger('itemDidSort');
        } else {
            onItemsSorted.call(self, collection, options);
        }
    }, 0);

    updatePlaceholder.call(this);

    return this;
}

var DbbCollectionView = DbbView.extend({
    constructor: function DbbCollectionView(options) {
        if (!(this instanceof DbbCollectionView)) return new DbbCollectionView(options);

        if (options.collection) this.$setCollection(options.collection);
        DbbView.call(this, options);
    },

    $setCollection: function $setCollection(collection) {
        if (this.collection) this.stopListening(this.collection);
        this.collection = collection;
        this.listenTo(collection, 'add', onItemAdded);
        this.listenTo(collection, 'remove', onItemRemoved);
        this.listenTo(collection, 'reset', onItemsReset);
        this.listenTo(collection, 'sort', onItemsSorted);
        return this;
    },


    // override
    $viewForItem: function $viewForItem(model, collection) {
        return new DbbView({ model: model });
    },
    $renderItems: function $renderItems() {
        this.$updatePlaceholder.call(this);

        // collection 有原始数据，则渲染
        if (this.collection.length) {
            this.$emptySubviews();

            var views = [];
            this.collection.each(function (model, i, collection) {
                views.push(this.$viewForItem(model, collection));
            }, this);

            this.$addSubview(views, {
                shouldDelegateEvents: true,
                transition: addTransition
            });
        }
        return this;
    },
    $updatePlaceholder: function $updatePlaceholder() {
        updatePlaceholder.call(this);
        return this;
    }
});

module.exports = DbbCollectionView;

},{"./core/view":13}],3:[function(require,module,exports){

// underscore template settings
// _.templateSettings = {
//     evaluate: /\{\%(.+?)\%\}/g,
//     interpolate: /\{\{(.+?)\}\}/g,
//     escape: /\{\{-(.+?)\}\}/g
// }
"use strict";

},{}],4:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var BuildInUIAccessor = {
  value: {
    get: function get($el, field, dataKey) {
      return $el.val();
    },
    set: function set($el, field, value, dataKey) {
      if ($el.val() !== value) {
        $el.val(value);
        $el.trigger('change');
      }
    }
  },
  checked: {
    get: function get($el, field, dataKey) {
      return $el.prop('checked');
    },
    set: function set($el, field, value, dataKey) {
      if ($el.prop('checked') !== value) {
        $el.prop('checked', value);
        $el.trigger('change');
      }
    }
  },
  selected: {
    get: function get($el, field, dataKey) {
      return _.find($el.find('option'), function (option) {
        return option.selected === true;
      }).value;
    },
    set: function set($el, field, value, dataKey) {
      var option = _.find($el.find('option'), function (option) {
        return option.value === value;
      });
      if (option && !option.selected) {
        option.selected = true;
        $el.trigger('change');
      }
    }
  },
  option: {
    get: function get($el, field, dataKey) {
      return _.find($el.find('option'), function (option) {
        return option.selected === true;
      }).innerHTML;
    },
    set: function set($el, field, value, dataKey) {
      var option = _.find($el.find('option'), function (option) {
        return option.innerHTML === value;
      });
      if (option && !option.selected) {
        option.selected = true;
        $el.trigger('change');
      }
    }
  },
  radio: {
    get: function get($el, field, dataKey) {
      return _.find($el, function (el) {
        return el.checked === true;
      }).value;
    },
    set: function set($el, field, value, dataKey) {
      var radio = _.find($el, function (radio) {
        return radio.value === value;
      });
      if (radio && !radio.checked) {
        radio.checked = true;
        $(radio).trigger('change');
      }
    }
  },
  text: {
    get: function get($el, field, dataKey) {
      return $el.html();
    },
    set: function set($el, field, value, dataKey) {
      $el.html() !== value && $el.html(value);
    }
  },
  prop: {
    get: function get($el, field, dataKey) {
      return $el.prop(field);
    },
    set: function set($el, field, value, dataKey) {
      $el.prop(field) !== value && $el.prop(field, value);
    }
  },
  data: {
    get: function get($el, field, dataKey) {
      return $el.data(field);
    },
    set: function set($el, field, value, dataKey) {
      $el.data(field) !== value && $el.data(field, value);
    }
  },
  attr: {
    get: function get($el, field, dataKey) {
      return $el.attr(field);
    },
    set: function set($el, field, value, dataKey) {
      $el.attr(field) !== value && $el.attr(field, value);
    }
  }
};

var DbbObject = require('../object');
var BindingRecord = DbbObject.extend({
  constructor: function BindingRecord(view, model, data) {
    DbbObject.call(this);
    var options = { view: view, model: model, data: data };
    _.extend(this, options);
    _.isFunction(this.initialize) && this.initialize();
  },

  $dealloc: function $dealloc() {
    this.unbind();
    DbbObject.prototype.$dealloc.call(this);
  },
  get: function get(key, defaults) {
    return _.result(this.data, key, defaults);
  },
  set: function set(key, val) {
    var _this = this;

    var before = {};
    var changed = {};

    var prev = this.get(key);
    if ((typeof key === 'string' || typeof key === 'number') && prev !== val) {
      before[key] = prev;
      changed[key] = val;
      this.data[key] = val;
      this.trigger('change:' + key, this, val, { prev: prev });
    } else if ((typeof key === 'undefined' ? 'undefined' : _typeof(key)) === 'object') {
      _.each(key, function (val, key) {
        var prev = _this.get(key);
        if (prev !== val) {
          before[key] = prev;
          changed[key] = val;
          _this.data[key] = val;
          _this.trigger('change:' + key, _this, val, { prev: prev });
        }
      });
    }

    this.trigger('change', this, changed, before);

    return this;
  },
  selector: function selector() {
    var selector = this.get('selector');
    if (selector) return selector;

    // 分隔符 | ,
    // `value @ .absdf[name="abc"] .input ` => `.absdf[name="abc"] .input`
    selector = $.trim(this.get('targetInfo').replace(/(^(\s+)?\S+(\s+)?@)(\s+)?/, ''));
    if (selector) this.set('selector', selector);
    return selector;
  },
  $el: function $el() {
    var selector = this.selector();
    return selector === '$el' ? this.view.$el : this.view.$(selector);
  },
  tagName: function tagName() {
    var tagName = this.get('tagName');
    if (tagName) return tagName;
    var el = this.$el().get(0);
    tagName = el && el.tagName.toLowerCase();
    if (tagName) this.set('tagName', tagName);
    return tagName;
  },


  // 从 `type@selector` 中提取 `type` 部分
  _pick_update_key: function _pick_update_key() {
    var type = this.get('targetInfo').match(/\S+(\s+)?@/);
    if (!type) return '';
    return $.trim(type[0].replace('@', ''));
  },

  // UI 更新的方式
  ui_update_info: function ui_update_info() {
    var cache = this.get('ui_update_info');
    if (cache) return cache;

    var $el = this.$el();
    var tagName = this.tagName();

    var host = 'buildin'; // OR view
    var key = this._pick_update_key();
    var field = key;
    var get = void 0;
    var set = void 0;

    if (key.substr(0, 5) === 'view.') {
      host = 'view', field = key.slice(5);
    }

    if (key.substr(0, 5) === 'data-') {
      field = key.slice(5);
      get = 'data';
      set = 'data';
    } else if (tagName === 'input') {
      if (!key || host === 'view') {

        var type = $el.attr('type'); // ''|undefined|other -> 'value'          
        get = set = type !== 'checkbox' && type !== 'radio' ? 'value' : type;
      } else {
        get = set = key === 'value' ? 'value' : 'attr';
      }
    }

    // textarea
    if (tagName === 'textarea' && !get && !set) {
      get = set = 'value';
    }

    // option：根据option文字更新，selected: 根据option的value更新
    if (tagName === 'select' && !get && !set) {
      get = set = key === 'option' ? 'option' : 'selected';
    }

    // 兜底设置
    if (!get && !set) {
      get = set = key && key !== 'text' ? 'attr' : 'text';
    }

    var info = { host: host, field: field, get: get, set: set

      // set cache
    };this.set('ui_update_info', info);
    return info;
  },


  // UI getter, setter
  BuildInUIAccessor: BuildInUIAccessor,

  updateUI: function updateUI(value) {
    var $el = this.$el();
    if ($el.length === 0) return;
    var info = this.ui_update_info();
    var updater = void 0;
    var setter = void 0;

    // 使用 view 中定义的存取器
    // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
    // 也可以是一个对象，内部包含 get&set方法
    if (info.host === 'view') {
      updater = this.view[info.field];
      if (updater && updater.set) setter = updater.set;else if (_.isFunction(updater)) setter = updater;
    }

    // 内置的 UI 存取器
    if (!updater || !setter) {
      updater = this.BuildInUIAccessor[info.set];
      setter = updater.set;
    }
    setter.call(this.view, $el, info.field, value, this.get('dataKey'));
    // console.log('UI did update', value, info)
  },


  // 更新模型
  updateModel: function updateModel(changedValue) {
    // 执行更新
    if (this.get('dataKey').substr(0, 5) === 'model.') {
      var methodName = this.get('dataKey').slice(5);
      _.isFunction(this.model[methodName]) && this.model[methodName](changedValue);
    } else {
      this.model.set(this.get('dataKey'), changedValue);
    }
    // console.log('model did update')
  },
  getUIValue: function getUIValue() {
    var $el = this.$el();
    if ($el.length === 0) return;

    // 目标元素不是表单交互元素的时候，跳过
    // 否则有内部有表单元素触发更新，也会触发 model 更新出现bug
    var tagName = this.tagName();
    if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') return;

    var info = this.ui_update_info();
    var updater = void 0;
    var getter = void 0;

    // 使用 view 中定义的存取器
    // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
    // 也可以是一个对象，内部包含 get&set方法
    if (info.host === 'view') {
      updater = this.view[info.field];
      if (updater && updater.get) getter = updater.get;else if (_.isFunction(updater)) getter = updater;
    }

    // 内置的 UI 存取器
    if (!updater || !getter) {
      updater = this.BuildInUIAccessor[info.get];
      getter = updater.get;
    }

    var value = getter.call(this.view, $el, info.field, this.get('dataKey'));
    return value;
  },


  // model 更新时候，自动更新 UI
  _UI_updater: function _UI_updater(model, changedValue, options) {
    var $el = this.$el();
    if (!$el.length) return;

    this.updateUI(changedValue);
  },


  // UI -> model
  _model_updater: function _model_updater(e) {
    // 目标元素不是表单交互元素的时候，跳过
    if (this.$el().length === 0) return;
    var tagName = this.tagName();
    if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') return;

    var changedValue = this.getUIValue();
    this.updateModel(changedValue);
  },
  syncDataToUI: function syncDataToUI() {
    var value = this.model.get(this.get('dataKey'));
    this.updateUI(value);
  },
  syncDataToModel: function syncDataToModel() {
    var value = this.getUIValue();
    this.updateModel(value);
  },
  initialize: function initialize() {
    this.model_updater = this._model_updater.bind(this);
    this.UI_updater = this._UI_updater.bind(this);
  },
  bind: function bind() {
    // 监听 model 变化，执行 UI_updater
    this.view.listenTo(this.model, 'change:' + this.get('dataKey'), this.UI_updater);

    // 绑定事件，没有指定子元素的 selector 时，作用在视图的根元素上
    if (this.selector() === '$el') {
      this.view.$el.on('change', this.model_updater);

      // 否则使用事件代理，作用在指定 selector 的子元素上
    } else {
      this.view.$el.on('change', this.selector(), this.model_updater);
    }
  },
  unbind: function unbind() {
    // 监听 model 变化，执行 UI_updater
    this.view.stopListening(this.model, 'change:' + this.get('dataKey'), this.UI_updater);

    // 绑定事件，没有指定子元素的 selector 时，作用在视图的根元素上
    if (this.selector() === '$el') {
      this.view.$el.off('change', this.model_updater);

      // 否则使用事件代理，作用在指定 selector 的子元素上
    } else {
      this.view.$el.off('change', this.selector(), this.model_updater);
    }
  }
});

module.exports = BindingRecord;

},{"../object":12}],5:[function(require,module,exports){
'use strict';

var BindingRecord = require('./binding-record');

function parseBindings(view, model, bindings) {
    var records = [];
    _.each(bindings, function (dataKey, targetInfo) {
        dataKey = dataKey.split(',');
        targetInfo = targetInfo.split(',');
        _.each(dataKey, function (dataKey) {
            _.each(targetInfo, function (targetInfo) {
                if (!targetInfo || !dataKey) return;
                records.push(new BindingRecord(view, model, {
                    targetInfo: targetInfo,
                    dataKey: dataKey
                }));
            });
        });
    });
    return records;
}

// { '.selector': 'model_key' }
// OR
// { '.selector|type': 'model_key' }
// type: 更新的位置，属性名、text(innerHTML)、checked 等等
function bind(view, model, bindings) {
    // 没有 unbind 的话，每次 bind，都使用追加的方式
    // 当次 bind 作用在新增的 bindings 上
    if (!_.isArray(view.__bindingRecords__)) view.__bindingRecords__ = [];
    var newRecords = parseBindings(view, model, bindings);
    view.__bindingRecords__ = view.__bindingRecords__.concat(newRecords);
    _.each(newRecords, function (record) {
        record.bind();
    });
}

function unbind(view, model, records) {
    // 可以指定某些绑定 records，不指定，则处理整个 view 的所有绑定
    records = records || view.__bindingRecords__ || [];
    _.each(records, function (record) {
        record.unbind();
    });

    var leftRecords = _.reject(view.__bindingRecords__, function (record) {
        return _.includes(records, record);
    });
    if (leftRecords.length) view.__bindingRecords__ = leftRecords;else delete view.__bindingRecords__;
}

function syncData(view, isToModel) {
    var records = view.__bindingRecords__ || [];
    _.each(records, isToModel ? function (record) {
        return record.syncDataToModel();
    } : function (record) {
        return record.syncDataToUI();
    });
}

module.exports = {
    bind: bind,
    unbind: unbind,
    syncData: syncData
};

},{"./binding-record":4}],6:[function(require,module,exports){
'use strict';

var utils = require('./mixin/utils');
var eventbus = require('./mixin/eventbus');

var DbbCollection = Backbone.Collection.extend({
  constructor: function DbbCollection(options) {
    if (!(this instanceof DbbCollection)) return new DbbCollection(options);

    // 调用父类构造函数
    // 顺序不能变，否则在继承DbbView的子类中，initialize会早于constructor执行，
    // 导致this.options的值是undefined
    Backbone.Collection.call(this, options);
  },

  $broadcast: eventbus.broacast,
  $listenToBus: eventbus.listenToBus,

  $callHook: utils.callHook
});

module.exports = DbbCollection;

},{"./mixin/eventbus":8,"./mixin/utils":10}],7:[function(require,module,exports){
'use strict';

var Events = Backbone.Events;

module.exports = Events;

},{}],8:[function(require,module,exports){
'use strict';

var Events = require('../events');
var eventbus = _.extend({}, Events);

exports.broacast = function broacast() {
  eventbus.trigger.apply(eventbus, _.toArray(arguments));
  return this;
};

exports.listenToBus = function listenToBus(name, callback) {
  var ctx = _.isFunction(this.listenTo) ? this : eventbus;
  ctx.listenTo(eventbus, name, callback);
  return this;
};

},{"../events":7}],9:[function(require,module,exports){
'use strict';

// 检查对象是否被retained，即是否未被销毁
// 1. has own property '__isRetained__' ?
// 2. __isRetained__ == true ?

exports.isRetained = function () {
    return _.has(this, '__isRetained__') && !!this.__isRetained__;
};

// 检查对象是否已经销毁
exports.isDealloc = function () {
    return !this.__isRetained__ || !_.has(this, '__isRetained__');
};

},{}],10:[function(require,module,exports){
'use strict';

// 调用钩子函数、触发同名事件

exports.callHook = function (name) {
    // 'after:send' => 'afterSend'
    var method = _.map(String(name).split(':'), function (part, index) {
        return index > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part;
    }).join('');

    if (_.isFunction(this[method])) {
        this[method].apply(this, _.rest(arguments));
    }
    if (_.isFunction(this.trigger)) {
        // this.trigger(...arguments)
        this.trigger.apply(this, _.toArray(arguments));
    }
    return this;
};

},{}],11:[function(require,module,exports){
'use strict';

var utils = require('./mixin/utils');
var eventbus = require('./mixin/eventbus');

var DbbModel = Backbone.Model.extend({
  constructor: function DbbModel(options) {
    if (!(this instanceof DbbModel)) return new DbbModel(options);

    // 调用父类构造函数
    // 顺序不能变，否则在继承DbbView的子类中，initialize会早于constructor执行，
    // 导致this.options的值是undefined
    Backbone.Model.call(this, options);
  },

  $broadcast: eventbus.broacast,
  $listenToBus: eventbus.listenToBus,

  $callHook: utils.callHook,

  // 可覆盖，视图数据优先读取改属性，
  // 其次才是读取 .toJSON() 的数据
  // 这样就可以在共享 model 的多个 view 中
  // 统一输出一些个性化定制的数据
  $toDataForView: function $toDataForView() {
    return this.toJSON();
  }
});

module.exports = DbbModel;

},{"./mixin/eventbus":8,"./mixin/utils":10}],12:[function(require,module,exports){
'use strict';

var utils = require('./mixin/utils');
var lifeCircle = require('./mixin/life-circle');
var Events = require('./events');
var eventbus = require('./mixin/eventbus');
var DbbModel = require('./model');

// DbbObject 对象基类，控制器等由此派生
function DbbObject() {
    this.__isRetained__ = 1;
}

// 定义原型方法
_.extend(DbbObject.prototype, Events, {
    $isRetained: lifeCircle.isRetained,
    $isDealloc: lifeCircle.isDealloc,
    $callHook: utils.callHook,
    $broadcast: eventbus.broacast,
    $listenToBus: eventbus.listenToBus,
    $dealloc: function $dealloc() {
        if (!this.$isRetained()) return this;

        delete this.__isRetained__;
        this.stopListening();
        this.$callHook('didDealloc');
        this.off();
        _.each(_.keys(this), function (prop) {
            delete this[prop];
        }, this);
        return this;
    }
});

// 可以基于 DbbObject 派生出子类
DbbObject.extend = DbbModel.extend;

module.exports = DbbObject;

},{"./events":7,"./mixin/eventbus":8,"./mixin/life-circle":9,"./mixin/utils":10,"./model":11}],13:[function(require,module,exports){
'use strict';

var utils = require('./mixin/utils');
var lifeCircle = require('./mixin/life-circle');
var eventbus = require('./mixin/eventbus');
var binder = require('./binder');

// 有效的 view fields
var viewFields = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

// 有效的 view options
var viewOptions = ['supportLifeCycle', 'mountPointSelector', 'shouldPropagateViewWillMount', 'shouldPropagateViewDidMount', 'shouldPropagateViewWillUnmount', 'shouldPropagateViewDidUnmount', 'shouldDelegateEvents', 'transition', 'shouldPreventDealloc'];

var viewKeywords = viewFields.concat(viewOptions);

function isElMounted(el) {
    return $.contains(document.documentElement, el instanceof $ ? el[0] : el);
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
    this.listenTo(subview, 'all', delegateEventsCB);
    return this;
}
function delegateEventsCB(name) {
    var args = ['subview.' + name].concat(_.rest(arguments));
    this.trigger.apply(this, args);
}
function unDelegateEvents(subview) {
    this.stopListening(subview);
    return this;
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
var DbbView = Backbone.View.extend({
    constructor: function DbbView(options) {
        if (!(this instanceof DbbView)) return new DbbView(options);

        // view生存中，不可回收
        this.__isRetained__ = 1;

        // 视图options数据
        this.options = _.extend({}, this.__defaultOptions__, // 默认配置
        _.pick(this.options || {}, viewOptions), // extend 出子类的时候，可以直接通过 options 字段配置
        _.pick(options, viewOptions) // 实例化的时候传入的数据中提取 options 部分
        );

        // options 及默认fields 以外的数据，合并入view
        _.extend(this, _.omit(options, viewKeywords));

        // 判断构造的时候是否传入了一个已经挂在在 DOM 上的 el
        // 如果是，触发相关生命周期钩子
        var el = _.result(options, 'el');
        var isMounted = el && isElMounted(el);
        if (isMounted) {
            var _$getOption = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillMount']),
                supportLifeCycle = _$getOption.supportLifeCycle,
                shouldPropagateViewWillMount = _$getOption.shouldPropagateViewWillMount;

            if (supportLifeCycle) this.$callHook('viewWillMount', this);
            if (shouldPropagateViewWillMount) this.$propagateLifeCycleHook('viewWillMount');
        }

        // 调用父类构造函数
        // 顺序不能变，否则在继承DbbView的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options);

        if (isMounted) {
            var _$getOption2 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewDidMount']),
                _supportLifeCycle = _$getOption2.supportLifeCycle,
                shouldPropagateViewDidMount = _$getOption2.shouldPropagateViewDidMount;

            if (_supportLifeCycle) this.$callHook('viewDidMount', this);
            if (shouldPropagateViewDidMount) this.$propagateLifeCycleHook('viewDidMount');
        }
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
    initialize: function initialize(options) {
        if (this.bindings) this.$render();
    },


    $broadcast: eventbus.broacast,
    $listenToBus: eventbus.listenToBus,

    $callHook: utils.callHook,

    $isRetained: lifeCircle.isRetained,
    $isDealloc: lifeCircle.isDealloc,

    $getOption: function $getOption(options, fields) {
        if (!fields) return;
        options = _.extend({}, this.options, options || {});
        if (typeof fields === 'string') return _.result(options, fields);
        return _.pick(options, fields);
    },


    /**
     * @method View#$dealloc
     * @description
     * 视图销毁
     */
    $dealloc: function $dealloc(options) {
        var _this = this;

        if (this.$isDealloc()) return this;

        var supportLifeCycle = this.$getOption(options, 'supportLifeCycle');

        if (supportLifeCycle) this.$callHook('viewWillDealloc', this);

        // 递归子视图的清理
        var count = this.$count();
        if (this.$isNotEmpty()) while (count--) {
            this.__subviews__[count].$dealloc();
        }delete this.__isRetained__;

        // 若模型用this.model.on('change', doSomething, this)绑定的，需要
        // this.model.off(null, null, this)这样解绑，以免model的其他事件也被解除
        // 同理还有collection
        // 所以用listenTo绑定比较容易做$dealloc
        this.remove(); // 移除view以及从DOM中移除el,并自动调用stopListening以移除通过listenTo绑定的事件。

        // 必须放在off前，off会一并移除通过listenTo监听此事件的其他对象的相应事件
        // a.listenTo(b,...),
        // a.stopListening 相当于 b.off(null,null,a)
        // b.off()相当于a.stopListening
        if (supportLifeCycle) this.$callHook('viewDidDealloc', this);

        this.off(); // 移除用this.on绑定的事件

        // 清空属性
        _.each(_.keys(this), function (prop) {
            if (prop !== 'cid') delete _this[prop];
        }, this);

        return this;
    },


    // 绑定数据、视图，自动将模型变化反映到视图。对于表单控件，双向绑定
    // 必须在 $render 之后才可使用
    $bind: function $bind(model, bindings) {
        model = model || this.model;
        bindings = bindings || _.result(this, 'bindings');
        if (!model || !bindings) return this;
        binder.bind(this, model, bindings);
        return this;
    },


    // 取消数据、视图绑定
    $unbind: function $unbind(model, records) {
        model = model || this.model;
        records = records || this.__bindingRecords__;
        if (!model || !records) return this;
        binder.unbind(this, model, records);
        return this;
    },


    /**
     * 手动同步一次 model & UI 的数据
     * 可以让 binding 立即生效
     * 如，在 $render 之后调用 $render().$syncBindingData()，可以立即将 model 的数据作用到 UI上，
     * 若 $syncBindingData(true)，则从 UI 读取数据，作用到 model 上
     * @param {*} isToModel 是否从视图同步向 model
     */
    $syncBindingData: function $syncBindingData(isToModel) {
        binder.syncData(this, isToModel);
        return this;
    },


    /**
     * @method View#$render
     * @description
     * 模板渲染
     */
    $render: function $render(model, options) {
        model = model || this.model || {};
        var supportLifeCycle = this.$getOption(options, 'supportLifeCycle');

        // 已经挂载，说明这次$render是refresh
        var isRefresh = this.$isMounted();

        if (supportLifeCycle) {
            this.$callHook('viewWillRender', this);
            if (isRefresh) this.$callHook('viewWillRefresh', this);
        }

        var template = _.result(this, '$templateForView');

        // $render开始，如果存在模板，则渲染相关html
        if (_.isFunction(template)) {
            var $childrenFragment = void 0;

            // 把subview.el 暂移到 fragment 里，以便后续重新渲染当前视图后append回来
            if (this.$isNotEmpty()) {
                $childrenFragment = $(document.createDocumentFragment());
                this.$eachSubview(function (view) {
                    return $childrenFragment.append(view.$el);
                });
            }

            // 使用数据渲染模板，并刷新dom
            var data = this.$dataForView(model);

            this.$el.html(template(data));

            this.__$mountPoint__ = _.result(this, '$mountPointForSubview', this.$el).eq(0); // 刷新/设置挂载点

            // 将子View 的el 插回来
            if ($childrenFragment) this.__$mountPoint__.append($childrenFragment);
        } else {
            this.__$mountPoint__ = _.result(this, '$mountPointForSubview', this.$el).eq(0); // 设置挂载点
        }

        if (supportLifeCycle) {
            this.$callHook('viewDidRender', this);
            if (isRefresh) this.$callHook('viewDidRefresh', this);
        }

        // 标记当前view rendered
        this.$setRendered();

        // 绑定 view、model
        if (this.bindings && this.model) this.$unbind().$bind();

        return this;
    },


    /**
     * @method View#$dataForView
     * @description 视图渲染所需的数据
     * 可 override
     */
    $dataForView: function $dataForView(model) {
        return _.result(model, '$toDataForView', _.result(model, 'toJSON', Object(model)));
    },


    // 可override，返回模板渲染函数
    $templateForView: function $templateForView() {
        if (this.__templateFunctionCache__) {
            return this.__templateFunctionCache__;
        } else {
            var template = this.options.template || this.template;
            if (typeof template === 'string') template = _.template(template);
            if (_.isFunction(template)) {
                this.__templateFunctionCache__ = template;
                return template;
            }
        }
    },


    // 可override，如何获取子view的el挂载dom容器
    $mountPointForSubview: function $mountPointForSubview(options) {
        var $mountPoint = this.$(this.$getOption(options, 'mountPointSelector'));
        if ($mountPoint.length) return $mountPoint;
        return this.$el;
    },


    // 检查视图是否挂载到文档
    $isMounted: function $isMounted() {
        return isElMounted(this.el);
    },


    // 确认视图的模板是否渲染
    $isRendered: function $isRendered() {
        return this.__isRendered__;
    },


    // 标记视图已经渲染过
    $setRendered: function $setRendered() {
        this.__isRendered__ = true;
        return this;
    },


    /**
     * @method View#$mountToEl
     * @description
     * 将视图挂载到某个El上
     */
    $mountToEl: function $mountToEl($el, options) {
        // 'DbbView (cid: "' + this.cid + '") has already been destroyed and cannot be used.'
        if (this.$isDealloc()) return this;
        if (this.$isMounted()) return this;

        if (!($el instanceof $)) $el = $($el);

        // the mountPoint is unmounted.
        if (!isElMounted($el.get(0))) return this;

        var _$getOption3 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillMount', 'shouldPropagateViewDidMount', 'transition']),
            supportLifeCycle = _$getOption3.supportLifeCycle,
            shouldPropagateViewWillMount = _$getOption3.shouldPropagateViewWillMount,
            shouldPropagateViewDidMount = _$getOption3.shouldPropagateViewDidMount,
            transition = _$getOption3.transition;

        if (!this.$isRendered()) this.$render();

        if (supportLifeCycle) this.$callHook('viewWillMount', this);

        if (shouldPropagateViewWillMount) this.$propagateLifeCycleHook('viewWillMount');

        // transition 开始状态
        if (_.isFunction(transition.viewWillMount)) transition.viewWillMount(this.$el);

        $el.eq(0).append(this.$el);

        // transition 开始结束
        if (_.isFunction(transition.viewDidMount)) {
            // 强制reflow，让transition动画生效
            // this.el.offsetHeight
            transition.viewDidMount(this.$el);
        }

        if (supportLifeCycle) this.$callHook('viewDidMount', this);

        if (shouldPropagateViewDidMount) this.$propagateLifeCycleHook('viewDidMount');

        return this;
    },
    $unmount: function $unmount(options) {
        if (this.$isDealloc()) return this;
        if (!this.$isMounted()) return this;

        var _$getOption4 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillUnmount', 'shouldPropagateViewDidUnmount', 'transition']),
            supportLifeCycle = _$getOption4.supportLifeCycle,
            shouldPropagateViewWillUnmount = _$getOption4.shouldPropagateViewWillUnmount,
            shouldPropagateViewDidUnmount = _$getOption4.shouldPropagateViewDidUnmount,
            transition = _$getOption4.transition;

        if (supportLifeCycle) this.$callHook('viewWillUnmount', this);
        if (shouldPropagateViewWillUnmount) this.$propagateLifeCycleHook('viewWillUnmount');

        // transition 开始状态
        if (_.isFunction(options.transition.viewWillUnmount)) transition.viewWillUnmount(this.$el);

        this.$el.detach();

        // transition 结束
        if (_.isFunction(transition.viewDidUnmount)) {
            // 强制reflow，让transition动画生效
            // this.el.offsetHeight
            transition.viewDidUnmount(this.$el);
        }

        if (supportLifeCycle) this.$callHook('viewDidUnmount', this);
        if (shouldPropagateViewDidUnmount) this.$propagateLifeCycleHook('viewDidUnmount');

        return this;
    },


    /**
     * @method View#$addSubview
     * @param {DbbView} subview
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
    $addSubview: function $addSubview(views, options) {
        var _this2 = this;

        if (!options) options = {};

        // console.log('addSubview')
        var viewsCount = void 0;
        // views 参数接受一个单独的视图，或一个视图数组，需要分别处理
        // 1. 过滤掉无效的视图
        // 2. 如果是一个单独的视图，也转换成只有一个元素的数组统一处理
        if (_.isArray(views)) {
            views = _.filter(views, function (view) {
                return view instanceof DbbView && view.$isRetained() && !_this2.$hasSubview(view);
            }, this);

            if (!(viewsCount = views.length)) return this;
        } else {
            if (!(views && views instanceof DbbView && views.$isRetained() && !this.$hasSubview(views))) return this;

            views = [views];
            viewsCount = 1;
        }

        // 处理参数：处理options

        var _$getOption5 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillMount', 'shouldPropagateViewDidMount', 'shouldDelegateEvents', 'transition', 'atIndex']),
            supportLifeCycle = _$getOption5.supportLifeCycle,
            shouldPropagateViewWillMount = _$getOption5.shouldPropagateViewWillMount,
            shouldPropagateViewDidMount = _$getOption5.shouldPropagateViewDidMount,
            shouldDelegateEvents = _$getOption5.shouldDelegateEvents,
            transition = _$getOption5.transition,
            atIndex = _$getOption5.atIndex;

        // 局部变量缓存


        var subviews = this.__subviews__ || (this.__subviews__ = []);
        var subviewsCount = subviews.length;
        var $frag = $(document.createDocumentFragment());

        // 确定插入点
        // 字符串的情况，非'first'的全重置为'last'。
        if (typeof atIndex === 'string') {
            atIndex = atIndex === 'first' ? 0 : 'last';
        } else if (typeof atIndex === 'number') {
            // 数字的情况，非合法index重置为'last'
            if (atIndex < 0 || atIndex >= subviewsCount) atIndex = 'last';
        } else {
            // 任何其他值都是非法的，全部重置为'last'
            atIndex = 'last';
        }
        options.atIndex = atIndex;

        if (supportLifeCycle) this.$callHook('subviewWillAdd', views, this, options);

        // 代理子视图事件
        var i = void 0;
        if (shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) {
                delegateEvents.call(this, views[i]);
            }
        }

        // 渲染好superview模板，待subview的DOM插入
        if (!this.$isRendered()) this.$render();

        // 渲染好subview的模板，待插入
        var current = void 0;
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            if (!current.$isRendered()) current.$render();
            $frag.append(current.$el);
        }

        // 如果当前view已经mounted，向所有子类传播viewWillMount
        var isMounted = this.$isMounted();
        if (isMounted) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                if (current.options.supportLifeCycle) current.$callHook('viewWillMount', current);
                if (shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewWillMount');
            }
        }

        // transition 开始状态
        if (_.isFunction(transition.subviewWillAdd)) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                transition.subviewWillAdd(current.$el);
            }
        }

        // 先挂载DOM，再插入视图，以免插入的视图影响index，导致插入位置错误
        if (atIndex === 'last') {
            this.__$mountPoint__.append($frag);
            this.__subviews__ = subviews.concat(views);
        } else {
            subviews[atIndex].$el.before($frag);
            // this.__$mountPoint__.insertBefore(frag, subviews[atIndex].el)            
            this.__subviews__ = subviews.slice(0, atIndex).concat(views).concat(subviews.slice(atIndex));
        }

        // transition 结束状态
        if (_.isFunction(transition.subviewDidAdd)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight;
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                transition.subviewDidAdd(current.$el);
            }
        }

        // 插入的subview 全部附加上__superview__的属性
        for (i = 0; i < viewsCount; i += 1) {
            current = views[i];
            current.__superview__ = this;
        }

        // 如subview已经mounted，向所有子类传播viewDidMount
        if (isMounted) {
            for (i = 0; i < viewsCount; i += 1) {
                current = views[i];
                if (current.options.supportLifeCycle) current.$callHook('viewDidMount', current);
                if (shouldPropagateViewWillMount) current.$propagateLifeCycleHook('viewDidMount');
            }
        }

        if (supportLifeCycle) this.$callHook('subviewDidAdd', views, this, options);

        return this;
    },


    /**
     * @method View#$removeSubview
     * @param {DbbView | Number | String} view // subview or index number or 'first', 'last'
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
    $removeSubview: function $removeSubview(view, options) {
        if (!options) options = {};

        // console.log('removeSubview')
        if (!this.$isNotEmpty()) return this;
        if (view === undefined) return this;

        var _$getOption6 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillUnMount', 'shouldPropagateViewDidUnMount', 'shouldPreventDealloc', 'transition']),
            supportLifeCycle = _$getOption6.supportLifeCycle,
            shouldPropagateViewWillUnMount = _$getOption6.shouldPropagateViewWillUnMount,
            shouldPropagateViewDidUnMount = _$getOption6.shouldPropagateViewDidUnMount,
            shouldPreventDealloc = _$getOption6.shouldPreventDealloc,
            transition = _$getOption6.transition;

        var subviews = this.__subviews__;

        // 确定atIndex的值
        var atIndex = void 0;
        if (view instanceof DbbView) {
            atIndex = this.$indexOfSubview(view);
        } else {
            if (typeof view === 'number') {
                atIndex = view < 0 || view >= this.$count() ? -1 : view;
            } else if (view === 'first') {
                atIndex = 0;
            } else if (view === 'last') {
                atIndex = this.$count() - 1;
            } else {
                atIndex = -1;
            }
            view = null;
        }

        if (atIndex === -1) return this;

        if (view === null) view = subviews[atIndex];

        // 即将移除的subview及index附加到options里，传递给事件处理器
        options.view = view;
        options.atIndex = atIndex;

        if (supportLifeCycle) this.$callHook('subviewWillRemove', view, this, options);

        subviews.splice(atIndex, 1);
        delete view.__superview__;

        // 移除对subview的事件代理
        unDelegateEvents.call(this, view);

        // 如果当前subview已经mounted，向所有子类传播viewWillUnmount
        if (view.$isMounted()) {
            if (view.options.supportLifeCycle) view.$callHook('viewWillUnmount', view);
            if (shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewWillUnmount');
        }

        // transition 开始状态
        if (_.isFunction(transition.subviewWillRemove)) {
            transition.subviewWillRemove(view.$el);
        }

        // transition 结束状态
        if (_.isFunction(transition.subviewDidRemove)) {
            // 强制reflow，让transition动画生效
            this.el.offsetHeight;
            transition.subviewDidRemove(view.$el, function () {
                // transition end

                view.$el.detach();
                // this.__$mountPoint__.removeChild(view.el)

                // 如果当前subview已经unmounted，向所有子类传播viewDidUnmount
                if (!view.$isMounted()) {
                    if (view.options.supportLifeCycle) view.$callHook('viewDidUnmount', view);

                    if (shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewDidUnmount');
                }

                if (supportLifeCycle) this.$callHook('subviewDidRemove', view, this, options);

                if (!shouldPreventDealloc) view.$dealloc();
            }.bind(this));
        } else {
            view.$el.detach();
            // this.__$mountPoint__.removeChild(view.el)

            // 如果当前subview已经unmounted，向所有子类传播viewDidUnmount
            if (!view.$isMounted()) {
                if (view.options.supportLifeCycle) view.$callHook('viewDidUnmount', view);
                if (shouldPropagateViewWillUnMount) view.$propagateLifeCycleHook('viewDidUnmount');
            }

            if (supportLifeCycle) this.$callHook('subviewDidRemove', view, this, options);

            if (!shouldPreventDealloc) view.$dealloc();
        }

        return this;
    },
    $count: function $count() {
        return _.size(this.__subviews__);
    },
    $isEmpty: function $isEmpty() {
        return !this.$count();
    },
    $isNotEmpty: function $isNotEmpty() {
        return !!this.$count();
    },
    $hasSubview: function $hasSubview(subview) {
        return subview.__superview__ && subview.__superview__ === this;
    },
    $eachSubview: function $eachSubview(iteratee, context) {
        if (this.$isEmpty()) return;
        var i = void 0;
        if (!context) {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                iteratee(this.__subviews__[i], i, this.__subviews__);
            }
        } else {
            // length 需要动态读取，避免遍历过程length变化
            for (i = 0; i < this.__subviews__.length; i += 1) {
                iteratee.call(context, this.__subviews__[i], i, this.__subviews__);
            }
        }
    },


    // 查询视图在子视图中的index
    $indexOfSubview: function $indexOfSubview(subview, isSort) {
        return _.indexOf(this.__subviews__, subview, isSort);
    },
    $indexInSuperview: function $indexInSuperview(isSort) {
        if (!this.__superview__) return -1;
        return this.__superview__.$indexOfSubview(this, isSort);
    },
    $getSubviews: function $getSubviews() {
        if (this.$isEmpty()) return null;
        return this.__subviews__;
    },
    $getSubviewAt: function $getSubviewAt(index) {
        if (this.$isEmpty()) return null;
        return this.__subviews__[index] || null;
    },
    $getSupperview: function $getSupperview() {
        return this.__superview__ || null;
    },
    $getFirstSubview: function $getFirstSubview() {
        return this.$getSubviewAt(0);
    },
    $getLastSubview: function $getLastSubview() {
        return this.$getSubviewAt(this.$count() - 1);
    },
    $getNextSibling: function $getNextSibling() {
        var superview, idx;

        if (superview = this.$getSupperview()) {
            idx = superview.$indexOfSubview(this);
            if (idx === superview.$count() - 1) return null;
            return superview.$getSubviewAt(idx + 1);
        }
        return null;
    },
    $getPrevSibling: function $getPrevSibling() {
        var superview, idx;

        if (superview = this.$getSupperview()) {
            idx = superview.$indexOfSubview(this);
            if (idx === 0) return null;
            return superview.$getSubviewAt(idx - 1);
        }
        return null;
    },
    $emptySubviews: function $emptySubviews(options) {
        var display;

        if (this.$isEmpty()) return this;

        display = this.__$mountPoint__.hide();
        while (this.__subviews__.length) {
            this.$removeSubview(0, options);
        }this.__subviews__.length = 0;
        this.__$mountPoint__.show();

        return this;
    },
    $sortSubviews: function $sortSubviews(comparator) {
        var $fragment, $mountPoint, display;

        if (this.$isEmpty() || !_.isFunction(comparator)) return this;

        this.$getSubviews().sort(comparator); // 先排序

        // 执行变更
        $fragment = $(document.createDocumentFragment());
        $mountPoint = this.__$mountPoint__;
        $mountPoint.hide();
        this.$eachSubview(function (subview) {
            return $fragment.append(subview.$el);
        });
        $mountPoint.show();
        $mountPoint.append($fragment);

        return this;
    },


    // 向内传播事件
    $propagate: function $propagate(name, options) {
        options = _.extend(options || {}, { currentTarget: this }); // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this; // target 为传播起点

        this.$callHook(name, options);
        this.$eachSubview(function (subview) {
            subview.$propagate(name, options);
        });

        return this;
    },


    // 向外冒泡事件
    $dispatch: function $dispatch(name, options) {
        options = _.extend(options || {}, { currentTarget: this }); // currentTarget 为当前view
        if (!_.has(options, 'target')) options.target = this; // target 为冒泡起点

        this.$callHook(name, options);
        if (this.__superview__) this.__superview__.$dispatch(name, options);

        return this;
    },
    $propagateLifeCycleHook: function $propagateLifeCycleHook(method) {
        _.each(this.__subviews__, function (subview) {
            subview.$callHook(method, subview);
            subview.$propagateLifeCycleHook(method);
        });
    }
});

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
}, function (viewMethod, _method) {
    DbbView.prototype[viewMethod] = function () {
        var args = _.toArray(arguments);
        args.unshift(this.__subviews__ || []);
        return _[_method].apply(_, args);
    };
});

// 扩展 extend 方法
var extend = DbbView.extend = function (protoProps, staticProps) {
    var Parent = this;

    var DbbView;
    if (protoProps && _.has(protoProps, 'constructor')) {
        DbbView = protoProps.constructor;
    } else {
        DbbView = function DbbView() {
            return Parent.apply(this, arguments);
        };
    }

    // Dbb 额外扩展功能 ----
    if (protoProps) {
        // 合并 events
        if (protoProps.shouldMergeEvents) {
            protoProps.events = _.extend({}, _.result(Parent.prototype, 'events'), _.result(protoProps, 'events'));
        }
        // 合并 initialize
        if (protoProps.shouldMergeInitialize) {
            var _init = protoProps.initialize;
            protoProps.initialize = function (options) {
                Parent.prototype.initialize.call(this, options);
                _init.call(this, options);
            };
        }
        protoProps = _.omit(protoProps, ['shouldMergeEvents', 'shouldMergeInitialize']);
    }
    // -------------------

    _.extend(DbbView, Parent, staticProps);
    DbbView.prototype = _.create(Parent.prototype, protoProps);
    DbbView.prototype.constructor = DbbView;
    DbbView.__super__ = Parent.prototype;
    return DbbView;
};

module.exports = DbbView;

},{"./binder":5,"./mixin/eventbus":8,"./mixin/life-circle":9,"./mixin/utils":10}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9jb2xsZWN0aW9uLXZpZXcuanMiLCJsaWIvY29uZmlnL2luZGV4LmpzIiwibGliL2NvcmUvYmluZGVyL2JpbmRpbmctcmVjb3JkLmpzIiwibGliL2NvcmUvYmluZGVyL2luZGV4LmpzIiwibGliL2NvcmUvY29sbGVjdGlvbi5qcyIsImxpYi9jb3JlL2V2ZW50cy5qcyIsImxpYi9jb3JlL21peGluL2V2ZW50YnVzLmpzIiwibGliL2NvcmUvbWl4aW4vbGlmZS1jaXJjbGUuanMiLCJsaWIvY29yZS9taXhpbi91dGlscy5qcyIsImxpYi9jb3JlL21vZGVsLmpzIiwibGliL2NvcmUvb2JqZWN0LmpzIiwibGliL2NvcmUvdmlldy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQUVBOztBQUNBLFFBQVEsY0FBUjs7QUFFQSxJQUFNLFNBQVMsUUFBUSxtQkFBUixDQUFmO0FBQ0EsSUFBTSxXQUFXLFFBQVEsMkJBQVIsQ0FBakI7QUFDQSxJQUFNLE1BQU0sRUFBWjs7QUFFQSxJQUFJLFVBQUosR0FBcUIsU0FBUyxRQUE5QjtBQUNBLElBQUksWUFBSixHQUFxQixTQUFTLFdBQTlCO0FBQ0EsSUFBSSxDQUFKLEdBQXFCLFNBQVMsQ0FBOUI7QUFDQSxJQUFJLE1BQUosR0FBcUIsTUFBckI7QUFDQSxJQUFJLE1BQUosR0FBcUIsUUFBUSxtQkFBUixDQUFyQjtBQUNBLElBQUksVUFBSixHQUFxQixRQUFRLHVCQUFSLENBQXJCO0FBQ0EsSUFBSSxLQUFKLEdBQXFCLFFBQVEsa0JBQVIsQ0FBckI7QUFDQSxJQUFJLElBQUosR0FBcUIsUUFBUSxpQkFBUixDQUFyQjtBQUNBLElBQUksY0FBSixHQUFxQixRQUFRLHVCQUFSLENBQXJCOztBQUVBLE9BQU8sT0FBUCxHQUFpQixPQUFPLEdBQVAsR0FBYSxHQUE5Qjs7O0FDbkJBOztBQUVBLElB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LEVBQUUsTUFBRixDQUFTLEVBQVQsRUFDaEIsRUFBRSxNQUFGLENBQVMsT0FBTyxTQUFoQixFQUEyQixRQUEzQixDQURnQixFQUVoQixFQUFFLE1BQUYsQ0FBUyxVQUFULEVBQXFCLFFBQXJCLENBRmdCLENBQXBCO0FBSUg7QUFDRDtBQUNBLFlBQUksV0FBVyxxQkFBZixFQUFzQztBQUNsQyxnQkFBSSxRQUFRLFdBQVcsVUFBdkI7QUFDQSx1QkFBVyxVQUFYLEdBQXdCLFVBQVMsT0FBVCxFQUFrQjtBQUN0Qyx1QkFBTyxTQUFQLENBQWlCLFVBQWpCLENBQTRCLElBQTVCLENBQWlDLElBQWpDLEVBQXVDLE9BQXZDO0FBQ0Esc0JBQU0sSUFBTixDQUFXLElBQVgsRUFBaUIsT0FBakI7QUFDSCxhQUhEO0FBSUg7QUFDRCxxQkFBYSxFQUFFLElBQUYsQ0FBTyxVQUFQLEVBQW1CLENBQUMsbUJBQUQsRUFBc0IsdUJBQXRCLENBQW5CLENBQWI7QUFDSDtBQUNEOztBQUVBLE1BQUUsTUFBRixDQUFTLE9BQVQsRUFBa0IsTUFBbEIsRUFBMEIsV0FBMUI7QUFDQSxZQUFRLFNBQVIsR0FBb0IsRUFBRSxNQUFGLENBQVMsT0FBTyxTQUFoQixFQUEyQixVQUEzQixDQUFwQjtBQUNBLFlBQVEsU0FBUixDQUFrQixXQUFsQixHQUFnQyxPQUFoQztBQUNBLFlBQVEsU0FBUixHQUFvQixPQUFPLFNBQTNCO0FBQ0EsV0FBTyxPQUFQO0FBQ0gsQ0F2Q0Q7O0FBMENBLE9BQU8sT0FBUCxHQUFpQixPQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcblxuLy8g5a+85YWl6YWN572uXG5yZXF1aXJlKCcuL2xpYi9jb25maWcnKVxuXG5jb25zdCBFdmVudHMgPSByZXF1aXJlKCcuL2xpYi9jb3JlL2V2ZW50cycpXG5jb25zdCBldmVudGJ1cyA9IHJlcXVpcmUoJy4vbGliL2NvcmUvbWl4aW4vZXZlbnRidXMnKVxuY29uc3QgRGJiID0ge31cblxuRGJiLiRicm9hZGNhc3QgICAgID0gZXZlbnRidXMuYnJvYWNhc3RcbkRiYi4kbGlzdGVuVG9CdXMgICA9IGV2ZW50YnVzLmxpc3RlblRvQnVzXG5EYmIuJCAgICAgICAgICAgICAgPSBCYWNrYm9uZS4kXG5EYmIuRXZlbnRzICAgICAgICAgPSBFdmVudHNcbkRiYi5PYmplY3QgICAgICAgICA9IHJlcXVpcmUoJy4vbGliL2NvcmUvb2JqZWN0JylcbkRiYi5Db2xsZWN0aW9uICAgICA9IHJlcXVpcmUoJy4vbGliL2NvcmUvY29sbGVjdGlvbicpXG5EYmIuTW9kZWwgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYi9jb3JlL21vZGVsJylcbkRiYi5WaWV3ICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGliL2NvcmUvdmlldycpXG5EYmIuQ29sbGVjdGlvblZpZXcgPSByZXF1aXJlKCcuL2xpYi9jb2xsZWN0aW9uLXZpZXcnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdpbmRvdy5EYmIgPSBEYmJcbiIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBEYmJWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL3ZpZXcnKVxuXG5jb25zdCBhZGRUcmFuc2l0aW9uID0ge1xuICAgIHN1YnZpZXdXaWxsQWRkKCRlbCkge1xuICAgICAgICAkZWwuY3NzKCd0cmFuc2l0aW9uJywnJylcbiAgICAgICAgJGVsLmNzcygnb3BhY2l0eScsIDApXG4gICAgfSxcbiAgICBzdWJ2aWV3RGlkQWRkKCRlbCkge1xuICAgICAgICAkZWwuY3NzKCd0cmFuc2l0aW9uJywgJ29wYWNpdHkgLjJzJylcbiAgICAgICAgJGVsLmNzcygnb3BhY2l0eScsIDEpXG4gICAgfVxufVxuY29uc3QgYWRkVHJhbnNpdGlvbkFuZFNvcnQgPSB7XG4gICAgc3Vidmlld1dpbGxBZGQoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCcnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMClcbiAgICB9LFxuICAgIHN1YnZpZXdEaWRBZGQoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCAnb3BhY2l0eSAuMnMnKVxuICAgIH1cbn1cbmNvbnN0IHJlbW92ZVRyYW5zaXRpb24gPSB7XG4gICAgc3Vidmlld1dpbGxSZW1vdmUoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCcnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMSlcbiAgICB9LFxuICAgIHN1YnZpZXdEaWRSZW1vdmUoJGVsLCBkb25lKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCAnb3BhY2l0eSAuMnMnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMClcbiAgICAgICAgc2V0VGltZW91dChkb25lLCAyMDApXG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGFwcGVuZFBsYWNlaG9sZGVyKCkge1xuICAgIGxldCBwbGFjZWhvbGRlciA9IF8ucmVzdWx0KHRoaXMsICdwbGFjZWhvbGRlcicpXG4gICAgaWYgKHBsYWNlaG9sZGVyKSB7XG4gICAgICAgIGxldCAkbW91bnRQb2ludCA9IF8ucmVzdWx0KHRoaXMsICckbW91bnRQb2ludEZvclN1YnZpZXcnKVxuICAgICAgICBpZiAoISRtb3VudFBvaW50LmZpbmQocGxhY2Vob2xkZXIpLmxlbmd0aCkge1xuICAgICAgICAgICAgJG1vdW50UG9pbnQuYXBwZW5kKHBsYWNlaG9sZGVyKVxuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gcmVtb3ZlUGxhY2Vob2xkZXIoKSB7XG4gICAgbGV0IHBsYWNlaG9sZGVyID0gXy5yZXN1bHQodGhpcywgJ3BsYWNlaG9sZGVyJylcbiAgICBpZiAocGxhY2Vob2xkZXIpIHtcbiAgICAgICAgbGV0ICRtb3VudFBvaW50ID0gXy5yZXN1bHQodGhpcywgJyRtb3VudFBvaW50Rm9yU3VidmlldycpXG4gICAgICAgIGlmICgkbW91bnRQb2ludC5maW5kKHBsYWNlaG9sZGVyKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIChwbGFjZWhvbGRlciBpbnN0YW5jZW9mICQpID8gcGxhY2Vob2xkZXIuZGV0YWNoKCkgOiAkKHBsYWNlaG9sZGVyKS5kZXRhY2goKVxuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gdXBkYXRlUGxhY2Vob2xkZXIoKSB7XG4gICAgaWYgKHRoaXMuJGNvdW50KCkpIHJlbW92ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcbiAgICBlbHNlIGFwcGVuZFBsYWNlaG9sZGVyLmNhbGwodGhpcylcbn1cblxuXG5mdW5jdGlvbiBvbkl0ZW1BZGRlZChtb2RlbCwgY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgbGV0IHZpZXcgPSB0aGlzLiR2aWV3Rm9ySXRlbShtb2RlbCwgY29sbGVjdGlvbikuJHJlbmRlcigpXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX2FkZFRpbWVyKVxuICAgIGlmICghdGhpcy5fYnVmZmVyKSB0aGlzLl9idWZmZXIgPSBbXVxuICAgIHRoaXMuX2J1ZmZlci5wdXNoKHZpZXcpXG4gICAgdGhpcy5fYWRkVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2FkZCB0aW1lb3V0JylcbiAgICAgICAgLy8g5L+u5aSNYWRk5pe277yM5LiN5Lya6YeN5paw5o6S5bqPXG4gICAgICAgIC8vIOehruS/neWmguaenOayoeacieS8oOWFpXNvcnQ6ZmFsc2XnmoRvcHRpb24sIOaJjemHjeaWsOaOkuW6j1xuICAgICAgICAvLyDmjpLluo/liqjnlLvvvIzot59hZGTliqjnlLvlj6rkuIDkuKrnlJ/mlYhcbiAgICAgICAgaWYgKG9wdGlvbnMuc29ydCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuJGFkZFN1YnZpZXcodGhpcy5fYnVmZmVyLCB7XG4gICAgICAgICAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogYWRkVHJhbnNpdGlvbkFuZFNvcnRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBvbkl0ZW1zU29ydGVkLmNhbGwodGhpcywgdGhpcy5jb2xsZWN0aW9uLCB7fSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuJGFkZFN1YnZpZXcodGhpcy5fYnVmZmVyLCB7XG4gICAgICAgICAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogYWRkVHJhbnNpdGlvblxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIFxuICAgICAgICB0aGlzLl9idWZmZXIubGVuZ3RoID0gMFxuICAgICAgICB0aGlzLnRyaWdnZXIoJ2l0ZW1EaWRBZGQnKVxuXG4gICAgfSwgMClcblxuICAgIHVwZGF0ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcblxuICAgIHJldHVybiB0aGlzXG59XG5cblxuZnVuY3Rpb24gb25JdGVtUmVtb3ZlZChtb2RlbCwgY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuJHJlbW92ZVN1YnZpZXcob3B0aW9ucy5pbmRleCwge1xuICAgICAgICB0cmFuc2l0aW9uOiByZW1vdmVUcmFuc2l0aW9uXG4gICAgfSlcbiAgICB0aGlzLnRyaWdnZXIoJ2l0ZW1EaWRSZW1vdmUnKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuXG5mdW5jdGlvbiBvbkl0ZW1zUmVzZXQoY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIHVwZGF0ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcbiAgICBcbiAgICB0aGlzLiRlbXB0eVN1YnZpZXdzKClcblxuICAgIGxldCB2aWV3cyA9IFtdXG4gICAgY29sbGVjdGlvbi5lYWNoKGZ1bmN0aW9uKG1vZGVsLCBpLCBjb2xsZWN0aW9uKXtcbiAgICAgICAgdmlld3MucHVzaCh0aGlzLiR2aWV3Rm9ySXRlbShtb2RlbCwgY29sbGVjdGlvbikpXG4gICAgfSwgdGhpcylcblxuICAgIHRoaXMuJGFkZFN1YnZpZXcodmlld3MsIHtcbiAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgIHRyYW5zaXRpb246IGFkZFRyYW5zaXRpb25cbiAgICB9KVxuXG4gICAgdGhpcy50cmlnZ2VyKCdpdGVtRGlkUmVzZXQnKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuZnVuY3Rpb24gb25JdGVtc1NvcnRlZChjb2xsZWN0aW9uLCBvcHRpb25zKSB7XG4gICAgaWYgKCF0aGlzLiRpc05vdEVtcHR5KCkpIHJldHVybiB0aGlzXG5cbiAgICBsZXQgc2VsZiA9IHRoaXNcbiAgICAvLyBhZGTnlKjkuoblrprml7blmajvvIxzb3J05Lya5Y+R55Sf5ZyoYWRk5YmN77yMc3Vidmlld+eahOaVsOmHj+S8muavlG1vZGVs5bCR77yM5omA5Lul6KaB5aSE55CG5LiLXG4gICAgdGhpcy5fc29ydFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdzb3J0IHRpbWVvdXQnKVxuICAgICAgICB2YXIgc3Vidmlld3MsICRtb3VudFBvaW50LCBkaXNwbGF5LCAkZnJhZ21lbnRcbiAgICAgICAgbGV0IHRlbXBBcnJcbiAgICAgICAgbGV0IGxlbiA9IHNlbGYuJGNvdW50KClcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24ubGVuZ3RoID09PSBsZW4pIHtcbiAgICAgICAgICAgIHN1YnZpZXdzID0gc2VsZi4kZ2V0U3Vidmlld3MoKVxuICAgICAgICAgICAgdGVtcEFyciA9IG5ldyBBcnJheShsZW4pXG5cbiAgICAgICAgICAgIC8vIOWFiOaOkuW6j1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IGNvbGxlY3Rpb24uaW5kZXhPZihzdWJ2aWV3c1tpXS5tb2RlbClcbiAgICAgICAgICAgICAgICB0ZW1wQXJyW2luZGV4XSA9IHN1YnZpZXdzW2ldXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOaJp+ihjOWPmOabtFxuICAgICAgICAgICAgc2VsZi5fX3N1YnZpZXdzX18gPSB0ZW1wQXJyXG4gICAgICAgICAgICAkbW91bnRQb2ludCA9IF8ucmVzdWx0KHNlbGYsICckbW91bnRQb2ludEZvclN1YnZpZXcnLCBzZWxmLiRlbClcbiAgICAgICAgICAgICRmcmFnbWVudCA9ICQoZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpKVxuICAgICAgICAgICAgc2VsZi4kZWFjaFN1YnZpZXcoZnVuY3Rpb24odmlldyl7XG4gICAgICAgICAgICAgICAgJGZyYWdtZW50LmFwcGVuZCh2aWV3LiRlbClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAkbW91bnRQb2ludC5hcHBlbmQoJGZyYWdtZW50KVxuXG4gICAgICAgICAgICAvLyBmb3JjZSByZWZsb3dcbiAgICAgICAgICAgICRtb3VudFBvaW50LmdldCgwKS5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIC8vIHRyYW5zaXRpb25cbiAgICAgICAgICAgIHNlbGYuJGVhY2hTdWJ2aWV3KGZ1bmN0aW9uKHZpZXcpe1xuICAgICAgICAgICAgICAgIHZpZXcuJGVsLmNzcygnb3BhY2l0eScsIDEpXG4gICAgICAgICAgICAgICAgLy8gdmlldy5lbC5zdHlsZS5vcGFjaXR5ID0gMVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdpdGVtRGlkU29ydCcpXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9uSXRlbXNTb3J0ZWQuY2FsbChzZWxmLCBjb2xsZWN0aW9uLCBvcHRpb25zKVxuXG4gICAgICAgIH1cbiAgICB9LCAwKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuXG5jb25zdCBEYmJDb2xsZWN0aW9uVmlldyA9IERiYlZpZXcuZXh0ZW5kKHtcbiAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gRGJiQ29sbGVjdGlvblZpZXcob3B0aW9ucykge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGJiQ29sbGVjdGlvblZpZXcpKSByZXR1cm4gbmV3IERiYkNvbGxlY3Rpb25WaWV3KG9wdGlvbnMpXG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbikgdGhpcy4kc2V0Q29sbGVjdGlvbihvcHRpb25zLmNvbGxlY3Rpb24pXG4gICAgICAgIERiYlZpZXcuY2FsbCh0aGlzLCBvcHRpb25zKVxuICAgIH0sXG5cbiAgICAkc2V0Q29sbGVjdGlvbihjb2xsZWN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbGxlY3Rpb24pIHRoaXMuc3RvcExpc3RlbmluZyh0aGlzLmNvbGxlY3Rpb24pXG4gICAgICAgIHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb25cbiAgICAgICAgdGhpcy5saXN0ZW5Ubyhjb2xsZWN0aW9uLCAnYWRkJywgb25JdGVtQWRkZWQpXG4gICAgICAgIHRoaXMubGlzdGVuVG8oY29sbGVjdGlvbiwgJ3JlbW92ZScsIG9uSXRlbVJlbW92ZWQpXG4gICAgICAgIHRoaXMubGlzdGVuVG8oY29sbGVjdGlvbiwgJ3Jlc2V0Jywgb25JdGVtc1Jlc2V0KVxuICAgICAgICB0aGlzLmxpc3RlblRvKGNvbGxlY3Rpb24sICdzb3J0Jywgb25JdGVtc1NvcnRlZClcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgLy8gb3ZlcnJpZGVcbiAgICAkdmlld0Zvckl0ZW0obW9kZWwsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYmJWaWV3KHsgbW9kZWwgfSlcbiAgICB9LFxuXG4gICAgJHJlbmRlckl0ZW1zKCkge1xuICAgICAgICB0aGlzLiR1cGRhdGVQbGFjZWhvbGRlci5jYWxsKHRoaXMpXG5cbiAgICAgICAgLy8gY29sbGVjdGlvbiDmnInljp/lp4vmlbDmja7vvIzliJnmuLLmn5NcbiAgICAgICAgaWYgKHRoaXMuY29sbGVjdGlvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuJGVtcHR5U3Vidmlld3MoKVxuXG4gICAgICAgICAgICB2YXIgdmlld3MgPSBbXVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uLmVhY2goZnVuY3Rpb24obW9kZWwsIGksIGNvbGxlY3Rpb24pe1xuICAgICAgICAgICAgICAgIHZpZXdzLnB1c2godGhpcy4kdmlld0Zvckl0ZW0obW9kZWwsIGNvbGxlY3Rpb24pKVxuICAgICAgICAgICAgfSwgdGhpcylcblxuICAgICAgICAgICAgdGhpcy4kYWRkU3Vidmlldyh2aWV3cywge1xuICAgICAgICAgICAgICAgIHNob3VsZERlbGVnYXRlRXZlbnRzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb246IGFkZFRyYW5zaXRpb25cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHVwZGF0ZVBsYWNlaG9sZGVyKCkge1xuICAgICAgICB1cGRhdGVQbGFjZWhvbGRlci5jYWxsKHRoaXMpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfVxufSlcblxubW9kdWxlLmV4cG9ydHMgPSBEYmJDb2xsZWN0aW9uVmlld1xuIiwiXG4vLyB1bmRlcnNjb3JlIHRlbXBsYXRlIHNldHRpbmdzXG4vLyBfLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG4vLyAgICAgZXZhbHVhdGU6IC9cXHtcXCUoLis/KVxcJVxcfS9nLFxuLy8gICAgIGludGVycG9sYXRlOiAvXFx7XFx7KC4rPylcXH1cXH0vZyxcbi8vICAgICBlc2NhcGU6IC9cXHtcXHstKC4rPylcXH1cXH0vZ1xuLy8gfVxuICBcbiIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBCdWlsZEluVUlBY2Nlc3NvciA9IHtcbiAgdmFsdWU6IHtcbiAgICBnZXQoJGVsLCBmaWVsZCwgZGF0YUtleSkgeyByZXR1cm4gJGVsLnZhbCgpIH0sXG4gICAgc2V0KCRlbCwgZmllbGQsIHZhbHVlLCBkYXRhS2V5KSB7XG4gICAgICBpZiAoJGVsLnZhbCgpICE9PSB2YWx1ZSkge1xuICAgICAgICAkZWwudmFsKHZhbHVlKVxuICAgICAgICAkZWwudHJpZ2dlcignY2hhbmdlJylcbiAgICAgIH0gXG4gICAgfVxuICB9LFxuICBjaGVja2VkOiB7XG4gICAgZ2V0KCRlbCwgZmllbGQsIGRhdGFLZXkpIHsgcmV0dXJuICRlbC5wcm9wKCdjaGVja2VkJykgfSxcbiAgICBzZXQoJGVsLCBmaWVsZCwgdmFsdWUsIGRhdGFLZXkpIHtcbiAgICAgIGlmICgkZWwucHJvcCgnY2hlY2tlZCcpICE9PSB2YWx1ZSkge1xuICAgICAgICAkZWwucHJvcCgnY2hlY2tlZCcsIHZhbHVlKVxuICAgICAgICAkZWwudHJpZ2dlcignY2hhbmdlJylcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIHNlbGVjdGVkOiB7XG4gICAgZ2V0KCRlbCwgZmllbGQsIGRhdGFLZXkpIHtcbiAgICAgIHJldHVybiBfLmZpbmQoJGVsLmZpbmQoJ29wdGlvbicpLCBvcHRpb249Pm9wdGlvbi5zZWxlY3RlZD09PXRydWUpLnZhbHVlXG4gICAgfSxcbiAgICBzZXQoJGVsLCBmaWVsZCwgdmFsdWUsIGRhdGFLZXkpIHtcbiAgICAgIGxldCBvcHRpb24gPSBfLmZpbmQoJGVsLmZpbmQoJ29wdGlvbicpLG9wdGlvbj0+b3B0aW9uLnZhbHVlPT09dmFsdWUpXG4gICAgICBpZiAob3B0aW9uICYmICghb3B0aW9uLnNlbGVjdGVkKSkge1xuICAgICAgICBvcHRpb24uc2VsZWN0ZWQgPSB0cnVlXG4gICAgICAgICRlbC50cmlnZ2VyKCdjaGFuZ2UnKVxuICAgICAgfSBcbiAgICB9XG4gIH0sXG4gIG9wdGlvbjoge1xuICAgIGdldCgkZWwsIGZpZWxkLCBkYXRhS2V5KSB7XG4gICAgICByZXR1cm4gXy5maW5kKCRlbC5maW5kKCdvcHRpb24nKSwgb3B0aW9uPT5vcHRpb24uc2VsZWN0ZWQ9PT10cnVlKS5pbm5lckhUTUxcbiAgICB9LFxuICAgIHNldCgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSkge1xuICAgICAgbGV0IG9wdGlvbiA9IF8uZmluZCgkZWwuZmluZCgnb3B0aW9uJyksb3B0aW9uPT5vcHRpb24uaW5uZXJIVE1MPT09dmFsdWUpXG4gICAgICBpZiAob3B0aW9uICYmICghb3B0aW9uLnNlbGVjdGVkKSkge1xuICAgICAgICBvcHRpb24uc2VsZWN0ZWQgPSB0cnVlXG4gICAgICAgICRlbC50cmlnZ2VyKCdjaGFuZ2UnKVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgcmFkaW86IHtcbiAgICBnZXQoJGVsLCBmaWVsZCwgZGF0YUtleSkgeyByZXR1cm4gXy5maW5kKCRlbCwgZWw9PmVsLmNoZWNrZWQ9PT10cnVlKS52YWx1ZSB9LFxuICAgIHNldCgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSkge1xuICAgICAgbGV0IHJhZGlvID0gXy5maW5kKCRlbCwgcmFkaW89PnJhZGlvLnZhbHVlPT09dmFsdWUpXG4gICAgICBpZiAocmFkaW8gJiYgKCFyYWRpby5jaGVja2VkKSkge1xuICAgICAgICByYWRpby5jaGVja2VkID0gdHJ1ZVxuICAgICAgICAkKHJhZGlvKS50cmlnZ2VyKCdjaGFuZ2UnKVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgdGV4dDoge1xuICAgIGdldCgkZWwsIGZpZWxkLCBkYXRhS2V5KSB7IHJldHVybiAkZWwuaHRtbCgpIH0sXG4gICAgc2V0KCRlbCwgZmllbGQsIHZhbHVlLCBkYXRhS2V5KSB7XG4gICAgICAoJGVsLmh0bWwoKSAhPT0gdmFsdWUpICYmICRlbC5odG1sKHZhbHVlKVxuICAgIH1cbiAgfSxcbiAgcHJvcDoge1xuICAgIGdldCgkZWwsIGZpZWxkLCBkYXRhS2V5KSB7IHJldHVybiAkZWwucHJvcChmaWVsZCkgfSxcbiAgICBzZXQoJGVsLCBmaWVsZCwgdmFsdWUsIGRhdGFLZXkpIHtcbiAgICAgICgkZWwucHJvcChmaWVsZCkgIT09IHZhbHVlKSAmJiAkZWwucHJvcChmaWVsZCwgdmFsdWUpXG4gICAgfVxuICB9LFxuICBkYXRhOiB7XG4gICAgZ2V0KCRlbCwgZmllbGQsIGRhdGFLZXkpIHsgcmV0dXJuICRlbC5kYXRhKGZpZWxkKSB9LFxuICAgIHNldCgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSkge1xuICAgICAgKCRlbC5kYXRhKGZpZWxkKSAhPT0gdmFsdWUpICYmICRlbC5kYXRhKGZpZWxkLCB2YWx1ZSlcbiAgICB9XG4gIH0sXG4gIGF0dHI6IHtcbiAgICBnZXQoJGVsLCBmaWVsZCwgZGF0YUtleSkgeyByZXR1cm4gJGVsLmF0dHIoZmllbGQpIH0sXG4gICAgc2V0KCRlbCwgZmllbGQsIHZhbHVlLCBkYXRhS2V5KSB7IFxuICAgICAgKCRlbC5hdHRyKGZpZWxkKSAhPT0gdmFsdWUpICYmICRlbC5hdHRyKGZpZWxkLCB2YWx1ZSlcbiAgICB9XG4gIH1cbn1cblxuXG5jb25zdCBEYmJPYmplY3QgPSByZXF1aXJlKCcuLi9vYmplY3QnKVxuY29uc3QgQmluZGluZ1JlY29yZCA9IERiYk9iamVjdC5leHRlbmQoe1xuICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiBCaW5kaW5nUmVjb3JkKHZpZXcsIG1vZGVsLCBkYXRhKSB7XG4gICAgICBEYmJPYmplY3QuY2FsbCh0aGlzKVxuICAgICAgbGV0IG9wdGlvbnMgPSB7IHZpZXcsIG1vZGVsLCBkYXRhIH1cbiAgICAgIF8uZXh0ZW5kKHRoaXMsIG9wdGlvbnMpXG4gICAgICBfLmlzRnVuY3Rpb24odGhpcy5pbml0aWFsaXplKSAmJiB0aGlzLmluaXRpYWxpemUoKVxuICAgIH0sXG5cbiAgICAkZGVhbGxvYygpIHtcbiAgICAgIHRoaXMudW5iaW5kKClcbiAgICAgIERiYk9iamVjdC5wcm90b3R5cGUuJGRlYWxsb2MuY2FsbCh0aGlzKVxuICAgIH0sXG5cbiAgICBnZXQoa2V5LCBkZWZhdWx0cykge1xuICAgICAgcmV0dXJuIF8ucmVzdWx0KHRoaXMuZGF0YSwga2V5LCBkZWZhdWx0cylcbiAgICB9LFxuXG4gICAgc2V0KGtleSwgdmFsKSB7XG4gICAgICBsZXQgYmVmb3JlID0ge31cbiAgICAgIGxldCBjaGFuZ2VkID0ge31cblxuICAgICAgbGV0IHByZXYgPSB0aGlzLmdldChrZXkpXG4gICAgICBpZiAoKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBrZXkgPT09ICdudW1iZXInKSAmJiBwcmV2ICE9PSB2YWwpIHtcbiAgICAgICAgYmVmb3JlW2tleV0gPSBwcmV2XG4gICAgICAgIGNoYW5nZWRba2V5XSA9IHZhbFxuICAgICAgICB0aGlzLmRhdGFba2V5XSA9IHZhbFxuICAgICAgICB0aGlzLnRyaWdnZXIoYGNoYW5nZToke2tleX1gLCB0aGlzLCB2YWwsIHsgcHJldiB9KVxuICBcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgXy5lYWNoKGtleSwgKHZhbCwga2V5KSA9PiB7XG4gICAgICAgICAgbGV0IHByZXYgPSB0aGlzLmdldChrZXkpXG4gICAgICAgICAgaWYgKHByZXYgIT09IHZhbCkge1xuICAgICAgICAgICAgYmVmb3JlW2tleV0gPSBwcmV2XG4gICAgICAgICAgICBjaGFuZ2VkW2tleV0gPSB2YWxcbiAgICAgICAgICAgIHRoaXMuZGF0YVtrZXldID0gdmFsXG4gICAgICAgICAgICB0aGlzLnRyaWdnZXIoYGNoYW5nZToke2tleX1gLCB0aGlzLCB2YWwsIHsgcHJldiB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgdGhpcy50cmlnZ2VyKGBjaGFuZ2VgLCB0aGlzLCBjaGFuZ2VkLCBiZWZvcmUpXG5cbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuICAgIHNlbGVjdG9yKCkge1xuICAgICAgbGV0IHNlbGVjdG9yID0gdGhpcy5nZXQoJ3NlbGVjdG9yJylcbiAgICAgIGlmIChzZWxlY3RvcikgcmV0dXJuIHNlbGVjdG9yXG5cbiAgICAgIC8vIOWIhumalOespiB8ICxcbiAgICAgIC8vIGB2YWx1ZSBAIC5hYnNkZltuYW1lPVwiYWJjXCJdIC5pbnB1dCBgID0+IGAuYWJzZGZbbmFtZT1cImFiY1wiXSAuaW5wdXRgXG4gICAgICBzZWxlY3RvciA9ICQudHJpbSh0aGlzLmdldCgndGFyZ2V0SW5mbycpLnJlcGxhY2UoLyheKFxccyspP1xcUysoXFxzKyk/QCkoXFxzKyk/LywgJycpKVxuICAgICAgaWYgKHNlbGVjdG9yKSB0aGlzLnNldCgnc2VsZWN0b3InLCBzZWxlY3RvcilcbiAgICAgIHJldHVybiBzZWxlY3RvclxuICAgIH0sXG5cbiAgICAkZWwoKSB7XG4gICAgICBsZXQgc2VsZWN0b3IgPSB0aGlzLnNlbGVjdG9yKClcbiAgICAgIHJldHVybiAoc2VsZWN0b3IgPT09ICckZWwnKSA/IHRoaXMudmlldy4kZWwgOiB0aGlzLnZpZXcuJChzZWxlY3RvcilcbiAgICB9LFxuXG4gICAgdGFnTmFtZSgpIHtcbiAgICAgIGxldCB0YWdOYW1lID0gdGhpcy5nZXQoJ3RhZ05hbWUnKVxuICAgICAgaWYgKHRhZ05hbWUpIHJldHVybiB0YWdOYW1lXG4gICAgICBsZXQgZWwgPSB0aGlzLiRlbCgpLmdldCgwKVxuICAgICAgdGFnTmFtZSA9IGVsICYmIGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKVxuICAgICAgaWYgKHRhZ05hbWUpIHRoaXMuc2V0KCd0YWdOYW1lJywgdGFnTmFtZSlcbiAgICAgIHJldHVybiB0YWdOYW1lXG4gICAgfSxcblxuICAgIC8vIOS7jiBgdHlwZUBzZWxlY3RvcmAg5Lit5o+Q5Y+WIGB0eXBlYCDpg6jliIZcbiAgICBfcGlja191cGRhdGVfa2V5KCkge1xuICAgICAgbGV0IHR5cGUgPSB0aGlzLmdldCgndGFyZ2V0SW5mbycpLm1hdGNoKC9cXFMrKFxccyspP0AvKVxuICAgICAgaWYgKCF0eXBlKSByZXR1cm4gJydcbiAgICAgIHJldHVybiAkLnRyaW0odHlwZVswXS5yZXBsYWNlKCdAJywnJykpXG4gICAgfSxcbiAgICAvLyBVSSDmm7TmlrDnmoTmlrnlvI9cbiAgICB1aV91cGRhdGVfaW5mbygpIHtcbiAgICAgIGxldCBjYWNoZSA9IHRoaXMuZ2V0KCd1aV91cGRhdGVfaW5mbycpXG4gICAgICBpZiAoY2FjaGUpIHJldHVybiBjYWNoZVxuXG4gICAgICBsZXQgJGVsID0gdGhpcy4kZWwoKVxuICAgICAgbGV0IHRhZ05hbWUgPSB0aGlzLnRhZ05hbWUoKVxuXG4gICAgICBsZXQgaG9zdCA9ICdidWlsZGluJyAvLyBPUiB2aWV3XG4gICAgICBsZXQga2V5ID0gdGhpcy5fcGlja191cGRhdGVfa2V5KClcbiAgICAgIGxldCBmaWVsZCA9IGtleVxuICAgICAgbGV0IGdldFxuICAgICAgbGV0IHNldFxuXG4gICAgICBpZiAoa2V5LnN1YnN0cigwLDUpID09PSAndmlldy4nKSB7XG4gICAgICAgIGhvc3QgPSAndmlldycsXG4gICAgICAgIGZpZWxkID0ga2V5LnNsaWNlKDUpXG4gICAgICB9XG5cbiAgICAgIGlmIChrZXkuc3Vic3RyKDAsNSkgPT09ICdkYXRhLScpIHtcbiAgICAgICAgZmllbGQgPSBrZXkuc2xpY2UoNSlcbiAgICAgICAgZ2V0ID0gJ2RhdGEnXG4gICAgICAgIHNldCA9ICdkYXRhJ1xuICAgICAgfVxuICBcbiAgICAgIGVsc2UgaWYgKHRhZ05hbWUgPT09ICdpbnB1dCcpIHtcbiAgICAgICAgaWYgKCFrZXkgfHwgaG9zdCA9PT0gJ3ZpZXcnKSB7XG4gICAgICAgICAgXG4gICAgICAgICAgbGV0IHR5cGUgPSAkZWwuYXR0cigndHlwZScpIC8vICcnfHVuZGVmaW5lZHxvdGhlciAtPiAndmFsdWUnICAgICAgICAgIFxuICAgICAgICAgIGdldCA9IHNldCA9ICgodHlwZSAhPT0gJ2NoZWNrYm94JyAmJiB0eXBlICE9PSAncmFkaW8nKSA/ICd2YWx1ZScgOiB0eXBlKVxuICAgIFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGdldCA9IHNldCA9IChrZXkgPT09ICd2YWx1ZScgPyAndmFsdWUnIDogJ2F0dHInKVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHRleHRhcmVhXG4gICAgICBpZiAodGFnTmFtZSA9PT0gJ3RleHRhcmVhJyAmJiAhZ2V0ICYmICFzZXQpIHtcbiAgICAgICAgZ2V0ID0gc2V0ID0gJ3ZhbHVlJ1xuICAgICAgfVxuXG4gICAgICAvLyBvcHRpb27vvJrmoLnmja5vcHRpb27mloflrZfmm7TmlrDvvIxzZWxlY3RlZDog5qC55o2ub3B0aW9u55qEdmFsdWXmm7TmlrBcbiAgICAgIGlmICh0YWdOYW1lID09PSAnc2VsZWN0JyAmJiAhZ2V0ICYmICFzZXQpIHtcbiAgICAgICAgZ2V0ID0gc2V0ID0gKCBrZXkgPT09ICdvcHRpb24nID8gJ29wdGlvbicgOiAnc2VsZWN0ZWQnIClcbiAgICAgIH1cblxuICAgICAgLy8g5YWc5bqV6K6+572uXG4gICAgICBpZiAoIWdldCAmJiAhc2V0KSB7XG4gICAgICAgIGdldCA9IHNldCA9ICgoa2V5ICYmIGtleSAhPT0gJ3RleHQnKSA/ICdhdHRyJyA6ICd0ZXh0JylcbiAgICAgIH0gXG5cbiAgICAgIGxldCBpbmZvID0geyBob3N0LCBmaWVsZCwgZ2V0LCBzZXQgfVxuXG4gICAgICAvLyBzZXQgY2FjaGVcbiAgICAgIHRoaXMuc2V0KCd1aV91cGRhdGVfaW5mbycsIGluZm8pXG4gICAgICByZXR1cm4gaW5mb1xuICAgIH0sXG5cbiAgICAvLyBVSSBnZXR0ZXIsIHNldHRlclxuICAgIEJ1aWxkSW5VSUFjY2Vzc29yLFxuXG4gICAgdXBkYXRlVUkodmFsdWUpIHtcbiAgICAgIGxldCAkZWwgPSB0aGlzLiRlbCgpXG4gICAgICBpZiAoJGVsLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG4gICAgICBsZXQgaW5mbyA9IHRoaXMudWlfdXBkYXRlX2luZm8oKVxuICAgICAgbGV0IHVwZGF0ZXJcbiAgICAgIGxldCBzZXR0ZXJcblxuICAgICAgLy8g5L2/55SoIHZpZXcg5Lit5a6a5LmJ55qE5a2Y5Y+W5ZmoXG4gICAgICAvLyB2aWV3IOS4re+8jHVwZGF0ZXLoh6rouqvlj6/ku6XmmK8gZ2V0dGVyJnNldHRlcu+8iOmcgOimgeagueaNruS8oOWFpeWPguaVsOiHquihjOWIpOaWre+8iVxuICAgICAgLy8g5Lmf5Y+v5Lul5piv5LiA5Liq5a+56LGh77yM5YaF6YOo5YyF5ZCrIGdldCZzZXTmlrnms5VcbiAgICAgIGlmIChpbmZvLmhvc3QgPT09ICd2aWV3Jykge1xuICAgICAgICB1cGRhdGVyID0gdGhpcy52aWV3W2luZm8uZmllbGRdXG4gICAgICAgIGlmICh1cGRhdGVyICYmIHVwZGF0ZXIuc2V0KSBzZXR0ZXIgPSB1cGRhdGVyLnNldFxuICAgICAgICBlbHNlIGlmIChfLmlzRnVuY3Rpb24odXBkYXRlcikpIHNldHRlciA9IHVwZGF0ZXJcbiAgICAgIH1cblxuICAgICAgLy8g5YaF572u55qEIFVJIOWtmOWPluWZqFxuICAgICAgaWYgKCF1cGRhdGVyIHx8ICFzZXR0ZXIpIHtcbiAgICAgICAgdXBkYXRlciA9IHRoaXMuQnVpbGRJblVJQWNjZXNzb3JbaW5mby5zZXRdXG4gICAgICAgIHNldHRlciA9IHVwZGF0ZXIuc2V0XG4gICAgICB9XG4gICAgICBzZXR0ZXIuY2FsbCh0aGlzLnZpZXcsICRlbCwgaW5mby5maWVsZCwgdmFsdWUsIHRoaXMuZ2V0KCdkYXRhS2V5JykpXG4gICAgICAvLyBjb25zb2xlLmxvZygnVUkgZGlkIHVwZGF0ZScsIHZhbHVlLCBpbmZvKVxuICAgIH0sXG5cbiAgICAvLyDmm7TmlrDmqKHlnotcbiAgICB1cGRhdGVNb2RlbChjaGFuZ2VkVmFsdWUpIHtcbiAgICAgIC8vIOaJp+ihjOabtOaWsFxuICAgICAgaWYgKHRoaXMuZ2V0KCdkYXRhS2V5Jykuc3Vic3RyKDAsIDUpID09PSAnbW9kZWwuJykge1xuICAgICAgICBsZXQgbWV0aG9kTmFtZSA9IHRoaXMuZ2V0KCdkYXRhS2V5Jykuc2xpY2UoNSlcbiAgICAgICAgXy5pc0Z1bmN0aW9uKHRoaXMubW9kZWxbbWV0aG9kTmFtZV0pICYmIHRoaXMubW9kZWxbbWV0aG9kTmFtZV0oY2hhbmdlZFZhbHVlKVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubW9kZWwuc2V0KHRoaXMuZ2V0KCdkYXRhS2V5JyksIGNoYW5nZWRWYWx1ZSlcbiAgXG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZygnbW9kZWwgZGlkIHVwZGF0ZScpXG4gICAgfSxcblxuXG4gICAgZ2V0VUlWYWx1ZSgpIHtcbiAgICAgIGxldCAkZWwgPSB0aGlzLiRlbCgpXG4gICAgICBpZiAoJGVsLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgICAgIC8vIOebruagh+WFg+e0oOS4jeaYr+ihqOWNleS6pOS6kuWFg+e0oOeahOaXtuWAme+8jOi3s+i/h1xuICAgICAgLy8g5ZCm5YiZ5pyJ5YaF6YOo5pyJ6KGo5Y2V5YWD57Sg6Kem5Y+R5pu05paw77yM5Lmf5Lya6Kem5Y+RIG1vZGVsIOabtOaWsOWHuueOsGJ1Z1xuICAgICAgbGV0IHRhZ05hbWUgPSB0aGlzLnRhZ05hbWUoKVxuICAgICAgaWYgKHRhZ05hbWUgIT09ICdpbnB1dCcgJiYgdGFnTmFtZSAhPT0gJ3RleHRhcmVhJyAmJiB0YWdOYW1lICE9PSAnc2VsZWN0JykgcmV0dXJuXG5cbiAgICAgIGxldCBpbmZvID0gdGhpcy51aV91cGRhdGVfaW5mbygpXG4gICAgICBsZXQgdXBkYXRlclxuICAgICAgbGV0IGdldHRlclxuXG4gICAgICAvLyDkvb/nlKggdmlldyDkuK3lrprkuYnnmoTlrZjlj5blmahcbiAgICAgIC8vIHZpZXcg5Lit77yMdXBkYXRlcuiHqui6q+WPr+S7peaYryBnZXR0ZXImc2V0dGVy77yI6ZyA6KaB5qC55o2u5Lyg5YWl5Y+C5pWw6Ieq6KGM5Yik5pat77yJXG4gICAgICAvLyDkuZ/lj6/ku6XmmK/kuIDkuKrlr7nosaHvvIzlhoXpg6jljIXlkKsgZ2V0JnNldOaWueazlVxuICAgICAgaWYgKGluZm8uaG9zdCA9PT0gJ3ZpZXcnKSB7XG4gICAgICAgIHVwZGF0ZXIgPSB0aGlzLnZpZXdbaW5mby5maWVsZF1cbiAgICAgICAgaWYgKHVwZGF0ZXIgJiYgdXBkYXRlci5nZXQpIGdldHRlciA9IHVwZGF0ZXIuZ2V0XG4gICAgICAgIGVsc2UgaWYgKF8uaXNGdW5jdGlvbih1cGRhdGVyKSkgZ2V0dGVyID0gdXBkYXRlclxuICAgICAgfVxuXG4gICAgICAvLyDlhoXnva7nmoQgVUkg5a2Y5Y+W5ZmoXG4gICAgICBpZiAoIXVwZGF0ZXIgfHwgIWdldHRlcikge1xuICAgICAgICB1cGRhdGVyID0gdGhpcy5CdWlsZEluVUlBY2Nlc3NvcltpbmZvLmdldF1cbiAgICAgICAgZ2V0dGVyID0gdXBkYXRlci5nZXRcbiAgICAgIH1cblxuICAgICAgbGV0IHZhbHVlID0gZ2V0dGVyLmNhbGwodGhpcy52aWV3LCAkZWwsIGluZm8uZmllbGQsIHRoaXMuZ2V0KCdkYXRhS2V5JykpXG4gICAgICByZXR1cm4gdmFsdWVcbiAgICB9LFxuXG5cbiAgICAvLyBtb2RlbCDmm7TmlrDml7blgJnvvIzoh6rliqjmm7TmlrAgVUlcbiAgICBfVUlfdXBkYXRlcihtb2RlbCwgY2hhbmdlZFZhbHVlLCBvcHRpb25zKSB7XG4gICAgICB2YXIgJGVsID0gdGhpcy4kZWwoKVxuICAgICAgaWYgKCEkZWwubGVuZ3RoKSByZXR1cm5cbiAgXG4gICAgICB0aGlzLnVwZGF0ZVVJKGNoYW5nZWRWYWx1ZSlcbiAgICB9LFxuICBcblxuICAgIC8vIFVJIC0+IG1vZGVsXG4gICAgX21vZGVsX3VwZGF0ZXIoZSkge1xuICAgICAgLy8g55uu5qCH5YWD57Sg5LiN5piv6KGo5Y2V5Lqk5LqS5YWD57Sg55qE5pe25YCZ77yM6Lez6L+HXG4gICAgICBpZiAodGhpcy4kZWwoKS5sZW5ndGggPT09IDApIHJldHVyblxuICAgICAgbGV0IHRhZ05hbWUgPSB0aGlzLnRhZ05hbWUoKVxuICAgICAgaWYgKHRhZ05hbWUgIT09ICdpbnB1dCcgJiYgdGFnTmFtZSAhPT0gJ3RleHRhcmVhJyAmJiB0YWdOYW1lICE9PSAnc2VsZWN0JykgcmV0dXJuXG4gIFxuICAgICAgdmFyIGNoYW5nZWRWYWx1ZSA9IHRoaXMuZ2V0VUlWYWx1ZSgpXG4gICAgICB0aGlzLnVwZGF0ZU1vZGVsKGNoYW5nZWRWYWx1ZSlcbiAgICB9LFxuXG4gICAgc3luY0RhdGFUb1VJKCkge1xuICAgICAgbGV0IHZhbHVlID0gdGhpcy5tb2RlbC5nZXQodGhpcy5nZXQoJ2RhdGFLZXknKSlcbiAgICAgIHRoaXMudXBkYXRlVUkodmFsdWUpXG4gICAgfSxcblxuICAgIHN5bmNEYXRhVG9Nb2RlbCgpIHtcbiAgICAgIGxldCB2YWx1ZSA9IHRoaXMuZ2V0VUlWYWx1ZSgpXG4gICAgICB0aGlzLnVwZGF0ZU1vZGVsKHZhbHVlKVxuICAgIH0sXG5cbiAgICBpbml0aWFsaXplKCkge1xuICAgICAgdGhpcy5tb2RlbF91cGRhdGVyID0gdGhpcy5fbW9kZWxfdXBkYXRlci5iaW5kKHRoaXMpXG4gICAgICB0aGlzLlVJX3VwZGF0ZXIgPSB0aGlzLl9VSV91cGRhdGVyLmJpbmQodGhpcylcbiAgICB9LFxuXG4gICAgYmluZCgpIHtcbiAgICAgIC8vIOebkeWQrCBtb2RlbCDlj5jljJbvvIzmiafooYwgVUlfdXBkYXRlclxuICAgICAgdGhpcy52aWV3Lmxpc3RlblRvKHRoaXMubW9kZWwsICdjaGFuZ2U6JyArIHRoaXMuZ2V0KCdkYXRhS2V5JyksIHRoaXMuVUlfdXBkYXRlcilcblxuICAgICAgLy8g57uR5a6a5LqL5Lu277yM5rKh5pyJ5oyH5a6a5a2Q5YWD57Sg55qEIHNlbGVjdG9yIOaXtu+8jOS9nOeUqOWcqOinhuWbvueahOagueWFg+e0oOS4ilxuICAgICAgaWYgKHRoaXMuc2VsZWN0b3IoKSA9PT0gJyRlbCcpIHtcbiAgICAgICAgICB0aGlzLnZpZXcuJGVsLm9uKCdjaGFuZ2UnLCB0aGlzLm1vZGVsX3VwZGF0ZXIpXG5cbiAgICAgIC8vIOWQpuWImeS9v+eUqOS6i+S7tuS7o+eQhu+8jOS9nOeUqOWcqOaMh+WumiBzZWxlY3RvciDnmoTlrZDlhYPntKDkuIpcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy52aWV3LiRlbC5vbignY2hhbmdlJywgdGhpcy5zZWxlY3RvcigpLCB0aGlzLm1vZGVsX3VwZGF0ZXIpXG4gICAgICB9XG4gICAgfSxcblxuICAgIHVuYmluZCgpIHtcbiAgICAgIC8vIOebkeWQrCBtb2RlbCDlj5jljJbvvIzmiafooYwgVUlfdXBkYXRlclxuICAgICAgdGhpcy52aWV3LnN0b3BMaXN0ZW5pbmcodGhpcy5tb2RlbCwgJ2NoYW5nZTonICsgdGhpcy5nZXQoJ2RhdGFLZXknKSwgdGhpcy5VSV91cGRhdGVyKVxuICBcbiAgICAgIC8vIOe7keWumuS6i+S7tu+8jOayoeacieaMh+WumuWtkOWFg+e0oOeahCBzZWxlY3RvciDml7bvvIzkvZznlKjlnKjop4blm77nmoTmoLnlhYPntKDkuIpcbiAgICAgIGlmICh0aGlzLnNlbGVjdG9yKCkgPT09ICckZWwnKSB7XG4gICAgICAgICAgdGhpcy52aWV3LiRlbC5vZmYoJ2NoYW5nZScsIHRoaXMubW9kZWxfdXBkYXRlcilcblxuICAgICAgLy8g5ZCm5YiZ5L2/55So5LqL5Lu25Luj55CG77yM5L2c55So5Zyo5oyH5a6aIHNlbGVjdG9yIOeahOWtkOWFg+e0oOS4ilxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnZpZXcuJGVsLm9mZignY2hhbmdlJywgdGhpcy5zZWxlY3RvcigpLCB0aGlzLm1vZGVsX3VwZGF0ZXIpXG4gICAgICB9XG4gICAgfVxufSlcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEJpbmRpbmdSZWNvcmQiLCIndXNlIHN0cmljdCdcblxuY29uc3QgQmluZGluZ1JlY29yZCA9IHJlcXVpcmUoJy4vYmluZGluZy1yZWNvcmQnKVxuXG5mdW5jdGlvbiBwYXJzZUJpbmRpbmdzKHZpZXcsIG1vZGVsLCBiaW5kaW5ncykge1xuICAgIHZhciByZWNvcmRzID0gW11cbiAgICBfLmVhY2goYmluZGluZ3MsIGZ1bmN0aW9uIChkYXRhS2V5LCB0YXJnZXRJbmZvKSB7XG4gICAgICAgIGRhdGFLZXkgPSBkYXRhS2V5LnNwbGl0KCcsJylcbiAgICAgICAgdGFyZ2V0SW5mbyA9IHRhcmdldEluZm8uc3BsaXQoJywnKVxuICAgICAgICBfLmVhY2goZGF0YUtleSwgZGF0YUtleSA9PiB7XG4gICAgICAgICAgICBfLmVhY2godGFyZ2V0SW5mbywgdGFyZ2V0SW5mbyA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRJbmZvIHx8ICFkYXRhS2V5KSByZXR1cm5cbiAgICAgICAgICAgICAgICByZWNvcmRzLnB1c2gobmV3IEJpbmRpbmdSZWNvcmQodmlldywgbW9kZWwsIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0SW5mbzogdGFyZ2V0SW5mbyxcbiAgICAgICAgICAgICAgICAgICAgZGF0YUtleTogZGF0YUtleVxuICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICB9KVxuICAgIHJldHVybiByZWNvcmRzXG59XG5cblxuLy8geyAnLnNlbGVjdG9yJzogJ21vZGVsX2tleScgfVxuLy8gT1Jcbi8vIHsgJy5zZWxlY3Rvcnx0eXBlJzogJ21vZGVsX2tleScgfVxuLy8gdHlwZTog5pu05paw55qE5L2N572u77yM5bGe5oCn5ZCN44CBdGV4dChpbm5lckhUTUwp44CBY2hlY2tlZCDnrYnnrYlcbmZ1bmN0aW9uIGJpbmQodmlldywgbW9kZWwsIGJpbmRpbmdzKSB7XG4gICAgLy8g5rKh5pyJIHVuYmluZCDnmoTor53vvIzmr4/mrKEgYmluZO+8jOmDveS9v+eUqOi/veWKoOeahOaWueW8j1xuICAgIC8vIOW9k+asoSBiaW5kIOS9nOeUqOWcqOaWsOWinueahCBiaW5kaW5ncyDkuIpcbiAgICBpZiAoIV8uaXNBcnJheSh2aWV3Ll9fYmluZGluZ1JlY29yZHNfXykpIHZpZXcuX19iaW5kaW5nUmVjb3Jkc19fID0gW11cbiAgICB2YXIgbmV3UmVjb3JkcyA9IHBhcnNlQmluZGluZ3ModmlldywgbW9kZWwsIGJpbmRpbmdzKVxuICAgIHZpZXcuX19iaW5kaW5nUmVjb3Jkc19fID0gdmlldy5fX2JpbmRpbmdSZWNvcmRzX18uY29uY2F0KG5ld1JlY29yZHMpXG4gICAgXy5lYWNoKG5ld1JlY29yZHMsIGZ1bmN0aW9uIChyZWNvcmQpIHtcbiAgICAgICAgcmVjb3JkLmJpbmQoKVxuICAgIH0pXG59XG5cblxuZnVuY3Rpb24gdW5iaW5kKHZpZXcsIG1vZGVsLCByZWNvcmRzKSB7XG4gICAgLy8g5Y+v5Lul5oyH5a6a5p+Q5Lqb57uR5a6aIHJlY29yZHPvvIzkuI3mjIflrprvvIzliJnlpITnkIbmlbTkuKogdmlldyDnmoTmiYDmnInnu5HlrppcbiAgICByZWNvcmRzID0gcmVjb3JkcyB8fCB2aWV3Ll9fYmluZGluZ1JlY29yZHNfXyB8fCBbXVxuICAgIF8uZWFjaChyZWNvcmRzLCBmdW5jdGlvbiAocmVjb3JkKSB7XG4gICAgICAgIHJlY29yZC51bmJpbmQoKVxuICAgIH0pXG5cbiAgICB2YXIgbGVmdFJlY29yZHMgPSBfLnJlamVjdCh2aWV3Ll9fYmluZGluZ1JlY29yZHNfXywgZnVuY3Rpb24gKHJlY29yZCkge1xuICAgICAgICByZXR1cm4gXy5pbmNsdWRlcyhyZWNvcmRzLCByZWNvcmQpXG4gICAgfSlcbiAgICBpZiAobGVmdFJlY29yZHMubGVuZ3RoKSB2aWV3Ll9fYmluZGluZ1JlY29yZHNfXyA9IGxlZnRSZWNvcmRzXG4gICAgZWxzZSBkZWxldGUgdmlldy5fX2JpbmRpbmdSZWNvcmRzX19cbn1cblxuXG5mdW5jdGlvbiBzeW5jRGF0YSh2aWV3LCBpc1RvTW9kZWwpIHtcbiAgICBsZXQgcmVjb3JkcyA9IHZpZXcuX19iaW5kaW5nUmVjb3Jkc19fIHx8IFtdXG4gICAgXy5lYWNoKHJlY29yZHMsIGlzVG9Nb2RlbCA/IChyZWNvcmQpID0+IHJlY29yZC5zeW5jRGF0YVRvTW9kZWwoKSA6IChyZWNvcmQpID0+IHJlY29yZC5zeW5jRGF0YVRvVUkoKSlcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBiaW5kLFxuICAgIHVuYmluZCxcbiAgICBzeW5jRGF0YVxufSIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCB1dGlscyA9IHJlcXVpcmUoJy4vbWl4aW4vdXRpbHMnKVxuY29uc3QgZXZlbnRidXMgPSByZXF1aXJlKCcuL21peGluL2V2ZW50YnVzJylcblxuY29uc3QgRGJiQ29sbGVjdGlvbiA9IEJhY2tib25lLkNvbGxlY3Rpb24uZXh0ZW5kKHtcbiAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIERiYkNvbGxlY3Rpb24ob3B0aW9ucykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBEYmJDb2xsZWN0aW9uKSkgcmV0dXJuIG5ldyBEYmJDb2xsZWN0aW9uKG9wdGlvbnMpXG5cbiAgICAvLyDosIPnlKjniLbnsbvmnoTpgKDlh73mlbBcbiAgICAvLyDpobrluo/kuI3og73lj5jvvIzlkKbliJnlnKjnu6fmib9EYmJWaWV355qE5a2Q57G75Lit77yMaW5pdGlhbGl6ZeS8muaXqeS6jmNvbnN0cnVjdG9y5omn6KGM77yMXG4gICAgLy8g5a+86Ie0dGhpcy5vcHRpb25z55qE5YC85pivdW5kZWZpbmVkXG4gICAgQmFja2JvbmUuQ29sbGVjdGlvbi5jYWxsKHRoaXMsIG9wdGlvbnMpICAgIFxuICB9LFxuXG4gICRicm9hZGNhc3Q6IGV2ZW50YnVzLmJyb2FjYXN0LFxuICAkbGlzdGVuVG9CdXM6IGV2ZW50YnVzLmxpc3RlblRvQnVzLFxuXG4gICRjYWxsSG9vazogdXRpbHMuY2FsbEhvb2tcbn0pXG5cbm1vZHVsZS5leHBvcnRzID0gRGJiQ29sbGVjdGlvblxuIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50cyA9IEJhY2tib25lLkV2ZW50c1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50c1xuIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEV2ZW50cyA9IHJlcXVpcmUoJy4uL2V2ZW50cycpXG5jb25zdCBldmVudGJ1cyA9IF8uZXh0ZW5kKHt9LCBFdmVudHMpXG5cbmV4cG9ydHMuYnJvYWNhc3QgPSBmdW5jdGlvbiBicm9hY2FzdCgpIHtcbiAgZXZlbnRidXMudHJpZ2dlci5hcHBseShldmVudGJ1cywgXy50b0FycmF5KGFyZ3VtZW50cykpXG4gIHJldHVybiB0aGlzXG59XG5cbmV4cG9ydHMubGlzdGVuVG9CdXMgPSBmdW5jdGlvbiBsaXN0ZW5Ub0J1cyhuYW1lLCBjYWxsYmFjaykge1xuICB2YXIgY3R4ID0gXy5pc0Z1bmN0aW9uKHRoaXMubGlzdGVuVG8pID8gdGhpcyA6IGV2ZW50YnVzIFxuICBjdHgubGlzdGVuVG8oZXZlbnRidXMsIG5hbWUsIGNhbGxiYWNrKVxuICByZXR1cm4gdGhpc1xufSIsIid1c2Ugc3RyaWN0J1xuXG4vLyDmo4Dmn6Xlr7nosaHmmK/lkKbooqtyZXRhaW5lZO+8jOWNs+aYr+WQpuacquiiq+mUgOavgVxuLy8gMS4gaGFzIG93biBwcm9wZXJ0eSAnX19pc1JldGFpbmVkX18nID9cbi8vIDIuIF9faXNSZXRhaW5lZF9fID09IHRydWUgP1xuZXhwb3J0cy5pc1JldGFpbmVkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8uaGFzKHRoaXMsICdfX2lzUmV0YWluZWRfXycpICYmICEhdGhpcy5fX2lzUmV0YWluZWRfX1xufVxuXG5cbi8vIOajgOafpeWvueixoeaYr+WQpuW3sue7j+mUgOavgVxuZXhwb3J0cy5pc0RlYWxsb2MgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gIXRoaXMuX19pc1JldGFpbmVkX18gfHwgIV8uaGFzKHRoaXMsICdfX2lzUmV0YWluZWRfXycpXG59IiwiJ3VzZSBzdHJpY3QnXG5cbi8vIOiwg+eUqOmSqeWtkOWHveaVsOOAgeinpuWPkeWQjOWQjeS6i+S7tlxuZXhwb3J0cy5jYWxsSG9vayA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAvLyAnYWZ0ZXI6c2VuZCcgPT4gJ2FmdGVyU2VuZCdcbiAgICBsZXQgbWV0aG9kID0gXy5tYXAoXG4gICAgICAgIFN0cmluZyhuYW1lKS5zcGxpdCgnOicpLFxuICAgICAgICAocGFydCwgaW5kZXgpID0+IChpbmRleCA+IDApID8gcGFydC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHBhcnQuc2xpY2UoMSkgOiBwYXJ0XG4gICAgKS5qb2luKCcnKVxuXG4gICAgaWYgKF8uaXNGdW5jdGlvbih0aGlzW21ldGhvZF0pKSB7XG4gICAgICAgIHRoaXNbbWV0aG9kXS5hcHBseSh0aGlzLCBfLnJlc3QoYXJndW1lbnRzKSlcbiAgICB9IFxuICAgIGlmIChfLmlzRnVuY3Rpb24odGhpcy50cmlnZ2VyKSkge1xuICAgICAgICAvLyB0aGlzLnRyaWdnZXIoLi4uYXJndW1lbnRzKVxuICAgICAgICB0aGlzLnRyaWdnZXIuYXBwbHkodGhpcywgXy50b0FycmF5KGFyZ3VtZW50cykpXG4gICAgfVxuICAgIHJldHVybiB0aGlzXG59XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21peGluL3V0aWxzJylcbmNvbnN0IGV2ZW50YnVzID0gcmVxdWlyZSgnLi9taXhpbi9ldmVudGJ1cycpXG5cbmNvbnN0IERiYk1vZGVsID0gQmFja2JvbmUuTW9kZWwuZXh0ZW5kKHtcbiAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIERiYk1vZGVsKG9wdGlvbnMpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGJiTW9kZWwpKSByZXR1cm4gbmV3IERiYk1vZGVsKG9wdGlvbnMpXG5cbiAgICAvLyDosIPnlKjniLbnsbvmnoTpgKDlh73mlbBcbiAgICAvLyDpobrluo/kuI3og73lj5jvvIzlkKbliJnlnKjnu6fmib9EYmJWaWV355qE5a2Q57G75Lit77yMaW5pdGlhbGl6ZeS8muaXqeS6jmNvbnN0cnVjdG9y5omn6KGM77yMXG4gICAgLy8g5a+86Ie0dGhpcy5vcHRpb25z55qE5YC85pivdW5kZWZpbmVkXG4gICAgQmFja2JvbmUuTW9kZWwuY2FsbCh0aGlzLCBvcHRpb25zKSAgICBcbiAgfSxcblxuICAkYnJvYWRjYXN0OiBldmVudGJ1cy5icm9hY2FzdCxcbiAgJGxpc3RlblRvQnVzOiBldmVudGJ1cy5saXN0ZW5Ub0J1cyxcblxuICAkY2FsbEhvb2s6IHV0aWxzLmNhbGxIb29rLFxuXG4gIC8vIOWPr+imhueblu+8jOinhuWbvuaVsOaNruS8mOWFiOivu+WPluaUueWxnuaAp++8jFxuICAvLyDlhbbmrKHmiY3mmK/or7vlj5YgLnRvSlNPTigpIOeahOaVsOaNrlxuICAvLyDov5nmoLflsLHlj6/ku6XlnKjlhbHkuqsgbW9kZWwg55qE5aSa5LiqIHZpZXcg5LitXG4gIC8vIOe7n+S4gOi+k+WHuuS4gOS6m+S4quaAp+WMluWumuWItueahOaVsOaNrlxuICAkdG9EYXRhRm9yVmlldygpIHtcbiAgICByZXR1cm4gdGhpcy50b0pTT04oKVxuICB9XG59KVxuXG5tb2R1bGUuZXhwb3J0cyA9IERiYk1vZGVsXG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21peGluL3V0aWxzJylcbmNvbnN0IGxpZmVDaXJjbGUgPSByZXF1aXJlKCcuL21peGluL2xpZmUtY2lyY2xlJylcbmNvbnN0IEV2ZW50cyA9IHJlcXVpcmUoJy4vZXZlbnRzJylcbmNvbnN0IGV2ZW50YnVzID0gcmVxdWlyZSgnLi9taXhpbi9ldmVudGJ1cycpXG5jb25zdCBEYmJNb2RlbCA9IHJlcXVpcmUoJy4vbW9kZWwnKVxuXG4vLyBEYmJPYmplY3Qg5a+56LGh5Z+657G777yM5o6n5Yi25Zmo562J55Sx5q2k5rS+55SfXG5mdW5jdGlvbiBEYmJPYmplY3QoKSB7XG4gICAgdGhpcy5fX2lzUmV0YWluZWRfXyA9IDFcbn1cblxuLy8g5a6a5LmJ5Y6f5Z6L5pa55rOVXG5fLmV4dGVuZChEYmJPYmplY3QucHJvdG90eXBlLCBFdmVudHMsIHtcbiAgICAkaXNSZXRhaW5lZDogbGlmZUNpcmNsZS5pc1JldGFpbmVkLFxuICAgICRpc0RlYWxsb2M6IGxpZmVDaXJjbGUuaXNEZWFsbG9jLFxuICAgICRjYWxsSG9vazogdXRpbHMuY2FsbEhvb2ssXG4gICAgJGJyb2FkY2FzdDogZXZlbnRidXMuYnJvYWNhc3QsXG4gICAgJGxpc3RlblRvQnVzOiBldmVudGJ1cy5saXN0ZW5Ub0J1cyxcbiAgICAkZGVhbGxvYzogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuJGlzUmV0YWluZWQoKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICBkZWxldGUgdGhpcy5fX2lzUmV0YWluZWRfX1xuICAgICAgICB0aGlzLnN0b3BMaXN0ZW5pbmcoKVxuICAgICAgICB0aGlzLiRjYWxsSG9vaygnZGlkRGVhbGxvYycpXG4gICAgICAgIHRoaXMub2ZmKClcbiAgICAgICAgXy5lYWNoKF8ua2V5cyh0aGlzKSwgZnVuY3Rpb24ocHJvcCkgeyBkZWxldGUgdGhpc1twcm9wXTsgfSwgdGhpcylcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG59KVxuXG4vLyDlj6/ku6Xln7rkuo4gRGJiT2JqZWN0IOa0vueUn+WHuuWtkOexu1xuRGJiT2JqZWN0LmV4dGVuZCA9IERiYk1vZGVsLmV4dGVuZFxuXG5tb2R1bGUuZXhwb3J0cyA9IERiYk9iamVjdFxuIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IHV0aWxzID0gcmVxdWlyZSgnLi9taXhpbi91dGlscycpXG5jb25zdCBsaWZlQ2lyY2xlID0gcmVxdWlyZSgnLi9taXhpbi9saWZlLWNpcmNsZScpXG5jb25zdCBldmVudGJ1cyA9IHJlcXVpcmUoJy4vbWl4aW4vZXZlbnRidXMnKVxuY29uc3QgYmluZGVyID0gcmVxdWlyZSgnLi9iaW5kZXInKVxuXG4vLyDmnInmlYjnmoQgdmlldyBmaWVsZHNcbmNvbnN0IHZpZXdGaWVsZHMgPSBbJ21vZGVsJywgJ2NvbGxlY3Rpb24nLCAnZWwnLCAnaWQnLCAnYXR0cmlidXRlcycsICdjbGFzc05hbWUnLCAndGFnTmFtZScsICdldmVudHMnXVxuXG4vLyDmnInmlYjnmoQgdmlldyBvcHRpb25zXG5jb25zdCB2aWV3T3B0aW9ucyA9IFtcbiAgICAnc3VwcG9ydExpZmVDeWNsZScsXG4gICAgJ21vdW50UG9pbnRTZWxlY3RvcicsXG4gICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQnLFxuICAgICdzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQnLFxuICAgICdzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVubW91bnQnLFxuICAgICdzaG91bGRQcm9wYWdhdGVWaWV3RGlkVW5tb3VudCcsXG4gICAgJ3Nob3VsZERlbGVnYXRlRXZlbnRzJyxcbiAgICAndHJhbnNpdGlvbicsXG4gICAgJ3Nob3VsZFByZXZlbnREZWFsbG9jJ1xuXVxuXG5jb25zdCB2aWV3S2V5d29yZHMgPSB2aWV3RmllbGRzLmNvbmNhdCh2aWV3T3B0aW9ucylcblxuZnVuY3Rpb24gaXNFbE1vdW50ZWQoZWwpIHtcbiAgICByZXR1cm4gJC5jb250YWlucyhkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQsIChlbCBpbnN0YW5jZW9mICQpID8gZWxbMF0gOiBlbCApXG4gICAgLy8gaWYgKCFlbCkgcmV0dXJuIGZhbHNlXG4gICAgLy8gY29uc3QgZG9jRWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnRcbiAgICAvLyBsZXQgcGFyZW50XG5cbiAgICAvLyBpZiAoZG9jRWwuY29udGFpbnMpIHJldHVybiBkb2NFbC5jb250YWlucyhlbClcbiAgICAvLyBpZiAoZG9jRWwuY29tcGFyZURvY3VtZW50UG9zaXRpb24pIHJldHVybiAhIShkb2NFbC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihlbCkgJiAxNilcbiAgICAvLyBwYXJlbnQgPSBlbC5wYXJlbnROb2RlXG4gICAgLy8gd2hpbGUgKHBhcmVudCkge1xuICAgIC8vICAgICBpZiAocGFyZW50ID09IGRvY0VsKSByZXR1cm4gdHJ1ZVxuICAgIC8vICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZVxuICAgIC8vIH1cbiAgICAvLyByZXR1cm4gZmFsc2Vcbn1cblxuXG4vLyBkZWxlZ2F0ZSBzdWJ2aWV3J3MgZXZlbnRzXG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50cyhzdWJ2aWV3KSB7XG4gICAgdGhpcy5saXN0ZW5UbyhzdWJ2aWV3LCAnYWxsJywgZGVsZWdhdGVFdmVudHNDQilcbiAgICByZXR1cm4gdGhpc1xufVxuZnVuY3Rpb24gZGVsZWdhdGVFdmVudHNDQihuYW1lKSB7XG4gICAgbGV0IGFyZ3MgPSBbJ3N1YnZpZXcuJyArIG5hbWVdLmNvbmNhdCggXy5yZXN0KGFyZ3VtZW50cykgKVxuICAgIHRoaXMudHJpZ2dlci5hcHBseSh0aGlzLCBhcmdzKVxufVxuZnVuY3Rpb24gdW5EZWxlZ2F0ZUV2ZW50cyhzdWJ2aWV3KSB7XG4gICAgdGhpcy5zdG9wTGlzdGVuaW5nKHN1YnZpZXcpXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuXG4vKipcbiAqIEBkZXNjcmlwdGlvblxuICpcbiAqIGEgVmlldydzIGxpZmUgY3ljbGU6XG4gKlxuICogaW5pdGlhbGl6ZTogdmlldyDliJ3lp4vljJZcbiAqIHZpZXdXaWxsUmVuZGVyKHNlbGYpOiB2aWV3IOWNs+Wwhua4suafk++8iOeUn+aIkHZpZXcuZWzvvIlcbiAqIHZpZXdEaWRSZW5kZXIoc2VsZik6IHZpZXcg5bey57uP5a6M5oiQ5riy5p+TXG4gKiB2aWV3V2lsbE1vdW50KHNlbGYpOiB2aWV3LmVsIOWNs+WwhuaMgui9veWIsG1vdW50IGNoaWFuKOmhtueCueaYr2RvY3VtZW50LmRvY3VtZW50RWxlbWVudClcbiAqIHZpZXdEaWRNb3VudChzZWxmKTogdmlldy5lbCDlt7Lnu4/mjILovb3liLBtb3VudCBjaGFpblxuICogdmlld1dpbGxSZWZyZXNoKHNlbGYpOiDop4blm77ljbPlsIbliLfmlrBcbiAqIHZpZXdEaWRSZWZyZXNoKHNlbGYpOiDop4blm77lrozmiJDliLfmlrBcbiAqIHZpZXdXaWxsVW5tb3VudChzZWxmKTogdmlldy5lbCDljbPlsIbku45tb3VudCBjaGFpbuS4iuWNuOi9vVxuICogdmlld0RpZFVubW91bnQoc2VsZik6IHZpZXcuZWwg5bey57uP5LuObW91bnQgY2hhaW7kuIrljbjovb1cbiAqIHZpZXdXaWxsRGVhbGxvYyhzZWxmKTogdmlld+WNs+WwhumUgOavgVxuICogdmlld0RpZERlYWxsb2Moc2VsZik6IHZpZXflt7Lnu4/plIDmr4FcbiAqXG4gKiBzdWJ2aWV3IGV2ZW50c1xuICogc3Vidmlld1dpbGxBZGQoc3Vidmlldywgc2VsZiwgb3B0aW9ucyk6IOWNs+Wwhua3u+WKoOWtkOinhuWbvlxuICogc3Vidmlld0RpZEFkZChzdWJ2aWV3LCBzZWxmLCBvcHRpb25zKTog5a6M5oiQ5re75Yqg5a2Q6KeG5Zu+XG4gKiBzdWJ2aWV3V2lsbFJlbW92ZShzdWJ2aWV3LCBzZWxmLCBvcHRpb25zKTog5a2Q6KeG5Zu+5Y2z5bCG56e76ZmkXG4gKiBzdWJ2aWV3RGlkUmVtb3ZlKHN1YnZpZXcsIHNlbGYsIG9wdGlvbnMpOiDlrZDop4blm77lrozmiJDnp7vpmaRcbiAqIHN1YnZpZXdzV2lsbFNvcnQoc2VsZik6IOWtkOinhuWbvuWNs+WwhuaOkuW6j1xuICogc3Vidmlld3NEaWRTb3J0KHNlbGYpOiDlrZDop4blm77lrozmiJDmjpLluo9cbiAqXG4qKi9cblxuXG4vLyBWaWV355qE5Z+657G7XG5jb25zdCBEYmJWaWV3ID0gQmFja2JvbmUuVmlldy5leHRlbmQoe1xuICAgIGNvbnN0cnVjdG9yOiBmdW5jdGlvbiBEYmJWaWV3KG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIERiYlZpZXcpKSByZXR1cm4gbmV3IERiYlZpZXcob3B0aW9ucylcblxuICAgICAgICAvLyB2aWV355Sf5a2Y5Lit77yM5LiN5Y+v5Zue5pS2XG4gICAgICAgIHRoaXMuX19pc1JldGFpbmVkX18gPSAxXG5cblxuICAgICAgICAvLyDop4blm75vcHRpb25z5pWw5o2uXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgdGhpcy5fX2RlZmF1bHRPcHRpb25zX18sIC8vIOm7mOiupOmFjee9rlxuICAgICAgICAgICAgXy5waWNrKHRoaXMub3B0aW9ucyB8fCB7fSwgdmlld09wdGlvbnMpLCAvLyBleHRlbmQg5Ye65a2Q57G755qE5pe25YCZ77yM5Y+v5Lul55u05o6l6YCa6L+HIG9wdGlvbnMg5a2X5q616YWN572uXG4gICAgICAgICAgICBfLnBpY2sob3B0aW9ucywgdmlld09wdGlvbnMpIC8vIOWunuS+i+WMlueahOaXtuWAmeS8oOWFpeeahOaVsOaNruS4reaPkOWPliBvcHRpb25zIOmDqOWIhlxuICAgICAgICApXG5cblxuICAgICAgICAvLyBvcHRpb25zIOWPium7mOiupGZpZWxkcyDku6XlpJbnmoTmlbDmja7vvIzlkIjlubblhaV2aWV3XG4gICAgICAgIF8uZXh0ZW5kKHRoaXMsIF8ub21pdChvcHRpb25zLCB2aWV3S2V5d29yZHMpKVxuXG5cbiAgICAgICAgLy8g5Yik5pat5p6E6YCg55qE5pe25YCZ5piv5ZCm5Lyg5YWl5LqG5LiA5Liq5bey57uP5oyC5Zyo5ZyoIERPTSDkuIrnmoQgZWxcbiAgICAgICAgLy8g5aaC5p6c5piv77yM6Kem5Y+R55u45YWz55Sf5ZG95ZGo5pyf6ZKp5a2QXG4gICAgICAgIGxldCBlbCA9IF8ucmVzdWx0KG9wdGlvbnMsICdlbCcpXG4gICAgICAgIGxldCBpc01vdW50ZWQgPSBlbCAmJiBpc0VsTW91bnRlZChlbClcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgICAgbGV0IHsgc3VwcG9ydExpZmVDeWNsZSwgc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudCB9ID0gdGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsIFtcbiAgICAgICAgICAgICAgICAnc3VwcG9ydExpZmVDeWNsZScsXG4gICAgICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQnXG4gICAgICAgICAgICBdKVxuICAgICAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCd2aWV3V2lsbE1vdW50JywgdGhpcylcbiAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50KSB0aGlzLiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3V2lsbE1vdW50JylcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8g6LCD55So54i257G75p6E6YCg5Ye95pWwXG4gICAgICAgIC8vIOmhuuW6j+S4jeiDveWPmO+8jOWQpuWImeWcqOe7p+aJv0RiYlZpZXfnmoTlrZDnsbvkuK3vvIxpbml0aWFsaXpl5Lya5pep5LqOY29uc3RydWN0b3LmiafooYzvvIxcbiAgICAgICAgLy8g5a+86Ie0dGhpcy5vcHRpb25z55qE5YC85pivdW5kZWZpbmVkXG4gICAgICAgIEJhY2tib25lLlZpZXcuY2FsbCh0aGlzLCBvcHRpb25zKVxuXG5cbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgICAgbGV0IHsgc3VwcG9ydExpZmVDeWNsZSwgc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50IH0gPSB0aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgW1xuICAgICAgICAgICAgICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAgICAgICAgICAgICAnc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50J1xuICAgICAgICAgICAgXSlcbiAgICAgICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB0aGlzLiRjYWxsSG9vaygndmlld0RpZE1vdW50JywgdGhpcylcbiAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQpIHRoaXMuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRNb3VudCcpXG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgfSxcblxuICAgIF9fZGVmYXVsdE9wdGlvbnNfXzoge1xuICAgICAgICBzdXBwb3J0TGlmZUN5Y2xlOiB0cnVlLCAvLyBzaG91bGQgY2FsbEhvb2tcbiAgICAgICAgbW91bnRQb2ludFNlbGVjdG9yOiAnLmRiYnZpZXctbW91bnRwb2ludCcsIC8vIGFzIHN1YnZpZXcncyBtb3VudHBvaW50XG4gICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQ6IHRydWUsIC8vICRlbCBtb3VudFxuICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQ6IHRydWUsIC8vICRlbCBtb3VudFxuICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVubW91bnQ6IHRydWUsIC8vICRlbCB1bm1vdW50XG4gICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbm1vdW50OiB0cnVlLCAvLyAkZWwgdW5tb3VudFxuICAgICAgICBzaG91bGREZWxlZ2F0ZUV2ZW50czogZmFsc2UsIC8vIGFkZCBzdWJ2aWV3XG4gICAgICAgIHRyYW5zaXRpb246IHt9LCAvLyBkb20gaW5zZXJ0IG9yIHJlbW92ZVxuICAgICAgICBzaG91bGRQcmV2ZW50RGVhbGxvYzogZmFsc2UgLy8gcmVtb3ZlIHN1YnZpZXdcbiAgICB9LFxuXG5cbiAgICAvLyDpu5jorqTlrp7njrDvvIzpgJrluLjkvJrph43lhplcbiAgICBpbml0aWFsaXplKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKHRoaXMuYmluZGluZ3MpIHRoaXMuJHJlbmRlcigpXG4gICAgfSxcblxuXG4gICAgJGJyb2FkY2FzdDogZXZlbnRidXMuYnJvYWNhc3QsXG4gICAgJGxpc3RlblRvQnVzOiBldmVudGJ1cy5saXN0ZW5Ub0J1cyxcblxuICAgICRjYWxsSG9vazogdXRpbHMuY2FsbEhvb2ssXG5cbiAgICAkaXNSZXRhaW5lZDogbGlmZUNpcmNsZS5pc1JldGFpbmVkLFxuICAgICRpc0RlYWxsb2M6IGxpZmVDaXJjbGUuaXNEZWFsbG9jLFxuXG5cbiAgICAkZ2V0T3B0aW9uKG9wdGlvbnMsIGZpZWxkcykge1xuICAgICAgICBpZiAoIWZpZWxkcykgcmV0dXJuXG4gICAgICAgIG9wdGlvbnMgPSBfLmV4dGVuZCh7fSwgdGhpcy5vcHRpb25zLCBvcHRpb25zIHx8IHt9KVxuICAgICAgICBpZiAodHlwZW9mIGZpZWxkcyA9PT0gJ3N0cmluZycpIHJldHVybiBfLnJlc3VsdChvcHRpb25zLCBmaWVsZHMpXG4gICAgICAgIHJldHVybiBfLnBpY2sob3B0aW9ucywgZmllbGRzKVxuICAgIH0sXG5cbiAgICBcbiAgICAvKipcbiAgICAgKiBAbWV0aG9kIFZpZXcjJGRlYWxsb2NcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKiDop4blm77plIDmr4FcbiAgICAgKi9cbiAgICAkZGVhbGxvYyhvcHRpb25zKSB7XG4gICAgICAgIGlmICh0aGlzLiRpc0RlYWxsb2MoKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICBsZXQgc3VwcG9ydExpZmVDeWNsZSA9IHRoaXMuJGdldE9wdGlvbihvcHRpb25zLCAnc3VwcG9ydExpZmVDeWNsZScpXG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCd2aWV3V2lsbERlYWxsb2MnLCB0aGlzKVxuXG4gICAgICAgIC8vIOmAkuW9kuWtkOinhuWbvueahOa4heeQhlxuICAgICAgICBsZXQgY291bnQgPSB0aGlzLiRjb3VudCgpXG4gICAgICAgIGlmICh0aGlzLiRpc05vdEVtcHR5KCkpIHdoaWxlKGNvdW50LS0pIHRoaXMuX19zdWJ2aWV3c19fW2NvdW50XS4kZGVhbGxvYygpXG5cblxuICAgICAgICBkZWxldGUgdGhpcy5fX2lzUmV0YWluZWRfX1xuXG4gICAgICAgIC8vIOiLpeaooeWei+eUqHRoaXMubW9kZWwub24oJ2NoYW5nZScsIGRvU29tZXRoaW5nLCB0aGlzKee7keWumueahO+8jOmcgOimgVxuICAgICAgICAvLyB0aGlzLm1vZGVsLm9mZihudWxsLCBudWxsLCB0aGlzKei/meagt+ino+e7ke+8jOS7peWFjW1vZGVs55qE5YW25LuW5LqL5Lu25Lmf6KKr6Kej6ZmkXG4gICAgICAgIC8vIOWQjOeQhui/mOaciWNvbGxlY3Rpb25cbiAgICAgICAgLy8g5omA5Lul55SobGlzdGVuVG/nu5Hlrprmr5TovoPlrrnmmJPlgZokZGVhbGxvY1xuICAgICAgICB0aGlzLnJlbW92ZSgpIC8vIOenu+mZpHZpZXfku6Xlj4rku45ET03kuK3np7vpmaRlbCzlubboh6rliqjosIPnlKhzdG9wTGlzdGVuaW5n5Lul56e76Zmk6YCa6L+HbGlzdGVuVG/nu5HlrprnmoTkuovku7bjgIJcblxuICAgICAgICAvLyDlv4XpobvmlL7lnKhvZmbliY3vvIxvZmbkvJrkuIDlubbnp7vpmaTpgJrov4dsaXN0ZW5Ub+ebkeWQrOatpOS6i+S7tueahOWFtuS7luWvueixoeeahOebuOW6lOS6i+S7tlxuICAgICAgICAvLyBhLmxpc3RlblRvKGIsLi4uKSxcbiAgICAgICAgLy8gYS5zdG9wTGlzdGVuaW5nIOebuOW9k+S6jiBiLm9mZihudWxsLG51bGwsYSlcbiAgICAgICAgLy8gYi5vZmYoKeebuOW9k+S6jmEuc3RvcExpc3RlbmluZ1xuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSkgdGhpcy4kY2FsbEhvb2soJ3ZpZXdEaWREZWFsbG9jJywgdGhpcylcblxuICAgICAgICB0aGlzLm9mZigpIC8vIOenu+mZpOeUqHRoaXMub27nu5HlrprnmoTkuovku7ZcblxuICAgICAgICAvLyDmuIXnqbrlsZ7mgKdcbiAgICAgICAgXy5lYWNoKFxuICAgICAgICAgICAgXy5rZXlzKHRoaXMpLFxuICAgICAgICAgICAgcHJvcCA9PiB7IGlmIChwcm9wICE9PSAnY2lkJykgZGVsZXRlIHRoaXNbcHJvcF0gfSxcbiAgICAgICAgICAgIHRoaXNcbiAgICAgICAgKVxuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuXG4gICAgLy8g57uR5a6a5pWw5o2u44CB6KeG5Zu+77yM6Ieq5Yqo5bCG5qih5Z6L5Y+Y5YyW5Y+N5pig5Yiw6KeG5Zu+44CC5a+55LqO6KGo5Y2V5o6n5Lu277yM5Y+M5ZCR57uR5a6aXG4gICAgLy8g5b+F6aG75ZyoICRyZW5kZXIg5LmL5ZCO5omN5Y+v5L2/55SoXG4gICAgJGJpbmQobW9kZWwsIGJpbmRpbmdzKSB7XG4gICAgICAgIG1vZGVsID0gbW9kZWwgfHwgdGhpcy5tb2RlbFxuICAgICAgICBiaW5kaW5ncyA9IGJpbmRpbmdzIHx8IF8ucmVzdWx0KHRoaXMsICdiaW5kaW5ncycpXG4gICAgICAgIGlmICghbW9kZWwgfHwgIWJpbmRpbmdzKSByZXR1cm4gdGhpc1xuICAgICAgICBiaW5kZXIuYmluZCh0aGlzLCBtb2RlbCwgYmluZGluZ3MpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuXG4gICAgLy8g5Y+W5raI5pWw5o2u44CB6KeG5Zu+57uR5a6aXG4gICAgJHVuYmluZChtb2RlbCwgcmVjb3Jkcykge1xuICAgICAgICBtb2RlbCA9IG1vZGVsIHx8IHRoaXMubW9kZWxcbiAgICAgICAgcmVjb3JkcyA9IHJlY29yZHMgfHwgdGhpcy5fX2JpbmRpbmdSZWNvcmRzX19cbiAgICAgICAgaWYgKCFtb2RlbCB8fCAhcmVjb3JkcykgcmV0dXJuIHRoaXNcbiAgICAgICAgYmluZGVyLnVuYmluZCh0aGlzLCBtb2RlbCwgcmVjb3JkcylcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiDmiYvliqjlkIzmraXkuIDmrKEgbW9kZWwgJiBVSSDnmoTmlbDmja5cbiAgICAgKiDlj6/ku6XorqkgYmluZGluZyDnq4vljbPnlJ/mlYhcbiAgICAgKiDlpoLvvIzlnKggJHJlbmRlciDkuYvlkI7osIPnlKggJHJlbmRlcigpLiRzeW5jQmluZGluZ0RhdGEoKe+8jOWPr+S7peeri+WNs+WwhiBtb2RlbCDnmoTmlbDmja7kvZznlKjliLAgVUnkuIrvvIxcbiAgICAgKiDoi6UgJHN5bmNCaW5kaW5nRGF0YSh0cnVlKe+8jOWImeS7jiBVSSDor7vlj5bmlbDmja7vvIzkvZznlKjliLAgbW9kZWwg5LiKXG4gICAgICogQHBhcmFtIHsqfSBpc1RvTW9kZWwg5piv5ZCm5LuO6KeG5Zu+5ZCM5q2l5ZCRIG1vZGVsXG4gICAgICovXG4gICAgJHN5bmNCaW5kaW5nRGF0YShpc1RvTW9kZWwpIHtcbiAgICAgICAgYmluZGVyLnN5bmNEYXRhKHRoaXMsIGlzVG9Nb2RlbClcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBAbWV0aG9kIFZpZXcjJHJlbmRlclxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIOaooeadv+a4suafk1xuICAgICAqL1xuICAgICRyZW5kZXIobW9kZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgbW9kZWwgPSBtb2RlbCB8fCB0aGlzLm1vZGVsIHx8IHt9XG4gICAgICAgIGxldCBzdXBwb3J0TGlmZUN5Y2xlID10aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgJ3N1cHBvcnRMaWZlQ3ljbGUnKVxuXG4gICAgICAgIC8vIOW3sue7j+aMgui9ve+8jOivtOaYjui/measoSRyZW5kZXLmmK9yZWZyZXNoXG4gICAgICAgIGxldCBpc1JlZnJlc2ggPSB0aGlzLiRpc01vdW50ZWQoKVxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB7XG4gICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygndmlld1dpbGxSZW5kZXInLCB0aGlzKVxuICAgICAgICAgICAgaWYgKGlzUmVmcmVzaCkgdGhpcy4kY2FsbEhvb2soJ3ZpZXdXaWxsUmVmcmVzaCcsIHRoaXMpXG5cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB0ZW1wbGF0ZSA9IF8ucmVzdWx0KHRoaXMsICckdGVtcGxhdGVGb3JWaWV3JylcblxuICAgICAgICAvLyAkcmVuZGVy5byA5aeL77yM5aaC5p6c5a2Y5Zyo5qih5p2/77yM5YiZ5riy5p+T55u45YWzaHRtbFxuICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKHRlbXBsYXRlKSkge1xuICAgICAgICAgICAgbGV0ICRjaGlsZHJlbkZyYWdtZW50XG5cbiAgICAgICAgICAgIC8vIOaKinN1YnZpZXcuZWwg5pqC56e75YiwIGZyYWdtZW50IOmHjO+8jOS7peS+v+WQjue7remHjeaWsOa4suafk+W9k+WJjeinhuWbvuWQjmFwcGVuZOWbnuadpVxuICAgICAgICAgICAgaWYgKHRoaXMuJGlzTm90RW1wdHkoKSkge1xuICAgICAgICAgICAgICAgICRjaGlsZHJlbkZyYWdtZW50ID0gJChkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCkpXG4gICAgICAgICAgICAgICAgdGhpcy4kZWFjaFN1YnZpZXcodmlldyA9PiAkY2hpbGRyZW5GcmFnbWVudC5hcHBlbmQodmlldy4kZWwpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyDkvb/nlKjmlbDmja7muLLmn5PmqKHmnb/vvIzlubbliLfmlrBkb21cbiAgICAgICAgICAgIGxldCBkYXRhID0gdGhpcy4kZGF0YUZvclZpZXcobW9kZWwpXG5cbiAgICAgICAgICAgIHRoaXMuJGVsLmh0bWwodGVtcGxhdGUoZGF0YSkpXG5cbiAgICAgICAgICAgIHRoaXMuX18kbW91bnRQb2ludF9fID0gXy5yZXN1bHQodGhpcywgJyRtb3VudFBvaW50Rm9yU3VidmlldycsIHRoaXMuJGVsKS5lcSgwKSAvLyDliLfmlrAv6K6+572u5oyC6L2954K5XG5cbiAgICAgICAgICAgIC8vIOWwhuWtkFZpZXcg55qEZWwg5o+S5Zue5p2lXG4gICAgICAgICAgICBpZiAoJGNoaWxkcmVuRnJhZ21lbnQpIHRoaXMuX18kbW91bnRQb2ludF9fLmFwcGVuZCgkY2hpbGRyZW5GcmFnbWVudClcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fXyRtb3VudFBvaW50X18gPSBfLnJlc3VsdCh0aGlzLCAnJG1vdW50UG9pbnRGb3JTdWJ2aWV3JywgdGhpcy4kZWwpLmVxKDApIC8vIOiuvue9ruaMgui9veeCuVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHtcbiAgICAgICAgICAgIHRoaXMuJGNhbGxIb29rKCd2aWV3RGlkUmVuZGVyJywgdGhpcylcbiAgICAgICAgICAgIGlmIChpc1JlZnJlc2gpIHRoaXMuJGNhbGxIb29rKCd2aWV3RGlkUmVmcmVzaCcsIHRoaXMpXG4gICAgICAgIH1cblxuICAgICAgICAvLyDmoIforrDlvZPliY12aWV3IHJlbmRlcmVkXG4gICAgICAgIHRoaXMuJHNldFJlbmRlcmVkKClcblxuICAgICAgICAvLyDnu5Hlrpogdmlld+OAgW1vZGVsXG4gICAgICAgIGlmICh0aGlzLmJpbmRpbmdzICYmIHRoaXMubW9kZWwpIHRoaXMuJHVuYmluZCgpLiRiaW5kKClcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIEBtZXRob2QgVmlldyMkZGF0YUZvclZpZXdcbiAgICAgKiBAZGVzY3JpcHRpb24g6KeG5Zu+5riy5p+T5omA6ZyA55qE5pWw5o2uXG4gICAgICog5Y+vIG92ZXJyaWRlXG4gICAgICovXG4gICAgJGRhdGFGb3JWaWV3KG1vZGVsKSB7XG4gICAgICAgIHJldHVybiBfLnJlc3VsdChtb2RlbCwgJyR0b0RhdGFGb3JWaWV3JywgXG4gICAgICAgICAgICBfLnJlc3VsdChtb2RlbCwgJ3RvSlNPTicsIE9iamVjdChtb2RlbCkpXG4gICAgICAgIClcbiAgICB9LFxuXG4gICAgLy8g5Y+vb3ZlcnJpZGXvvIzov5Tlm57mqKHmnb/muLLmn5Plh73mlbBcbiAgICAkdGVtcGxhdGVGb3JWaWV3KCkge1xuICAgICAgICBpZiAodGhpcy5fX3RlbXBsYXRlRnVuY3Rpb25DYWNoZV9fKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fX3RlbXBsYXRlRnVuY3Rpb25DYWNoZV9fXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCB0ZW1wbGF0ZSA9IHRoaXMub3B0aW9ucy50ZW1wbGF0ZSB8fCB0aGlzLnRlbXBsYXRlXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRlbXBsYXRlID09PSAnc3RyaW5nJykgdGVtcGxhdGUgPSBfLnRlbXBsYXRlKHRlbXBsYXRlKVxuICAgICAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0ZW1wbGF0ZSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9fdGVtcGxhdGVGdW5jdGlvbkNhY2hlX18gPSB0ZW1wbGF0ZVxuICAgICAgICAgICAgICAgIHJldHVybiB0ZW1wbGF0ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuXG4gICAgLy8g5Y+vb3ZlcnJpZGXvvIzlpoLkvZXojrflj5blrZB2aWV355qEZWzmjILovb1kb23lrrnlmahcbiAgICAkbW91bnRQb2ludEZvclN1YnZpZXcob3B0aW9ucykge1xuICAgICAgICBsZXQgJG1vdW50UG9pbnQgPSB0aGlzLiQodGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsICdtb3VudFBvaW50U2VsZWN0b3InKSlcbiAgICAgICAgaWYgKCRtb3VudFBvaW50Lmxlbmd0aCkgcmV0dXJuICRtb3VudFBvaW50XG4gICAgICAgIHJldHVybiB0aGlzLiRlbFxuICAgIH0sXG5cbiAgICAvLyDmo4Dmn6Xop4blm77mmK/lkKbmjILovb3liLDmlofmoaNcbiAgICAkaXNNb3VudGVkKCkge1xuICAgICAgICByZXR1cm4gaXNFbE1vdW50ZWQodGhpcy5lbClcbiAgICB9LFxuXG4gICAgLy8g56Gu6K6k6KeG5Zu+55qE5qih5p2/5piv5ZCm5riy5p+TXG4gICAgJGlzUmVuZGVyZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9faXNSZW5kZXJlZF9fXG4gICAgfSxcblxuICAgIC8vIOagh+iusOinhuWbvuW3sue7j+a4suafk+i/h1xuICAgICRzZXRSZW5kZXJlZCgpIHtcbiAgICAgICAgdGhpcy5fX2lzUmVuZGVyZWRfXyA9IHRydWVcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBAbWV0aG9kIFZpZXcjJG1vdW50VG9FbFxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIOWwhuinhuWbvuaMgui9veWIsOafkOS4qkVs5LiKXG4gICAgICovXG4gICAgJG1vdW50VG9FbCgkZWwsIG9wdGlvbnMpIHtcbiAgICAgICAgLy8gJ0RiYlZpZXcgKGNpZDogXCInICsgdGhpcy5jaWQgKyAnXCIpIGhhcyBhbHJlYWR5IGJlZW4gZGVzdHJveWVkIGFuZCBjYW5ub3QgYmUgdXNlZC4nXG4gICAgICAgIGlmKHRoaXMuJGlzRGVhbGxvYygpKSByZXR1cm4gdGhpc1xuICAgICAgICBpZiAodGhpcy4kaXNNb3VudGVkKCkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgaWYgKCEoJGVsIGluc3RhbmNlb2YgJCkpICRlbCA9ICQoJGVsKVxuXG4gICAgICAgIC8vIHRoZSBtb3VudFBvaW50IGlzIHVubW91bnRlZC5cbiAgICAgICAgaWYgKCFpc0VsTW91bnRlZCgkZWwuZ2V0KDApKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3VwcG9ydExpZmVDeWNsZSxcbiAgICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQsXG4gICAgICAgICAgICB0cmFuc2l0aW9uXG4gICAgICAgIH0gPSB0aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgW1xuICAgICAgICAgICAgJ3N1cHBvcnRMaWZlQ3ljbGUnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudCcsXG4gICAgICAgICAgICAndHJhbnNpdGlvbidcbiAgICAgICAgXSlcblxuICAgICAgICBpZiAoIXRoaXMuJGlzUmVuZGVyZWQoKSkgdGhpcy4kcmVuZGVyKClcblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSkgdGhpcy4kY2FsbEhvb2soJ3ZpZXdXaWxsTW91bnQnLCB0aGlzKVxuXG4gICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50KVxuICAgICAgICAgICAgdGhpcy4kcHJvcGFnYXRlTGlmZUN5Y2xlSG9vaygndmlld1dpbGxNb3VudCcpXG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnirbmgIFcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnZpZXdXaWxsTW91bnQpKVxuICAgICAgICAgICAgdHJhbnNpdGlvbi52aWV3V2lsbE1vdW50KHRoaXMuJGVsKVxuXG4gICAgICAgICRlbC5lcSgwKS5hcHBlbmQodGhpcy4kZWwpXG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnu5PmnZ9cbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnZpZXdEaWRNb3VudCkpIHtcbiAgICAgICAgICAgIC8vIOW8uuWItnJlZmxvd++8jOiuqXRyYW5zaXRpb27liqjnlLvnlJ/mlYhcbiAgICAgICAgICAgIC8vIHRoaXMuZWwub2Zmc2V0SGVpZ2h0XG4gICAgICAgICAgICB0cmFuc2l0aW9uLnZpZXdEaWRNb3VudCh0aGlzLiRlbClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgdGhpcy4kY2FsbEhvb2soJ3ZpZXdEaWRNb3VudCcsIHRoaXMpXG5cbiAgICAgICAgaWYgKHNob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudClcbiAgICAgICAgICAgIHRoaXMuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRNb3VudCcpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAkdW5tb3VudChvcHRpb25zKSB7XG4gICAgICAgIGlmKHRoaXMuJGlzRGVhbGxvYygpKSByZXR1cm4gdGhpc1xuICAgICAgICBpZiAoIXRoaXMuJGlzTW91bnRlZCgpKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBzdXBwb3J0TGlmZUN5Y2xlLFxuICAgICAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbm1vdW50LFxuICAgICAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld0RpZFVubW91bnQsXG4gICAgICAgICAgICB0cmFuc2l0aW9uXG4gICAgICAgIH0gPSB0aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgW1xuICAgICAgICAgICAgJ3N1cHBvcnRMaWZlQ3ljbGUnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsVW5tb3VudCcsXG4gICAgICAgICAgICAnc2hvdWxkUHJvcGFnYXRlVmlld0RpZFVubW91bnQnLFxuICAgICAgICAgICAgJ3RyYW5zaXRpb24nXG4gICAgICAgIF0pXG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpXG4gICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygndmlld1dpbGxVbm1vdW50JywgdGhpcylcbiAgICAgICAgaWYgKHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsVW5tb3VudClcbiAgICAgICAgICAgIHRoaXMuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdXaWxsVW5tb3VudCcpXG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnirbmgIFcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihvcHRpb25zLnRyYW5zaXRpb24udmlld1dpbGxVbm1vdW50KSlcbiAgICAgICAgICAgIHRyYW5zaXRpb24udmlld1dpbGxVbm1vdW50KHRoaXMuJGVsKVxuXG4gICAgICAgIHRoaXMuJGVsLmRldGFjaCgpXG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDnu5PmnZ9cbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnZpZXdEaWRVbm1vdW50KSkge1xuICAgICAgICAgICAgLy8g5by65Yi2cmVmbG9377yM6K6pdHJhbnNpdGlvbuWKqOeUu+eUn+aViFxuICAgICAgICAgICAgLy8gdGhpcy5lbC5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIHRyYW5zaXRpb24udmlld0RpZFVubW91bnQodGhpcy4kZWwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSlcbiAgICAgICAgICAgIHRoaXMuJGNhbGxIb29rKCd2aWV3RGlkVW5tb3VudCcsIHRoaXMpXG4gICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3RGlkVW5tb3VudClcbiAgICAgICAgICAgIHRoaXMuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRVbm1vdW50JylcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cblxuXG4gICAgLyoqXG4gICAgICogQG1ldGhvZCBWaWV3IyRhZGRTdWJ2aWV3XG4gICAgICogQHBhcmFtIHtEYmJWaWV3fSBzdWJ2aWV3XG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKlxuICAgICAqICRhZGRTdWJ2aWV3KHZpZXcsIG9wdGlvbnMpXG4gICAgICpcbiAgICAgKiBwYXJlbnQuJGFkZFN1YnZpZXcoc3Vidmlldywgey4uLn0pXG4gICAgICogcGFyZW50LiRhZGRTdWJ2aWV3KHN1YnZpZXcsIHthdEluZGV4OiBpbmRleH0pIC8vIGluZGV4OiBudW1iZXIgfHwgJ2ZpcnN0JyB8fCAnbGFzdCdcbiAgICAgKlxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudCB7Qm9vbGVhbn1cbiAgICAgKiBvcHRpb25zLnNob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudCB7Ym9vbH1cbiAgICAgKlxuICAgICAqL1xuICAgICRhZGRTdWJ2aWV3KHZpZXdzLCBvcHRpb25zKSB7XG4gICAgICAgIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9XG5cbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2FkZFN1YnZpZXcnKVxuICAgICAgICBsZXQgdmlld3NDb3VudFxuICAgICAgICAvLyB2aWV3cyDlj4LmlbDmjqXlj5fkuIDkuKrljZXni6znmoTop4blm77vvIzmiJbkuIDkuKrop4blm77mlbDnu4TvvIzpnIDopoHliIbliKvlpITnkIZcbiAgICAgICAgLy8gMS4g6L+H5ruk5o6J5peg5pWI55qE6KeG5Zu+XG4gICAgICAgIC8vIDIuIOWmguaenOaYr+S4gOS4quWNleeLrOeahOinhuWbvu+8jOS5n+i9rOaNouaIkOWPquacieS4gOS4quWFg+e0oOeahOaVsOe7hOe7n+S4gOWkhOeQhlxuICAgICAgICBpZiAoXy5pc0FycmF5KHZpZXdzKSkge1xuICAgICAgICAgICAgdmlld3MgPSBfLmZpbHRlcih2aWV3cywgdmlldyA9PiAodmlldyBpbnN0YW5jZW9mIERiYlZpZXcgJiYgdmlldy4kaXNSZXRhaW5lZCgpICYmICF0aGlzLiRoYXNTdWJ2aWV3KHZpZXcpKSwgdGhpcylcblxuICAgICAgICAgICAgaWYgKCEodmlld3NDb3VudCA9IHZpZXdzLmxlbmd0aCkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAhKHZpZXdzXG4gICAgICAgICAgICAgICAgJiYgdmlld3MgaW5zdGFuY2VvZiBEYmJWaWV3XG4gICAgICAgICAgICAgICAgJiYgdmlld3MuJGlzUmV0YWluZWQoKVxuICAgICAgICAgICAgICAgICYmICF0aGlzLiRoYXNTdWJ2aWV3KHZpZXdzKSlcbiAgICAgICAgICAgICkgcmV0dXJuIHRoaXNcblxuICAgICAgICAgICAgdmlld3MgPSBbdmlld3NdXG4gICAgICAgICAgICB2aWV3c0NvdW50ID0gMVxuICAgICAgICB9XG5cbiAgICAgICAgLy8g5aSE55CG5Y+C5pWw77ya5aSE55CGb3B0aW9uc1xuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3VwcG9ydExpZmVDeWNsZSxcbiAgICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQsXG4gICAgICAgICAgICBzaG91bGREZWxlZ2F0ZUV2ZW50cyxcbiAgICAgICAgICAgIHRyYW5zaXRpb24sXG4gICAgICAgICAgICBhdEluZGV4XG4gICAgICAgIH0gPSB0aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgW1xuICAgICAgICAgICAgJ3N1cHBvcnRMaWZlQ3ljbGUnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudCcsXG4gICAgICAgICAgICAnc2hvdWxkRGVsZWdhdGVFdmVudHMnLFxuICAgICAgICAgICAgJ3RyYW5zaXRpb24nLFxuICAgICAgICAgICAgJ2F0SW5kZXgnXG4gICAgICAgIF0pXG5cbiAgICAgICAgLy8g5bGA6YOo5Y+Y6YeP57yT5a2YXG4gICAgICAgIGxldCBzdWJ2aWV3cyA9IHRoaXMuX19zdWJ2aWV3c19fIHx8ICh0aGlzLl9fc3Vidmlld3NfXyA9IFtdKVxuICAgICAgICBsZXQgc3Vidmlld3NDb3VudCA9IHN1YnZpZXdzLmxlbmd0aFxuICAgICAgICBsZXQgJGZyYWcgPSAkKGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSlcblxuXG4gICAgICAgIC8vIOehruWumuaPkuWFpeeCuVxuICAgICAgICAvLyDlrZfnrKbkuLLnmoTmg4XlhrXvvIzpnZ4nZmlyc3Qn55qE5YWo6YeN572u5Li6J2xhc3Qn44CCXG4gICAgICAgIGlmICh0eXBlb2YgYXRJbmRleCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGF0SW5kZXggPSAoYXRJbmRleCA9PT0gJ2ZpcnN0JykgPyAwIDogJ2xhc3QnXG5cbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYXRJbmRleCA9PT0gJ251bWJlcicpIHsgLy8g5pWw5a2X55qE5oOF5Ya177yM6Z2e5ZCI5rOVaW5kZXjph43nva7kuLonbGFzdCdcbiAgICAgICAgICAgIGlmKGF0SW5kZXggPCAwIHx8IGF0SW5kZXggPj0gc3Vidmlld3NDb3VudCkgYXRJbmRleCA9ICdsYXN0J1xuXG4gICAgICAgIH0gZWxzZSB7IC8vIOS7u+S9leWFtuS7luWAvOmDveaYr+mdnuazleeahO+8jOWFqOmDqOmHjee9ruS4uidsYXN0J1xuICAgICAgICAgICAgYXRJbmRleCA9ICdsYXN0J1xuXG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy5hdEluZGV4ID0gYXRJbmRleFxuXG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCdzdWJ2aWV3V2lsbEFkZCcsIHZpZXdzLCB0aGlzLCBvcHRpb25zKVxuXG4gICAgICAgIC8vIOS7o+eQhuWtkOinhuWbvuS6i+S7tlxuICAgICAgICBsZXQgaVxuICAgICAgICBpZiAoc2hvdWxkRGVsZWdhdGVFdmVudHMpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB2aWV3c0NvdW50OyBpICs9IDEpIHsgZGVsZWdhdGVFdmVudHMuY2FsbCh0aGlzLCB2aWV3c1tpXSkgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8g5riy5p+T5aW9c3VwZXJ2aWV35qih5p2/77yM5b6Fc3Vidmlld+eahERPTeaPkuWFpVxuICAgICAgICBpZiAoIXRoaXMuJGlzUmVuZGVyZWQoKSkgdGhpcy4kcmVuZGVyKClcblxuICAgICAgICAvLyDmuLLmn5Plpb1zdWJ2aWV355qE5qih5p2/77yM5b6F5o+S5YWlXG4gICAgICAgIGxldCBjdXJyZW50XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB2aWV3c0NvdW50OyBpICs9IDEpIHtcbiAgICAgICAgICAgIGN1cnJlbnQgPSB2aWV3c1tpXVxuICAgICAgICAgICAgaWYgKCFjdXJyZW50LiRpc1JlbmRlcmVkKCkpIGN1cnJlbnQuJHJlbmRlcigpXG4gICAgICAgICAgICAkZnJhZy5hcHBlbmQoY3VycmVudC4kZWwpXG4gICAgICAgIH1cblxuICAgICAgICAvLyDlpoLmnpzlvZPliY12aWV35bey57uPbW91bnRlZO+8jOWQkeaJgOacieWtkOexu+S8oOaSrXZpZXdXaWxsTW91bnRcbiAgICAgICAgbGV0IGlzTW91bnRlZCA9IHRoaXMuJGlzTW91bnRlZCgpXG4gICAgICAgIGlmICgoaXNNb3VudGVkKSkge1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSB2aWV3c1tpXVxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Lm9wdGlvbnMuc3VwcG9ydExpZmVDeWNsZSkgY3VycmVudC4kY2FsbEhvb2soJ3ZpZXdXaWxsTW91bnQnLCBjdXJyZW50KVxuICAgICAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50KSBjdXJyZW50LiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3V2lsbE1vdW50JylcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g5byA5aeL54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi5zdWJ2aWV3V2lsbEFkZCkpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB2aWV3c0NvdW50OyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50ID0gdmlld3NbaV1cbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uLnN1YnZpZXdXaWxsQWRkKGN1cnJlbnQuJGVsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8g5YWI5oyC6L29RE9N77yM5YaN5o+S5YWl6KeG5Zu+77yM5Lul5YWN5o+S5YWl55qE6KeG5Zu+5b2x5ZONaW5kZXjvvIzlr7zoh7Tmj5LlhaXkvY3nva7plJnor69cbiAgICAgICAgaWYgKGF0SW5kZXggPT09ICdsYXN0Jykge1xuICAgICAgICAgICAgdGhpcy5fXyRtb3VudFBvaW50X18uYXBwZW5kKCRmcmFnKVxuICAgICAgICAgICAgdGhpcy5fX3N1YnZpZXdzX18gPSBzdWJ2aWV3cy5jb25jYXQodmlld3MpXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN1YnZpZXdzW2F0SW5kZXhdLiRlbC5iZWZvcmUoJGZyYWcpXG4gICAgICAgICAgICAvLyB0aGlzLl9fJG1vdW50UG9pbnRfXy5pbnNlcnRCZWZvcmUoZnJhZywgc3Vidmlld3NbYXRJbmRleF0uZWwpICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLl9fc3Vidmlld3NfXyA9IHN1YnZpZXdzLnNsaWNlKDAsIGF0SW5kZXgpLmNvbmNhdCh2aWV3cykuY29uY2F0KHN1YnZpZXdzLnNsaWNlKGF0SW5kZXgpKVxuXG4gICAgICAgIH1cblxuICAgICAgICAvLyB0cmFuc2l0aW9uIOe7k+adn+eKtuaAgVxuICAgICAgICBpZiAoXy5pc0Z1bmN0aW9uKHRyYW5zaXRpb24uc3Vidmlld0RpZEFkZCkpIHtcbiAgICAgICAgICAgIC8vIOW8uuWItnJlZmxvd++8jOiuqXRyYW5zaXRpb27liqjnlLvnlJ/mlYhcbiAgICAgICAgICAgIHRoaXMuZWwub2Zmc2V0SGVpZ2h0XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmlld3NDb3VudDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudCA9IHZpZXdzW2ldXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbi5zdWJ2aWV3RGlkQWRkKGN1cnJlbnQuJGVsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvLyDmj5LlhaXnmoRzdWJ2aWV3IOWFqOmDqOmZhOWKoOS4il9fc3VwZXJ2aWV3X1/nmoTlsZ7mgKdcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkge1xuICAgICAgICAgICAgY3VycmVudCA9IHZpZXdzW2ldXG4gICAgICAgICAgICBjdXJyZW50Ll9fc3VwZXJ2aWV3X18gPSB0aGlzXG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vIOWmgnN1YnZpZXflt7Lnu49tb3VudGVk77yM5ZCR5omA5pyJ5a2Q57G75Lyg5pKtdmlld0RpZE1vdW50XG4gICAgICAgIGlmIChpc01vdW50ZWQpIHtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB2aWV3c0NvdW50OyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50ID0gdmlld3NbaV1cbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudC5vcHRpb25zLnN1cHBvcnRMaWZlQ3ljbGUpIGN1cnJlbnQuJGNhbGxIb29rKCd2aWV3RGlkTW91bnQnLCBjdXJyZW50KVxuICAgICAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50KSBjdXJyZW50LiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3RGlkTW91bnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCdzdWJ2aWV3RGlkQWRkJywgdmlld3MsIHRoaXMsIG9wdGlvbnMpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBAbWV0aG9kIFZpZXcjJHJlbW92ZVN1YnZpZXdcbiAgICAgKiBAcGFyYW0ge0RiYlZpZXcgfCBOdW1iZXIgfCBTdHJpbmd9IHZpZXcgLy8gc3VidmlldyBvciBpbmRleCBudW1iZXIgb3IgJ2ZpcnN0JywgJ2xhc3QnXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKlxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIOenu+mZpOS4gOS4quWtkOinhuWbvlxuICAgICAqXG4gICAgICogJHJlbW92ZVN1YnZpZXcodmlldyBbLG9wdGlvbnNdKVxuICAgICAqXG4gICAgICogcGFyZW50LiRyZW1vdmVTdWJ2aWV3KHN1YnZpZXcgWyxvcHRpb25zXSlcbiAgICAgKiBwYXJlbnQuJHJlbW92ZVN1YnZpZXcoaW5kZXhOdW1iZXIgWyxvcHRpb25zXSlcbiAgICAgKiBwYXJlbnQuJHJlbW92ZVN1YnZpZXcoJ2ZpcnN0JyBbLG9wdGlvbnNdKVxuICAgICAqIHBhcmVudC4kcmVtb3ZlU3VidmlldygnbGFzdCcgWyxvcHRpb25zXSlcbiAgICAgKlxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50IHtCb29sZWFufVxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld0RpZFVuTW91bnQge2Jvb2x9XG4gICAgICogb3B0aW9ucy5zaG91bGRQcmV2ZW50RGVhbGxvYyB7Ym9vbH1cbiAgICAgKlxuICAgICAqL1xuICAgICRyZW1vdmVTdWJ2aWV3KHZpZXcsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge31cblxuICAgICAgICAvLyBjb25zb2xlLmxvZygncmVtb3ZlU3VidmlldycpXG4gICAgICAgIGlmICghdGhpcy4kaXNOb3RFbXB0eSgpKSByZXR1cm4gdGhpc1xuICAgICAgICBpZiAodmlldyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpc1xuXG5cbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN1cHBvcnRMaWZlQ3ljbGUsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkVW5Nb3VudCxcbiAgICAgICAgICAgIHNob3VsZFByZXZlbnREZWFsbG9jLFxuICAgICAgICAgICAgdHJhbnNpdGlvblxuICAgICAgICB9ID0gdGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsIFtcbiAgICAgICAgICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAgICAgICAgICdzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbk1vdW50JyxcbiAgICAgICAgICAgICdzaG91bGRQcmV2ZW50RGVhbGxvYycsXG4gICAgICAgICAgICAndHJhbnNpdGlvbidcbiAgICAgICAgXSlcblxuICAgICAgICBsZXQgc3Vidmlld3MgPSB0aGlzLl9fc3Vidmlld3NfX1xuXG4gICAgICAgIC8vIOehruWummF0SW5kZXjnmoTlgLxcbiAgICAgICAgbGV0IGF0SW5kZXhcbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBEYmJWaWV3KSB7XG4gICAgICAgICAgICBhdEluZGV4ID0gdGhpcy4kaW5kZXhPZlN1YnZpZXcodmlldylcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSAodmlldyA8IDAgfHwgdmlldyA+PSB0aGlzLiRjb3VudCgpKSA/IC0xIDogdmlld1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpZXcgPT09ICdmaXJzdCcpIHtcbiAgICAgICAgICAgICAgICBhdEluZGV4ID0gMFxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpZXcgPT09ICdsYXN0Jykge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSB0aGlzLiRjb3VudCgpIC0gMVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSAtMVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aWV3ID0gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0SW5kZXggPT09IC0xKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIGlmICh2aWV3ID09PSBudWxsKSB2aWV3ID0gc3Vidmlld3NbYXRJbmRleF1cblxuICAgICAgICAvLyDljbPlsIbnp7vpmaTnmoRzdWJ2aWV35Y+KaW5kZXjpmYTliqDliLBvcHRpb25z6YeM77yM5Lyg6YCS57uZ5LqL5Lu25aSE55CG5ZmoXG4gICAgICAgIG9wdGlvbnMudmlldyA9IHZpZXdcbiAgICAgICAgb3B0aW9ucy5hdEluZGV4ID0gYXRJbmRleFxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB0aGlzLiRjYWxsSG9vaygnc3Vidmlld1dpbGxSZW1vdmUnLCB2aWV3LCB0aGlzLCBvcHRpb25zKVxuXG4gICAgICAgIHN1YnZpZXdzLnNwbGljZShhdEluZGV4LCAxKVxuICAgICAgICBkZWxldGUgdmlldy5fX3N1cGVydmlld19fXG5cbiAgICAgICAgLy8g56e76Zmk5a+5c3Vidmlld+eahOS6i+S7tuS7o+eQhlxuICAgICAgICB1bkRlbGVnYXRlRXZlbnRzLmNhbGwodGhpcywgdmlldylcblxuICAgICAgICAvLyDlpoLmnpzlvZPliY1zdWJ2aWV35bey57uPbW91bnRlZO+8jOWQkeaJgOacieWtkOexu+S8oOaSrXZpZXdXaWxsVW5tb3VudFxuICAgICAgICBpZiAodmlldy4kaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgIGlmICh2aWV3Lm9wdGlvbnMuc3VwcG9ydExpZmVDeWNsZSkgdmlldy4kY2FsbEhvb2soJ3ZpZXdXaWxsVW5tb3VudCcsIHZpZXcpXG4gICAgICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50KSB2aWV3LiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3V2lsbFVubW91bnQnKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnirbmgIFcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnN1YnZpZXdXaWxsUmVtb3ZlKSkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbi5zdWJ2aWV3V2lsbFJlbW92ZSh2aWV3LiRlbClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g57uT5p2f54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi5zdWJ2aWV3RGlkUmVtb3ZlKSkge1xuICAgICAgICAgICAgLy8g5by65Yi2cmVmbG9377yM6K6pdHJhbnNpdGlvbuWKqOeUu+eUn+aViFxuICAgICAgICAgICAgdGhpcy5lbC5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIHRyYW5zaXRpb24uc3Vidmlld0RpZFJlbW92ZSh2aWV3LiRlbCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLy8gdHJhbnNpdGlvbiBlbmRcblxuICAgICAgICAgICAgICAgIHZpZXcuJGVsLmRldGFjaCgpXG4gICAgICAgICAgICAgICAgLy8gdGhpcy5fXyRtb3VudFBvaW50X18ucmVtb3ZlQ2hpbGQodmlldy5lbClcblxuICAgICAgICAgICAgICAgIC8vIOWmguaenOW9k+WJjXN1YnZpZXflt7Lnu491bm1vdW50ZWTvvIzlkJHmiYDmnInlrZDnsbvkvKDmkq12aWV3RGlkVW5tb3VudFxuICAgICAgICAgICAgICAgIGlmICghdmlldy4kaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZpZXcub3B0aW9ucy5zdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy4kY2FsbEhvb2soJ3ZpZXdEaWRVbm1vdW50JywgdmlldylcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy4kcHJvcGFnYXRlTGlmZUN5Y2xlSG9vaygndmlld0RpZFVubW91bnQnKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygnc3Vidmlld0RpZFJlbW92ZScsIHZpZXcsIHRoaXMsIG9wdGlvbnMpXG5cbiAgICAgICAgICAgICAgICBpZiAoIXNob3VsZFByZXZlbnREZWFsbG9jKVxuICAgICAgICAgICAgICAgICAgICB2aWV3LiRkZWFsbG9jKClcblxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICAgICAgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2aWV3LiRlbC5kZXRhY2goKVxuICAgICAgICAgICAgLy8gdGhpcy5fXyRtb3VudFBvaW50X18ucmVtb3ZlQ2hpbGQodmlldy5lbClcblxuICAgICAgICAgICAgLy8g5aaC5p6c5b2T5YmNc3Vidmlld+W3sue7j3VubW91bnRlZO+8jOWQkeaJgOacieWtkOexu+S8oOaSrXZpZXdEaWRVbm1vdW50XG4gICAgICAgICAgICBpZiAoIXZpZXcuJGlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZpZXcub3B0aW9ucy5zdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICB2aWV3LiRjYWxsSG9vaygndmlld0RpZFVubW91bnQnLCB2aWV3KVxuICAgICAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQpXG4gICAgICAgICAgICAgICAgICAgIHZpZXcuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRVbm1vdW50JylcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpXG4gICAgICAgICAgICAgICAgdGhpcy4kY2FsbEhvb2soJ3N1YnZpZXdEaWRSZW1vdmUnLCB2aWV3LCB0aGlzLCBvcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoIXNob3VsZFByZXZlbnREZWFsbG9jKVxuICAgICAgICAgICAgICAgIHZpZXcuJGRlYWxsb2MoKVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJGNvdW50KCkge1xuICAgICAgICByZXR1cm4gXy5zaXplKHRoaXMuX19zdWJ2aWV3c19fKVxuICAgIH0sXG5cbiAgICAkaXNFbXB0eSgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLiRjb3VudCgpXG4gICAgfSxcblxuICAgICRpc05vdEVtcHR5KCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLiRjb3VudCgpXG4gICAgfSxcblxuICAgICRoYXNTdWJ2aWV3KHN1YnZpZXcpIHtcbiAgICAgICAgcmV0dXJuIHN1YnZpZXcuX19zdXBlcnZpZXdfXyAmJiBzdWJ2aWV3Ll9fc3VwZXJ2aWV3X18gPT09IHRoaXNcbiAgICB9LFxuXG4gICAgJGVhY2hTdWJ2aWV3KGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLiRpc0VtcHR5KCkpIHJldHVyblxuICAgICAgICBsZXQgaVxuICAgICAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgICAgICAgIC8vIGxlbmd0aCDpnIDopoHliqjmgIHor7vlj5bvvIzpgb/lhY3pgY3ljobov4fnqItsZW5ndGjlj5jljJZcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLl9fc3Vidmlld3NfXy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGl0ZXJhdGVlKHRoaXMuX19zdWJ2aWV3c19fW2ldLCBpLCB0aGlzLl9fc3Vidmlld3NfXylcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbGVuZ3RoIOmcgOimgeWKqOaAgeivu+WPlu+8jOmBv+WFjemBjeWOhui/h+eoi2xlbmd0aOWPmOWMllxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX19zdWJ2aWV3c19fLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0ZWUuY2FsbChjb250ZXh0LCB0aGlzLl9fc3Vidmlld3NfX1tpXSwgaSwgdGhpcy5fX3N1YnZpZXdzX18pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyDmn6Xor6Lop4blm77lnKjlrZDop4blm77kuK3nmoRpbmRleFxuICAgICRpbmRleE9mU3VidmlldyhzdWJ2aWV3LCBpc1NvcnQpIHtcbiAgICAgICAgcmV0dXJuIF8uaW5kZXhPZih0aGlzLl9fc3Vidmlld3NfXywgc3VidmlldywgaXNTb3J0KVxuICAgIH0sXG5cbiAgICAkaW5kZXhJblN1cGVydmlldyhpc1NvcnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9fc3VwZXJ2aWV3X18pIHJldHVybiAtMVxuICAgICAgICByZXR1cm4gdGhpcy5fX3N1cGVydmlld19fLiRpbmRleE9mU3Vidmlldyh0aGlzLCBpc1NvcnQpXG4gICAgfSxcblxuICAgICRnZXRTdWJ2aWV3cygpIHtcbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSkgcmV0dXJuIG51bGxcbiAgICAgICAgcmV0dXJuIHRoaXMuX19zdWJ2aWV3c19fXG4gICAgfSxcblxuICAgICRnZXRTdWJ2aWV3QXQoaW5kZXgpIHtcbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSkgcmV0dXJuIG51bGxcbiAgICAgICAgcmV0dXJuIHRoaXMuX19zdWJ2aWV3c19fW2luZGV4XSB8fCBudWxsXG4gICAgfSxcblxuICAgICRnZXRTdXBwZXJ2aWV3KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX3N1cGVydmlld19fIHx8IG51bGxcbiAgICB9LFxuXG4gICAgJGdldEZpcnN0U3VidmlldygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGdldFN1YnZpZXdBdCgwKVxuICAgIH0sXG5cbiAgICAkZ2V0TGFzdFN1YnZpZXcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRnZXRTdWJ2aWV3QXQodGhpcy4kY291bnQoKSAtIDEpXG4gICAgfSxcblxuICAgICRnZXROZXh0U2libGluZygpIHtcbiAgICAgICAgdmFyIHN1cGVydmlldywgaWR4XG5cbiAgICAgICAgaWYgKChzdXBlcnZpZXcgPSB0aGlzLiRnZXRTdXBwZXJ2aWV3KCkpKSB7XG4gICAgICAgICAgICBpZHggPSBzdXBlcnZpZXcuJGluZGV4T2ZTdWJ2aWV3KHRoaXMpXG4gICAgICAgICAgICBpZiAoaWR4ID09PSBzdXBlcnZpZXcuJGNvdW50KCkgLSAxKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgcmV0dXJuIHN1cGVydmlldy4kZ2V0U3Vidmlld0F0KGlkeCArIDEpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9LFxuXG4gICAgJGdldFByZXZTaWJsaW5nKCkge1xuICAgIFx0dmFyIHN1cGVydmlldywgaWR4XG5cbiAgICAgICAgaWYgKChzdXBlcnZpZXcgPSB0aGlzLiRnZXRTdXBwZXJ2aWV3KCkpKSB7XG4gICAgICAgICAgICBpZHggPSBzdXBlcnZpZXcuJGluZGV4T2ZTdWJ2aWV3KHRoaXMpXG4gICAgICAgICAgICBpZiAoaWR4ID09PSAwKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgcmV0dXJuIHN1cGVydmlldy4kZ2V0U3Vidmlld0F0KGlkeCAtIDEpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9LFxuXG4gICAgJGVtcHR5U3Vidmlld3Mob3B0aW9ucykge1xuICAgICAgICB2YXIgZGlzcGxheVxuXG4gICAgICAgIGlmICh0aGlzLiRpc0VtcHR5KCkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgZGlzcGxheSA9IHRoaXMuX18kbW91bnRQb2ludF9fLmhpZGUoKVxuICAgICAgICB3aGlsZSAodGhpcy5fX3N1YnZpZXdzX18ubGVuZ3RoKSB0aGlzLiRyZW1vdmVTdWJ2aWV3KDAsIG9wdGlvbnMpXG4gICAgICAgIHRoaXMuX19zdWJ2aWV3c19fLmxlbmd0aCA9IDBcbiAgICAgICAgdGhpcy5fXyRtb3VudFBvaW50X18uc2hvdygpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHNvcnRTdWJ2aWV3cyhjb21wYXJhdG9yKSB7XG4gICAgICAgIHZhciAkZnJhZ21lbnQsICRtb3VudFBvaW50LCBkaXNwbGF5XG5cbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSB8fCAhXy5pc0Z1bmN0aW9uKGNvbXBhcmF0b3IpKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIHRoaXMuJGdldFN1YnZpZXdzKCkuc29ydChjb21wYXJhdG9yKSAvLyDlhYjmjpLluo9cblxuICAgICAgICAvLyDmiafooYzlj5jmm7RcbiAgICAgICAgJGZyYWdtZW50ID0gJChkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCkpXG4gICAgICAgICRtb3VudFBvaW50ID0gdGhpcy5fXyRtb3VudFBvaW50X19cbiAgICAgICAgJG1vdW50UG9pbnQuaGlkZSgpXG4gICAgICAgIHRoaXMuJGVhY2hTdWJ2aWV3KHN1YnZpZXcgPT4gJGZyYWdtZW50LmFwcGVuZChzdWJ2aWV3LiRlbCkpXG4gICAgICAgICRtb3VudFBvaW50LnNob3coKVxuICAgICAgICAkbW91bnRQb2ludC5hcHBlbmQoJGZyYWdtZW50KVxuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuICAgIC8vIOWQkeWGheS8oOaSreS6i+S7tlxuICAgICRwcm9wYWdhdGUobmFtZSwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQob3B0aW9ucyB8fCB7fSwgeyBjdXJyZW50VGFyZ2V0OiB0aGlzIH0pIC8vIGN1cnJlbnRUYXJnZXQg5Li65b2T5YmNdmlld1xuICAgICAgICBpZiAoIV8uaGFzKG9wdGlvbnMsICd0YXJnZXQnKSkgb3B0aW9ucy50YXJnZXQgPSB0aGlzIC8vIHRhcmdldCDkuLrkvKDmkq3otbfngrlcblxuICAgICAgICB0aGlzLiRjYWxsSG9vayhuYW1lLCBvcHRpb25zKVxuICAgICAgICB0aGlzLiRlYWNoU3VidmlldyhmdW5jdGlvbihzdWJ2aWV3KSB7XG4gICAgICAgICAgICBzdWJ2aWV3LiRwcm9wYWdhdGUobmFtZSwgb3B0aW9ucylcbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cbiAgICAvLyDlkJHlpJblhpLms6Hkuovku7ZcbiAgICAkZGlzcGF0Y2gobmFtZSwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQob3B0aW9ucyB8fCB7fSwgeyBjdXJyZW50VGFyZ2V0OiB0aGlzIH0pIC8vIGN1cnJlbnRUYXJnZXQg5Li65b2T5YmNdmlld1xuICAgICAgICBpZiAoIV8uaGFzKG9wdGlvbnMsICd0YXJnZXQnKSkgb3B0aW9ucy50YXJnZXQgPSB0aGlzIC8vIHRhcmdldCDkuLrlhpLms6HotbfngrlcblxuICAgICAgICB0aGlzLiRjYWxsSG9vayhuYW1lLCBvcHRpb25zKVxuICAgICAgICBpZiAodGhpcy5fX3N1cGVydmlld19fKSB0aGlzLl9fc3VwZXJ2aWV3X18uJGRpc3BhdGNoKG5hbWUsIG9wdGlvbnMpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2sobWV0aG9kKSB7XG4gICAgICAgIF8uZWFjaCh0aGlzLl9fc3Vidmlld3NfXywgZnVuY3Rpb24oc3Vidmlldykge1xuICAgICAgICAgICAgc3Vidmlldy4kY2FsbEhvb2sobWV0aG9kLCBzdWJ2aWV3KVxuICAgICAgICAgICAgc3Vidmlldy4kcHJvcGFnYXRlTGlmZUN5Y2xlSG9vayhtZXRob2QpXG4gICAgICAgIH0pXG4gICAgfVxufSlcblxuXG4vLyDlsIYgdW5kZXJzY29yZSDnmoTpg6jliIbpm4blkIjmlrnms5XliqDlhaUgdmlldyDnmoTljp/lnovvvIznlKjku6Xmk43kvZzlrZDop4blm75cbl8uZWFjaCh7XG4gICAgbWFwOiAnXyRtYXAnLFxuICAgIHJlZHVjZTogJ18kcmVkdWNlJyxcbiAgICBmaW5kOiAnXyRmaW5kJyxcbiAgICBmaWx0ZXI6ICdfJGZpbHRlcicsXG4gICAgcmVqZWN0OiAnXyRyZWplY3QnLFxuICAgIGV2ZXJ5OiAnXyRldmVyeScsXG4gICAgc29tZTogJ18kc29tZScsXG4gICAgaW5jbHVkZXM6ICdfJGluY2x1ZGVzJ1xufSwgKHZpZXdNZXRob2QsIF9tZXRob2QpPT57XG4gICAgRGJiVmlldy5wcm90b3R5cGVbdmlld01ldGhvZF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgbGV0IGFyZ3MgPSBfLnRvQXJyYXkoYXJndW1lbnRzKVxuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5fX3N1YnZpZXdzX18gfHwgW10pXG4gICAgICAgIHJldHVybiBfW19tZXRob2RdLmFwcGx5KF8sIGFyZ3MpXG4gICAgfVxufSlcblxuXG4vLyDmianlsZUgZXh0ZW5kIOaWueazlVxuY29uc3QgZXh0ZW5kID0gRGJiVmlldy5leHRlbmQgPSBmdW5jdGlvbihwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuICAgIGNvbnN0IFBhcmVudCA9IHRoaXNcblxuICAgIHZhciBEYmJWaWV3XG4gICAgaWYgKHByb3RvUHJvcHMgJiYgXy5oYXMocHJvdG9Qcm9wcywgJ2NvbnN0cnVjdG9yJykpIHtcbiAgICAgICAgRGJiVmlldyA9IHByb3RvUHJvcHMuY29uc3RydWN0b3JcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIERiYlZpZXcgPSBmdW5jdGlvbiBEYmJWaWV3KCkge1xuICAgICAgICAgICAgcmV0dXJuIFBhcmVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBEYmIg6aKd5aSW5omp5bGV5Yqf6IO9IC0tLS1cbiAgICBpZiAocHJvdG9Qcm9wcykge1xuICAgICAgICAvLyDlkIjlubYgZXZlbnRzXG4gICAgICAgIGlmIChwcm90b1Byb3BzLnNob3VsZE1lcmdlRXZlbnRzKSB7XG4gICAgICAgICAgICBwcm90b1Byb3BzLmV2ZW50cyA9IF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgICAgIF8ucmVzdWx0KFBhcmVudC5wcm90b3R5cGUsICdldmVudHMnKSxcbiAgICAgICAgICAgICAgICBfLnJlc3VsdChwcm90b1Byb3BzLCAnZXZlbnRzJylcbiAgICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgICAvLyDlkIjlubYgaW5pdGlhbGl6ZVxuICAgICAgICBpZiAocHJvdG9Qcm9wcy5zaG91bGRNZXJnZUluaXRpYWxpemUpIHtcbiAgICAgICAgICAgIGxldCBfaW5pdCA9IHByb3RvUHJvcHMuaW5pdGlhbGl6ZVxuICAgICAgICAgICAgcHJvdG9Qcm9wcy5pbml0aWFsaXplID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIFBhcmVudC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIG9wdGlvbnMpXG4gICAgICAgICAgICAgICAgX2luaXQuY2FsbCh0aGlzLCBvcHRpb25zKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHByb3RvUHJvcHMgPSBfLm9taXQocHJvdG9Qcm9wcywgWydzaG91bGRNZXJnZUV2ZW50cycsICdzaG91bGRNZXJnZUluaXRpYWxpemUnXSlcbiAgICB9XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gICAgXy5leHRlbmQoRGJiVmlldywgUGFyZW50LCBzdGF0aWNQcm9wcylcbiAgICBEYmJWaWV3LnByb3RvdHlwZSA9IF8uY3JlYXRlKFBhcmVudC5wcm90b3R5cGUsIHByb3RvUHJvcHMpXG4gICAgRGJiVmlldy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBEYmJWaWV3XG4gICAgRGJiVmlldy5fX3N1cGVyX18gPSBQYXJlbnQucHJvdG90eXBlXG4gICAgcmV0dXJuIERiYlZpZXdcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IERiYlZpZXdcbiJdfQ==
