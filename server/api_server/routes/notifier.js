const webSocketServer = require('ws').Server;
let wsServer = {
  clients: [],
};

function setup(port = 8889) {

  wsServer = new webSocketServer({ port });

  wsServer.on('connection', wsClient => {
    console.log('[Notifier] CLIENT CONNECTED');

    wsClient.on('message', message => {
      console.log(`[Notifier] received "${message}"`);
    });

    wsClient.on('close', function () {
      console.log('[Notifier] ********** CLIENT CLOSED **********');
    });

  });

  wsServer.on('error', (error) => {
    console.log('[Notifier]', error.message);
  });
}

function send(message) {
  wsServer.clients.forEach(client => {
    client.send(message);
  });
}

/**
 * Event notification to client
 * @param {string} type - resource name
 * @param {string} event - occurrence event
 * @param {object} details - detail informations
 */
function notify(type, event, details) {
  const message = JSON.stringify({ 'type': type, 'event': event, 'details': details });
  send(message);
}

module.exports.setup = setup;
module.exports.send = send;
module.exports.notify = notify;
