var express = require('express');  
var app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  

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
        bot.roomScrollback(req.params.roomId, 100)
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

    app.get('/fullScrollback', function(req, res) {
        bot.fullScrollback();
        res.send("fullScrollback init");
    });

    app.get('/history/:roomId/:eventId/:eventCount', async function(req, res) {
        var roomId = req.params.roomId;
        if (roomId[0] !== '!') {
            try {
                if (roomId[0] !== '#') { roomId =  '#' + roomId; }
                var room = await client.resolveRoomAlias(roomId)
                roomId = room.room_id;
            }
            catch (error) {
                Promise.reject(error.errcode);
                res.send(error.errcode);
                return;
            }
        }

        bot.getLocalHistory(roomId, req.params.eventId, req.params.eventCount, function(events) {
            res.send(events.map(event => {
                return {
                    line: event.content_body.replace(/\[([^\]]+)\][^\)]+\)/g, '$1'),
                    part: event.sender
                }}));
        });
    });

    app.get('/fetch/:roomId/:eventId', function(req, res) {
        client.fetchRoomEvent(req.params.roomId, req.params.eventId).then((event) => {
            
            res.send(event);
            // message sent successfully
         }).catch((err) => {
             console.log(err);
         });
    });

    app.get('/context/:roomId/:eventId', async function(req, res) {
        var roomId = req.params.roomId;
        if (roomId[0] !== '!') {
            try {
                if (roomId[0] !== '#') { roomId =  '#' + roomId; }
                var room = await client.resolveRoomAlias(roomId)
                roomId = room.room_id;
            }
            catch (error) {
                throw new Error();
            }
        }
        bot.getContext(roomId, req.params.eventId, function(err, paginated) {
            if (err) {
                res.send({success:false, error: err.stack});
            } else {
                res.send({success:true, paginated: paginated});
            }
        });
    });
    
    app.listen(1416, function () {  
        console.log('Example app listening on port 1416!');  
    });
}

module.exports = {
    start: start
}