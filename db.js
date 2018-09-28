const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('nozzleb.db', sqlite3.OPEN_READWRITE);

function saveEvent(event) {
    if (event.type !== "m.room.redaction" && event.type !== "m.room.message") {
        return;
    }

    if (event.content.body) event.content.body = event.content.body.replace(/\'/g, "''");

    var insertSql = `INSERT OR IGNORE INTO events(event_id, content_body, content_msgtype, origin_server_ts, room_id, sender, type, redacts) VALUES (
        '${event.event_id}',
        '${event.content.body || ''}',
        '${event.content.msgtype || ''}',
        ${event.origin_server_ts},
        '${event.room_id}',
        '${event.sender || event.user_id}',
        '${event.type}',
        '${event.redacts || ''}'
    )`;
    db.run(insertSql, function (err) {
        if (err) {
            console.log(err);
            console.log(insertSql);
            return;
        }
    });
}

function saveRoom(room) {
    if (room.topic) {
        room.topic = room.topic.replace(/\'/g, "''");
    } else {
        room.topic = '';
    }
    if (room.name) {
        room.name = room.name.replace(/\'/g, "''");
    } else {
        room.name = '';
    }
    var insertSql = `INSERT OR IGNORE INTO rooms(room_id, name, canonical_alias, guest_can_join, world_readable, num_joined_members, topic)
    VALUES (
        '${room.room_id}',
        '${room.name.replace(/\'/g, "''")}',
        '${room.canonical_alias}',
        ${room.guest_can_join},
        ${room.world_readable},
        ${room.num_joined_members},
        '${room.topic}'
    )`;

    db.run(insertSql, function(err) {
        if (err) {
            console.log(err);
            console.log(insertSql);
            return;
        }
    });
}

function saveAlias(room_id, alias) {
    var insertSql = `INSERT OR IGNORE INTO room_alias(room_id, alias)
    VALUES (
        '${room_id}',
        '${alias}'
    )`;

    db.run(insertSql, function(err) {
        if (err) {
            console.log(err);
            console.log(insertSql);
            return;
        }
    });
}

function saveMember(room_id, member) {
    var insertSql = `INSERT OR IGNORE INTO membership(room_id, user_id, power_level)
    VALUES (
        '${room_id}',
        '${member.userId}',
        ${member.powerLevel}
    )`;

    db.run(insertSql, function(err) {
        if (err) {
            console.log(err);
            console.log(insertSql);
            return;
        }
    });
}

function getLocalHistory(eventId, count, callback) {
    var selectSql = `
        SELECT * 
        FROM events 
        WHERE
        room_id = (SELECT room_id FROM events where event_id = '${eventId}')
        AND
        origin_server_ts >= (SELECT origin_server_ts FROM events where event_id = '${eventId}')
        ORDER BY origin_server_ts
        LIMIT ${count}`;

    db.all(selectSql, function(err, rows) {
        callback(rows);
    });
}

module.exports.saveEvent = saveEvent;
module.exports.saveRoom = saveRoom;
module.exports.saveAlias = saveAlias;
module.exports.saveMember = saveMember;
module.exports.getLocalHistory = getLocalHistory;