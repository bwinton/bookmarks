#!/usr/bin/env python

from BeautifulSoup import BeautifulSoup
import re
import redis

# Constants.
BOOKMARKS_DB = 10

# populate the bookmarks
soup = open("/Users/bwinton/Downloads/delicious-20110228.htm").read()
soup = BeautifulSoup(soup)
bookmarksDb = redis.Redis(db=BOOKMARKS_DB)
bookmarksDb.flushdb()
dts = soup.findAll("dt")

for i,dt in enumerate(dts):
  print "Adding "+str(i)
  bookmarksDb.set("bookmark:%d:url" % i, dt.find("a")["href"])
  bookmarksDb.set("bookmark:%d:add_date" % i, dt.find("a")["add_date"])
  bookmarksDb.set("bookmark:%d:description" % i, dt.find("a").text)
  tags = dt.find("a")["tags"]
  if tags:
    tags = tags.split(",")
  for tag in tags:
    bookmarksDb.sadd("bookmark:%d:tags" % i, tag)
    bookmarksDb.sadd("tag:%s" % tag, i)

# Each bookmark comes in like:
# <DT><A HREF="http://jsfiddle.net/" ADD_DATE="1298906844" PRIVATE="0"
#        TAGS="javascript,tools,jquery,testing,online">jsFiddle - Online Editor for
#     the Web</A>
# So I think we want to populate keys like:
#  "bookmark:1:url" => "http://jsfiddle.net/"
#  "bookmark:1:add_date" => 1298906844
#  "bookmark:1:tags" => ["javascript","tools","jquery","testing","online"]
#  "bookmark:1:description" => "jsFiddle - Online Editor for the Web"
#  "tags:javascript" => [1]

