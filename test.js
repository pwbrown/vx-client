var Client = require('./lib');

var conn = new Client()

function handleLine(line){
    console.log(line);
    debugger;
    conn.write("get cc server_id");
}

(async () => {
    await conn.connect('cs.thesmg.cloud', 20518);
    var {err, data} = await conn.getServer();
    debugger;
    var {err, data} = await conn.login('user', '');
    debugger;
    
})()