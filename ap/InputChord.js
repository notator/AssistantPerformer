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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

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
				k, midiObjects, midiObjectIndex, trackData;

    		function getTrackData(outputTracks, midiChannel, msPosition)
    		{
    			var found = false, i, trackIndex = -1, midiObjects, outputTrack, nOutputTracks = outputTracks.length,
					midiObjectIndex, trackData = {};

    			for(i = 0; i < nOutputTracks; ++i)
    			{
    				outputTrack = outputTracks[i];
    				if(outputTrack.midiChannel === midiChannel)
    				{
    					trackIndex = i;
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
    			for(midiObjectIndex = 0; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
    			{
    				if(midiObjects[midiObjectIndex].msPositionInScore === msPosition)
    				{
    					found = true;
    					break;
    				}
    			}
    			if(found === false)
    			{
    				throw "InputChord.js: Can't find the beginning of the trk!";
    			}

    			trackData.trackIndex = trackIndex;
				trackData.midiObjects = midiObjects;
    			trackData.midiObjectIndex = midiObjectIndex;
    			return trackData;
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
    				trkMsPosition = (trkRefDef.mOffset === undefined) ? msPosition: msPosition + trkRefDef.mOffset;

    				trackData = getTrackData(outputTracks, trkRefDef.midiChannel, trkMsPosition);

    				// This is the track index from the top of the score (i.e. the index in the trackIsOnArray).
					// Need to check trackIsOn at performance time. 
    				trk.trackIndex = trackData.trackIndex;

    				midiObjects = trackData.midiObjects;
    				midiObjectIndex = trackData.midiObjectIndex;
    				trkLength = trkRefDef.length;

    				for(k = 0; k < trkLength; ++k)
    				{
    					trk.push(midiObjects[midiObjectIndex++]);
    				}
    				trks.push(trk);
    			}

    			inputNote.trks = trks;

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
