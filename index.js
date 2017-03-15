var net = require('net');
var helper = require('./helper');

var vxClient = module.exports = function(configuration){
	this.socket = new net.Socket();
	this.socket.setEncoding('utf8');
	//TCP socket connection status
	this.connected = true;
	//System authentication status
	this.loggedIn = true;
	//GET operation callback register
	this.cbRegister = {};
	//Listener register
	this.listenerRegister = {};
	//Debug console statements
	if(configuration && configuration.debug) this.debug = configuration.debug;
	else this.debug = 0;
	this.connectCallback = null;
	//Holds current state of the system
	this.state = {};
	this.socket.on('error', function(err){
		if(typeof this.connectCallback == 'function'){
			this.connectCallback(err, false);
			this.connectCallback = null;
		}else{
			//debugger;
		}
	}.bind(this));
	this.socket.on('data', function(data){
		this.consoleLog(2, "INCOMING: "+data);
		this.onData(data);
	}.bind(this));
}

//MAIN USER METHODS--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.connect = function(options, cb){
	this.connectCallback = cb;
	if(typeof options.host !== 'undefined' && typeof options.port !== 'undefined'){
		this.socket.connect(options.port, options.host, function(){
			this.consoleLog(2, "SOCKET: Connection Established");
			this.connected = true;
			cb(null, true);
			this.connectCallback = null;
		}.bind(this));
	}else{
		this.consoleLog(1,"ERROR: connect method requires \"host\" and \"port\" options");
		cb("ERROR: connect method requires \"host\" and \"port\" options", false);
	}
}
//MAIN USER METHODS--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//MAIN INTERNAL METHODS--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.request = function(options){
	if(!this.connected){
		if(options.cb) options.cb("ERROR: request cannot be made until TCP connection has been established", null);
		this.consoleLog(1,"ERROR: request cannot be made until TCP connection has been established");
		return;
	}
	if(!this.loggedIn && !options.loginNotRequired){
		if(options.cb) options.cb("ERROR: this method requires the client to be logged into the tellos vx system", null);
		this.consoleLog("ERROR: this method requires the client to be logged into the tellos vx system");
		return;
	}
	var data = helper.lwcpGenerate(JSON.parse(JSON.stringify(options)));
	var uniqKey = helper.uniqueKey(JSON.parse(JSON.stringify(options)));
	if(options.cb){
		var record = {cb: options.cb};
		if(typeof options.expects == 'object') record.expects = options.expects;
		if(options.operation && options.operation == 'ping')
			this.cbRegister['pong'] = {cb:options.cb};
		else if(options.operation && options.operation == 'login')
			this.cbRegister['login'] = {cb:options.cb};
		else
			this.cbRegister[uniqKey] = record;
	}
	this.socket.write(data + "\n");
	//debugger;
	this.consoleLog(2, "OUTGOING: " + data);
	return;
}

vxClient.prototype.onData = function(data){
	data = data.trim();
	var multipleLines = data.split("\r\n");
	if(typeof multipleLines == 'object' && typeof multipleLines.length !== 'undefined' && multipleLines.length == 1){
		data = multipleLines[0];
		var lwcp = helper.lwcpParse(data);
		var uniqKey = helper.uniqueKey(JSON.parse(JSON.stringify(lwcp)));
		if(lwcp.operation == 'pong' && typeof this.cbRegister.pong !== 'undefined' && typeof this.cbRegister.pong.cb == 'function'){
			this.cbRegister.pong.cb();
		}else if(lwcp.operation == 'indi' && typeof this.cbRegister[uniqKey] !== 'undefined'){
			var modifiedResults = helper.modifyResults(lwcp.properties || [], this.cbRegister[uniqKey].expects || {});
			if(typeof this.cbRegister[uniqKey].cb == 'function'){
				this.cbRegister[uniqKey].cb(null,modifiedResults);
			}
		}else if(lwcp.operation == 'ack'){
			var modifiedResults = helper.modifyResults(lwcp.properties || [], helper.expects.ack);
			if(lwcp.object == 'cc' && typeof modifiedResults.loggedIn == 'boolean'){
				this.loggedIn = modifiedResults.loggedIn;
				if(typeof this.cbRegister.login !== 'undefined' && typeof this.cbRegister.login.cb == 'function')
					this.cbRegister.login.cb(null, modifiedResults.loggedIn);
			}
		}else if(lwcp.operation == 'event' || lwcp.operation == 'update'){
			this.handleEvent(lwcp);
		}
	}else if(typeof multipleLines == 'object' && typeof multipleLines.length !== 'undefined' && multipleLines.length > 1){  //When the input stream is composed of multiple lines of data
		for(var i = 0; i < multipleLines.length; i++){
			this.onData(multipleLines[i]);
		}
	}
}

