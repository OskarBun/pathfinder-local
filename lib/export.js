var broker = require('./pubsub'),
    mongo = require('./mongo'),
    config = require('./config')
    fs = require('fs');

var write = function(){
    var cats = mongo.get().collection('cats'),
        items = mongo.get().collection('items');
    cats.findOne({cat_id: config.root_cat}, function(err, cat_doc) {
        if(cat_doc != null){

            delete cat_doc.cat_id
            delete cat_doc._id;

            items.find({cat_id: config.root_cat}, function(err, cursor){
                if(!err){
                    cursor.toArray(function(err, docs) {
                        for (var index in docs) {
                            delete docs[index]._id;
                            delete docs[index].cat_id;
                        }
                        cat_doc.items = docs;
                        fs.writeFile(config.export_path, JSON.stringify(cat_doc), function (err) {
                            if (err) return console.log(err);
                        });
                    });
                }
            });

        }
    });
}

exports.write_json = write;

broker.get(function(_, pubsub){
    pubsub.subscribe(config.root_cat+"/*", function(cat_id, doc){

        write();

    });
});
