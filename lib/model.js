/**
 * @copyright Philip Brown 2018
 * @author Philip Brown
 * @module model
 */

/**
 * Defines the configuration of every type of write to the server.
 *  Each key represents an object namespace in the Livewire control protocol
 *  Each key inside an object namespace represents the name of the method to create
 */
exports.objectMethods = {
    'cc': {
        studioList: {
            props: ['studio_list'],
            studioReq: false,
            cb: true
        },
        date: {
            props: ['date'],
            studioReq: false,
            cb: true
        },
        getServer: {
            props: ['server_id','server_version','server_caps','lwcp_version'],
            loginRequired: false,
            studioReq: false,
            cb: true
        },
        setMode: {
            op: 'set',
            studioReq: false,
            props: [
                { property: 'mode', value: {arg:0,type:'string',mod:'toUpperCase',name:'Mode',opts:['TALENT','PRODUCER'],default:'TALENT'} }
            ]
        },
        login: {
            op: 'login',
            props: [
                { property: 'user', value: {arg:0,key:'username',type:'string',name:'Username'} },
                { property: 'password', value: {arg:0,key:'password',type:'string',name:'Password'} }
            ],
            loginRequired: false,
            studioReq: false,
            cb: true
        },
        ping: {
            op: 'ping',
            studioReq: false,
            cb: true
        }
    },
    'studio': {
        getStudio: {
            props: ['id', 'name', 'show_id', 'show_name', 'num_lines', 'hybrid_list', 'num_hybrids', 'num_hyb_fixed', 'next', 'pnext', 'busy_all', 'mute', 'show_locked', 'auto_answer'],
            cb: true
        },
        showList: {
            props: ['show_list'],
            cb: true
        },
        lineList: {
            props: ['line_list'],
            cb: true
        },
        selectStudio: {
            op: 'select',
            props: [
                { property: 'id', value: {arg:0,name:'Studio ID',type:'number',min:0} }
            ],
            studioReq: false
        },
        selectShow: {
            op: 'select_show',
            props: [{
                property: 'id',
                valid: {arg:0,name:'Show',type:'number',min:0}
            }]
        },
        im: {
            op: 'im',
            props: [
                { property: 'from', value: {arg:0,name:'From User',type:'string'} },
                { property: 'message', value: {arg:1,name:'Message Text',type:'string'} }
            ]
        },
        setBusyAll: {
            op: 'busy_all',
            props: [
                { property: 'state', value: {arg:0,name:'All Busy State',type:'boolean',default:true}}
            ]
        },
        dropHybrid: {
            op: 'drop',
            props: [
                { property: 'hybrid', value: {arg:0,name:'Hybrid line ID',type:'number',min:0} }
            ]
        },
        holdHybrid: {
            op: 'hold',
            props: [
                { property: 'hybrid', value: {arg:0,name:'Hybrid line ID',type:'number',min:0} }
            ]
        }
    },
    'studio.line': {
        getLine: {
            id: {arg:0,name:'Line Number',type:'number',min:0},
            props: ['state','callstate','name','local','remote','hybrid','time','comment','direction','caller_id'],
            cb: true
        },
        getCallerId: {
            id: {arg:0,name:'Line Number',type:'number',min:0},
            props: ['caller_id'],
            cb: true
        },
        setLineComment: {
            op: 'set',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            lineState:{not:['IDLE']},
            props: [
                { property: 'comment', value: {arg:1,name:'Comment',type:'string'}}
            ]
        },
        setCallerId: {
            op: 'set',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            lineState:{not:['IDLE']},
            props: [
                { property: 'caller_id', value: {arg:1,name:'Caller ID',type:'string'}}
            ]
        },
        seizeLine: {
            op: 'seize',
            id: {arg:0,name:'Line Number',type:'number',min:0}
        },
        callLine: {
            op: 'call',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            props: [
                { property: 'number', value: {arg:1,key:'number',name:'Remote Number',type:'string',default:null} },
                { property: 'handset', value: {arg:1,key:'handset',name:'Handset ID',type:'string',default:null} },
                { property: 'hybrid', value: {arg:1,key:'hybrid',name:'Hybrid ID',type:'string',default:null} },
                { property: 'port', value: {arg:1,key:'port',name:'Port',type:'string',default:null} }
            ]
        },
        takeLine: {
            op: 'take',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            props: [
                { property: 'handset', value: {arg:1,key:'handset',name:'Handset ID',type:'string',default:null} },
                { property: 'hybrid', value: {arg:1,key:'hybrid',name:'Hybrid ID',type:'string',default:null} }
            ]
        },
        takeNext: {
            op: 'take'
        },
        dropLine: {
            op: 'drop',
            id: {arg:0,name:'Line Number',type:'number',min:0}
        },
        lockLine: {
            op: 'lock',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            lineState:{is:['ON_AIR']}
        },
        unlockLine: {
            op: 'unlock',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            lineState:{is:['ON_AIR_LOCKED']}
        },
        holdLine: {
            op: 'hold',
            id: {arg:0,name:'Line Number',type:'number',min:0},
            props: [
                { property: 'ready', value: {arg:1,name:'Ready State',type:'boolean',default:true} }
            ]
        },
        raiseLine: {
            op: 'raise',
            id: {arg:0,name:'Line Number',type:'number',min:0}
        }
    },
    'studio.book': {
        recordCount: {
            props: ['count'],
            cb:true
        },
        recordList: {
            props: [
                'list',
                { property: 'range', value: {arg: 0,name:'List Range',type:'Array.Number',length:2,default:null} }
            ],
            cb:true
        },
        addRecord: {
            op: 'add',
            props: [
                { property: 'type', value: {arg:0,key:'type',name:'Record Type',type:'string',mod:'toUpperCase',opts:['GLOBAL','STUDIO','SHOW'],default:null} },
                { property: 'name', value: {arg:0,key:'name',name:'Record Name',type:'string',default:null} },
                { property: 'number', value: {arg:0,key:'number',name:'Record Number',type:'string',default:null} }
            ]
        },
        updateRecord: {
            op: 'set',
            id: {arg:0,name:'Record Number',type:'number',min:0},
            props: [
                { property: 'type', value: {arg:1,key:'type',name:'Record Type',type:'string',mod:'toUpperCase',opts:['GLOBAL','STUDIO','SHOW'],default:null} },
                { property: 'name', value: {arg:1,key:'name',name:'Record Name',type:'string',default:null} },
                { property: 'number', value: {arg:1,key:'number',name:'Record Number',type:'string',default:null} }
            ]
        },
        deleteRecord: {
            op: 'del',
            id: {arg:0,name:'Record Number',type:'number',min:0}
        }
    },
    'studio.log': {
        logCount: {
            props: ['count'],
            expects: {
                'count': {name: 'logCount'}
            },
            cb:true
        },
        logList: {
            props: [
                'list',
                { property: 'range', value: {arg: 0,name:'List Range',type:'Array.Number',length:2,default:null} }
            ],
            expects: {
                'list': {name: 'logList', each: ['lineStartTime','lineDuration','lineDirection','lineLocal','lineRemote','lineCallerId']}
            },
            cb:true
        }
    },
}

