"use strict";

var express = require("express"),
    base = require("../base"),
    cookieParser = require("cookie-parser"),
    bodyParser = require("body-parser"),
    parse = require("url").parse,
    ua = require("useragent"),
    kafka = require('kafka-node'),
    Producer = kafka.Producer,
    KeyedMessage = kafka.KeyedMessage,
    Client = kafka.Client;

var Boomerang = function(options, backend, filter, logger) {
  base.call(this, logger);

  this.filter = filter;
  this.backend = backend;
  this.config = options;
    
  try {
    var client = new Client(this.config.kafka.server);
    this.producer = new Producer(client, {partitionerType: 3});
    this.producer.on('ready', function () {
      this.producerReady = true;    
    }.bind(this));
    this.producer.on('error', function (err) {this.log.error(err);}.bind(this));
  } catch (err) {this.log.error(err);}
};

Boomerang.prototype.uaParser = function(req, res, next){
  req.agent = ua.parse(req.headers["user-agent"] || "");
  next();
};

Boomerang.prototype.router = function() {
  var router = express.Router();

  var cookie = cookieParser();

  var parser = bodyParser.text({ strict: false,
         extended: true,
         inflate: true,
         reviver: true,
         parameterLimit: 5000,
         limit: '500kb',
         type: "text/plain"});


  router.post("/beacon/0000", cookie, this.uaParser, parser, this.beacon.bind(this, "POST"));

  return router;
};

Boomerang.prototype.beacon = function(type, req, res) {
  res.set("X-Powered-By", "NoTool");
  res.set("content-type", "image/png");
  var cookies = req.cookies;
  if (typeof cookies === "undefined" || cookies === null) {
      cookies = {};
  }
  var cookie = cookies.ask;
  if (cookie === undefined) {
    // no: set a new cookie
    var randomNumber = Math.random().toString();
    randomNumber = randomNumber.substring(2,randomNumber.length);
    res.cookie('ask', randomNumber, { maxAge: 31536000000 });
    //this.log.debug('cookie created successfully');
  } 
  res.status(200).end();

  var beaconData = {};

  if (type === "POST" && req.body && typeof req.body === 'string') {
    var data = req.body.substr(5);
    try { beaconData = JSON.parse(data); } catch(err) { this.log.error(err); return null;}
  } else if (type === "GET") {
    beaconData = req.query;
  } else {
    return null;
  }

  this.log.debug({ route: req.route }, "Request used params: " + req.params.page + ", " + req.params.state);

  var beacon = {
    type: 'beacon', //req.params.type,
    user: '0000', //req.params.user,
    collection: req.params.collection,
    referrer: parse(req.get("referer") || ""),
    headers: req.headers,
    route: { page: req.params.page, state: req.params.state },
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip,
    agent: req.agent,
    cookies: req.cookies
  };

  this.feed(beacon, beaconData);
  return null;
};

Boomerang.prototype.feed = function(beacon, beaconData) {
  //this.backend.exists(beacon.type, beacon.user, beacon.collection, beacon.referrer, function(exists) {
      this.filter.serialize(beaconData, beacon.headers, beacon.route, beacon.ip, beacon.agent, beacon.cookies, function(data) {
        var restiming;
        if (typeof data.restiming !== "undefined") {
          restiming = data.restiming;
          delete data.restiming;
        }
        if(this.producerReady && this.producer) {
            var key = null;
            var ck = data.cookies;
            if(ck && ck.ask) key = ck.ask;
            var km = new KeyedMessage(key, JSON.stringify(data));
            try {
              this.producer.send([{topic: this.config.kafka.topic, messages:km, key: key } ], function (err, ackData) {
                  if(err) this.log.error(err);
                  this.log.info(ackData);
              }.bind(this));
            } catch (err) {this.log.error(err);}
        }

        this.store(beacon.type, beacon.user, beacon.collection, data, function(oid) {
          if (typeof restiming !== "undefined") {
            this.restiming(oid, restiming, beacon.user, beacon.collection);
          }
        }.bind(this));

      }.bind(this));
  //}.bind(this));
  return null;
};

// type, user, collection, data
Boomerang.prototype.store = function() {
  this.backend.insert.apply(this.backend, arguments);
};

Boomerang.prototype.restiming = function(oid, restiming, user, collection) {
  restiming.forEach(function(timing) {
    timing.refer = oid;
    this.store("resource", user, collection, this.filter.inflate(timing), function() { });
  }, this);
};

module.exports = Boomerang;
