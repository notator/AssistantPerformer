/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  midiLib/Moment.js
 *  The MIDILib.moment namespace which defines
 *
 *      // A read-only constant (-1), used by Moments
 *      UNDEFINED_TIMESTAMP
 *      
 *      // Moment constructor. Moments contain Messages, and are contained by Tracks.
 *      Moment(msPositionInScore)
 *                                
 *  Public Moment interface:
 *      
 *      // an array of temporally ordered Messages.
 *      messages
 *
 *      // (read-only) UNDEFINED_TIMESTAMP or
 *      // relative to the beginning of the score or other existing file (SMF) .
 *      msPositionInScore;
 *      
 *      // The time at which the moment is sent. Initially UNDEFINED_TIMESTAMP.
 *      // Is set to absolute DOMHRT time in Sequence.nextMoment().
 *      timestamp;
 *      
 *      // Either UNDEFINED_TIMESTAMP or relative to the beginning of a subsequence.
 *      // This value, which is set by the Assistant, is only used only during performances
 *      // with a live performer. (In such performances, the original, complete sequence
 *      // is converted to a list of subsequences, each of which corresponds to a chord
 *      // or rest symbol in the performer's track. The subsequences are then treaded
 *      // exactly like a sequence in a performance without a live performer.
 *      // Subsequences have exactly the same form as ordinary sequences, and the
 *      // Sequence object (defined in Sequence.js) plays both in exactly the same way.
 *      msPositionReSubsequence;
 *
 *      // functions (defined on the prototype):
 *
 *          // appends the messages from another Moment, having the
 *          // same msPositioninScore, to the end of this Moment.
 *          mergeMoment(moment);
 *             
 *  Note about UNDEFINED_TIMESTAMP:
 *  The idea behind this is always to have timestamp and msPositionReSubsequence defined in
 *  some way, so that memory use becomes more consistent during performance, and garbage
 *  collection interruptions become less likely. In other words: It would be possible to
 *  reproduce the same behaviour using defined and undefined timestamp/msPositionReSubsequence,
 *  but this would mean allocating memory for them at performance time, possibly leading to
 *  garbage collections which would interrupt the performance. If this fear is ungrounded,
 *  timestamp and msPositionReSubsequence could simply be defined or undefined instead of
 *  always being defined.
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDILib.namespace('MIDILib.moment');

MIDILib.moment = (function ()
{
    "use strict";

    var
    UNDEFINED_TIMESTAMP = -1,

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

        if (msPositionInScore === undefined)
        {
            Object.defineProperty(this, "msPositionInScore", { value: UNDEFINED_TIMESTAMP, writable: false });
        }
        else
        {
            Object.defineProperty(this, "msPositionInScore", { value: msPositionInScore, writable: false });
        }

        // The absolute time (DOMHRT) at which this moment is sent to the output device.
        // This value is always set in Sequence.nextMoment().
        this.timestamp = UNDEFINED_TIMESTAMP;

        // This value is only set (in Assistant.js) for assisted performances
        this.msPositionReSubsequence = UNDEFINED_TIMESTAMP;

        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

    // This constant is used as the default value of this.msPositionReSubsequence and
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

        if (moment2.chordStart !== undefined)
        {
            Object.defineProperty(this, "chordStart", { value: true, writable: false });
        }
        else if (moment2.restStart !== undefined)
        {
            Object.defineProperty(this, "restStart", { value: true, writable: false });
            //moment2.messages is always empty here...
            //console.log("RestStart: nMessages=" + moment2.messages.length);
        }

        this.messages = this.messages.concat(moment2.messages);
    };

    return publicAPI;

} ());
