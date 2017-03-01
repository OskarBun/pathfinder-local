'use strict'

var WebSocket = require('ws');
var pubsub = require('./pubsub');
var mongo = require('./mongo');
var config = require('./config');


var setup = function(express_server){
    var wss = new WebSocket.Server(express_server)

    wss.on('connection', function(ws) {
        console.log('websocket opened');
        ws.on('message', function(message) {
            console.log('received: %s', message);
        });

        var current_items = null
        var sub_function = null
        //Get current items in mongo
        var items = mongo.get().collection('items').find({
            cat_id: config.root_cat,
            'i-object-metadata': { $all :
                [{
                    'val': 'Current Cost Appliance',
                    'rel': 'device_type'
                }]
            }
        });
        items.toArray(function(err, array){
            current_items = array.map(function(el){
                return el.href.replace('/','');
            });
        })


        //Open up pubsub
        pubsub.get(function(_, ps){
            sub_function = function(topic, payload){
                var msg = JSON.parse(payload);
                if(current_items && current_items.indexOf(msg.uid) === -1){
                    ws.send(JSON.stringify({uid: msg.uid}));
                };
            };
            ps._ps.subscribe('SPHERE/DATA/ENV/ELEC', sub_function)
        });


        ws.on('close', function(){
            console.log('websocket closed')
            //Close PUBSUB
            if(sub_function){
                pubsub.get(function(_, ps){
                    ps._ps.unsubscribe('SPHERE/DATA/ENV/ELEC', sub_function);
                });
            }
        })
    });
}


module.exports.setup = setup;
