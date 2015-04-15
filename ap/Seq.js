/*
* Copyright 2012 James Ingram
* http://james-ingram-act-two.de/
*
* Code licensed under MIT
* https://github.com/notator/assistant-performer/blob/master/License.md
*
* ap/Seq.js
* The _AP.seq namespace containing:
* 
*        // Seq constructor
*        Seq(trackWorkers, seqTracks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, seqPositionInScore, endMarkerMsPosInScore)
*
* Functions (in prototype): 
*
*        // Called when the Seqs have been sorted into chronological order.
*        setWorkers()
* 
*        // Called when a noteOn is sent and this is the current Seq.       
*        play()
* 
*        // Called when a noteOff is sent while the Seq is playing.
*        stop()  
*  
*        // sets the speed at which this Seq plays.     
*        setSpeedFactor(factor) 
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */


_AP.namespace('_AP.seq');

_AP.seq = (function()
{
	"use strict";
	var
	// A seq is an object having the following attributes
	// seq.trackWorkers  -- An array of webWorkers, one per output track in the score.
	// seq.momentsPerTrk -- An array containing one array per Trk in the Seq.
	//                   -- Each contained array has a channelIndex attribute, and contains one trk's moments.
	// seq.seqMsPosIndex -- The index in allSeqMsPositions of the seq's noteOn position.
	// seq.nextSeqMsPosIndex -- The index in allSeqMsPositions of the following seq's noteOn position.
	// seq.triggeredOn   -- Is set to true when the seq is triggered On. Default is false.
	// seq.triggeredOff  -- Is set to true when the seq is triggered Off. Default is false.
	// seq.inputControls -- undefined or from inputChord.inputNotes
	Seq = function(trackWorkers, seqTracks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, seqPositionInScore, endMarkerMsPosInScore)
	{
		var momentsPerTrk;

		if(!(this instanceof Seq))
		{
			return new Seq(trackWorkers, seqTracks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, seqPositionInScore, endMarkerMsPosInScore);
		}

		console.assert(trackWorkers.length > 0, "trackWorkers must be defined here");
		console.assert(inputControls !== undefined, "inputControls must be defined here");

		// Returns an array containing one array per Trk in the Seq.
		// Each contained array has a workerIndex (=trackIndex) attribute, and contains the trk's moments.
		// Each moment has a messages[] attribute -- an array containing midiMessages that are to be sent "synchronously",
		// and an msPositionInSeq attribute.
		function getMomentsPerTrk(seqTrks, seqPositionInScore)
		{
			var i, j, k, trkMoments, moment, trkMoment, trkMidiObjects, midiObject, midiObjectMsPosInSeq,
			momentsPerTrk = [];

			for(i = 0; i < seqTrks.length; ++i)
			{
				trkMidiObjects = seqTrks[i];
				trkMoments = [];
				trkMoments.workerIndex = trkMidiObjects.trackIndex;
				for(j = 0; j < trkMidiObjects.length; ++j)
				{
					midiObject = trkMidiObjects[j];
					midiObjectMsPosInSeq = midiObject.msPositionInScore - seqPositionInScore;
					for(k = 0; k < midiObject.moments.length; ++k)
					{
						moment = midiObject.moments[k];
						if(moment.messages.length > 0) // midiRests can have empty messages.
						{
							trkMoment = {};
							if(moment.chordStart !== undefined)
							{
								trkMoment.chordStart = moment.chordStart;
							}
							if(moment.restStart !== undefined)
							{
								trkMoment.restStart = moment.restStart;
							}
							// all moments have an msPositionInChord attribute (even in midiRests)
							trkMoment.msPositionInSeq = midiObjectMsPosInSeq + moment.msPositionInChord;
							trkMoment.messages = moment.messages; // a clone of the messages is made when the trkMoment is transferred to the webWorker.
							trkMoments.push(trkMoment);
						}
					}
				}
				momentsPerTrk.push(trkMoments);
			}
			return momentsPerTrk;
		}

		momentsPerTrk = getMomentsPerTrk(seqTracks, seqPositionInScore);

		Object.defineProperty(this, "trackWorkers", { value: trackWorkers, writable: false });
		Object.defineProperty(this, "momentsPerTrk", { value: momentsPerTrk, writable: false });

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

	// Called when the Seqs have been sorted into chronological order.
	Seq.prototype.setWorkers = function()
	{
		var i, workerIndex, momentsPerTrk = this.momentsPerTrk;
		for(i = 0; i < momentsPerTrk.length; ++i)
		{
			workerIndex = momentsPerTrk[i].workerIndex;
			this.trackWorkers[workerIndex].postMessage({ action: "pushTrk", moments: momentsPerTrk[i], inputControls: this.inputControls });
		}
	};

	// Called when a noteOn is sent and this is the current Seq.
	Seq.prototype.play = function()
	{
		var i, momentsPerTrk = this.momentsPerTrk;

		function postPlay(trackWorkers, momentsPerTrk)
		{
			var i;
			for(i = 0; i < momentsPerTrk.length; ++i)
			{
				trackWorkers[momentsPerTrk[i].workerIndex].postMessage({ action: "play" }); // plays according to the inputControls set in the seq's constructor
			}
		}

		for(i = 0; i < momentsPerTrk.length; ++i)
		{
			this.trackWorkers[momentsPerTrk[i].workerIndex].postMessage({ action: "stopImmediately" }); // stops the worker immediately, if it is busy
		}

		postPlay(this.trackWorkers, momentsPerTrk);

		//setTimeout(postPlay(this.trackWorkers, momentsPerTrk), 2); // give the worker time to stop

		this.triggeredOn = true; // triggeredOn is used when shunting.
	};

	// Called when a noteOff is sent while the Seq is playing.
	Seq.prototype.stop = function()
	{
		var i, momentsPerTrk = this.momentsPerTrk;
		for(i = 0; i < momentsPerTrk.length; ++i)
		{
			this.trackWorkers[momentsPerTrk[i].workerIndex].postMessage({ action: "stop" }); // stops according to the inputControls set in the seq's constructor
		}
		this.triggeredOff = true; // triggeredOff is used when shunting.
	};

	Seq.prototype.setSpeedFactor = function(factor)
	{
		var i, momentsPerTrk = this.momentsPerTrk;
		for(i = 0; i < momentsPerTrk.length; ++i)
		{
			this.trackWorkers[momentsPerTrk[i].workerIndex].postMessage({ action: "setSpeedFactor", factor: factor });
		}
	};

	return API;

}(window));