vxClient.prototype.handleEvent = function(data){
	if(data.object == 'studio' && data.subObject == null){
		this.handleStudioEvent(data);
	}else if(data.object == 'studio' && data.subObject !== null && data.subObject == 'line' && data.subObjectId !== null){
		this.handleLineEvent(data);
	}else if(data.object == 'studio' && data.subObject !== null && data.subObject == 'book'){
		this.handleBookEvent(data);
	}
}

vxClient.prototype.handleStudioEvent = function(data){
	var results = helper.modifyResults(data.properties || [], helper.expects.studio);
	//HANDLE STUDIO CHANGE
	if(typeof results.studioId !== 'undefined'){
		if(typeof this.state.currentStudio == 'undefined' || this.state.currentStudio !== results.studioId){
			this.state.currentStudio = {id: results.studioId, name: results.studioName || ""};
			this.state.studio = {};
			this.state.lines = {};
			this.state.hybrids = {};
			this.state.book = {};
			this.emit('studioChange', {data: this.state.currentStudio});
		}
	}
	//HANDLE IM MESSAGE
	if(typeof results.from !== 'undefined' || typeof results.message !== 'undefined'){
		this.emit('message', {data: {from: results.from || "", message: results.message || ""}});
	}
	//HANDLE STUDIO UPDATE
	var updates = [];
	for(var key in results){
		if(helper.blacklist.studio.indexOf(key) == -1){
			if(typeof this.state.studio == 'undefined') this.state.studio = {};
			if(typeof this.state.studio[key] == 'undefined' || this.state.studio[key] !== results[key]){
				updates.push(key);
				this.state.studio[key] = results[key];
			}
		}
	}
	//HANDLE STUDIO LINE LIST
	if(typeof results.lineList !== 'undefined'){
		if(typeof this.state.lines == 'undefined') this.state.lines = {};
		for(var i = 0; i < results.lineList.length; i++){
			var lineNumber = i+1;
			if(typeof this.state.lines[lineNumber] === 'undefined'){
				if(updates.indexOf('lineList') == -1) updates.push('lineList');
				this.state.lines[lineNumber] = {};
			}
			for(var key in results.lineList[i]){
				if(typeof this.state.lines[lineNumber][key] == 'undefined' || this.state.lines[lineNumber][key] !== results.lineList[i][key]){
					if(updates.indexOf('lineList') == -1) updates.push('lineList');
					this.state.lines[lineNumber][key] = results.lineList[i][key];
				}
			}
		}
	}
	if(updates.length > 0){
		var emitData = {data: {updates, studio: this.state.studio}};
		if(updates.indexOf('lineList') !== -1) emitData.data.studio.lineList = this.state.lines;
		this.emit('studioUpdate', emitData);
	}
}

vxClient.prototype.handleLineEvent = function(data){
	var results = helper.modifyResults(data.properties || [], helper.expects.studioLine);
	var lineNumber = data.subObjectId || null;
	var updates = [];
	if(lineNumber !== null){
		if(typeof this.state.lines[lineNumber] == 'undefined') this.state.lines[lineNumber] = {};
		for(var key in results){
			if(typeof this.state.lines[lineNumber][key] == 'undefined' || this.state.lines[lineNumber][key] !== results[key]){
				updates.push(key);
				this.state.lines[lineNumber][key] = results[key];
			}
		}
	}
	if(updates.length > 0){
		var emitData = {data: {updates: updates, line: this.state.lines[lineNumber]}};
		emitData.data.line.lineNumber = lineNumber;
		this.emit('lineUpdate', emitData);
	}
}

