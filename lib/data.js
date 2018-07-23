const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');

let lib = {};

lib.baseDir = path.join(__dirname, '../.data/');

lib.create = function(dir, file, data, callback) {
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'wx', function(err, fileDescriptor) {
        if (err) {
            return callback('Could not create file');
        }

        let stringData = JSON.stringify(data);

        fs.writeFile(fileDescriptor, stringData, function(err) {
            if (err) {
                return callback('Error writing to file');
            }
            fs.close(fileDescriptor, function(err) {
                if (err) {
                    return callback('Error closing file');
                }
                callback(false);
            });
        });

    });
};

lib.read = function(dir, file, callback) {
    fs.readFile(lib.baseDir + dir + '/' + file + '.json', 'utf8', function(err, data) {
      if(!err && data){
        let parsedData = helpers.parseJsonToObject(data);
        return callback(false,parsedData);
      }
        callback(err, data);
    });
};

lib.update = function(dir, file, data, callback) {
    fs.open(lib.baseDir + dir + '/' + file + '.json', 'r+', function(err, fileDescriptor) {
        if (err) {
            return callback('Could not open the file for update');
        }

        let stringData = JSON.stringify(data);

        //Truncate contents of that file
        fs.truncate(fileDescriptor, function(err) {
            if (err) {
                return callback('Error truncating file');
            }

            fs.writeFile(fileDescriptor, stringData, function(err) {
                if (err) {
                   return callback('Error writing to file');
                }

                fs.close(fileDescriptor, function(err) {
                    if (err) {
                        return callback('Error closing file');
                    }

                    callback(false);
                });
            });
        });
    });
};

lib.delete = function(dir, file, callback) {
    //unlink file
    fs.unlink(lib.baseDir + dir + '/' + file + '.json', function(err) {
        if (err) {
            return callback('Error deleting file');
        }

        callback(false);
    });
};

lib.list = function(dir,callback){
  fs.readdir(lib.baseDir+dir+'/', function(err,data){
    if(err || !data || data.length <= 0){
      return callback(err,data);
    }
    
    let trimmedFileNames = [];
    
    data.forEach(function(fileName){
      trimmedFileNames.push(fileName.replace('.json',''));
    });
    
    callback(false,trimmedFileNames);
  });
};

module.exports = lib;