/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Moment.js
 *  The _AP.moment namespace which defines
 *
 *      // A read-only constant (-1), used by Moments
 *      UNDEFINED_TIMESTAMP
 *      
 *      // Moment constructor. Moments contain Messages, and are contained by Tracks.
 *      Moment(msPositionInChord)
 *                                
 *  Public Moment interface:
 *      
 *      // an array of temporally ordered Messages.
 *      messages
 *
 *      // the msPosition of the Moment in the score, relative to the beginning of its MidiChord.
 *      msPositionInChord;
 *      
 *      // The time at which the moment is actually sent. Initially UNDEFINED_TIMESTAMP.
 *      // Is set to absolute DOMHRT time in Sequence.nextMoment().
 *      timestamp;
 *
 *      // functions (defined on the prototype):
 *
 *      // appends the messages from another Moment, having the
 *      // same msPositionInChord, to the end of this Moment.
 *      mergeMoment(moment);
 */

_AP.namespace('_AP.moment');

_AP.moment = (function ()
{
    "use strict";

    var
    UNDEFINED_TIMESTAMP = -1,

    // Moment constructor
    // The moment.msPositionInChord is the position of the moment wrt its MidiChord or MidiRest.
    // it is initially set to the value sored in the score, but changes if the performance speed is not 100%.
    // During performances (when the absolute DOMHRT time is known) moment.msPositionInChord is used, with
    // the msPosition of the containing MidiChord or MidiRest, to set moment.timestamp. 
    Moment = function (msPositionInChord, systemIndex)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(msPositionInChord);
        }

        if(msPositionInChord === undefined || msPositionInChord < UNDEFINED_TIMESTAMP)
        {
            throw "Error: Moment.msPositionInChord must be defined.";
        }

        Object.defineProperty(this, "msPositionInChord", { value: msPositionInChord, writable: true });
        Object.defineProperty(this, "systemIndex", { value: systemIndex, writable: false });

        // The absolute time (DOMHRT) at which this moment is sent to the output device.
        // This value is always set in Sequence.nextMoment().
        this.timestamp = UNDEFINED_TIMESTAMP;

        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        UNDEFINED_TIMESTAMP: UNDEFINED_TIMESTAMP,
        // creates an empty Moment
        Moment: Moment
    };

    // Adds the moment2.messages to the end of the current messages using
    // msPositionInChord attributes to check synchronousness.
    // Sets this.systemIndex if necessary to flag that this is a possible place to align a runningMarker.
    // Throws an exception if moment2.msPositionInChord !== this.msPositionInChord.
    Moment.prototype.mergeMoment = function (moment2)
    {
        var msPositionInChord = this.msPositionInChord;

        console.assert(msPositionInChord === moment2.msPositionInChord, "Attempt to merge moments having different msPositionInChord values.");

        if (moment2.systemIndex !== undefined)
        {
            Object.defineProperty(this, "systemIndex", { value: moment2.systemIndex, writable: false });
        }

        this.messages = this.messages.concat(moment2.messages);
    };

    // return a deep clone of this moment at a new msPositionReChord
    Moment.prototype.getCloneAtOffset = function(offset)
    {
        var
        i, originalMsg,
        msPositionReChord = this.msPositionInChord + offset,
        clone = new Moment(msPositionReChord);

        for(i = 0; i < this.messages.length; ++i)
        {
            originalMsg = this.messages[i];
            clone.messages.push(originalMsg.clone());
        }
        return clone;
    };

    return publicAPI;

} ());
