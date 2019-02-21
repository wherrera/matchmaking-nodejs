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

const {Player, PlayerManager} = require('./player_manager.js');

const playerManager = new PlayerManager();

const JWT_SECRET = "h28dg926as9821gjhsdf82hkbcxz981";
const PLAYER_ID_SALT = "9ahk239fb23oi29sdnjk23090u23n";
const PLAYER_TIMEOUT = (process.env.PLAYER_TIMEOUT || 60000);
const MATCHMAKER_INTERVAL = (process.env.MATCHMAKER_INTERVAL || 3000);
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
var currentMatchId = 0;

function CurrentTime() {
    return Date.now() - start;
}

function SHA1(data) {
    return crypto.createHash("sha1").update(data, "binary").digest("hex");
}

function matchmaker()
{
    let drop = [];

    for(let i=0; i < playerManager.playerCount; i++)
    {
        let player = playerManager.players[i];

            if(player.matched == false)
            {
                let time_since_last_seen = CurrentTime() - player.last_seen;

                if(time_since_last_seen > PLAYER_TIMEOUT)
                {
                    drop.push(i);
                    continue;
                }

                let matched_player = playerManager.findWithCriteria(player.id, player.criteria);

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
                }     
            }

        //console.log("player: " + JSON.stringify(player));
    }

    if(drop.length > 0) {
        //console.log("==== Dropping ====");
        drop.forEach(function(i) {
            playerManager.remove(i);
        });
    }
}

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

engine.get("/queue", function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let player_id = token.id;
    let player_criteria = query.criteria;

    let player = playerManager.getPlayer(player_id);
    let payload = {};

    if(player == null) {
        player = new Player(player_id,"player-" + player_id);
        player.last_seen = CurrentTime();

        if (player_criteria)
            player.criteria = player_criteria;

        console.log("adding player: " + player_id);
        playerManager.add(player);
    }

    payload.state = MATCH_STATES[STATE_IN_QUEUE];
    payload.player = player;

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write( JSON.stringify(payload) );
    res.end();
});

engine.get("/poll", function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let player_id = token.id;

    let player = playerManager.getPlayer(player_id);

    let payload = {};

    if(player != null)
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

engine.get("/drop", function(req, res) {

    var query = url.parse(req.url, true).query;

    var token = jwt.verify(query.access_token, JWT_SECRET);

    let player_id = token.id;

    let player = playerManager.getPlayer(player_id);

    if(player != null)
    {
        if( playerManager.removePlayer(player) )
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

setInterval(matchmaker, MATCHMAKER_INTERVAL);