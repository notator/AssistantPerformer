/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/InputRest.js
 *  Public interface:
 *      InputRest(timeObject) // InputRest constructor  
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.inputRest');

_AP.inputRest = (function()
{
    "use strict";
    // begin var
    var
    InputRest = function(timeObject)
    {
        if(!(this instanceof InputRest))
        {
            return new InputRest(timeObject);
        }
        Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: true });
        Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });

        return this;
    },

    publicRestAPI =
    {
        // A InputRest is like a MidiChord which has a single, empty Moment.
        // InputRests are necessary so that running cursors can be moved to their
        // symbol, when sequences call reportMsPositionInScore(msPositionInScore).
        InputRest: InputRest
    };
    // end var

    return publicRestAPI;
}());
