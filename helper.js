exports.lwcpGenerate = function(options){
	//SYNTAX = "operation object.subObject#subObjectId property1, property2=value2"
	var data = ""
	if(!options.operation) options.operation = 'get';
	//OPERATION
	data += options.operation + " ";
	//OBJECT
	data += options.object;
	//SUBOBJECT
	if(typeof options.subObject !== 'undefined') data += "." + options.subObject;
	//SUBOBJECT ID
	if(typeof options.subObjectId !== 'undefined') data += "#" + options.subObjectId;
	//PROPERTIES
	if(typeof options.properties == 'object') data += genPropString(options.properties);
	return data;
}
exports.lwcpParse = function(input){
	input = input.replace(/(\n|\r)/g,'');
	input = input.match(/^([a-z]+)\s\s*([a-z]+)(?:\.([a-z]+)(?:\#([0-9]+))?)?\s\s*(.*)$/);
	if(input !== null){
		input = {
			operation: input[1] || null,
			object: input[2] || null,
			subObject: input[3] || null,
			subObjectId: input[4] || null,
			properties: input[5] || null
		}
		if(input.properties)
			input.properties = propertyParse(input.properties);
	}
	return input;
}
function propertyParse(props){
	var properties = [];
	while(props.length > 0){
		if(props[0] == ",") props = props.substring(1);
		props = props.trim();
		var cmIndex = props.indexOf(",");
		var wsIndex = props.indexOf(" ");
		var eqIndex = props.indexOf("=");
		if(eqIndex == -1 && wsIndex == -1 && cmIndex == -1){
			properties.push(props);
			props = "";
		}else{
			var checkArray = [];
			if(eqIndex !== -1) checkArray.push(eqIndex);
			if(wsIndex !== -1) checkArray.push(wsIndex);
			if(cmIndex !== -1) checkArray.push(cmIndex);
			var min = Math.min.apply(null, checkArray);
			checkArray.splice(checkArray.indexOf(min),1); //Remove successful min from array for later use
			var property = props.slice(0,min);
			props = props.substring(min+1);
			if(min == eqIndex){  //Grab our value
				props = props.trim();
				if(props.indexOf("\"") == 0){          //STRING PARSE
					props = props.substring(1);
					var qIndex = props.indexOf("\"");
					if(qIndex !== -1){
						var value = props.slice(0,qIndex);
						props = props.substring(qIndex+1);
						properties.push({property: property, value: value});
					}
				}else if(props.indexOf("\[") == 0){    //ARRAY PARSE
					var closeIndex = 0;
					var openCount = 1;
					for(var i = 1; i < props.length; i++){
						if(props[i] == "\]")
							openCount--;
						else if(props[i] == "\[")
							openCount++;
						if(openCount == 0){
							closeIndex = i;
							break;
						}
					}
					if(closeIndex !== 0){
						var unparsedArray = props.slice(0,closeIndex+1);
						props = props.substring(closeIndex+1);
						unparsedArray = ((unparsedArray.replace(/TRUE/g,'true')).replace(/FALSE/g,'false')).replace(/NULL/g,'null');
						var temp = unparsedArray;
						unparsedArray = unparsedArray.replace(/(\[\s*|\,\s*)([A-Z]+(?:\_[A-Z]+)*)(\s*\]|\s*\,)/,"$1\"$2\"$3");
						while(unparsedArray !== temp){
							temp = unparsedArray;
							unparsedArray = unparsedArray.replace(/(\[\s*|\,\s*)([A-Z]+(?:\_[A-Z]+)*)(\s*\]|\s*\,)/,"$1\"$2\"$3");
						}
						try{
							var parsedArray = JSON.parse(unparsedArray);
							properties.push({property: property, value: parsedArray});
						}catch(e){}
					}
				}else{
					var wsIndex = props.indexOf(" ");
					var cmIndex = props.indexOf(",");
					if(wsIndex == -1 && cmIndex == -1){
						var unparsedValue = props;
						props = "";
					}else{
						var checkArray = [];
						if(wsIndex !== -1) checkArray.push(wsIndex);
						if(cmIndex !== -1) checkArray.push(cmIndex);
						var min = Math.min.apply(null, checkArray);
						unparsedValue = props.slice(0,min);
						props = props.substring(min+1);
					}
					if(unparsedValue.match(/^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/)){
						try{
							var parsedValue = parseFloat(unparsedValue);
						}catch(e){
							var parsedValue = unparsedValue;
						}
					}else if(unparsedValue.match(/NULL/)){
						var parsedValue = null;
					}else if(unparsedValue.match(/TRUE/)){
						var parsedValue = true;
					}else if(unparsedValue.match(/FALSE/)){
						var parsedValue = false;
					}else{
						var parsedValue = unparsedValue;
					}
					properties.push({
						property: property,
						value: parsedValue
					})
				}
			}else{
				properties.push(property);
			}
		}
	}
	return properties;
}
exports.modifyResults = function(data, changes){
	data = JSON.parse(JSON.stringify(data));
	changes = JSON.parse(JSON.stringify(changes));
	var newResults = {};
	for(var i = 0; i < data.length; i++){
		var key = null;
		var value = null;
		if(typeof data[i] == 'object'){
			if(typeof changes[data[i].property] !== 'undefined'){
				key = changes[data[i].property].name || data[i].property;
				if(typeof data[i].value == 'object' && typeof changes[data[i].property].each == 'object'){
					value = modifyArray(data[i].value, changes[data[i].property].each);
				}else{
					value = data[i].value;
				}
			}else{
				key = data[i].property;
				value = data[i].value;
			}
		}else{
			if(typeof changes[data[i]] !== 'undefined'){
				key = changes[data[i]].name || data[i];
				value = 'NOVALUE';
			}else{
				key = data[i];
				value = 'NOVALUE';
			}
		}
		newResults[key] = value;
	}
	return newResults;
}
exports.uniqueKey = function(options){
	var key = "";
	key += options.object || "";
	key += options.subObject || "";
	key += options.subObjectId || "";
	if(options.properties){
		for(var i = 0; i < options.properties.length; i++){
			if(typeof options.properties[i] == 'string')
				key += options.properties[i];
			else if(typeof options.properties[i] == 'object' && options.properties[i].property && typeof options.properties[i].value !== 'undefined' && options.properties[i].value !== null)
				key += options.properties[i].property;
		}
	}
	return key;
}
var modifyArray = function(orig, each){
	for(var i = 0; i < orig.length; i++){
		if(typeof orig[i] == 'object' && orig[i] !== null){
			var indexValue = {};
			for(var j = 0; j < orig[i].length; j++){
				if(typeof each[j] !== 'undefined') var key = each[j];
				else var key = "index" + j;
				indexValue[key] = orig[i][j];
			}
			orig[i] = indexValue;
		}
	}
	return orig;
}
var genPropString = function(props){
	var propString = "";
	if(props.length > 0){
		for(var i = 0; i < props.length; i++){
			if(typeof props[i] == 'string'){
				if(i !== 0) propString += ","
				propString += " ";
				//PROPERTY
				propString+= props[i];
			}else{
				if(!props[i].property || typeof props[i].value == 'undefined' || props[i].value == null) continue;
				if(i !== 0) propString += ","
				propString += " ";
				//PROPERTY
				propString += props[i].property;
				if(props[i].type && props[i].type == 'string')  //Surround string types with quotes
					props[i].value = "\"" + props[i].value + "\"";
				if(typeof props[i].value == 'boolean'){
					if(props[i].value) props[i].value = "TRUE";
					else props[i].value = "FALSE";
				}
				//VALUE
				propString += "=" + props[i].value;
			}
		}
	}
	return propString;
}

exports.blacklist = {
	studio: ['studioId','studioName','lineList']
}

exports.enumerations = {
	book: {'INSERT': 'inserted', 'UPDATE': 'updated', 'DELETE': 'deleted'}
}

exports.expects = {
	ack:{
		logged: {name: 'loggedIn'}
	},
	studio:{
		"id":{name: "studioId"},
		"name": {name: "studioName"},
		"show_id": {name: "showId"},
		"show_name": {name: "showName"},
		"next": {},
		"pnext": {name: "producerNext"},
		"busy_all": {name: "allBusy"},
		"num_lines": {name: "numberOfLines"},
		"num_hybrids": {name: "numberOfHybrids"},
		"num_hyb_fixed": {name: "numberOfFixedHybrids"},
		"mute": {name: "muted"},
		"show_locked": {name: "showLocked"},
		"auto_answer": {name: "autoAnswerOn"},
		"line_list": {name: "lineList", each: ["lineState","callState","lineName","lineLocal","lineRemote","lineHybrid","lineTime","lineComment","lineDirection"]},
		"from":{},
		"message":{}
	},
	studioLine:{
		'state': {name: "lineState"},
		'callstate': {name: "callState"},
		'name': {name: "lineName"},
		'local': {name: "lineLocal"},
		'remote': {name: "lineRemote"},
		'hybrid': {name: "lineHybrid"},
		'time': {name: "lineTime"},
		'comment': {name: "lineComment"},
		'direction': {name: "lineDirection"},
		'ssid': {name: "lineSSID"},
		'cause': {name: "lineCause"}, 
		'rport': {name: "lineRPORT"},
		'caller_id': {name: "lineCallerId"}
	},
	studioBook:{
		'type': {name: "eventType"},
	}
}