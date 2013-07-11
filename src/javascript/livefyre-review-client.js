define(['jquery'], function($) {

    /**
     * @param {Object} opts
     * @param {function} opt_callback
     */
    var postReview = function(opts, opt_callback) {
        var url = [
            "http://quill.",
            opts.network,
            "/api/v3.0/collection/",
            opts.collectionId,
            "/post/"
        ].join("");

        var callback = opt_callback || function() {},
            data = {
                body: '',
                lftoken: opts.lftoken,
                reviews: {}
            };

        $.ajax({
            type: "POST",
            url: url,
            data: data,
            success: function(data, status, jqXhr) {
                callback(null, data);
            },
            error: function(jqXhr, status, err) {
                callback(err);
            }
        });
    };

    return {
        postReview: postReview
    };
});
