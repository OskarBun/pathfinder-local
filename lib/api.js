/** Copyright (c) 2013 Toby Jaffey <toby@1248.io>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
//Sets up enviroment variables
require('dotenv').config({silent: true});

var express = require('express'),
    config = require('./config'),
    path = require('path'),
    http = require('http'),
    fs = require('fs'),
    https = require('https'),
    mongo = require('./mongo'),
    cat = require('./cat'),
    perm = require('./perm'),
    auth = require('./auth'),
    cors = require('cors'),
    exp = require('./export'),
    ws = require('./websocket');


require('./sync');


if (config.root_cat === undefined) {
    console.log("no root_cat configured");
    process.exit(1);
}

if (config.default_perms === undefined) {
    console.log("no default_perms configured");
    process.exit(1);
}

var express_options = {};
if (config.ssl.passphrase !== undefined) {
    express_options = {
        key: fs.readFileSync(config.ssl.privateKey),
        cert: fs.readFileSync(config.ssl.certificate),
        passphrase: config.ssl.passphrase
    };
} else {
    express_options = {
        key: fs.readFileSync(config.ssl.privateKey),
        cert: fs.readFileSync(config.ssl.certificate)
    };
}

var app = express();

app.configure(function () {
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.static(path.join(__dirname, config.htdocs), {index:'index.html'}));
    app.use(express.directory(path.join(__dirname, config.htdocs)));
    app.use(cors());
});


// Routes
app.get('/cats', cat.list);
app.get('/cats/:cat_id', cat.get);
app.post('/cats/:cat_id', cat.post);
app.put('/cats/:cat_id', cat.put);
app.delete('/cats/:cat_id', cat.delete);
app.get('/cats/:cat_id/events', cat.getevents);

app.get('/cat', cat.root_get);
app.post('/cat', cat.root_post);
app.put('/cat', cat.root_put);
app.delete('/cat', cat.root_delete);
app.get('/cat/events', cat.root_getevents);

app.get('/permissions', perm.list);
app.get('/permissions/:perm_id', perm.get);
app.post('/permissions/:perm_id', perm.post);
app.delete('/permissions/:perm_id', perm.delete);

app.get('/.well-known/core', cat.core_root_get);

mongo.get(function(err, db) {
    if (err) {
        console.log("Error mongodb %j", err);
        process.exit(1);
    }

    mongo.get().collection('cats').findOne({cat_id: config.root_cat}, function(err, cat_doc) {
        if(cat_doc === null){
            console.log("Root Cat does not exist, creating...");
            cat.__create_root_cat(function(){
                console.log("Root Cat Created");
            });
        }
    });

    var port = process.argv[2] || config.port;

    if (config.ssl.enabled) {
        var server = https.createServer(express_options, app)
        ws.setup({ server: server }); //Setups up ws server
        server.listen(port, function () {
            console.log("Pathfinder HTTPS server listening on port " + port);
        });
    } else {
        var server = http.createServer(app)
        ws.setup({ server: server }); //Setups up ws server
        server.listen(port, function () {
            console.log("Pathfinder HTTP server listening on port " + port);
        });
    }

    exp.write_json();
});