vxClient.prototype.handleBookEvent = function(data){
	var results = helper.modifyResults(data.properties || [], helper.expects.studioBook);
	var recordNumber = data.subObjectId || null;
	if(recordNumber !== null && typeof results.eventType !== 'undefined' && typeof helper.enumerations.book[results.eventType] !== 'undefined'){
		this.emit('bookUpdate', {data: {recordNumber: recordNumber, event: helper.enumerations.book[results.eventType]}});
	}
}

vxClient.prototype.emit = function(name, options){
	if(typeof this.listenerRegister[name] == 'function'){
		this.listenerRegister[name](options.err || null, options.data || null);
	}else{
		this.consoleLog(1, "Missing event listener: \""+name+"\"");
	}
}

vxClient.prototype.on = function(name, cb){
	if(typeof name !== 'undefined' && typeof cb == 'function'){
		this.listenerRegister[name] = cb;
	}else{
		this.consoleLog(1, "ERROR adding listener: expected two arguments (listener_name, callback)");
	}
}

vxClient.prototype.activeStudio = function(){
	if(typeof this.state.currentStudio == 'undefined' || typeof this.state.currentStudio.id == 'undefined')
		return false;
	else
		return true;
}

vxClient.prototype.checkLineState = function(lineNumber, isLineState, shouldBe){
	if(typeof lineNumber !== 'undefined' && this.state.lines !== 'undefined' && this.state.lines[lineNumber.toString()] !== 'undefined'){
		if(typeof isLineState == 'boolean' && isLineState && this.state.lines[lineNumber.toString()].lineState !== 'undefined'){
			if(typeof shouldBe == 'string' && this.state.lines[lineNumber.toString()].lineState == shouldBe.toUpperCase())
				return true;
			else
				return false;
		}else if(typeof isLineState == 'boolean' && !isLineState && this.state.lines[lineNumber.toString()].callState !== 'undefined'){
			if(typeof shouldBe == 'string' && this.state.lines[lineNumber.toString()].callState == shouldBe.toUpperCase())
				return true;
			else
				return false;
		}else{
			return false;
		}
	}else{
		return false;
	}
}

vxClient.prototype.consoleLog = function(level, message){
	if(typeof level !== 'number') level = 1;
	if(this.debug >= level && this.debug > 0){
		console.log(message);
	}
}
//MAIN INTERNAL METHODS--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//TELLOS VX METHODS--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START

//OBJECT="cc"--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.studioList = function(cb){  //LOGIN REQUIRED
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"studioList\"");
	this.request({
		object: "cc",
		properties: ['studio_list'],
		expects:{
			"studio_list":{name: "studioList", each:['studioId','studioName']}
		},
		cb:cb
	})
	//out - get cc studio_list
	//in  - indi cc studio_list=[[1, "Studio 1"], [2, "Studio 2"], [3, "Studio 3"]]
}

vxClient.prototype.date = function(cb){  //LOGIN REQUIRED
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"date\"");
	this.request({
		object: "cc",
		properties: ['date'],
		expects: {
			"date":{}
		},
		cb:cb
	})
	//out - get cc date
	//in  - indi cc date="2017-01-01T17:04:33"
}

vxClient.prototype.getServer = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"getServer\"");
	this.request({
		object: "cc",
		properties: ["server_id","server_version","server_caps","lwcp_version"],
		expects: {
			"server_id": {name: "serverId"},
			"server_version": {name: "serverVersion"},
			"server_caps": {name: "serverCapabilites"},
			"lwcp_version": {name: "lwcpVersion"}
		},
		loginNotRequired: true,
		cb:cb
	})
	//out - get cc server_id, server_version, server_caps, lwcp_version
	//in  - indi cc server_id="Telos VX", server_version="0.9.7", server_caps="b", lwcp_version=1
}

