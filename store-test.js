/* Copyright (c) 2014 Richard Rodger, MIT License */
'use strict';

var assert   = require('chai').assert

var async    = require('async')
var _        = require('lodash')
var gex      = require('gex')

var lab = require('lab')


var bartemplate = {
  name$: 'bar',
  base$: 'moon',
  zone$: 'zen',

  str: 'aaa',
  int: 11,
  dec: 33.33,
  bol: false,
  wen: new Date(2020, 1, 1),
  arr: [ 2, 3 ],
  obj: {
    a: 1,
    b: [2],
    c: { d: 3 }
  }
}

var barverify = function (bar) {
  assert.equal('aaa', bar.str)
  assert.equal(11,    bar.int)
  assert.equal(33.33, bar.dec)
  assert.equal(false, bar.bol)
  assert.equal(new Date(2020, 1, 1).toISOString(), _.isDate(bar.wen) ? bar.wen.toISOString() : bar.wen)
  assert.equal('' + [ 2, 3 ], '' + bar.arr)
  assert.deepEqual({
    a: 1,
    b: [2],
    c: { d: 3 }
  }, bar.obj)
}


var scratch = {}

function verify (cb, tests) {
  return function (error, out) {
    if (error) {
      return cb(error)
    }

    try {
      tests(out)
    }
    catch (ex) {
      return cb(ex)
    }

    cb()
  }
}


