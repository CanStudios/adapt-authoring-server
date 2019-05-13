const Api = require('./api');
const express = require('express');
const path = require('path');
const { Module, Responder, Utils } = require('adapt-authoring-core');
const auth = require('adapt-authoring-auth');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const Logger = require('adapt-authoring-logger');
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
      this.router.use(f);
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
      this.log('debug', f.name);
      this.__apiMiddleware.push(f);
      this.apiRouter.use(f);
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
    this.use(cookieParser('prototype-secret'));
    this.use(bodyParser.json({ limit: '5mb' }));
    this.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    this.use('/css',express.static(path.join(__dirname, 'public')));
    this.use( function(req, res, next) {
      Logger.log('info', req.originalUrl)
      /*if (req.originalUrl && req.originalUrl.split("/").pop() === 'prototype.css') {
        Logger.log('info', 'blocked prototype css');
        return res.sendStatus(204);
      }*/

      return next();
    });
    this.use(session({
        key: 'connect.sid',
        secret:'prototype-secret',
        resave: false,
        cookie: {
            signed: true,
            secureProxy: false
        },
        saveUninitialized: true
    }));
    this.use(auth.initialize());
    this.use(auth.session());
    this.use('/', this.router);
    this.router.use('/api', this.apiRouter);

    this.apiRouter.get('/', (req, res, next) => res.status(200).json(this.generateApiMap(req)));

    this.listen(this.config.SERVER_PORT, () => {
      this.apiRouter.use(this.handleApiError.bind(this));
      this.router.use(this.handleUncaughtError.bind(this));
      this.log('info', `listening on ${this.config.port}`);
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