vxClient.prototype.setMode = function(mode){  //LOGIN REQUIRED
	if(typeof mode !== 'string') mode = 'TALENT';
	this.request({
		operation: "set",
		object: "cc",
		properties:[
			{property: 'mode', value: mode.toUpperCase()}
		]
	})
	//set cc mode=TALENT
}

vxClient.prototype.login = function(options, cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"login\"");
	if(typeof options.username !== 'string' || typeof options.username !== 'string'){
		if(typeof options.sessionId !== 'string'){
			return cb("ERROR: login requires either a username password option combination or a sessionId option", null);
		}else{
			options.username = null;
			options.password = null;
		}
	}
	this.request({
		operation: "login",
		object: "cc",
		properties: [
			{property: 'user', value: options.username, type: "string"},
			{property: 'password', value: options.password, type: "string"},
			{property: 'sessionid', value: options.sessionId, type: "string"}
		],
		loginNotRequired: true,
		cb:cb
	})
	//out - login cc user="username" password="password" --OR-- login cc sessionid="web_session_id"
	//in  - ack cc logged=FALSE --OR-- TRUE
}

vxClient.prototype.ping = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"ping\"");
	this.request({
		operation: "ping",
		object: "cc",
		cb:cb
	})
	//out - ping cc
	//in  - pong cc
}
//OBJECT="cc"--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//OBJECT="studio"--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.getStudio = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"getStudio\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		properties: ["id", "name", "show_id", "show_name", "num_lines", "hybrid_list", "num_hybrids", "num_hyb_fixed", "next", "pnext", "busy_all", "mute", "show_locked", "auto_answer"],
		expects: {
			"id": {name: "studioId"},
			"name": {name: "studioName"},
			"show_id":{name: "showId"},
			"show_name": {name: "showName"},
			"num_lines":{name:"numberOfLines"},
			"hybrid_list":{name: 'hybridList'},
			"num_hybrids":{name: "numberOfHybrids"},
			"num_hyb_fixed":{name: "numberOfFixedHybrids"},
			"next": {},
			"pnext": {name: "producerNext"},
			"busy_all":{name: "allBusy"},
			"mute": {name: "muted"},
			"show_locked": {name: "showLocked"},
			"auto_answer":{name: "autoAnswerOn"}
		},
		cb:cb
	})
	//out - get studio id, name, show_id, show_name, num_lines, hybrid_list, num_hybrids, num_hyb_fixed, next, pnext, busy_all, mute, show_locked, auto_answer
	//in  - indi studio id=1, name="Studio name", show_id=1, show_name="Show 1", num_lines=12, hybrid_list=["Fixed 1", "Fixed 2", "Fixed 3", "Fixed 4", "S1-Selectable 1", "S1-Selectable 2", "Selectable 6", "Selectable 7"], num_hybrids=8, num_hyb_fixed=4, next=0, pnext=0, busy_all=FALSE, mute=FALSE, show_locked=FALSE, auto_answer=FALSE
}

vxClient.prototype.showList = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"showList\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		properties: ["show_list"],
		expects: {
			"show_list":{name: "showList", each:['showId','showName']}
		},
		cb:cb
	})
	//out - get studio show_list
	//in  - indi studio show_list=[[1, "Show 1"], [2, "Show 2"], [3, "Test 1"]]
}

vxClient.prototype.lineList = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"lineList\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		properties: ["line_list"],
		expects: {
			"line_list": {
				name: "lineList",
				each: ["lineState","callState","lineName","lineLocal","lineRemote","lineHybrid","lineTime","lineComment","lineDirection"]
			}
		},
		cb:cb
	})
	//out - get studio line_list
	//in  - indi studio line_list=[[IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Line 20", "20", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614-448", "67614448", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614-449", "67614449", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 40", "40", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 80", "80", NULL, 0, NULL, "", NONE], NULL, [IDLE, IDLE, "VIP", "88", NULL, 1, NULL, "", NONE], [IDLE, IDLE, "NEWS", "89", NULL, 2, NULL, "", NONE], [IDLE, IDLE, "HOT-LINE", "90", NULL, 3, NULL, "", NONE]]
}

