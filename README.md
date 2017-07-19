# ZooKeeper TreeCache for node.js

[![Greenkeeper badge](https://badges.greenkeeper.io/fmonniot/node-zookeeper-treecache.svg)](https://greenkeeper.io/)
[![Travis](https://img.shields.io/travis/fmonniot/node-zookeeper-treecache.svg)](https://travis-ci.org/fmonniot/node-zookeeper-treecache)
[![Coveralls](https://img.shields.io/coveralls/fmonniot/node-zookeeper-treecache.svg)](https://coveralls.io/github/fmonniot/node-zookeeper-treecache)
[![Dev Dependencies](https://david-dm.org/fmonniot/node-zookeeper-treecache/dev-status.svg)](https://david-dm.org/fmonniot/node-zookeeper-treecache?type=dev)

A node.js port of the [TreeCache Java Curator recipe](http://curator.apache.org/curator-recipes/tree-cache.html).

## Usage

The ZooKeeper client is not provided by the library, so you need to install it yourself with `npm i node-zk-treecache`.
Then it is as simple as:

```typescript
import { createClient, Client } from "node-zookeeper-client"
import { treeCacheBuilder, TreeCache } from "node-zk-treecache"

const client = createClient('localhost:2181')
client.connect()
const treeCache = treeCacheBuilder(client, '/root')

treeCache.addListener((client, event) => {
  // do something with the events
})

const map = treeCache.getCurrentChildren('/root/path')
```

The complete documentation is available online at [https://francois.monniot.eu/node-zookeeper-treecache](https://francois.monniot.eu/node-zookeeper-treecache)

