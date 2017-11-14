//Extended by Oskar Bunyan

var request = require('request');
// request.debug = true;
var fs = require('fs');
var config = require('./config');
var pubsub = require('./pubsub');
var db = require('./mongo');
var schema = require('./cat_schema.json');

var datahub_cat_uri = config.sync.url + '/cats/' + config.sync.home_id;

var auth = {
    user: null,
    pass: null,
}

fs.readFile(config.auth.cred_path + 'activity-pwd', "utf8", function(err, data){
    if(err) throw err;
    auth.pass = data.trim();
})

fs.readFile(config.auth.cred_path + 'activity-uname', "utf8", function(err, data){
    if(err) throw err;
    auth.user = data.trim();
})

function sanitize(doc) {
    delete doc._id;
    delete doc.cat_id;
    return doc;
}

function send_sync(cat) {
    let delay = 100;
    (function sync_request(){
        request({
            uri: datahub_cat_uri,
            method: 'POST',
            headers: {
                "content-type": "application/json"
            },
            auth: auth,
            json: cat,
            strictSSL: false
        }, function(err, http, resp){
            if(err && (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') || http.statusCode === 503){
                delay = delay > 8.64e+7 ? 8.64e+7 : delay*delay
                setTimeout(sync_request, delay);
            } else if (err) {

            } else {
                console.log("Created cat in DataHub, subscribing now..");

                sub_up();
            }
        })
    })()
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
            doc = JSON.parse(msg)
            let delay = 100;
            (function send_change(){
                console.log(cat_id);
                request({
                    uri: datahub_cat_uri + '?href='+cat_id.split(config.root_cat+'/')[1],
                    json: doc === "" ? undefined : doc,
                    method: doc === "" ? 'DELETE':'POST',
                    headers: doc === "" ? undefined: {
                        "content-type": "application/json",
                    },
                    auth: auth,
                    strictSSL: false
                }, function(err, http, resp) {
                    if(err && (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') || http.statusCode === 503){
                        delay = delay > 8.64e+7 ? 8.64e+7 : delay*delay
                        console.log("Event Sync failed trying again in :"+delay+"ms");
                        setTimeout(send_change, delay);
                    }
                    console.log("DataHub: ", resp);
                });
            })()
        });
    });
}

if(config.sync.home_id && config.sync.home_id != 'DATAHUB'){

    let delay = 100;

    setTimeout(function find_datahub(){
        request({
            uri: datahub_cat_uri,
            method: 'GET',
            auth: auth
        }, function(err, http, resp){
            if(err && (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') || http.statusCode === 503){
                //Could not find DataHub, Should try again
                delay = delay > 8.64e+7 ? 8.64e+7 : delay*delay

                console.log('Could not find DataHub @'+datahub_cat_uri+' \nTrying again in: '+delay+'ms');
                setTimeout(find_datahub, delay);
            }
            else if(err){
                console.error(err)
            }
            else if(http.statusCode === 200){
                //Our Homecatalogue Exists -> sub events to sync
                console.log("Found cat in DataHub, syncing and subscribing now...");
                sync()
            }
            else if(http.statusCode === 404){
                //Our Homecatalogue Doesn't Exist (Must be first setup) -> Create Cat in Datahub -> sub events to sync
                console.log("Home cat not in DataHub, creating...");
                sync()
            }
        });
    }, 1000)


}
