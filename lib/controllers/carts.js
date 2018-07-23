/**
 * Endpoint for Cart Controller
 **/
const _data = require('../data');
const helpers = require('../helpers');
const config = require('../config');

const _tokens = require('./tokens');

let _carts = {};

//Insert item into Cart
//User must be logged - have a valid token in header
//If cart doesn't exist it must be created
//If item already exists must add to its quantity
_carts.post = function(data, callback) {
    //Validate access tokens first
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }

        //validate params
        let itemId = typeof(data.payload.itemId) == 'string' && data.payload.itemId.trim().length > 0 ? data.payload.itemId.trim() : false;
        let cartId = typeof(data.payload.cartId) == 'string' && data.payload.cartId.trim().length > 0 ? data.payload.cartId.trim() : false;

        if (!itemId) {
            return callback(400, {
                'Error': 'Missing Required Inputs'
            });
        }

        //Flag if the cart is new
        let cartNew = false;

        //Verify that an open cart already exists for this userId
        //It has to be opened as well
        _data.read('carts', cartId, function(err, cartData) {
            if (err || !cartData || cartData.isFinished) {
                console.log('There is no open cart for this user at the moment');
                cartNew = true;
            }


            //If it does not - create it then proceed to add items
            if (cartNew) {
                //Create a random id for the cart
                let cartId = helpers.createRandomString(config.randomStringLength);

                let cartObj = {
                    'id': cartId,
                    'userId': userId,
                    'items': [],
                    'timestamp': Date.now(),
                    'isFinished': false
                };

                //Save carts
                _data.create('carts', cartId, cartObj, function(err) {
                    if (err) {
                        return callback(500, {
                            'Error': 'Could not create the new item'
                        });
                    }

                    return _carts.addItem(cartObj, itemId, callback);

                });
            } else {
                //If it does - proceed to add items
                if (cartData.userId != userId) {
                    return callback(403, {
                        'Error': 'You are not allowed to do this operation'
                    });
                }
                let cartId = cartData.id;
                return _carts.addItem(cartData, itemId, callback);
            }
        });
    });
};

_carts.addItem = function(cartData, itemId, callback) {
    console.log('Adding Item with id ', itemId);
    console.log(`Cart ${cartData.id} is updating`);

    //If this item already exists add to quantity
    if (cartData.items.length == 0) {
        cartData.items.push({
            'id': itemId,
            'quantity': 1
        });

        cartData.timestamp = Date.now();

        _data.update('carts', cartData.id, cartData, function(err) {
            if (err) {
                return callback(500, {
                    'Error': 'An error has ocorred updating the cart'
                });
            }

            return callback(200);
        });
    } else {
        let itemToUpdate = cartData.items.filter(cartItem => (cartItem.id === itemId));
        //If there is already this item update its quantity
        if (itemToUpdate.length > 0) {
            itemToUpdate[0].quantity += 1;
        } else {
            cartData.items.push({
                'id': itemId,
                'quantity': 1
            });
            //update cart ts
            cartData.timestamp = Date.now();
        }

        _data.update('carts', cartData.id, cartData, function(err) {
            if (err) {
                return callback(500, {
                    'Error': 'An error has ocorred updating the cart'
                });
            }

            return callback(200);
        });
    }

}


//Get current Cart
//Get current cart based on user requesting
//User must be logged - have a valid token in header
//Cart must exist/ not closed OR return empty with info
_carts.get = function(data, callback) {
    //Validate access tokens first
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }

        //validate params
        let cartId = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length > 0 ? data.queryString.id.trim() : false;

        //Retrieve current cart or empty if none
        _data.read('carts', cartId, function(err, cartData) {
            if (err || !cartData || cartData.isFinished) {
                return callback(404);
            }

            //Only visualize your own Cart 
            //And it must not be finished
            if (cartData.userId != userId) {
                return callback(403, {
                    'Error': 'You are not allowed to do this operation'
                });
            }

            callback(200, cartData);
        });
    });
};


