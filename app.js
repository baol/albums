const heos = require('heos-api')
const tidal_sid = 10;
var first_pid = null;

var express = require('express');
var app = express();

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.static('public'))

heos.discoverAndConnect().then(connection => {
    connection.on({ commandGroup: 'system', command: 'get_players' },
        (data) => {
            console.log("Using player: ", data.payload[0].name, data.payload[0].model);
            first_pid = data.payload[0].pid
        }).write("system", "get_players")
});

app.get('/', (_, res) => {
    var albums = []
    var range_start = 0;
    const page_size = 100;
    heos.discoverAndConnect().then(connection => {
        connection
            .on({ commandGroup: 'browse', command: 'browse' }, data => {
                console.log("browse", data.heos.result, data.heos.message.parsed);
                if (data.payload) {
                    albums.push(...data.payload);
                    if (data.heos.message.parsed.returned > 0) {
                        range_start += data.heos.message.parsed.returned;
                        connection.write('browse', 'browse', { sid: tidal_sid, cid: "My Music-Albums", range: range_start + "," + (range_start + page_size - 1) })
                    } else {
                        albums.sort((a, b) => {
                            if (a.artist.toUpperCase() < b.artist.toUpperCase()) return -1;
                            if (a.artist.toUpperCase() > b.artist.toUpperCase()) return 1;
                            if (a.artist.toUpperCase() === b.artist.toUpperCase()) {
                                if (a.name.toUpperCase() < b.name.toUpperCase()) return -1;
                                if (a.name.toUpperCase() > b.name.toUpperCase()) return 1;
                                return 0;
                            }
                        });
                        res.render("albums.ejs", { albums: albums })
                    }
                }
            })
            .onError(console.log)
            .write('browse', 'browse', { sid: tidal_sid, cid: "My Music-Albums" })
    });
});

app.get('/play', (req, res) => {
    heos.discoverAndConnect().then(connection => {
        connection.on({ commandGroup: 'browse', command: 'add_to_queue' },
            (data) => {
                console.log("add_to_queue", data.heos.result, data.heos.message.parsed);
            })
            .write('browse', 'add_to_queue', {
                pid: first_pid, sid: tidal_sid, aid: 4, cid: req.query.cid
            });
    });
    res.write("Command queued.");
});

app.get('/volume', (req, res) => {
    heos.discoverAndConnect().then(connection => {
        connection
            .on({ commandGroup: 'player', command: 'set_volume' },
                (data) => {
                    console.log("set_volume", data.heos.result, data.heos.message.parsed);
                })
            .write('player', 'set_volume', {
                pid: first_pid, level: req.query.level
            });
    });
    res.write("Command queued.");
});

app.listen(3000, () => {
    console.log('App listening on port http://localhost:3000 ');
});