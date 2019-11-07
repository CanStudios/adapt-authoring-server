/**
* This file exists to define the below types for documentation purposes.
*/
/**
* Defines how an individual API route should be handled
* @typedef {Object} Route
* @property {String} route The name of the api (this will be used as the API endpoint)
* @property {Object} handlers Object mapping HTTP methods to request handler functions. _**Note**: Any HTTP methods not specified in `handlers` will not be exposed._
* @property {Array<Function>|Function} [handlers.post] POST handlers for the route
* @property {Array<Function>|Function} [handlers.get] GET handlers for the route
* @property {Array<Function>|Function} [handlers.put] PUT handlers for the route
* @property {Array<Function>|Function} [handlers.delete] DELETE handlers for the route
* @example
* {
*   route: '/:id?',
*   handlers: {
*     // can be an array of middleware/handlers
*     post: [beforePost, handlePostRequest, afterPost],
*     // or an individual function
*     get: getRequest,
*     put: putRequest,
*     // or an in-line function
*     delete: (req, res, next) => { next(); }
*   }
* }
*/
