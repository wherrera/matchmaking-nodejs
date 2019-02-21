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

var handlers = [
    {
        "path" : "/",
        "handler": function(req, res) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write( JSON.stringify(handlers) );
            res.end();
        }
    }
];

exports.get = function (pathname, handler) {
    handlers.push({
        "path": pathname,
        "handler": handler
    });
};

exports.LoadBodyAsync = async function (req)
{
    return new Promise(resolve => {
        let body = [];
        req.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body).toString();
            resolve(body)
        });
    });
}

exports.handleRequest = async function (req, res) {
        let u = url.parse(req.url);
    
        if(req.method === "POST") {
            req.body = await exports.LoadBodyAsync(req);
        }

        let pathname = u.pathname;
        //console.log("pathname: " + handlers);

        for(let i=0; i < handlers.length; i++)
        {
            let handler = handlers[i];

            //console.log("path: " + handler.path);

            if(handler.path === pathname) {
                //console.log("found handler!");
                try {
                    handler.handler(req, res);
                } catch(e) {
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.write(`{"Internal Server Error": "${e}" }`);
                    res.end();
                }
                return;
            }
        }

        res.writeHead(500, {'Content-Type': 'application/json'});
        res.write(`{"invalid": "${pathname}" }`);
        res.end();
};

exports.start = function () {
    http.createServer(exports.handleRequest).listen((process.env.PORT || 5000));
}