/**
 * Mapping of expected return properties to what they should be called.
 *  the 'each' attribute represents turning an array return type into an object
 *  where each index becomes a key value pair where the key is defined by the 'each' indexes
 */
exports.responseProperties = {
    'studio_list': {name: 'studioList', each: ['studioId','studioName']},
    'server_id': {name: 'serverId'},
    'server_version': {name: 'serverVersion'},
    'server_caps': {name: 'serverCapabilites'},
    'lwcp_version': {name: 'lwcpVersion'},
    'id': {name: 'studioId'},
    'name': {name: 'studioName'},
    'show_id':{name: 'showId'},
    'show_name': {name: 'showName'},
    'num_lines':{name:'numberOfLines'},
    'hybrid_list':{name: 'hybridList'},
    'num_hybrids':{name: 'numberOfHybrids'},
    'num_hyb_fixed':{name: 'numberOfFixedHybrids'},
    'pnext': {name: 'producerNext'},
    'busy_all':{name: 'allBusy'},
    'mute': {name: 'muted'},
    'show_locked': {name: 'showLocked'},
    'auto_answer':{name: 'autoAnswerOn'},
    'show_list':{name: 'showList', each:['showId','showName']},
    'line_list': {name: 'lineList', each: ['lineState','callState','lineName','lineLocal','lineRemote','lineHybrid','lineTime','lineComment','lineDirection']},
    'state': {name: 'lineState'},
    'callstate': {name: 'callState'},
    'name': {name: 'lineName'},
    'local': {name: 'lineLocal'},
    'remote': {name: 'lineRemote'},
    'hybrid': {name: 'lineHybrid'},
    'time': {name: 'lineTime'},
    'comment': {name: 'lineComment'},
    'direction': {name: 'lineDirection'},
    'caller_id': {name: 'lineCallerId'},
    'count': {name: 'recordCount'},
    'list': {name: 'recordList', each: ['recordId','recordName','recordNumber']}
}