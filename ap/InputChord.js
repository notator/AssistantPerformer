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
    // An InputChord contains all the information required for playing an (ornamented) chord.
    InputChord = function(timeObject, outputTracks)
    {
    	function getInputNotes(inputNoteDefs, msPosition, outputTracks)
    	{
    		var i, nInputNoteDefs = inputNoteDefs.length, inputNoteDef, 
				inputNote, inputNotes = [],
				j, trk, trks, trkMsPosition, trkRefDef, trkRefDefs,
				trkLength,
				k, midiObjects, indexInMidiObjects, midiObjectsAndIndex;

    		function getMidiObjectsAndIndex(outputTracks, midiChannel, msPosition)
    		{
    			var found = false, i, midiObjects, outputTrack, nOutputTracks = outputTracks.length,
					index, midiObjectsAndIndex = {};

    			for(i = 0; i < nOutputTracks; ++i)
    			{
    				outputTrack = outputTracks[i];
    				if(outputTrack.midiChannel === midiChannel)
    				{
    					found = true;
    					break;
    				}
    			}
    			if(found === false)
    			{
    				throw "InputChord.js: Can't find the output track referenced by this midi channel!";
    			}

    			found = false;
    			midiObjects = outputTrack.midiObjects;
    			for(index = 0; index < midiObjects.length; ++index)
    			{
    				if(midiObjects[index].msPositionInScore === msPosition)
    				{
    					found = true;
    					break;
    				}
    			}
    			if(found === false)
    			{
    				throw "InputChord.js: Can't find the beginning of the trk!";
    			}

    			midiObjectsAndIndex.midiObjects = midiObjects;
    			midiObjectsAndIndex.index = index;
    			return midiObjectsAndIndex;
    		}

    		for(i = 0; i < nInputNoteDefs; ++i)
    		{
    			inputNoteDef = inputNoteDefs[i];
    			inputNote = {};
    			inputNote.notatedKey = inputNoteDef.notatedKey;
    			trks = [];
    			if(inputNoteDef.inputControls !== undefined)
    			{
    				inputNote.inputControls = inputNoteDef.inputControls; // can be undefined
    			}
    			trkRefDefs = inputNoteDef.trkRefs;
    			for(j = 0; j < trkRefDefs.length; ++j)
    			{
    				trkRefDef = trkRefDefs[j];
    				trk = [];
    				if(trkRefDef.mOffset !== undefined)
    				{
    					trk.msOffset = trkRefDef.mOffset; // can be undefined
    				}
    				if(trkRefDef.inputControls !== undefined)
    				{
    					trk.inputControls = trkRefDef.inputControls; // can be undefined
    				}
    				trkMsPosition = (trkRefDef.mOffset === undefined) ? msPosition : msPosition + trkRefDef.mOffset;
    				midiObjectsAndIndex = getMidiObjectsAndIndex(outputTracks, trkRefDef.midiChannel, trkMsPosition);
    				midiObjects = midiObjectsAndIndex.midiObjects;
    				indexInMidiObjects = midiObjectsAndIndex.index;
    				trkLength = trkRefDef.length;

    				for(k = 0; k < trkLength; ++k)
    				{
    					trk.push(midiObjects[indexInMidiObjects++]);
    				}
    				trks.push(trk);
    			}

    			inputNote.seq = new _AP.seq.Seq(trks);

    			inputNotes.push(inputNote);
    		}

    		return inputNotes;
    	}

        if(!(this instanceof InputChord))
        {
        	return new InputChord(timeObject, outputTracks);
        }

        // The timeObject takes the global speed option into account.
        Object.defineProperty(this, "msPositionInScore", { value: timeObject.msPosition, writable: false });
        Object.defineProperty(this, "msDurationInScore", { value: timeObject.msDuration, writable: false });
        if(timeObject.inputControls !== undefined)
        {
        	Object.defineProperty(this, "inputControls", { value: timeObject.inputControls, writable: false });
        }

    	// an array of inputNote objects. Each inputNote contains the following fields
    	//		inputNote.notatedKey
    	//		inputNote.seq
    	//		inputNote.inputControls (can be undefined)
        this.inputNotes = getInputNotes(timeObject.inputChordDef.inputNotes, timeObject.msPosition, outputTracks);

        return this;
    },

    publicInputChordAPI =
    {
        // public InputChord constructor
    	// A InputChord contains a private array of inputNotes.
    	// Each inputNote contains an array of parallel MidiObject arrays (trks). 
        InputChord: InputChord
    };
    // end var

    // Seq.prototype functions come here...

    return publicInputChordAPI;
}());
