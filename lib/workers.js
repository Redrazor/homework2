/**These are the worker related tasks
 *
 *
 **/

const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('https');
const helpers = require('./helpers');
const url = require('url');
const config = require('../config');
const _logs = require('./logs');

const util = require('util');
const debug = util.debuglog('workers');

let workers = {};


workers.gatherAllChecks = function() {
    //get all checks in the system
    _data.list('checks', function(err, checks) {
        if (err || !checks || checks.length <= 0) {
            debug('Error: Could not find any checks to process');
            return false;
        }

        checks.forEach(function(check) {
            _data.read('checks', check, function(err, originalCheckData) {
                if (err || !originalCheckData) {
                    debug('Error reading one of the checks');
                    return false;
                }

                //pass the data to validator
                workers.validateCheckData(originalCheckData);
            });
        });
    });
};

//Validator
workers.validateCheckData = function(checkData) {
    checkData = typeof(checkData) == 'object' && checkData !== null ? checkData : {};
    checkData.id = typeof(checkData.id) == 'string' && checkData.id.trim().length == config.randomstringlength ? checkData.id.trim() : false;
    checkData.userPhone = typeof(checkData.userPhone) == 'string' && checkData.userPhone.trim().length == config.phonelength ? checkData.userPhone.trim() : false;

    checkData.protocol = typeof(checkData.protocol) == 'string' && ['https', 'http'].indexOf(checkData.protocol) > -1 ? checkData.protocol : false;
    checkData.url = typeof(checkData.url) == 'string' && checkData.url.trim().length > 0 ? checkData.url.trim() : false;
    checkData.method = typeof(checkData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(checkData.method) > -1 ? checkData.method : false;
    checkData.successCodes = typeof(checkData.successCodes) == 'object' && checkData.successCodes instanceof Array && checkData.successCodes.length > 0 ? checkData.successCodes : false;
    checkData.timeoutSeconds = typeof(checkData.timeoutSeconds) == 'number' && checkData.timeoutSeconds % 1 === 0 && checkData.timeoutSeconds >= 1 && checkData.timeoutSeconds <= 5 ? checkData.timeoutSeconds : false;

    //set keys that may not be set
    checkData.state = typeof(checkData.state) == 'string' && ['up', 'down'].indexOf(checkData.state) > -1 ? checkData.state : 'down';
    checkData.lastChecked = typeof(checkData.lastChecked) == 'number' && checkData.lastChecked > 0 ? checkData.lastChecked : false;

    //If all the checks pass, keep going
    if (!checkData.id || !checkData.userPhone || !checkData.protocol || !checkData.url || !checkData.method || !checkData.successCodes || !checkData.timeoutSeconds) {
        debug('Error: One of the checks is not properly formatted');
        return false;
    }

    workers.performCheck(checkData);

};
debug
//Perform the check and send the original check data
workers.performCheck = function(checkData) {
    //Prepare the initial check outcome
    let checkOutcome = {
        'error': false,
        'responseCode': false
    };

    //mark that the outcome has not been sent yet
    let outcomeSent = false;

    //Parse the hostname and the path out of the original check data
    let parsedUrl = url.parse(checkData.protocol + '://' + checkData.url, true);
    let hostname = parsedUrl.hostname;
    let path = parsedUrl.path; //using path and not pathname because we want the complete query string

    //Construct the request
    let requestDetails = {
        'protocol': checkData.protocol + ':',
        'hostname': hostname,
        'method': checkData.method.toUpperCase(),
        'path': path,
        'timeout': checkData.timeoutSeconds * 1000
    };

    let _moduleToUse = checkData.protocol == 'http' ? http : https;

    // Instantiate the request object
    let req = _moduleToUse.request(requestDetails, function(res) {
        // Grab the status of the sent request
        let status = res.statusCode;
        // Callback successfully if the request went through
        checkOutcome.responseCode = status;

        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    req.on('error', function(e) {
        //Update the checkOutcome
        checkOutcome.error = {
            'error': true,
            'value': e
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    req.on('timeout', function(e) {
        //Update the checkOutcome
        checkOutcome.error = {
            'error': true,
            'value': 'timeout'
        };
        if (!outcomeSent) {
            workers.processCheckOutcome(checkData, checkOutcome);
            outcomeSent = true;
        }
    });

    //Send request
    req.end();

};


workers.processCheckOutcome = function(checkData, checkOutcome) {
    //Decide if the check is considered up or down
    let state = !checkOutcome.error && checkOutcome.responseCode && checkData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    //Decide if an alert is warrented
    let alertWarrented = checkData.lastChecked && checkData.state !== state ? true : false;


    //Log the outcome of the check
    let timeOfCheck = Date.now();
    workers.log(checkData, checkOutcome, state, alertWarrented, timeOfCheck);

    //Update the check 
    let newCheckData = checkData;
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    _data.update('checks', newCheckData.id, newCheckData, function(err) {
        if (err) {
            debug('Error: Trying to save updates to one of the checks');
        }

        if (alertWarrented) {
            workers.alertUserToStatusChange(newCheckData);
        } else {
            debug('No need to send alert as the state hasn\'t changed');
        }
    });
};

workers.alertUserToStatusChange = function(newCheckData) {
    let msg = `Alert: Your check for ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} is currently ${newCheckData.state}`;
    helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err) {
        if (err) {
            debug('Error: Could not send sms alert to user that had a changed state in their check');
            return false;
        }

        debug(`Success user was alerted to a status change with message - ${msg}`);
    });
};

workers.log = function(checkData, checkOutcome, state, alertWarrented, timeOfCheck) {
    //Form the log data
    let logData = {
        'check': checkData,
        'outcome': checkOutcome,
        'state': state,
        'alert': alertWarrented,
        'time': timeOfCheck
    };

    let logString = JSON.stringify(logData);

    //Determine log file name
    let logFileName = checkData.id;

    //Append the log string to file
    _logs.append(logFileName, logString, function(err) {
        if (err) {
            debug('Logging to file failed');
            return false;
        }
    });
};

//timer to execute worker process once per minute
workers.loop = function() {
    setInterval(function() {
        workers.gatherAllChecks();
    }, 1000 * 60);
};


workers.rotateLogs = function() {
    //Start by listing all the non compressed log files
    _logs.list(false, function(err, logs) {
        if (err || !logs || logs.length <= 0) {
            debug('Could not find logs to rotate');
        }

        logs.forEach(function(logName) {
            //Compress data
            let logId = logName.replace('.log', '');
            let newFileId = logId + '-' + Date.now();
            _logs.compress(logId, newFileId, function(err) {
                if (err) {
                    debug('Error compressing one of the log files', err);
                }

                //Truncate the log
                _logs.truncate(logId, function(err) {
                    if (err) {
                        debug('Error truncating log file');
                    }
                });
            });
        });
    });
};


workers.logRotationLoop = function() {
    setInterval(function() {
        workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
};

//Init Workers
workers.init = function() {

    console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');

    //Execute all the checks
    workers.gatherAllChecks();
    //Call loop for checks to continue executing on their own
    workers.loop();

    //Compress all the logs immediately
    workers.rotateLogs();

    //Call the compression loop so logs will be compressed
    workers.logRotationLoop();
};

module.exports = workers;