#!/usr/bin/env node

var express = require("express");
var http = require("http");
var mu = require("./lib/mu");
var redis = require("redis-node");
var sys = require("sys");
var url = require("url");

const MAX_RESULTS = -1;  // Set to -1 to get everything.
const BOOKMARKS_DB = 10;
var bookmarksDb = redis.createClient();
bookmarksDb.select(BOOKMARKS_DB);


// Templates.

var indexTmpl = "<h1>Index</h1>" +
  "{{#results}}<b><a href='/id/{{id}}'>{{id}}</a></b> -"+
    "<a href='{{url}}'>{{desc}}</a> :" +
    "{{#tags}}"+
      "<a href='/tag/{{name}}'>{{name}}</a> " +
    "{{/tags}}<br>" +
  "{{/results}}" +
  "There were {{count}} results in {{redis}}/{{server}} ms.<br>";
var indexCmpl = mu.compileText(indexTmpl, {});

var idTmpl = "<h1>Id: {{id}}</h1>" +
  "Url: <a href='{{url}}'>{{url}}</a><br>" +
  "Description: {{desc}}<br>" +
  "Date: {{add_date}}<br>" +
  "Tags: {{#tags}}"+
    "<a href='/tag/{{name}}'>{{name}}</a> " +
  "{{/tags}}<br>" +
  "Time: {{redis}}/{{server}} ms.<br>";
var idCmpl = mu.compileText(idTmpl, {});

var tagTmpl = "<h1>Tag: {{tag}}</h1>" +
  "{{#results}}<b><a href='/id/{{id}}'>{{id}}</a></b> -"+
    "<a href='{{url}}'>{{desc}}</a> :" +
    "{{#tags}}"+
      "<a href='/tag/{{name}}'>{{name}}</a> " +
    "{{/tags}}<br>" +
  "{{/results}}" +
  "There were {{count}} results in {{redis}}/{{server}} ms.<br>";
var tagCmpl = mu.compileText(tagTmpl, {});


var app = express.createServer();

app.get("/", function(req, res) {
  var startTime = Date.now();
  res.writeHead(200, {"Content-Type": "text/html"});
  var ip_address = req.headers["x-forwarded-for"];
  if (!ip_address)
    ip_address = req.connection.remoteAddress;
  console.log(ip_address + " -> /");
  var context = {};
  var done = function() {
    var now = Date.now();
    context.redis = (now - redisStartTime) || 0;
    context.server = (now - startTime) || 0;
    context.results.sort(function(a, b) {
      return b.add_date - a.add_date;
    });
    console.log("Got results!");
    //for (var i in context.results)
      //console.log(JSON.stringify(context.results[i]));
    indexCmpl(context)
      .addListener("data", function(c) { res.write(c); })
      .addListener("end", function() {
        res.end();
        var after = Date.now() - startTime;
        console.log("  Time: "+context.redis+"/"+context.server+"/"+after+" ms");
      });
  };

  var redisStartTime = Date.now();
  bookmarksDb.keys("bookmark:*:url", function(err, arrayOfKeys) {
    count = arrayOfKeys.length;
    context.count = count;
    context.results = [];
    if (!count)
      done();
    arrayOfKeys.forEach(function(key) {
      bookmarksDb.get(key, function(err, url) {
        var id = key.split(":")[1];
        bookmarksDb.get("bookmark:"+id+":add_date", function(err, add_date) {
        bookmarksDb.get("bookmark:"+id+":description", function(err, desc) {
        bookmarksDb.smembers("bookmark:"+id+":tags", function(err, tagList) {
          tags = []
          for (var tag in tagList)
            tags.push({name:tagList[tag]});
          context.results.push({id: id, url: url, add_date:add_date,
                                desc:desc, tags:tags});
          count--;
          if (count == 0)
            done();
        });
        });
        });
      });
    });
  });
});

app.get("/id/:id", function(req, res) {
  var startTime = Date.now();
  res.writeHead(200, {"Content-Type": "text/html"});
  var id = req.params.id;
  var ip_address = req.headers["x-forwarded-for"];
  if (!ip_address)
    ip_address = req.connection.remoteAddress;
  console.log(ip_address + " -> id/" + id);
  var redisStartTime = Date.now();
  bookmarksDb.get("bookmark:"+id+":url", function(err, url) {
  bookmarksDb.get("bookmark:"+id+":add_date", function(err, add_date) {
  bookmarksDb.get("bookmark:"+id+":description", function(err, desc) {
  bookmarksDb.smembers("bookmark:"+id+":tags", function(err, tagList) {
    tags = []
    for (var tag in tagList)
      tags.push({name:tagList[tag]});
    context = {id: id, url: url, add_date:add_date,
               desc:desc, tags:tags};
    var now = Date.now();
    context.redis = (now - redisStartTime) || 0;
    context.server = (now - startTime) || 0;
    idCmpl(context)
      .addListener("data", function(c) { res.write(c); })
      .addListener("end", function() {
        res.end();
        var after = Date.now() - startTime;
        console.log("  Time: "+context.redis+"/"+context.server+"/"+after+" ms");
      });
  });
  });
  });
  });
});

app.get("/tag/:tag", function(req, res) {
  var startTime = Date.now();
  res.writeHead(200, {"Content-Type": "text/html"});
  var tag = req.params.tag;
  var ip_address = req.headers["x-forwarded-for"];
  if (!ip_address)
    ip_address = req.connection.remoteAddress;
  console.log(ip_address + " -> tag/" + tag);
  var context = {tag: tag};
  var done = function() {
    var now = Date.now();
    context.redis = (now - redisStartTime) || 0;
    context.server = (now - startTime) || 0;
    context.results.sort(function(a, b) {
      return b.add_date - a.add_date;
    });
    tagCmpl(context)
      .addListener("data", function(c) { res.write(c); })
      .addListener("end", function() {
        res.end();
        var after = Date.now() - startTime;
        console.log("  Time: "+context.redis+"/"+context.server+"/"+after+" ms");
      });
  };

  var redisStartTime = Date.now();
  bookmarksDb.smembers("tag:"+tag, function(err, arrayOfKeys) {
    count = arrayOfKeys.length;
    context.count = count;
    context.results = [];
    if (!count)
      done();
    arrayOfKeys.forEach(function(id) {
      bookmarksDb.get("bookmark:"+id+":url", function(err, url) {
      bookmarksDb.get("bookmark:"+id+":add_date", function(err, add_date) {
      bookmarksDb.get("bookmark:"+id+":description", function(err, desc) {
      bookmarksDb.smembers("bookmark:"+id+":tags", function(err, tagList) {
        tags = []
        for (var tag in tagList)
          tags.push({name:tagList[tag]});
        context.results.push({id: id, url: url, add_date:add_date,
                              desc:desc, tags:tags});
        count--;
        if (count == 0)
          done();
      });
      });
      });
      });
    });
  });
});

app.use(express.staticProvider(__dirname + '/client'));
app.listen(8123);

console.log("Server running at http://127.0.0.1:8123/");
