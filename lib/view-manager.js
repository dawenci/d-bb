var Dbb = require('./dbb');

Dbb.ViewManager = Dbb.extend({
    initialize: function() {
        console.log('layout init....');
    },

    addMountPoint: function() {
        console.log('add mount point')
    }
});

module.exports = Dbb;
