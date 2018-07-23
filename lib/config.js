
let environments = {};

environments.development = {
  'randomStringLength': 20,
  'httpPort': 1337,
  'httpsPort':1338,
  'envName': 'development',
  'hashingSecret': 'thisisthedevsecret',
   'mailgun': {
       'domain': 'XXX.mailgun.org',
       'host': 'api.mailgun.net',
       'apiKey': 'XXX',
       'mailFrom': 'admin@node.pizza'
   },
   'stripe': {
       'apikey': 'XXX',
       'currency': 'usd'
   }
 
};

environments.production = {
  'randomStringLength': 20,
  'httpPort': 3000,
  'httpsPort':3001,
  'envName': 'production',
  'hashingSecret': 'thisistheprodsecret',
  'mailgun': {
       'domain': 'XXX.mailgun.org',
       'host': 'api.mailgun.net',
       'apiKey': 'XXX',
       'mailFrom': 'admin@node.pizza'
   },
   'stripe': {
       'apikey': 'XXX',
       'currency': 'usd'
   }
  
};

let currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';
    
let environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.development;
    
module.exports = environmentToExport;