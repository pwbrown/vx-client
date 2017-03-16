[![Version](https://img.shields.io/npm/v/vx-client.svg)](https://www.npmjs.com/package/vx-client)
[![Downloads](https://img.shields.io/npm/dm/vx-client.svg)](https://www.npmjs.com/package/vx-client)

#VX-CLIENT

##Description
vx-client is a node.js api wrapper for the Telos VX phone system SIP server. Sends and receives messages between the Telos VX server and the node server via Transmission Control Protocol (TCP) messages ([Node.js "Net" Documentation](https://nodejs.org/api/net.html)).

###*Notes on environment*
* Tested on Telos VX Prime system

##Changelog - Alpha Version
Current Version: Alpha 0.0.8

####Changes in version Alpha 0.0.7:
* ***LWCP parsing bug fix***: Updated regular expression to better handle property enumerations.
* ***Updated "getLine" method***: Now returns "callerId" line property as well
* ***Added method "setCallerId"***: New method to set the caller id property on a specified line
* ***Added method "getCallerId"***: New method to retrieve caller id property of a specified line
* ***Updated "logList" method***: Also returns "lineCallerId" property for each line and renames all properties to match the standard line property naming convention throughout this documentation

####Changes in verion Alpha 0.0.8:
* ***LWCP parsing bug fix***: Fixing regular expression bug

##IMPORTANT NOTES
* The CallerId feature is a newer feature for the vx system. This means that the "lineCallerId" line property will **NEVER** be included in the "lineList" property array of the "studioUpdate" event or the "lineList" method. The "lineCallerId" property **WILL** be included (if the server can handle it) in "lineUpdate" events and is easily accessible via the "getLine" and "getCallerId" methods.  **THIS MEANS THAT** in situations where a "studioUpdate" event is being used to establish line states after initial server connection, an additional call to "getCallerId" for each line must also be made to retrieve these.


##Installation
	npm install vx-client --save
	--OR--
	yarn add vx-client

##Initialize

```Javascript
var vxClient = require('vx-client');

var vx = new vxClient();
```

####Debugging
	var vx = new vxClient({debug: debug_level});
	
#####Debug Levels
* 0: No Logging - Nothing will be logged to the console
* 1: Error Logging - All errors will be logged to the console
* 2: I/O Logging - All incoming and outgoing data strings to/from the server will be logged

***NOTE: Higher number debug levels include features of all lower levels(excluding level 0) of debugging***

##Enumerations
* In this documentation the properties in the table below will have the following possible return values

| Property Key  | Possible Values                                                                                                                    |
|---------------|------------------------------------------------------------------------------------------------------------------------------------|
| lineState     | NONE, IDLE, USED\_EW, SEIZED, SEIZED\_EW, ON\_HANDSET, ON\_HANDSET\_EW, RINGING\_IN, ON\_AIR, ON\_AIR\_LOCKED, ON\_HOLD, ON\_HOLD\_READY, BUSY |
| callState     | NONE, IDLE, DIALING, RINGING\_OUT, RINGING\_IN, ACCEPTING, ESTABLISHED, TERMINATED                                                   |
| lineDirection | NONE, OUTGOING, INCOMING                                                                                                           |

##Register Listeners
* Listeners should be registered before connecting to the server to prevent potential loss of data on server connection

```Javascript
//To register a listener...
vx.on('event_name', function(error, data){

});
```

###Available Events

####'message'
* Fired after an instant message has been received by the vx server

```Javascript
//Example Callback Data Object
{
	from: "User's Name",
	message: "Message from user"
}
```

####'studioChange'
* Fires after a 'selectStudio' method call and returns details of currently selected studio

```Javascript
//Example Callback Data Object on selectStudio
{
	id: 1,
	name: "Studio 1"
}
```

####'studioUpdate'
* Fires after a new studio has been selected along with the 'studioChange' event. Also fires on subsequent studio changes reflected by updates to the following properties...

```Javascript
//Example Callback Data Object
{
	//Indicates specific list of all properites in the studio object that have changed since the last event fire.
	updates: ["next","producerNext","allBusy"],
	
	//Full property structure of studio including list of available lines
	studio:{
		showId:1,
		showName:"Show 1",
		next:0,
		producerNext:0,
		allBusy:true,
		numberOfLines:6,
		numberOfHybrids:2,
		numberOfFixedHybrids:0,
		muted:false,
		showLocked:false,
		autoAnswerOn:false,
		lineList:{
			"1":{
				lineState:"BUSY",
				callState:"IDLE",
				lineName:"123-123-1234",
				lineLocal:"sip:1234567891@11.11.1.11",
				lineRemote:"null",
				lineHybrid:"0",
				lineTime: 123,
				lineComment:"",
				lineDirection:"NONE"
			},
			"2":{
				lineState:"BUSY",
				callState:"IDLE",
				.
				.
				.
			},
			.
			.
			.
		}
	}
}
```

***NOTE: After the first studioUpdate event of each studio change, the lineList property should not be solely relied on as the only source of line updates.  Use the 'lineUpdate' event to receive every event related to a line change/update.***

####'lineUpdate'
* Fires each time a studio line changes for any reason.  This is your primary listener to keep up to date with the rest of the system's live changes
* ***IMPORTANT!!: This event cannot and will not fire until a studio has been selected. Refer to the studio object 'selectStudio' operation method***

```Javascript
//Example Callback Data Object
{
	//Indicates specific list of all properites in the line object that have changed since the last event fire.
	updates: ['lineState','callState','lineTime','lineLocal'],
	
	//Full property structure of line including list of available lines
	line: {
		lineNumber: "1",
		lineState: 'ON_AIR',
		callState: 'ESTABLISHED',
		lineName: 'Main Studio',
		lineLocal: '10',
		lineRemote: '28',
		lineHybrid: 5,
		lineTime: 123,
		lineComment: "This is a comment",
		lineDirection: "INCOMING",
		lineSSID: 0,
		lineRPORT: 62026,
		lineCause: 200
	}
}
```

***NOTE: 'lineSSID', 'lineRPORT', and 'lineCause' are conditional properities and are not guaranteed to be returned on every "lineUpdate" event.***

####'bookUpdate'
* Fires each time the address book is updated.

```Javascript
//Example Callback Data Object
{
	recordNumber: 1,
	event: "inserted"
}
```

##Connect to VX Server
* A server connection is required before any subsequent requests can be made.

```Javascript
vx.connect({host: "server_address", port: "server_port#"}, function(errorMessage, connected){
	if(connected) 
		console.log("You are connected");
	else 
		console.log(errorMessage);
})
```

##Login to the VX System
* With the execption of the "getServer" cc property method and "ping" cc operation method, successful login is required before any other property/operation method can be called.
* There are two methods of login.  One accepts both username and password options.  The other accepts a sessionId option for usage with Flash meters applets.

```Javascript
//Example with username and password
vx.login({username: "some_user", password: "some_pass"},function(err, loggedIn){
	if(loggedIn)
		console.log("You have logged in. Do what you will now");
	else
		console.log(err);
})

//Example with sessionId
vx.login({sessionId: "sOm3_s3ss1one_Id"}, function(err, loggedIn){
	//same as above
})
```

##VX Methods
***NOTE: these methods are available after a server connection has been made and after the user has logged into the system (with the two exceptions being the "getServer" method and the "ping" method).

***
***

### "CC" Object Property Methods

***

####'studioList'
* **Read-only** list of available studios

```Javascript
vx.studioList(function(err, data){
	
	/* data Definition
	data: {
		studioList: [
			{
				studioId: 1,
				studioName: "Studio 1"
			},
			.
			.
			.
		]
	}
	*/
	
})
```

####'date'
* **Read-only** date string of current time registered by vx phone system.
* Conforms to ISO 8601 Date Format "YYYY-MM-DDThh:mm:ss"

```Javascript
vx.date(function(err, data){
	
	/* data Definition
	data: {
		date: "2017-01-01T17:04:33"
	}
	*/
	
})
```

####'getServer'
* **Read-only** set of properties related to the server.
* **IMPORTANT!!: This Method does not require server login.**

```Javascript
vx.getServer(function(err, data){
	
	/* data Definition
	data: {
		serverId: "Telos VX",
		serverVersion: "0.9.7",
		serverCapabilities: "b",
		lwcpVersion: 1
	}
	*/

})
```

### "CC" Object Operation Methods

***

####'setMode'
* **Write-only** method alters some behaviors like the studio object "takeNext" method
* Possible modes are **"TALENT"** and **"PRODUCER"**

```Javascript
vx.setMode(mode);
//OR
vx.setMode(mode);
```

####'login'
* Refer to the login documentation earlier^^

####'ping'
* Simply sends and receives a server ping
* **IMPORTANT!!: This Method does not require server login.**

```Javascript
vx.ping(function(){
	console.log("pong: server has responded");
})
```

***
***

### "Studio" Object Property Methods

***

####'getStudio'
* **Read-only** method to retrieve details about currently selected studio
* **Requires selected studio**

```Javascript
vx.getStudio(function(err, data){

	/* data Definition
	data: {
		studioId: 1,
		studioName: "Studio Name",
		showId: 1,
		showName: "Show 1",
		numberOfLines: 12,
		hybridList: ['Fixed 1', 'Fixed 2', 'Selectable 1'],
		numberOfHybrids: 6,
		numberOfFixedHybrids: 4,
		next: 1,
		producerNext: 2,
		allBusy: false,
		muted: false,
		showLocked: false,
		autoAnswerOn: false
	}
	*/

})
```

####'showList'
* **Read-only** method to retrieve list of available shows
* **Requires selected studio**

```Javascript
vx.showList(function(err, data){

	/* data Definition
	data: {
		showList: [
			{
				showId: 1,
				showName: "Show 1"
			},
			.
			.
			.
		]
	}
	*/

})
```

####'lineList'
* **Read-only** method to retrieve list of available studio lines
* **Requires selected studio**

```Javascript
vx.lineList(function(err, data){

	/* data Definition
	data: {
		lineList:[
			{
				lineState:"BUSY",
				callState:"IDLE",
				lineName:"123-123-1234",
				lineLocal:"sip:1234567891@11.11.1.11",
				lineRemote:"null",
				lineHybrid:"0",
				lineTime: 123,
				lineComment:"",
				lineDirection:"NONE"
			},
			.
			.
			.
		]
	}
	*/

})
```

### "Studio" Object Operation Methods

***

####'selectStudio'
* **Write-only** method to select a new studio to operate in.  Use the studioList method to retrieve possible choices.
* Accepts **one argument**: studio_id
* Triggers the **"studioChange"** event
* **IMPORTANT!!!: This method is a dependency for all Studio Object and Studio subObject methods.**

```Javascript
vx.selectStudio(studioId);
```

####'selectShow'
* **Write-only** method to select a new show to operate in.
* Unlike 'selectStudio' this method is not a dependency, and the show will default to the first available when selecting a studio.
* **Requires selected studio**
* Accepts **one argument**: show_id
* Triggers the **"studioUpdate"** event

```Javascript
vx.selectShow(showId);
```

####'im'
* **Write-Only** method that sends an **instant message** within the selected studio
* **Requires selected studio**
* Accepts **two arguments**: from, message
* Listen for incoming instant messages with the **"message"** event

```Javascript
vx.im('John Smith', 'Please put line 2 on air.');
```

####'setBusyAll'
* **Write-only** method that will change every line (that has been confirgured to be able to go busy) to a busy state.
* The "lineState" value will become "BUSY" for each line it has changed
* **Requires selected studio**
* Accepts **one optional argument**: boolean busyState (Defaults to true)
* Triggers the **"studioUpdate"** event and the **"lineUpdate"** event.

```Javascript
vx.setBusyAll(false);
//or
vx.setBusyAll(true);
//or
vx.setBusyAll();  //Also true
```

####'dropHybrid'
* **Write-only** method to drop the calls that reside on a hybrid line
* **Requires selected studio**
* Accepts **one argument**: hybrid_id/number
* Triggers the **"lineUpdate"** event

```Javascript
vx.dropHybrid(hybridId);
```

####'holdHybrid'
* **Write-only** method to pull a call that resides on a certain hybrid on hold
* **Requires selected studio**
* Accepts **one argument**: hybrid_id/number
* Triggers the **"lineUpdate"** event

```Javascript
vx.holdHybrid(hybridId);
```

***
***

### "Studio.Line" Object Property Methods

***

####'getLine'
* **Read-only** method that retries all properties related to a specified line
* **Requires selected studio**
* Accepts **one argument**: line_id/number
* **NOTE: Should use the "lineUpdate" event to get live feedback on line changes.**

```Javascript
vx.getLine(lineId, function(err, data){
	
	/* data Definition
	data: {
		lineState:"BUSY",
		callState:"IDLE",
		lineName:"123-123-1234",
		lineLocal:"sip:1234567891@11.11.1.11",
		lineRemote:"null",
		lineHybrid:"0",
		lineTime:123,
		lineComment:"",
		lineDirection:"NONE",
		lineCallerId: 
	}
	*/

})
```

####'getCallerId'
* **Read-only** method that retrieves the callerId property for a specified line
* **Requires selected studio**
* Accepts **one argument**: lineId

```Javascript
vx.getCallerId(lineId, function(err, data){
	
	/* data Definition
	data: {
		lineCallerId: "John Smith" 
	}
	*/
})
```

### "Studio.Line" Object Operation Methods

***

####'setLineComment'
* **Write-only** method that sets the comment attribute for a specified line
* **Requires selected studio**
* **Will result in an error if the callState of the chosen line is "IDLE"**
* Accepts **two arguments**: lineId, comment_string
* Triggers the **"lineUpdate"** event

```Javascript
vx.setLineComment(lineId, 'This is a comment');
```

####'setCallerId'
* **Write-only** method that sets the callerId attribute for a specified line
* **Requires selected studio**
* **Will result in an error if the callState of the chosen line is "IDLE"**
* Accepts **two arguments**: lineId, callerId_string
* Triggers the **"lineUpdate"** event
* **NOTE: Unknown/Unspecified comment length limit as of current version. Use "very" long comment strings at your own discretion.**

```Javascript
vx.setCallerId(lineId, 'John Smith');
```

####'seizeLine'
* **Write-only** method that reserves a line for the client so no one else can call from it.
* **Requires selected studio**
* Accepts **one argument**: lineId
* Triggers the **"lineUpdate"** event

```Javascript
vx.seizeLine(lineId);
```

####'callLine'
* **Write-only** method that creates a call to a specified number and puts it either on a hybrid or a specific 
* **Requires selected studio**handset.
* Accepts **four options**: lineId(required), number(String-required), handset(Boolean-optional), optNumber(Integer-optional)
* If handset is set to true than the number will be placed on the hybrid line passed in through the "optNumber" option.
* If handset is set to false than the number will be placed on a handset with the port passed in through the "optNumber" option
* Triggers the **"lineUpdate"** event

```Javascript
vx.callLine({number: "123", handset: true, optNumber=1});
```

####'takeLine'
* **Write-only** method to take a call on air to a certain hybrid or a handset
* **Requires selected studio**
* Accepts **three options**: lineId(required), handset(Boolean-optional), hybrid(Integer-required if handset is true)
* Triggers the **"lineUpdate"** event and the **"studioUpdate"** event

```Javascript
vx.takeLine({lineId: 1, handset: true, hybrid: 1});
```

####'takeNextLine'
* **Write-only** method that takes the next line defined by "next" or "producerNext" depending on mode of operation (TALENT or PRODUCER)
* **Requires selected studio**
* Triggers the **"lineUpdate"** event and the **"studioUpdate"** event

```Javascript
vx.takeNextLine();
```

####'dropLine'
* **Write-only** method that drops a specified line
* **Requires selected studio**
* Accepts **one argument**: lineId
* Triggers the **"lineUpdate"** event

```Javascript
vx.dropLine(lineId);
```

####'lockLine'
* **Write-only** method that locks the call on a specific line.
* **This method will error if the line is NOT in the "ON\_AIR" lineState**
* **Requires selected studio**
* Accepts **one argument**: lineId
* Triggers the **"lineUpdate"** event

```Javascript
vx.lockLine(lineId);
```

####'unlockLine'
* **Write-only** method that unlocks the call on a specific line.
* **This method will error if the line is NOT in the "ON\_AIR\_LOCKED" lineState**
* **Requires selected studio**
* Accepts **one argument**: lineId
* Triggers the **"lineUpdate"** event

```Javascript
vx.unlockLine(lineId);
```

####'holdLine'
* **Write-only** method that places on line on hold and merges the caller with a configured in studio on hold channel hybrid.
* **Requires selected studio**
* Accepts **two arguments**: lineId, ready(Boolean)
* The ready argument toggles between setting a lineState of "ON_HOLD" AND "ON\_HOLD\_READY" with ready set to false or true respectively.
* Triggers the **"lineUpdate"** event and the **"studioUpdate"** event

```Javascript
vx.holdLine(lineId, true);
```

####'raiseLine'
* **Write-only** method that raises the priority of a specified line in the next/pnext queue
* **Requires selected studio**
* Accepts **one argument**: lineId
* Triggers the **"studioUpdate"** event

```Javascript
vx.raiseLine(lineId);
```

***
***

### "Studio.Book" Object Property Methods

***

####'recordCount'
* **Read-only** method that retrieves the number of records in the address book
* **Requires selected studio**

```Javascript
vx.recordCount(function(err, data){
	
	/* data Definition
	data: {
		recordCount: 10
	}
	*/

})
```

####'recordList'
* **Read-only** method that retrieves a list of all records in the address book
* **Requires selected studio**
* Accepts **two arguments**: range(Array - Nullable), callback
* The range argument array has two elements: First is the starting index, second is the number of records to retrieve.

```Javascript
vx.recordList([1, 3], function(err, data){
	
	/* data Definition
	data: {
		recordList: [
			{
				recordId: 1,
				recordName: "Phone1",
				recordNumber: "1@192.168.0.24"
			},
			.
			.
			.
		]
	}
	*/

})
```

### "Studio.Book" Object Operation Methods

***

####'addRecord'
* **Write-only** method to add a record to the address book
* **Requires selected studio**
* Accepts **three options**: type(String-required), name(String-required), number(String-required)
* The type option defines scope and can be either **"GLOBAL"**, **"STUDIO"**, or **"SHOW"**
* Triggers the **"bookUpdate"** event

```Javascript
vx.addRecord({type: "GLOBAL", name: "Phone 1", number: "1@192.168.0.24"});
```

####'updateRecord'
* **Write-only** method to update a record in the address book
* **Requires selected studio**
* Accepts **two arguments**: recordId, update options(same as previous method except each option is optional)
* Triggers the **"bookUpdate"** event

```Javascript
vx.updateRecord(recordId, {type: "STUDIO"});
```

####'deleteRecord'
* **Write-only** method to delete a specified record
* **Requires selected studio**
* Accepts **one argument**: recordId
* Triggers the **"bookUpdate"** event

```Javascript
vx.deleteRecord(recordId);
```

***
***

### "Studio.Log" Object Property Methods

***

####'logCount'
* **Read-only** method to retrieve history count of all calls made in the current studio.
* **Requires selected studio**

```Javascript
vx.logCount(function(err, data){
	
	/* data Definition
	data: {
		logCount: 500
	}
	*/
	
})
```

####'logList'
* **Read-only** method that retrieves a list of all calls in the studio log
* **Requires selected studio**
* Accepts **two arguments**: range(Array - Nullable), callback
* The range argument array has two elements: First is the starting index, second is the number of records to retrieve.

```Javascript
vx.logList([1, 100], function(err, data){
	
	/* data Definition
	data: {
		logList: [
			{
				lineStartTime: 1267557538,
				lineDuration: 0,
				lineDirection: 1,     //(1 - Incoming, 0 - Outgoing)
				lineLocal: "40@192.168.0.9",
				lineRemote: "28@192.168.0.23",
				lineCallerId: "John Smith"
			},
			.
			.
			.
		]
	}
	*/

})
```
