const model = require('./model'),
    helper = require('./helper'),
    Connection = require('./connection'),
    EventEmitter = require('events');

class Client extends Connection{
    constructor(){
        this.__emitter = new EventEmitter();
        this.__connection = new Connection({online: this.onLine, emitter: this.__emitter});
    }
    loggedIn(){
        return this.__connection.__loggedIn;
    }
    studioSelected(){
        return this.__connection.__studioSelected;
    }
    async connect(host, port){
        return await this.__connection.connect(host, port);
    }
    write(msg){
        this.__connection.write(msg);
    }
}

function addClientMethods(){
    for(var obj in model){
        for(var method in model[obj]){
            Client.prototype[method] = helper.buildClientMethod(obj, model[obj][method]);
        }
    }
}

addClientMethods();
module.exports = Client;