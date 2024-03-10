const Heos = require('heos-api')
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 7200 });
const tidal_sid = 10;
var first_pid = null;
var express = require('express');
var app = express();

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.static('public'))

Heos.discoverAndConnect().then(connection => {
    connection.on({ commandGroup: 'system', command: 'get_players' },
        (data) => {
            console.log("Using player: ", data.payload[0].name, data.payload[0].model);
            first_pid = data.payload[0].pid;
        }).write("system", "get_players")
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

const update_cache = () => {
    var albums = []
    var range_start = 0;
    const page_size = 50;
    Heos.discoverAndConnect().then(connection => {
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
                        cache.set("albums", albums);
                    }
                }
            })
            .onError(console.log)
            .write('browse', 'browse', { sid: tidal_sid, cid: "My Music-Albums" })
    });
}

update_cache();

app.get('/', async (_, res) => {
    update_cache();
    count = 0;
    max_polls = 50;
    ret_albums = cache.get("albums");
    while (ret_albums == undefined && count < max_polls) {
        ret_albums = cache.get("albums");
        await sleep(100);
        count++;
    }
    if (count == max_polls)
        res.send("Timed out, please wait a few seconds then reload");
    else
        res.render("albums.ejs", { albums: ret_albums })
});

app.get('/play', (req, res) => {
    Heos.discoverAndConnect().then(connection => {
        connection.on({ commandGroup: 'browse', command: 'add_to_queue' },
            (data) => {
                console.log("add_to_queue", data.heos.result, data.heos.message.parsed);
                res.send("Playing album...");
            })
            .write('browse', 'add_to_queue', {
                pid: first_pid, sid: tidal_sid, aid: 4, cid: req.query.cid
            });
    });
});

app.get('/volume', (req, res) => {
    Heos.discoverAndConnect().then(connection => {
        connection
            .on({ commandGroup: 'player', command: 'set_volume' },
                (data) => {
                    console.log("set_volume", data.heos.result, data.heos.message.parsed);
                    res.send("Volume set!");
                })
            .write('player', 'set_volume', {
                pid: first_pid, level: req.query.level
            });
    });
});

app.listen(3000, () => {
    console.log('App listening on port http://localhost:3000 ');
});