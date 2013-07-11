require(['requirejs.conf'], function (Config) {
    require([
        'buzzfyrejs'
    ], function(buzzfyrejs) {
        console.log('Loaded dev scripts');
        console.log(arguments);

        window.buzz = new buzzfyrejs({
            "network": "livefyre.com",
            "siteId": "304054",
            "articleId": "55123500535",
            "environment": "t402.livefyre.com"
        });
    });
});