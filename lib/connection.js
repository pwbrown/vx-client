/**
 * @copyright Philip Brown 2018
 * @author Philip Brown
 * @module connection
 */

/** DEPENDENCIES */
const net = require('net'),
    rl = require('readline');

/**
 * @class
 * @classdesc Handles client TCP socket layer connection with Telos VX VoIP Server
 */
module.exports = class Connection{
    /**
     * Sets up an instance of the Connection handler
     * @param {?Object} options
     * @param {?Number} options.ping=10000 The interval in milliseconds to ping the connection
     * @param {?Function} options.online Callback to receive socket data line per line
     * @param {?Function} options.onconnect Callback fired when the socket connects
     * @param {?Function} options.onerror Callback fired when a socket error occurs
     */
    constructor(options){
        this.initialize(options);
        this.setListeners();
        this.rl = rl.createInterface({
            input: this.socket,
            terminal: true
        });
        this.rl.on('line', this.onLine.bind(this))
    }
    /**
     * Establishes a TCP socket layer connection with a Telos VX server
     * @param {!String} host Represents the address of the Telos VX Server
     * @param {!Number} port Represets the port number of the Telos VX Server
     * @async
     */
    connect(host, port){
        return new Promise(async resolve => {
            if(typeof host === 'string' && host !== '' && typeof port === 'number'){
                this.__host = host.toLowerCase();
                this.__port = port;
                this.socket.connect(this.__port, this.__host);
                this.resetTimeout();
                this.timeout = setTimeout(() => {
                    this.socket.destroy();
                    return resolve("Failed to connect");
                }, 5000);
            }else{
                return resolve("Missing host or port.");
            }
        })
    }
    /**
     * Called by the readline interface to check if a
     *  line callback has been set before relaying data.
     * @param {!String} line 
     */
    onLine(line){
        if(typeof this.__lineCallback === 'function')
            this.__lineCallback(line);
    }
    /**
     * Sends data to the TCP server
     * @param {!String} data String of data to send to the TCP server
     */
    write(data){
        if(typeof data === 'string' && data !== '')
            this.socket.write(data);
    }
    /**
     * Called by the socket layer to check if a 
     *  error callback has been set before relaying an error.
     * @param {(Object|String)} err Error returned from the socket. 
     */
    connectionError(err){
        if(typeof this.__errorCallback === 'function')
            this.__errorCallback();
    }
    /**
     * Called by the socket layer to check if a 
     *   connect callback has been set before relaying the status.
     */
    connectionSuccess(){
        this.resetTimeout();
        if(typeof this.__connectCallback === 'function')
            this.__connectCallback();
    }
    /**
     * Resets the connection timeout
     */
    resetTimeout(){
        if(this.timeout){
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
    /**
     * This method obsfugates initializing the instance the shorten the length
     *  of the constructor (called by the constructor)
     * @param {?Object} options Replica of the constructor options
     */
    initialize(options){
        this.__port = null;
        this.__host = null;
        this.__ping = 10000;
        this.timeout = null;
        this.socket = new net.Socket();
        this.socket.setEncoding('utf8');
        if(typeof options === 'object'){
            if(typeof options.ping === 'number' && options.ping > 1000)
                this.__ping = options.ping;
            if(typeof options.online === 'function')
                this.__lineCallback = options.online;
            if(typeof options.onconnect === 'function')
                this.__connectCallback = options.onconnect;
            if(typeof options.onerror === 'function')
                this.__errorCallback = options.onerror;
        }
    }
    /**
     * Called by the constructor to initialize basic socket listeners
     */
    setListeners(){
        this.socket.on('connect', this.connectionSuccess.bind(this));
        this.socket.on('error', this.connectionError.bind(this));
    }
}