function basictest (settings) {
  var si = settings.seneca
  var must_merge = !!settings.must_merge
  var script = settings.script || lab.script()

  var describe = script.describe
  var it = script.it

  describe('Basic store', function () {

    script.before(function before (done) {

      async.series([
        function clearFoo (next) {
          si.make({ name$: 'foo' }).remove$({ all$: true }, next)
        },
        function clearBar (next) {
          si.make('zen', 'moon', 'bar').remove$({ all$: true }, next)
        }
      ], done)

    })

    it('should load non existing entity from store', function (done) {

      var foo0 = si.make('foo')
      foo0.load$('does-not-exist-at-all-at-all', verify(done, function (out) {
        assert.isNull(out)
      }))

    })

    it('should save an entity to store', function (done) {

      var foo1 = si.make({ name$: 'foo' })
      foo1.p1 = 'v1'
      foo1.p3 = 'v3'

      foo1.save$(verify(done, function (foo1) {
        assert.isNotNull(foo1.id)
        assert.equal('v1', foo1.p1)
        assert.equal('v3', foo1.p3)
        scratch.foo1 = foo1
      }))

    })

    it('should load an existing entity from store', function (done) {

      scratch.foo1.load$(scratch.foo1.id, verify(done, function (foo1) {
        assert.isNotNull(foo1.id)
        assert.equal('v1', foo1.p1)
        scratch.foo1 = foo1
      }))

    })

    it('should save the same entity again to store', function (done) {

      scratch.foo1.p1 = 'v1x'
      scratch.foo1.p2 = 'v2'

      // test merge behaviour
      delete scratch.foo1.p3

      scratch.foo1.save$(verify(done, function (foo1) {
        assert.isNotNull(foo1.id)
        assert.equal('v1x', foo1.p1)
        assert.equal('v2', foo1.p2)

        if (must_merge) {
          assert.equal('v3', foo1.p3)
        }

        scratch.foo1 = foo1
      }))

    })

    it('should load again the same entity', function (done) {

      scratch.foo1.load$(scratch.foo1.id, verify(done, function (foo1) {
        assert.isNotNull(foo1.id)
        assert.equal('v1x', foo1.p1)
        assert.equal('v2', foo1.p2)
        scratch.foo1 = foo1
      }))

    })

    it('should save an entity with different type of properties', function (done) {

      scratch.bar = si.make(bartemplate)
      var mark = scratch.bar.mark = Math.random()

      scratch.bar.save$(verify(done, function (bar) {
        assert.isNotNull(bar.id)
        barverify(bar)
        assert.equal(mark, bar.mark)
        scratch.bar = bar
      }))

    })

    it('should save an entity with a prexisting name', function (done) {

      scratch.foo2 = si.make({ name$: 'foo' })
      scratch.foo2.p2 = 'v2'

      scratch.foo2.save$(verify(done, function (foo2) {
        assert.isNotNull(foo2.id)
        assert.equal('v2', foo2.p2)
        scratch.foo2 = foo2
      }))

    })

    it('should save an entity with an id', function (done) {

      scratch.foo2 = si.make({ name$: 'foo' })
      scratch.foo2.id$ = '0201775f-27c4-7428-b380-44b8f4c529f3'

      scratch.foo2.save$(verify(done, function (foo2) {
        assert.isNotNull(foo2.id)
        assert.equal('0201775f-27c4-7428-b380-44b8f4c529f3', foo2.id)
        scratch.foo2 = foo2
      }))

    })

    it('should load a list of entities with one element', function (done) {

      scratch.barq = si.make('zen', 'moon', 'bar')
      scratch.barq.list$({}, verify(done, function (res) {
        assert.ok(1 <= res.length)
        barverify(res[0])
      }))

    })

    it('should load a list of entities with more than one element', function (done) {

      scratch.foo1.list$({}, verify(done, function (res) {
        assert.ok(2 <= res.length)
      }))

    })

    it('should load an element by id', function (done) {

      scratch.barq.list$({ id: scratch.bar.id }, verify(done, function (res) {
        assert.equal(1, res.length)
        barverify(res[0])
      }))

    })

    it('should load an element by integer property', function (done) {

      scratch.bar.list$({ mark: scratch.bar.mark }, verify(done, function (res) {
        assert.equal(1, res.length)
        barverify(res[0])
      }))

    })

    it('should load an element by string property', function (done) {

      scratch.foo1.list$({ p2: 'v2' }, verify(done, function (res) {
        assert.ok(2 <= res.length)
      }))
    })

    it('should load an element by two properties', function (done) {

      scratch.foo1.list$({ p2: 'v2', p1: 'v1x' }, verify(done, function (res) {
        assert.ok(1 <= res.length)
        res.forEach(function (foo) {
          assert.equal('v2', foo.p2)
          assert.equal('v1x', foo.p1)
        })
      }))

    })

    it('should delete an element by name', function (done) {

      var foo = si.make({ name$: 'foo' })

      foo.remove$({ all$: true }, function (err, res) {
        assert.isNull(err)

        foo.list$({}, verify(done, function (res) {
          assert.equal(0, res.length)
        }))
      })

    })

    it('should delete an element by property', function (done) {

      scratch.bar.remove$({ mark: scratch.bar.mark }, function (err, res) {
        assert.isNull(err)

        scratch.bar.list$({ mark: scratch.bar.mark }, verify(done, function (res) {
          assert.equal(0, res.length)
        }))
      })

    })

    it('should not save modifications to entity after save completes', function (done) {

      scratch.foo2 = si.make({ name$: 'foo' })
      scratch.foo2.p3 = ['a']
      scratch.foo2.save$(verify(done, function (saved_foo) {
        assert.deepEqual(saved_foo.p3, ['a'])
        // now that foo is in the database, modify the original data
        scratch.foo2.p3.push('b')
        assert.deepEqual(saved_foo.p3, ['a'])
      }))

    })

    it('should not backport modification to saved entity to the original one', function (done) {

      scratch.foo2 = si.make({ name$: 'foo' })
      scratch.foo2.p3 = ['a']
      scratch.foo2.save$(verify(done, function (saved_foo) {
        assert.deepEqual(saved_foo.p3, ['a'])
        // now that foo is in the database, modify the original data
        saved_foo.p3.push('b')
        assert.deepEqual(scratch.foo2.p3, ['a'])
      }))

    })

    it('should be able to delete a field', function (done) {

      scratch.foo3 = si.make({ name$: 'foo' })
      scratch.foo3.bar = 'baz'

      scratch.foo3.save$(function (err, saved_foo) {

        if (err) { return done(err) }
        var id = saved_foo.id
        var req = si.make({ name$: 'foo' })
        req.load$({ id: id }, function (err, el) {
          if (err) { return done(err) }

          assert.deepEqual(el.bar, 'baz')

          delete saved_foo.bar

          saved_foo.save$(function (err, saved_foo) {
            if (err) { return done(err) }
            // now that foo is in the database, modify the original data
            req.load$({ id: id }, function (err, el) {
              if (err) { return done(err) }
              assert.deepEqual(el.bar, undefined)
              done()
            })
          })
        })
      })
    })
  })
  return script
}

