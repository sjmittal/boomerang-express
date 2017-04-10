"use strict";
/* eslint-disable no-underscore-dangle */

var base = require("../../base"),
    path = require("path"),
    fs = require("fs");


function Backend(config, logger) {

  base.call(this, logger);
  this.config = config || {};

  this.init();
  return this;
}

Backend.prototype.init = function() {
  return true;
};

Backend.prototype.insert = function(type, user, collection, data, callback) {
  return true;
};

Backend.prototype.webcollections = function(user, callback) {
  callback([]);
  return null;
};

module.exports = Backend;
