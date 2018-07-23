/**
 * This is the Endpoint handling of Items for the Menu - Ths should not be accessible for end users. An admin should add products available
 **/
const _data = require('../data');
const helpers = require('../helpers');
const config = require('../config');

const _tokens = require('./tokens');

let _items = {};

//Add new items for the menu
//Auth of an admin needed
_items.post = function(data, callback) {
    //Validate inputs
    let name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
    let price = typeof(data.payload.price) == 'number' && data.payload.price > 0 ? data.payload.price : false;

    if (!name || !price) {
        return callback(400, {
            'Error': 'Missing Required Inputs'
        });
    }

    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    _data.read('tokens', token, function(err, tokenData) {
        if (!data) {
            return callback(403, {
                'Error': 'Not allowed'
            });
        }

        let userId = tokenData.userId;

        //look up userData
        _data.read('users', userId, function(err, userData) {
            //Make sure the User is Admin for all item realted operations
            if (err || !userData || !userData.isAdmin) {
                return callback(403, {
                    'Error': 'Not allowed'
                });
            }

            //Create a random id for the item
            let itemId = helpers.createRandomString(config.randomStringLength);

            //Checkobj with user phone
            let itemObj = {
                'id': itemId,
                'name': name,
                'price': price
            };

            //Save items
            _data.create('items', itemId, itemObj, function(err) {
                if (err) {
                    return callback(500, {
                        'Error': 'Could not create the new item'
                    });
                }

                callback(200, itemObj);

            });
        });
    });
};

//Retrieve a single Item by Query string
//Note: This method can be accessed by any one with a valid token AND logged in
//Optional: id is optional, if none provided, retrieve all items available (with _items.getAll)
_items.get = function(data, callback) {
    if (data.queryString.id == undefined) {
        console.log('No id was provided, fetch all');
        return _items.getAll(data, callback);
    }

    let id = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length == config.randomStringLength ? data.queryString.id.trim() : false;

    //Get the token and userId from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }

        if (!id) {
            return callback(404, {
                'Error': 'Invalid Item provided'
            });
        }

        //lookup check
        _data.read('items', id, function(err, itemData) {
            if (err || !itemData) {
                return callback(404);
            }

            callback(200, itemData);
        });
    });

};

//Retrieve all items of a menu
//No need for User to be admin and no id needs to be provided
_items.getAll = function(data, callback) {
    //Get the token and userId from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }
        let menu = [];

        _data.list('items', function(err, itemList) {
            if (err) {
                if (err || !itemList) {
                    return callback(404);
                }
            }
            itemList.forEach(function(item) {
                _data.read('items', item, function(err, itemData) {
                    if (err || !itemData) {
                        return callback(500, {
                            'Error': 'Something has gone wrong reading the file'
                        });
                    }

                    let menuItem = {
                        'id': item,
                        'name': itemData.name,
                        'price': itemData.price
                    };
                    menu.push(menuItem);

                    //Return only once the list is complete
                    //This works as an exit flag to circunvent the fact that we are using async callbacks
                    if (menu.length == itemList.length) {
                        if (menu.length <= 0) {
                            return callback(404, {
                                'Error': 'There are currently no menu items available'
                            });
                        }
                        return callback(200, menu);
                    }
                });
            });
        });

    });
};

//Change the name or price of a Menu Item
//Admin auth needed
_items.put = function(data, callback) {
    let id = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length == config.randomStringLength ? data.queryString.id.trim() : false;

    let name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
    let price = typeof(data.payload.price) == 'number' && data.payload.price > 0 ? data.payload.price : false;

    if (!id) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }

    if (name || price) {

        _data.read('items', id, function(err, itemData) {
            if (err || !itemData) {
                return callback(404);
            }

            //Get the token from the headers
            let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

            _tokens.verifyToken(token, userId, function(tokenIsValid) {
                if (!tokenIsValid) {
                    return callback(403, {
                        'Error': 'You are not allowed to do this operation'
                    });
                }

                //look up userData
                _data.read('users', userId, function(err, userData) {
                    //Make sure the User is Admin for all item realted operations
                    if (err || !userData || !userData.isAdmin) {
                        return callback(403, {
                            'Error': 'Not allowed'
                        });
                    }

                    if (name) {
                        itemData.name = name;
                    }

                    if (price) {
                        itemData.price = price;
                    }

                    //Store new updates
                    _data.update('items', id, itemData, function(err) {
                        if (err) {
                            return callback(500, {
                                'Error': 'Could not update the check'
                            });
                        }

                        callback(200);
                    });
                });

            });

        });
    } else {
        return callback(400, {
            'Error': 'Missing field to update'
        });
    }
};

//Eliminate an item from the menu
//Admin auth is required
_items.delete = function(data, callback) {
    let id = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length == config.randomStringLength ? data.queryString.id.trim() : false;

    if (!id) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }

    _data.read('items', id, function(err, itemData) {
        if (err || !itemData) {
            return callback(404);
        }

        //Get the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;
        
        _tokens.verifyToken(token, userId, function(tokenIsValid) {
            if (!tokenIsValid) {
                return callback(403, {
                    'Error': 'You are not allowed to do this operation'
                });
            }
            
            _data.read('users', userId, function(err, userData) {
                    //Make sure the User is Admin for all item realted operations
                    if (err || !userData || !userData.isAdmin) {
                        return callback(403, {
                            'Error': 'Not allowed'
                        });
                    }

                _data.delete('items', id, function(err) {
                    if (err) {
                        return callback(500, {
                            'Error': 'Could not delete the specified Check'
                        });
                    }

                    callback(200);

                });
            });
        });
    });
};

module.exports = _items;