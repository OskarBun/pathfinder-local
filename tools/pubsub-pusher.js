var config = require('../lib/config');
var pubsub = require('../lib/pubsub');

pubsub.get(function(_, pb){
    pb._ps.publish('SPHERE/DATA/ENV/ELEC', JSON.stringify({uid:'87654'}), function(){
        console.log("Pushed");
    });
});
