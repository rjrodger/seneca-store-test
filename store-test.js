/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";

var assert   = require('chai').assert

var async    = require('async')
var _        = require('lodash')
var gex      = require('gex')
var readline = require('readline')
var chalk    = require('chalk')

var testpassed = function () {
  readline.moveCursor(process.stdout, 55, -1)
  logging(chalk.green("[PASSED]"));
}

var bartemplate = {
  name$:'bar',
  base$:'moon',
  zone$:'zen',

  str:'aaa',
  int:11,
  dec:33.33,
  bol:false,
  wen:new Date(2020,1,1),
  arr:[2,3],
  obj:{a:1,b:[2],c:{d:3}}
}

var barverify = function(bar) {
  assert.equal('aaa', bar.str)
  assert.equal(11,    bar.int)
  assert.equal(33.33, bar.dec)
  assert.equal(false, bar.bol)
  assert.equal(new Date(2020,1,1).toISOString(), _.isDate(bar.wen) ? bar.wen.toISOString() : bar.wen )

  assert.equal(''+[2,3],''+bar.arr)
  assert.deepEqual({a:1,b:[2],c:{d:3}},bar.obj)
}



var scratch = {}

var verify = exports.verify = function(cb,tests){
  return function(error,out) {
    if( error ) return cb(error)
    tests(out)
    cb()
  }
}

var logging = function(msg){
  console.log(chalk.white(msg))
}

var logCategory = function(category){
  return function (msg){
    console.log(chalk.yellow(category) + ' ' + msg)
  }
}



