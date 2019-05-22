const Api = require('./api');
const express = require('express');
const path = require('path');
const { Module, Responder, Utils } = require('adapt-authoring-core');
/**
* Adds an Express server to the authoring tool
* @extends {Module}
*/
// TODO create router class
// TODO add proper way for modules to handle errors
class Server extends Module {
  /**
  * @constructor
  * @param {App} app The main application instance
  * @param {Object} config Module config
  */
  constructor(app, config) {
    super(app, config);
    /**@ignore*/ this.__middleware = [];
    /**@ignore*/ this.__apiMiddleware = [];
    /**@ignore*/ this.__authMiddleware = [];
    /**@ignore*/ this.__apis = [];
    /**@ignore*/ this.router = express.Router();
    /**@ignore*/ this.apiRouter = express.Router();

    const expressApp = express();

    this.setDefaults(expressApp);
    this.setShortcuts(expressApp);
  }
  /**
  * Sets default values on the Express server
  * @param {express~App} expressApp Reference to the express application
  */
  setDefaults(expressApp) {
    expressApp.set('view engine', 'hbs');
    expressApp.set('x-powered-by', false);
  }
  /**
  * Adds some shortcuts to Express functions
  * @param {express~App} expressApp Reference to the express application
  */
  setShortcuts(expressApp) {
    /**
    * Add middleware to the Express server stack (shortcut to the Express function of the same name).
    * @type {Function}
    * @see https://expressjs.com/en/4x/api.html#app.use
    * @param {express.Router} router A Router instance
    */
    this.use = expressApp.use.bind(expressApp);
    /**
    * Middleware function to allow serving of static files
    * @type {Function}
    * @see https://expressjs.com/en/4x/api.html#express.static
    * @param {String} root The root directory from which to serve static assets
    * @param {Object} options Options to pass to the function
    * @return {Function}
    */
    this.static = express.static;
    /**
    * Start the Express server (shortcut to the Express function of the same name).
    * @type {Function}
    * @see https://expressjs.com/en/4x/api.html#app.listen
    * @param {number} port The port to listen on.
    * @param {function} func Callback function to be called on connection.
    */
    this.listen = expressApp.listen.bind(expressApp);
  }
  /**
  * Adds middleware to the main server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {...function} func Callback function(s) to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addMiddleware(...func) {
    if(this.hasBooted) {
      this.log('debug', 'Server has already booted, middleware may not be called before any route handlers');
    }
    func.forEach(f => {
      if(typeof f !== 'function') {
        return;
      }
      this.__middleware.push(f);
    });
  }
  /**
  * Adds middleware to the api server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
  * @param {...function} func Callback function(s) to be called on request.
  * @see https://expressjs.com/en/guide/writing-middleware.html
  */
  addApiMiddleware(...func) {
    if(this.hasBooted) {
      this.log('debug', 'Server has already booted, middleware may not be called before any route handlers');
    }
    func.forEach(f => {
      if(typeof f !== 'function') {
        return;
      }
      this.__apiMiddleware.push(f);
    });
  }
  /**
   * Adds auth middleware to the api server. You should call this function prior to server boot (i.e. during preload), so you can be sure your middleware runs before any queued routers.
   * @param {...function} func Callback function(s) to be called on request.
   * @see https://expressjs.com/en/guide/writing-middleware.html
   */
  addAuthMiddleware(...func) {
      if(this.hasBooted) {
          this.log('debug', 'Server has already booted, auth middleware may not be called before any route handlers');
      }
      func.forEach(f => {
          if(typeof f !== 'function') {
              return;
          }
          this.__authMiddleware.push(f);
      });
  }
  /**
  * Creates and adds a sub-router to the main server.
  * @param {string} route The route to listen on
  * @param {boolean} isApi whether the router should be treated as an API
  * @return {express~Router} The new router instance
  */
  createRouter(route, isApi=false) {
    if(this.hasBooted) {
      return this.log('error', 'must call createRouter before server boot');
    }
    const router = express.Router();

    ((isApi) ? this.apiRouter : this.router).use(route, router);
    this.log('debug', `added${isApi ? ' API ' : ' '}router at ${route}`);

    return router;
  }
  /**
  * Creates a new API for use with the server
  * @param {string} route The route to listen on
  * @return {Api} The API
  */
  createApi(route) {
    if(route[0] !== '/') { // make sure route starts with a slash
      route = `/${route}`;
    }
    const api = new Api(route, this.createRouter(route, true));
    this.__apis.push(api);

    return api;
  }
  /**
  * Starts the server
  * @param {Module} app App instance
  * @param {Function} resolve Function to call on fulfilment
  * @param {Function} reject Function to call on rejection
  */
  boot(app, resolve, reject) {
    this.log('debug', 'booting');
    this.__middleware.forEach(f => {
        this.router.use(f);
    });
    this.__authMiddleware.forEach(f => {
        this.log('debug', 'addingAuthMiddleware');
        f();
    });
    this.__apiMiddleware.forEach(f => {
        this.apiRouter.use(f);
        this.log('debug', 'adding middleware api')
    });
    this.log('debug', 'going to setup router');
    this.use('/', this.router);
    this.router.use('/api', this.apiRouter);

    this.apiRouter.get('/', (req, res, next) => res.status(200).json(this.generateApiMap(req)));

    this.listen(this.config.aat_server_port, () => {
      this.apiRouter.use(this.handleApiError.bind(this));
      this.router.use(this.handleUncaughtError.bind(this));
      this.log('info', `listening on ${this.config.aat_server_port}`);
      this.log('info', `app available at ${this.config.aat_server_host}:${this.config.aat_server_port}`);
      resolve();
    });
  }
  /**
  * Generates a map of the API endpoints for consumers
  * @param {ClientRequest} req Request object
  * @return {Object} Map of API endpoints
  */
  generateApiMap(req) {
    return this.__apis.reduce((memo, r) => {
      const id = `${r.route.replace('/','')}_url`;
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}${r.route.slice(1)}`;
      memo[id] = url;
      return memo;
    }, {});
  }
  /**
  * Handles any API-level errors not handled by other modules or middleware
  * @param {Error} error The error
  * @param {ClientRequest} req The client request object
  * @param {ServerResponse} res The server response object
  * @param {function} next The next middleware function in the stack
  */
  handleApiError(error, req, res, next) {
    this.log('error', `API error from route '${req.url}', ${error.message || error}`);
    if(error.stack) this.log('debug', error.stack);
    new Responder(res).error(error);
  }
  /**
  * Handles any uncaught non-API errors
  * @param {Error} error The error
  * @param {ClientRequest} req The client request object
  * @param {ServerResponse} res The server response object
  * @param {function} next The next middleware function in the stack
  */
  handleUncaughtError(error, req, res, next) {
    this.log('error', `uncaught error thrown from route '${req.url}', ${error.message || error}`);
    if(error.stack) this.log('debug', error.stack);
    this.emit('error', { req: req, error: error });
  }
}

module.exports = Server;
