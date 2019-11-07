const { App } = require('adapt-authoring-core');
const express = require('express');
const Router = require('../lib/router');
const ServerModule = require('../lib/module');
const should = require('should');
const supertest = require('supertest');

describe('Server router', function() {
  before(function() {
    this.createRouter = (r = 'test') => new Router(r, express());
    this.testRequest = (router, done, expectedStatus = 200) => {
      const l = router.parentRouter.listen(undefined, function() {
        supertest(router.parentRouter)
          .get(`${router.path}`)
          .expect(expectedStatus)
          .end((e, res) => l.close(done))
      });
    };
  });
  describe('#addRoute()', function() {
    const r1 = { route: 'test1', handlers: { get: () => {} } };
    const r2 = { route: 'test2', handlers: { get: () => {} } };
    const r3 = { route: 'test3', handlers: { get: () => {} } };
    it('should add a route function to the stack', function() {
      const router = this.createRouter();
      router.addRoute(r1);
      router.routes.should.containEql(r1);
    });
    it('should add multiple routes to the stack', function() {
      const router = this.createRouter();
      router.addRoute(r1, r2);
      router.routes.should.containEql(r2);
    });
    it('should return router reference so as to be chainable', function() {
      const router = this.createRouter();
      const r = router.addRoute(r2);
      r.should.equal(router);
    });
    it('should call route handler on client request', function(done) {
      const router = this.createRouter();
      router.addRoute({
        route: '/',
        handlers: { get: (req, res, next) => res.end() }
      });
      router.init();
      this.testRequest(router, done);
    });
  });
  describe('#addMiddleware()', function() {
    const m1 = (req, res, next) => next();
    const m2 = (req, res, next) => next();
    it('should add a middleware function to the stack', function() {
      const router = this.createRouter();
      router.addMiddleware(m1);
      router.middleware.should.containEql(m1);
    });
    it('should add multiple middleware functions to the stack', function() {
      const router = this.createRouter();
      router.addMiddleware(m1, m2);
      router.middleware.should.containEql(m2);
    });
    it('should return router reference so as to be chainable', function() {
      const router = this.createRouter();
      const r = router.addMiddleware(m2);
      r.should.equal(router);
    });
    it('should call custom middleware on client request', function(done) {
      const router = this.createRouter();
      router.addRoute({
        route: '/',
        handlers: { get: (req, res, next) => res.status(500).end() }
      });
      router.addMiddleware((req, res, next) => res.status(200).end());
      router.init();
      this.testRequest(router, done);
    });
  });
  describe('#createChildRouter()', function() {
    let parent, child;
    before(function() {
      parent = this.createRouter();
      child = parent.createChildRouter('child');
    });
    it('should return a router instance', function() {
      child.should.be.instanceof(Router);
    });
    it('should expose specified route', function() {
      child.route.should.equal('child');
    });
    it('should be added to child routers', function() {
      parent.childRouters.should.containEql(child);
    });
    it('should reference current router as parent', function() {
      child.parentRouter.should.equal(parent);
    });
  });
  describe('#path()', function() {
    it('should generate the endpoint of the router', function() {
      const child = new Router('child', new Router('parent', {}));
      child.path.should.equal('/parent/child');
    });
  });
  describe('#map()', function() {
    it('should generate a map of endpoints exposed by the router', function() {
      const map = this.createRouter().map;
      map.should.be.an.Object();
      map.should.have.property('test_url');
    });
  });
  describe('#handleRequest()', function() {
    it('should invoke listeners to Server#requestHook', function(done) {
      let isDone = false;
      App.instance.getModule('server').requestHook.tap(() => {
        if(!isDone) done();
        isDone = true;
      });
      const router = this.createRouter();
      router.addRoute({
        route: '/',
        handlers: { get: (req, res, next) => {} }
      });
      router.init();
      this.testRequest(router, () => {}, 500);
    });
  });
  describe('#genericNotFoundHandler()', function() {
    it('should return 404 HTTP status', function(done) {
      const router = this.createRouter();
      router.addRoute({
        route: '/',
        handlers: { get: (req, res, next) => res.end() }
      });
      router.addMiddleware(router.genericNotFoundHandler);
      router.init();
      this.testRequest(router, done, 404);
    });
  });
  describe('#genericErrorHandler()', function() {
    it('should return error HTTP status', function(done) {
      const router = this.createRouter();
      router.addRoute({
        route: '/',
        handlers: { get: (req, res, next) => next(new Error('Something bad happened')) }
      });
      router.addMiddleware(router.genericErrorHandler);
      router.init();
      this.testRequest(router, done, 500);
    });
  });
});
