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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.midiRest');

_AP.midiRest = (function()
{
    "use strict";
    // begin var
    var
    // A MidiRest has the same structure as a MidiChord, but its moments array always contains a single moment.
    // moments[0] has a restStart attribute.
    // moments[0].messages is initially empty, but finalChordOffMessages can be added while a sequence is being created.
    MidiRest = function(timeObject)
    {
        if(!(this instanceof MidiRest))
        {
            return new MidiRest(timeObject);
        }
        Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: false });
        Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });
        Object.defineProperty(this, "moments", { value: [], writable: false });
        Object.defineProperty(this, "currentMoment", { value: new _AP.moment.Moment(0), writable: false });

        Object.defineProperty(this.currentMoment, "restStart", { value: true, writable: false });
        this.moments.push(this.currentMoment);

        return this;
    },

    publicRestAPI =
    {
        // A MidiRest is like a MidiChord which has a single, empty Moment.
        // MIDIRests are necessary so that running cursors can be moved to their
        // symbol, when sequences call reportMsPositionInScore(msPositionInScore).
        MidiRest: MidiRest
    };

	// This function returns null so that the track will move to the first moment in the following MidiChord!
    MidiRest.prototype.advanceCurrentMoment = function() { return null; };

    return publicRestAPI;
}());
