//Extended by Oskar Bunyan

var request = require('request');
var config = require('./config');
var pubsub = require('./pubsub');
var db = require('./mongo');
var schema = require('./cat_schema.json');

var datahub_cat_uri = 'http://' + config.sync.url + '/cats/' + config.sync.home_id;

function sanitize(doc) {
    delete doc._id;
    delete doc.cat_id;
    return doc;
}

function send_sync(cat) {
    request({
        uri: datahub_cat_uri,
        method: 'POST',
        headers: {
            "content-type": "application/json"
        },
        json: cat
    }, function(err, http, resp){
        if(err){
            console.error(err.message);
        }
        console.log("Created cat in DataHub, subscribing now..");
        sub_up();
    })
}

function sync(){
    var cat = {}
    items = db.get().collection('items');
    cats = db.get().collection('cats');
    cats.findOne({cat_id: config.root_cat}, function(err, cat_doc) {
        if(err){
            cat = schema
            send_sync(cat)
        } else {
            items.find({cat_id: config.root_cat}, function(err, cursor){
                cursor.toArray(function(err, docs) {
                    cat = sanitize(cat_doc)
                    cat.items = docs.map(sanitize)
                    //send to datahub
                    send_sync(cat)
                })
            })
        }
    })
}

function sub_up(){
    pubsub.get(function(err, conn){
        conn.subscribe(config.root_cat+"/*", function(cat_id, msg){
            // console.log("REDIS EVENT: ", arguments);
            doc = JSON.parse(msg)
            console.log(msg);
            request({
                uri: datahub_cat_uri + '?href='+doc.href,
                json: doc,
                method: doc === "" ? 'DELETE':'POST',
                headers: {
                    "content-type": "application/json"
                }
            }, function(err, http, resp) {
                if(err){
                    console.error(err.message);
                }
                console.log("DataHub: ", resp);
            });
        });
    });
}

if(config.sync.home_id && config.sync.home_id != 'DATAHUB'){
    request({
        uri: datahub_cat_uri,
        method: 'GET'
    }, function(err, http, resp){
        if(err && err.code === 'ENOTFOUND'){
            //Could not find DataHub, Should try again
            console.log('Could not find DataHub Trying again in');
        }
        else if(err){
            console.error(err.message)
        }
        else if(http.statusCode === 200){
            //Our Homecatalogue Exists -> sub events to sync
            console.log("Found cat in DataHub, subscribing now...");
            console.log(resp);
            sub_up()
        }
        else if(http.statusCode === 404){
            //Our Homecatalogue Doesn't Exist (Must be first setup) -> Create Cat in Datahub -> sub events to sync
            console.log("Home cat not in DataHub, creating...");
            //Should get My cat
            sync()
        }
    });
}
