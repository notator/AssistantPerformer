/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiTrack.js
 *  The MIDI_API.track namespace which defines the
 *      Track() empty Track constructor.
 *
 *  Public Interface:
 *      moments           // an array of Moments
 *      addMoment(moment) // appends another Moment to the end of this Moment
 *                        // Throws an exception if the timestamps are not equal
 *      addEvent(event)   // appends an Event to the end of this Moment
 *                        // Throws an exception if the timestamps are not equal
 *      The following attributes should not need to be used by clients of this
 *      library. They are used by Sequence when performing:
 *          fromIndex
 *          currentIndex
 *          toIndex
 *          currentLastTimestamp
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDI_API.namespace('MIDI_API.track');

MIDI_API.track = (function ()
{
    "use strict";

    var
    Moment = MIDI_API.moment.Moment,

    // An empty track is created. It contains an empty moments array.
    Track = function ()
    {
        if (!(this instanceof Track))
        {
            return new Track();
        }

        this.moments = []; // an array of Moments
        this.fromIndex = -1;
        this.currentIndex = -1;
        this.toIndex = -1;
        this.currentLastTimestamp = -1;

        // defined in prototype:
        //     addMoment(moment, sequencePositionInScore)
        //     addEvent(event)
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // A moment can only be appended to the end of the Track.
    // The moment's timestamp is currently relative to the beginning of the Score,
    // but if we are building a subsequence beginning later than that, the timestamps
    // are changed here to be relative to the beginning of the subsequence.
    // The timestamp of the first moment in a Track is always 0. 
    Track.prototype.addMoment = function (moment, subsequenceMsPositionInScore)
    {
        var 
        moments = this.moments,
        timestamp, oldMoment;

        function subtractTime(moment, subsequenceMsPositionInScore)
        {
            var i, nEvents = moment.events.length;

            moment.timestamp -= subsequenceMsPositionInScore;
            for (i = 0; i < nEvents; ++i)
            {
                moment.events[i].timestamp -= subsequenceMsPositionInScore;
            }
        }

        subtractTime(moment, subsequenceMsPositionInScore);
        timestamp = moment.timestamp;

        if (timestamp > this.currentLastTimestamp)
        {
            this.currentLastTimestamp = timestamp;
            moments.push(moment); // can be a rest, containing one 'empty event'
        }
        else if (timestamp === this.currentLastTimestamp)
        {
            oldMoment = moments[moments.length - 1];
            oldMoment.mergeMoment(moment);
        }
        else
        {
            throw "Error: A moment can only be appended to the end of a track.";
        }
    };

    Track.prototype.addEvent = function (event)
    {
        var moment;

        if (this.moments.length === 0)
        {
            moment = new Moment(0);
            this.moments.push(moment);
        }
        else if (this.moments[this.moments.length - 1].timestamp === event.timestamp)
        {
            moment = this.moments[this.moments.length - 1];
        }
        else if (this.moments[this.moments.length - 1].timestamp < event.timestamp)
        {
            moment = new Moment(event.timestamp);
            this.moments.push(moment);
        }
        else
        {
            throw "Error: can only add an event to the end of a track.";
        }

        moment.addEvent(event);
    };

    return publicTrackAPI;

} ());
