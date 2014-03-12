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
 *      Moment(msPositionInChord)
 *                                
 *  Public Moment interface:
 *      
 *      // an array of temporally ordered Messages.
 *      messages
 *
 *      // the msPosition of the Moment in the score, relative to the beginning of its MIDIChord.
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

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDILib.namespace('MIDILib.moment');

MIDILib.moment = (function ()
{
    "use strict";

    var
    UNDEFINED_TIMESTAMP = -1,

    // Moment constructor
    // The moment.msPositionInChord is the (read only) position of the moment wrt its MIDIChord in the score.
    // It is used to set moment.timestamp, taking the position of the MIDIChord and the speed of performance into account,
    // when the absolute DOMHRT time is known. 
    Moment = function (msPositionInChord)
    {
        if (!(this instanceof Moment))
        {
            return new Moment(msPositionInChord);
        }

        if(msPositionInChord === undefined || msPositionInChord < 0)
        {
            throw "Error: Moment.msPositionInChord must be defined.";
        }

        Object.defineProperty(this, "msPositionInChord", { value: msPositionInChord, writable: false });

        // The absolute time (DOMHRT) at which this moment is sent to the output device.
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

    // Adds the moment2.messages to the end of the current messages using
    // msPositionInChord attributes to check synchronousness.
    // Sets restStart, chordStart if necessary.
    // Throws an exception if moment2.msPositionInChord !== this.msPositionInChord.
    Moment.prototype.mergeMoment = function (moment2)
    {
        var msPositionInChord = this.msPositionInChord;

        if (msPositionInChord !== moment2.msPositionInChord)
        {
            throw "Error: attempt to merge moments having different msPositionInChord values.";
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
