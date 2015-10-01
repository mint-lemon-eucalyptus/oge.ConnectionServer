"use strict";
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var WS = require('ws');
var WebSocketServer = WS.Server;
var WsClient = require('../../oge/WsClient/index.js');
var helpers = require('./util/helpers.js')
var http = require('http');


var Server = WsClient.Server;
var User = WsClient.User;
var qw;

function ConnectionServer($config, Users, Qw) {
    qw = Qw.log(this);
    //todo this is network interface class
    var self = this;
    EventEmitter.call(this);

    this.wss = null;
    this.config = $config;
    this.commands = {
        auth: function (ws, msg) {
            self._authenticator.auth('token', msg.data, function (err, userProfile) {
                if (err) {
                    qw('authError'.red, err, msg);
                    ws.send(JSON.stringify({cmd: 'error', code: err.code}));
                    ws.close(1000);
                } else {
                    qw('userProfile from auth:', userProfile);
                    self.emit(self.EVENT_USER_AUTH_SUCCESS, new User(userProfile, ws));
                }
            });
        },
        auth_np: function (ws, msg) {
            if (!msg.data || !msg.data.name) {
                ws.close(1000);
                return;
            }
            msg.data.token = helpers.generateUid();
            self._authenticator.auth('local', msg.data, function (err, userProfile) {
                if (err) {
                    qw('authError'.red, err, msg);
                    ws.send(JSON.stringify({cmd: 'auth_e', code: err.code}));
                    ws.close(1000);
                } else {
                    qw('userProfile from auth:', userProfile);
                    self.emit(self.EVENT_USER_AUTH_SUCCESS, new User(userProfile, ws));
                }
            });
        },
        register: function (ws, msg) {
            qw(msg);
            var token = helpers.generateUid();
            Users.register({name: msg.name.trim(), pass: msg.pass, token: token, type: 0}, function (err, rs) {
                if (err) {
                    qw(err);
                    ws.send(JSON.stringify({cmd: 'reg_fail', code: err.code}));
                } else {
                    ws.send(JSON.stringify({cmd: 'reg_ok', profile: rs[0]}));
                }
                ws.close(1000);
            });
        },
        slave_auth_ack: function (ws, msg) {        //slave auth request
            self._authenticator.auth('servertoken', msg.data, function (err, clientProfile) {
                qw('_serversAuthenticator.auth', err, clientProfile)
                if (err) {
                    qw('authError'.red, err, msg);
                    ws.send(JSON.stringify({cmd: 'auth_error', code: err}));
                    ws.close(1000);
                } else {
                    self.emit(self.EVENT_SERVER_AUTH_SUCCESS, new Server(clientProfile, ws));
                }
            });
        }
    };
}
util.inherits(ConnectionServer, EventEmitter);
ConnectionServer.prototype.useAuthMiddleWare = function (auth) {
    this._authenticator = auth;
}
ConnectionServer.prototype.start = function (expressApp) {
    var self = this;
    var host = self.config.host, port = self.config.port;
    qw('starting at', port, host)
    if (expressApp) {
        //use express app as server
        var server = http.createServer(expressApp);

        server.listen(port, host, function () {
            qw(' Server is listening on port ', port);
        });
        self.wss = new WebSocketServer({
            server: server,
            autoAcceptConnections: false, clientTracking: false
        });
    } else {
        self.wss = new WebSocketServer({
            autoAcceptConnections: false,
            port: port, clientTracking: false, host: host
        });
    }

    self.wss.on('connection', function (ws) {
        qw('new connection');
        ws.once('message', function (message) {
            var msg;
//            qw('WS message:', message)
            try {
                msg = JSON.parse(message);
            } catch (e) {
                self.emit(self.EVENT_LOG, 'parseError: "' + message + '"');
                ws.close(1000);
                return;
            }
            if (typeof self.commands[msg.cmd] == 'function') {
                self.commands[msg.cmd](ws, msg);
            } else {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({cmd: 'error', code: 'auth protocol mismatch', notice: msg.cmd}));
                }
                ws.close(1000);
            }
        });
    });
    self.emit(self.EVENT_START_LISTENING);
};

ConnectionServer.prototype.EVENT_START_LISTENING = 'EVENT_START_LISTENING';

ConnectionServer.prototype.EVENT_LOG = 'EVENT_LOG';

ConnectionServer.prototype.EVENT_USER_AUTH_SUCCESS = 'EVENT_USER_AUTH_SUCCESS';

//fired if slave is authenticated successful

ConnectionServer.prototype.EVENT_SERVER_AUTH_SUCCESS = 'EVENT_SERVER_AUTH_SUCCESS';

module.exports = ConnectionServer;
