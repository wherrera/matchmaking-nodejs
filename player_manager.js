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

class Player
{
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.matched = false;
        this.criteria = "map:any";
    }
}

class PlayerManager {
    constructor() {
        this.players = [];
    }

    get playerCount() {
        if(!this.players.length)
            return 0;

        return this.players.length;
    }

    remove(index) {
        this.players.splice(index, 1);
    }

    removePlayer(player) {
        for(let i=0; i < this.players.length; i++)
        {
            if(this.players[i] == player)
            {
                this.remove(i);
                return true;
            }
        }
        return false;
    }

    findWithCriteria(id, criteria) {
        return this.players.find(function(player) {
            return  player.criteria === criteria &&
                    player.matched == false &&
                    player.id !== id;
        });
    }

    hasPlayer(id) {
        return this.players.find(function(player) {
            return player.id === id;
        });
    }

    getPlayer(id) {
        return this.players.find(function(player) {
            return player.id === id;
        });
    }

    add(player) {
        this.players.push(player);
    }
}

module.exports = {
    Player,
    PlayerManager
};