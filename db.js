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

module.exports.saveEvent = saveEvent;