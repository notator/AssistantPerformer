/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  Moment.js
 *  The MIDILib.moment namespace which defines a Moment object.
 *  Moments contain Messages, and are contained by Tracks.
 *
 *      Moment(msPositionInScore) // constructs an empty Moment at msPositionInScore
 *
 *      Public interface:
 *        moment.msPositionInScore; // relative to the beginning of the score (read-only)
 *        moment.adjustedTimeReSequence; // either UNDEFINED_TIMESTAMP or relative to the beginning of the sequence 
 *        moment.timestamp; // initially UNDEFINED_TIMESTAMP, set to absolute DOMHRT time in sequence.nextMoment.
 *        moment.messages;  // an array of MIDILib.messages. 
 *        moment.mergeMoment(moment);   // appends the messages from another Moment, having the
 *                                      // same msPositioninScore, to the end of this Moment.
 *
 *      The idea behind always having timestamp and adjustedTimeReSequence defined is that memory use
 *      becomes more consistent during performance, so garbage collection interruptions become less likely.
 *      In other words: It would be possible to reproduce the same behaviour using defined and undefined
 *      timestamp/adjustedTimeReSequence, but this would mean allocating memory for them at performance
 *      time, possibly leading to garbage collections which would interrupt the performance.
 *      If this fear is ungrounded, timestamp and adjustedTimeReSequence could simply be defined or
 *      undefined instead of always being defined.
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDILib.namespace('MIDILib.moment');

MIDILib.moment = (function ()
{
    "use strict";

    var
    constant = {},

    // Moment constructor
    // The moment.msPositionInScore is read only, and is used to set moment.timestamp
    // in Sequence.nextMoment(), when the absolute DOMHRT time is known. 
    // Note that msPositionInScore is an attribute of a timeObject (which takes the
    // speed of the performance into account).
    Moment = function (msPositionInScore)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(msPositionInScore);
        }

        Object.defineProperty(this, "msPositionInScore", { value: msPositionInScore, writable: false });

        // This value can be set if the time relative to the default values in the score needs to change.
        // For example, when the speed changes during a performance, or the performance is 'assisted'.
        // The time relative to the sequence is always retrieved using the function timeReSequence() below.
        this.adjustedTimeReSequence = constant.UNDEFINED_TIMESTAMP;

        // The DOMHRTime at which this moment is sent to the output device.
        // This value is always set in Sequence.nextMoment().
        this.timestamp = constant.UNDEFINED_TIMESTAMP;

        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

    Object.defineProperty(constant, "UNDEFINED_TIMESTAMP", { value: -1, writable: false });

    // Adds the moment2.messages to the end of the current messages.
    // sets restStart, chordStart if necessary.
    // Throws an exception if moment2.msPositionInScore !== this.msPositionInScore. 
    Moment.prototype.mergeMoment = function (moment2)
    {
        var i, moment2Messages, moment2MessagesLength,
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
                moment2.messages = []; // don't copy the empty message
            }
        }
        moment2Messages = moment2.messages;
        moment2MessagesLength = moment2Messages.length;
        for (i = 0; i < moment2MessagesLength; ++i)
        {
            this.messages.push(moment2Messages[i]);
        }
    };

    // If the time relative to the sequence has been adjusted
    // (as currently in an assisted performance that uses the
    // 'relative durations' option), this function returns the
    // adjusted time. Otherwise it returns this.msPositionInScore
    // (which takes account of the global speed option).
    Moment.prototype.timeReSequence = function ()
    {
        var time;

        if (this.adjustedTimeReSequence === constant.UNDEFINED_TIMESTAMP)
        {
            time = this.msPositionInScore;
        }
        else
        {
            time = this.adjustedTimeReSequence;
        }
        return time;
    };

    return publicAPI;

} ());
