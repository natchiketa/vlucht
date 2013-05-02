/*
 Global
 */
var wayPoint,
    map, geocoder, origin, destination,
    destDisplayName,
    $plane,
    resolvedOrig, resolvedDest,
    scrollTop, lastScrollTop, maxScrollTop,
    percentScrollTop, lastPercentScrollTop,
    heading,
    planeOffset, planeOffsetDiff, lastPlaneOffset,
    goh;

var CITIES = {
    'Amsterdam': {
        lat:  52.373056, lng: 4.892222
    },
    'Sydney': {
        lat: -33.859972, lng: 151.211111
    },
    'Brisbane': {
        lat: -27.472778, lng: 153.027778
    }
}

// Origin/Destination Addresses: what you would search for if you were
// searching for the locations with Google Maps. The destination will
// only be used as a fallback, unless FORCE_DESTINATION is set to true
var ORIGIN_ADDRESS      = 'Heerhugowaard, Netherlands';
var DESTINATION_ADDRESS = 'Sydney, NSW, Australia';
var FORCE_DESTINATION   = false;

var VLUCHTPUNTEN = {
    startY:   function() { return ($(window).height() / 2) - 137 },
    runway:   function() { return ($(window).width() / 2) - 242 },
    middleX:  function() { return $(window).width() / 2},
    middleY:  function() { return $(window).height() * 0.25 },
    midYBank:  function() { return $(window).height() * 0.2 },
    rtBank:   function() { return ($(window).width() * 0.9) - (($plane.width() || 30) / 2 - 5) },
    rtMargin: function() { return ($(window).width() * 0.9) - (($plane.width() || 30) / 2) },
    apprX:    function() { return $(window).width() * 0.6 },
    endY:     function() { return $(window).height() / 2 }
};

var VLUCHT, _VLUCHT = function() {
    return [
        {
            pos: 0,
            easeIn: 0,
            easeOut: 2,
            offsets: {
                before: {left: this.runway, top: this.startY},
                at: {left: this.runway, top: this.startY},
                after: {left: this.runway, top: this.startY}
            },
            origin: true
        },

        {
            pos: 4,
            easeIn: 0.0,
            easeOut: 10,
            offsets: {
                before: {left: this.runway, top: this.startY},
                at: {left: this.runway, top: this.startY},
                after: {left: this.rtBank, top: this.midYBank}
            }
        },

        {
            pos: 14,
            easeIn: 0,
            easeOut: 20,
            offsets: {
                before: {left: this.rtBank, top: this.midYBank},
                at: {left: this.rtBank, top: this.midYBank},
                after: {left: this.rtMargin, top: this.middleY}
            }
        },

        {
            pos: 95,
            easeIn: 30,
            easeOut: 5,
            offsets: {
                before: {left: this.rtMargin, top: this.middleY},
                at: {left: this.apprX, top: this.endY},
                after: {left: this.middleX, top: this.endY}
            },
            destination: true
        }

    ];
};

function cityLatLng(name) {
    return new google.maps.LatLng(CITIES[name].lat, CITIES[name].lng)
}

function angleBetweenCities(origCity, destCity) {
    var deltaY = CITIES[destCity].lat - CITIES[origCity].lat;
    var deltaX = CITIES[destCity].lng - CITIES[origCity].lng;
    return (Math.atan2(deltaY, deltaX) * (180 / Math.PI));
}

function setOriginAndDestination(originName, destinationName, forceDefaultDest) {
    if (_.isUndefined(originName)) return;
    forceDefaultDest = forceDefaultDest || false;
    origin = originName;
    destination = _.has(CITIES, destinationName) ? destinationName : 'Sydney';
    $(document).trigger('vlucht:bindscrolling');

    // If forcing the specified destination name, or if the browser doesn't support
    // geolocation, just use the specified name
    if (forceDefaultDest || !navigator.geolocation) {
        $(document).trigger('vlucht:bindscrolling');
        return;
    }

    navigator.geolocation.getCurrentPosition(

        // success handler
        function(position) {
            CITIES['CURRENT_LOCATION'] = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            destination = 'CURRENT_LOCATION';
            $(document).trigger('vlucht:bindscrolling');
        },

        // error handler
        function(errorCode) {
            console.log(errorCode)
            $(document).trigger('vlucht:bindscrolling');
        }

    );
}

