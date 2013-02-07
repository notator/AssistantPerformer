/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  Moment.js
 *  The MIDI_API.moment namespace which defines a Moment object.
 *  Moments contain Events, and are contained by Tracks.
 *
 *       Moment(msPositionInScore) // constructs an empty Moment at msPositionInScore
 *
 *       Public interface:
 *        // The moment.msPositionInScore is used to revert the contained event.timestamps
 *        // if they have changed (e.g. during an assisted performance).
 *        moment.msPositionInScore; // relative to the beginning of the score
 *        moment.events; // an array of MIDI_API.events. All the event.timestamp values in
 *                       // a Moment are equal, but are not necesarily equal to their
 *                       // moment's msPositionInScore (their default value).
 *        moment.addEvent(event)
 *        moment.mergeMoment(moment); // appends another Moment, having the same
 *                                    // msPositioninScore, to the end of this Moment.  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDI_API.namespace('MIDI_API.moment');

MIDI_API.moment = (function ()
{
    "use strict";

    var 
    // Moment constructor
    // This is a timestamped array of Events, all of which have the same timestamp.
    // the moment.msPositionInScore is read only, and is used to revert the contained event.timestamps
    // if they have changed (e.g during an assisted performance).
    Moment = function (msPositionInScore)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(msPositionInScore);
        }

        this.events = []; // an array of Events
        Object.defineProperty(this, "msPositionInScore", { value: msPositionInScore, writable: false });

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

    // Currently, Events are only ever appended to
    // the end of the Moment, but that might change. 
    Moment.prototype.addEvent = function (event)
    {
        var errorText = "",
            events = this.events; // Moment.events

        if (event.timestamp !== undefined && event.timestamp >= 0)
        {
            if (event.timestamp === this.msPositionInScore)
            {
                events.push(event);
            }
            else
            {
                errorText = "attempt to add Event with wrong timestamp to a Moment.";
            }
        }
        else
        {
            errorText = "undefined or negative timestamp.";
        }

        if (errorText.length > 0)
        {
            throw "Error: " + errorText + "event.timestamp:" + event.timestamp +
                ", moment.msPositioninScore:" + this.msPositioninScore +
                ", event:" + event.toString();
        }
    };

    // Adds the moment2.events to the end of the current events.
    // sets restStart, chordStart if necessary.
    // Throws an exception if moment2.msPositionInScore !== this.msPositionInScore. 
    Moment.prototype.mergeMoment = function (moment2)
    {
        var i, moment2Events, moment2EventsLength, timestamp, event,
            msPositionInScore = this.msPositionInScore;

        if (msPositionInScore !== moment2.msPositionInScore)
        {
            throw "Error: attempt to merge moments having different msPositionInScore.";
        }

        if (moment2.chordStart !== undefined || moment2.restStart !== undefined)
        {
            // moment2 is a restStart or chordStart
            if (moment2.chordStart === true)
            {
                Object.defineProperty(this, "chordStart", { value: true, writable: false });
            }
            else
            {
                Object.defineProperty(this, "restStart", { value: true, writable: false });
                moment2.events = []; // don't copy the empty message
            }
        }
        timestamp = this.events[0].timestamp;
        moment2Events = moment2.events;
        moment2EventsLength = moment2Events.length;
        for (i = 0; i < moment2EventsLength; ++i)
        {
            event = moment2Events[i];
            event.timestamp = timestamp; // just to be sure...
            this.addEvent(event);
        }
    };

    return publicAPI;

} ());
