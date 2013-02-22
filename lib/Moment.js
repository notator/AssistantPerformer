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
 *      Moment(msPositionInScore) // Constructs an empty Moment at msPositionInScore
 *                                // Call with UNDEFINED_TIMESTAMP if the moment is not in the score
 *
 *      Public interface:
 *        moment.msPositionInScore; // (read-only) relative to the beginning of the score or UNDEFINED_TIMESTAMP.
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
    UNDEFINED_TIMESTAMP = -1,

    // Adds the messages in moment2.messages to the end of moment1.messages
    // setting moment1.chordStart or moment1.restStart if necessary.
    concatMessages = function(moment1, moment2)
    {
        if (moment2.chordStart !== undefined)
        {
            Object.defineProperty(moment1, "chordStart", { value: true, writable: false });
        }
        else if(moment2.restStart !== undefined)
        {
            Object.defineProperty(moment1, "restStart", { value: true, writable: false });
            moment2.messages = []; // don't copy the empty message
        }

        moment1.messages = moment1.messages.concat(moment2.messages);
    },

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
        this.adjustedTimeReSequence = UNDEFINED_TIMESTAMP;

        // The DOMHRTime at which this moment is sent to the output device.
        // This value is always set in Sequence.nextMoment().
        this.timestamp = UNDEFINED_TIMESTAMP;

        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

    // This constant is used as the default value of this.adjustedTimeReSequence and
    // this.timestamp. It is also used when constructing new moments which are not in
    // the score at all to set their moment.msPositionInScore value. 
    Object.defineProperty(publicAPI, "UNDEFINED_TIMESTAMP", { value: UNDEFINED_TIMESTAMP, writable: false });

    // Adds the moment2.messages to the end of the current messages using
    // msPositionInScore attributes to check synchronousness.
    // Sets restStart, chordStart if necessary.
    // Throws an exception if moment2.msPositionInScore !== this.msPositionInScore.
    // See also mergeTimestampedMoment().
    Moment.prototype.mergeMoment = function (moment2)
    {
        var msPositionInScore = this.msPositionInScore;

        if (msPositionInScore === UNDEFINED_TIMESTAMP || moment2.msPositionInScore === UNDEFINED_TIMESTAMP)
        {
            throw "Error: msPositionInScore values must be defined when calling this function.";
        }

        if (msPositionInScore !== moment2.msPositionInScore)
        {
            throw "Error: attempt to merge moments having different msPositionInScore values.";
        }

        concatMessages(this, moment2);
    };

    // Adds the moment2.messages to the end of the current messages.
    // this.timestamp and moment2.timestamp should be defined, even though they are not used here.                                                
    // See also mergeMoment() -- which is more restrictive.
    Moment.prototype.mergeTimestampedMoment = function (moment2)
    {
        var timestamp = this.timestamp;

        if (timestamp === UNDEFINED_TIMESTAMP || moment2.timestamp === UNDEFINED_TIMESTAMP)
        {
            throw "Error: timestamps must be defined when calling this function.";
        }

        // The following restriction lifted because unpredictable in real-time situations.
        //if (timestamp !== moment2.timestamp)
        //{
        //    throw "Error: attempt to merge moments having different timestamp values.";
        //}

        concatMessages(this, moment2);
    };

    // If the time relative to the sequence has been adjusted
    // (as currently in an assisted performance that uses the
    // 'relative durations' option), this function returns the
    // adjusted time. Otherwise it returns this.msPositionInScore
    // (which takes account of the global speed option).
    Moment.prototype.timeReSequence = function ()
    {
        var time;

        if (this.adjustedTimeReSequence === UNDEFINED_TIMESTAMP)
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