function interpolateLatLng(origName, destName, percent, max) {
    var ilat, ilng;
    var orig = CITIES[origName];
    var dest = CITIES[destName];

    // If, for whatever reason, we want to have the interpolation calculated from 0 to
    // a value other than 100, the `max` argument can be specified.
    var divisor = _.isUndefined(max) ? 100 : max;
    
    var taperedOrig = {
        lat: _.isEqual(0, divisor) 
            ? orig.lat
            : orig.lat - (orig.lat * ((1 / divisor) * Math.min(percent, max))).floor(6),
        lng: _.isEqual(0, divisor)
            ? orig.lng
            : orig.lng - (orig.lng * ((1 / divisor) * Math.min(percent, max))).floor(6)
    };
    
    var taperedDest = {
        lat: _.isEqual(0, divisor)
            ? dest.lat
            : (dest.lat * ((1 / divisor) * Math.min(percent, max))).floor(6),
        lng: _.isEqual(0, divisor)
            ? dest.lng
            : (dest.lng * ((1 / divisor) * Math.min(percent, max))).floor(6)
    };

    ilat = taperedOrig.lat + taperedDest.lat;
    ilng = taperedOrig.lng + taperedDest.lng;

    return new google.maps.LatLng(ilat, ilng);
}

function roundedOffset(offset, nearest) {
    return _.isUndefined(nearest)
        ? { left: (offset.left).round(), top: (offset.top).round()}
        : { left: (offset.left / nearest).round() * nearest, top: (offset.top  / nearest).round() * nearest }
}

// Will return the result for left/top if a function. jQuery.css can do this individually
// with the .css() method, so this is for convenience only.
function calcOffset(offset) {
    return {
        left: _.isFunction(offset.left) ? offset.left() : offset.left,
        top: _.isFunction(offset.top) ? offset.top() : offset.top
    }
}

function movePlane() {

    VLUCHT = _.bind(_VLUCHT, VLUCHTPUNTEN)();

    if (percentScrollTop == 0 || _.isUndefined(percentScrollTop)) {
        var origin = _.find(VLUCHT, function(vector) {
            return _.has(vector, 'origin') && vector.origin === true;
        });
        if (origin) {
            $plane
                .css(calcOffset(origin.offsets.at))
                .rotate(0);
        }
        return;
    }

    _.each(VLUCHT, function(vector) {
        var before  = percentScrollTop < vector.pos && vector.pos - percentScrollTop <= vector.easeIn;
        var after   = percentScrollTop > vector.pos && percentScrollTop <= vector.pos + vector.easeOut;

        if (before === false && after === false) {
            $plane.removeClass('arrived on_runway cruising');
            return;
        }

        $plane.toggleClass('on_runway', vector.origin && after);
        $plane.toggleClass('arrived',   vector.destination && percentScrollTop == 100);

        vector.offsets.before = calcOffset(vector.offsets.before);
        vector.offsets.at     = calcOffset(vector.offsets.at);
        vector.offsets.after  = calcOffset(vector.offsets.after);

        var target  = before ? vector.offsets.before : vector.offsets.after;
        var easePos = before
            ? (1 / vector.easeIn)  * (vector.pos - percentScrollTop)
            : (1 / vector.easeOut) * (percentScrollTop - vector.pos);

        planeOffsetDiff = {
            left: target.left - vector.offsets.at.left,
            top:  target.top  - vector.offsets.at.top
        };

/*
        console.log('target: ', before ? 'before' : after ? 'after' : 'n/a');
        console.log('vector.pos: ', vector.pos, '\tpercentScrollTop: ', percentScrollTop);
        console.log('planeOffsetDiff: ', planeOffsetDiff);
        console.log('easePos: ', easePos);
*/

        var newOffset = {
            left: vector.offsets.at.left + (planeOffsetDiff.left * easePos),
            top:  vector.offsets.at.top  + (planeOffsetDiff.top  * easePos)
        };

        planeOffset = newOffset;

        if (Modernizr.csstransforms) {
            $plane.css(planeOffset);
        } else {
            $plane.animate(planeOffset, 75);
        }

        // Rotation based on movement since last call
        var curOff  = _.extend(planeOffset, {top: $plane.offset().top});
        var lastOff = lastPlaneOffset || curOff;
        var deltaY = curOff.top  - lastOff.top;
        var deltaX = curOff.left - lastOff.left;

        // Ignore deltas of less than 2 to reduce jitter.
        deltaY = Math.abs(deltaY) < 2 ? 0 : deltaY;
        deltaX = Math.abs(deltaX) < 2 ? 0 : deltaX;

        heading = (Math.atan2(deltaY, deltaX) * (180 / Math.PI)) - 90;
        var rndHeading = ((heading / 5).round()) * 5;
        heading = rndHeading;

        $plane.rotate(heading);

        lastPlaneOffset = _.extend(planeOffset, {top: $plane.offset().top});
    });
}

