//Helpers
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');

let helpers = {};

helpers.hash = function(pass) {
    if (typeof(pass) !== 'string' && pass.length < 1) {
        return false;
    }

    let hash = crypto.createHmac('sha256', config.hashingSecret).update(pass).digest('hex');
    return hash;
};

//Parse a json string into an object
helpers.parseJsonToObject = function(str) {
    try {
        let obj = JSON.parse(str);
        return obj;
    } catch (e) {
        return {};
    }
};

helpers.createRandomString = function(len) {
    len = typeof(len) == 'number' && len > 0 ? len : false;

    if (!len) {
        return false;
    }

    let possibleCharacter = 'abcdefghijklmnopqrstuvwxyz0123456789';

    let str = '';

    for (i = 1; i <= len; i++) {
        //get random character
        let randomCharacter = possibleCharacter.charAt(Math.floor(Math.random() * possibleCharacter.length));

        //append this character to the final string
        str += randomCharacter;
    }

    return str;
};

helpers.normalizeEmail = function(email) {
    //Verify email validity - This is a trimmed down version for RFC2822 - It will not validate every possible real combination
    let emailReg = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

    if (!emailReg.test(email)) {
        return false;
    }

    return email.replace('@', '');
}

helpers.processCart = function(processedCartItems, amount, userEmail, callback) {
    let cart = typeof(processedCartItems) == 'object' && processedCartItems instanceof Array && processedCartItems.length > 0 ? processedCartItems : false;
    amount = typeof(amount) == 'number' && amount > 0 ? amount : false;
    
    if (!cart || !amount) {
    return callback('There was an error processing your payment');
    }

    //In a Production env we would use Stripe to store the client's payment details and do a previous request
    //To get his payment info and use it to charge
    let usersCard = config.stripe.testCreditCard;
    
    //Ideally the token would be retrieved by an earlier request pulling a valid token from stripe
    //Unfortunetelly this requires us to pass a neste object in the querystring (card)
    //Node.js does not support that. Support for that in querystring has been removed and we are now expected
    //to use qs module if we desire that functionality
     
    //Since amount has to be the smallest possible unit for stripe to process (like cents) we need to multiply this for 100
     let payload = {
        'amount': amount * 100,
        'source': 'tok_visa',
        'currency': config.stripe.currency
    };

     let stringPayload = querystring.stringify(payload);

    let requestDetails = {
        'protocol': 'https:',
        'hostname': 'api.stripe.com',
        'method': 'POST',
        'path': '/v1/charges',
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(stringPayload),
            'Authorization': 'Bearer '+ config.stripe.apikey
        }
    };

    // Instantiate the request object
    let req = https.request(requestDetails, function(res) {
        console.log('Stripe Charge status code: ' + res.statusCode);
        // Grab the status of the sent request
        let status = res.statusCode;
        // Callback successfully if the request went through
        if (status == 200 || status == 201) {
            console.log('Card charged. Purchase successful');
            helpers.sendReceipt(userEmail,cart);
        }
        
        callback(status);

    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', function(e) {
        return callback(e);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
   
};

//TODO - CHange this to mailgun mail sending
helpers.sendReceipt = function(userEmail, cart) {
    // Validate parameters
    userEmail = typeof(userEmail) == 'string' && userEmail.trim().length > 0 ? userEmail.trim() : false;
    cart = typeof(cart) == 'object' && cart instanceof Array && cart.length > 0 ? cart : false;

    console.log(cart);
    if (userEmail && cart) {

        // Configure the request payload
        let payload = {
            'from': config.mailgun.mailFrom,
            'to': userEmail,
            'subject': 'This is your receipt',
            'html': `
                <h2>Thank you for your purchase.</h2>
                <p>You have ordered the following items:</p>
            <table>
                <thead>
                    <tr>
                        <td>Name</td>
                        <td>Quantity</td>
                        <td>Price</td>
                    </tr>
                </thead>
                <tbody>`
        };
        
        //Add the structure for the receipt
        cart.forEach(function(item){
            payload.html += `
                <tr>
                    <td>
                        ${item.name}
                    </td>
                    <td>
                        ${item.quantity}
                    </td>
                    <td>
                        ${item.total}
                    </td>
                </tr>
            `;
        });
        
        payload.html += `</tbody>
                            </table>`;
        
        let stringPayload = querystring.stringify(payload);
        
        // Configure the request details
        let requestDetails = {
            'protocol': 'https:',
            'hostname': config.mailgun.host,
            'method': 'POST',
            'path': '/v3/sandbox3c40a280e7cc4577866490945c858d80.mailgun.org/messages',
            'auth': 'api:' + config.mailgun.apiKey,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request object
        let req = https.request(requestDetails, function(res) {
            // Grab the status of the sent request
            console.log('Email status code: ' + res.statusCode);
            let status = res.statusCode;
            // Callback successfully if the request went through
            if (status == 200 || status == 201) {
               console.log('Success: Receipt Sent!');
            } else {
                console.log('Status code returned was ' + status);
            }
            
            return true;
        });

        // Bind to the error event so it doesn't get thrown
        req.on('error', function(e) {
            console.log(e);
        });

        // Add the payload
        req.write(stringPayload);

        // End the request
        req.end();

    } else {
        console.log('Essential Receipt generation parameters are missing');
    }
};


module.exports = helpers;