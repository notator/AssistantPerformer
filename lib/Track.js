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
 *      moments             // an array of Moments
 *      addMoment(moment)   // Appends another Moment to the end of this Track
 *      recordEvent(event)  // Appends an Event to the end of this (recording) Track.
 *                          // Creates a new moment if necessary.
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
    },

    publicTrackAPI =
    {
        // creates an empty track
        Track: Track
    };
    // end var

    // A moment can only be appended to the end of the Track.
    Track.prototype.addMoment = function (moment)
    {
        var 
        moments = this.moments,
        msPositionInScore, oldMoment;

        msPositionInScore = moment.msPositionInScore;

        if (moments.length === 0 || msPositionInScore > moments[moments.length-1].msPositionInScore)
        {
            moments.push(moment); // can be a rest, containing one 'empty event'
        }
        else if (msPositionInScore === moments[moments.length - 1].msPositionInScore)
        {
            oldMoment = moments[moments.length - 1];
            oldMoment.mergeMoment(moment);
        }
        else
        {
            throw "Error: A moment can only be appended to the end of a track.";
        }
    };

    // The event is added to the track being recorded.
    // Event timestamps are always relative to the beginning of the **performance**,
    // New moments are constructed here when necessary (using event.timestamps). 
    Track.prototype.recordEvent = function (event)
    {
        var moment, lastMoment = this.moments[this.moments.length - 1];

        if ((this.moments.length === 0)
        ||  (lastMoment.msPositionInScore < event.timestamp))
        {
            moment = new Moment(event.timestamp);
            this.moments.push(moment);
            moment.addEvent(event);
        }
        else if (lastMoment.msPositionInScore === event.timestamp)
        {
            lastMoment.addEvent(event);
        }
        else if (lastMoment.msPositionInScore > event.timestamp)
        {
            console.log("Error: event.timestamp should never be less than the msPositionInScore of an existing moment.");
        }
    };

    return publicTrackAPI;

} ());
