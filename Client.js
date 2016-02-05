/**
 * Created by user00 on 2/3/16.
 */
var util = require('util');
var EventEmitter = require('events').EventEmitter;


/**
 * client profile
 * @typedef {Object} Profile
 * @property {Number} id
 * @property {String} name
 * @property {String} token
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
    this.__requestIDCounter = 0;
    this.callbacks = {};
    var self = this;
    var socket = this.connection;
    socket.once('close', onClose);
    socket.once('error', onError);
    socket.on('message', onMessage);


    /**
     * socket close event handler
     * @function
     * @context WebSocket
     * @param {Number} code
     */
    function onClose(code) {
        //соединение разорвал клиент
        //отписываемся от событий сокета и генерируем событие, чтобы уведомить протоколы или комнаты
        this.removeListener('message', onMessage);
        this.removeListener('error', onError);
        self.emit('dead');
        //от событий клиента каждый протокол и комната отписываются сами

        //      console.log('Client onClose events ', self.connection._events,self._events)
        self.__execCallbacksWithError(code);
    }

    /**
     * socket error event handler
     * @function
     * @context WebSocket
     * @param {Object} err error message object
     */
    function onError(err) {
        //соединение разорвал клиент
        this.removeListener('close', onClose);
        this.removeListener('message', onMessage);
        self.emit('dead');
        self.__execCallbacksWithError(err);
    }

    /**
     * incoming socket data handler
     * @function
     * @context WebSocket
     * @param {String} message
     */
    function onMessage(message) {
        var msg;
        try {
            msg = JSON.parse(message);
        } catch
            (e) {
            this.close(1000);
            return;
        }

        //сначала проверим, является ли сообщение ответом на наш запрос(есть ли поле __)
        var __ = msg.__;
        if (!!__) {
            //если есть id - это значит что команда является либо ответом, либо запросом с другой стороны, на который надо обязательно ответить
            //тип команды(запрос или ответ) смотрим по полю __t=q   q - запрос с сервера клиенту
            //если указан ид команды но нет ее типа, это означает что команда - ответ c другой стороны
            console.log('__', __)
            if (!msg.__t) {  //это был ответ и на нее отвечать не надо, просто поищем коллбек и выполним
                var cb = self.callbacks[__];

                if (cb != null) {
                    cb(null, msg);
                    delete self.callbacks[__];   //обязательно убираем отработавший коллбек
                }
            } else {
                //это запрос с другой стороны (инициатива сервера), требующая обязательного ответа, обрабатывает протокол
                self.emit('json', msg);
            }

        } else {
            // это просто команда, не требующая коллбека, её обработает протокол(например, это оповещение о том, что вынут очередной бочонок)
            self.emit('json', msg);
        }
    }


}
util.inherits(Client, EventEmitter);

Client.prototype.__execCallbacksWithError = function (code) {
    //завершаем все коллбеки и чистим их
    for (var i in this.callbacks) {
        this.callbacks[i](code, null);
        delete this.callbacks[i];
    }
}
Client.prototype.close = function (code) {
    this.connection && this.connection.close(code);
    this.__execCallbacksWithError(code);
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
Client.prototype.send = function (js, cb) {
    if (this.connection.readyState === Client.OPEN) {
        if (typeof cb === "function") {
            js.__ = ++this.__requestIDCounter;
            js.__t = 'q';
            this.callbacks[js.__] = cb;
        }
        this.connection.send(JSON.stringify(js));
    } else {    //connection is in state CLOSING
//        console.log(this.profile.id, 'connection', this.connection.readyState,js);
        //       this.connection.close(1000)
        if (typeof cb === "function") {
            cb(this.connection.readyState);
        }
    }
};
module.exports = Client;