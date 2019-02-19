# matchmaking-nodejs
Simple Matchmaking in Node.js

## Login using a unique-id / device-id
### /login?id={user_id}
```javascript
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTA0NDk1MjcsImlkIjoiMjFkZjllODk2NjdjYjk5OWExNTU5NDJiMWY3NzNhY2VmZTU0N2Y2MyIsImlhdCI6MTU1MDQ0NTkyN30.lyNmrxk54SYZAaPCmlXLHCvdEEAWMx-YTtzDtg4Ue00"
}
```

## Enter matchmaking queue
### /queue?access_token={access_token}&criteria={criteria_string}
```javascript
{
    "state": {
        "id": 1,
        "message": "in queue."
    },
    "player": {
        "id": "21df9e89667cb999a155942b1f773acefe547f63",
        "name": "player-21df9e89667cb999a155942b1f773acefe547f63",
        "matched": false,
        "criteria": "map:test",
        "last_seen": 15556
    }
}
```

## Check matchmaking status
### /poll?access_token={access_token}
```javascript
{
    "player": {
        "id": "21df9e89667cb999a155942b1f773acefe547f63",
        "name": "player-21df9e89667cb999a155942b1f773acefe547f63",
        "matched": false,
        "criteria": "map:test",
        "last_seen": 49870,
        "time_since_last_seen": 34314
    },
    "state": {
        "id": 1,
        "message": "in queue."
    }
}
```

## Match found
### /poll?access_token={access_token}
```javascript
{
    "player": {
        "id": "21df9e89667cb999a155942b1f773acefe547f63",
        "name": "player-21df9e89667cb999a155942b1f773acefe547f63",
        "matched": true,
        "criteria": "map:test",
        "last_seen": 31688,
        "match": {
            "id": 1,
            "players": [
                "21df9e89667cb999a155942b1f773acefe547f63",
                "97bcf91497d834b05e62be675b0cd1c3b960303e"
            ]
        },
        "time_since_last_seen": 17352
    },
    "state": {
        "id": 2,
        "message": "matched in queue."
    }
}
```

## Drop from queue
### /drop?access_token={access_token}
```javascript
{
    "message": "player removed from queue."
}
```