vxClient.prototype.selectStudio = function(id){
	this.request({
		operation: "select",
		object: "studio",
		properties: [
			{property: 'id', value: id}
		]
	})
	//out - select studio id=1
	//in  - event studio id=1, name="Studio 1", show_id=1, show_name="Show 1", next=0, pnext=0, busy_all=FALSE, num_lines=12, num_hybrids=8, num_hyb_fixed=4, mute=FALSE, show_locked=FALSE, auto_answer=FALSE, line_list=[[IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Line 20", "20", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614-448", "67614448", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614-449", "67614449", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 40", "40", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 80", "80", NULL, 0, NULL, "", NONE], NULL, [IDLE, IDLE, "VIP", "88", NULL, 1, NULL, "", NONE], [IDLE, IDLE, "NEWS", "89", NULL, 2, NULL, "", NONE], [IDLE, IDLE, "HOT-LINE", "90", NULL, 3, NULL, "", NONE]]
}

vxClient.prototype.selectShow = function(id){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: "select_show",
		object: "studio",
		properties:[
			{property: 'id', value: id}
		]
	})
	//out - select_show studio id = 1
	//in  - event studio show_id=1, show_name="Show 1", next=0, pnext=0, num_lines=12, show_locked=FALSE, line_list=[[IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Main-Studio", "10", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Line 20", "20", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614- 448", "67614448", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "67-614-449", "67614449", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 40", "40", NULL, 0, NULL, "", NONE], [IDLE, IDLE, "Cisco 80", "80", NULL, 0, NULL, "", NONE], NULL, [IDLE, IDLE, "VIP", "88", NULL, 1, NULL, "", NONE], [IDLE, IDLE, "NEWS", "89", NULL, 2, NULL, "", NONE], [IDLE, IDLE, "HOT-LINE", "90", NULL, 3, NULL, "", NONE]]
}

vxClient.prototype.im = function(from, message){
	if(typeof from !== 'string' || typeof message !== 'string') return this.consoleLog(1, "Missing required from or message string for \"im\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: "im",
		object: "studio",
		properties: [
			{property: 'from', value: from, type: "string"},
			{property: 'message', value: message, type: "string"}
		]
	})
	//out - im studio from="Telos VX", message="Hello World!"
	//in  - event studio from="Telos VX", message="Hello World!"
}

vxClient.prototype.setBusyAll = function(busyAll){
	if(typeof busyAll !== 'boolean') busyAll = true;
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: "busy_all",
		object: "studio",
		properties: [
			{property: 'state', value: busyAll}
		]
	})
	//out - busy_all studio state=TRUE
	//in  - event studio busy_all=TRUE
	//in  - event studio.line#1 state=BUSY, callstate=IDLE
}

vxClient.prototype.dropHybrid = function(hybrid){
	if(typeof hybrid == 'undefined') return this.consoleLog(1, "Hybrid line id is required for \"dropHybrid\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: 'drop',
		object: 'studio',
		properties:[
			{property: 'hybrid', value: hybrid}
		]
	})
	//out - drop studio hybrid = 5
	//in  - event studio.line#1 state=IDLE, callstate=TERMINATED, hybrid=0, time=NULL
	//in  - event studio.line#1 state=IDLE, callstate=IDLE, remote=NULL, direction=NONE, hybrid=0, time=NULL
}