function _wayPoint(event) {
    lastScrollTop = scrollTop;
    scrollTop = $(document).scrollTop();
    maxScrollTop = $(document).height() - $(window).height();
    percentScrollTop = (100 / maxScrollTop) * scrollTop;
    //console.log(percentScrollTop);
    map.setCenter(interpolateLatLng(origin, destination, percentScrollTop, 100));
    movePlane();
    // Save the scroll position percentage and offset of the plane's DOM element
    lastPercentScrollTop = percentScrollTop;
}

function initialize() {

    /*
     Basic Setup
     */

    var myOptions = {
        panControl: false,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        overviewMapControl: false,
        draggable: false,
        disableDoubleClickZoom: true,     //disable zooming
        scrollwheel: false,
        zoom: 6,
        center: cityLatLng(origin),
        mapTypeId: google.maps.MapTypeId.ROADMAP //   ROADMAP; SATELLITE; HYBRID; TERRAIN;
    };

    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

}//end initialize

/*
 onLoad
 */
$(function(){

    // Set this to be a jQuery object pointing to the DOM element for your 'plane'
    $plane = $('#plane');

    // Size the Google Maps canvas to the window height, both on load and when the window is resized.
    $(window).on('load resize', function(){

        //$('#map_canvas').height($(this).height());

        // Responsive positioning for the intro
        var newHeight = Math.max($(this).height() / 2, 320);
        var newVMargin  = ($(this).height() - newHeight) / 2;
        $('#im_here')
            .height(newHeight)
            .css({
                marginTop: newVMargin,
                marginBottom: newVMargin,
                backgroundPosition: '0 ' + Math.max(newVMargin - 162, 0) + 'px'
            });
        var imHereOffset = $('#im_here').offset();
        $('#view_my_work').css({
            top: 240 + Math.max(newVMargin - 162, 0)
        });

        // Update the portfolio layout
        var introLeft = $('#im_here').offset().left;
        var itemsWidth = $('.portfolio_content').width();
        $('.header').css({
            minWidth: itemsWidth + introLeft + 50
        });
        $('.portfolio_content, .header_title').css({
            marginLeft: introLeft
        });
        $('.skillset_bar p').css({
            marginLeft: introLeft - 10
        });
        // Update the destination marker ('get over here')
        goh = {
            width: $('#get_over_here').width(),
            height: $('#get_over_here').height()
        };

        // the offset in pixels of the center of the locator from
        // the top-left corner of the background image
        var locatorOffset = {
            width:  291,
            height: 62
        };

        $('#get_over_here').css({
            height: newHeight + 100,
            backgroundPosition: '' +
                (((goh.width / 2) - locatorOffset.width) - ($plane.width() / 2)) + 'px ' +
                (((locatorOffset.height) + ($plane.height() / 2)) - 50) + 'px'
        });

        var $goh = $('#get_over_here');
        $('#interested').css({
            top: $goh.offset().top + 190,
            left: ($(this).width() - $('#interested').width()) / 2
        });
        $('#contact_form').css({
            top: $goh.offset().top + 220 + $('#interested').height(),
            left: ($(this).width() - $('#contact_form').width()) / 2
        });

        // Update the map and plane
        try {
            wayPoint();
        } catch(e) {
            console.log(e);
        }

    });

    // This custom event, `vlucht:bindscrolling` is triggered by setOriginAndDestination
    // once the origin and destination global variables have been defined. This is because
    // the fetching of user's current location is asynchronous.
    $(document).on('vlucht:bindscrolling', function(){
        // Throttle the function which is called by the scroll event handler. Requires
        // the Underscore library, or an Underscore-compatible equivalent, like Lodash.
        wayPoint = _.throttle(_wayPoint, 100);

        $(window).off('scroll touchmove').on('scroll touchmove', function(event) {
            wayPoint(event);
            navigator.geolocation.getCurrentPosition(
                function() {
                    $(document).trigger('vlucht:getCurLocAddr');
                },
                function() {

                }
            );
        });
    });

    $(document).on('vlucht:resolveOrigin', function(){
        geocoder.geocode({address: ORIGIN_ADDRESS}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                var uscoredName = _.pluck(results[0].address_components, 'long_name').join('_').underscore();
                CITIES[uscoredName] = _.object(['lat', 'lng'], _.values(results[0].geometry.location));
                resolvedOrig = uscoredName;
                $(document).trigger('vlucht:resolvedAddress');
            }
        });
    });

    $(document).on('vlucht:resolveDestination', function(){
        geocoder.geocode({address: DESTINATION_ADDRESS}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                var uscoredName = _.pluck(results[0].address_components, 'long_name').join('_').underscore();
                //console.log('results: ', results);
                CITIES[uscoredName] = _.object(
                    ['lat', 'lng'],
                    _.values(results[0].geometry.location)
                );
                var locality = _.find(results[0].address_components, function(c){
                    return _.contains(c.types, 'locality')
                });
                destDisplayName = locality.long_name;
                resolvedDest = uscoredName;
                $(document).trigger('vlucht:resolvedAddress');
            }
        });
    });

    $(document).on('vlucht:resolvedAddress', function(){
        if (!_.isUndefined(resolvedOrig) && !_.isUndefined(resolvedDest)) {
            setOriginAndDestination(resolvedOrig, resolvedDest, FORCE_DESTINATION);
            $(document).trigger(
                resolvedDest === 'CURRENT_LOCATION'
                    ? 'vlucht:getCurLocAddr'
                    : 'vlucht:origDestResolved'
            );
        }
    });

    $(document).on('vlucht:origDestResolved', function() {
        percentScrollTop = $(document).scrollTop();
        movePlane();
        if (_.isUndefined(map)) initialize();
    });


    $(document).on('vlucht:getCurLocAddr', function() {
        if (_.isUndefined(CITIES.CURRENT_LOCATION)) return;
        var latLng = new google.maps.LatLng(CITIES.CURRENT_LOCATION.lat, CITIES.CURRENT_LOCATION.lng);
        geocoder.geocode({'latLng': latLng}, function(results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                //console.log(results);
                var locality = _.find(results[0].address_components, function(c){
                    return _.contains(c.types, 'locality')
                });
                destDisplayName = locality.long_name
                $('.userplacename').text(destDisplayName);
            }
            $(document).trigger('vlucht:origDestResolved');
        });
    });

    geocoder = new google.maps.Geocoder();
    $(document).trigger('vlucht:resolveOrigin');
    $(document).trigger('vlucht:resolveDestination');


});