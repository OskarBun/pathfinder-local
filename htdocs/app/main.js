import Vue from 'vue/dist/vue.js';
import Resource from 'vue-resource';

Vue.use(Resource);

Vue.http.headers.common['Authorization'] = btoa("LETMEIN:");

Vue.config.devtools = true;

var app = window.app = new Vue({
    el: '.app',
    data(){
        return {
            perms: {},
            newPerm: ""
        }
    },
    methods: {
        addPerm() {
            this.$http.post(`/permissions/${this.newPerm}`, {
                rules: [
                    {
                        op: '*',
                        rsrc: '*'
                    }
                ]
            }, (result)=>{
                console.log(result);
            });
        }
    },
    mounted(){
        this.$http.get("/permissions", (result) => {
            console.log(result);
        });
    }
});
