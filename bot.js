var config = require('./config.json');
var sdk = require("matrix-js-sdk");
var db = require('./db.js');

var client;
var opts;
function start(_opts, callback) {
    opts = _opts;
    client = sdk.createClient({
        baseUrl: "https://matrix.org",
        accessToken: config.access_token,
        userId: config.username
    });
    
    try {
        console.log("start client");
        client.startClient({initialSyncLimit: 10});
    } catch(err) {
        console.log('WARNING: Caught matrixClient error:');
        console.log(err);
        console.log('WARNING: You might need to restart the bot.');
    }
    
    client.once('sync', function(state, prevState, res) {
        //console.log(res);
        if(state === 'PREPARED') {
            callback();
            console.log("prepared");
            setupListeners();
            trySaveAll();
        } else {
            console.log(res);
            console.log(state);
            process.exit(1);
        }
    });
}

function setupListeners() {
    client.on("Room.timeline", function(event, room, toStartOfTimeline) {
        
        if (opts.recording) { db.saveEvent(event.event); }

        if (event.getType() !== "m.room.message") {
          return; // only use messages
        }
        if (event.event.room_id === config.testRoomId && event.event.content.body[0] === '!') {
            var content = {
                "body": event.event.content.body.substring(1),
                "msgtype": "m.notice"
            };
            client.sendEvent(config.testRoomId, "m.room.message", content, "", (err, res) => {
                console.log(err);
            });
        }
    });
}

function trySaveAll() {
    if (! opts.recording) { return; }
    Object.keys(client.store.rooms).forEach((roomId) => {
        client.store.rooms[roomId].timeline.forEach(t => {
            db.saveEvent(t.event);
        });
        var members = client.store.rooms[roomId].getJoinedMembers();
        members.forEach(member => {
            db.saveMember(roomId, member);
        });
    });
}

function publicRooms(callback) {
    client.publicRooms(function(err, data) {
        if (opts.recording) {
            data.chunk.forEach((room) => {
                db.saveRoom(room)
                if (room.aliases) {
                    room.aliases.forEach((alias) => {
                        db.saveAlias(room.room_id, alias);
                    });
                }
            });
        }
        console.log(callback(data));
    });
}

module.exports = {
    start: start,
    getClient: (() => { return client; }),
    publicRooms: publicRooms
};