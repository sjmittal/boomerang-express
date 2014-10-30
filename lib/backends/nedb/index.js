var EventEmitter = require('events').EventEmitter,
    ERROR_CODES = require("../errorcodes.js"),
    path = require("path"),
    fs = require("fs"),
    util = require('util'),
    NeDB = require('nedb');

var Datastore = module.exports = function Datastore (options,logger) {

    this.config = options || {};

    EventEmitter.call(this);

    if (typeof (logger) === "object") { 
	this.log = logger;
    } else {
	this.log = console;
    }

    var that = this;

    if ( this.config.directory ) {
	var fullPath =  path.resolve(this.config.directory);

	fs.exists(fullPath,function(exists) {
	    if (exists) {
		fs.readdir( path.resolve(fullPath) ,function(err,files) {
		    if (err !== null) {
			var error = new Error("ERROR: Reading the directory failed (do we have permission to read it?)");
			error.info = err;
			
			that.emit('dbOpenError',error)
			return;
		    } else if (files.length == 0) {
			var error = new Error("ERROR: Backend was given an empty directory.");
			that.emit("dbOpenError",error);
			return;
		    }
		    
		    that._database =  {};

		    files.forEach(function(value,index,array){ 
			if (value.match(/\.db$/g) !== null ) {
			    var collection = value.split('.')[0];
			    
			    that._database[collection] = new NeDB({
				filename: fullPath + "/" + value,
				inMemoryOnly: that.config.inMemoryOnly,
				autoload: that.config.autoload
			    });
			}

			if (index === array.length -1 && that.config.autoload == true) {
			    that.emit("open",that);
			} else if (index === array.length -1 && that.config.autoload == false ) {	    
			    that.emit("readyToLoad");
			}
		    });

		    if (Object.keys(that._database).length == 0) {
			var error = new Error("ERROR: none of the files in the configured directory match expected contents");
			that.emit("dbOpenError",error);
			return;
		    }

		    return;
		});
	    } else {
		var error = new Error("ERROR: Could not find configured directory");
		that.log.error(error);
		that.emit("dbOpenError", error);
		return;
	    }
	});
    }

    this.on("readyToLoad",function() { 
	
	Object.keys(that._database).forEach(function(value,index,array) {
	    that.log.info({ Info: "Loading Database",
			  index: index,
			  file: value,
			  length: array.length
			});
	    that._database[value].loadDatabase();
	    
	    if (index === array.length -1) {
		that.emit("open",that);
	    }
	});
    });
    
    return this;
};

util.inherits(Datastore,EventEmitter);

Datastore.prototype.collectionExists = function(type,id,callback) {
    if (typeof this._database[type + "_" + id ] !== "undefined") {
	typeof (callback) === "function" ? callback(true) : "" ;
	return true; 
    } else {
	typeof (callback) === "function" ? callback(false) : "" ;
	return false;
    }

};

Datastore.prototype.insert = function(type,id,data) {
    var that = this;
    if ( this.collectionExists(type,id) ) {
	this._database[type + "_" + id].insert(data,function(err,result) { 
	    if (typeof(result) !== "undefined") {
		that.log.info( { Result: result , info: "Send Result ID back to refer to it"} );
	    	that.emit(type + "Inserted", result._id);
	    } else { 
		that.log.error( { Result: result , info: "Send Result ID back to refer to it" ,  Error: err} );
	    }
	});
    }
}

Datastore.prototype.toOID = function(id) {
    return id;
}