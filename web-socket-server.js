const WebSocket = require('ws');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('../database/database.sqlite');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

function broadcast(data) {
  wss.clients.forEach((client) => {
    client.send(data);
  });
}

function dbQueries(dataList, callback){
    // dont try to insert aanything when initializing the page
    if(dataList.comment !== ""){
      db.run('INSERT INTO comments(comment, creator, date, activity) VALUES(?, ?, ?, ?)',
            [dataList.comment, dataList.creator, dataList.date, dataList.activityId],
            (err) => {
        if(err) {
          return console.log(err.message); 
        }
      });
    }
    // get all of the current comments for this activity
    db.all('SELECT * FROM comments where activity = ?', [dataList.tableId], (err, rows) => {
      if(err) {
        return console.log(err.message); 
      }
      return callback(rows);
    });

}

wss.on('connection', (ws) => {  
  ws.on('message', (message) => {
    let dataList = JSON.parse(message);
    let { type } = JSON.parse(message);
    console.log('Received:', type);
    // broadcast if users number changed
    if (type === 'total-users-changed') {
      broadcast(JSON.stringify({
        type,
        data: wss.clients.size
      }));
    } else {
      // insert a comment into the comment database and return comments
      // for this activity
      dbQueries(dataList, function (result) {
        let data = JSON.stringify({
            type: 'new-post',
            sqlResults: result,
            table_id: dataList.tableId 
        });
        // now broadcast the message
        broadcast(data);
      });
    }
  });

  ws.on('close', () => {
    broadcast(JSON.stringify({
      type: 'total-users-changed',
      data: wss.clients.size
    }));
  });
});