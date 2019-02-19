# matchmaking-nodejs
Simple Matchmaking in Node.js


##/login?id={user_id}
```javascript
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1NTA0NDk1MjcsImlkIjoiMjFkZjllODk2NjdjYjk5OWExNTU5NDJiMWY3NzNhY2VmZTU0N2Y2MyIsImlhdCI6MTU1MDQ0NTkyN30.lyNmrxk54SYZAaPCmlXLHCvdEEAWMx-YTtzDtg4Ue00"
}
```


##/queue?access_token={access_token}&criteria={criteria_string}
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


##/poll?access_token={access_token}
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


##/drop?access_token={access_token}
```javascript
{
    "message": "player removed from queue."
}
```