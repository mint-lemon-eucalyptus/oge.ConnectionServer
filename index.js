"use strict";
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var WS = require('ws');
var WebSocketServer = WS.Server;
var http = require('http');

var qw;

function ConnectionServer($config, Qw) {
    qw = Qw.log(this);
    //todo this is network interface class
    EventEmitter.call(this);

    this.wss = null;
    this.config = $config;
    this.commands = {    };
}
util.inherits(ConnectionServer, EventEmitter);

ConnectionServer.prototype.start = function (expressApp) {
    var self = this;
    var host = self.config.host, port = self.config.port;
    qw('starting at', port, host);
    var options = {autoAcceptConnections: false, clientTracking: false};
    if (expressApp) {
        //use express app as server
        var server = http.createServer(expressApp);

        server.listen(port, host, function () {
            qw(' Server is listening on port ', port);
        });
        options.server = server;
    } else {
        options.host = host;
        options.port = port;
    }
    self.wss = new WebSocketServer(options);

    self.wss.on('connection', function (ws) {
        self.emit('client', new Client(ws));
    });
    self.emit(self.EVENT_START_LISTENING);
};

ConnectionServer.prototype.addCommand = function (name, fn) {
    if (typeof  fn !== "function") {
        throw Error('command must be a function');
    }
    if (typeof  name !== "string") {
        throw Error('command name must be a string');
    }
    this.commands[name] = fn;
};

ConnectionServer.prototype.EVENT_START_LISTENING = 'EVENT_START_LISTENING';


/**
 * client profile
 * @typedef {Object} Profile
 * @property {Number} id
 * @property {String} name
 * @property {String} token
 * @property {String} dtreg
 * @property {String} lastdt
 * @property {String} avatar
 * @property {Number} currency1
 * @property {Number} currency2
 */
/**
 * websocket client entity. Used as connection wrapper and client profile holder
 * @typedef {Object} Client
 * @property {WebSocket} connection
 * @property {Profile} profile
 */
function Client(conn, profile) {
    this.profile = profile || {};
    this.connection = conn;
}
Client.prototype.close = function (code) {
    this.connection && this.connection.close(code);
}
/**
 @static
 @type {number}
 @const
 */
Client.CONNECTING = 0;
/**
 @static
 @type {number}
 @const
 */
Client.OPEN = 1;
/**
 @static
 @type {number}
 @const
 */
Client.CLOSING = 2;
/**
 @static
 @type {number}
 @const
 */
Client.CLOSED = 3;
Client.prototype.send = function (js) {
    if (this.connection.readyState == 1) {
        this.connection.send(JSON.stringify(js));
    } else {    //connection is in state CLOSING
//        console.log(this.profile.id, 'connection', this.connection.readyState,js);
        this.connection.close(1000)
    }
};

module.exports = ConnectionServer;
