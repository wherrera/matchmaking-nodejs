/*
MIT License

Copyright (c) 2019 William Herrera

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const http = require('http');
const url = require('url');
const crypto = require("crypto");
const jwt  = require('jsonwebtoken');
const engine = require('./engine');

const JWT_SECRET = process.env.JWT_SECRET || "h28dg926as9821gjhsdf82hkbcxz981";
const PLAYER_ID_SALT = process.env.PLAYER_ID_SALT || "9ahk239fb23oi29sdnjk23090u23n";
const PLAYER_TIMEOUT = process.env.PLAYER_TIMEOUT || 60000;
const MATCHMAKER_INTERVAL = process.env.MATCHMAKER_INTERVAL || 3000;
const MAX_PLAYER_COUNT = 2;

const STATE_NOT_IN_QUEUE = 0;
const STATE_IN_QUEUE = 1;
const STATE_MATCHED_IN_QUEUE = 2;

const MATCH_STATES = [
    {
        "id": 0,
        "message": "not in queue."
    },
    {
        "id": 1,
        "message": "in queue."
    },
    {
        "id": 2,
        "message": "matched in queue."
    },
];

var start = Date.now();
var m_LastMatchJob = start;
var currentMatchId = 0;

const redis = require('redis').createClient(process.env.REDIS_URL);
const {promisify} = require('util');
const hgetallAsync = promisify(redis.hgetall).bind(redis);

redis.on('error', function (err) {
    console.log('Redis Error: ' + err);
});

async function LoadDataModel()
{
    var data = await hgetallAsync("players");

    var keys = [];
    
    if (data != null) {
        keys = Object.keys(data);
    }

    if (data == null)
        data = [];

    for(let i=0; i < keys.length; i++) {
        let json = data[keys[i]];
        data[keys[i]] = JSON.parse(json);
    }

    let dataModel = {
        "data": data,
        "keys": keys,
        "count": keys.length,
        "updateTtl": function() {
            redis.expire('players', 60);
        },
        "getIndex": function(index) {
            return this.data[this.keys[index]];
        },
        "getById": function(id) {
            return this.data[id];
        },
        "insert": function(player) {
            redis.hmset("players", player.id, JSON.stringify(player));
        },
        "update": function(player) {
            redis.hmset("players", player.id, JSON.stringify(player));
        },
        "delete": function(player) {
            redis.hdel('players', player.id);
        },
        "findWithCriteria": function(id, criteria) {
            for(let i=0; i < this.count; i++)
            {
                let player = this.getIndex(i);

                if( player.criteria === criteria &&
                    player.matched == false &&
                    player.id !== id) {
                        return player;
                    }
            }
            return null;
        },
    };

    return dataModel;
}

function CurrentTime() {
    return Date.now() - start;
}

function SHA1(data) {
    return crypto.createHash("sha1").update(data, "binary").digest("hex");
}

engine.get("/status",function(req, res) {

    let now = Date.now();
    let lastStarted = now - m_LastMatchJob;

    let status = {"status" : "Last Matchmaking Job: " + lastStarted};

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write( JSON.stringify(status) );
    res.end();
});

engine.get("/login",function(req, res) {

    var query = url.parse(req.url, true).query;

    let id = SHA1( query.id + PLAYER_ID_SALT );

    let token = jwt.sign({
        "exp": Math.floor(Date.now() / 1000) + (60 * 60), //1hr
        "id": id
      }, JWT_SECRET);

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write( JSON.stringify({"token": token}) );
    res.end();
});

engine.get("/queue", async function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player_id = token.id;

    let player = dataModel.getById(player_id);

    let payload = {
        "player": player,
        "state": MATCH_STATES[STATE_IN_QUEUE]
    };

    if (player == null)
    {
        player = {
            "id": player_id,
            "matched": false,            
            "criteria": query.criteria ? query.criteria : "default",
            "last_seen": CurrentTime()
        }
        payload.player = player;

        console.log("adding player: " + player_id);

        dataModel.insert(player);
    }
    else {
        if(player.matched)
            payload.state = MATCH_STATES[STATE_MATCHED_IN_QUEUE];
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write( JSON.stringify(payload) );
    res.end();
});

engine.get("/poll",async function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player = dataModel.getById(token.id);

    let payload = {};

    if (player != null)
    {
        player.time_since_last_seen = CurrentTime() - player.last_seen;
        player.last_seen = CurrentTime();
        payload.player = player;

        if(player.matched) {
            payload.state = MATCH_STATES[STATE_MATCHED_IN_QUEUE];
        } else {
            payload.state = MATCH_STATES[STATE_IN_QUEUE];
        }
    }
    else {
        payload.state = MATCH_STATES[STATE_NOT_IN_QUEUE];
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write( JSON.stringify(payload) );
    res.end();
});

engine.get("/drop",async function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player_id = token.id;

    let player = dataModel.getById(player_id);

    if(player != null)
    {
        dataModel.delete(player);
        {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write( JSON.stringify({"message":"player removed from queue."}) );
            res.end();
        }
    }
    else {
        throw "invalid user_id: " + player_id;
    }
});

engine.start();

setInterval(async function()
{
    let dataModel = null;

    try {
        dataModel = await LoadDataModel();
    } catch(e) {
        console.log(e);
    }

    let now = Date.now();
    let lastStarted = now - m_LastMatchJob;
    m_LastMatchJob = now;

    console.log("Last Matchmaking Job: " + lastStarted + ", in-queue: " + dataModel.count );

    for(let i=0; i < dataModel.count; i++)
    {
        let player = dataModel.getIndex(i);

            if(player.matched == false)
            {
                let time_since_last_seen = CurrentTime() - player.last_seen;

                if(time_since_last_seen > PLAYER_TIMEOUT)
                {
                    console.log("player timedout: " + player.id);
                    dataModel.delete(player);
                    continue;
                }

                let matched_player = dataModel.findWithCriteria(player.id, player.criteria);

                if(matched_player != null)
                {
                    currentMatchId++;

                    player.matched = true;
                    matched_player.matched = true;

                    let match = {
                        "id": currentMatchId,
                        "players": [player.id, matched_player.id]
                    };

                    player.match = match;
                    matched_player.match = match;

                    redis.hmset("players", player.id, JSON.stringify(player));
                    redis.hmset("players", matched_player.id, JSON.stringify(matched_player));
                }     
            }
    }
}, MATCHMAKER_INTERVAL);