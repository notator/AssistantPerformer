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
    	//		.trkOptions -- undefined or an TrkOptions object
    	//		.noteOn -- undefined (or see below)
    	//      .pressure[] -- undefined or an array of channel indices.
    	//      .noteOff -- undefined (or see below)
    	//
    	//		.noteOn and .noteOff can have the following fields:
    	//			.trkOffs[] -- undefined or an array of channel indices
    	//			.seq -- undefined or an array of trkRef
    	//				A trkRef has the following fields:
    	//					.trkOptions -- undefined or an TrkOptions object
    	//					.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    	//					.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    	//					.length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
		//------------------------------------------------------------------------------
    	// getInputNotes() Returns:
    	// An array of inputNote objects, each of which may have the following fields:
    	//		.trkOptions  -- undefined or an TrkOptions object
    	//		.noteOn -- undefined (or see below)
    	//		.pressureChannels -- undefined or an array of channel indices
    	//		.noteOff -- undefined (or see below)
    	//
    	//		.noteOn and .noteOff can have the following fields:
    	//			.trkOffs[] -- undefined or an array of channel indices to be sent trkOff messages.
    	//			.trks[] -- undefined or an array of (parallel) trks to be sent trkOn messages.
    	//
    	//			each trk in trks[] can have the following fields:
    	//				.trkOptions -- undefined or an TrkOptions object.
    	//				.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    	//		   ???? .midiObjectIndex -- compulsory (Do I really need this in the trk definition??). The index of the first object in the trk in the whole track.midiObjects array.
    	//				.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    	function getInputNotes(inputNoteDefs, outputTracks, chordMsPositionInScore)
    	{
    		var i, nInputNoteDefs = inputNoteDefs.length, inputNoteDef,
				inputNote, inputNotes = [];

    		// The noteInfo argument can have the following fields:
    		//      noteInfo.trkOns -- undefined or an array of trkOn with a (possibly undefined) TrkOptions field.
    		//		noteInfo.trkOffs -- undefined or an array of trkOff with a (possibly undefined) TrkOptions field.
			// The above trkOns and trkOffs have midiChannel fields that are converted to trackIndices in the returned object.
    		// Returns an object which may have the following fields:
    		//			.trkOffs -- undefined or an array of trkOffs (the trackIndex and msPositionInScore of each trk to be sent a trkOff message).
    		//			.seq -- undefined or an array of (parallel) trks (to be sent trkOn messages).
    		//			 A Trk object may have the following fields:
    		//				.trkOptions -- undefined or an TrkOptions object.
    		//				.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    		//		   ???? .midiObjectIndex -- compulsory (??). The index of the first object in the trk in the whole track.midiObjects array.
    		//				.msOffset -- compulsory. Usually 0. The msDurationInScore between this InputNote and the first midiObject in the trk.
    		//				.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    		function getNoteInfo(noteInfo, outputTracks, chordMsPositionInScore)
    		{
    			var rval = {};

    			// Argument 1 is an array of trkOn. A trkOn has the following fields:
    			//		.trkOptions -- undefined or an TrkOptions object
    			//		.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
    			//		.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk.)
    			//		.nMidiObjects (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
				// The trkOns array may itself have an trkOptions attribute.
				//
    			// returns an array of trk (!) that may have an TrkOptions attribute.
    			// A Trk object may have the following fields:
    			//		.trkOptions -- undefined or an TrkOptions object.
    			//		.trackIndex -- compulsory. The index of the track in the score (top to bottom)
    			// ???? .midiObjectIndex -- compulsory (??). The index of the first object in the trk in the whole track.midiObjects array.
				//		.msOffset -- compulsory. Usually 0. The msDurationInScore between this InputNote and the first midiObject in the trk.
    			//		.midiObjects -- compulsory. The array of midiChords and Rests in the trk.
    			function getOnSeq(onSeq, outputTracks, chordMsPositionInScore)
    			{
    				var trk, trks = [], i, trkOn, nTrkOns = onSeq.length, trackMidiObjects;

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
    					trkOn = onSeq[i];
    					trk = {};
						
    					if(trkOn.trkOptions !== undefined)
    					{
    						trk.trkOptions = trkOn.trkOptions;
    					}
    					trk.trackIndex = outputTracks.trackIndexPerMidiChannel[trkOn.midiChannel];
    					trackMidiObjects = outputTracks[trk.trackIndex].midiObjects;
    					trk.midiObjectIndex = getMidiObjectIndex(trkOn.msPosition, trackMidiObjects);
    					trk.msOffset = trackMidiObjects[trk.midiObjectIndex].msPositionInScore - chordMsPositionInScore;
    					trk.midiObjects = getMidiObjects(trk.midiObjectIndex, trkOn.nMidiObjects, trackMidiObjects);

    					trks.push(trk);
    				}

    				if(onSeq.trkOptions !== undefined)
    				{
    					trks.trkOptions = onSeq.trkOptions;
    				}

    				return trks;
    			}

    			function getOffSeq(offSeq, trackIndexPerMidiChannel)
    			{
    				var i, nTrkOffs = offSeq.length, tOff, tOffs = [];

    				for(i=0; i < nTrkOffs; ++i)
    				{
    					tOff = {};
    					tOff.trackIndex = trackIndexPerMidiChannel[offSeq[i].midiChannel];
    					tOff.msPosition = offSeq[i].msPosition;
    					tOffs.push(tOff);						
    				}
    				if(offSeq.trkOptions !== undefined)
    				{
    					tOffs.trkOptions = offSeq.trkOptions;
    				}
    				return tOffs;
    			}

    			if(noteInfo.onSeq !== undefined)
    			{
    				rval.onSeq = getOnSeq(noteInfo.onSeq, outputTracks, chordMsPositionInScore);
    			}
    			if(noteInfo.offSeq !== undefined)
    			{
    				rval.offSeq = getOffSeq(noteInfo.offSeq, outputTracks.trackIndexPerMidiChannel);
    			}

    			return rval;
    		}

    		function getTrackOpts(channelOpts, trackIndexPerMidiChannel)
    		{
    			var i, nChannelOpts = channelOpts.length, channelOpt, trackOpt, trackOpts = [];

    			if(channelOpts.trkOptions !== undefined)
    			{
    				trackOpts.trkOptions = channelOpts.trkOptions;
    			}
    			
    			for(i = 0; i < nChannelOpts; ++i)
    			{
    				trackOpt = {};
    				channelOpt = channelOpts[i];
    				if(channelOpt.trkOptions !== undefined)
    				{
    					trackOpt.trkOptions = channelOpt.trkOptions;
    				}
    				trackOpt.trackIndex = trackIndexPerMidiChannel[channelOpt.midiChannel];

    				trackOpts.push(trackOpt);
    			}

    			return trackOpts;
    		}

    		for(i = 0; i < nInputNoteDefs; ++i)
    		{
    			inputNoteDef = inputNoteDefs[i];
    			inputNote = {};
    			inputNote.notatedKey = inputNoteDef.notatedKey;
    			if(inputNoteDef.trkOptions !== undefined)
    			{
    				inputNote.trkOptions = inputNoteDef.trkOptions;
    			}
    			if(inputNoteDef.noteOn !== undefined)
    			{
    				inputNote.noteOn = getNoteInfo(inputNoteDef.noteOn, outputTracks, chordMsPositionInScore);
    			}
    			if(inputNoteDef.pressures !== undefined)
    			{
    				inputNote.pressures = getTrackOpts(inputNoteDef.pressures, outputTracks.trackIndexPerMidiChannel);
    			}
    			if(inputNoteDef.pitchWheels !== undefined)
    			{
    				inputNote.pitchWheels = getTrackOpts(inputNoteDef.pitchWheels, outputTracks.trackIndexPerMidiChannel);
    			}
    			if(inputNoteDef.modWheels !== undefined)
    			{
    				inputNote.modWheels = getTrackOpts(inputNoteDef.modWheels, outputTracks.trackIndexPerMidiChannel);
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
        if(timeObject.inputChordDef.trkOptions !== undefined)
        {
        	Object.defineProperty(this, "trkOptions", { value: timeObject.inputChordDef.trkOptions, writable: false });
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