vxClient.prototype.holdHybrid = function(hybrid){
	if(typeof hybrid == 'undefined') return this.consoleLog(1, "Hybrid line id is required for \"holdHybrid\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: 'hold',
		object: 'studio',
		properties:[
			{property: 'hybrid', value: hybrid}
		]
	})
	//out - hold studio hybrid = 5
	//in  - event studio.line#1 state=ON_HOLD, callstate=ESTABLISHED, hybrid=0, time=0
	//in  - event studio next=1, pnext=0
}
//OBJECT="studio"--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//OBJECT="studio.line"--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.getLine = function(lineNumber, cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"getLine\"");
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"getLine\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber,
		properties: ["state", "callstate", "name", "local", "remote", "hybrid", "time", "comment", "direction"],
		expects: {
			state: {name: "lineState"},
			callstate: {name: "callState"},
			name: {name: "lineName"},
			local: {name: "lineLocal"},
			remote: {name: "lineRemote"},
			hybrid: {name: "lineHybrid"},
			time: {name: "lineTime"},
			comment: {name: "lineComment"},
			direction: {name: "lineDirection"}
		},
		cb:cb
	})
	//out - get studio.line#1 state, callstate, name, local, remote, hybrid, time, comment, direction 
	//in  - indi studio.line#1 state=ON_AIR, callstate=ESTABLISHED, name="Main-Studio", local="10", remote="28", hybrid=5, time=123, comment="This is a comment.", direction=OUTGOING
}

vxClient.prototype.setLineComment = function(lineNumber, comment){
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"getLine\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(this.checkLineState(lineNumber, true, 'IDLE')) return this.consoleLog(1, "Cannot set line comment when the lineState is IDLE");
	this.request({
		operation: 'set',
		object: 'studio',
		subObject: 'line',
		subObjectId: lineNumber,
		properties: [
			{property: "comment", value: comment, type: 'string'}
		]
	})
	//out - set studio.line#1 comment = "This is a comment."
	//in  - event studio.line#1 comment="This is a comment."
}

vxClient.prototype.seizeLine = function(lineNumber){
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"getLine\" method");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: "seize",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber
	})
	//out - seize studio.line#1
	//in  - event studio.line#1 state=SEIZED, callstate=IDLE, hybrid=0, time=NULL
}

vxClient.prototype.callLine = function(options){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof options == 'undefined' || typeof options.lineId == 'undefined' || typeof options.number == 'undefined'){
		this.consoleLog(1, "Error: missing a required option for the \"callLine\" method");
		return;
	}else{
		if(typeof options.handset !== 'undefined'){
			if(options.handset && typeof options.optNumber !== 'undefined')
				options.hybrid = options.optNumber;
			else if(!options.handset && typeof options.optNumber !== 'undefined')
				options.port = options.optNumber;
		}
	}
	this.request({
		operation: "call",
		object: "studio",
		subObject: "line",
		subObjectId: options.lineId,
		properties: [
			{property: 'number', value: number, type: "string"},
			{property: 'handset', value: options.handset || null},
			{property: 'hybrid', value: options.hybrid || null},
			{property: 'port', value: options.port || null}
		]
	})
	//out - call studio.line#1 number="28"
	//in  - event studio.line#1 state=ON_AIR, callstate=DIALING, cause=100, remote="28", direction=OUTGOING, hybrid=5, time=0
	//in  - event studio.line#1 state=ON_AIR, callstate=RINGING_OUT, cause=180, hybrid=5, time=0
}

vxClient.prototype.takeLine = function(options){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof options.lineId == 'undefined'){
		this.consoleLog(1, "Error: missing required lineId option for \"takeLine\" method");
		return;
	}
	if(!options || typeof options.handset == 'undefined') var handset = null;
	else var handset = options.handset;
	if(!options || typeof options.hybrid == 'undefined') var hybrid = null;
	else var hybrid = options.hybrid;
	this.request({
		operation: "take",
		object: "studio",
		subObject: "line",
		subObjectId: options.lineId,
		properties: [
			{property: 'handset', value: handset},
			{property: 'hybrid', value: hybrid}
		]
	})
	//out1 - take studio.line#1 handset=FALSE, hybrid=6
	//in1  - event studio next=0, pnext=0
	//in1  - event studio.line#1 state=ON_AIR, callstate=ACCEPTING, cause=200, hybrid=6, time=30
	//in1  - event studio.line#1 state=ON_AIR, callstate=ESTABLISHED, cause=200, hybrid=6, time=0
	//out2 - take studio.line#1 handset=TRUE
	//in2  - event studio next=0, pnext=0
	//in2  - event studio.line#1 state=ON_HANDSET, callstate=ACCEPTING, cause=200, hybrid=0, time=11
	//in2  - event studio.line#1 state=ON_HANDSET, callstate=ESTABLISHED, cause=200, ssid=0, rport=62010, hybrid=0, time=0
}