function sorttest (settings) {
  var si = settings.seneca
  var script = settings.script || lab.script()

  var describe = script.describe
  var it = script.it

  describe('Sorting', function () {

    script.before(function before(done) {

      async.series([
        function clear (next) {
          var cl = si.make$('foo')
          cl.remove$({ all$: true }, next)
        },
        function insert1st (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v1'
          cl.p2 = 'v1'

          cl.save$(next)
        },
        function insert2nd (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v2'
          cl.p2 = 'v2'

          cl.save$(next)
        },
        function insert3rd (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v3'
          cl.p2 = 'v3'

          cl.save$(next)
        }
      ], done)

    })

    it('should support ascending order', function (done) {

      var cl = si.make({ name$: 'foo' })
      cl.list$({ all$: true, sort$: { p1: 1 } }, verify(done, function (lst) {
        assert.equal(lst.length, 3)
        assert.equal(lst[0].p1, 'v1')
        assert.equal(lst[1].p1, 'v2')
        assert.equal(lst[2].p1, 'v3')
      }))

    })

    it('should support descending order', function (done) {

      var cl = si.make({ name$: 'foo' })
      cl.list$({ sort$: { p1: -1 } }, verify(done, function (lst) {
        assert.equal(lst.length, 3)
        assert.equal(lst[0].p1, 'v3')
        assert.equal(lst[1].p1, 'v2')
        assert.equal(lst[2].p1, 'v1')
      }))
    })

  })

  return script
}

function limitstest (settings) {
  var si = settings.seneca
  var script = settings.script || lab.script()

  var describe = script.describe
  var it = script.it

  describe('Limits', function () {

    script.before(function (done) {
      async.series([
        function remove (next) {
          var cl = si.make$('foo')
          // clear 'foo' collection
          cl.remove$({ all$: true }, next)
        },
        function insert1st (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v1'
          cl.save$(next)
        },
        function insert2nd (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v2'
          cl.save$(next)
        },

        function insert3rd (next) {
          var cl = si.make$('foo')
          cl.p1 = 'v3'
          cl.save$(next)
        }
      ], done)
    })


    it('check setup correctly', function listall (done) {
      var cl = si.make({ name$: 'foo' })
      cl.list$({}, verify(done, function (lst) {
        assert.equal(3, lst.length)
      }))
    })

    it('should support limit, skip and sort', function listlimit1skip1 (done) {
      var cl = si.make({ name$: 'foo' })
      cl.list$({ limit$: 1, skip$: 1, sort$: { p1: 1 } }, verify(done, function (lst) {
        assert.equal(1, lst.length)
        assert.equal('v2', lst[0].p1)
      }))
    }),

    it('should return empty array when skipping all the records', function listlimit2skip3 (done) {
      var cl = si.make({ name$: 'foo' })
      cl.list$({ limit$: 2, skip$: 3 }, verify(done, function (lst) {
        assert.equal(0, lst.length)
      }))
    })

    it('should return correct number of records if limit is too high', function listlimit5skip2 (done) {
      var cl = si.make({ name$: 'foo' })
      cl.list$({ limit$: 5, skip$: 2, sort$: { p1: 1 } }, verify(done, function (lst) {
        assert.equal(1, lst.length)
        assert.equal('v3', lst[0].p1)
      }))
    })

  })

  return script
}

function sqltest (settings) {

  var si = settings.seneca
  var script = settings.script || lab.script()

  var describe = script.describe
  var it = script.it

  var Product = si.make('product')

  describe('Sql support', function () {

    script.before(function before (done) {

      async.series([
        function clear (next) {
          Product.remove$({ all$: true }, next)
        },
        function create (next) {
          var products = [
            Product.make$({ name: 'apple', price: 100 }),
            Product.make$({ name: 'pear', price: 200 })
          ]

          function saveproduct (product, saved) {
            product.save$(saved)
          }

          async.forEach(products, saveproduct, next)
        }
      ], done)

    })


    it('should accept a string query', function (done) {
      Product.list$('SELECT * FROM product ORDER BY price', verify(done, function (list) {

        assert.equal(2, list.length)

        assert.equal('-/-/product', list[0].entity$)
        assert.equal('apple', list[0].name)
        assert.equal(100, list[0].price)

        assert.equal('-/-/product', list[1].entity$)
        assert.equal('pear', list[1].name)
        assert.equal(200, list[1].price)
      }))
    })

    it('should accept and array with query and parameters', function (done) {
      Product.list$([ 'SELECT * FROM product WHERE price >= ? AND price <= ?', 0, 1000 ], verify(done, function (list) {

        assert.equal(2, list.length)

        assert.equal('-/-/product', list[0].entity$)
        assert.equal('apple', list[0].name)
        assert.equal(100, list[0].price)

        assert.equal('-/-/product', list[1].entity$)
        assert.equal('pear', list[1].name)
        assert.equal(200, list[1].price)

      }))
    })
  })

  return script
}

module.exports = {
  basictest: basictest,
  sorttest: sorttest,
  limitstest: limitstest,
  sqltest: sqltest,
  verify: verify
}
