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
        qw('new connection');
        ws.sendJSON = function (a) {
            ws.send(JSON.stringify(a));
        };
        ws.once('message', function (message) {
            var msg;
//            qw('WS message:', message)
            try {
                msg = JSON.parse(message);
            } catch (e) {
                ws.close(1000);
                return;
            }
            if (typeof self.commands[msg.cmd] == 'function') {
                self.commands[msg.cmd](ws, msg);
            } else {
                if (ws.readyState === 1) {
                    ws.sendJSON({cmd: 'error', code: 'auth protocol mismatch', notice: msg.cmd});
                }
                ws.close(1000);
            }
        });
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

ConnectionServer.prototype.initUserSocket = function (profile, conn) {
    return new User(profile, conn);
}
ConnectionServer.prototype.initServerSocket = function (profile, conn) {
    return new ServerClient(profile, conn);
}

ConnectionServer.prototype.EVENT_START_LISTENING = 'EVENT_START_LISTENING';


function Client() {
}

Client.prototype.send = function (js) {
    if (this.connection.readyState == 1) {
        this.connection.send(JSON.stringify(js));
    } else {
        console.log(this.profile.id, 'connection', this.connection.readyState);
        throw new Error('socket hang up')
    }
};

function User(profile, conn) {
    User.super_.call(this);
    this.profile = profile;
    this.connection = conn;
    var self = this;
    self.connection.on('error', function (code) {
        self.connection.close(code);
    });
}
util.inherits(User, Client);
User.prototype.getPublicFields = function () {
    return {
        id: this.profile.id,
        name: this.profile.name,
        dtreg: this.profile.dtreg,
        currency1: this.profile.currency1,
        currency2: this.profile.currency2,
        lastdt: this.profile.lastdt,
        avatar: this.profile.avatar
    };
};


function ServerClient(profile, conn) {
    ServerClient.super_.call(this);
    this.profile = profile;//here token and path
    this.connection = conn;//here websocket object
}
util.inherits(ServerClient, Client);

ServerClient.prototype.getPublicFields = function () {
    return this.profile;
};

module.exports = ConnectionServer;
