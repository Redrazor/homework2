//Request Handlers
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

//Controllers
const _users = require('./controllers/users');
const _tokens = require('./controllers/tokens');
const _items = require('./controllers/items');
const _carts = require('./controllers/carts');

let handlers = {};

handlers.users = function(data, callback) {
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        _users[data.method](data, callback);
    } else {
        callback(405);
    }
};

handlers.tokens = function(data, callback) {
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        _tokens[data.method](data, callback);
    } else {
        callback(405);
    }
};

handlers.items = function(data, callback) {
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        _items[data.method](data, callback);
    } else {
        callback(405);
    }
};

handlers.carts = function(data, callback) {
    let acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        _carts[data.method](data, callback);
    } else {
        callback(405);
    }
};

//404 Handler
handlers.notFound = function(data, callback) {
    callback(404);
};

module.exports = handlers;