exports.basictest = function(si,settings,done) {
  if( _.isFunction(settings) ) {
    done = settings
    settings = {}
  }

  si.ready(function(){
    logging(chalk.yellow('Running Seneca BASIC Memory Store test suite\n'))
    assert.isNotNull(si)


    var must_merge = null == settings.must_merge ? false : settings.must_merge

    // TODO: test load$(string), remove$(string)


    /* Set up a data set for testing the store.
     * //foo contains [{p1:'v1',p2:'v2'},{p2:'v2'}]
     * zen/moon/bar contains [{..bartemplate..}]
     *
     */
    var dtLog = logCategory('[Data tests]'); //dataTest category logs
    var saveLog = logCategory('[Save tests]'); //dataTest category logs
    var loadLog = logCategory('[Load tests]'); //dataTest category logs
    var rmLog = logCategory('[Remove tests]'); //dataTest category logs
    async.series(
      {
        load0: function(cb) {
          dtLog('Load non existing entity from store')

          var foo0 = si.make('foo')
          foo0.load$('does-not-exist-at-all-at-all',verify(cb,function(out){
            assert.isNull(out)
            testpassed()
          }))
        },

        save1: function(cb) {
          dtLog('Save an entity to store')

          var foo1 = si.make({name$:'foo'}) ///si.make('foo')
          foo1.p1 = 'v1'
          foo1.p3 = 'v3'

          foo1.save$( verify(cb, function(foo1){
            assert.isNotNull(foo1.id)
            assert.equal('v1',foo1.p1)
            assert.equal('v3',foo1.p3)
            scratch.foo1 = foo1
            testpassed()
          }))
        },

        load1: function(cb) {
          dtLog('Load an existing entity from store')

          scratch.foo1.load$( scratch.foo1.id, verify(cb,function(foo1){
            assert.isNotNull(foo1.id)
            assert.equal('v1',foo1.p1)
            scratch.foo1 = foo1
            testpassed()
          }))
        },

        save2: function(cb) {
          dtLog('Save the same entity again to store')

          scratch.foo1.p1 = 'v1x'
          scratch.foo1.p2 = 'v2'

          // test merge behaviour
          delete scratch.foo1.p3

          scratch.foo1.save$( verify(cb,function(foo1){
            assert.isNotNull(foo1.id)
            assert.equal('v1x',foo1.p1)
            assert.equal('v2',foo1.p2)

            if( must_merge ) {
              assert.equal('v3',foo1.p3)
            }

            scratch.foo1 = foo1
            testpassed()
          }))
        },

        load2: function(cb) {
          dtLog('Load again the same entity')

          scratch.foo1.load$( scratch.foo1.id, verify(cb, function(foo1){
            assert.isNotNull(foo1.id)
            assert.equal('v1x',foo1.p1)
            assert.equal('v2',foo1.p2)
            scratch.foo1 = foo1
            testpassed()
          }))
        },

        save3: function(cb) {
          saveLog('Save an entity with different type of properties')

          scratch.bar = si.make( bartemplate )
          var mark = scratch.bar.mark = Math.random()

          scratch.bar.save$( verify(cb, function(bar){
            assert.isNotNull(bar.id)
            barverify(bar)
            assert.equal( mark, bar.mark )
            scratch.bar = bar
            testpassed()
          }))
        },

        save4: function(cb) {
          saveLog('Save an entity with a prexisting name')

          scratch.foo2 = si.make({name$:'foo'})
          scratch.foo2.p2 = 'v2'

          scratch.foo2.save$( verify(cb, function(foo2){
            assert.isNotNull(foo2.id)
            assert.equal('v2',foo2.p2)
            scratch.foo2 = foo2

            testpassed()
          }))
        },

        save5: function(cb) {
          saveLog('Save an entity with an id')

          scratch.foo2 = si.make({name$:'foo'})
          scratch.foo2.id$ = '0201775f-27c4-7428-b380-44b8f4c529f3'

          scratch.foo2.save$( verify(cb, function(foo2){
            assert.isNotNull(foo2.id)
            assert.equal('0201775f-27c4-7428-b380-44b8f4c529f3', foo2.id)
            scratch.foo2 = foo2

            testpassed()
          }))
        },

        query1: function(cb) {
          loadLog('Load a list of entities with one element')

          scratch.barq = si.make('zen', 'moon','bar')
          scratch.barq.list$({}, verify(cb, function(res){
            assert.ok( 1 <= res.length)
            barverify(res[0])

            testpassed()
          }))
        },

        query2: function(cb) {
          loadLog('Load a list of entities with more than one element')

          scratch.foo1.list$({}, verify(cb, function(res){
            assert.ok( 2 <= res.length)

            testpassed()
          }))
        },

        query3: function(cb) {
          loadLog('Load an element by id')

          scratch.barq.list$({id:scratch.bar.id}, verify(cb, function(res){
            assert.equal( 1, res.length )
            barverify(res[0])

            testpassed()
          }))
        },

        query4: function(cb) {
          loadLog('Load an element by integer property')

          scratch.bar.list$({mark:scratch.bar.mark}, verify(cb, function(res){
            assert.equal( 1, res.length )
            barverify(res[0])

            testpassed()
          }))
        },

        query5: function(cb) {
          loadLog('Load an element by string property')

          scratch.foo1.list$({p2:'v2'}, verify(cb, function(res){
            assert.ok( 2 <= res.length )

            testpassed()
          }))
        },


        query6: function(cb) {
          loadLog('Load an element by two properties')

          scratch.foo1.list$({p2:'v2',p1:'v1x'}, verify(cb, function(res){
            assert.ok( 1 <= res.length )
            res.forEach(function(foo){
              assert.equal('v2',foo.p2)
              assert.equal('v1x',foo.p1)

              testpassed()
            })
          }))
        },

        remove1: function(cb) {
          rmLog('Delete an element by name')

          var foo = si.make({name$:'foo'})

          foo.remove$( {all$:true}, function(err, res){
            assert.isNull(err)

            foo.list$({},verify(cb,function(res){
              assert.equal(0,res.length)

              testpassed()
            }))
          })
        },

        remove2: function(cb) {
          rmLog('Delete an element by property')

          scratch.bar.remove$({mark:scratch.bar.mark}, function(err,res){
            assert.isNull(err)

            scratch.bar.list$({mark:scratch.bar.mark}, verify(cb, function(res){
              assert.equal( 0, res.length )

              testpassed()
            }))
          })
        },

      },
      function(err,out) {
        err = err || null
        if( err ) {
          console.dir( err )
        }

        //this line if for readability, it add a new line at the end of the test suite output
        console.log()
        si.__testcount++
        assert.isNull(err)
        done && done()
      })
  })
}



