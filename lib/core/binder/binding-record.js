'use strict'

const BuildInUIAccessor = {
  value: {
    get($el, field, dataKey) { return $el.val() },
    set($el, field, value, dataKey) {
      if ($el.val() !== value) {
        $el.val(value)
        $el.trigger('change')
      } 
    }
  },
  checked: {
    get($el, field, dataKey) { return $el.prop('checked') },
    set($el, field, value, dataKey) {
      if ($el.prop('checked') !== value) {
        $el.prop('checked', value)
        $el.trigger('change')
      }
    }
  },
  selected: {
    get($el, field, dataKey) {
      return _.find($el.find('option'), option=>option.selected===true).value
    },
    set($el, field, value, dataKey) {
      let option = _.find($el.find('option'),option=>option.value===value)
      if (option && (!option.selected)) {
        option.selected = true
        $el.trigger('change')
      } 
    }
  },
  option: {
    get($el, field, dataKey) {
      return _.find($el.find('option'), option=>option.selected===true).innerHTML
    },
    set($el, field, value, dataKey) {
      let option = _.find($el.find('option'),option=>option.innerHTML===value)
      if (option && (!option.selected)) {
        option.selected = true
        $el.trigger('change')
      }
    }
  },
  radio: {
    get($el, field, dataKey) { return _.find($el, el=>el.checked===true).value },
    set($el, field, value, dataKey) {
      let radio = _.find($el, radio=>radio.value===value)
      if (radio && (!radio.checked)) {
        radio.checked = true
        $(radio).trigger('change')
      }
    }
  },
  text: {
    get($el, field, dataKey) { return $el.html() },
    set($el, field, value, dataKey) {
      ($el.html() !== value) && $el.html(value)
    }
  },
  prop: {
    get($el, field, dataKey) { return $el.prop(field) },
    set($el, field, value, dataKey) {
      ($el.prop(field) !== value) && $el.prop(field, value)
    }
  },
  data: {
    get($el, field, dataKey) { return $el.data(field) },
    set($el, field, value, dataKey) {
      ($el.data(field) !== value) && $el.data(field, value)
    }
  },
  attr: {
    get($el, field, dataKey) { return $el.attr(field) },
    set($el, field, value, dataKey) { 
      ($el.attr(field) !== value) && $el.attr(field, value)
    }
  }
}


