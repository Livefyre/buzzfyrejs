define(['jquery'], function($) {

    /**
     * @param {Object} opts
     * @param {function()=} opt_callback
     * @param {function()=} opt_errback
     */
    var deleteReview = function(opts, opt_callback, opt_errback) {
        var url = [
            "http://quill.",
            opts.network,
            "/api/v3.0/message/",
            opts.messageId,
            "/delete/?lftoken=",
            opts.lftoken
        ].join("");

        var data = {
            message_id: opts.messageId,
            collection_id: opts.collectionId,
            site_id: opts.siteId
        };

        sendRequest(url, data, opt_callback, opt_errback);
    };

    /**
     * @param {Object} opts
     * @param {function()=} opt_callback
     * @param {function()=} opt_errback
     */
    var postReview = function(opts, opt_callback, opt_errback) {
        var url = [
            "http://quill.",
            opts.network,
            "/api/v3.0/collection/",
            opts.collectionId,
            "/post/review/?lftoken=",
            opts.lftoken
        ].join("");

        var data = {
            body: (new Date()).toISOString(),
            title: 'test',
            rating: JSON.stringify(opts.ratings)
        };

        sendRequest(url, data, opt_callback, opt_errback);
    };

    /**
     * @param {string} url
     * @param {Object} data
     * @param {function()=} opt_callback
     * @param {function()=} opt_errback
     */
    var sendRequest = function(url, data, opt_callback, opt_errback) {
        var callback = opt_callback || function() {};
        var errback = opt_errback || function() {};

        $.ajax({
            type: "POST",
            url: url,
            data: data,
            headers: {'Content-Type': 'application/xml'},
            success: function(data, status, jqXhr) {
                callback(data);
            },
            error: function(jqXhr, status, err) {
                errback(err);
            }
        });
    };

    return {
        deleteReview: deleteReview,
        postReview: postReview
    };
});
