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
    	//			.trkOffs[] -- undefined or an array of channel indices
    	//			.seq -- undefined or an array of trkRef
    	//				A trkRef has the following fields:
    	//					.inputControls -- undefined or an InputControls object
    	//					.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    	//					.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    	//					.length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
		//------------------------------------------------------------------------------
    	// getInputNotes() Returns:
    	// An array of inputNote objects, each of which may have the following fields:
    	//		.inputControls  -- undefined or an InputControls object
    	//		.noteOn -- undefined (or see below)
    	//		.pressureChannels -- undefined or an array of channel indices
    	//		.noteOff -- undefined (or see below)
    	//
    	//		.noteOn and .noteOff can have the following fields:
    	//			.trkOffs[] -- undefined or an array of channel indices to be sent trkOff messages.
    	//			.trks[] -- undefined or an array of (parallel) trks to be sent trkOn messages.
    	//
    	//			each trk in trks[] can have the following fields:
    	//				.inputControls -- undefined or an InputControls object.
    	//				.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    	//		   ???? .midiObjectIndex -- compulsory (Do I really need this in the trk definition??). The index of the first object in the trk in the whole track.midiObjects array.
    	//				.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    	function getInputNotes(inputNoteDefs, outputTracks, chordMsPositionInScore)
    	{
    		var i, nInputNoteDefs = inputNoteDefs.length, inputNoteDef,
				inputNote, inputNotes = [];

    		function trackIndices(trackIndexPerMidiChannel, midiChannelIndices)
    		{
    			var i, indices = [], nIndices = midiChannelIndices.length;

    			for(i = 0; i < nIndices; ++i)
    			{
    				indices.push(trackIndexPerMidiChannel[midiChannelIndices[i]]);
    			}
    			return indices;
    		}

    		// The noteInfo argument can have the following fields:
    		//      noteInfo.trkOns -- undefined or an array of trkOn with a (possibly undefined) InputControls field.
    		//		noteInfo.trkOffs -- undefined or an array of trkOff with a (possibly undefined) InputControls field.
			// The above trkOns and trkOffs have midiChannel fields that are converted to trackIndices in the returned object.
    		// Returns an object which may have the following fields:
    		//			.trkOffs -- undefined or an array of trkOffs (the trackIndex and msPositionInScore of each trk to be sent a trkOff message).
    		//			.seq -- undefined or an array of (parallel) trks (to be sent trkOn messages).
    		//			 A Trk object may have the following fields:
    		//				.inputControls -- undefined or an InputControls object.
    		//				.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    		//		   ???? .midiObjectIndex -- compulsory (??). The index of the first object in the trk in the whole track.midiObjects array.
    		//				.msOffset -- compulsory. Usually 0. The msDurationInScore between this InputNote and the first midiObject in the trk.
    		//				.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    		function getNoteInfo(noteInfo, outputTracks, chordMsPositionInScore)
    		{
    			var rval = {};

    			// Argument 1 is an array of trkOn. A trkOn has the following fields:
    			//		.inputControls -- undefined or an InputControls object
    			//		.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    			//		.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    			//		.nMidiObjects (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
				// The trkOns array may itself have an inputControls attribute.
				//
    			// returns an array of trk (!) that may have an InputControls attribute.
    			// A Trk object may have the following fields:
    			//		.inputControls -- undefined or an InputControls object.
    			//		.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    			// ???? .midiObjectIndex -- compulsory (??). The index of the first object in the trk in the whole track.midiObjects array.
				//		.msOffset -- compulsory. Usually 0. The msDurationInScore between this InputNote and the first midiObject in the trk.
    			//		.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    			function getSeq(trkOns, outputTracks, chordMsPositionInScore)
    			{
    				var trk, trks = [], i, trkOn, nTrkOns = trkOns.length, trackMidiObjects;

    				function getMidiObjectIndex(trkMsPosition, midiObjects)
    				{
    					var found = false, midiObjectIndex;

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

    				function getMidiObjects(startIndex, length, trackMidiObjects)
    				{
    					var midiObjects = [], i, midiObjIndex = startIndex;

    					for(i=0; i < length; ++i)
    					{
    						midiObjects.push(trackMidiObjects[midiObjIndex++]);
    					}
    					return midiObjects;
    				}

    				for(i = 0; i < nTrkOns; ++i)
    				{
    					trkOn = trkOns[i];
    					trk = {};
						
    					if(trkOn.inputControls !== undefined)
    					{
    						trk.inputControls = trkOn.inputControls;
    					}
    					trk.trackIndex = outputTracks.trackIndexPerMidiChannel[trkOn.midiChannel];
    					trackMidiObjects = outputTracks[trk.trackIndex].midiObjects;
    					trk.midiObjectIndex = getMidiObjectIndex(trkOn.msPosition, trackMidiObjects);
    					trk.msOffset = trackMidiObjects[trk.midiObjectIndex].msPositionInScore - chordMsPositionInScore;
    					trk.midiObjects = getMidiObjects(trk.midiObjectIndex, trkOn.nMidiObjects, trackMidiObjects);

    					trks.push(trk);
    				}

    				if(trkOns.inputControls !== undefined)
    				{
    					trks.inputControls = trkOns.inputControls;
    				}

    				return trks;
    			}

    			function getTrkOffs(trkOffs, trackIndexPerMidiChannel)
    			{
    				var i, nTrkOffs = trkOffs.length, tOff, tOffs = [];

    				for(i=0; i < nTrkOffs; ++i)
    				{
    					tOff = {};
    					tOff.trackIndex = trackIndexPerMidiChannel[trkOffs[i].midiChannel];
    					tOff.msPosition = trkOffs[i].msPosition;
    					tOffs.push(tOff);						
    				}
    				if(trkOffs.inputControls !== undefined)
    				{
    					tOffs.inputControls = trkOffs.inputControls;
    				}
    				return tOffs;
    			}

    			if(noteInfo.trkOns !== undefined)
    			{
    				rval.seq = getSeq(noteInfo.trkOns, outputTracks, chordMsPositionInScore);
    			}
    			if(noteInfo.trkOffs !== undefined)
    			{
    				rval.trkOffs = getTrkOffs(noteInfo.trkOffs, outputTracks.trackIndexPerMidiChannel);
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
    				inputNote.noteOn = getNoteInfo(inputNoteDef.noteOn, outputTracks, chordMsPositionInScore);
    			}
    			if(inputNoteDef.pressures !== undefined)
    			{
    				inputNote.pressures = inputNoteDef.pressures;
    			}
    			if(inputNoteDef.noteOff !== undefined)
    			{
    				inputNote.noteOff = getNoteInfo(inputNoteDef.noteOff, outputTracks, chordMsPositionInScore);
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
