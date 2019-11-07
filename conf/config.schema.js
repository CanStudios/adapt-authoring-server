module.exports = {
  definition: {
    host: {
      type: 'String',
      required: true,
      description: 'Name of the host machine the server is running from'
    },
    port: {
      type: 'Number',
      required: true,
      description: 'Port to be used for listening to incoming connections'
    },
    url: {
      type: 'String',
      required: true,
      description: 'URL the server can be accessed from'
    },
    logStackOnError: {
      type: 'Boolean',
      default: false,
      description: 'Will log a stack trace when an error occurs'
    }
  }
};
