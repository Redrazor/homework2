/**
* Controller for Tokens
**/

const _data = require('../data');
const helpers = require('../helpers');
const config = require('../config');

let _tokens = {};

//token based on phone and password
_tokens.post = function(data, callback) {
    let email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
    let password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    if (!email || !password) {
        return callback(400, {
            'Error': 'Missing parameters'
        });
    }
    
    //Normalize email so it serves as unique key for users
    let normalizedEmail = helpers.normalizeEmail(email);

    if (!normalizedEmail) {
        return callback(400, {
            'Error': 'The provided email isn\'t valid'
        });
    }

    //lookup user

    _data.read('users', normalizedEmail, function(err, userData) {
        if (err) {
            return callback(400, {
                'Error': 'Could not find the user'
            });
        }

        if (userData) {
            //has the sent pass and compare to the pass stored
            let hashedPassword = helpers.hash(password);

            if (!hashedPassword) {
                return callback(500, {
                    'Error': 'Error handling the user info'
                });
            }

            if (hashedPassword !== userData.hashedPassword) {
                return callback(400, {
                    'Error': 'Password did not match user \'s password'
                });
            }
            
            let tokenId = helpers.createRandomString(config.randomStringLength);

            if (!tokenId) {
                return callback(500, {
                    'Error': 'Error generating token'
                });
            }

            let expires = Date.now() + 1000 * 60 * 60;
            let tokenObject = {
                'userId': normalizedEmail,
                'id': tokenId,
                'expires': expires
            };

            _data.create('tokens', tokenId, tokenObject, function(err) {
                if (err) {
                    return callback(500, {
                        'Error': 'Could not create token'
                    });
                }

                callback(200, tokenObject);
            });

        }
    });

};

_tokens.get = function(data, callback) {
    let id = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length == config.randomstringlength ? data.queryString.id.trim() : false;

    if (!id) {
        return callback(404, {
            'Error': 'Missing required field'
        });
    }

    _data.read('tokens', id, function(err, tokenData) {
        if (err) {
            return callback(404);
        }

        if (tokenData) {
            callback(200, tokenData);
        }

    });
};

_tokens.put = function(data, callback) {
    let id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == config.randomStringLength ? data.payload.id.trim() : false;
    let extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;

    if (!id || !extend) {
        return callback(404, {
            'Error': 'Missing required field'
        });
    }

    _data.read('tokens', id, function(err, tokenData) {
        if (err) {
            return callback(400, {
                'Error': 'token does not exists'
            });
        }

        if (tokenData.expires < Date.now()) {
            //is expired
            return callback(400, {
                'Error': 'The token has already expired'
            });
        }

        tokenData.expires = Date.now() + 1000 * 60 * 60;
        _data.update('tokens', id, tokenData, function(err) {
            if (err) {
                return callback(500, {
                    'Error': 'Could not update tokens'
                });
            }

            callback(200);
        });


    });


};

_tokens.delete = function(data, callback) {
    let id = typeof(data.queryString.id) == 'string' && data.queryString.id.trim().length == config.randomstringlength ? data.queryString.id.trim() : false;

    if (!id) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }

    _data.read('tokens', id, function(err, tokenData) {
        if (err) {
            return callback(404);
        }

        if (data) {
            _data.delete('tokens', id, function(err) {
                if (err) {
                    return callback(500, {
                        'Error': 'Could not delete the specified Token'
                    });
                }
                callback(200);
            });
        }

    });

};

//Verify if a given token id is currently valid for a given user
_tokens.verifyToken = function(id, userId, callback) {
    //Look up the token
    _data.read('tokens', id, function(err, tokenData) {
        if (err || !tokenData) {
            return callback(false);
        }
        
        if (tokenData.userId !== userId || tokenData.expires < Date.now()) {
            console.log('Session has expired. Please request a new Token');
            return callback(false);
        }

        callback(true);
    });
};

module.exports = _tokens;
