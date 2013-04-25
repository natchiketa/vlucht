/*
 Global
 */
var map, origin, destination,
    resolvedOrig, resolvedDest,
    scrollTop, lastScrollTop,
    percentScrollTop, lastPercentScrollTop,
    heading,
    planeOffset, planeOffsetDiff, lastPlaneOffset;

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
var ORIGIN_ADDRESS      = 'Giza Plateau, Egypt';
var DESTINATION_ADDRESS = 'New York, NY, USA';
var FORCE_DESTINATION   = false;

var VLUCHTPUNTEN = {    
    startY: 219,
    runway: function() { return $(window).width() / 2 },
    middleY: function() { return $(window).height() / 2 },
    rtMargin: 1450,
    endX: function() { return $(window).width() / 2 },
    endY: -685
};

var VLUCHT = function() {
    return [
        {
            pos: 2,
            easeIn: 1,
            easeOut: 0.5,
            offsets: {
                before: {left: this.runway(), top: this.startY},
                at: {left: this.runway(), top: this.startY},
                after: {left: this.runway(), top: this.startY}
            },
            origin: true
        },

        {
            pos: 5,
            easeIn: 1.5,
            easeOut: 1.5,
            offsets: {
                before: {left: this.runway(), top: this.startY},
                at: {left: (this.runway() + this.rtMargin) / 2, top: this.middleY()},
                after: {left: this.rtMargin - 5, top: this.middleY()}
            }
        },

        {
            pos: 12.5,
            easeIn: 4,
            easeOut: 4.5,
            offsets: {
                before: {left: this.rtMargin - 5, top: this.middleY()},
                at: {left: this.rtMargin, top:this.middleY()},
                after: {left: this.rtMargin, top: this.middleY()}
            }
        },

        {
            pos: 40,
            easeIn: 25,
            easeOut: 20,
            offsets: {
                before: {left: this.rtMargin, top: this.middleY()},
                at: {left: this.rtMargin, top: this.middleY()},
                after: {left: this.rtMargin - 5, top: this.middleY()}
            }
        },

        {
            pos: 67.2,
            easeIn: 5,
            easeOut: 15.7,
            offsets: {
                before: {left: this.rtMargin - 5, top: this.middleY()},
                at: {left: this.endX(), top: this.middleY()},
                after: {left: this.endX(), top: this.endY}
            },
            destination: true
        }

    ];
};
VLUCHT = _.bind(VLUCHT, VLUCHTPUNTEN)();

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
        $(document).off('vlucht:bindscrolling').trigger('vlucht:bindscrolling');
        return;
    }

    navigator.geolocation.getCurrentPosition(

        // success handler
        function(position) {
            console.log(position);
            CITIES['CURRENT_LOCATION'] = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            destination = 'CURRENT_LOCATION';
            $(document).off('vlucht:bindscrolling').trigger('vlucht:bindscrolling');
        },

        // error handler
        function(errorCode) {
            console.log(errorCode)
            $(document).off('vlucht:bindscrolling').trigger('vlucht:bindscrolling');
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

function movePlane() {

    if (percentScrollTop == 0 || _.isUndefined(percentScrollTop)) {
        var origin = _.find(VLUCHT, function(vector) {
            return _.has(vector, 'origin') && vector.origin === true;
        });
        if (origin) {
            $('#plane')
                .css(origin.offsets.at)
                .rotate(0);
        }
        return;
    }

    _.each(VLUCHT, function(vector) {
        var before  = percentScrollTop < vector.pos && vector.pos - percentScrollTop <= vector.easeIn;
        var after   = percentScrollTop > vector.pos && percentScrollTop <= vector.pos + vector.easeOut;

        if (before === false && after === false) {
            $('#plane').removeClass('arrived on_runway cruising');
            return;
        }

        $('#plane').toggleClass('on_runway', vector.origin && after);
        $('#plane').toggleClass('arrived',   vector.destination && after);

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
            $('#plane').css(planeOffset);
        } else {
            $('#plane').animate(planeOffset, 75);
        }

        // Rotation based on movement since last call
        var curOff  = _.extend(planeOffset, {top: $('#plane').offset().top});
        var lastOff = lastPlaneOffset || curOff;
        var deltaY = curOff.top  - lastOff.top;
        var deltaX = curOff.left - lastOff.left;

        // Ignore deltas of less than 2 to reduce jitter.
        deltaY = Math.abs(deltaY) < 2 ? 0 : deltaY;
        deltaX = Math.abs(deltaX) < 2 ? 0 : deltaX;

        heading = (Math.atan2(deltaY, deltaX) * (180 / Math.PI)) - 90;
        var rndHeading = ((heading / 5).round()) * 5;
        heading = rndHeading;

        $('#plane').rotate(heading);

        lastPlaneOffset = _.extend(planeOffset, {top: $('#plane').offset().top});
    });
}

function _wayPoint(event) {
    lastScrollTop = scrollTop;
    scrollTop = $(document).scrollTop();
    percentScrollTop = (100 / $(document).height()) * scrollTop;
    //console.log(percentScrollTop);
    map.setCenter(interpolateLatLng(origin, destination, percentScrollTop, 60));
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

    // Size the Google Maps canvas to the window height, both on load and when the window is resized.
    $(window).on('load resize', function(){
        $('#canvas_holder')
            .height($(this).height());
    });

    // This custom event, `vlucht:bindscrolling` is triggered by setOriginAndDestination
    // once the origin and destination global variables have been defined. This is because
    // the fetching of user's current location is asynchronous.
    $(document).on('vlucht:bindscrolling', function(){
        // Throttle the function which is called by the scroll event handler. Requires
        // the Underscore library, or an Underscore-compatible equivalent, like Lodash.
        var wayPoint = _.throttle(_wayPoint, 100);

        $(window).on('scroll touchmove', function(event) {
            wayPoint(event);
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
                CITIES[uscoredName] = _.object(['lat', 'lng'], _.values(results[0].geometry.location));
                resolvedDest = uscoredName;
                $(document).trigger('vlucht:resolvedAddress');
            }
        });
    });

    $(document).on('vlucht:resolvedAddress', function(){
        if (!_.isUndefined(resolvedOrig) && !_.isUndefined(resolvedDest)) {
            setOriginAndDestination(resolvedOrig, resolvedDest, FORCE_DESTINATION);
            percentScrollTop = $(document).scrollTop();
            movePlane();
            initialize();
        }
    });

    geocoder = new google.maps.Geocoder();
    $(document).trigger('vlucht:resolveOrigin');
    $(document).trigger('vlucht:resolveDestination');


});