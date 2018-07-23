/**
 * Controller for Users
 **/

const _data = require('../data');
const helpers = require('../helpers');
const config = require('../config');
const _tokens = require('./tokens');

let _users = {};

_users.post = function(data, callback) {
    let firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    let lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    let email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
    let password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    let streetAddress = typeof(data.payload.streetAddress) == 'string' && data.payload.streetAddress.trim().length > 0 ? data.payload.streetAddress.trim() : false;
    let isAdmin = false; //The API only allows for public Users - The items on the Menu are governed by different calls that require a User to have Admin Role
    
    //Normalize email so it serves as unique key for users
    let normalizedEmail = helpers.normalizeEmail(email);

    if (!normalizedEmail) {
        return callback(400, {
            'Error': 'The provided email isn\'t valid'
        });
    }


    if (firstName && lastName && email && password && streetAddress) {
        _data.read('users', normalizedEmail, function(err, data) {
            if (err) {
                //Hash the password
                let hashedPassword = helpers.hash(password);

                if (!hashedPassword) {
                    return callback(500, {
                        'Error': 'Error handling the user info'
                    });
                }

                let userObject = {
                    'firstName': firstName,
                    'lastName': lastName,
                    'email': email,
                    'hashedPassword': hashedPassword,
                    'streetAddress': streetAddress,
                    'isAdmin': isAdmin
                };

                //Store the userObject
                _data.create('users', normalizedEmail, userObject, function(err) {
                    if (err) {
                        console.log(err);
                        return callback(500, {
                            'Error': 'Could not create the new user'
                        });
                    }

                    callback(200);
                });

            } else {
                //User already exists
                callback(400, {
                    'Error': 'A user with that Email address already exists'
                });
            }
        });
    } else {
        callback(400, {
            'Error': 'Missing required fields'
        });
    }
};


_users.get = function(data, callback) {
    let email = typeof(data.queryString.email) == 'string' && data.queryString.email.trim().length > 0 ? data.queryString.email.trim() : false;

    if (!phone) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }

    let normalizedEmail = helpers.normalizeEmail(email);
    if (!normalizedEmail) {
        return callback(400, {
            'Error': 'The provided email isn\'t valid'
        });
    }
    
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    _tokens.verifyToken(token, normalizedEmail, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }

        _data.read('users', normalizedEmail, function(err, data) {
            if (err) {
                return callback(404);
            }

            if (data) {
                //remove password
                delete data.hashedPassword;
                callback(200, data);
            }

        });
    });

};

_users.put = function(data, callback) {
    let firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    let lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    let email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
    let password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    let streetAddress = typeof(data.payload.streetAddress) == 'string' && data.payload.streetAddress.trim().length > 0 ? data.payload.streetAddress.trim() : false;
    
    if (!email) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }

    if (firstName || lastName || password || streetAddress) {

        let normalizedEmail = helpers.normalizeEmail(email);
        if (!normalizedEmail) {
            return callback(400, {
                'Error': 'The provided email isn\'t valid'
            });
        }
        
        //Get the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        _tokens.verifyToken(token, normalizedEmail, function(tokenIsValid) {
            if (!tokenIsValid) {
                return callback(403, {
                    'Error': 'You are not allowed to do this operation'
                });
            }
            //look up the user
            _data.read('users', normalizedEmail, function(err, userData) {
                if (err) {
                    return callback(404);
                }

                if (userData) {
                    //Update the user
                    if (firstName) {
                        userData.firstName = firstName;
                    }

                    if (lastName) {
                        userData.lastName = lastName;
                    }

                    if (password) {
                        userData.hashedPassword = helpers.hash(password);
                    }

                    //Store new updates
                    _data.update('users', normalizedEmail, userData, function(err) {
                        if (err) {
                            return callback(500, {
                                'Error': 'Could not update the user'
                            });
                        }

                        callback(200);
                    });
                }

            });
        });
    } else {
        return callback(400, {
            'Error': 'Missing field to update'
        });
    }
};

_users.delete = function(data, callback) {
    let email = typeof(data.queryString.email) == 'string' && data.queryString.email.trim().length > 0 ? data.queryString.email.trim() : false;

    if (!email) {
        return callback(400, {
            'Error': 'Missing required field'
        });
    }
    //Get the token from the headers
    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    
    let normalizedEmail = helpers.normalizeEmail(email);
    if (!normalizedEmail) {
        return callback(400, {
            'Error': 'The provided email isn\'t valid'
        });
    }

    _tokens.verifyToken(token, normalizedEmail, function(tokenIsValid) {
        if (!tokenIsValid) {
            return callback(403, {
                'Error': 'You are not allowed to do this operation'
            });
        }
        _data.read('users', normalizedEmail, function(err, userData) {
            if (err || !userData) {
                return callback(404);
            }

            _data.delete('users', normalizedEmail, function(err) {
                if (err) {
                    return callback(500, {
                        'Error': 'Could not delete the specified User'
                    });
                }

                //Delete all associated checks data
                let userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                let checksToDelete = userChecks.length;


                if (checksToDelete < 0) {
                    return callback(200);
                }

                let checksDeleted = 0;
                let deletionErrors = false;

                //look through
                userChecks.forEach(function(checkId) {
                    _data.delete('checks', checkId, function(err) {
                        if (err) {
                            deletionErrors = true;
                        }
                        checksDeleted++;
                        if (checksDeleted == checksToDelete) {
                            if (deletionErrors) {
                                return callback(500, {
                                    'Error': 'Errors encountered while atempting to delete checks'
                                });
                            }

                            callback(200);
                        }
                    });
                });
            });

        });
    });
};

module.exports = _users;