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
 *       Moment(msPositionInScore) // constructs an empty Moment at msPositionInScore
 *
 *       Public interface:
 *        moment.msPositionInScore; // relative to the beginning of the score (read-only)
 *        moment.timestamp; // always either UNDEFINED_TIMESTAMP or absolute DOMHRT time.
 *        moment.messages;    // an array of MIDILib.messages. 
 *        moment.mergeMoment(moment);   // appends the messages from another Moment, having the
 *                                      // same msPositioninScore, to the end of this Moment.  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

MIDILib.namespace('MIDILib.moment');

MIDILib.moment = (function ()
{
    "use strict";

    var

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
        this.timestamp = MIDILib.constants.OTHER.UNDEFINED_TIMESTAMP;
        this.messages = []; // an array of Messages

        return this;
    },

    publicAPI =
    {
        // creates an empty Moment
        Moment: Moment
    };

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

    return publicAPI;

} ());
