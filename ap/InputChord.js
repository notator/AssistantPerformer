/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/InputChord.js
 *  Public interface:
 *      InputChord(timeObject, outputTracks) // InputChord constructor 
 */

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  performance: false, console: false */

_AP.namespace('_AP.inputChord');

_AP.inputChord = (function()
{
    "use strict";
    // begin var
    var


    // public InputChord constructor
    // A InputChord contains all the information required for playing an (ornamented) chord.
    InputChord = function(timeObject, outputTracks)
    {
    	var rval = {};

        if(!(this instanceof InputChord))
        {
        	return new InputChord(inputChordDef, timeObject, outputTracks);
        }

        // The timeObject takes the global speed option into account.
        Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: false });
        Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });

    	// an array of noteSeq objects. Each noteSeq contains the following fields
    	//		noteSeq.notatedkey
    	//		noteSeq.Seq
		//		noteSeq.inputOptions (optional)
        this.noteSeqs = this.getNoteSeqs(timeObject.inputChordDef, outputTracks);

        return this;
    },

    publicInputChordAPI =
    {
        // public InputChord constructor
        // A InputChord contains a private array of Moments containing all
        // the midi messages required for playing an (ornamented) chord.
        // A Moment is a collection of logically synchronous MIDI messages.
        InputChord: InputChord
    };
    // end var

    InputChord.prototype.getNoteSeqs = function(inputChordDef, outputTracks)
    {
    	var noteSeqs = [];
    	// TODO
    	return noteSeqs;
    };

    return publicInputChordAPI;
}());
