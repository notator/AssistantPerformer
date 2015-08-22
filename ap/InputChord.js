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
    	var inputNotes;

    	// getInputNotes() Arguments:
    	// Each object in the inputNoteDefs argument contains the following fields
    	//		.notatedKey (a number. The MIDI index of the notated key.)
    	//		.inputControls -- undefined or an InputControls object
    	//		.noteOn -- undefined (or see below)
    	//      .pressure[] -- undefined or an array of channel indices.
    	//      .noteOff -- undefined (or see below)
    	//
    	//		.noteOn and .noteOff can have the following fields:
    	//			.trkOffs[] -- undefined or an array of channel indices.
    	//			.inputControls -- undefined or an InputControls object
    	//			.seq -- undefined (or an array of trkRef)
    	//				A trkRef has the following fields:
    	//					.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    	//					.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    	//					.length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
    	//					.inputControls -- undefined or an InputControls object
		//------------------------------------------------------------------------------
    	// getInputNotes() Returns:
    	// An array of inputNote objects, each of which may have the following fields:
    	//		.inputControls  -- undefined or an InputControls object
    	//		.noteOn -- undefined (or see below)
    	//		.pressureChannels -- undefined or an array of channel indices
    	//		.noteOff -- undefined (or see below)
    	//
    	//		.noteOn and .noteOff can have the following fields:
    	//			.inputControls -- undefined or an InputControls object.
    	//			.trkOffs[] -- undefined or an array of channel indices to be sent trkOff messages.
		//			.trks[] -- undefined or an array of (parallel) trks to be sent trkOn messages.
    	function getInputNotes(inputNoteDefs, outputTracks, chordMsPositionInScore)
    	{
    		var i, nInputNoteDefs = inputNoteDefs.length, inputNoteDef,
				inputNote, inputNotes = [];

    		// The noteInfo argument can have the following fields:
    		//		.inputControls -- undefined or an InputControls object
    		//      .trkOffs[] -- undefined or an array of channel indices.
    		//		.seq -- undefined or an array of trkRef (Achtung: trkRef)
    		// Returns an object which may have the following fields:
    		//			.inputControls -- undefined or an InputControls object.
    		//			.trkOffs[] -- undefined or an array of channel indices (to be sent trkOff messages).
    		//			.trks[] -- undefined or an array of (parallel) trks (to be sent trkOn messages).
    		// A Trk object may have the following fields:
    		//		.inputControls -- undefined or an InputControls object.
    		//		.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    		// ???? .midiObjectIndex -- compulsory (Do I really need this in the trk definition??). The index of the first object in the trk in the whole track.midiObjects array.
    		//		.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    		function getNoteMomentInfo(noteInfo, outputTracks, chordMsPositionInScore)
    		{
    			var rval = {};

    			// Argument 1 is an array of trkRef. A trkRef has the following fields:
    			//		.inputControls -- undefined or an InputControls object
    			//		.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    			//		.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    			//		.length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
				//
    			// returns an array of trk (!)
    			// A Trk object may have the following fields:
    			//		.inputControls -- undefined or an InputControls object.
    			//		.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    			// ???? .midiObjectIndex -- compulsory (??). The index of the first object in the trk in the whole track.midiObjects array.
				//		.msOffset -- compulsory. Usually 0. The msDurationInScore between this InputNote and the first midiObject in the trk.
    			//		.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    			function getTrks(trkRefs, outputTracks, chordMsPositionInScore)
    			{
    				var trk, trks = [], i, trkRef, nTrkRefs = trkRefs.length, outputTrack;

    				function getTrackIndex(midiChannel, outputTracks)
    				{
    					var found = false, i, nOutputTracks = outputTracks.length, trackIndex;

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
    					return trackIndex;
    				}

    				function getMidiObjectIndex(trkMsPosition, outputTrack)
    				{
    					var found = false, midiObjectIndex, midiObjects = outputTrack.midiObjects;

    					for(midiObjectIndex = 0; midiObjectIndex < midiObjects.length; ++midiObjectIndex)
    					{
    						if(midiObjects[midiObjectIndex].msPositionInScore === trkMsPosition)
    						{
    							found = true;
    							break;
    						}
    					}
    					if(found === false)
    					{
    						throw "InputChord.js: Can't find the first midiObject in the trk!";
    					}
    					return midiObjectIndex;
    				}

    				function getMidiObjects(trackIndex, startIndex, length, outputTracks)
    				{
    					var midiObjects = [], i, midiObjIndex = startIndex;

    					for(i=0; i < length; ++i)
    					{
    						midiObjects.push(outputTracks[trackIndex][midiObjIndex++]);
    					}
    					return midiObjects;
    				}

    				for(i = 0; i < nTrkRefs; ++i)
    				{
    					trkRef = trkRefs[i];
    					trk = {};
						
    					if(trkRef.inputControls !== undefined)
    					{
    						trk.inputControls = trkRef.inputControls;
    					}
    					trk.trackIndex = getTrackIndex(trkRef.midiChannel, outputTracks);
    					trk.midiObjectIndex = getMidiObjectIndex(trkRef.msPosition, outputTracks[trk.trackIndex]);
    					trk.msOffset = outputTracks[trk.trackIndex][trk.midiObjectIndex].msPositionInScore - chordMsPositionInScore;
    					trk.midiObjects = getMidiObjects(trk.trackIndex, trk.midiObjectIndex, trkRef.length, outputTracks);

    					trks.push(trk);
    				}

    				return trks;
    			}

    			if(noteInfo.inputControls !== undefined)
    			{
    				rval.inputControls = noteInfo.inputControls;
    			}
    			if(noteInfo.trkOffs !== undefined)
    			{
    				rval.trkOffs = noteInfo.trkOffs;
    			}
    			if(noteInfo.seq !== undefined)
    			{
    				rval.trks = getTrks(noteInfo.seq, outputTracks, chordMsPositionInScore);
    			}

    			return rval;
    		}

    		for(i = 0; i < nInputNoteDefs; ++i)
    		{
    			inputNoteDef = inputNoteDefs[i];
    			inputNote = {};
    			inputNote.notatedKey = inputNoteDef.notatedKey;
    			if(inputNoteDef.inputControls !== undefined)
    			{
    				inputNote.inputControls = inputNoteDef.inputControls;
    			}
    			if(inputNoteDef.noteOn !== undefined)
    			{
    				inputNote.noteOn = getNoteMomentInfo(inputNoteDef.noteOn, outputTracks);
    			}
    			if(inputNoteDef.pressureChannels !== undefined)
    			{
    				inputNote.pressureChannels = inputNoteDef.pressure;
    			}
    			if(inputNoteDef.noteOff !== undefined)
    			{
    				inputNote.noteOff = getNoteMomentInfo(inputNoteDef.noteOff, outputTracks, chordMsPositionInScore);
    			}
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
        if(timeObject.inputChordDef.inputControls !== undefined)
        {
        	Object.defineProperty(this, "inputControls", { value: timeObject.inputChordDef.inputControls, writable: false });
        }

        inputNotes = getInputNotes(timeObject.inputChordDef.inputNotes, outputTracks, timeObject.msPosition);

        Object.defineProperty(this, "inputNotes", {value: inputNotes, writable: false});

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
