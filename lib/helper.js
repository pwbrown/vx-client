const tc = require('type-check').typeCheck,
    lwcp = require('lwcp');

exports.buildClientMethod = function(obj, config){
    return function(){
        var args = arguments;
        return new Promise(async resolve => {
            //Generate components of the server request
            var operation = tc('String', config.op) && config.op !== ''? config.op : 'get';
            var object = obj;
            var loginRequired = tc('Boolean', config.loginRequired)? config.loginRequired : true;
            var studioRequired = tc('Boolean', config.studioReq)? config.studioReq : true;
            if(loginRequired && !this.loggedIn())
                return resolve({err: "This command requires authentication. Login first!", data: null});
            if(studioRequired && !this.studioSelected())
                return resolve({err: "This command requires a selected studio. Select a studio first", data: null});
            try{
                var subobjectId = await getSubobjectId(args, config.id);
                var {propString, condensed} = await getProps(args, config.props);
                var request = `${operation} ${object}${subobjectId? '#'+subobjectId.trim():''}${propString}`
                if(config.cb){
                    if(config.op && config.op === 'login')
                        var key = 'loggedIn';
                    else
                        var key = uniqueKey(lwcp.parse(request, true));
                    this.__emitter.once(key, (data) => {
                        return resolve({err: null, data: data});
                    })
                    this.write(request);
                }else{
                    this.write(request);
                    return resolve({err: null, data: null});
                }
            }catch(err){
                return resolve({err: err, data: null})
            }
        })
    }
}

var uniqueKey = exports.uniqueKey = function(config){
    var key = "";
    key += config.obj || "";
    key += config.sub || "";
    key += config.id || "";
    if(config.props){
        for(var propName in config.props){
            key += propName;
        }
    }
    return key;
}

async function getSubobjectId(args, id){
    return new Promise(async (resolve, reject) => {
        if(tc('Undefined', id))
            return resolve(null);
        if(tc('String', id) && id !== '')
            return resolve(id);
        if(tc('Object', id)){
            try{
                var idVal = await getPropArgValue(args, id)
                return resolve(idVal);
            }catch(err){
                return reject(err);
            }
        }
    })
}

function getProps(args, props){
    return new Promise(async (resolve, reject) => {
        if(!tc('Array', props)) return '';
        var propString = '';
        var condensed = '';
        for(var i = 0; i < props.length; i++){
            var append = null;
            if(tc('String', props[i]) && props[i] !== '')
                append = props[i];
            else if(tc('Object', props[i]) && tc('String', props[i].property) && props[i].property !== ''){
                var name = props[i].property;
                if(tc("Undefined", props[i].value))
                    append = name;
                else if(!tc('Object', props[i].value) || props[i].value === null){
                    var value = stringifyPropValue(props[i].value);
                    append = `${name}=${value}`;
                }else if(tc('Object',props[i].value) && !tc("Number", props[i].value.length)){
                    try{
                        var value = await getPropArgValue(args, props[i].value);
                        append = `${name}=${value}`;
                    }catch(err){
                        return reject(err)
                    }
                }
            }
            if(append){
                propString += `${propString === ''? ' ' : ', '}${append}`;
                condensed += append.replace(/\=.*/,'');
            }
        }
        return resolve({propString: propString, condensed: condensed});
    })
}

function getPropArgValue(args, config){
    return new Promise((resolve, reject) => {
        var name = config.name || "UNKNOWN";
        if(!tc('Number', config.arg))
            return reject(`ERROR -> PARSING PROP MODEL -> MISSING "arg" VALUE -> property: "${name}"`);
        var pos = Math.floor(config.arg);
        if(pos < 0)
            return reject(`ERROR -> PARSING PROP MODEL -> Invalid "arg" VALUE -> property: "${name}"`);
        if(tc('Undefined', args[pos]))
                return checkForDefault(`ERROR -> MISSING ARGUMENT "${name}" at position ${pos}`,config,resolve,reject);
        var argValue = args[pos];
        if(tc('String', config.type) && !tc(config.type, argValue))
            return checkForDefault(`ERROR -> INVALID ARGUMENT "${name}" at position ${pos} -> Expected argument to be of type "${config.type}"`,config,resolve,reject);
        if(tc('Number', argValue) && tc('Number', config.min) && argValue < config.min)
            return checkForDefault(`ERROR -> INVALID ARGUMENT "${name}" at position ${pos} -> The minimum value is ${config.min}`,config.resolve,reject);
        if(tc('Number', argValue) && tc('Number', config.max) && argValue > config.max)
            return checkForDefault(`ERROR -> INVALID ARGUMENT "${name}" at position ${pos} -> The maximum value is ${config.max}`,config,resolve,reject);
        if(tc('String', argValue) && tc('String', config.mod) && tc('Function', argValue[config.mod]))
            argValue = argValue[config.mod];
        return resolve(stringifyPropValue(argValue));
    })
}

function checkForDefault(error, config, resolve, reject){
    if(tc('Undefined', config.default))
        return reject(error);
    return resolve(stringifyPropValue(config.default));
}

function stringifyPropValue(value){
    if(tc('String', value))
        return `"${value}"`;
    if(tc('Boolean', value))
        return value? "TRUE" : "FALSE";
    if(tc('Number', value))
        return `${value}`;
    if(tc('Object', value) && value === null)
        return `NULL`;
    return '';
}