/**
* Server Initializer
**/

const server = require('./lib/server');

//Declare app
let app = {};

//Init 
app.init = function(){
  //Start the server
  server.init();
};

//Start Init
app.init();

module.exports = app;