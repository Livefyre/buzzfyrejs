define([
    'jquery',
    'streamhub-sdk/clients/livefyre-bootstrap-client',
    'streamhub-sdk/streams/livefyre-stream',
    'buzzfyrejs/livefyre-review-client',
    'buzzfyrejs/enums'
], function($, BootstrapClient, LivefyreStream, ReviewClient, Enums) {

    /** @param {Object} opts */
    var buzzfyrejs = function(opts) {
        var self = this;
        var bsOpts = opts;
        bsOpts.extension = ' ';

        /**
         * Container for all messages and their ratings.
         * @type {Object.<string, Array.<number>>}
         */
        this.content_ = {};

        /**
         * Whether there is a delete request that is currently processing.
         * @type {boolean}
         */
        this.isProcessingDelete_ = false;

        /**
         * Whether there is a post request that is currently processing.
         * @type {boolean}
         */
        this.isProcessingPost_ = false;

        /**
         * The config options that will be used later. This is mainly for the
         * add and remove request.
         * @type {Object}
         */
        this.opts_ = opts;

        /**
         * Rating dimensions for this collection. This gets populated by the
         * bootstrap request.
         * @type {Object?}
         */
        this.ratingDimensions_ = null;

        /**
         * The user token for the user. This will be used to add and remove
         * ratings.
         * @type {string?}
         */
        this.userToken_ = null;

        /**
         * The ID of the user that is on the page.
         * @type {string?}
         */
        this.userId = null;

        var bsData = BootstrapClient.getContent(bsOpts, function(n, data) {
            // Get some config values needed for later.
            self.opts_.collectionId = data.collectionSettings.collectionId;
            self.opts_.siteId = data.collectionSettings.siteId;

            // Grab the user token from the URL and obtain the user data from it.
            // This is how we will build the userId so that we can keep track
            // of the ratings that the current user has posted.
            // 
            // NOTE: This is only set up to work with 1 query param which has
            // the token as value.
            // 
            var token = document.location.search.split('=')[1];
            if (token) {
                self.userToken_ = token;
                var userData = JSON.parse(atob(token.split('.')[1]));
                self.userId = userData.user_id + '@' + userData.domain;
            }

            self.ratingDimensions_ = data.collectionSettings.config.ratingDimensions;
            // Add all of the rating dimensions to the DOM.
            $.each(self.ratingDimensions_, self.addDimensionDom_);
            // Process all of the bootstrap data.
            $.each(data.headDocument.content,
                $.proxy(self.processBootstrapMessage_, self));

            // Create the Livefyre stream.
            var stream = new LivefyreStream({
                network: self.opts_.network,
                collectionId: self.opts_.collectionId,
                environment: self.opts_.environment
            });

            // WARNING: Hack! We don't want to process the state contents from
            // the stream in the normal fashion. This is just passing them
            // through so that stream.read() will give us the raw data.
            stream._handleState = function(state, authors) {
                stream._push(state);
                return state;
            };

            // When the stream is readable, that means it has content that can
            // be read. We want to do that and process it.
            stream.on('readable', function() {
                self.processStreamData_(stream.read());
            });

            // Now that we've set up the stream, lets start it.
            stream.start();

            // Add a delegate listener to the list element for button clicks
            // on any of the dimension buttons. This is what will save or remove
            // the rating state.
            var callback = $.proxy(self.handleClick_, self);
            $('#buzzfyre > ul').on('click', 'button', callback);
        });
    };

    /** @enum {string} */
    buzzfyrejs.CLASSES = {
        IS_AUTHOR: 'isAuthor',
        LOADING: 'loading'
    };

    /**
     * Add a DOM element for a dimension. This just appends to the list of
     * dimension nodes.
     * @param {number} idx The index of the dimension in the list.
     * @param {string} dimension The dimension name to add as a DOM node.
     */
    buzzfyrejs.prototype.addDimensionDom_ = function(idx, dimension) {
        $('#buzzfyre > ul').append('<li class="' + dimension + '">' +
            '<button data-dimension="' + dimension + '">' + dimension + '</button>' +
            '<span>0</span>' +
        '</li>');
    };

    /**
     * Adds a rating. Loops through all ratings in the list (1 for every
     * dimension) and increments the counters underneath the dimension buttons
     * accordingly. This is triggered when a rating streams in, the current
     * user clicks on a rating, or on the initial page load.
     * @param {string} messageId The ID of the message containing the rating.
     * @param {Array.<number>} rating The rating array to process.
     * @param {boolean} isAuthor Whether the currently logged in user is the
     *    author of this rating.
     * @private
     */
    buzzfyrejs.prototype.addRating_ = function(messageId, rating, isAuthor) {
        // Store the rating in the content object.
        this.content_[messageId] = rating;
        // If the current user is the author, store the messageId.
        if (isAuthor) {
            this.messageId = messageId;
            // Don't want to re-increment if there is a processing request. This
            // has already happened. This will only happen for the current user.
            if (this.isProcessingPost_) {
                this.isProcessingPost_ = false;
                return;
            }
        }
        var self = this;
        // Loop over all dimensions, increment their count, and add a class to
        // the button if this author is the one that submitted the rating.
        $.each(rating, function(idx, score) {
            // If the score isn't 100, there is nothing to remove since this
            // dimension wasn't selected.
            if (score !== 100) {
                return;
            }
            var dimension = self.ratingDimensions_[idx];
            // If the current user is the author of this rating, add a class.
            if (isAuthor) {
                var CLASSES = buzzfyrejs.CLASSES;
                $('.' + dimension).find('button').addClass(CLASSES.IS_AUTHOR);
            }
            self.incrementCount_(dimension);
        });
    };

    /**
     * Decrements the count for the specified dimension.
     * @param {string} dimension The dimension to decrement.
     * @private
     */
    buzzfyrejs.prototype.decrementCount_ = function(dimension) {
        var elem = $('.' + dimension + ' > span');
        var cnt = parseInt(elem.html(), 10) - 1;
        elem.html(cnt || 0);
    };

    /**
     * Delete a rating. This sets up the data to send to the client.
     * @param {string} dimension The dimension being removed.
     * @param {function()} callback Function to call once delete is complete.
     */
    buzzfyrejs.prototype.deleteRating_ = function(dimension, callback) {
        var opts = {
            network: this.opts_.environment,
            collectionId: this.opts_.collectionId,
            lftoken: this.userToken_,
            messageId: this.messageId,
            siteId: this.opts_.siteId
        };
        var callback = $.proxy(this.handleDeleteSuccess_, this, callback);
        var errback = $.proxy(this.handleDeleteFailure_, this);
        ReviewClient.deleteReview(opts, callback, errback);
        this.isProcessingDelete_ = true;
        // Assume that it's going to work. The success/error handlers will
        // deal with the states properly.
        var $btnEl = $('.isAuthor');
        $btnEl.removeClass();
        this.decrementCount_($btnEl.attr('data-dimension'));
    };

    /**
     * Increments the count for the specified dimension.
     * @param {string} dimension The dimension to increment.
     * @private
     */
    buzzfyrejs.prototype.incrementCount_ = function(dimension) {
        var elem = $('.' + dimension + ' > span');
        var cnt = parseInt(elem.html(), 10) + 1;
        elem.html(cnt || 0);
    };

    /**
     * Handle the click event on a dimension button. This should determine
     * whether to add or remove a rating.
     * @param {Object} ev The emitted click event.
     * @private
     */
    buzzfyrejs.prototype.handleClick_ = function(ev) {
        var $btnEl = $(ev.target);
        var dimension = $btnEl.attr('data-dimension');
        // If the button is selected, that means we should go ahead and delete
        // the rating.
        var isSelected = $btnEl.hasClass(buzzfyrejs.CLASSES.IS_AUTHOR);
        // If the button is selected and there is a messageId for the current
        // user, we can delete the rating. We want to make sure that both are
        // true in case we're somehow in a weird state.
        if (this.messageId) {
            var postOnSuccess = !isSelected ?
                $.proxy(this.postRating_, this, dimension) :
                function() {};
            this.deleteRating_(dimension, postOnSuccess);
            return;
        }
        this.postRating_(dimension);
    };

    /**
     * Handle the delete success response. Trigger a callback that was provided.
     * @param {function()} callback
     * @param {Object} resp
     */
    buzzfyrejs.prototype.handleDeleteSuccess_ = function(callback, resp) {
        this.removeRating_(this.messageId);
        callback();
    };

    buzzfyrejs.prototype.handleDeleteFailure_ = function() {
        // Do we want to add the ratings back here?
    };

    buzzfyrejs.prototype.handlePostSuccess_ = function(resp) {
        var content = resp.data.messages[0].content;
        var messageId = content.id;
        // We already have the messageId and it's already visible. Don't need
        // to continue.
        if (this.content_[messageId]) {
            return;
        }
        var rating = content.annotations.rating;
        this.addRating_(messageId, rating, true);
    };

    buzzfyrejs.prototype.handlePostFailure_ = function() {
        // Do we want to remove the ratings here?
    };

    /**
     * Post a rating. This sets up the data to send to the client.
     * @param {string} dimension The selected dimension.
     */
    buzzfyrejs.prototype.postRating_ = function(dimension) {
        var ratings = {};
        // Pre-load the ratings object with empty values for each of the
        // possible dimensions.
        $.each(this.ratingDimensions_, function(idx, dimension) {
            ratings[dimension] = -1;
        });
        // Get the rating that was clicked.
        ratings[dimension] = 100;

        var opts = {
            network: this.opts_.environment,
            collectionId: this.opts_.collectionId,
            lftoken: this.userToken_,
            ratings: ratings
        };
        var callback = $.proxy(this.handlePostSuccess_, this);
        var errback = $.proxy(this.handlePostFailure_, this);
        ReviewClient.postReview(opts, callback, errback);
        this.isProcessingPost_ = true;
        // Assume that it's going to work. The success/error handlers will
        // deal with the states properly.
        var $btnEl = $('button[data-dimension="' + dimension + '"]');
        $btnEl.addClass(buzzfyrejs.CLASSES.IS_AUTHOR);
        this.incrementCount_(dimension);
    };

    /**
     * Process a message from bootstrap. Adds the rating and caches it so that
     * we can access the rating later if needed.
     * @param {number} idx The index of the message in the bootstrap response.
     * @param {Object} data The message object.
     * @private
     */
    buzzfyrejs.prototype.processBootstrapMessage_ = function(idx, data) {
        // If the visibility is not EVERYONE, we don't want to show it. This
        // would happen if the message was deleted.
        if (data.vis !== Enums.VIS.EVERYONE) {
            return;
        }
        var messageId = data.content.id;
        var rating = data.content.annotations.rating;
        // Cache the rating so that it's easy to find later.
        this.content_[messageId] = rating;
        // Add the rating.
        this.addRating_(messageId, rating, data.content.authorId === this.userId);
    };

    /**
     * Process a message from the stream. Adds or removes the rating depending
     * on the visibility of the message.
     * @param {Object} data The message object.
     * @private
     */
    buzzfyrejs.prototype.processStreamData_ = function(data) {
        var messageId = data.content.id;
        // If the visibility is not EVERYONE, we don't want to show it. Chances
        // are that we have it already, so we should remove it.
        if (data.vis !== Enums.VIS.EVERYONE) {
            this.removeRating_(messageId);
            return;
        }
        // We already have the messageId and it's already visible. Don't need
        // to continue.
        if (this.content_[messageId]) {
            return;
        }
        // Grab the rating. The rating should always exist, but this is just
        // making sure.
        var rating = data.content.annotations.rating;
        if (!rating) {
            return;
        }
        // Add the rating.
        this.addRating_(messageId, rating, data.content.authorId === this.userId);
    };

    /**
     * Removes a rating. Loops through all ratings in the list (1 for every
     * dimension) and decrements the counters underneath the dimension buttons
     * accordingly. This is triggered when a rating streams in or the current
     * user clicks on a rating they rated.
     * @param {string} messageId The ID of the message containing the rating.
     * @private
     */
    buzzfyrejs.prototype.removeRating_ = function(messageId) {
        // If the message ID being removed is the same ID as the one that the
        // user has posted, then we should remove the color on the button.
        if (messageId === this.messageId) {
            $('button.isAuthor').removeClass();
            // Clean up the messageId of the current user.
            this.messageId = null;
            // Don't want to re-increment if there is a processing request. This
            // has already happened. This will only happen for the current user.
            if (this.isProcessingDelete_) {
                this.isProcessingDelete_ = false;
                return;
            }
        }
        var rating = this.content_[messageId];
        // If the rating doesn't exist, that means it was never added or already
        // removed, so we don't need to do anything.
        if (!rating) {
            return;
        }
        var self = this;
        // Loop over all dimensions and decrement their count.
        $.each(rating, function(idx, score) {
            // If the score isn't 100, there is nothing to remove since this
            // dimension wasn't selected.
            if (score !== 100) {
                return;
            }
            // Decrement the count for the rating dimension at this index.
            self.decrementCount_(self.ratingDimensions_[idx]);
        });
        // Delete the content from the content object.
        delete this.content_[messageId];
    };

    return buzzfyrejs;
});
