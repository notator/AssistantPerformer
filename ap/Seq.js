/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Seq.js
 *  Public interface:
 *      Seq(trks) // Seq constructor 
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  performance: false, console: false */

_AP.namespace('_AP.seq');

_AP.seq = (function()
{
    "use strict";
    // begin var
    var		
    Seq = function(trks)
    {
        if(!(this instanceof Seq))
        {
        	return new Seq(trks);
        }

        // The timeObject takes the global speed option into account.
        Object.defineProperty(this, "trks", { value: trks, writable: false });

        this.demoFunc();

        return this;
    },

    publicInputChordAPI =
    {
    	// public Seq constructor
    	// A Seq is like a Sequence. Each inputNote in InputChord.inputNotes has a seq that is triggered when the inputNote's key is pressed.
    	Seq: Seq

    	// Each Seq runs in a separate worker thread, and can react to the following messages:
 
    };
    // end var

    Seq.prototype.demoFunc = function()
    {
    	
    };

    return publicInputChordAPI;
}());
