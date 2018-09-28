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
        if (scrollbackMode) { roomsNeedScrollback[event.event.room_id] = true; }

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
        var room = client.store.rooms[roomId];
        var roomObj = {
            room_id: roomId,
            name: room.name,
            canonical_alias: room.getCanonicalAlias(),
            guest_can_join: -1, world_readable: -1, num_joined_members: -1, topic: ""
        };
        db.saveRoom(roomObj);
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
    setTimeout(() => { scrollbackMode = false; }, 1000 * 60 * 5);
    doScrollback(Object.keys(client.store.rooms));
}

function doScrollback(rooms) {
    if (! scrollbackMode) { return; }
    console.log("doScrollback():");
    console.log(rooms);
    rooms.forEach(roomId => {
        roomsNeedScrollback[roomId] = false;
        client.scrollback(client.store.rooms[roomId], 100).done(function(room) {
            console.log("scrolled back in " + roomId);
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

function getLocalHistory(eventId, count, callback) {
    db.getLocalHistory(eventId, count, callback);
}

module.exports = {
    start: start,
    getClient: (() => { return client; }),
    publicRooms: publicRooms,
    joinRoom: joinRoom,
    fullScrollback: fullScrollback,
    roomScrollback: roomScrollback,
    getLocalHistory: getLocalHistory
};