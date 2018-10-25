var config = require('./config.json');
var sdk = require("matrix-js-sdk");
var db = require('./db.js');

var client;
var opts;
var scrollbackMode = false;
var roomsNeedScrollback = [];

function start(_opts, callback) {
    opts = _opts;
    client = sdk.createClient({
        baseUrl: "https://matrix.org",
        accessToken: config.access_token,
        userId: config.username,
        timelineSupport: true
    });
    
    try {
        console.log("start client");
        var roomFilter = {
            "timeline":{"limit":2},
            "state": {"not_types": ["*"]},
        };
        var filter = {"room":roomFilter, account_data:{not_types:['*']}};
        client.startClient({
            initialSyncLimit: 10,
            filter: sdk.Filter.fromJson("@NozzleB:matrix.org", "filter1", filter)
        });
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
            //process.exit(1);
        }
    });
}

function setupListeners() {
    client.on("Room.timeline", function(event, room, toStartOfTimeline) {
        
        if (opts.recording) { db.saveEvent(event.event); }
        if (scrollbackMode) { roomsNeedScrollback[event.event.room_id] = true; }

        if (event.getType() !== "m.room.message") {
          return; // only use messages
        }

        if (event.getRoomId() === config.testRoomId && event.getContent().body[0] === '!') {
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
    client.getRooms().forEach((room) => {
        var roomObj = {
            room_id: room.roomId,
            name: room.name,
            canonical_alias: room.getCanonicalAlias(),
            guest_can_join: -1, world_readable: -1, num_joined_members: -1, topic: ""
        };
        db.saveRoom(roomObj);
        room.timeline.forEach(t => {
            db.saveEvent(t.event);
        });
        var members = room.getJoinedMembers();
        members.forEach(member => {
            db.saveMember(room.roomId, member);
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

function joinRoom(roomId, callback) {
    client.joinRoom(roomId).done(function() {
        callback();
    });
}

function roomScrollback(roomId, count) {
    client.scrollback(client.store.rooms[roomId], count).done(function(room) {
        console.log("scrolled back in " + roomId);
    }, function(err) {
        print("Error: %s", err);
    });
}

function fullScrollback() {
    scrollbackMode = true;
    roomsNeedScrollback = {};
    var fullScrollbackMinutes = 60;
    setTimeout(() => { scrollbackMode = false; }, 1000 * 60 * fullScrollbackMinutes);
    doScrollback(Object.keys(client.store.rooms));
}

function doScrollback(rooms) {
    if (! scrollbackMode) { return; }
    console.log("doScrollback():");
    console.log(rooms);
    rooms.forEach(roomId => {
        roomsNeedScrollback[roomId] = false;
        var room = client.getRoom(roomId);
        client.scrollback(room, 100).done(function(room) {
            console.log(`scrolled back in ${roomId} (${room.name})`);
        });
    });
    setTimeout(() => {
        var rooms = [];
        Object.keys(roomsNeedScrollback).forEach(roomId => {
            if (roomsNeedScrollback[roomId]) {
                rooms.push(roomId);
            }
        });
        doScrollback(rooms);
    }, 1000 * 30);
}

function getLocalHistory(roomId, eventId, count, callback) {
    db.getLocalHistory(roomId, eventId, count, callback);
}

function getContext(roomId, eventId, callback) {
    var room = client.getRoom(roomId);
        
    if (!room || room.getMyMembership() !== "join") {
        console.log(`Not currently joined to ${roomId}, joining`);
        client.joinRoom(roomId).done(function(room) {
            console.log(`Successfully joined to ${roomId}`);
            getContextQuery(room, eventId, callback);
        });
    } else {
        getContextQuery(room, eventId, callback);
    }
}

function getContextQuery(room, eventId, callback) {
    console.log(`Context Query for: ${room.roomId}/${eventId}`)
    var timelineSet = room.getTimelineSets()[0];
    var timelineWindow = new sdk.TimelineWindow(client, timelineSet);
    
    timelineWindow.load(eventId, 1000)
    .done(()=>{
        console.log(`TimelineWindow loaded for: ${room.roomId}/${eventId} (now ${timelineWindow.getEvents().length} events)`);
        if (timelineWindow.canPaginate('f')) {
            timelineWindow.paginate('f', 500, true, 20)
                .done(function(paginated) {
                    console.log(`TimelineWindow paginated for: ${room.roomId}/${eventId} (now ${timelineWindow.getEvents().length} events)`);
                    callback(null, paginated);
                }, function(err) {
                    console.log(`TimelineWindow.paginate error: ${JSON.stringify(error)}`);
                    callback(err);
                });
        }
    }, (err) => {
        console.log(`TimelineWindow.load error: ${JSON.stringify(error)}`);
    });
}

module.exports = {
    start: start,
    getClient: (() => { return client; }),
    publicRooms: publicRooms,
    joinRoom: joinRoom,
    fullScrollback: fullScrollback,
    roomScrollback: roomScrollback,
    getLocalHistory: getLocalHistory,
    getContext: getContext
};