module.exports.sorttest = function(si, done) {
  logging(chalk.yellow('Running Seneca SORT Memory Store tests'));

  var sortLog = logCategory('[Sort tests]');
  async.series(
    {

      remove: function (cb) {
        sortLog('clear foo collection');

        var cl = si.make$('foo')
        // clear 'foo' collection
        cl.remove$({all$: true}, function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert1st: function (cb) {
        sortLog('insert 1st basic entity')

        var cl = si.make$('foo')
        cl.p1 = 'v1'
        cl.p2 = 'v1'

        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert2nd: function (cb) {
        sortLog('insert 2nd basic entity')

        var cl = si.make$('foo')
        cl.p1 = 'v2'
        cl.p2 = 'v2'

        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert3rd: function (cb) {
        sortLog('insert 3rd basic entity')

        var cl = si.make$('foo')
        cl.p1 = 'v3'
        cl.p2 = 'v3'

        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      listasc: function (cb) {
        sortLog('test list ascending')

        var cl = si.make({name$: 'foo'})
        cl.list$({sort$: { p1: 1 }}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(lst[0].p1, 'v1')
          assert.equal(lst[1].p1, 'v2')
          assert.equal(lst[2].p1, 'v3')
          cb()
        })
      },

      listdesc: function (cb) {
        sortLog('test list descending')

        var cl = si.make({name$: 'foo'})
        cl.list$({sort$: { p1: -1 }}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(lst[0].p1, 'v3')
          assert.equal(lst[1].p1, 'v2')
          assert.equal(lst[2].p1, 'v1')
          cb()
        })
      }
    },
    function (err, out) {
      si.__testcount++
      done()
    }
  )

  si.__testcount++
}


exports.limitstest = function(si,done) {
  logging(chalk.yellow('Running Seneca LIMITS Memory Store tests'));
  var limitLog = logCategory('[Limits tests]');

  async.series(
    {

      remove: function (cb) {
        limitLog('clear foo collection')

        var cl = si.make$('foo')
        // clear 'foo' collection
        cl.remove$({all$: true}, function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert1st: function (cb) {
        limitLog('insert 1st basic')

        var cl = si.make$('foo')
        cl.p1 = 'v1'
        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert2nd: function (cb) {
        limitLog('insert 2nd basic entity')

        var cl = si.make$('foo')
        cl.p1 = 'v2'
        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      insert3rd: function (cb) {
        limitLog('insert 3rd basic entity')

        var cl = si.make$('foo')
        cl.p1 = 'v3'
        cl.save$(function (err, foo) {
          assert.ok(null == err)
          cb()
        })
      },

      listall: function (cb) {
        limitLog('test list all entities')

        var cl = si.make({name$: 'foo'})
        cl.list$({}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(3, lst.length)
          cb()
        })
      },

      listlimit1skip1: function (cb) {
        limitLog('test list limit 1 and skip to 2nd entity with skip$: 1')

        var cl = si.make({name$: 'foo'})
        cl.list$({limit$: 1, skip$: 1, sort$: { p1: 1 }}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(1, lst.length)
          assert.equal('v2', lst[0].p1);
          cb()
        })
      },

      listlimit2skip3: function (cb) {
        limitLog('test list limit 2 and skip 3 to get no entities returned.')

        var cl = si.make({name$: 'foo'})
        cl.list$({limit$: 2, skip$: 3}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(0, lst.length)
          cb()
        })
      },

      listlimit5skip2: function (cb) {
        limitLog('test list limit 5 and skip to 3rd entity with skip$: 2')

        var cl = si.make({name$: 'foo'})
        cl.list$({limit$: 5, skip$: 2, sort$: { p1: 1 }}, function (err, lst) {
          assert.ok(null == err)
          assert.equal(1, lst.length)
          assert.equal('v3', lst[0].p1);
          cb()
        })
      }
    },
    function (err, out) {
      si.__testcount++
      done()
    }
  )

  si.__testcount++
}


exports.sqltest = function(si,done) {
  si.ready(function(){
    assert.isNotNull(si)

    var Product = si.make('product')
    var products = []

    async.series(
      {
        setup: function(cb) {

          products.push( Product.make$({name:'apple',price:100}) )
          products.push( Product.make$({name:'pear',price:200}) )

          var i = 0
          function saveproduct(){
            return function(cb) {
              products[i].save$(cb)
              i++
            }
          }

          async.series([
            saveproduct(),
            saveproduct(),
          ],cb)
        },


        query_string: function( cb ) {
          Product.list$("SELECT * FROM product ORDER BY price",function(err,list){
            var s = _.map(list,function(p){return p.toString()}).toString()
            assert.ok(
              gex("$-/-/product:{id=*;name=apple;price=100},$-/-/product:{id=*;name=pear;price=200}").on( s ) )
            cb()
          })
        },

        query_params: function( cb ) {
          Product.list$(["SELECT * FROM product WHERE price >= ? AND price <= ?",0,1000],function(err,list){
            var s = _.map(list,function(p){return p.toString()}).toString()
            assert.ok(
              gex("$-/-/product:{id=*;name=apple;price=100},$-/-/product:{id=*;name=pear;price=200}").on( s ) )
            cb()
          })
        },

        teardown: function(cb) {
          products.forEach(function(p){
            p.remove$()
          })
          cb()
        }
      },
      function(err,out){
        if( err ) {
          console.dir( err )
        }
        si.__testcount++
        assert(err === null || err === undefined)
        done && done()
      }
    )
  })
}

exports.closetest = function(si,testcount,done) {
  var RETRY_LIMIT = 10
  var retryCnt = 0

  function retry(){
    //console.log(testcount+' '+si.__testcount)
    if( testcount <= si.__testcount || retryCnt > RETRY_LIMIT ) {
      logging(chalk.green('[Close test]'));
      si.close()
      done && done()
    }
    else {
      retryCnt++
      setTimeout(retry, 500);
    }
  }
  retry()
}

