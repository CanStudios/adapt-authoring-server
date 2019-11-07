const { Hook } = require('adapt-authoring-core');
const Router = require('../lib/router');
const ServerModule = require('../lib/module');
const should = require('should');
const supertest = require('supertest');

describe('Server module', function() {
  before(function() {
    this.server = new ServerModule(global.ADAPT.app, { name: require('../package.json').name });
  });
  describe('#constructor()', function() {
    it('should expose a `root` Router', function() {
      this.server.root.should.be.an.instanceof(Router);
    });
    it('should expose an `api` Router', function() {
      this.server.api.should.be.an.instanceof(Router);
    });
    it('should expose a hook to modify requests', function() {
      this.server.requestHook.should.be.an.instanceof(Hook);
    });
    it('should expose Express.js App listen function', function() {
      this.server.listen.should.be.a.Function();
    });
    it('should expose Express.js App static function', function() {
      this.server.static.should.be.a.Function();
    });
  });
  describe('#url()', function() {
    it('should return the URL of the server', function() {
      this.server.url.should.be.a.String();
    });
  });
  describe('#boot()', function() {
    it('should accept requests on the specified URL/port', function(done) {
      this.server.preload(this.server.app, () => {
        this.server.boot(this.server.app, () => {
          supertest(this.server.expressApp)
            .get(`${this.server.api.path}`)
            .expect(200)
            .end(done);
        }, done);
      }, done);
    });
  });
  after(function(done) {
    this.server.close(done);
  });
});
