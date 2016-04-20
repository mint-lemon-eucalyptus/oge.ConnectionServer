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
    this.commands = {};
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
    var connectionsCounter = 0;
    self.wss = new WebSocketServer(options);

    self.wss.on('connection', function (ws) {
        ws.__id = ++connectionsCounter;
        ws.sendJson = function (a) {
            this.send(JSON.stringify(a));
        };
        self.emit('client', ws);    //генерируем событие с Connection
    });
    self.emit(self.EVENT_START_LISTENING);
};

ConnectionServer.prototype.EVENT_START_LISTENING = 'EVENT_START_LISTENING';

module.exports = ConnectionServer;