const DbbObject = require('../dbb-object')
const BindingRecord = DbbObject.extend({
    constructor: function BindingRecord(view, model, data) {
      DbbObject.call(this)
      let options = { view, model, data }
      _.extend(this, options)
      _.isFunction(this.initialize) && this.initialize()
    },

    $dealloc() {
      this.unbind()
      DbbObject.prototype.$dealloc.call(this)
    },

    get(key, defaults) {
      return _.result(this.data, key, defaults)
    },

    set(key, val) {
      let before = {}
      let changed = {}

      let prev = this.get(key)
      if ((typeof key === 'string' || typeof key === 'number') && prev !== val) {
        before[key] = prev
        changed[key] = val
        this.data[key] = val
        this.trigger(`change:${key}`, this, val, { prev })
  
      } else if (typeof key === 'object') {
        _.each(key, (val, key) => {
          let prev = this.get(key)
          if (prev !== val) {
            before[key] = prev
            changed[key] = val
            this.data[key] = val
            this.trigger(`change:${key}`, this, val, { prev })
          }
        })
      }

      this.trigger(`change`, this, changed, before)

      return this
    },

    selector() {
      let selector = this.get('selector')
      if (selector) return selector

      // 分隔符 | ,
      // `value @ .absdf[name="abc"] .input ` => `.absdf[name="abc"] .input`
      selector = $.trim(this.get('targetInfo').replace(/(^(\s+)?\S+(\s+)?@)(\s+)?/, ''))
      if (selector) this.set('selector', selector)
      return selector
    },

    $el() {
      let selector = this.selector()
      return (selector === '$el') ? this.view.$el : this.view.$(selector)
    },

    tagName() {
      let tagName = this.get('tagName')
      if (tagName) return tagName
      let el = this.$el().get(0)
      tagName = el && el.tagName.toLowerCase()
      if (tagName) this.set('tagName', tagName)
      return tagName
    },

    // 从 `type@selector` 中提取 `type` 部分
    _pick_update_key() {
      let type = this.get('targetInfo').match(/\S+(\s+)?@/)
      if (!type) return ''
      return $.trim(type[0].replace('@',''))
    },
    // UI 更新的方式
    ui_update_info() {
      let cache = this.get('ui_update_info')
      if (cache) return cache

      let $el = this.$el()
      let tagName = this.tagName()

      let host = 'buildin' // OR view
      let key = this._pick_update_key()
      let field = key
      let get
      let set

      if (key.substr(0,5) === 'view.') {
        host = 'view',
        field = key.slice(5)
      }

      if (key.substr(0,5) === 'data-') {
        field = key.slice(5)
        get = 'data'
        set = 'data'
      }
  
      else if (tagName === 'input') {
        if (!key || host === 'view') {
          
          let type = $el.attr('type') // ''|undefined|other -> 'value'          
          get = set = ((type !== 'checkbox' && type !== 'radio') ? 'value' : type)
    
        } else {
          get = set = (key === 'value' ? 'value' : 'attr')
        }
      }

      // textarea
      if (tagName === 'textarea' && !get && !set) {
        get = set = 'value'
      }

      // option：根据option文字更新，selected: 根据option的value更新
      if (tagName === 'select' && !get && !set) {
        get = set = ( key === 'option' ? 'option' : 'selected' )
      }

      // 兜底设置
      if (!get && !set) {
        get = set = ((key && key !== 'text') ? 'attr' : 'text')
      } 

      let info = { host, field, get, set }

      // set cache
      this.set('ui_update_info', info)
      return info
    },

    // UI getter, setter
    BuildInUIAccessor,

    updateUI(value) {
      let $el = this.$el()
      if ($el.length === 0) return
      let info = this.ui_update_info()
      let updater
      let setter

      // 使用 view 中定义的存取器
      // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
      // 也可以是一个对象，内部包含 get&set方法
      if (info.host === 'view') {
        updater = this.view[info.field]
        if (updater && updater.set) setter = updater.set
        else if (_.isFunction(updater)) setter = updater
      }

      // 内置的 UI 存取器
      if (!updater || !setter) {
        updater = this.BuildInUIAccessor[info.set]
        setter = updater.set
      }
      setter.call(this.view, $el, info.field, value, this.get('dataKey'))
      // console.log('UI did update', value, info)
    },

    // 更新模型
    updateModel(changedValue) {
      // 执行更新
      if (this.get('dataKey').substr(0, 5) === 'model.') {
        let methodName = this.get('dataKey').slice(5)
        _.isFunction(this.model[methodName]) && this.model[methodName](changedValue)

      } else {
          this.model.set(this.get('dataKey'), changedValue)
  
      }
      // console.log('model did update')
    },


    getUIValue() {
      let $el = this.$el()
      if ($el.length === 0) return

      // 目标元素不是表单交互元素的时候，跳过
      // 否则有内部有表单元素触发更新，也会触发 model 更新出现bug
      let tagName = this.tagName()
      if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') return

      let info = this.ui_update_info()
      let updater
      let getter

      // 使用 view 中定义的存取器
      // view 中，updater自身可以是 getter&setter（需要根据传入参数自行判断）
      // 也可以是一个对象，内部包含 get&set方法
      if (info.host === 'view') {
        updater = this.view[info.field]
        if (updater && updater.get) getter = updater.get
        else if (_.isFunction(updater)) getter = updater
      }

      // 内置的 UI 存取器
      if (!updater || !getter) {
        updater = this.BuildInUIAccessor[info.get]
        getter = updater.get
      }

      let value = getter.call(this.view, $el, info.field, this.get('dataKey'))
      return value
    },


    // model 更新时候，自动更新 UI
    _UI_updater(model, changedValue, options) {
      var $el = this.$el()
      if (!$el.length) return
  
      this.updateUI(changedValue)
    },
  

    // UI -> model
    _model_updater(e) {
      // 目标元素不是表单交互元素的时候，跳过
      if (this.$el().length === 0) return
      let tagName = this.tagName()
      if (tagName !== 'input' && tagName !== 'textarea' && tagName !== 'select') return
  
      var changedValue = this.getUIValue()
      this.updateModel(changedValue)
    },

    syncDataToUI() {
      let value = this.model.get(this.get('dataKey'))
      this.updateUI(value)
    },

    syncDataToModel() {
      let value = this.getUIValue()
      this.updateModel(value)
    },

    initialize() {
      this.model_updater = this._model_updater.bind(this)
      this.UI_updater = this._UI_updater.bind(this)
    },

    bind() {
      // 监听 model 变化，执行 UI_updater
      this.view.listenTo(this.model, 'change:' + this.get('dataKey'), this.UI_updater)

      // 绑定事件，没有指定子元素的 selector 时，作用在视图的根元素上
      if (this.selector() === '$el') {
          this.view.$el.on('change', this.model_updater)

      // 否则使用事件代理，作用在指定 selector 的子元素上
      } else {
          this.view.$el.on('change', this.selector(), this.model_updater)
      }
    },

    unbind() {
      // 监听 model 变化，执行 UI_updater
      this.view.stopListening(this.model, 'change:' + this.get('dataKey'), this.UI_updater)
  
      // 绑定事件，没有指定子元素的 selector 时，作用在视图的根元素上
      if (this.selector() === '$el') {
          this.view.$el.off('change', this.model_updater)

      // 否则使用事件代理，作用在指定 selector 的子元素上
      } else {
          this.view.$el.off('change', this.selector(), this.model_updater)
      }
    }
})


module.exports = BindingRecord