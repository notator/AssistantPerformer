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
*        Seq(seqPositionInScore, inputChordIndices, seqTrks, trkOptions)
*
* Functions (in prototype): 
*
* 
*        // Called when a noteOn or noteOff starts this Seq.
*        // noteOff calls this function with no argument (undefined performedVelocity)      
*        start(performedVelocity)
* 
*        // Called when a noteOn or noteOff stops this Seq.
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
	// A seq is an array of parallel trks. Each trk is a section of a track in the score.
	// Each Seq has the following attributes:
	// Used publicly at runtime: 
	//   seq.chordIndex -- The index in allSeqMsPositions of the seq's noteOn position.
	//   seq.nextChordIndex -- The index in allSeqMsPositions of the following chord in any inputTrack.
	//   seq.trks -- An array of trk.
	//   seq.triggeredOn   -- Is set to true when the seq is triggered On. Default is false.
	//   seq.triggeredOff  -- Is set to true when the seq is triggered Off. Default is false.
	Seq = function(seqPositionInScore, chordIndex, nextChordIndex, seqTrks, trackWorkers)
	{
		var workers;

		if(!(this instanceof Seq))
		{
			return new Seq(seqPositionInScore, chordIndex, nextChordIndex, seqTrks, trackWorkers);
		}

		console.assert(chordIndex !== undefined, "chordIndex must be defined.");
		console.assert(nextChordIndex !== undefined, "nextChordIndex must be defined.");

		// Pushes trks into their respective worker's trk array and returns an array of worker.
		// The track parameters pushed are:
		//  msPosition
		//	moments // an array of moment. Each moment has a messages[] attribute and an msPositionInSeq attribute.
		//  trkOptions
		function setAndGetWorkers(seqTrks, seqPositionInScore, trackWorkers)
		{
			var i, nSeqTrks = seqTrks.length, trkDef, trkMsPos, trkMoments, trkOptions, trkWorker, workers = [];

			function getMoments(trkMidiObjects)
			{
				var i, j, nTrkMidiObjects, trkMoments, moment, trkMoment, midiObject, midiObjectMsPosInSeq;

				nTrkMidiObjects = trkMidiObjects.length;
				trkMoments = [];
				for(i = 0; i < nTrkMidiObjects; ++i)
				{
					midiObject = trkMidiObjects[i];
					midiObjectMsPosInSeq = midiObject.msPositionInScore - seqPositionInScore;
					for(j = 0; j < midiObject.moments.length; ++j)
					{
						moment = midiObject.moments[j];
						// midiRests have a single moment, but its messages array can be empty.
						if(moment.messages.length > 0)
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
				return trkMoments;
			}

			for(i = 0; i < nSeqTrks; ++i)
			{
				trkDef = seqTrks[i]; 

				trkMsPos = seqPositionInScore + trkDef.msOffset;
				trkMoments = getMoments(trkDef.midiObjects);
				trkOptions = trkDef.trkOptions;

				trkWorker = trackWorkers[trkDef.trackIndex];

				trkWorker.postMessage({ action: "pushTrk", msPosition: trkMsPos, moments: trkMoments, trkOptions: trkOptions });

				workers.push(trkWorker);
			}
			return workers;
		}

		workers = setAndGetWorkers(seqTrks, seqPositionInScore, trackWorkers);

		Object.defineProperty(this, "chordIndex", { value: chordIndex, writable: false });
		Object.defineProperty(this, "nextChordIndex", { value: nextChordIndex, writable: false });
		Object.defineProperty(this, "workers", { value: workers, writable: false });
		Object.defineProperty(this, "triggeredOn", { value: false, writable: true });
		Object.defineProperty(this, "triggeredOff", { value: false, writable: true });
	},

	API =
	{
		Seq: Seq // constructor
	};
	// end var

	// Called when a noteOn or noteOff starts this Seq.
	// noteOff calls this function with no argument (undefined performedVelocity)
	Seq.prototype.start = function(performedVelocity)
	{
		var i, worker, nWorkers = this.workers.length;

		for(i = 0; i < nWorkers; ++i)
		{
			worker = this.workers[i];
			worker.postMessage({ action: "stopImmediately" });
			// Maybe call
			//    setTimeout(...), 2);
			// to give the worker more time to stop.
			// (trackWorkers throw exceptions if they are busy when the following function is called.)
			worker.postMessage({ action: "start", velocity: performedVelocity }); // plays according to the trkOptions set in the seq's constructor

			this.triggeredOn = true; // triggeredOn is used when shunting.
		}
	};

	// Called when a noteOn or noteOff stops this seq.
	Seq.prototype.stop = function()
	{
		var i, worker, nWorkers = this.workers.length;

		for(i = 0; i < nWorkers; ++i)
		{
			worker = this.workers[i];
			worker.postMessage({ action: "stop" }); // stops according to the trkOptions set in the seq's constructor
		}

		this.triggeredOff = true; // triggeredOff is used when shunting.
	};

	Seq.prototype.setSpeedFactor = function(factor)
	{
		var i, worker, nWorkers = this.workers.length;

		for(i = 0; i < nWorkers; ++i)
		{
			worker = this.workers[i];
			worker.postMessage({ action: "setSpeedFactor", factor: factor });
		}
	};

	return API;

}(window));




