let Code = require('code');
let Hapi = require('hapi');

let co = require('co');

let expect = Code.expect;

describe('hapi-async-handler', function() {

  it('supports async functions', function(done) {
    let server = new Hapi.Server();
    server.connection();

    server.register(require('..'), function(error) {
      expect(error).not.to.exist();

      registerDefaultAsyncHandler(server, async function(request, reply) {
        let output = await Promise.resolve('hello world');
        reply(output);
      });

      server.inject('/', function(response) {
        expect(response.payload).to.equal('hello world');
        done();
      });
    });
  });

  it('supports co-wrapped generator functions', function(done) {
    let server = new Hapi.Server();
    server.connection();

    server.register(require('..'), function(error) {
      expect(error).not.to.exist();

      registerDefaultAsyncHandler(server, co.wrap(function*(request, reply) {
        let output = yield Promise.resolve('hello world');
        reply(output);
      }));

      server.inject('/', function(response) {
        expect(response.payload).to.equal('hello world');
        done();
      });
    });
  });

  it('logs unhandled errors', function(done) {
    let server = new Hapi.Server();
    server.connection();

    let requestError;
    server.on('request', function(request, event, tagMap) {
      requestError = event.data;
      expect(requestError.message).to.equal('intentional error');
      expect(event.tags).to.include(['error', 'uncaught']);
      done();
    });

    server.register(require('..'), function(error) {
      expect(error).not.to.exist();

      registerDefaultAsyncHandler(server, async function(request, reply) {
        throw new Error('intentional error');
      });

      server.inject('/', function(response) {
        expect(requestError).not.to.be.null();
      });
    });
  });

  it('sets `this` to the bound context', function(done) {
    let context = {};
    let server = new Hapi.Server();
    server.connection();
    server.bind(context);

    server.register(require('..'), function(error) {
      expect(error).not.to.exist();

      registerDefaultAsyncHandler(server, async function(request, reply) {
        expect(this).to.equal(context);
        reply('ok');
      });

      server.inject('/', function(response) {
        expect(response.result.error).not.to.exist();
        done();
      });
    });
  });

  it('sets `context` to the bound context', function(done) {
    // Create class
    class TestClass{
      constructor(options) {
        this.options = options
      }

      async handler(request, reply) {
        reply(this)
      }
    }
    // Instantiate the class with data
    const testClass = new TestClass('Some Options')
    let server = new Hapi.Server();
    server.connection();

    server.register(require('..'), function(error) {
      expect(error).not.to.exist();

      registerDefaultAsyncHandler(server, testClass.handler , testClass);

      server.inject('/', function(response) {
        expect(response.result.options).to.exist();
        expect(response.result.options).to.equal('Some Options');
        done();
      });
    });
  });

  function registerDefaultAsyncHandler(server, handler, context) {
    let handlerOptions = {
      async: handler
    }
    if (context) {
      handlerOptions = {
        async: {
          handler,
          context
        }
      }
    }
    server.route({
      method: 'GET',
      path: '/',
      handler: handlerOptions,
      config: {
        timeout: {
          server: 1000,
        },
      },
    });
  }
});
