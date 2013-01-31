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
 *       Moment(timestamp) // constructs an empty Moment at timestamp
 *
 *       Public interface:
 *        // The moment.timestamp is used to revert the contained event.timestamps
 *        // if they have changed (e.g. during an assisted performance).
 *        moment.timestamp; // relative to the beginning of the sequence
 *        moment.events; // an array of MIDI_API.events (can be empty)
 *                       // All the event.timestamp values in a Moment are equal.
 *        moment.addEvent(event)
 *        moment.mergeMoment(moment); // appends another Moment,
 *                                    // having the same timestamp,
 *                                    // to the end of this Moment.  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDI_API.namespace('MIDI_API.moment');

MIDI_API.moment = (function ()
{
    "use strict";

    var 
    // Moment constructor
    // This is a timestamped array of Events, all of which have the same timestamp.
    // the moment.timestamp is used to revert the contained event.timestamps
    // if they have changed (during an assisted performance).
    Moment = function (timestamp)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(timestamp);
        }

        this.timestamp = timestamp;
        this.events = []; // an array of Events
        // defined in prototype:
        //     addEvent(event);
        //     mergeMoment(moment2);

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

    // Currently, Events are only ever appended to
    // the end of the Moment, but that might change. 
    Moment.prototype.privateAddEvent = function (that, event)
    {
        var errorText = "",
            events = that.events, // Moment.events
            timestamp = that.timestamp;

        if (event.timestamp !== undefined && event.timestamp >= 0)
        {
            if (event.timestamp === timestamp)
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
            throw "Error: " + errorText + "timestamp: " + timestamp + ", midimessage:" + event.toString();
        }
    };

    Moment.prototype.addEvent = function (event)
    {
        this.privateAddEvent(this, event);
    };

    Moment.prototype.localAddEvent = function (that, event)
    {
        this.privateAddEvent(that, event);
    };

    // Adds the moment2.events to the end of the current events, and
    // sets restStart, chordStart and msPositionInScore where necessary.
    // Throws an exception if moment2.timestamp !== this.timestamp. 
    Moment.prototype.mergeMoment = function (moment2)
    {
        var i, moment2Events, moment2EventsLength,
            timestamp = this.timestamp;

        if (timestamp !== moment2.timestamp)
        {
            throw "Error: attempt to merge moments having different timestamps.";
        }

        // msPositionInScore is an attribute set on the first Event associated with a
        // chord or rest symbol. If an event has this attribute, the callback
        // reportMsPositionInScore(event.msPositionInScore) is called just before
        // outputDevice.send(event) is called, to tell the score to update the cursor
        // position. See the Sequence.tick() function.
        if (moment2.events[0].msPositionInScore !== undefined)
        {
            // moment2 is a restStart or chordStart
            this.events[0].msPositionInScore = moment2.events[0].msPositionInScore;
            delete moment2.events[0].msPositionInScore;

            if (moment2.restStart !== undefined)
            {
                // don't copy the empty message
                moment2.events = [];
                this.restStart = true;
            }
            else if (moment2.chordStart !== undefined)
            {
                this.chordStart = true;
            }
            else
            {
                throw "Error: moment2 must either have a restStart or a chordStart attribute.";
            }
        }
        moment2Events = moment2.events;
        moment2EventsLength = moment2Events.length;
        for (i = 0; i < moment2EventsLength; ++i)
        {
            this.localAddEvent(this, moment2Events[i]);
        }
    };

    return publicAPI;

} ());