vxClient.prototype.takeNext = function(){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	this.request({
		operation: 'take',
		object: 'studio',
		subObject: 'line'
	})
	//out - take studio.line
	//in  - event studio next=0, pnext=0
	//in  - event studio.line#1 state=ON_AIR, callstate=ACCEPTING, cause=200, hybrid=5, time=4
	//in  - event studio.line#1 state=ON_AIR, callstate=ESTABLISHED, cause=200, hybrid=5, time=0
}

vxClient.prototype.dropLine = function(lineNumber){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"dropLine\" method");
	this.request({
		operation: "drop",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber
	})
	//out - drop studio.line#1
	//in  - event studio.line#1 state=IDLE, callstate=TERMINATED, hybrid=0, time=NULL
	//in  - event studio.line#1 state=IDLE, callstate=IDLE, remote=NULL, direction=NONE, hybrid=0, time=NULL
}

vxClient.prototype.lockLine = function(lineNumber){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"lockLine\" method");
	if(!this.checkLineState(lineNumber, true, 'ON_AIR')) return this.consoleLog(1, "Lock line method requires a line state of ON_AIR");
	this.request({
		operation: "lock",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber
	})
	//out - lock studio.line#1
	//in  - event studio.line#1 state=ON_AIR_LOCKED, callstate=ESTABLISHED, hybrid=5,time=7
}

vxClient.prototype.unlockLine = function(lineNumber){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"unlockLine\" method");
	if(!this.checkLineState(lineNumber, true, 'ON_AIR')) return this.consoleLog(1, "Unlock line method requires a line state of ON_AIR_LOCKED");
	this.request({
		operation: "unlock",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber
	})
	//out - unlock studio.line#1
	//in  - event studio.line#1 state=ON_AIR, callstate=ESTABLISHED, hybrid=5, time=41
}

vxClient.prototype.holdLine = function(lineNumber, ready){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"holdLine\" method");
	if(typeof ready !== 'boolean') ready = true;
	this.request({
		operation: "hold",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber,
		properties: [
			{property: 'ready', value: ready}
		]
	})
	//out1 - hold studio.line#1 ready=TRUE
	//in1  - event studio.line#1 state=ON_HOLD_READY, callstate=ESTABLISHED, hybrid=0, time=0
	//in1  - event studio next=1, pnext=0
	//out2 - hold studio.line#1 ready=FALSE
	//in2  - event studio.line#1 state=ON_HOLD, callstate=ESTABLISHED, hybrid=0, time=29
	//in2  - event studio next=1, pnext=0
}

vxClient.prototype.raiseLine = function(lineNumber){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof lineNumber == 'undefined') return this.consoleLog(1, "LineId is required for \"raiseLine\" method");
	this.request({
		operation: "raise",
		object: "studio",
		subObject: "line",
		subObjectId: lineNumber
	})
	//out - raise studio.line#1
	//in  - event studio next=1, pnext=0
}
//OBJECT="studio.line"--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//OBJECT="studio.book"--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.recordCount = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"recordCount\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		subObject: "book",
		properties: ['count'],
		expects: {
			count: {name: "recordCount"}
		},
		cb:cb
	})
	//out - get studio.book count
	//in  - indi studio.book count=17
}

