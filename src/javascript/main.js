define([
    'jquery',
    'streamhub-sdk/clients/livefyre-bootstrap-client',
    'streamhub-sdk/streams/livefyre-stream',
    'buzzfyrejs/livefyre-review-client'
], function($, BootstrapClient, StreamClient, ReviewClient) {

    /** @param {Object} opts */
    var buzzfyrejs = function(opts) {
        
        var bsOpts = opts;
        bsOpts.extension = ' ';
        var bsData = BootstrapClient.getContent(bsOpts, function(n, data) {

            console.log(data);

        });



    };

    return buzzfyrejs;
});
