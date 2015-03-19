/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Seq.js
*  The _AP.seq namespace containing:
* 
*		// Seq constructor
*       Seq(noteSeqTrks, inputControls, endMarkerMsPosInScore) 
*
* Functions (in prototype): 
*
*		// inputControls is the current state of the inputControls       
*       play(inputControls)
* 
*		// inputControls is the current state of the inputControls
*       stop(inputControls)  
*  
*		// sets the speed at which this Seq plays.     
*       setSpeedFactor(factor) 
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */


_AP.namespace('_AP.seq');

_AP.seq = (function()
{
	"use strict";
	var

	// A seq is an object having the following attributes
	//seq.trks[]	// An array of parallel tracks - initialized from inputChord.inputNotes in the span (excluding non-playing outputTracks).
	//				// This array is never empty. If it would be empty (because tracks have been turned off), the seq is not created.
	//				// The outputChords and outputRests in each trk are in range of the span (they do not continue beyond endMarkerMsPosition).
	//seq.seqMsPosIndex  // The index in allSeqMsPositions of the seq's noteOn position.
	//seq.nextSeqMsPosIndex // The index in allSeqMsPositions of the following seq's noteOn position.
	//seq.triggeredOn	// Is set to true when the seq is triggered On. Default is false.
	//seq.triggeredOff	// Is set to true when the seq is triggered Off. Default is false.
	//seq.inputControls // undefined or from inputChord.inputNotes
	Seq = function(noteSeqTrks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, endMarkerMsPosInScore)
	{
		var i, j, trk, trks = [], midiObject, midiObjects, trkMidiObjects;

		if(!(this instanceof Seq))
		{
			return new Seq(noteSeqTrks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, endMarkerMsPosInScore);
		}

		console.assert(inputControls !== undefined, "inputControlArgs must be defined here");

		for(i = 0; i < noteSeqTrks.length; ++i)
		{
			trk = new _AP.track.Track();
			midiObjects = [];
			trkMidiObjects = noteSeqTrks[i];
			for(j = 0; j < trkMidiObjects.length; ++j)
			{
				midiObject = trkMidiObjects[j];
				if(midiObject instanceof _AP.midiChord.MidiChord)
				{
					midiObject = new _AP.midiChord.MidiChord(midiObject); //clone constructor
					console.assert(midiObject instanceof _AP.midiChord.MidiChord, "error");
				}
				// midiRests are not cloned (because they never change at runtime).
				midiObjects.push(midiObject);
			}
			trk.midiObjects = midiObjects;
			trk.setForOutputSpan(midiObjects[0].msPositionInScore, endMarkerMsPosInScore);

			trks.push(trk);
		}
		Object.defineProperty(this, "trks", { value: trks, writable: false });
		Object.defineProperty(this, "seqMsPosIndex", { value: seqMsPosIndex, writable: false });
		Object.defineProperty(this, "nextSeqMsPosIndex", { value: nextSeqMsPosIndex, writable: false });
		Object.defineProperty(this, "triggeredOn", { value: false, writable: true });
		Object.defineProperty(this, "triggeredOff", { value: false, writable: true });
		Object.defineProperty(this, "inputControls", { value: inputControls, writable: false });
	},

	API =
	{
		Seq: Seq // constructor
	};
	// end var

	Seq.prototype.play = function(workerData, inputControls)
	{
		this.worker = workerData.worker;
		this.worker.postMessage({ action: "play", tracks: this.trks, inputControls: inputControls, workerIndex: workerData.workerIndex });
		this.triggeredOn = true; // triggeredOn is used when shunting.
	};

	Seq.prototype.stop = function(inputControls)
	{
		this.worker.postMessage({ action: "stop", inputControls: inputControls });
		this.triggeredOff = true; // triggeredOff is used when shunting.
	};

	Seq.prototype.setSpeedFactor = function(factor)
	{
		this.worker.postMessage({ action: "setSpeedFactor", factor: factor });
	};

	return API;

}());




