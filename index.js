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

const crypto = require("crypto");
const jwt  = require('jsonwebtoken');
const express = require('express');

const JWT_SECRET = process.env.JWT_SECRET;
const PLAYER_ID_SALT = process.env.PLAYER_ID_SALT;
const PLAYER_TIMEOUT = process.env.PLAYER_TIMEOUT || 60000;
const MATCHMAKER_INTERVAL = process.env.MATCHMAKER_INTERVAL || 3000;
const PORT = process.env.PORT || 8080;
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

const redis = require('redis').createClient(process.env.REDIS_URL);
const {promisify} = require('util');
const hgetallAsync = promisify(redis.hgetall).bind(redis);

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

function requiresAuth(req, res, next)
{
    let access_token = null;
    if(req.query.access_token) {
        access_token = req.query.access_token;
    }
    else if(req.body.access_token) {
        access_token = req.body.access_token;
    } else {
        res.status(401).json({"error":"missing access_token"});
        return;
    }
    try{
        req.token = jwt.verify(access_token, JWT_SECRET);
    } catch(e) {
        res.status(500).json({"error":e});
        return;
    }
    if(req.token == null) {
        res.status(500).json({"error":"auth failed"});
    } else {
        next();
    }
}

var engine = express();

engine.use(express.json());

engine.get("/", function(req, res) {
    res.json({
            "status" : "ok",
            "last-job": Date.now() - m_LastMatchJob
        });
});

engine.get("/login",function(req, res) {

    if(!req.query.id) {
        res.status(500).json({"error":"missing id"});
        return;
    }

    let user_id = SHA1( req.query.id + PLAYER_ID_SALT );

    let token = jwt.sign({
        "exp": Math.floor(Date.now() / 1000) + (60 * 60 * 24), //24hr
        "id": user_id
      }, JWT_SECRET);

  res.json({
      "id": user_id,
      "token": token
    });
});

engine.get("/status", requiresAuth, function(req, res) {
    res.json({"user" : req.token});
});

engine.get("/queue/join", requiresAuth, async function(req, res) {

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player = dataModel.getById(req.token.id);

    let payload = {
        "player": player,
        "state": MATCH_STATES[STATE_IN_QUEUE]
    };

    if (player == null)
    {
        player = {
            "id": req.token.id,
            "matched": false,            
            "criteria": req.query.criteria ? req.query.criteria : "default",
            "last_seen": CurrentTime()
        }
        payload.player = player;

        dataModel.insert(player);
    }
    else {
        if(player.matched)
            payload.state = MATCH_STATES[STATE_MATCHED_IN_QUEUE];
    }

    res.json(payload);
});

engine.get("/queue/poll", requiresAuth, async function(req, res) {

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player = dataModel.getById(req.token.id);

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

    res.json(payload);
});

engine.get("/queue/drop", requiresAuth, async function(req, res) {

    let dataModel = await LoadDataModel();

    dataModel.updateTtl();

    let player = dataModel.getById(req.token.id);

    if(player != null)
    {
        dataModel.delete(player);
        {
            res.json({"message":"player removed from queue."});
        }
    }
    else {
        throw "invalid user_id: " + req.token.id;
    }
});

engine.listen(PORT);

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
                    console.log("player timed-out: " + player.id);
                    dataModel.delete(player);
                    continue;
                }

                let matched_player = dataModel.findWithCriteria(player.id, player.criteria);

                if(matched_player != null)
                {
                    let match_id = crypto.randomBytes(16).toString("hex");

                    player.matched = true;
                    matched_player.matched = true;

                    let match = {
                        "id": match_id,
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