'use strict'

const BindingRecord = require('./binding-record')

function parseBindings(view, model, bindings) {
    var records = []
    _.each(bindings, function (dataKey, targetInfo) {
        dataKey = dataKey.split(',')
        targetInfo = targetInfo.split(',')
        _.each(dataKey, dataKey => {
            _.each(targetInfo, targetInfo => {
                if (!targetInfo || !dataKey) return
                records.push(new BindingRecord(view, model, {
                    targetInfo: targetInfo,
                    dataKey: dataKey
                }))
            })
        })
    })
    return records
}


// { '.selector': 'model_key' }
// OR
// { '.selector|type': 'model_key' }
// type: 更新的位置，属性名、text(innerHTML)、checked 等等
function bind(view, model, bindings) {
    // 没有 unbind 的话，每次 bind，都使用追加的方式
    // 当次 bind 作用在新增的 bindings 上
    if (!_.isArray(view.__bindingRecords__)) view.__bindingRecords__ = []
    var newRecords = parseBindings(view, model, bindings)
    view.__bindingRecords__ = view.__bindingRecords__.concat(newRecords)
    _.each(newRecords, function (record) {
        record.bind()
    })
}


function unbind(view, model, records) {
    // 可以指定某些绑定 records，不指定，则处理整个 view 的所有绑定
    records = records || view.__bindingRecords__ || []
    _.each(records, function (record) {
        record.unbind()
    })

    var leftRecords = _.reject(view.__bindingRecords__, function (record) {
        return _.includes(records, record)
    })
    if (leftRecords.length) view.__bindingRecords__ = leftRecords
    else delete view.__bindingRecords__
}


function syncData(view, isToModel) {
    let records = view.__bindingRecords__ || []
    _.each(records, isToModel ? (record) => record.syncDataToModel() : (record) => record.syncDataToUI())
}


module.exports = {
    bind,
    unbind,
    syncData
}