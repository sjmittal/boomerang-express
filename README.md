![Logo](docs/assets/img/png/logo.png "Logo")

# Boomerang-Express

[![Build Status](https://travis-ci.org/andreas-marschke/boomerang-express.svg?branch=master)](https://travis-ci.org/andreas-marschke/boomerang-express)

A recieving server for [boomerangjs](https://github.com/sjmittal/boomerang) beacon data and structured storage.

## Usage

For this you will need boomerang.js see: https://github.com/sjmittal/boomerang

Your webpage code may look like this: 
```
<!DOCTYPE html>
<html>
  <head>
    <script type="text/javascript">
       (function(){
        var dom,doc,where,iframe = document.createElement('iframe');
        iframe.src = "javascript:false";
        (iframe.frameElement || iframe).style.cssText = "width: 0; height: 0; border: 0";
        var where = document.getElementsByTagName('script')[0];
        where.parentNode.insertBefore(iframe, where);
        try {
          doc = iframe.contentWindow.document;
        } catch(e) {
          dom = document.domain;
          iframe.src="javascript:var d=document.open();d.domain='"+dom+"';void(0);";
          doc = iframe.contentWindow.document;
        }

        doc.open()._l = function() {
          var js = this.createElement("script");
          if(dom) this.domain = dom;
          js.id = "boomr-if-as";
          js.src = '/content/javascript/boomerang-1.0-debug.js';
          this.body.appendChild(js);
        };

        doc.write('<body onload="document._l();">');
        doc.close();
      })();
    </script> 
    <title><%= title %></title>
    <link rel='stylesheet' href='/stylesheets/style.css' />
  </head>
  <body>
    <h1><%= title %></h1>
    <p>Welcome to <%= title %></p>
  </body>
</html>
```

Somewhere in the end of your `boomerang-1.0-debug.js' you would have to configure the boomerang like done below.

```
BOOMR.init({
	beacon_url: "http://localhost:4001/beacon/0000",
	instrument_xhr: true,
	clicks: {
		click_url: "http://localhost:4001/beacon/0000"
	},
	RT: {
	   strict_referrer: false
	}
});

```

_NOTE:_ here we primarily load the boomerang via an iframe using non blocking asynchronous way.
Refer to boomerang.js documentation (link below) for more information on how to.

Advantage of this is approach to integrate third party web pages seemlessly without making much changes in their javascript code.
The source of bommearng 

If you've setup the boomerang-express server correctly the above code
will run DNS latency, Roundtrip and Bandwidth tests as described in
the boomerang.js documentation (see: https://soasta.github.io/boomerang/doc/).

On the boomerang-express side you will see requests to
`image-(+*).(png|gif)` and `/beacon/0000`.

`/beacon/0000` will recieve a parameterized POST request containing data
from the evaluation of previously described tests. boomerang-express will
save this data together with the Identification Number (here
`0000`) into the configured kafka topic (or mongodb  under the `beacon_0000` collection).

_NOTE:_ boomerang-express expects pre-existing collections ie. `beacon_0000`.
_NOTE:_ boomerang-express expects kafka to be setup along with topic created as defined in `master.json` config.

Should you have enabled the boomerang.js plugins restiming and clicks and also configured mongodb datastore
you'll also see data inserted into the collections `restiming_0000` and
`clicks_0000` where these handle the specific data of these plugins. 
So these colllections also need to be created beforhand (based on the configured urls as defined above).


## Why fork
The reason for this fork are mainly few points:
1. In case of high load enviornment (tens of millions of beacons per day) processing beacons mongodb 
or any other standalone db was not sufficient.
2. Idea here is to send the beacon to a kafka topic and process it later via a kafka streams or any other streams application 
and insert processed data into a standalone database
So notice that default datastore config is:
```
  "datastore" : {
    "active" : "none",
    "none" : {
    }
  }
```
3. Some optimization were performed to make it work only against POST request to limit the parameter parsing
and simply use native JSON parse and stringify to conevert the sent data into JSON process it and send the 
stringify value back to kafka topic
4. Add a cookie to track from which browser session the becacon came from to effectively partition the data.
The same can also help in streams processing later on. This way we need not do anything client specific to identify unique user.
Or code for the same. All requests are sent as `beacon/0000`.
5. The best results are obtained by refraining from using any standalone database. However if there is a need (maybe in developement env.)
then appropriate `datastore` can be configured in `config/master.json`.

_NOTE:_ In case the above statements do not fit your needs it is better to use the orignal application instead of this forked one.

## Requirements

- express (http://expressjs.com)
- node-conf (https://npmjs.org/package/node-conf)
- mongodb (https://npmjs.org/package/mongodb) 
- forever (https://npmjs.org/package/forever)
- kafka-node (https://www.npmjs.com/package/kafka-node)

### Installing Requirements

Locally (recommended): 

```shell
 $> npm install .
```

Globally: 

```shell
 $> npm -g install
```

## Configuration

Configuration is defined in config/master.json

See the [setup documentation](docs/index.md) for more information on how
to configure boomerang-express for your environment.

## Deployment

### CentOS

Installing boomerang-express on CentOS is handled using grunt.
You'll need to install the packages under devDependencies as well as the following:

 - `rpmdevtools`: tools for build rpms
 - `rpmlint`: post-build linting of rpms

Once you have these installed you'll need to run:

 - if you have all dependencies installed globally:

```shell
  $> grunt rpm
```

 - if you have all dependencies installed locally:

```shell
 $> ./node_modules/.bin/grunt rpm
```

This will build an rpm package in the project root-directory. If you have a
deployment scenario involving a local centos repository you may import the rpm
file into your repository.

---

Setting up for development and more tips visit our [development documentation](docs/index.md)
