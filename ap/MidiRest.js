/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/MidiRest.js
 *  Public interface:
 *      MidiRest(timeObject) // MidiRest constructor  
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.midiRest');

_AP.midiRest = (function()
{
    "use strict";
    // begin var
    var
    Moment = MIDILib.moment.Moment, // constructor

    // a MidiRest has the same structure as a MidiChord, but it
    // has a single Moment containing a single, empty message. 
    MidiRest = function(timeObject)
    {
        if(!(this instanceof MidiRest))
        {
            return new MidiRest(timeObject);
        }
        Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: false });
        Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });

        Object.defineProperty(this, "moments", { value: null, writable: true });
        Object.defineProperty(this, "currentMoment", { value: null, writable: true });

        this.moments = this._getMoments(); // defined in prototype

        return this;
    },

    publicRestAPI =
    {
        // A MidiRest is like a MidiChord which has a single, empty Moment.
        // MIDIRests are necessary so that running cursors can be moved to their
        // symbol, when sequences call reportMsPositionInScore(msPositionInScore).
        MidiRest: MidiRest
    };
    // end var

    // returns an array containing a single empty moment having a "restStart" attribute.
    // The moment's messages array is empty.
    MidiRest.prototype._getMoments = function()
    {
        var
        moments = [],
        restMoment;

        restMoment = new Moment(0);
        Object.defineProperty(restMoment, "restStart", { value: true, writable: false });

        moments.push(restMoment); // an empty moment.

        return moments;
    };

    // Set this.currentMoment to the first moment in this MidiRest.
    // Sets this.currentMoment to null if the moment.messages.length === 0.
    MidiRest.prototype.runtimeInit = function()
    {
        this.currentMoment = this.moments[0];
    };

    MidiRest.prototype.advanceMoment = function()
    {
        this.currentMoment = new Moment(this.msDurationInScore);
    };

    return publicRestAPI;
}());