//Finalize Cart - Change status of finished and fir up the post buy events - Payments & Email with Receipt
//User must be logged - have a valid token in header
_carts.put = function(data, callback) {
    //Validate access tokens first
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }

        //validate params
        let cartId = typeof(data.payload.cartId) == 'string' && data.payload.cartId.trim().length > 0 ? data.payload.cartId.trim() : false;
        let isFinished = typeof(data.payload.isFinished) == 'boolean' && data.payload.isFinished == true ? true : false;

        //See what needs to be changed.
        //At this point only Finalizing the Buy is allowed to be changed as post and delete already control inserting and removing items
        //Possible future implementation would allow direct manipulation of item quantities
        _data.read('carts', cartId, function(err, cartData) {
            if (err || !cartData || cartData.isFinished) {
                return callback(404);
            }

            cartData.isFinished = isFinished;
            cartData.timestamp = Date.now();
            let userId = cartData.userId;

            //get a User object with the details
            _data.read('users', userId, function(err, userData) {
                if (err || !userData) {
                    return callback(500, {
                        'Error': 'Error requesting user data'
                    });
                };

                let userEmail = userData.email;



                //As the cart is Finished it is expected to fire up the Buy Process
                //First fire up the stripe charge
                //From stripe charge the email receipt will be carried on
                if (cartData.items.length <= 0) {
                    return callback(403, {
                        'Error': 'You are not allowed to checkout an empty Cart'
                    });
                };

                let amount = 0;
                let processedCartItems = [];

                cartData.items.forEach(function(item) {

                    //Again, a flag is needed to control flow - 
                    //TODO - Refactor this with async/await
                    _data.read('items', item.id, function(err, singularItem) {
                        if (err) {
                            return callback(500, {
                                'Error': 'Item in cart no longer available'
                            });
                        };

                        let totalPerItem = singularItem.price * item.quantity;
                        item.name = singularItem.name;
                        item.total = totalPerItem;
                        amount += totalPerItem;
                        processedCartItems.push(item);

                        //Carry on once all items have been processed
                        if (processedCartItems.length == cartData.items.length) {
                            if (amount <= 0) {
                                return callback(403, {
                                    'Error': 'You are not allowed to checkout an empty Cart'
                                });
                            }

                            helpers.processCart(processedCartItems, amount, userEmail, function(status) {
                                console.log('out of processing with status '+status);
                                if (status == 200 || status == 201) {
                                    //We should only update the cart if payment was successful
                                    _data.update('carts', cartId, cartData, function(err) {
                                        if (err) {
                                            return callback(500, {
                                                'Error': 'An error has ocorred updating the cart'
                                            });
                                        }
                                        console.log('Cart Checkout successfully concluded');
                                        
                                        callback(status);
                                    });
                                } else {
                                    callback(status,{'Error':'There was an error during your checkout'});
                                }
                                
                            });
                        }
                    });
                });
            });
        });
    });

};

//Remove item from Cart
//User must be logged - have a valid token in header
//Prevent a finished cart from being deleted
//If there is nothing to delete the request should send back a 200 all the same.
_carts.delete = function(data, callback) {
    //Validate access tokens first
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    let userId = typeof(data.headers.user) == 'string' ? data.headers.user : false;

    _tokens.verifyToken(token, userId, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }


        //validate params
        let itemId = typeof(data.queryString.itemId) == 'string' && data.queryString.itemId.trim().length > 0 ? data.queryString.itemId.trim() : false;
        let cartId = typeof(data.queryString.cartId) == 'string' && data.queryString.cartId.trim().length > 0 ? data.queryString.cartId.trim() : false;

        if (!itemId) {
            return callback(400, {
                'Error': 'Missing Required Inputs'
            });
        }

        //Find cart
        _data.read('carts', cartId, function(err, cartData) {
            if (err || !cartData || cartData.isFinished) {
                console.log('There is no open cart for this user at the moment');
            }

            let itemToUpdate = cartData.items.filter(cartItem => (cartItem.id === itemId));

            //If there is already this item update its quantity
            if (itemToUpdate.length != 0) {
                //If its the last of its type just remove it
                if (itemToUpdate[0].quantity == 1) {
                    let itemPos = cartData.items.indexOf(itemToUpdate[0]);
                    cartData.items.splice(cartData.items[itemPos], 1);
                } else {
                    //else remove 1 from quantity
                    itemToUpdate[0].quantity -= 1;
                }
            }

            cartData.timestamp = Date.now();

            //Delete it by Updating
            _data.update('carts', cartData.id, cartData, function(err) {
                if (err) {
                    return callback(500, {
                        'Error': 'An error has ocorred updating the cart'
                    });
                }

                return callback(200);
            });
        });

    });
};

module.exports = _carts;