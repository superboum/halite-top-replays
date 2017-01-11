var request = require('request');
var fs = require('fs');
var queue = require('queue');

function handleJSON(cb) {
  return function (error, response, body) {
    if (!error && response.statusCode == 200) {
      data = JSON.parse(body);
      cb(null, data);
    } else {
      cb("FAILED");
    }
  }
}

function getUserList(limit, cb) {
  request('https://halite.io/api/web/user?fields%5B%5D=isRunning&values%5B%5D=1&orderBy=rank&limit='+limit+'&page=0', handleJSON(cb));
}

function getReplays(uid, limit, cb) {
  request('https://halite.io/api/web/game?userID='+uid+'&limit='+limit, handleJSON(cb));
}

function downloadReplay(name, cb) {
  if (fs.existsSync(name)) {
    console.log("already downloaded");
    cb("downloaded");
  } else {
    console.log('https://s3.amazonaws.com/halitereplaybucket/'+name);
    request({ method: 'GET', uri: 'https://s3.amazonaws.com/halitereplaybucket/'+name, gzip: true}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        cb(null, body);
      } else {
        cb("FAILED");
      }
    });
  }
}

var q = queue();
var nUser = 40;
var nReplay = 30;

q.concurrency = 10;

q.on('success', function(result, job) {
  console.log('job finished processing');
});

getUserList(nUser, function(err, ulist) {
  ulist.users.forEach(function(user) {
    getReplays(user.userID, nReplay, function(err, rlist) {
      rlist.forEach(function(replay) {
        q.push(function(cb) {
          downloadReplay(replay.replayName, function(err, content) {
            if (err == "downloaded") { cb(); return; }
            fs.writeFile(replay.replayName, content, function (err) {
              cb();
              if (err) return console.log(err);
              console.log('wrote '+replay.replayName);
            });
          });
        });
        if (q.length == nUser * nReplay) {
          console.log("start downloads");
          q.start(function(err) {
            console.log('all done');
          });
        }
      });
    });
  });
});

