//Extended by Oskar Bunyan

var request = require('request');
var config = require('./config');
var pubsub = require('./pubsub');
var schema = require('./cat_schema.json');

var datahub_cat_uri = 'http://' + config.sync.url + '/cats/' + config.sync.home_id;

function sub_up(){
    pubsub.get(function(err, conn){
        conn.subscribe(config.root_cat+"/*", function(cat_id, doc){
            console.log("REDIS EVENT: ", arguments);

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
            sub_up();
        }
        else if(http.statusCode === 404){
            //Our Homecatalogue Doesn't Exist (Must be first setup) -> Create Cat in Datahub -> sub events to sync
            console.log("Home not in DataHub, creating...");
            request({
                uri: datahub_cat_uri,
                method: 'POST',
                headers: {
                    "content-type": "application/json"
                },
                json: schema
            }, function(err, http, resp){
                if(err){
                    console.error(err.message);
                }
                console.log("Created cat in DataHub, subscribing now..");
                sub_up();
            })
        }
    });
}