vxClient.prototype.recordList = function(range,cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"recordList\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		subObject: "book",
		properties: [
			"list",
			{property: 'range', value:((typeof range == 'object')? ("["+range[0]+","+range[1]+"]") : null)}
		],
		expects: {
			range:{},
			list:{name: "recordList", each:['recordId','recordName','recordNumber']}
		},
		cb:cb
	})
	//out - get studio.book list
	//in  - indi studio.book range=[1,17], list=[[1,"Phone1","1@192.168.0.24"],[2,"show number long string 1","1"],[3,"show number long string 2","2"],[4,"show number long string 3","3"],[5,"show number long string 4","4"],[6,"show number long string 5","5"],[7,"show number long string 6","6"],[8,"show number long string 7","7"],[9,"show number long string 8","8"],[10,"show number long string 9","9"],[11,"show number long string 10","10"], [12,"show number long string 11","11"],[13,"show number long string 12","12"],[14,"show number long string 13","13"],[15,"show number long string 14","14"],[16,"show number long string 15","15"],[17,"show number long string 16","16"]]
}

vxClient.prototype.addRecord = function(options){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	var types = ['GLOBAL', 'STUDIO', 'SHOW'];
	if(typeof options.type !== 'string' || types.indexOf(options.type.toUpperCase()) == -1) options.type = null;
	else options.type = options.type.toUpperCase();
	if(!options.name) options.name = null;
	if(!options.number) options.number = null;
	this.request({
		operation: "add",
		object: "studio",
		subObject: "book",
		properties: [
			{property: 'type', value: options.type},
			{property: 'name', value: options.name, type: "string"},
			{property: 'number', value: options.number, type: "string"}
		]
	})
	//out - add studio.book name="New Record", number="123"
	//in  - update studio.book#18 type=INSERT
}

vxClient.prototype.updateRecord = function(recordNumber, options){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof recordNumber == 'undefined') return this.consoleLog(1, "Missing recordNumber for \"updateRecord\" method");
	if(!options.type) options.type = null;
	else options.type = options.type.toUpperCase();
	if(!options.name) options.name = null;
	if(!options.number) options.number = null;
	this.request({
		operation: "set",
		object: "studio",
		subObject: "book",
		subObjectId: recordNumber,
		properties: [
			{property: 'type', value: options.type},
			{property: 'name', value: options.name, type: "string"},
			{property: 'number', value: options.number, type: "string"}
		]
	})
	//out - set studio.book#18 name="Changed Record"
	//in  - update studio.book#18 type=UPDATE
}

vxClient.prototype.deleteRecord = function(recordNumber){
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		return;
	}
	if(typeof recordNumber == 'undefined') return this.consoleLog(1, "Missing recordNumber for \"deleteRecord\" method");
	this.request({
		operation: "del",
		object: "studio",
		subObject: "book",
		subObjectId: recordNumber
	})
	//out - del studio.book#18
	//in  - update studio.book#18 type=DELETE
}
//OBJECT="studio.book"--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//OBJECT="studio.log"--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--\/--START
vxClient.prototype.logCount = function(cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"logCount\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		subObject: "log",
		properties: ["count"],
		expects: {
			count: {name: "logCount"}
		},
		cb:cb
	})
	//out - get studio.log count
	//in  - indi studio.log count=100
}

vxClient.prototype.logList = function(range, cb){
	if(typeof cb !== 'function') return this.consoleLog(1, "Callback is required for \"logList\"");
	if(!this.activeStudio()){
		this.consoleLog(1, "Must select studio before using this method");
		cb("Must select studio before using this method", null);
		return;
	}
	this.request({
		object: "studio",
		subObject: "log",
		properties: [
			"list",
			{property: 'range', value:((typeof range == 'object')? ("["+range[0]+","+range[1]+"]") : null)}
		],
		expects: {
			range: {},
			list: {name: "logList", each:['startTime','duration','direction','local','remote']}
		},
		cb:cb
	})
	//out - get studio.log list, range=[0,5]
	//in  - indi studio.log range=[1,5], list=[[1267557538,0,0,"10@192.168.0.9","20@192.168.0.32"], [1267557471,0,0,"40@192.168.0.9","28@192.168.0.23"], [1267552599,0,0,"40@192.168.0.9","28@192.168.0.23"], [1267552464,0,0,"40@192.168.0.9","28@192.168.0.23"], [1267107788,1,0,"1@192.168.0.9","28@192.168.0.23"]]
}
//OBJECT="studio.log"--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END

//TELLOS VX METHODS--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--/\--END