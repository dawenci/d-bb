(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

// 执行配置

require('./lib/config');

var eventbus = require('./lib/core/mixin/eventbus');
var Dbb = window.Dbb = {};
Dbb.$broadcast = eventbus.broacast;
Dbb.$listenToBus = eventbus.listenToBus;

Dbb.Collection = Backbone.Collection;
Dbb.Model = Backbone.Model;
Dbb.Events = Backbone.Events;
Dbb.$ = Backbone.$;
Dbb.View = require('./lib/core/view');
Dbb.CollectionView = require('./lib/collection-view');

module.exports = Dbb;

},{"./lib/collection-view":2,"./lib/config":3,"./lib/core/mixin/eventbus":7,"./lib/core/view":10}],2:[function(require,module,exports){
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
        var tempArr = undefined;
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

},{"./core/view":10}],3:[function(require,module,exports){

// underscore template settings
// _.templateSettings = {
//     evaluate: /\{\%(.+?)\%\}/g,
//     interpolate: /\{\{(.+?)\}\}/g,
//     escape: /\{\{-(.+?)\}\}/g
// }
"use strict";

},{}],4:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var DbbObject = require('../dbb-object');
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
    var get = undefined;
    var set = undefined;

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

    var info = { host: host, field: field, get: get, set: set };

    // set cache
    this.set('ui_update_info', info);
    return info;
  },


  // getter, setter
  UI: {
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
        return $el.html() !== value && $el.html(value);
      }
    },
    prop: {
      get: function get($el, field, dataKey) {
        return $el.prop(field);
      },
      set: function set($el, field, value, dataKey) {
        return $el.prop(field) !== value && $el.prop(field, value);
      }
    },
    data: {
      get: function get($el, field, dataKey) {
        return $el.data(field);
      },
      set: function set($el, field, value, dataKey) {
        return $el.data(field) !== value && $el.data(field, value);
      }
    },
    attr: {
      get: function get($el, field, dataKey) {
        return $el.attr(field);
      },
      set: function set($el, field, value, dataKey) {
        return $el.attr(field) !== value && $el.attr(field, value);
      }
    }
  },

  updateUI: function updateUI(value) {
    var $el = this.$el();
    if ($el.length === 0) return;
    var info = this.ui_update_info();
    var updater = undefined;
    var setter = undefined;

    // 使用 view 中定义的存取器
    // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
    // 也可以是一个对象，内部包含 get&set方法
    if (info.host === 'view') {
      updater = this.view[info.field];
      if (updater && updater.set) setter = updater.set;else if (_.isFunction(updater)) setter = updater;
    }

    // 内置的 UI 存取器
    if (!updater || !setter) {
      updater = this.UI[info.set];
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
    var updater = undefined;
    var getter = undefined;

    // 使用 view 中定义的存取器
    // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
    // 也可以是一个对象，内部包含 get&set方法
    if (info.host === 'view') {
      updater = this.view[info.field];
      if (updater && updater.get) getter = updater.get;else if (_.isFunction(updater)) getter = updater;
    }

    // 内置的 UI 存取器
    if (!updater || !getter) {
      updater = this.UI[info.get];
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

},{"../dbb-object":6}],5:[function(require,module,exports){
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
var lifeCircle = require('./mixin/life-circle');
var eventbus = require('./mixin/eventbus');

// DbbObject 对象基类，控制器等由此派生
function DbbObject() {
    this.__isRetained__ = 1;
}

// 定义原型方法
_.extend(DbbObject.prototype, Dbb.Events, {
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
DbbObject.extend = Dbb.Model.extend;

module.exports = DbbObject;

},{"./mixin/eventbus":7,"./mixin/life-circle":8,"./mixin/utils":9}],7:[function(require,module,exports){
"use strict";

var eventbus = _.extend({}, Backbone.Events);

exports.broacast = function broacast() {
  eventbus.trigger.apply(eventbus, _.toArray(arguments));
  return this;
};

exports.listenToBus = function listenToBus(name, callback) {
  var ctx = _.isFunction(this.listenTo) ? this : eventbus;
  ctx.listenTo(eventbus, name, callback);
  return this;
};

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
'use strict';

// 调用钩子函数、触发同名事件
exports.callHook = function (name) {
    // 'after:send' => 'afterSend'
    var method = _.map(String(name).split(':'), function (s, i) {
        return i > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }).join('');

    if (_.isFunction(this[method])) {
        this[method].apply(this, _.rest(arguments));
    }
    if (_.isFunction(this.trigger)) this.trigger.apply(this, _.toArray(arguments));
    return this;
};

},{}],10:[function(require,module,exports){
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

        // 调用父类构造函数
        // 顺序不能变，否则在继承Dbb.View的子类中，initialize会早于constructor执行，
        // 导致this.options的值是undefined
        Backbone.View.call(this, options);
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
        var _this2 = this;

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
            (function () {
                var $childrenFragment = undefined;

                // 把subview.el 暂移到 fragment 里，以便后续重新渲染当前视图后append回来
                if (_this2.$isNotEmpty()) {
                    $childrenFragment = $(document.createDocumentFragment());
                    _this2.$eachSubview(function (view) {
                        return $childrenFragment.append(view.$el);
                    });
                }

                // 使用数据渲染模板，并刷新dom
                var data = _this2.$dataForView(model);

                _this2.$el.html(template(data));

                _this2.__$mountPoint__ = _.result(_this2, '$mountPointForSubview', _this2.$el).eq(0); // 刷新/设置挂载点

                // 将子View 的el 插回来
                if ($childrenFragment) _this2.__$mountPoint__.append($childrenFragment);
            })();
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
        return _.result(model, 'toJSON', Object(model));
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

        var _$getOption = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillMount', 'shouldPropagateViewDidMount', 'transition']);

        var supportLifeCycle = _$getOption.supportLifeCycle;
        var shouldPropagateViewWillMount = _$getOption.shouldPropagateViewWillMount;
        var shouldPropagateViewDidMount = _$getOption.shouldPropagateViewDidMount;
        var transition = _$getOption.transition;


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

        var _$getOption2 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillUnmount', 'shouldPropagateViewDidUnmount', 'transition']);

        var supportLifeCycle = _$getOption2.supportLifeCycle;
        var shouldPropagateViewWillUnmount = _$getOption2.shouldPropagateViewWillUnmount;
        var shouldPropagateViewDidUnmount = _$getOption2.shouldPropagateViewDidUnmount;
        var transition = _$getOption2.transition;


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
     * @param {Dbb.View} subview
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
        var _this3 = this;

        if (!options) options = {};

        // console.log('addSubview')
        var viewsCount = undefined;
        // views 参数接受一个单独的视图，或一个视图数组，需要分别处理
        // 1. 过滤掉无效的视图
        // 2. 如果是一个单独的视图，也转换成只有一个元素的数组统一处理
        if (_.isArray(views)) {
            views = _.filter(views, function (view) {
                return view instanceof DbbView && view.$isRetained() && !_this3.$hasSubview(view);
            }, this);

            if (!(viewsCount = views.length)) return this;
        } else {
            if (!(views && views instanceof DbbView && views.$isRetained() && !this.$hasSubview(views))) return this;

            views = [views];
            viewsCount = 1;
        }

        // 处理参数：处理options

        var _$getOption3 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillMount', 'shouldPropagateViewDidMount', 'shouldDelegateEvents', 'transition', 'atIndex']);

        var supportLifeCycle = _$getOption3.supportLifeCycle;
        var shouldPropagateViewWillMount = _$getOption3.shouldPropagateViewWillMount;
        var shouldPropagateViewDidMount = _$getOption3.shouldPropagateViewDidMount;
        var shouldDelegateEvents = _$getOption3.shouldDelegateEvents;
        var transition = _$getOption3.transition;
        var atIndex = _$getOption3.atIndex;

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
        var i = undefined;
        if (shouldDelegateEvents) {
            for (i = 0; i < viewsCount; i += 1) {
                delegateEvents.call(this, views[i]);
            }
        }

        // 渲染好superview模板，待subview的DOM插入
        if (!this.$isRendered()) this.$render();

        // 渲染好subview的模板，待插入
        var current = undefined;
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
     * @param {Dbb.View | Number | String} view // subview or index number or 'first', 'last'
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

        var _$getOption4 = this.$getOption(options, ['supportLifeCycle', 'shouldPropagateViewWillUnMount', 'shouldPropagateViewDidUnMount', 'shouldPreventDealloc', 'transition']);

        var supportLifeCycle = _$getOption4.supportLifeCycle;
        var shouldPropagateViewWillUnMount = _$getOption4.shouldPropagateViewWillUnMount;
        var shouldPropagateViewDidUnMount = _$getOption4.shouldPropagateViewDidUnMount;
        var shouldPreventDealloc = _$getOption4.shouldPreventDealloc;
        var transition = _$getOption4.transition;


        var subviews = this.__subviews__;

        // 确定atIndex的值
        var atIndex = undefined;
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
        var i = undefined;
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

module.exports = DbbView;

},{"./binder":5,"./mixin/eventbus":7,"./mixin/life-circle":8,"./mixin/utils":9}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9jb2xsZWN0aW9uLXZpZXcuanMiLCJsaWIvY29uZmlnL2luZGV4LmpzIiwibGliL2NvcmUvYmluZGVyL2JpbmRpbmctcmVjb3JkLmpzIiwibGliL2NvcmUvYmluZGVyL2luZGV4LmpzIiwibGliL2NvcmUvZGJiLW9iamVjdC5qcyIsImxpYi9jb3JlL21peGluL2V2ZW50YnVzLmpzIiwibGliL2NvcmUvbWl4aW4vbGlmZS1jaXJjbGUuanMiLCJsaWIvY29yZS9taXhpbi91dGlscy5qcyIsImxpYi9jb3JlL3ZpZXcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7OztBQUdBLFFBQVEsY0FBUjs7QUFHQSxJQUFJLFdBQVcsUUFBUSwyQkFBUixDQUFYO0FBQ0osSUFBSSxNQUFNLE9BQU8sR0FBUCxHQUFhLEVBQWI7QUFDVixJQUFJLFVBQUosR0FBaUIsU0FBUyxRQUFUO0FBQ2pCLElBQUksWUFBSixHQUFtQixTQUFTLFdBQVQ7O0FBRW5CLElBQUksVUFBSixHQUFxQixTQUFTLFVBQVQ7QUFDckIsSUFBSSxLQUFKLEdBQXFCLFNBQVMsS0FBVDtBQUNyQixJQUFJLE1BQUosR0FBcUIsU0FBUyxNQUFUO0FBQ3JCLElBQUksQ0FBSixHQUFxQixTQUFTLENBQVQ7QUFDckIsSUFBSSxJQUFKLEdBQXFCLFFBQVEsaUJBQVIsQ0FBckI7QUFDQSxJQUFJLGNBQUosR0FBcUIsUUFBUSx1QkFBUixDQUFyQjs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsR0FBakI7OztBQ2xCQTs7QUFFQSxJQUFNLFVBQVUsUUFBUSxhQUFSLENBQVY7O0FBRU4sSUFBTSxnQkFBZ0I7QUFDbEIsNENBQWUsS0FBSztBQUNoQixZQUFJLEdBQUosQ0FBUSxZQUFSLEVBQXFCLEVBQXJCLEVBRGdCO0FBRWhCLFlBQUks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QUFELEVBQWEsT0FBYixFQUF1QjtBQUN0QixZQUFRLFNBQVIsQ0FBa0IsVUFBbEIsSUFBZ0MsWUFBVztBQUN2QyxZQUFJLE9BQU8sRUFBRSxPQUFGLENBQVUsU0FBVixDQUFQLENBRG1DO0FBRXZDLGFBQUssT0FBTCxDQUFhLEtBQUssWUFBTCxJQUFxQixFQUFyQixDQUFiLENBRnVDO0FBR3ZDLGVBQU8sRUFBRSxPQUFGLEVBQVcsS0FBWCxDQUFpQixDQUFqQixFQUFvQixJQUFwQixDQUFQLENBSHVDO0tBQVgsQ0FEVjtDQUF2QixDQVRIOztBQW1CQSxPQUFPLE9BQVAsR0FBaUIsT0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnXG5cbi8vIOaJp+ihjOmFjee9rlxucmVxdWlyZSgnLi9saWIvY29uZmlnJylcblxuXG52YXIgZXZlbnRidXMgPSByZXF1aXJlKCcuL2xpYi9jb3JlL21peGluL2V2ZW50YnVzJylcbnZhciBEYmIgPSB3aW5kb3cuRGJiID0ge31cbkRiYi4kYnJvYWRjYXN0ID0gZXZlbnRidXMuYnJvYWNhc3RcbkRiYi4kbGlzdGVuVG9CdXMgPSBldmVudGJ1cy5saXN0ZW5Ub0J1c1xuXG5EYmIuQ29sbGVjdGlvbiAgICAgPSBCYWNrYm9uZS5Db2xsZWN0aW9uXG5EYmIuTW9kZWwgICAgICAgICAgPSBCYWNrYm9uZS5Nb2RlbFxuRGJiLkV2ZW50cyAgICAgICAgID0gQmFja2JvbmUuRXZlbnRzXG5EYmIuJCAgICAgICAgICAgICAgPSBCYWNrYm9uZS4kXG5EYmIuVmlldyAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYi9jb3JlL3ZpZXcnKVxuRGJiLkNvbGxlY3Rpb25WaWV3ID0gcmVxdWlyZSgnLi9saWIvY29sbGVjdGlvbi12aWV3JylcblxubW9kdWxlLmV4cG9ydHMgPSBEYmJcbiIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBEYmJWaWV3ID0gcmVxdWlyZSgnLi9jb3JlL3ZpZXcnKVxuXG5jb25zdCBhZGRUcmFuc2l0aW9uID0ge1xuICAgIHN1YnZpZXdXaWxsQWRkKCRlbCkge1xuICAgICAgICAkZWwuY3NzKCd0cmFuc2l0aW9uJywnJylcbiAgICAgICAgJGVsLmNzcygnb3BhY2l0eScsIDApXG4gICAgfSxcbiAgICBzdWJ2aWV3RGlkQWRkKCRlbCkge1xuICAgICAgICAkZWwuY3NzKCd0cmFuc2l0aW9uJywgJ29wYWNpdHkgLjJzJylcbiAgICAgICAgJGVsLmNzcygnb3BhY2l0eScsIDEpXG4gICAgfVxufVxuY29uc3QgYWRkVHJhbnNpdGlvbkFuZFNvcnQgPSB7XG4gICAgc3Vidmlld1dpbGxBZGQoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCcnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMClcbiAgICB9LFxuICAgIHN1YnZpZXdEaWRBZGQoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCAnb3BhY2l0eSAuMnMnKVxuICAgIH1cbn1cbmNvbnN0IHJlbW92ZVRyYW5zaXRpb24gPSB7XG4gICAgc3Vidmlld1dpbGxSZW1vdmUoJGVsKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCcnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMSlcbiAgICB9LFxuICAgIHN1YnZpZXdEaWRSZW1vdmUoJGVsLCBkb25lKSB7XG4gICAgICAgICRlbC5jc3MoJ3RyYW5zaXRpb24nLCAnb3BhY2l0eSAuMnMnKVxuICAgICAgICAkZWwuY3NzKCdvcGFjaXR5JywgMClcbiAgICAgICAgc2V0VGltZW91dChkb25lLCAyMDApXG4gICAgfVxufVxuXG5cbmZ1bmN0aW9uIGFwcGVuZFBsYWNlaG9sZGVyKCkge1xuICAgIGxldCBwbGFjZWhvbGRlciA9IF8ucmVzdWx0KHRoaXMsICdwbGFjZWhvbGRlcicpXG4gICAgaWYgKHBsYWNlaG9sZGVyKSB7XG4gICAgICAgIGxldCAkbW91bnRQb2ludCA9IF8ucmVzdWx0KHRoaXMsICckbW91bnRQb2ludEZvclN1YnZpZXcnKVxuICAgICAgICBpZiAoISRtb3VudFBvaW50LmZpbmQocGxhY2Vob2xkZXIpLmxlbmd0aCkge1xuICAgICAgICAgICAgJG1vdW50UG9pbnQuYXBwZW5kKHBsYWNlaG9sZGVyKVxuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gcmVtb3ZlUGxhY2Vob2xkZXIoKSB7XG4gICAgbGV0IHBsYWNlaG9sZGVyID0gXy5yZXN1bHQodGhpcywgJ3BsYWNlaG9sZGVyJylcbiAgICBpZiAocGxhY2Vob2xkZXIpIHtcbiAgICAgICAgbGV0ICRtb3VudFBvaW50ID0gXy5yZXN1bHQodGhpcywgJyRtb3VudFBvaW50Rm9yU3VidmlldycpXG4gICAgICAgIGlmICgkbW91bnRQb2ludC5maW5kKHBsYWNlaG9sZGVyKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIChwbGFjZWhvbGRlciBpbnN0YW5jZW9mICQpID8gcGxhY2Vob2xkZXIuZGV0YWNoKCkgOiAkKHBsYWNlaG9sZGVyKS5kZXRhY2goKVxuICAgICAgICB9XG4gICAgfVxufVxuZnVuY3Rpb24gdXBkYXRlUGxhY2Vob2xkZXIoKSB7XG4gICAgaWYgKHRoaXMuJGNvdW50KCkpIHJlbW92ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcbiAgICBlbHNlIGFwcGVuZFBsYWNlaG9sZGVyLmNhbGwodGhpcylcbn1cblxuXG5mdW5jdGlvbiBvbkl0ZW1BZGRlZChtb2RlbCwgY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgbGV0IHZpZXcgPSB0aGlzLiR2aWV3Rm9ySXRlbShtb2RlbCwgY29sbGVjdGlvbikuJHJlbmRlcigpXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX2FkZFRpbWVyKVxuICAgIGlmICghdGhpcy5fYnVmZmVyKSB0aGlzLl9idWZmZXIgPSBbXVxuICAgIHRoaXMuX2J1ZmZlci5wdXNoKHZpZXcpXG4gICAgdGhpcy5fYWRkVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgLy8gY29uc29sZS5sb2coJ2FkZCB0aW1lb3V0JylcbiAgICAgICAgLy8g5L+u5aSNYWRk5pe277yM5LiN5Lya6YeN5paw5o6S5bqPXG4gICAgICAgIC8vIOehruS/neWmguaenOayoeacieS8oOWFpXNvcnQ6ZmFsc2XnmoRvcHRpb24sIOaJjemHjeaWsOaOkuW6j1xuICAgICAgICAvLyDmjpLluo/liqjnlLvvvIzot59hZGTliqjnlLvlj6rkuIDkuKrnlJ/mlYhcbiAgICAgICAgaWYgKG9wdGlvbnMuc29ydCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHRoaXMuJGFkZFN1YnZpZXcodGhpcy5fYnVmZmVyLCB7XG4gICAgICAgICAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogYWRkVHJhbnNpdGlvbkFuZFNvcnRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBvbkl0ZW1zU29ydGVkLmNhbGwodGhpcywgdGhpcy5jb2xsZWN0aW9uLCB7fSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuJGFkZFN1YnZpZXcodGhpcy5fYnVmZmVyLCB7XG4gICAgICAgICAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgICAgICAgICAgdHJhbnNpdGlvbjogYWRkVHJhbnNpdGlvblxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIFxuICAgICAgICB0aGlzLl9idWZmZXIubGVuZ3RoID0gMFxuICAgICAgICB0aGlzLnRyaWdnZXIoJ2l0ZW1EaWRBZGQnKVxuXG4gICAgfSwgMClcblxuICAgIHVwZGF0ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcblxuICAgIHJldHVybiB0aGlzXG59XG5cblxuZnVuY3Rpb24gb25JdGVtUmVtb3ZlZChtb2RlbCwgY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIHRoaXMuJHJlbW92ZVN1YnZpZXcob3B0aW9ucy5pbmRleCwge1xuICAgICAgICB0cmFuc2l0aW9uOiByZW1vdmVUcmFuc2l0aW9uXG4gICAgfSlcbiAgICB0aGlzLnRyaWdnZXIoJ2l0ZW1EaWRSZW1vdmUnKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuXG5mdW5jdGlvbiBvbkl0ZW1zUmVzZXQoY29sbGVjdGlvbiwgb3B0aW9ucykge1xuICAgIHVwZGF0ZVBsYWNlaG9sZGVyLmNhbGwodGhpcylcbiAgICBcbiAgICB0aGlzLiRlbXB0eVN1YnZpZXdzKClcblxuICAgIGxldCB2aWV3cyA9IFtdXG4gICAgY29sbGVjdGlvbi5lYWNoKGZ1bmN0aW9uKG1vZGVsLCBpLCBjb2xsZWN0aW9uKXtcbiAgICAgICAgdmlld3MucHVzaCh0aGlzLiR2aWV3Rm9ySXRlbShtb2RlbCwgY29sbGVjdGlvbikpXG4gICAgfSwgdGhpcylcblxuICAgIHRoaXMuJGFkZFN1YnZpZXcodmlld3MsIHtcbiAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IHRydWUsXG4gICAgICAgIHRyYW5zaXRpb246IGFkZFRyYW5zaXRpb25cbiAgICB9KVxuXG4gICAgdGhpcy50cmlnZ2VyKCdpdGVtRGlkUmVzZXQnKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuZnVuY3Rpb24gb25JdGVtc1NvcnRlZChjb2xsZWN0aW9uLCBvcHRpb25zKSB7XG4gICAgaWYgKCF0aGlzLiRpc05vdEVtcHR5KCkpIHJldHVybiB0aGlzXG5cbiAgICBsZXQgc2VsZiA9IHRoaXNcbiAgICAvLyBhZGTnlKjkuoblrprml7blmajvvIxzb3J05Lya5Y+R55Sf5ZyoYWRk5YmN77yMc3Vidmlld+eahOaVsOmHj+S8muavlG1vZGVs5bCR77yM5omA5Lul6KaB5aSE55CG5LiLXG4gICAgdGhpcy5fc29ydFRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdzb3J0IHRpbWVvdXQnKVxuICAgICAgICB2YXIgc3Vidmlld3MsICRtb3VudFBvaW50LCBkaXNwbGF5LCAkZnJhZ21lbnRcbiAgICAgICAgbGV0IHRlbXBBcnJcbiAgICAgICAgbGV0IGxlbiA9IHNlbGYuJGNvdW50KClcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24ubGVuZ3RoID09PSBsZW4pIHtcbiAgICAgICAgICAgIHN1YnZpZXdzID0gc2VsZi4kZ2V0U3Vidmlld3MoKVxuICAgICAgICAgICAgdGVtcEFyciA9IG5ldyBBcnJheShsZW4pXG5cbiAgICAgICAgICAgIC8vIOWFiOaOkuW6j1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleCA9IGNvbGxlY3Rpb24uaW5kZXhPZihzdWJ2aWV3c1tpXS5tb2RlbClcbiAgICAgICAgICAgICAgICB0ZW1wQXJyW2luZGV4XSA9IHN1YnZpZXdzW2ldXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOaJp+ihjOWPmOabtFxuICAgICAgICAgICAgc2VsZi5fX3N1YnZpZXdzX18gPSB0ZW1wQXJyXG4gICAgICAgICAgICAkbW91bnRQb2ludCA9IF8ucmVzdWx0KHNlbGYsICckbW91bnRQb2ludEZvclN1YnZpZXcnLCBzZWxmLiRlbClcbiAgICAgICAgICAgICRmcmFnbWVudCA9ICQoZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpKVxuICAgICAgICAgICAgc2VsZi4kZWFjaFN1YnZpZXcoZnVuY3Rpb24odmlldyl7XG4gICAgICAgICAgICAgICAgJGZyYWdtZW50LmFwcGVuZCh2aWV3LiRlbClcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAkbW91bnRQb2ludC5hcHBlbmQoJGZyYWdtZW50KVxuXG4gICAgICAgICAgICAvLyBmb3JjZSByZWZsb3dcbiAgICAgICAgICAgICRtb3VudFBvaW50LmdldCgwKS5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIC8vIHRyYW5zaXRpb25cbiAgICAgICAgICAgIHNlbGYuJGVhY2hTdWJ2aWV3KGZ1bmN0aW9uKHZpZXcpe1xuICAgICAgICAgICAgICAgIHZpZXcuJGVsLmNzcygnb3BhY2l0eScsIDEpXG4gICAgICAgICAgICAgICAgLy8gdmlldy5lbC5zdHlsZS5vcGFjaXR5ID0gMVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdpdGVtRGlkU29ydCcpXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9uSXRlbXNTb3J0ZWQuY2FsbChzZWxmLCBjb2xsZWN0aW9uLCBvcHRpb25zKVxuXG4gICAgICAgIH1cbiAgICB9LCAwKVxuXG4gICAgdXBkYXRlUGxhY2Vob2xkZXIuY2FsbCh0aGlzKVxuXG4gICAgcmV0dXJuIHRoaXNcbn1cblxuXG5jb25zdCBEYmJDb2xsZWN0aW9uVmlldyA9IERiYlZpZXcuZXh0ZW5kKHtcbiAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gRGJiQ29sbGVjdGlvblZpZXcob3B0aW9ucykge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGJiQ29sbGVjdGlvblZpZXcpKSByZXR1cm4gbmV3IERiYkNvbGxlY3Rpb25WaWV3KG9wdGlvbnMpXG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbikgdGhpcy4kc2V0Q29sbGVjdGlvbihvcHRpb25zLmNvbGxlY3Rpb24pXG4gICAgICAgIERiYlZpZXcuY2FsbCh0aGlzLCBvcHRpb25zKVxuICAgIH0sXG5cbiAgICAkc2V0Q29sbGVjdGlvbihjb2xsZWN0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbGxlY3Rpb24pIHRoaXMuc3RvcExpc3RlbmluZyh0aGlzLmNvbGxlY3Rpb24pXG4gICAgICAgIHRoaXMuY29sbGVjdGlvbiA9IGNvbGxlY3Rpb25cbiAgICAgICAgdGhpcy5saXN0ZW5Ubyhjb2xsZWN0aW9uLCAnYWRkJywgb25JdGVtQWRkZWQpXG4gICAgICAgIHRoaXMubGlzdGVuVG8oY29sbGVjdGlvbiwgJ3JlbW92ZScsIG9uSXRlbVJlbW92ZWQpXG4gICAgICAgIHRoaXMubGlzdGVuVG8oY29sbGVjdGlvbiwgJ3Jlc2V0Jywgb25JdGVtc1Jlc2V0KVxuICAgICAgICB0aGlzLmxpc3RlblRvKGNvbGxlY3Rpb24sICdzb3J0Jywgb25JdGVtc1NvcnRlZClcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgLy8gb3ZlcnJpZGVcbiAgICAkdmlld0Zvckl0ZW0obW9kZWwsIGNvbGxlY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYmJWaWV3KHsgbW9kZWwgfSlcbiAgICB9LFxuXG4gICAgJHJlbmRlckl0ZW1zKCkge1xuICAgICAgICB0aGlzLiR1cGRhdGVQbGFjZWhvbGRlci5jYWxsKHRoaXMpXG5cbiAgICAgICAgLy8gY29sbGVjdGlvbiDmnInljp/lp4vmlbDmja7vvIzliJnmuLLmn5NcbiAgICAgICAgaWYgKHRoaXMuY29sbGVjdGlvbi5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuJGVtcHR5U3Vidmlld3MoKVxuXG4gICAgICAgICAgICB2YXIgdmlld3MgPSBbXVxuICAgICAgICAgICAgdGhpcy5jb2xsZWN0aW9uLmVhY2goZnVuY3Rpb24obW9kZWwsIGksIGNvbGxlY3Rpb24pe1xuICAgICAgICAgICAgICAgIHZpZXdzLnB1c2godGhpcy4kdmlld0Zvckl0ZW0obW9kZWwsIGNvbGxlY3Rpb24pKVxuICAgICAgICAgICAgfSwgdGhpcylcblxuICAgICAgICAgICAgdGhpcy4kYWRkU3Vidmlldyh2aWV3cywge1xuICAgICAgICAgICAgICAgIHNob3VsZERlbGVnYXRlRXZlbnRzOiB0cnVlLFxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb246IGFkZFRyYW5zaXRpb25cbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHVwZGF0ZVBsYWNlaG9sZGVyKCkge1xuICAgICAgICB1cGRhdGVQbGFjZWhvbGRlci5jYWxsKHRoaXMpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfVxufSlcblxubW9kdWxlLmV4cG9ydHMgPSBEYmJDb2xsZWN0aW9uVmlld1xuIiwiXG4vLyB1bmRlcnNjb3JlIHRlbXBsYXRlIHNldHRpbmdzXG4vLyBfLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG4vLyAgICAgZXZhbHVhdGU6IC9cXHtcXCUoLis/KVxcJVxcfS9nLFxuLy8gICAgIGludGVycG9sYXRlOiAvXFx7XFx7KC4rPylcXH1cXH0vZyxcbi8vICAgICBlc2NhcGU6IC9cXHtcXHstKC4rPylcXH1cXH0vZ1xuLy8gfVxuXCJ1c2Ugc3RyaWN0XCI7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJaUlzSW1acGJHVWlPaUpwYm1SbGVDNXFjeUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiWFgwPSIsIid1c2Ugc3RyaWN0J1xuXG5jb25zdCBEYmJPYmplY3QgPSByZXF1aXJlKCcuLi9kYmItb2JqZWN0JylcbmNvbnN0IEJpbmRpbmdSZWNvcmQgPSBEYmJPYmplY3QuZXh0ZW5kKHtcbiAgICBjb25zdHJ1Y3RvcjogZnVuY3Rpb24gQmluZGluZ1JlY29yZCh2aWV3LCBtb2RlbCwgZGF0YSkge1xuICAgICAgRGJiT2JqZWN0LmNhbGwodGhpcylcbiAgICAgIGxldCBvcHRpb25zID0geyB2aWV3LCBtb2RlbCwgZGF0YSB9XG4gICAgICBfLmV4dGVuZCh0aGlzLCBvcHRpb25zKVxuICAgICAgXy5pc0Z1bmN0aW9uKHRoaXMuaW5pdGlhbGl6ZSkgJiYgdGhpcy5pbml0aWFsaXplKClcbiAgICB9LFxuXG4gICAgJGRlYWxsb2MoKSB7XG4gICAgICB0aGlzLnVuYmluZCgpXG4gICAgICBEYmJPYmplY3QucHJvdG90eXBlLiRkZWFsbG9jLmNhbGwodGhpcylcbiAgICB9LFxuXG4gICAgZ2V0KGtleSwgZGVmYXVsdHMpIHtcbiAgICAgIHJldHVybiBfLnJlc3VsdCh0aGlzLmRhdGEsIGtleSwgZGVmYXVsdHMpXG4gICAgfSxcblxuICAgIHNldChrZXksIHZhbCkge1xuICAgICAgbGV0IGJlZm9yZSA9IHt9XG4gICAgICBsZXQgY2hhbmdlZCA9IHt9XG5cbiAgICAgIGxldCBwcmV2ID0gdGhpcy5nZXQoa2V5KVxuICAgICAgaWYgKCh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJyB8fCB0eXBlb2Yga2V5ID09PSAnbnVtYmVyJykgJiYgcHJldiAhPT0gdmFsKSB7XG4gICAgICAgIGJlZm9yZVtrZXldID0gcHJldlxuICAgICAgICBjaGFuZ2VkW2tleV0gPSB2YWxcbiAgICAgICAgdGhpcy5kYXRhW2tleV0gPSB2YWxcbiAgICAgICAgdGhpcy50cmlnZ2VyKGBjaGFuZ2U6JHtrZXl9YCwgdGhpcywgdmFsLCB7IHByZXYgfSlcbiAgXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBrZXkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIF8uZWFjaChrZXksICh2YWwsIGtleSkgPT4ge1xuICAgICAgICAgIGxldCBwcmV2ID0gdGhpcy5nZXQoa2V5KVxuICAgICAgICAgIGlmIChwcmV2ICE9PSB2YWwpIHtcbiAgICAgICAgICAgIGJlZm9yZVtrZXldID0gcHJldlxuICAgICAgICAgICAgY2hhbmdlZFtrZXldID0gdmFsXG4gICAgICAgICAgICB0aGlzLmRhdGFba2V5XSA9IHZhbFxuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGBjaGFuZ2U6JHtrZXl9YCwgdGhpcywgdmFsLCB7IHByZXYgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIHRoaXMudHJpZ2dlcihgY2hhbmdlYCwgdGhpcywgY2hhbmdlZCwgYmVmb3JlKVxuXG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cbiAgICBzZWxlY3RvcigpIHtcbiAgICAgIGxldCBzZWxlY3RvciA9IHRoaXMuZ2V0KCdzZWxlY3RvcicpXG4gICAgICBpZiAoc2VsZWN0b3IpIHJldHVybiBzZWxlY3RvclxuXG4gICAgICAvLyDliIbpmpTnrKYgfCAsXG4gICAgICAvLyBgdmFsdWUgQCAuYWJzZGZbbmFtZT1cImFiY1wiXSAuaW5wdXQgYCA9PiBgLmFic2RmW25hbWU9XCJhYmNcIl0gLmlucHV0YFxuICAgICAgc2VsZWN0b3IgPSAkLnRyaW0odGhpcy5nZXQoJ3RhcmdldEluZm8nKS5yZXBsYWNlKC8oXihcXHMrKT9cXFMrKFxccyspP0ApKFxccyspPy8sICcnKSlcbiAgICAgIGlmIChzZWxlY3RvcikgdGhpcy5zZXQoJ3NlbGVjdG9yJywgc2VsZWN0b3IpXG4gICAgICByZXR1cm4gc2VsZWN0b3JcbiAgICB9LFxuXG4gICAgJGVsKCkge1xuICAgICAgbGV0IHNlbGVjdG9yID0gdGhpcy5zZWxlY3RvcigpXG4gICAgICByZXR1cm4gKHNlbGVjdG9yID09PSAnJGVsJykgPyB0aGlzLnZpZXcuJGVsIDogdGhpcy52aWV3LiQoc2VsZWN0b3IpXG4gICAgfSxcblxuICAgIHRhZ05hbWUoKSB7XG4gICAgICBsZXQgdGFnTmFtZSA9IHRoaXMuZ2V0KCd0YWdOYW1lJylcbiAgICAgIGlmICh0YWdOYW1lKSByZXR1cm4gdGFnTmFtZVxuICAgICAgbGV0IGVsID0gdGhpcy4kZWwoKS5nZXQoMClcbiAgICAgIHRhZ05hbWUgPSBlbCAmJiBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKClcbiAgICAgIGlmICh0YWdOYW1lKSB0aGlzLnNldCgndGFnTmFtZScsIHRhZ05hbWUpXG4gICAgICByZXR1cm4gdGFnTmFtZVxuICAgIH0sXG5cbiAgICAvLyDku44gYHR5cGVAc2VsZWN0b3JgIOS4reaPkOWPliBgdHlwZWAg6YOo5YiGXG4gICAgX3BpY2tfdXBkYXRlX2tleSgpIHtcbiAgICAgIGxldCB0eXBlID0gdGhpcy5nZXQoJ3RhcmdldEluZm8nKS5tYXRjaCgvXFxTKyhcXHMrKT9ALylcbiAgICAgIGlmICghdHlwZSkgcmV0dXJuICcnXG4gICAgICByZXR1cm4gJC50cmltKHR5cGVbMF0ucmVwbGFjZSgnQCcsJycpKVxuICAgIH0sXG4gICAgLy8gVUkg5pu05paw55qE5pa55byPXG4gICAgdWlfdXBkYXRlX2luZm8oKSB7XG4gICAgICBsZXQgY2FjaGUgPSB0aGlzLmdldCgndWlfdXBkYXRlX2luZm8nKVxuICAgICAgaWYgKGNhY2hlKSByZXR1cm4gY2FjaGVcblxuICAgICAgbGV0ICRlbCA9IHRoaXMuJGVsKClcbiAgICAgIGxldCB0YWdOYW1lID0gdGhpcy50YWdOYW1lKClcblxuICAgICAgbGV0IGhvc3QgPSAnYnVpbGRpbicgLy8gT1Igdmlld1xuICAgICAgbGV0IGtleSA9IHRoaXMuX3BpY2tfdXBkYXRlX2tleSgpXG4gICAgICBsZXQgZmllbGQgPSBrZXlcbiAgICAgIGxldCBnZXRcbiAgICAgIGxldCBzZXRcblxuICAgICAgaWYgKGtleS5zdWJzdHIoMCw1KSA9PT0gJ3ZpZXcuJykge1xuICAgICAgICBob3N0ID0gJ3ZpZXcnLFxuICAgICAgICBmaWVsZCA9IGtleS5zbGljZSg1KVxuICAgICAgfVxuXG4gICAgICBpZiAoa2V5LnN1YnN0cigwLDUpID09PSAnZGF0YS0nKSB7XG4gICAgICAgIGZpZWxkID0ga2V5LnNsaWNlKDUpXG4gICAgICAgIGdldCA9ICdkYXRhJ1xuICAgICAgICBzZXQgPSAnZGF0YSdcbiAgICAgIH1cbiAgXG4gICAgICBlbHNlIGlmICh0YWdOYW1lID09PSAnaW5wdXQnKSB7XG4gICAgICAgIGlmICgha2V5IHx8IGhvc3QgPT09ICd2aWV3Jykge1xuICAgICAgICAgIFxuICAgICAgICAgIGxldCB0eXBlID0gJGVsLmF0dHIoJ3R5cGUnKSAvLyAnJ3x1bmRlZmluZWR8b3RoZXIgLT4gJ3ZhbHVlJyAgICAgICAgICBcbiAgICAgICAgICBnZXQgPSBzZXQgPSAoKHR5cGUgIT09ICdjaGVja2JveCcgJiYgdHlwZSAhPT0gJ3JhZGlvJykgPyAndmFsdWUnIDogdHlwZSlcbiAgICBcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBnZXQgPSBzZXQgPSAoa2V5ID09PSAndmFsdWUnID8gJ3ZhbHVlJyA6ICdhdHRyJylcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0ZXh0YXJlYVxuICAgICAgaWYgKHRhZ05hbWUgPT09ICd0ZXh0YXJlYScgJiYgIWdldCAmJiAhc2V0KSB7XG4gICAgICAgIGdldCA9IHNldCA9ICd2YWx1ZSdcbiAgICAgIH1cblxuICAgICAgLy8gb3B0aW9u77ya5qC55o2ub3B0aW9u5paH5a2X5pu05paw77yMc2VsZWN0ZWQ6IOagueaNrm9wdGlvbueahHZhbHVl5pu05pawXG4gICAgICBpZiAodGFnTmFtZSA9PT0gJ3NlbGVjdCcgJiYgIWdldCAmJiAhc2V0KSB7XG4gICAgICAgIGdldCA9IHNldCA9ICgga2V5ID09PSAnb3B0aW9uJyA/ICdvcHRpb24nIDogJ3NlbGVjdGVkJyApXG4gICAgICB9XG5cbiAgICAgIC8vIOWFnOW6leiuvue9rlxuICAgICAgaWYgKCFnZXQgJiYgIXNldCkge1xuICAgICAgICBnZXQgPSBzZXQgPSAoKGtleSAmJiBrZXkgIT09ICd0ZXh0JykgPyAnYXR0cicgOiAndGV4dCcpXG4gICAgICB9IFxuXG4gICAgICBsZXQgaW5mbyA9IHsgaG9zdCwgZmllbGQsIGdldCwgc2V0IH1cblxuICAgICAgLy8gc2V0IGNhY2hlXG4gICAgICB0aGlzLnNldCgndWlfdXBkYXRlX2luZm8nLCBpbmZvKVxuICAgICAgcmV0dXJuIGluZm9cbiAgICB9LFxuXG4gICAgLy8gZ2V0dGVyLCBzZXR0ZXJcbiAgICBVSToge1xuICAgICAgdmFsdWU6IHtcbiAgICAgICAgZ2V0OiAoJGVsLCBmaWVsZCwgZGF0YUtleSk9PiRlbC52YWwoKSxcbiAgICAgICAgc2V0OiAoJGVsLCBmaWVsZCwgdmFsdWUsIGRhdGFLZXkpPT57XG4gICAgICAgICAgaWYgKCRlbC52YWwoKSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICRlbC52YWwodmFsdWUpXG4gICAgICAgICAgICAkZWwudHJpZ2dlcignY2hhbmdlJylcbiAgICAgICAgICB9IFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY2hlY2tlZDoge1xuICAgICAgICBnZXQ6ICgkZWwsIGZpZWxkLCBkYXRhS2V5KT0+JGVsLnByb3AoJ2NoZWNrZWQnKSxcbiAgICAgICAgc2V0OiAoJGVsLCBmaWVsZCwgdmFsdWUsIGRhdGFLZXkpPT57XG4gICAgICAgICAgaWYgKCRlbC5wcm9wKCdjaGVja2VkJykgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAkZWwucHJvcCgnY2hlY2tlZCcsIHZhbHVlKVxuICAgICAgICAgICAgJGVsLnRyaWdnZXIoJ2NoYW5nZScpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgc2VsZWN0ZWQ6IHtcbiAgICAgICAgZ2V0OiAoJGVsLCBmaWVsZCwgZGF0YUtleSk9Pl8uZmluZCgkZWwuZmluZCgnb3B0aW9uJyksIG9wdGlvbj0+b3B0aW9uLnNlbGVjdGVkPT09dHJ1ZSkudmFsdWUsXG4gICAgICAgIHNldDogKCRlbCwgZmllbGQsIHZhbHVlLCBkYXRhS2V5KT0+e1xuICAgICAgICAgIGxldCBvcHRpb24gPSBfLmZpbmQoJGVsLmZpbmQoJ29wdGlvbicpLG9wdGlvbj0+b3B0aW9uLnZhbHVlPT09dmFsdWUpXG4gICAgICAgICAgaWYgKG9wdGlvbiAmJiAoIW9wdGlvbi5zZWxlY3RlZCkpIHtcbiAgICAgICAgICAgIG9wdGlvbi5zZWxlY3RlZCA9IHRydWVcbiAgICAgICAgICAgICRlbC50cmlnZ2VyKCdjaGFuZ2UnKVxuICAgICAgICAgIH0gXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBvcHRpb246IHtcbiAgICAgICAgZ2V0OiAoJGVsLCBmaWVsZCwgZGF0YUtleSk9Pl8uZmluZCgkZWwuZmluZCgnb3B0aW9uJyksIG9wdGlvbj0+b3B0aW9uLnNlbGVjdGVkPT09dHJ1ZSkuaW5uZXJIVE1MLFxuICAgICAgICBzZXQ6ICgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSk9PntcbiAgICAgICAgICBsZXQgb3B0aW9uID0gXy5maW5kKCRlbC5maW5kKCdvcHRpb24nKSxvcHRpb249Pm9wdGlvbi5pbm5lckhUTUw9PT12YWx1ZSlcbiAgICAgICAgICBpZiAob3B0aW9uICYmICghb3B0aW9uLnNlbGVjdGVkKSkge1xuICAgICAgICAgICAgb3B0aW9uLnNlbGVjdGVkID0gdHJ1ZVxuICAgICAgICAgICAgJGVsLnRyaWdnZXIoJ2NoYW5nZScpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcmFkaW86IHtcbiAgICAgICAgZ2V0OiAoJGVsLCBmaWVsZCwgZGF0YUtleSk9Pl8uZmluZCgkZWwsIGVsPT5lbC5jaGVja2VkPT09dHJ1ZSkudmFsdWUsXG4gICAgICAgIHNldDogKCRlbCwgZmllbGQsIHZhbHVlLCBkYXRhS2V5KT0+e1xuICAgICAgICAgIGxldCByYWRpbyA9IF8uZmluZCgkZWwsIHJhZGlvPT5yYWRpby52YWx1ZT09PXZhbHVlKVxuICAgICAgICAgIGlmIChyYWRpbyAmJiAoIXJhZGlvLmNoZWNrZWQpKSB7XG4gICAgICAgICAgICByYWRpby5jaGVja2VkID0gdHJ1ZVxuICAgICAgICAgICAgJChyYWRpbykudHJpZ2dlcignY2hhbmdlJylcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB0ZXh0OiB7XG4gICAgICAgIGdldDogKCRlbCwgZmllbGQsIGRhdGFLZXkpPT4kZWwuaHRtbCgpLFxuICAgICAgICBzZXQ6ICgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSk9PigkZWwuaHRtbCgpICE9PSB2YWx1ZSkgJiYgJGVsLmh0bWwodmFsdWUpXG4gICAgICB9LFxuICAgICAgcHJvcDoge1xuICAgICAgICBnZXQ6ICgkZWwsIGZpZWxkLCBkYXRhS2V5KT0+JGVsLnByb3AoZmllbGQpLFxuICAgICAgICBzZXQ6ICgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSk9PigkZWwucHJvcChmaWVsZCkgIT09IHZhbHVlKSAmJiAkZWwucHJvcChmaWVsZCwgdmFsdWUpXG4gICAgICB9LFxuICAgICAgZGF0YToge1xuICAgICAgICBnZXQ6ICgkZWwsIGZpZWxkLCBkYXRhS2V5KT0+JGVsLmRhdGEoZmllbGQpLFxuICAgICAgICBzZXQ6ICgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSk9PigkZWwuZGF0YShmaWVsZCkgIT09IHZhbHVlKSAmJiAkZWwuZGF0YShmaWVsZCwgdmFsdWUpXG4gICAgICB9LFxuICAgICAgYXR0cjoge1xuICAgICAgICBnZXQ6ICgkZWwsIGZpZWxkLCBkYXRhS2V5KT0+JGVsLmF0dHIoZmllbGQpLFxuICAgICAgICBzZXQ6ICgkZWwsIGZpZWxkLCB2YWx1ZSwgZGF0YUtleSk9PigkZWwuYXR0cihmaWVsZCkgIT09IHZhbHVlKSAmJiAkZWwuYXR0cihmaWVsZCwgdmFsdWUpXG4gICAgICB9XG4gICAgfSxcblxuICAgIHVwZGF0ZVVJKHZhbHVlKSB7XG4gICAgICBsZXQgJGVsID0gdGhpcy4kZWwoKVxuICAgICAgaWYgKCRlbC5sZW5ndGggPT09IDApIHJldHVyblxuICAgICAgbGV0IGluZm8gPSB0aGlzLnVpX3VwZGF0ZV9pbmZvKClcbiAgICAgIGxldCB1cGRhdGVyXG4gICAgICBsZXQgc2V0dGVyXG5cbiAgICAgIC8vIOS9v+eUqCB2aWV3IOS4reWumuS5ieeahOWtmOWPluWZqFxuICAgICAgLy8gdmlldyDkuK3vvIx1cGRhdGVy6Ieq6Lqr5Y+v5Lul5pivIGdldHRlciZzZXR0ZXLvvIjpnIDopoHmoLnmja7kvKDlhaXlj4LmlbDoh6rooYzliKTmlq3vvIlcbiAgICAgIC8vIOS5n+WPr+S7peaYr+S4gOS4quWvueixoe+8jOWGhemDqOWMheWQqyBnZXQmc2V05pa55rOVXG4gICAgICBpZiAoaW5mby5ob3N0ID09PSAndmlldycpIHtcbiAgICAgICAgdXBkYXRlciA9IHRoaXMudmlld1tpbmZvLmZpZWxkXVxuICAgICAgICBpZiAodXBkYXRlciAmJiB1cGRhdGVyLnNldCkgc2V0dGVyID0gdXBkYXRlci5zZXRcbiAgICAgICAgZWxzZSBpZiAoXy5pc0Z1bmN0aW9uKHVwZGF0ZXIpKSBzZXR0ZXIgPSB1cGRhdGVyXG4gICAgICB9XG5cbiAgICAgIC8vIOWGhee9rueahCBVSSDlrZjlj5blmahcbiAgICAgIGlmICghdXBkYXRlciB8fCAhc2V0dGVyKSB7XG4gICAgICAgIHVwZGF0ZXIgPSB0aGlzLlVJW2luZm8uc2V0XVxuICAgICAgICBzZXR0ZXIgPSB1cGRhdGVyLnNldFxuICAgICAgfVxuICAgICAgc2V0dGVyLmNhbGwodGhpcy52aWV3LCAkZWwsIGluZm8uZmllbGQsIHZhbHVlLCB0aGlzLmdldCgnZGF0YUtleScpKVxuICAgICAgLy8gY29uc29sZS5sb2coJ1VJIGRpZCB1cGRhdGUnLCB2YWx1ZSwgaW5mbylcbiAgICB9LFxuXG4gICAgLy8g5pu05paw5qih5Z6LXG4gICAgdXBkYXRlTW9kZWwoY2hhbmdlZFZhbHVlKSB7XG4gICAgICAvLyDmiafooYzmm7TmlrBcbiAgICAgIGlmICh0aGlzLmdldCgnZGF0YUtleScpLnN1YnN0cigwLCA1KSA9PT0gJ21vZGVsLicpIHtcbiAgICAgICAgbGV0IG1ldGhvZE5hbWUgPSB0aGlzLmdldCgnZGF0YUtleScpLnNsaWNlKDUpXG4gICAgICAgIF8uaXNGdW5jdGlvbih0aGlzLm1vZGVsW21ldGhvZE5hbWVdKSAmJiB0aGlzLm1vZGVsW21ldGhvZE5hbWVdKGNoYW5nZWRWYWx1ZSlcblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1vZGVsLnNldCh0aGlzLmdldCgnZGF0YUtleScpLCBjaGFuZ2VkVmFsdWUpXG4gIFxuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coJ21vZGVsIGRpZCB1cGRhdGUnKVxuICAgIH0sXG5cblxuICAgIGdldFVJVmFsdWUoKSB7XG4gICAgICBsZXQgJGVsID0gdGhpcy4kZWwoKVxuICAgICAgaWYgKCRlbC5sZW5ndGggPT09IDApIHJldHVyblxuXG4gICAgICAvLyDnm67moIflhYPntKDkuI3mmK/ooajljZXkuqTkupLlhYPntKDnmoTml7blgJnvvIzot7Pov4dcbiAgICAgIC8vIOWQpuWImeacieWGhemDqOacieihqOWNleWFg+e0oOinpuWPkeabtOaWsO+8jOS5n+S8muinpuWPkSBtb2RlbCDmm7TmlrDlh7rnjrBidWdcbiAgICAgIGxldCB0YWdOYW1lID0gdGhpcy50YWdOYW1lKClcbiAgICAgIGlmICh0YWdOYW1lICE9PSAnaW5wdXQnICYmIHRhZ05hbWUgIT09ICd0ZXh0YXJlYScgJiYgdGFnTmFtZSAhPT0gJ3NlbGVjdCcpIHJldHVyblxuXG4gICAgICBsZXQgaW5mbyA9IHRoaXMudWlfdXBkYXRlX2luZm8oKVxuICAgICAgbGV0IHVwZGF0ZXJcbiAgICAgIGxldCBnZXR0ZXJcblxuICAgICAgLy8g5L2/55SoIHZpZXcg5Lit5a6a5LmJ55qE5a2Y5Y+W5ZmoXG4gICAgICAvLyB2aWV3IOS4re+8jHVwZGF0ZXLoh6rouqvlj6/ku6XmmK8gZ2V0dGVyJnNldHRlcu+8iOmcgOimgeagueaNruS8oOWFpeWPguaVsOiHquihjOWIpOaWre+8iVxuICAgICAgLy8g5Lmf5Y+v5Lul5piv5LiA5Liq5a+56LGh77yM5YaF6YOo5YyF5ZCrIGdldCZzZXTmlrnms5VcbiAgICAgIGlmIChpbmZvLmhvc3QgPT09ICd2aWV3Jykge1xuICAgICAgICB1cGRhdGVyID0gdGhpcy52aWV3W2luZm8uZmllbGRdXG4gICAgICAgIGlmICh1cGRhdGVyICYmIHVwZGF0ZXIuZ2V0KSBnZXR0ZXIgPSB1cGRhdGVyLmdldFxuICAgICAgICBlbHNlIGlmIChfLmlzRnVuY3Rpb24odXBkYXRlcikpIGdldHRlciA9IHVwZGF0ZXJcbiAgICAgIH1cblxuICAgICAgLy8g5YaF572u55qEIFVJIOWtmOWPluWZqFxuICAgICAgaWYgKCF1cGRhdGVyIHx8ICFnZXR0ZXIpIHtcbiAgICAgICAgdXBkYXRlciA9IHRoaXMuVUlbaW5mby5nZXRdXG4gICAgICAgIGdldHRlciA9IHVwZGF0ZXIuZ2V0XG4gICAgICB9XG5cbiAgICAgIGxldCB2YWx1ZSA9IGdldHRlci5jYWxsKHRoaXMudmlldywgJGVsLCBpbmZvLmZpZWxkLCB0aGlzLmdldCgnZGF0YUtleScpKVxuICAgICAgcmV0dXJuIHZhbHVlXG4gICAgfSxcblxuXG4gICAgLy8gbW9kZWwg5pu05paw5pe25YCZ77yM6Ieq5Yqo5pu05pawIFVJXG4gICAgX1VJX3VwZGF0ZXIobW9kZWwsIGNoYW5nZWRWYWx1ZSwgb3B0aW9ucykge1xuICAgICAgdmFyICRlbCA9IHRoaXMuJGVsKClcbiAgICAgIGlmICghJGVsLmxlbmd0aCkgcmV0dXJuXG4gIFxuICAgICAgdGhpcy51cGRhdGVVSShjaGFuZ2VkVmFsdWUpXG4gICAgfSxcbiAgXG5cbiAgICAvLyBVSSAtPiBtb2RlbFxuICAgIF9tb2RlbF91cGRhdGVyKGUpIHtcbiAgICAgIC8vIOebruagh+WFg+e0oOS4jeaYr+ihqOWNleS6pOS6kuWFg+e0oOeahOaXtuWAme+8jOi3s+i/h1xuICAgICAgaWYgKHRoaXMuJGVsKCkubGVuZ3RoID09PSAwKSByZXR1cm5cbiAgICAgIGxldCB0YWdOYW1lID0gdGhpcy50YWdOYW1lKClcbiAgICAgIGlmICh0YWdOYW1lICE9PSAnaW5wdXQnICYmIHRhZ05hbWUgIT09ICd0ZXh0YXJlYScgJiYgdGFnTmFtZSAhPT0gJ3NlbGVjdCcpIHJldHVyblxuICBcbiAgICAgIHZhciBjaGFuZ2VkVmFsdWUgPSB0aGlzLmdldFVJVmFsdWUoKVxuICAgICAgdGhpcy51cGRhdGVNb2RlbChjaGFuZ2VkVmFsdWUpXG4gICAgfSxcblxuICAgIHN5bmNEYXRhVG9VSSgpIHtcbiAgICAgIGxldCB2YWx1ZSA9IHRoaXMubW9kZWwuZ2V0KHRoaXMuZ2V0KCdkYXRhS2V5JykpXG4gICAgICB0aGlzLnVwZGF0ZVVJKHZhbHVlKVxuICAgIH0sXG5cbiAgICBzeW5jRGF0YVRvTW9kZWwoKSB7XG4gICAgICBsZXQgdmFsdWUgPSB0aGlzLmdldFVJVmFsdWUoKVxuICAgICAgdGhpcy51cGRhdGVNb2RlbCh2YWx1ZSlcbiAgICB9LFxuXG4gICAgaW5pdGlhbGl6ZSgpIHtcbiAgICAgIHRoaXMubW9kZWxfdXBkYXRlciA9IHRoaXMuX21vZGVsX3VwZGF0ZXIuYmluZCh0aGlzKVxuICAgICAgdGhpcy5VSV91cGRhdGVyID0gdGhpcy5fVUlfdXBkYXRlci5iaW5kKHRoaXMpXG4gICAgfSxcblxuICAgIGJpbmQoKSB7XG4gICAgICAvLyDnm5HlkKwgbW9kZWwg5Y+Y5YyW77yM5omn6KGMIFVJX3VwZGF0ZXJcbiAgICAgIHRoaXMudmlldy5saXN0ZW5Ubyh0aGlzLm1vZGVsLCAnY2hhbmdlOicgKyB0aGlzLmdldCgnZGF0YUtleScpLCB0aGlzLlVJX3VwZGF0ZXIpXG5cbiAgICAgIC8vIOe7keWumuS6i+S7tu+8jOayoeacieaMh+WumuWtkOWFg+e0oOeahCBzZWxlY3RvciDml7bvvIzkvZznlKjlnKjop4blm77nmoTmoLnlhYPntKDkuIpcbiAgICAgIGlmICh0aGlzLnNlbGVjdG9yKCkgPT09ICckZWwnKSB7XG4gICAgICAgICAgdGhpcy52aWV3LiRlbC5vbignY2hhbmdlJywgdGhpcy5tb2RlbF91cGRhdGVyKVxuXG4gICAgICAvLyDlkKbliJnkvb/nlKjkuovku7bku6PnkIbvvIzkvZznlKjlnKjmjIflrpogc2VsZWN0b3Ig55qE5a2Q5YWD57Sg5LiKXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMudmlldy4kZWwub24oJ2NoYW5nZScsIHRoaXMuc2VsZWN0b3IoKSwgdGhpcy5tb2RlbF91cGRhdGVyKVxuICAgICAgfVxuICAgIH0sXG5cbiAgICB1bmJpbmQoKSB7XG4gICAgICAvLyDnm5HlkKwgbW9kZWwg5Y+Y5YyW77yM5omn6KGMIFVJX3VwZGF0ZXJcbiAgICAgIHRoaXMudmlldy5zdG9wTGlzdGVuaW5nKHRoaXMubW9kZWwsICdjaGFuZ2U6JyArIHRoaXMuZ2V0KCdkYXRhS2V5JyksIHRoaXMuVUlfdXBkYXRlcilcbiAgXG4gICAgICAvLyDnu5Hlrprkuovku7bvvIzmsqHmnInmjIflrprlrZDlhYPntKDnmoQgc2VsZWN0b3Ig5pe277yM5L2c55So5Zyo6KeG5Zu+55qE5qC55YWD57Sg5LiKXG4gICAgICBpZiAodGhpcy5zZWxlY3RvcigpID09PSAnJGVsJykge1xuICAgICAgICAgIHRoaXMudmlldy4kZWwub2ZmKCdjaGFuZ2UnLCB0aGlzLm1vZGVsX3VwZGF0ZXIpXG5cbiAgICAgIC8vIOWQpuWImeS9v+eUqOS6i+S7tuS7o+eQhu+8jOS9nOeUqOWcqOaMh+WumiBzZWxlY3RvciDnmoTlrZDlhYPntKDkuIpcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy52aWV3LiRlbC5vZmYoJ2NoYW5nZScsIHRoaXMuc2VsZWN0b3IoKSwgdGhpcy5tb2RlbF91cGRhdGVyKVxuICAgICAgfVxuICAgIH1cbn0pXG5cblxubW9kdWxlLmV4cG9ydHMgPSBCaW5kaW5nUmVjb3JkIiwiJ3VzZSBzdHJpY3QnXG5cbmNvbnN0IEJpbmRpbmdSZWNvcmQgPSByZXF1aXJlKCcuL2JpbmRpbmctcmVjb3JkJylcblxuZnVuY3Rpb24gcGFyc2VCaW5kaW5ncyh2aWV3LCBtb2RlbCwgYmluZGluZ3MpIHtcbiAgICB2YXIgcmVjb3JkcyA9IFtdXG4gICAgXy5lYWNoKGJpbmRpbmdzLCBmdW5jdGlvbiAoZGF0YUtleSwgdGFyZ2V0SW5mbykge1xuICAgICAgICBkYXRhS2V5ID0gZGF0YUtleS5zcGxpdCgnLCcpXG4gICAgICAgIHRhcmdldEluZm8gPSB0YXJnZXRJbmZvLnNwbGl0KCcsJylcbiAgICAgICAgXy5lYWNoKGRhdGFLZXksIGRhdGFLZXkgPT4ge1xuICAgICAgICAgICAgXy5lYWNoKHRhcmdldEluZm8sIHRhcmdldEluZm8gPT4ge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0SW5mbyB8fCAhZGF0YUtleSkgcmV0dXJuXG4gICAgICAgICAgICAgICAgcmVjb3Jkcy5wdXNoKG5ldyBCaW5kaW5nUmVjb3JkKHZpZXcsIG1vZGVsLCB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEluZm86IHRhcmdldEluZm8sXG4gICAgICAgICAgICAgICAgICAgIGRhdGFLZXk6IGRhdGFLZXlcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH0pXG4gICAgfSlcbiAgICByZXR1cm4gcmVjb3Jkc1xufVxuXG5cbi8vIHsgJy5zZWxlY3Rvcic6ICdtb2RlbF9rZXknIH1cbi8vIE9SXG4vLyB7ICcuc2VsZWN0b3J8dHlwZSc6ICdtb2RlbF9rZXknIH1cbi8vIHR5cGU6IOabtOaWsOeahOS9jee9ru+8jOWxnuaAp+WQjeOAgXRleHQoaW5uZXJIVE1MKeOAgWNoZWNrZWQg562J562JXG5mdW5jdGlvbiBiaW5kKHZpZXcsIG1vZGVsLCBiaW5kaW5ncykge1xuICAgIC8vIOayoeaciSB1bmJpbmQg55qE6K+d77yM5q+P5qyhIGJpbmTvvIzpg73kvb/nlKjov73liqDnmoTmlrnlvI9cbiAgICAvLyDlvZPmrKEgYmluZCDkvZznlKjlnKjmlrDlop7nmoQgYmluZGluZ3Mg5LiKXG4gICAgaWYgKCFfLmlzQXJyYXkodmlldy5fX2JpbmRpbmdSZWNvcmRzX18pKSB2aWV3Ll9fYmluZGluZ1JlY29yZHNfXyA9IFtdXG4gICAgdmFyIG5ld1JlY29yZHMgPSBwYXJzZUJpbmRpbmdzKHZpZXcsIG1vZGVsLCBiaW5kaW5ncylcbiAgICB2aWV3Ll9fYmluZGluZ1JlY29yZHNfXyA9IHZpZXcuX19iaW5kaW5nUmVjb3Jkc19fLmNvbmNhdChuZXdSZWNvcmRzKVxuICAgIF8uZWFjaChuZXdSZWNvcmRzLCBmdW5jdGlvbiAocmVjb3JkKSB7XG4gICAgICAgIHJlY29yZC5iaW5kKClcbiAgICB9KVxufVxuXG5cbmZ1bmN0aW9uIHVuYmluZCh2aWV3LCBtb2RlbCwgcmVjb3Jkcykge1xuICAgIC8vIOWPr+S7peaMh+WumuafkOS6m+e7keWumiByZWNvcmRz77yM5LiN5oyH5a6a77yM5YiZ5aSE55CG5pW05LiqIHZpZXcg55qE5omA5pyJ57uR5a6aXG4gICAgcmVjb3JkcyA9IHJlY29yZHMgfHwgdmlldy5fX2JpbmRpbmdSZWNvcmRzX18gfHwgW11cbiAgICBfLmVhY2gocmVjb3JkcywgZnVuY3Rpb24gKHJlY29yZCkge1xuICAgICAgICByZWNvcmQudW5iaW5kKClcbiAgICB9KVxuXG4gICAgdmFyIGxlZnRSZWNvcmRzID0gXy5yZWplY3Qodmlldy5fX2JpbmRpbmdSZWNvcmRzX18sIGZ1bmN0aW9uIChyZWNvcmQpIHtcbiAgICAgICAgcmV0dXJuIF8uaW5jbHVkZXMocmVjb3JkcywgcmVjb3JkKVxuICAgIH0pXG4gICAgaWYgKGxlZnRSZWNvcmRzLmxlbmd0aCkgdmlldy5fX2JpbmRpbmdSZWNvcmRzX18gPSBsZWZ0UmVjb3Jkc1xuICAgIGVsc2UgZGVsZXRlIHZpZXcuX19iaW5kaW5nUmVjb3Jkc19fXG59XG5cblxuZnVuY3Rpb24gc3luY0RhdGEodmlldywgaXNUb01vZGVsKSB7XG4gICAgbGV0IHJlY29yZHMgPSB2aWV3Ll9fYmluZGluZ1JlY29yZHNfXyB8fCBbXVxuICAgIF8uZWFjaChyZWNvcmRzLCBpc1RvTW9kZWwgPyAocmVjb3JkKSA9PiByZWNvcmQuc3luY0RhdGFUb01vZGVsKCkgOiAocmVjb3JkKSA9PiByZWNvcmQuc3luY0RhdGFUb1VJKCkpXG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgYmluZCxcbiAgICB1bmJpbmQsXG4gICAgc3luY0RhdGFcbn0iLCIndXNlIHN0cmljdCdcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi9taXhpbi91dGlscycpXG52YXIgbGlmZUNpcmNsZSA9IHJlcXVpcmUoJy4vbWl4aW4vbGlmZS1jaXJjbGUnKVxudmFyIGV2ZW50YnVzID0gcmVxdWlyZSgnLi9taXhpbi9ldmVudGJ1cycpXG5cbi8vIERiYk9iamVjdCDlr7nosaHln7rnsbvvvIzmjqfliLblmajnrYnnlLHmraTmtL7nlJ9cbmZ1bmN0aW9uIERiYk9iamVjdCgpIHtcbiAgICB0aGlzLl9faXNSZXRhaW5lZF9fID0gMVxufVxuXG4vLyDlrprkuYnljp/lnovmlrnms5Vcbl8uZXh0ZW5kKERiYk9iamVjdC5wcm90b3R5cGUsIERiYi5FdmVudHMsIHtcbiAgICAkaXNSZXRhaW5lZDogbGlmZUNpcmNsZS5pc1JldGFpbmVkLFxuICAgICRpc0RlYWxsb2M6IGxpZmVDaXJjbGUuaXNEZWFsbG9jLFxuICAgICRjYWxsSG9vazogdXRpbHMuY2FsbEhvb2ssXG4gICAgJGJyb2FkY2FzdDogZXZlbnRidXMuYnJvYWNhc3QsXG4gICAgJGxpc3RlblRvQnVzOiBldmVudGJ1cy5saXN0ZW5Ub0J1cyxcbiAgICAkZGVhbGxvYzogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuJGlzUmV0YWluZWQoKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICBkZWxldGUgdGhpcy5fX2lzUmV0YWluZWRfX1xuICAgICAgICB0aGlzLnN0b3BMaXN0ZW5pbmcoKVxuICAgICAgICB0aGlzLiRjYWxsSG9vaygnZGlkRGVhbGxvYycpXG4gICAgICAgIHRoaXMub2ZmKClcbiAgICAgICAgXy5lYWNoKF8ua2V5cyh0aGlzKSwgZnVuY3Rpb24ocHJvcCkgeyBkZWxldGUgdGhpc1twcm9wXTsgfSwgdGhpcylcbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9XG59KVxuXG4vLyDlj6/ku6Xln7rkuo4gRGJiT2JqZWN0IOa0vueUn+WHuuWtkOexu1xuRGJiT2JqZWN0LmV4dGVuZCA9IERiYi5Nb2RlbC5leHRlbmRcblxubW9kdWxlLmV4cG9ydHMgPSBEYmJPYmplY3RcbiIsInZhciBldmVudGJ1cyA9IF8uZXh0ZW5kKHt9LCBCYWNrYm9uZS5FdmVudHMpXG5cbmV4cG9ydHMuYnJvYWNhc3QgPSBmdW5jdGlvbiBicm9hY2FzdCgpIHtcbiAgZXZlbnRidXMudHJpZ2dlci5hcHBseShldmVudGJ1cywgXy50b0FycmF5KGFyZ3VtZW50cykpXG4gIHJldHVybiB0aGlzXG59XG5cbmV4cG9ydHMubGlzdGVuVG9CdXMgPSBmdW5jdGlvbiBsaXN0ZW5Ub0J1cyhuYW1lLCBjYWxsYmFjaykge1xuICB2YXIgY3R4ID0gXy5pc0Z1bmN0aW9uKHRoaXMubGlzdGVuVG8pID8gdGhpcyA6IGV2ZW50YnVzIFxuICBjdHgubGlzdGVuVG8oZXZlbnRidXMsIG5hbWUsIGNhbGxiYWNrKVxuICByZXR1cm4gdGhpc1xufSIsIlxuLy8g5qOA5p+l5a+56LGh5piv5ZCm6KKrcmV0YWluZWTvvIzljbPmmK/lkKbmnKrooqvplIDmr4Fcbi8vIDEuIGhhcyBvd24gcHJvcGVydHkgJ19faXNSZXRhaW5lZF9fJyA/XG4vLyAyLiBfX2lzUmV0YWluZWRfXyA9PSB0cnVlID9cbmV4cG9ydHMuaXNSZXRhaW5lZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLmhhcyh0aGlzLCAnX19pc1JldGFpbmVkX18nKSAmJiAhIXRoaXMuX19pc1JldGFpbmVkX19cbn1cblxuXG4vLyDmo4Dmn6Xlr7nosaHmmK/lkKblt7Lnu4/plIDmr4FcbmV4cG9ydHMuaXNEZWFsbG9jID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICF0aGlzLl9faXNSZXRhaW5lZF9fIHx8ICFfLmhhcyh0aGlzLCAnX19pc1JldGFpbmVkX18nKVxufSIsIlxuLy8g6LCD55So6ZKp5a2Q5Ye95pWw44CB6Kem5Y+R5ZCM5ZCN5LqL5Lu2XG5leHBvcnRzLmNhbGxIb29rID0gZnVuY3Rpb24obmFtZSkge1xuICAgIC8vICdhZnRlcjpzZW5kJyA9PiAnYWZ0ZXJTZW5kJ1xuICAgIGxldCBtZXRob2QgPSBfLm1hcChTdHJpbmcobmFtZSkuc3BsaXQoJzonKSxcbiAgICAocyxpKT0+aT4wP3MuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkrcy5zbGljZSgxKTpzKS5qb2luKCcnKVxuXG4gICAgaWYgKF8uaXNGdW5jdGlvbih0aGlzW21ldGhvZF0pKSB7XG4gICAgICAgIHRoaXNbbWV0aG9kXS5hcHBseSh0aGlzLCBfLnJlc3QoYXJndW1lbnRzKSlcbiAgICB9IFxuICAgIGlmIChfLmlzRnVuY3Rpb24odGhpcy50cmlnZ2VyKSkgdGhpcy50cmlnZ2VyLmFwcGx5KHRoaXMsIF8udG9BcnJheShhcmd1bWVudHMpKVxuICAgIHJldHVybiB0aGlzXG59XG4iLCIndXNlIHN0cmljdCdcblxuY29uc3QgdXRpbHMgPSByZXF1aXJlKCcuL21peGluL3V0aWxzJylcbmNvbnN0IGxpZmVDaXJjbGUgPSByZXF1aXJlKCcuL21peGluL2xpZmUtY2lyY2xlJylcbmNvbnN0IGV2ZW50YnVzID0gcmVxdWlyZSgnLi9taXhpbi9ldmVudGJ1cycpXG5jb25zdCBiaW5kZXIgPSByZXF1aXJlKCcuL2JpbmRlcicpXG5cbi8vIOacieaViOeahCB2aWV3IGZpZWxkc1xuY29uc3Qgdmlld0ZpZWxkcyA9IFsnbW9kZWwnLCAnY29sbGVjdGlvbicsICdlbCcsICdpZCcsICdhdHRyaWJ1dGVzJywgJ2NsYXNzTmFtZScsICd0YWdOYW1lJywgJ2V2ZW50cyddXG5cbi8vIOacieaViOeahCB2aWV3IG9wdGlvbnNcbmNvbnN0IHZpZXdPcHRpb25zID0gW1xuICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAnbW91bnRQb2ludFNlbGVjdG9yJyxcbiAgICAnc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudCcsXG4gICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudCcsXG4gICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdXaWxsVW5tb3VudCcsXG4gICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbm1vdW50JyxcbiAgICAnc2hvdWxkRGVsZWdhdGVFdmVudHMnLFxuICAgICd0cmFuc2l0aW9uJyxcbiAgICAnc2hvdWxkUHJldmVudERlYWxsb2MnXG5dXG5cbmNvbnN0IHZpZXdLZXl3b3JkcyA9IHZpZXdGaWVsZHMuY29uY2F0KHZpZXdPcHRpb25zKVxuXG5mdW5jdGlvbiBpc0VsTW91bnRlZChlbCkge1xuICAgIHJldHVybiAkLmNvbnRhaW5zKGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCwgKGVsIGluc3RhbmNlb2YgJCkgPyBlbFswXSA6IGVsIClcbiAgICAvLyBpZiAoIWVsKSByZXR1cm4gZmFsc2VcbiAgICAvLyBjb25zdCBkb2NFbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICAgIC8vIGxldCBwYXJlbnRcblxuICAgIC8vIGlmIChkb2NFbC5jb250YWlucykgcmV0dXJuIGRvY0VsLmNvbnRhaW5zKGVsKVxuICAgIC8vIGlmIChkb2NFbC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbikgcmV0dXJuICEhKGRvY0VsLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGVsKSAmIDE2KVxuICAgIC8vIHBhcmVudCA9IGVsLnBhcmVudE5vZGVcbiAgICAvLyB3aGlsZSAocGFyZW50KSB7XG4gICAgLy8gICAgIGlmIChwYXJlbnQgPT0gZG9jRWwpIHJldHVybiB0cnVlXG4gICAgLy8gICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlXG4gICAgLy8gfVxuICAgIC8vIHJldHVybiBmYWxzZVxufVxuXG5cbi8vIGRlbGVnYXRlIHN1YnZpZXcncyBldmVudHNcbmZ1bmN0aW9uIGRlbGVnYXRlRXZlbnRzKHN1YnZpZXcpIHtcbiAgICB0aGlzLmxpc3RlblRvKHN1YnZpZXcsICdhbGwnLCBkZWxlZ2F0ZUV2ZW50c0NCKVxuICAgIHJldHVybiB0aGlzXG59XG5mdW5jdGlvbiBkZWxlZ2F0ZUV2ZW50c0NCKG5hbWUpIHtcbiAgICBsZXQgYXJncyA9IFsnc3Vidmlldy4nICsgbmFtZV0uY29uY2F0KCBfLnJlc3QoYXJndW1lbnRzKSApXG4gICAgdGhpcy50cmlnZ2VyLmFwcGx5KHRoaXMsIGFyZ3MpXG59XG5mdW5jdGlvbiB1bkRlbGVnYXRlRXZlbnRzKHN1YnZpZXcpIHtcbiAgICB0aGlzLnN0b3BMaXN0ZW5pbmcoc3VidmlldylcbiAgICByZXR1cm4gdGhpc1xufVxuXG5cbi8qKlxuICogQGRlc2NyaXB0aW9uXG4gKlxuICogYSBWaWV3J3MgbGlmZSBjeWNsZTpcbiAqXG4gKiBpbml0aWFsaXplOiB2aWV3IOWIneWni+WMllxuICogdmlld1dpbGxSZW5kZXIoc2VsZik6IHZpZXcg5Y2z5bCG5riy5p+T77yI55Sf5oiQdmlldy5lbO+8iVxuICogdmlld0RpZFJlbmRlcihzZWxmKTogdmlldyDlt7Lnu4/lrozmiJDmuLLmn5NcbiAqIHZpZXdXaWxsTW91bnQoc2VsZik6IHZpZXcuZWwg5Y2z5bCG5oyC6L295YiwbW91bnQgY2hpYW4o6aG254K55pivZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KVxuICogdmlld0RpZE1vdW50KHNlbGYpOiB2aWV3LmVsIOW3sue7j+aMgui9veWIsG1vdW50IGNoYWluXG4gKiB2aWV3V2lsbFJlZnJlc2goc2VsZik6IOinhuWbvuWNs+WwhuWIt+aWsFxuICogdmlld0RpZFJlZnJlc2goc2VsZik6IOinhuWbvuWujOaIkOWIt+aWsFxuICogdmlld1dpbGxVbm1vdW50KHNlbGYpOiB2aWV3LmVsIOWNs+WwhuS7jm1vdW50IGNoYWlu5LiK5Y246L29XG4gKiB2aWV3RGlkVW5tb3VudChzZWxmKTogdmlldy5lbCDlt7Lnu4/ku45tb3VudCBjaGFpbuS4iuWNuOi9vVxuICogdmlld1dpbGxEZWFsbG9jKHNlbGYpOiB2aWV35Y2z5bCG6ZSA5q+BXG4gKiB2aWV3RGlkRGVhbGxvYyhzZWxmKTogdmlld+W3sue7j+mUgOavgVxuICpcbiAqIHN1YnZpZXcgZXZlbnRzXG4gKiBzdWJ2aWV3V2lsbEFkZChzdWJ2aWV3LCBzZWxmLCBvcHRpb25zKTog5Y2z5bCG5re75Yqg5a2Q6KeG5Zu+XG4gKiBzdWJ2aWV3RGlkQWRkKHN1YnZpZXcsIHNlbGYsIG9wdGlvbnMpOiDlrozmiJDmt7vliqDlrZDop4blm75cbiAqIHN1YnZpZXdXaWxsUmVtb3ZlKHN1YnZpZXcsIHNlbGYsIG9wdGlvbnMpOiDlrZDop4blm77ljbPlsIbnp7vpmaRcbiAqIHN1YnZpZXdEaWRSZW1vdmUoc3Vidmlldywgc2VsZiwgb3B0aW9ucyk6IOWtkOinhuWbvuWujOaIkOenu+mZpFxuICogc3Vidmlld3NXaWxsU29ydChzZWxmKTog5a2Q6KeG5Zu+5Y2z5bCG5o6S5bqPXG4gKiBzdWJ2aWV3c0RpZFNvcnQoc2VsZik6IOWtkOinhuWbvuWujOaIkOaOkuW6j1xuICpcbioqL1xuXG5cbi8vIFZpZXfnmoTln7rnsbtcbmNvbnN0IERiYlZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XG4gICAgY29uc3RydWN0b3I6IGZ1bmN0aW9uIERiYlZpZXcob3B0aW9ucykge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGJiVmlldykpIHJldHVybiBuZXcgRGJiVmlldyhvcHRpb25zKVxuXG4gICAgICAgIC8vIHZpZXfnlJ/lrZjkuK3vvIzkuI3lj6/lm57mlLZcbiAgICAgICAgdGhpcy5fX2lzUmV0YWluZWRfXyA9IDFcblxuICAgICAgICAvLyDop4blm75vcHRpb25z5pWw5o2uXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IF8uZXh0ZW5kKHt9LFxuICAgICAgICAgICAgdGhpcy5fX2RlZmF1bHRPcHRpb25zX18sIC8vIOm7mOiupOmFjee9rlxuICAgICAgICAgICAgXy5waWNrKHRoaXMub3B0aW9ucyB8fCB7fSwgdmlld09wdGlvbnMpLCAvLyBleHRlbmQg5Ye65a2Q57G755qE5pe25YCZ77yM5Y+v5Lul55u05o6l6YCa6L+HIG9wdGlvbnMg5a2X5q616YWN572uXG4gICAgICAgICAgICBfLnBpY2sob3B0aW9ucywgdmlld09wdGlvbnMpIC8vIOWunuS+i+WMlueahOaXtuWAmeS8oOWFpeeahOaVsOaNruS4reaPkOWPliBvcHRpb25zIOmDqOWIhlxuICAgICAgICApXG5cbiAgICAgICAgLy8gb3B0aW9ucyDlj4rpu5jorqRmaWVsZHMg5Lul5aSW55qE5pWw5o2u77yM5ZCI5bm25YWldmlld1xuICAgICAgICBfLmV4dGVuZCh0aGlzLCBfLm9taXQob3B0aW9ucywgdmlld0tleXdvcmRzKSlcblxuICAgICAgICAvLyDosIPnlKjniLbnsbvmnoTpgKDlh73mlbBcbiAgICAgICAgLy8g6aG65bqP5LiN6IO95Y+Y77yM5ZCm5YiZ5Zyo57un5om/RGJiLlZpZXfnmoTlrZDnsbvkuK3vvIxpbml0aWFsaXpl5Lya5pep5LqOY29uc3RydWN0b3LmiafooYzvvIxcbiAgICAgICAgLy8g5a+86Ie0dGhpcy5vcHRpb25z55qE5YC85pivdW5kZWZpbmVkXG4gICAgICAgIEJhY2tib25lLlZpZXcuY2FsbCh0aGlzLCBvcHRpb25zKVxuICAgIH0sXG5cbiAgICBfX2RlZmF1bHRPcHRpb25zX186IHtcbiAgICAgICAgc3VwcG9ydExpZmVDeWNsZTogdHJ1ZSwgLy8gc2hvdWxkIGNhbGxIb29rXG4gICAgICAgIG1vdW50UG9pbnRTZWxlY3RvcjogJy5kYmJ2aWV3LW1vdW50cG9pbnQnLCAvLyBhcyBzdWJ2aWV3J3MgbW91bnRwb2ludFxuICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50OiB0cnVlLCAvLyAkZWwgbW91bnRcbiAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50OiB0cnVlLCAvLyAkZWwgbW91bnRcbiAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbm1vdW50OiB0cnVlLCAvLyAkZWwgdW5tb3VudFxuICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkVW5tb3VudDogdHJ1ZSwgLy8gJGVsIHVubW91bnRcbiAgICAgICAgc2hvdWxkRGVsZWdhdGVFdmVudHM6IGZhbHNlLCAvLyBhZGQgc3Vidmlld1xuICAgICAgICB0cmFuc2l0aW9uOiB7fSwgLy8gZG9tIGluc2VydCBvciByZW1vdmVcbiAgICAgICAgc2hvdWxkUHJldmVudERlYWxsb2M6IGZhbHNlIC8vIHJlbW92ZSBzdWJ2aWV3XG4gICAgfSxcblxuXG4gICAgLy8g6buY6K6k5a6e546w77yM6YCa5bi45Lya6YeN5YaZXG4gICAgaW5pdGlhbGl6ZShvcHRpb25zKSB7XG4gICAgICAgIGlmICh0aGlzLmJpbmRpbmdzKSB0aGlzLiRyZW5kZXIoKVxuICAgIH0sXG5cblxuICAgICRicm9hZGNhc3Q6IGV2ZW50YnVzLmJyb2FjYXN0LFxuICAgICRsaXN0ZW5Ub0J1czogZXZlbnRidXMubGlzdGVuVG9CdXMsXG5cbiAgICAkY2FsbEhvb2s6IHV0aWxzLmNhbGxIb29rLFxuXG4gICAgJGlzUmV0YWluZWQ6IGxpZmVDaXJjbGUuaXNSZXRhaW5lZCxcbiAgICAkaXNEZWFsbG9jOiBsaWZlQ2lyY2xlLmlzRGVhbGxvYyxcblxuXG4gICAgJGdldE9wdGlvbihvcHRpb25zLCBmaWVsZHMpIHtcbiAgICAgICAgaWYgKCFmaWVsZHMpIHJldHVyblxuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQoe30sIHRoaXMub3B0aW9ucywgb3B0aW9ucyB8fCB7fSlcbiAgICAgICAgaWYgKHR5cGVvZiBmaWVsZHMgPT09ICdzdHJpbmcnKSByZXR1cm4gXy5yZXN1bHQob3B0aW9ucywgZmllbGRzKVxuICAgICAgICByZXR1cm4gXy5waWNrKG9wdGlvbnMsIGZpZWxkcylcbiAgICB9LFxuXG4gICAgXG4gICAgLyoqXG4gICAgICogQG1ldGhvZCBWaWV3IyRkZWFsbG9jXG4gICAgICogQGRlc2NyaXB0aW9uXG4gICAgICog6KeG5Zu+6ZSA5q+BXG4gICAgICovXG4gICAgJGRlYWxsb2Mob3B0aW9ucykge1xuICAgICAgICBpZiAodGhpcy4kaXNEZWFsbG9jKCkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgbGV0IHN1cHBvcnRMaWZlQ3ljbGUgPSB0aGlzLiRnZXRPcHRpb24ob3B0aW9ucywgJ3N1cHBvcnRMaWZlQ3ljbGUnKVxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB0aGlzLiRjYWxsSG9vaygndmlld1dpbGxEZWFsbG9jJywgdGhpcylcblxuICAgICAgICAvLyDpgJLlvZLlrZDop4blm77nmoTmuIXnkIZcbiAgICAgICAgbGV0IGNvdW50ID0gdGhpcy4kY291bnQoKVxuICAgICAgICBpZiAodGhpcy4kaXNOb3RFbXB0eSgpKSB3aGlsZShjb3VudC0tKSB0aGlzLl9fc3Vidmlld3NfX1tjb3VudF0uJGRlYWxsb2MoKVxuXG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX19pc1JldGFpbmVkX19cblxuICAgICAgICAvLyDoi6XmqKHlnovnlKh0aGlzLm1vZGVsLm9uKCdjaGFuZ2UnLCBkb1NvbWV0aGluZywgdGhpcynnu5HlrprnmoTvvIzpnIDopoFcbiAgICAgICAgLy8gdGhpcy5tb2RlbC5vZmYobnVsbCwgbnVsbCwgdGhpcynov5nmoLfop6Pnu5HvvIzku6XlhY1tb2RlbOeahOWFtuS7luS6i+S7tuS5n+iiq+ino+mZpFxuICAgICAgICAvLyDlkIznkIbov5jmnIljb2xsZWN0aW9uXG4gICAgICAgIC8vIOaJgOS7peeUqGxpc3RlblRv57uR5a6a5q+U6L6D5a655piT5YGaJGRlYWxsb2NcbiAgICAgICAgdGhpcy5yZW1vdmUoKSAvLyDnp7vpmaR2aWV35Lul5Y+K5LuORE9N5Lit56e76ZmkZWws5bm26Ieq5Yqo6LCD55Soc3RvcExpc3RlbmluZ+S7peenu+mZpOmAmui/h2xpc3RlblRv57uR5a6a55qE5LqL5Lu244CCXG5cbiAgICAgICAgLy8g5b+F6aG75pS+5Zyob2Zm5YmN77yMb2Zm5Lya5LiA5bm256e76Zmk6YCa6L+HbGlzdGVuVG/nm5HlkKzmraTkuovku7bnmoTlhbbku5blr7nosaHnmoTnm7jlupTkuovku7ZcbiAgICAgICAgLy8gYS5saXN0ZW5UbyhiLC4uLiksXG4gICAgICAgIC8vIGEuc3RvcExpc3RlbmluZyDnm7jlvZPkuo4gYi5vZmYobnVsbCxudWxsLGEpXG4gICAgICAgIC8vIGIub2ZmKCnnm7jlvZPkuo5hLnN0b3BMaXN0ZW5pbmdcbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCd2aWV3RGlkRGVhbGxvYycsIHRoaXMpXG5cbiAgICAgICAgdGhpcy5vZmYoKSAvLyDnp7vpmaTnlKh0aGlzLm9u57uR5a6a55qE5LqL5Lu2XG5cbiAgICAgICAgLy8g5riF56m65bGe5oCnXG4gICAgICAgIF8uZWFjaChcbiAgICAgICAgICAgIF8ua2V5cyh0aGlzKSxcbiAgICAgICAgICAgIHByb3AgPT4geyBpZiAocHJvcCAhPT0gJ2NpZCcpIGRlbGV0ZSB0aGlzW3Byb3BdIH0sXG4gICAgICAgICAgICB0aGlzXG4gICAgICAgIClcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cblxuICAgIC8vIOe7keWumuaVsOaNruOAgeinhuWbvu+8jOiHquWKqOWwhuaooeWei+WPmOWMluWPjeaYoOWIsOinhuWbvuOAguWvueS6juihqOWNleaOp+S7tu+8jOWPjOWQkee7keWumlxuICAgIC8vIOW/hemhu+WcqCAkcmVuZGVyIOS5i+WQjuaJjeWPr+S9v+eUqFxuICAgICRiaW5kKG1vZGVsLCBiaW5kaW5ncykge1xuICAgICAgICBtb2RlbCA9IG1vZGVsIHx8IHRoaXMubW9kZWxcbiAgICAgICAgYmluZGluZ3MgPSBiaW5kaW5ncyB8fCBfLnJlc3VsdCh0aGlzLCAnYmluZGluZ3MnKVxuICAgICAgICBpZiAoIW1vZGVsIHx8ICFiaW5kaW5ncykgcmV0dXJuIHRoaXNcbiAgICAgICAgYmluZGVyLmJpbmQodGhpcywgbW9kZWwsIGJpbmRpbmdzKVxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cblxuICAgIC8vIOWPlua2iOaVsOaNruOAgeinhuWbvue7keWumlxuICAgICR1bmJpbmQobW9kZWwsIHJlY29yZHMpIHtcbiAgICAgICAgbW9kZWwgPSBtb2RlbCB8fCB0aGlzLm1vZGVsXG4gICAgICAgIHJlY29yZHMgPSByZWNvcmRzIHx8IHRoaXMuX19iaW5kaW5nUmVjb3Jkc19fXG4gICAgICAgIGlmICghbW9kZWwgfHwgIXJlY29yZHMpIHJldHVybiB0aGlzXG4gICAgICAgIGJpbmRlci51bmJpbmQodGhpcywgbW9kZWwsIHJlY29yZHMpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuICAgICRzeW5jQmluZGluZ0RhdGEoaXNUb01vZGVsKSB7XG4gICAgICAgIGJpbmRlci5zeW5jRGF0YSh0aGlzLCBpc1RvTW9kZWwpXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogQG1ldGhvZCBWaWV3IyRyZW5kZXJcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKiDmqKHmnb/muLLmn5NcbiAgICAgKi9cbiAgICAkcmVuZGVyKG1vZGVsLCBvcHRpb25zKSB7XG4gICAgICAgIG1vZGVsID0gbW9kZWwgfHwgdGhpcy5tb2RlbCB8fCB7fVxuICAgICAgICBsZXQgc3VwcG9ydExpZmVDeWNsZSA9dGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsICdzdXBwb3J0TGlmZUN5Y2xlJylcblxuICAgICAgICAvLyDlt7Lnu4/mjILovb3vvIzor7TmmI7ov5nmrKEkcmVuZGVy5pivcmVmcmVzaFxuICAgICAgICBsZXQgaXNSZWZyZXNoID0gdGhpcy4kaXNNb3VudGVkKClcblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSkge1xuICAgICAgICAgICAgdGhpcy4kY2FsbEhvb2soJ3ZpZXdXaWxsUmVuZGVyJywgdGhpcylcbiAgICAgICAgICAgIGlmIChpc1JlZnJlc2gpIHRoaXMuJGNhbGxIb29rKCd2aWV3V2lsbFJlZnJlc2gnLCB0aGlzKVxuXG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdGVtcGxhdGUgPSBfLnJlc3VsdCh0aGlzLCAnJHRlbXBsYXRlRm9yVmlldycpXG5cbiAgICAgICAgLy8gJHJlbmRlcuW8gOWni++8jOWmguaenOWtmOWcqOaooeadv++8jOWImea4suafk+ebuOWFs2h0bWxcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0ZW1wbGF0ZSkpIHtcbiAgICAgICAgICAgIGxldCAkY2hpbGRyZW5GcmFnbWVudFxuXG4gICAgICAgICAgICAvLyDmiopzdWJ2aWV3LmVsIOaaguenu+WIsCBmcmFnbWVudCDph4zvvIzku6Xkvr/lkI7nu63ph43mlrDmuLLmn5PlvZPliY3op4blm77lkI5hcHBlbmTlm57mnaVcbiAgICAgICAgICAgIGlmICh0aGlzLiRpc05vdEVtcHR5KCkpIHtcbiAgICAgICAgICAgICAgICAkY2hpbGRyZW5GcmFnbWVudCA9ICQoZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpKVxuICAgICAgICAgICAgICAgIHRoaXMuJGVhY2hTdWJ2aWV3KHZpZXcgPT4gJGNoaWxkcmVuRnJhZ21lbnQuYXBwZW5kKHZpZXcuJGVsKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g5L2/55So5pWw5o2u5riy5p+T5qih5p2/77yM5bm25Yi35pawZG9tXG4gICAgICAgICAgICBsZXQgZGF0YSA9IHRoaXMuJGRhdGFGb3JWaWV3KG1vZGVsKVxuXG4gICAgICAgICAgICB0aGlzLiRlbC5odG1sKHRlbXBsYXRlKGRhdGEpKVxuXG4gICAgICAgICAgICB0aGlzLl9fJG1vdW50UG9pbnRfXyA9IF8ucmVzdWx0KHRoaXMsICckbW91bnRQb2ludEZvclN1YnZpZXcnLCB0aGlzLiRlbCkuZXEoMCkgLy8g5Yi35pawL+iuvue9ruaMgui9veeCuVxuXG4gICAgICAgICAgICAvLyDlsIblrZBWaWV3IOeahGVsIOaPkuWbnuadpVxuICAgICAgICAgICAgaWYgKCRjaGlsZHJlbkZyYWdtZW50KSB0aGlzLl9fJG1vdW50UG9pbnRfXy5hcHBlbmQoJGNoaWxkcmVuRnJhZ21lbnQpXG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX18kbW91bnRQb2ludF9fID0gXy5yZXN1bHQodGhpcywgJyRtb3VudFBvaW50Rm9yU3VidmlldycsIHRoaXMuJGVsKS5lcSgwKSAvLyDorr7nva7mjILovb3ngrlcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB7XG4gICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygndmlld0RpZFJlbmRlcicsIHRoaXMpXG4gICAgICAgICAgICBpZiAoaXNSZWZyZXNoKSB0aGlzLiRjYWxsSG9vaygndmlld0RpZFJlZnJlc2gnLCB0aGlzKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qCH6K6w5b2T5YmNdmlldyByZW5kZXJlZFxuICAgICAgICB0aGlzLiRzZXRSZW5kZXJlZCgpXG5cbiAgICAgICAgLy8g57uR5a6aIHZpZXfjgIFtb2RlbFxuICAgICAgICBpZiAodGhpcy5iaW5kaW5ncyAmJiB0aGlzLm1vZGVsKSB0aGlzLiR1bmJpbmQoKS4kYmluZCgpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cbiAgICAvKipcbiAgICAgKiBAbWV0aG9kIFZpZXcjJGRhdGFGb3JWaWV3XG4gICAgICogQGRlc2NyaXB0aW9uIOinhuWbvua4suafk+aJgOmcgOeahOaVsOaNrlxuICAgICAqIOWPryBvdmVycmlkZVxuICAgICAqL1xuICAgICRkYXRhRm9yVmlldyhtb2RlbCkge1xuICAgICAgICByZXR1cm4gXy5yZXN1bHQobW9kZWwsICd0b0pTT04nLCBPYmplY3QobW9kZWwpKVxuICAgIH0sXG5cblxuICAgIC8vIOWPr292ZXJyaWRl77yM6L+U5Zue5qih5p2/5riy5p+T5Ye95pWwXG4gICAgJHRlbXBsYXRlRm9yVmlldygpIHtcbiAgICAgICAgaWYgKHRoaXMuX190ZW1wbGF0ZUZ1bmN0aW9uQ2FjaGVfXykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX190ZW1wbGF0ZUZ1bmN0aW9uQ2FjaGVfX1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgdGVtcGxhdGUgPSB0aGlzLm9wdGlvbnMudGVtcGxhdGUgfHwgdGhpcy50ZW1wbGF0ZVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZW1wbGF0ZSA9PT0gJ3N0cmluZycpIHRlbXBsYXRlID0gXy50ZW1wbGF0ZSh0ZW1wbGF0ZSlcbiAgICAgICAgICAgIGlmIChfLmlzRnVuY3Rpb24odGVtcGxhdGUpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fX3RlbXBsYXRlRnVuY3Rpb25DYWNoZV9fID0gdGVtcGxhdGVcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVtcGxhdGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cblxuICAgIC8vIOWPr292ZXJyaWRl77yM5aaC5L2V6I635Y+W5a2Qdmlld+eahGVs5oyC6L29ZG9t5a655ZmoXG4gICAgJG1vdW50UG9pbnRGb3JTdWJ2aWV3KG9wdGlvbnMpIHtcbiAgICAgICAgbGV0ICRtb3VudFBvaW50ID0gdGhpcy4kKHRoaXMuJGdldE9wdGlvbihvcHRpb25zLCAnbW91bnRQb2ludFNlbGVjdG9yJykpXG4gICAgICAgIGlmICgkbW91bnRQb2ludC5sZW5ndGgpIHJldHVybiAkbW91bnRQb2ludFxuICAgICAgICByZXR1cm4gdGhpcy4kZWxcbiAgICB9LFxuXG4gICAgLy8g5qOA5p+l6KeG5Zu+5piv5ZCm5oyC6L295Yiw5paH5qGjXG4gICAgJGlzTW91bnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIGlzRWxNb3VudGVkKHRoaXMuZWwpXG4gICAgfSxcblxuICAgIC8vIOehruiupOinhuWbvueahOaooeadv+aYr+WQpua4suafk1xuICAgICRpc1JlbmRlcmVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX2lzUmVuZGVyZWRfX1xuICAgIH0sXG5cbiAgICAvLyDmoIforrDop4blm77lt7Lnu4/muLLmn5Pov4dcbiAgICAkc2V0UmVuZGVyZWQoKSB7XG4gICAgICAgIHRoaXMuX19pc1JlbmRlcmVkX18gPSB0cnVlXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuXG4gICAgLyoqXG4gICAgICogQG1ldGhvZCBWaWV3IyRtb3VudFRvRWxcbiAgICAgKiBAZGVzY3JpcHRpb25cbiAgICAgKiDlsIbop4blm77mjILovb3liLDmn5DkuKpFbOS4ilxuICAgICAqL1xuICAgICRtb3VudFRvRWwoJGVsLCBvcHRpb25zKSB7XG4gICAgICAgIC8vICdEYmJWaWV3IChjaWQ6IFwiJyArIHRoaXMuY2lkICsgJ1wiKSBoYXMgYWxyZWFkeSBiZWVuIGRlc3Ryb3llZCBhbmQgY2Fubm90IGJlIHVzZWQuJ1xuICAgICAgICBpZih0aGlzLiRpc0RlYWxsb2MoKSkgcmV0dXJuIHRoaXNcbiAgICAgICAgaWYgKHRoaXMuJGlzTW91bnRlZCgpKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIGlmICghKCRlbCBpbnN0YW5jZW9mICQpKSAkZWwgPSAkKCRlbClcblxuICAgICAgICAvLyB0aGUgbW91bnRQb2ludCBpcyB1bm1vdW50ZWQuXG4gICAgICAgIGlmICghaXNFbE1vdW50ZWQoJGVsLmdldCgwKSkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN1cHBvcnRMaWZlQ3ljbGUsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50LFxuICAgICAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50LFxuICAgICAgICAgICAgdHJhbnNpdGlvblxuICAgICAgICB9ID0gdGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsIFtcbiAgICAgICAgICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAgICAgICAgICdzaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50JyxcbiAgICAgICAgICAgICdzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQnLFxuICAgICAgICAgICAgJ3RyYW5zaXRpb24nXG4gICAgICAgIF0pXG5cbiAgICAgICAgaWYgKCF0aGlzLiRpc1JlbmRlcmVkKCkpIHRoaXMuJHJlbmRlcigpXG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpIHRoaXMuJGNhbGxIb29rKCd2aWV3V2lsbE1vdW50JywgdGhpcylcblxuICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudClcbiAgICAgICAgICAgIHRoaXMuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdXaWxsTW91bnQnKVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g5byA5aeL54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi52aWV3V2lsbE1vdW50KSlcbiAgICAgICAgICAgIHRyYW5zaXRpb24udmlld1dpbGxNb3VudCh0aGlzLiRlbClcblxuICAgICAgICAkZWwuZXEoMCkuYXBwZW5kKHRoaXMuJGVsKVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g5byA5aeL57uT5p2fXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi52aWV3RGlkTW91bnQpKSB7XG4gICAgICAgICAgICAvLyDlvLrliLZyZWZsb3fvvIzorql0cmFuc2l0aW9u5Yqo55S755Sf5pWIXG4gICAgICAgICAgICAvLyB0aGlzLmVsLm9mZnNldEhlaWdodFxuICAgICAgICAgICAgdHJhbnNpdGlvbi52aWV3RGlkTW91bnQodGhpcy4kZWwpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSlcbiAgICAgICAgICAgIHRoaXMuJGNhbGxIb29rKCd2aWV3RGlkTW91bnQnLCB0aGlzKVxuXG4gICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3RGlkTW91bnQpXG4gICAgICAgICAgICB0aGlzLiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3RGlkTW91bnQnKVxuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuXG4gICAgJHVubW91bnQob3B0aW9ucykge1xuICAgICAgICBpZih0aGlzLiRpc0RlYWxsb2MoKSkgcmV0dXJuIHRoaXNcbiAgICAgICAgaWYgKCF0aGlzLiRpc01vdW50ZWQoKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICBsZXQge1xuICAgICAgICAgICAgc3VwcG9ydExpZmVDeWNsZSxcbiAgICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsVW5tb3VudCxcbiAgICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbm1vdW50LFxuICAgICAgICAgICAgdHJhbnNpdGlvblxuICAgICAgICB9ID0gdGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsIFtcbiAgICAgICAgICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAgICAgICAgICdzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVubW91bnQnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbm1vdW50JyxcbiAgICAgICAgICAgICd0cmFuc2l0aW9uJ1xuICAgICAgICBdKVxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgdGhpcy4kY2FsbEhvb2soJ3ZpZXdXaWxsVW5tb3VudCcsIHRoaXMpXG4gICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVubW91bnQpXG4gICAgICAgICAgICB0aGlzLiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3V2lsbFVubW91bnQnKVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g5byA5aeL54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24ob3B0aW9ucy50cmFuc2l0aW9uLnZpZXdXaWxsVW5tb3VudCkpXG4gICAgICAgICAgICB0cmFuc2l0aW9uLnZpZXdXaWxsVW5tb3VudCh0aGlzLiRlbClcblxuICAgICAgICB0aGlzLiRlbC5kZXRhY2goKVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g57uT5p2fXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi52aWV3RGlkVW5tb3VudCkpIHtcbiAgICAgICAgICAgIC8vIOW8uuWItnJlZmxvd++8jOiuqXRyYW5zaXRpb27liqjnlLvnlJ/mlYhcbiAgICAgICAgICAgIC8vIHRoaXMuZWwub2Zmc2V0SGVpZ2h0XG4gICAgICAgICAgICB0cmFuc2l0aW9uLnZpZXdEaWRVbm1vdW50KHRoaXMuJGVsKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpXG4gICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygndmlld0RpZFVubW91bnQnLCB0aGlzKVxuICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld0RpZFVubW91bnQpXG4gICAgICAgICAgICB0aGlzLiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3RGlkVW5tb3VudCcpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG5cblxuICAgIC8qKlxuICAgICAqIEBtZXRob2QgVmlldyMkYWRkU3Vidmlld1xuICAgICAqIEBwYXJhbSB7RGJiLlZpZXd9IHN1YnZpZXdcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqXG4gICAgICogJGFkZFN1YnZpZXcodmlldywgb3B0aW9ucylcbiAgICAgKlxuICAgICAqIHBhcmVudC4kYWRkU3VidmlldyhzdWJ2aWV3LCB7Li4ufSlcbiAgICAgKiBwYXJlbnQuJGFkZFN1YnZpZXcoc3Vidmlldywge2F0SW5kZXg6IGluZGV4fSkgLy8gaW5kZXg6IG51bWJlciB8fCAnZmlyc3QnIHx8ICdsYXN0J1xuICAgICAqXG4gICAgICogb3B0aW9ucy5zaG91bGRQcm9wYWdhdGVWaWV3V2lsbE1vdW50IHtCb29sZWFufVxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50IHtib29sfVxuICAgICAqXG4gICAgICovXG4gICAgJGFkZFN1YnZpZXcodmlld3MsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge31cblxuICAgICAgICAvLyBjb25zb2xlLmxvZygnYWRkU3VidmlldycpXG4gICAgICAgIGxldCB2aWV3c0NvdW50XG4gICAgICAgIC8vIHZpZXdzIOWPguaVsOaOpeWPl+S4gOS4quWNleeLrOeahOinhuWbvu+8jOaIluS4gOS4quinhuWbvuaVsOe7hO+8jOmcgOimgeWIhuWIq+WkhOeQhlxuICAgICAgICAvLyAxLiDov4fmu6Tmjonml6DmlYjnmoTop4blm75cbiAgICAgICAgLy8gMi4g5aaC5p6c5piv5LiA5Liq5Y2V54us55qE6KeG5Zu+77yM5Lmf6L2s5o2i5oiQ5Y+q5pyJ5LiA5Liq5YWD57Sg55qE5pWw57uE57uf5LiA5aSE55CGXG4gICAgICAgIGlmIChfLmlzQXJyYXkodmlld3MpKSB7XG4gICAgICAgICAgICB2aWV3cyA9IF8uZmlsdGVyKHZpZXdzLCB2aWV3ID0+ICh2aWV3IGluc3RhbmNlb2YgRGJiVmlldyAmJiB2aWV3LiRpc1JldGFpbmVkKCkgJiYgIXRoaXMuJGhhc1N1YnZpZXcodmlldykpLCB0aGlzKVxuXG4gICAgICAgICAgICBpZiAoISh2aWV3c0NvdW50ID0gdmlld3MubGVuZ3RoKSkgcmV0dXJuIHRoaXNcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICEodmlld3NcbiAgICAgICAgICAgICAgICAmJiB2aWV3cyBpbnN0YW5jZW9mIERiYlZpZXdcbiAgICAgICAgICAgICAgICAmJiB2aWV3cy4kaXNSZXRhaW5lZCgpXG4gICAgICAgICAgICAgICAgJiYgIXRoaXMuJGhhc1N1YnZpZXcodmlld3MpKVxuICAgICAgICAgICAgKSByZXR1cm4gdGhpc1xuXG4gICAgICAgICAgICB2aWV3cyA9IFt2aWV3c11cbiAgICAgICAgICAgIHZpZXdzQ291bnQgPSAxXG4gICAgICAgIH1cblxuICAgICAgICAvLyDlpITnkIblj4LmlbDvvJrlpITnkIZvcHRpb25zXG4gICAgICAgIGxldCB7XG4gICAgICAgICAgICBzdXBwb3J0TGlmZUN5Y2xlLFxuICAgICAgICAgICAgc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudCxcbiAgICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZVZpZXdEaWRNb3VudCxcbiAgICAgICAgICAgIHNob3VsZERlbGVnYXRlRXZlbnRzLFxuICAgICAgICAgICAgdHJhbnNpdGlvbixcbiAgICAgICAgICAgIGF0SW5kZXhcbiAgICAgICAgfSA9IHRoaXMuJGdldE9wdGlvbihvcHRpb25zLCBbXG4gICAgICAgICAgICAnc3VwcG9ydExpZmVDeWNsZScsXG4gICAgICAgICAgICAnc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxNb3VudCcsXG4gICAgICAgICAgICAnc2hvdWxkUHJvcGFnYXRlVmlld0RpZE1vdW50JyxcbiAgICAgICAgICAgICdzaG91bGREZWxlZ2F0ZUV2ZW50cycsXG4gICAgICAgICAgICAndHJhbnNpdGlvbicsXG4gICAgICAgICAgICAnYXRJbmRleCdcbiAgICAgICAgXSlcblxuICAgICAgICAvLyDlsYDpg6jlj5jph4/nvJPlrZhcbiAgICAgICAgbGV0IHN1YnZpZXdzID0gdGhpcy5fX3N1YnZpZXdzX18gfHwgKHRoaXMuX19zdWJ2aWV3c19fID0gW10pXG4gICAgICAgIGxldCBzdWJ2aWV3c0NvdW50ID0gc3Vidmlld3MubGVuZ3RoXG4gICAgICAgIGxldCAkZnJhZyA9ICQoZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpKVxuXG5cbiAgICAgICAgLy8g56Gu5a6a5o+S5YWl54K5XG4gICAgICAgIC8vIOWtl+espuS4sueahOaDheWGte+8jOmdnidmaXJzdCfnmoTlhajph43nva7kuLonbGFzdCfjgIJcbiAgICAgICAgaWYgKHR5cGVvZiBhdEluZGV4ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgYXRJbmRleCA9IChhdEluZGV4ID09PSAnZmlyc3QnKSA/IDAgOiAnbGFzdCdcblxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhdEluZGV4ID09PSAnbnVtYmVyJykgeyAvLyDmlbDlrZfnmoTmg4XlhrXvvIzpnZ7lkIjms5VpbmRleOmHjee9ruS4uidsYXN0J1xuICAgICAgICAgICAgaWYoYXRJbmRleCA8IDAgfHwgYXRJbmRleCA+PSBzdWJ2aWV3c0NvdW50KSBhdEluZGV4ID0gJ2xhc3QnXG5cbiAgICAgICAgfSBlbHNlIHsgLy8g5Lu75L2V5YW25LuW5YC86YO95piv6Z2e5rOV55qE77yM5YWo6YOo6YeN572u5Li6J2xhc3QnXG4gICAgICAgICAgICBhdEluZGV4ID0gJ2xhc3QnXG5cbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zLmF0SW5kZXggPSBhdEluZGV4XG5cblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSkgdGhpcy4kY2FsbEhvb2soJ3N1YnZpZXdXaWxsQWRkJywgdmlld3MsIHRoaXMsIG9wdGlvbnMpXG5cbiAgICAgICAgLy8g5Luj55CG5a2Q6KeG5Zu+5LqL5Lu2XG4gICAgICAgIGxldCBpXG4gICAgICAgIGlmIChzaG91bGREZWxlZ2F0ZUV2ZW50cykge1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkgeyBkZWxlZ2F0ZUV2ZW50cy5jYWxsKHRoaXMsIHZpZXdzW2ldKSB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmuLLmn5Plpb1zdXBlcnZpZXfmqKHmnb/vvIzlvoVzdWJ2aWV355qERE9N5o+S5YWlXG4gICAgICAgIGlmICghdGhpcy4kaXNSZW5kZXJlZCgpKSB0aGlzLiRyZW5kZXIoKVxuXG4gICAgICAgIC8vIOa4suafk+WlvXN1YnZpZXfnmoTmqKHmnb/vvIzlvoXmj5LlhaVcbiAgICAgICAgbGV0IGN1cnJlbnRcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkge1xuICAgICAgICAgICAgY3VycmVudCA9IHZpZXdzW2ldXG4gICAgICAgICAgICBpZiAoIWN1cnJlbnQuJGlzUmVuZGVyZWQoKSkgY3VycmVudC4kcmVuZGVyKClcbiAgICAgICAgICAgICRmcmFnLmFwcGVuZChjdXJyZW50LiRlbClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOWmguaenOW9k+WJjXZpZXflt7Lnu49tb3VudGVk77yM5ZCR5omA5pyJ5a2Q57G75Lyg5pKtdmlld1dpbGxNb3VudFxuICAgICAgICBsZXQgaXNNb3VudGVkID0gdGhpcy4kaXNNb3VudGVkKClcbiAgICAgICAgaWYgKChpc01vdW50ZWQpKSB7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmlld3NDb3VudDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudCA9IHZpZXdzW2ldXG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQub3B0aW9ucy5zdXBwb3J0TGlmZUN5Y2xlKSBjdXJyZW50LiRjYWxsSG9vaygndmlld1dpbGxNb3VudCcsIGN1cnJlbnQpXG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQpIGN1cnJlbnQuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdXaWxsTW91bnQnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnirbmgIFcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnN1YnZpZXdXaWxsQWRkKSkge1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSB2aWV3c1tpXVxuICAgICAgICAgICAgICAgIHRyYW5zaXRpb24uc3Vidmlld1dpbGxBZGQoY3VycmVudC4kZWwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyDlhYjmjILovb1ET03vvIzlho3mj5LlhaXop4blm77vvIzku6XlhY3mj5LlhaXnmoTop4blm77lvbHlk41pbmRleO+8jOWvvOiHtOaPkuWFpeS9jee9rumUmeivr1xuICAgICAgICBpZiAoYXRJbmRleCA9PT0gJ2xhc3QnKSB7XG4gICAgICAgICAgICB0aGlzLl9fJG1vdW50UG9pbnRfXy5hcHBlbmQoJGZyYWcpXG4gICAgICAgICAgICB0aGlzLl9fc3Vidmlld3NfXyA9IHN1YnZpZXdzLmNvbmNhdCh2aWV3cylcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3Vidmlld3NbYXRJbmRleF0uJGVsLmJlZm9yZSgkZnJhZylcbiAgICAgICAgICAgIC8vIHRoaXMuX18kbW91bnRQb2ludF9fLmluc2VydEJlZm9yZShmcmFnLCBzdWJ2aWV3c1thdEluZGV4XS5lbCkgICAgICAgICAgICBcbiAgICAgICAgICAgIHRoaXMuX19zdWJ2aWV3c19fID0gc3Vidmlld3Muc2xpY2UoMCwgYXRJbmRleCkuY29uY2F0KHZpZXdzKS5jb25jYXQoc3Vidmlld3Muc2xpY2UoYXRJbmRleCkpXG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g57uT5p2f54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi5zdWJ2aWV3RGlkQWRkKSkge1xuICAgICAgICAgICAgLy8g5by65Yi2cmVmbG9377yM6K6pdHJhbnNpdGlvbuWKqOeUu+eUn+aViFxuICAgICAgICAgICAgdGhpcy5lbC5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB2aWV3c0NvdW50OyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50ID0gdmlld3NbaV1cbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uLnN1YnZpZXdEaWRBZGQoY3VycmVudC4kZWwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vIOaPkuWFpeeahHN1YnZpZXcg5YWo6YOo6ZmE5Yqg5LiKX19zdXBlcnZpZXdfX+eahOWxnuaAp1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmlld3NDb3VudDsgaSArPSAxKSB7XG4gICAgICAgICAgICBjdXJyZW50ID0gdmlld3NbaV1cbiAgICAgICAgICAgIGN1cnJlbnQuX19zdXBlcnZpZXdfXyA9IHRoaXNcbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8g5aaCc3Vidmlld+W3sue7j21vdW50ZWTvvIzlkJHmiYDmnInlrZDnsbvkvKDmkq12aWV3RGlkTW91bnRcbiAgICAgICAgaWYgKGlzTW91bnRlZCkge1xuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHZpZXdzQ291bnQ7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSB2aWV3c1tpXVxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50Lm9wdGlvbnMuc3VwcG9ydExpZmVDeWNsZSkgY3VycmVudC4kY2FsbEhvb2soJ3ZpZXdEaWRNb3VudCcsIGN1cnJlbnQpXG4gICAgICAgICAgICAgICAgaWYgKHNob3VsZFByb3BhZ2F0ZVZpZXdXaWxsTW91bnQpIGN1cnJlbnQuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRNb3VudCcpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3VwcG9ydExpZmVDeWNsZSkgdGhpcy4kY2FsbEhvb2soJ3N1YnZpZXdEaWRBZGQnLCB2aWV3cywgdGhpcywgb3B0aW9ucylcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cblxuICAgIC8qKlxuICAgICAqIEBtZXRob2QgVmlldyMkcmVtb3ZlU3Vidmlld1xuICAgICAqIEBwYXJhbSB7RGJiLlZpZXcgfCBOdW1iZXIgfCBTdHJpbmd9IHZpZXcgLy8gc3VidmlldyBvciBpbmRleCBudW1iZXIgb3IgJ2ZpcnN0JywgJ2xhc3QnXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKlxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIOenu+mZpOS4gOS4quWtkOinhuWbvlxuICAgICAqXG4gICAgICogJHJlbW92ZVN1YnZpZXcodmlldyBbLG9wdGlvbnNdKVxuICAgICAqXG4gICAgICogcGFyZW50LiRyZW1vdmVTdWJ2aWV3KHN1YnZpZXcgWyxvcHRpb25zXSlcbiAgICAgKiBwYXJlbnQuJHJlbW92ZVN1YnZpZXcoaW5kZXhOdW1iZXIgWyxvcHRpb25zXSlcbiAgICAgKiBwYXJlbnQuJHJlbW92ZVN1YnZpZXcoJ2ZpcnN0JyBbLG9wdGlvbnNdKVxuICAgICAqIHBhcmVudC4kcmVtb3ZlU3VidmlldygnbGFzdCcgWyxvcHRpb25zXSlcbiAgICAgKlxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50IHtCb29sZWFufVxuICAgICAqIG9wdGlvbnMuc2hvdWxkUHJvcGFnYXRlVmlld0RpZFVuTW91bnQge2Jvb2x9XG4gICAgICogb3B0aW9ucy5zaG91bGRQcmV2ZW50RGVhbGxvYyB7Ym9vbH1cbiAgICAgKlxuICAgICAqL1xuICAgICRyZW1vdmVTdWJ2aWV3KHZpZXcsIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge31cblxuICAgICAgICAvLyBjb25zb2xlLmxvZygncmVtb3ZlU3VidmlldycpXG4gICAgICAgIGlmICghdGhpcy4kaXNOb3RFbXB0eSgpKSByZXR1cm4gdGhpc1xuICAgICAgICBpZiAodmlldyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpc1xuXG5cbiAgICAgICAgbGV0IHtcbiAgICAgICAgICAgIHN1cHBvcnRMaWZlQ3ljbGUsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQsXG4gICAgICAgICAgICBzaG91bGRQcm9wYWdhdGVWaWV3RGlkVW5Nb3VudCxcbiAgICAgICAgICAgIHNob3VsZFByZXZlbnREZWFsbG9jLFxuICAgICAgICAgICAgdHJhbnNpdGlvblxuICAgICAgICB9ID0gdGhpcy4kZ2V0T3B0aW9uKG9wdGlvbnMsIFtcbiAgICAgICAgICAgICdzdXBwb3J0TGlmZUN5Y2xlJyxcbiAgICAgICAgICAgICdzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQnLFxuICAgICAgICAgICAgJ3Nob3VsZFByb3BhZ2F0ZVZpZXdEaWRVbk1vdW50JyxcbiAgICAgICAgICAgICdzaG91bGRQcmV2ZW50RGVhbGxvYycsXG4gICAgICAgICAgICAndHJhbnNpdGlvbidcbiAgICAgICAgXSlcblxuICAgICAgICBsZXQgc3Vidmlld3MgPSB0aGlzLl9fc3Vidmlld3NfX1xuXG4gICAgICAgIC8vIOehruWummF0SW5kZXjnmoTlgLxcbiAgICAgICAgbGV0IGF0SW5kZXhcbiAgICAgICAgaWYgKHZpZXcgaW5zdGFuY2VvZiBEYmJWaWV3KSB7XG4gICAgICAgICAgICBhdEluZGV4ID0gdGhpcy4kaW5kZXhPZlN1YnZpZXcodmlldylcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2aWV3ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSAodmlldyA8IDAgfHwgdmlldyA+PSB0aGlzLiRjb3VudCgpKSA/IC0xIDogdmlld1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpZXcgPT09ICdmaXJzdCcpIHtcbiAgICAgICAgICAgICAgICBhdEluZGV4ID0gMFxuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpZXcgPT09ICdsYXN0Jykge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSB0aGlzLiRjb3VudCgpIC0gMVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0SW5kZXggPSAtMVxuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2aWV3ID0gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0SW5kZXggPT09IC0xKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIGlmICh2aWV3ID09PSBudWxsKSB2aWV3ID0gc3Vidmlld3NbYXRJbmRleF1cblxuICAgICAgICAvLyDljbPlsIbnp7vpmaTnmoRzdWJ2aWV35Y+KaW5kZXjpmYTliqDliLBvcHRpb25z6YeM77yM5Lyg6YCS57uZ5LqL5Lu25aSE55CG5ZmoXG4gICAgICAgIG9wdGlvbnMudmlldyA9IHZpZXdcbiAgICAgICAgb3B0aW9ucy5hdEluZGV4ID0gYXRJbmRleFxuXG4gICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKSB0aGlzLiRjYWxsSG9vaygnc3Vidmlld1dpbGxSZW1vdmUnLCB2aWV3LCB0aGlzLCBvcHRpb25zKVxuXG4gICAgICAgIHN1YnZpZXdzLnNwbGljZShhdEluZGV4LCAxKVxuICAgICAgICBkZWxldGUgdmlldy5fX3N1cGVydmlld19fXG5cbiAgICAgICAgLy8g56e76Zmk5a+5c3Vidmlld+eahOS6i+S7tuS7o+eQhlxuICAgICAgICB1bkRlbGVnYXRlRXZlbnRzLmNhbGwodGhpcywgdmlldylcblxuICAgICAgICAvLyDlpoLmnpzlvZPliY1zdWJ2aWV35bey57uPbW91bnRlZO+8jOWQkeaJgOacieWtkOexu+S8oOaSrXZpZXdXaWxsVW5tb3VudFxuICAgICAgICBpZiAodmlldy4kaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgIGlmICh2aWV3Lm9wdGlvbnMuc3VwcG9ydExpZmVDeWNsZSkgdmlldy4kY2FsbEhvb2soJ3ZpZXdXaWxsVW5tb3VudCcsIHZpZXcpXG4gICAgICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50KSB2aWV3LiRwcm9wYWdhdGVMaWZlQ3ljbGVIb29rKCd2aWV3V2lsbFVubW91bnQnKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHJhbnNpdGlvbiDlvIDlp4vnirbmgIFcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbih0cmFuc2l0aW9uLnN1YnZpZXdXaWxsUmVtb3ZlKSkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbi5zdWJ2aWV3V2lsbFJlbW92ZSh2aWV3LiRlbClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRyYW5zaXRpb24g57uT5p2f54q25oCBXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24odHJhbnNpdGlvbi5zdWJ2aWV3RGlkUmVtb3ZlKSkge1xuICAgICAgICAgICAgLy8g5by65Yi2cmVmbG9377yM6K6pdHJhbnNpdGlvbuWKqOeUu+eUn+aViFxuICAgICAgICAgICAgdGhpcy5lbC5vZmZzZXRIZWlnaHRcbiAgICAgICAgICAgIHRyYW5zaXRpb24uc3Vidmlld0RpZFJlbW92ZSh2aWV3LiRlbCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgLy8gdHJhbnNpdGlvbiBlbmRcblxuICAgICAgICAgICAgICAgIHZpZXcuJGVsLmRldGFjaCgpXG4gICAgICAgICAgICAgICAgLy8gdGhpcy5fXyRtb3VudFBvaW50X18ucmVtb3ZlQ2hpbGQodmlldy5lbClcblxuICAgICAgICAgICAgICAgIC8vIOWmguaenOW9k+WJjXN1YnZpZXflt7Lnu491bm1vdW50ZWTvvIzlkJHmiYDmnInlrZDnsbvkvKDmkq12aWV3RGlkVW5tb3VudFxuICAgICAgICAgICAgICAgIGlmICghdmlldy4kaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZpZXcub3B0aW9ucy5zdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy4kY2FsbEhvb2soJ3ZpZXdEaWRVbm1vdW50JywgdmlldylcblxuICAgICAgICAgICAgICAgICAgICBpZiAoc2hvdWxkUHJvcGFnYXRlVmlld1dpbGxVbk1vdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgdmlldy4kcHJvcGFnYXRlTGlmZUN5Y2xlSG9vaygndmlld0RpZFVubW91bnQnKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChzdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLiRjYWxsSG9vaygnc3Vidmlld0RpZFJlbW92ZScsIHZpZXcsIHRoaXMsIG9wdGlvbnMpXG5cbiAgICAgICAgICAgICAgICBpZiAoIXNob3VsZFByZXZlbnREZWFsbG9jKVxuICAgICAgICAgICAgICAgICAgICB2aWV3LiRkZWFsbG9jKClcblxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKVxuICAgICAgICAgICAgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2aWV3LiRlbC5kZXRhY2goKVxuICAgICAgICAgICAgLy8gdGhpcy5fXyRtb3VudFBvaW50X18ucmVtb3ZlQ2hpbGQodmlldy5lbClcblxuICAgICAgICAgICAgLy8g5aaC5p6c5b2T5YmNc3Vidmlld+W3sue7j3VubW91bnRlZO+8jOWQkeaJgOacieWtkOexu+S8oOaSrXZpZXdEaWRVbm1vdW50XG4gICAgICAgICAgICBpZiAoIXZpZXcuJGlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZpZXcub3B0aW9ucy5zdXBwb3J0TGlmZUN5Y2xlKVxuICAgICAgICAgICAgICAgICAgICB2aWV3LiRjYWxsSG9vaygndmlld0RpZFVubW91bnQnLCB2aWV3KVxuICAgICAgICAgICAgICAgIGlmIChzaG91bGRQcm9wYWdhdGVWaWV3V2lsbFVuTW91bnQpXG4gICAgICAgICAgICAgICAgICAgIHZpZXcuJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2soJ3ZpZXdEaWRVbm1vdW50JylcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN1cHBvcnRMaWZlQ3ljbGUpXG4gICAgICAgICAgICAgICAgdGhpcy4kY2FsbEhvb2soJ3N1YnZpZXdEaWRSZW1vdmUnLCB2aWV3LCB0aGlzLCBvcHRpb25zKVxuXG4gICAgICAgICAgICBpZiAoIXNob3VsZFByZXZlbnREZWFsbG9jKVxuICAgICAgICAgICAgICAgIHZpZXcuJGRlYWxsb2MoKVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJGNvdW50KCkge1xuICAgICAgICByZXR1cm4gXy5zaXplKHRoaXMuX19zdWJ2aWV3c19fKVxuICAgIH0sXG5cbiAgICAkaXNFbXB0eSgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLiRjb3VudCgpXG4gICAgfSxcblxuICAgICRpc05vdEVtcHR5KCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLiRjb3VudCgpXG4gICAgfSxcblxuICAgICRoYXNTdWJ2aWV3KHN1YnZpZXcpIHtcbiAgICAgICAgcmV0dXJuIHN1YnZpZXcuX19zdXBlcnZpZXdfXyAmJiBzdWJ2aWV3Ll9fc3VwZXJ2aWV3X18gPT09IHRoaXNcbiAgICB9LFxuXG4gICAgJGVhY2hTdWJ2aWV3KGl0ZXJhdGVlLCBjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLiRpc0VtcHR5KCkpIHJldHVyblxuICAgICAgICBsZXQgaVxuICAgICAgICBpZiAoIWNvbnRleHQpIHtcbiAgICAgICAgICAgIC8vIGxlbmd0aCDpnIDopoHliqjmgIHor7vlj5bvvIzpgb/lhY3pgY3ljobov4fnqItsZW5ndGjlj5jljJZcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLl9fc3Vidmlld3NfXy5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgIGl0ZXJhdGVlKHRoaXMuX19zdWJ2aWV3c19fW2ldLCBpLCB0aGlzLl9fc3Vidmlld3NfXylcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbGVuZ3RoIOmcgOimgeWKqOaAgeivu+WPlu+8jOmBv+WFjemBjeWOhui/h+eoi2xlbmd0aOWPmOWMllxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMuX19zdWJ2aWV3c19fLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgaXRlcmF0ZWUuY2FsbChjb250ZXh0LCB0aGlzLl9fc3Vidmlld3NfX1tpXSwgaSwgdGhpcy5fX3N1YnZpZXdzX18pXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyDmn6Xor6Lop4blm77lnKjlrZDop4blm77kuK3nmoRpbmRleFxuICAgICRpbmRleE9mU3VidmlldyhzdWJ2aWV3LCBpc1NvcnQpIHtcbiAgICAgICAgcmV0dXJuIF8uaW5kZXhPZih0aGlzLl9fc3Vidmlld3NfXywgc3VidmlldywgaXNTb3J0KVxuICAgIH0sXG5cbiAgICAkaW5kZXhJblN1cGVydmlldyhpc1NvcnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9fc3VwZXJ2aWV3X18pIHJldHVybiAtMVxuICAgICAgICByZXR1cm4gdGhpcy5fX3N1cGVydmlld19fLiRpbmRleE9mU3Vidmlldyh0aGlzLCBpc1NvcnQpXG4gICAgfSxcblxuICAgICRnZXRTdWJ2aWV3cygpIHtcbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSkgcmV0dXJuIG51bGxcbiAgICAgICAgcmV0dXJuIHRoaXMuX19zdWJ2aWV3c19fXG4gICAgfSxcblxuICAgICRnZXRTdWJ2aWV3QXQoaW5kZXgpIHtcbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSkgcmV0dXJuIG51bGxcbiAgICAgICAgcmV0dXJuIHRoaXMuX19zdWJ2aWV3c19fW2luZGV4XSB8fCBudWxsXG4gICAgfSxcblxuICAgICRnZXRTdXBwZXJ2aWV3KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fX3N1cGVydmlld19fIHx8IG51bGxcbiAgICB9LFxuXG4gICAgJGdldEZpcnN0U3VidmlldygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGdldFN1YnZpZXdBdCgwKVxuICAgIH0sXG5cbiAgICAkZ2V0TGFzdFN1YnZpZXcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRnZXRTdWJ2aWV3QXQodGhpcy4kY291bnQoKSAtIDEpXG4gICAgfSxcblxuICAgICRnZXROZXh0U2libGluZygpIHtcbiAgICAgICAgdmFyIHN1cGVydmlldywgaWR4XG5cbiAgICAgICAgaWYgKChzdXBlcnZpZXcgPSB0aGlzLiRnZXRTdXBwZXJ2aWV3KCkpKSB7XG4gICAgICAgICAgICBpZHggPSBzdXBlcnZpZXcuJGluZGV4T2ZTdWJ2aWV3KHRoaXMpXG4gICAgICAgICAgICBpZiAoaWR4ID09PSBzdXBlcnZpZXcuJGNvdW50KCkgLSAxKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgcmV0dXJuIHN1cGVydmlldy4kZ2V0U3Vidmlld0F0KGlkeCArIDEpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9LFxuXG4gICAgJGdldFByZXZTaWJsaW5nKCkge1xuICAgIFx0dmFyIHN1cGVydmlldywgaWR4XG5cbiAgICAgICAgaWYgKChzdXBlcnZpZXcgPSB0aGlzLiRnZXRTdXBwZXJ2aWV3KCkpKSB7XG4gICAgICAgICAgICBpZHggPSBzdXBlcnZpZXcuJGluZGV4T2ZTdWJ2aWV3KHRoaXMpXG4gICAgICAgICAgICBpZiAoaWR4ID09PSAwKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgcmV0dXJuIHN1cGVydmlldy4kZ2V0U3Vidmlld0F0KGlkeCAtIDEpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9LFxuXG4gICAgJGVtcHR5U3Vidmlld3Mob3B0aW9ucykge1xuICAgICAgICB2YXIgZGlzcGxheVxuXG4gICAgICAgIGlmICh0aGlzLiRpc0VtcHR5KCkpIHJldHVybiB0aGlzXG5cbiAgICAgICAgZGlzcGxheSA9IHRoaXMuX18kbW91bnRQb2ludF9fLmhpZGUoKVxuICAgICAgICB3aGlsZSAodGhpcy5fX3N1YnZpZXdzX18ubGVuZ3RoKSB0aGlzLiRyZW1vdmVTdWJ2aWV3KDAsIG9wdGlvbnMpXG4gICAgICAgIHRoaXMuX19zdWJ2aWV3c19fLmxlbmd0aCA9IDBcbiAgICAgICAgdGhpcy5fXyRtb3VudFBvaW50X18uc2hvdygpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHNvcnRTdWJ2aWV3cyhjb21wYXJhdG9yKSB7XG4gICAgICAgIHZhciAkZnJhZ21lbnQsICRtb3VudFBvaW50LCBkaXNwbGF5XG5cbiAgICAgICAgaWYgKHRoaXMuJGlzRW1wdHkoKSB8fCAhXy5pc0Z1bmN0aW9uKGNvbXBhcmF0b3IpKSByZXR1cm4gdGhpc1xuXG4gICAgICAgIHRoaXMuJGdldFN1YnZpZXdzKCkuc29ydChjb21wYXJhdG9yKSAvLyDlhYjmjpLluo9cblxuICAgICAgICAvLyDmiafooYzlj5jmm7RcbiAgICAgICAgJGZyYWdtZW50ID0gJChkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCkpXG4gICAgICAgICRtb3VudFBvaW50ID0gdGhpcy5fXyRtb3VudFBvaW50X19cbiAgICAgICAgJG1vdW50UG9pbnQuaGlkZSgpXG4gICAgICAgIHRoaXMuJGVhY2hTdWJ2aWV3KHN1YnZpZXcgPT4gJGZyYWdtZW50LmFwcGVuZChzdWJ2aWV3LiRlbCkpXG4gICAgICAgICRtb3VudFBvaW50LnNob3coKVxuICAgICAgICAkbW91bnRQb2ludC5hcHBlbmQoJGZyYWdtZW50KVxuXG4gICAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcblxuICAgIC8vIOWQkeWGheS8oOaSreS6i+S7tlxuICAgICRwcm9wYWdhdGUobmFtZSwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQob3B0aW9ucyB8fCB7fSwgeyBjdXJyZW50VGFyZ2V0OiB0aGlzIH0pIC8vIGN1cnJlbnRUYXJnZXQg5Li65b2T5YmNdmlld1xuICAgICAgICBpZiAoIV8uaGFzKG9wdGlvbnMsICd0YXJnZXQnKSkgb3B0aW9ucy50YXJnZXQgPSB0aGlzIC8vIHRhcmdldCDkuLrkvKDmkq3otbfngrlcblxuICAgICAgICB0aGlzLiRjYWxsSG9vayhuYW1lLCBvcHRpb25zKVxuICAgICAgICB0aGlzLiRlYWNoU3VidmlldyhmdW5jdGlvbihzdWJ2aWV3KSB7XG4gICAgICAgICAgICBzdWJ2aWV3LiRwcm9wYWdhdGUobmFtZSwgb3B0aW9ucylcbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG5cbiAgICAvLyDlkJHlpJblhpLms6Hkuovku7ZcbiAgICAkZGlzcGF0Y2gobmFtZSwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gXy5leHRlbmQob3B0aW9ucyB8fCB7fSwgeyBjdXJyZW50VGFyZ2V0OiB0aGlzIH0pIC8vIGN1cnJlbnRUYXJnZXQg5Li65b2T5YmNdmlld1xuICAgICAgICBpZiAoIV8uaGFzKG9wdGlvbnMsICd0YXJnZXQnKSkgb3B0aW9ucy50YXJnZXQgPSB0aGlzIC8vIHRhcmdldCDkuLrlhpLms6HotbfngrlcblxuICAgICAgICB0aGlzLiRjYWxsSG9vayhuYW1lLCBvcHRpb25zKVxuICAgICAgICBpZiAodGhpcy5fX3N1cGVydmlld19fKSB0aGlzLl9fc3VwZXJ2aWV3X18uJGRpc3BhdGNoKG5hbWUsIG9wdGlvbnMpXG5cbiAgICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuXG4gICAgJHByb3BhZ2F0ZUxpZmVDeWNsZUhvb2sobWV0aG9kKSB7XG4gICAgICAgIF8uZWFjaCh0aGlzLl9fc3Vidmlld3NfXywgZnVuY3Rpb24oc3Vidmlldykge1xuICAgICAgICAgICAgc3Vidmlldy4kY2FsbEhvb2sobWV0aG9kLCBzdWJ2aWV3KVxuICAgICAgICAgICAgc3Vidmlldy4kcHJvcGFnYXRlTGlmZUN5Y2xlSG9vayhtZXRob2QpXG4gICAgICAgIH0pXG4gICAgfVxufSlcblxuXG4vLyDlsIYgdW5kZXJzY29yZSDnmoTpg6jliIbpm4blkIjmlrnms5XliqDlhaUgdmlldyDnmoTljp/lnovvvIznlKjku6Xmk43kvZzlrZDop4blm75cbl8uZWFjaCh7XG4gICAgbWFwOiAnXyRtYXAnLFxuICAgIHJlZHVjZTogJ18kcmVkdWNlJyxcbiAgICBmaW5kOiAnXyRmaW5kJyxcbiAgICBmaWx0ZXI6ICdfJGZpbHRlcicsXG4gICAgcmVqZWN0OiAnXyRyZWplY3QnLFxuICAgIGV2ZXJ5OiAnXyRldmVyeScsXG4gICAgc29tZTogJ18kc29tZScsXG4gICAgaW5jbHVkZXM6ICdfJGluY2x1ZGVzJ1xufSwgKHZpZXdNZXRob2QsIF9tZXRob2QpPT57XG4gICAgRGJiVmlldy5wcm90b3R5cGVbdmlld01ldGhvZF0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgbGV0IGFyZ3MgPSBfLnRvQXJyYXkoYXJndW1lbnRzKVxuICAgICAgICBhcmdzLnVuc2hpZnQodGhpcy5fX3N1YnZpZXdzX18gfHwgW10pXG4gICAgICAgIHJldHVybiBfW19tZXRob2RdLmFwcGx5KF8sIGFyZ3MpXG4gICAgfVxufSlcblxuXG5cbm1vZHVsZS5leHBvcnRzID0gRGJiVmlld1xuIl19
