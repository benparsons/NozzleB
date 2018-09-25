var express = require('express');  
var app = express();

function start(bot) {
    var client = bot.getClient();
    app.get('/', function(req, res) {
        res.sendFile(__dirname + "/index.html");
    });
    
    app.get('/rooms', function (req, res) {
        var rooms = [];
        Object.keys(client.store.rooms).forEach(roomId => {
            var members = client.store.rooms[roomId].getJoinedMembers();
            members = members.map(m => {return {
                name: m.name,
                powerLevel: m.powerLevel,
                userId: m.userId}
            });
            rooms.push({
                summary: client.store.rooms[roomId].summary,
                members: members
            });
        });
        res.send(JSON.stringify(rooms));
    });
    
    app.get('/timeline/:roomId', function(req, res) {
        var room = client.store.rooms[req.params.roomId];
        var timeline = room.timeline.map(t => {return t.event;});
        res.send(JSON.stringify(timeline));
    });
    
    app.get('/scrollback/:roomId', function(req, res) {
        roomScrollback(req.params.roomId, 100)
        res.send("Scrollback requested");
    });

    app.get('/publicRooms', function(req, res) {
        bot.publicRooms((data) => { res.send(data); });
    });

    app.get('/join/:roomId', function (req, res) {
        bot.joinRoom(req.params.roomId, function() {
            res.send("Join requested: " + req.params.roomId);
        });
    });
    
    app.listen(1416, function () {  
        console.log('Example app listening on port 3000!');  
    });
}

module.exports = {
    start: start
}