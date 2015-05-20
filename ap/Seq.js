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
*        Seq(seqPositionInScore, inputChordIndices, seqTrks, inputControls)
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
	// Used publicly at runtime: 
	//   seq.chordIndex -- The index in allSeqMsPositions of the seq's noteOn position.
	//   seq.nextChordIndex -- The index in allSeqMsPositions of the following chord in any inputTrack.
	//   seq.triggeredOn   -- Is set to true when the seq is triggered On. Default is false.
	//   seq.triggeredOff  -- Is set to true when the seq is triggered Off. Default is false.
	// Used privately (by the prototype functions) at runtime: 
	//   seq.trackWorkers -- The array of all the trackWorkers, one per output track in the score.
	//   seq.workersPerTrk -- An array containing the trackIndex (in the trackWorkers array) of each trackWorker in the Seq.
	Seq = function(seqPositionInScore, chordIndex, nextChordIndex, seqTrks, inputControls, trackWorkers)
	{
		var trkData;

		if(!(this instanceof Seq))
		{
			return new Seq(seqPositionInScore, chordIndex, nextChordIndex, seqTrks, inputControls, trackWorkers);
		}

		console.assert(chordIndex !== undefined, "chordIndex must be defined.");
		console.assert(nextChordIndex !== undefined, "nextChordIndex must be defined.");
		console.assert(inputControls !== undefined, "inputControls must be defined.");

		// Returns an object having the following attributes:
		//   momentsPerTrk: an array containing one array per Trk in the Seq.
		//		Each contained array contains the trk's moments.
		//		Each moment has a messages[] attribute -- an array containing midiMessages that are to be sent "synchronously",
		//		and an msPositionInSeq attribute.
		//   workersPerTrk: an array containing the trackIndex of each trackWorker (per Trk).
		//   inputControlsPerTrk: null or an inputControls object (per Trk).
		function getTrkData(seqTrks, seqPositionInScore)
		{
			var i, j, k, trkMoments, moment, trkMoment, trkMidiObjects, midiObject, midiObjectMsPosInSeq,
			momsPerTrk = [], wkrsPerTrack = [], inputCtrlsPerTrk = [];

			for(i = 0; i < seqTrks.length; ++i)
			{
				trkMidiObjects = seqTrks[i];
				trkMoments = [];
				for(j = 0; j < trkMidiObjects.length; ++j)
				{
					midiObject = trkMidiObjects[j];
					midiObjectMsPosInSeq = midiObject.msPositionInScore - seqPositionInScore;
					for(k = 0; k < midiObject.moments.length; ++k)
					{
						moment = midiObject.moments[k];
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
				if(trkMidiObjects.inputControls !== undefined)
				{
					inputCtrlsPerTrk.push(trkMidiObjects.inputControls);
				}
				else
				{
					inputCtrlsPerTrk.push(null);
				}
				momsPerTrk.push(trkMoments);
				wkrsPerTrack.push(trkMidiObjects.trackIndex);
			}
			return { momentsPerTrk: momsPerTrk, workersPerTrk: wkrsPerTrack, inputControlsPerTrk: inputCtrlsPerTrk };
		}

		// Seqs are being created in chronological order, so can push the seq's trks into the trackWorkers.
		function setWorkers(trackWorkers, trkData, inputControls)
		{
			var i, workerIndex, momsPerTrk,
			momentsPerTrk = trkData.momentsPerTrk,
			workersPerTrk = trkData.workersPerTrk,
			inputControlsPerTrk = trkData.inputControlsPerTrk,
			minimumInputControls;

			// Returns a new object having the same function as the argument,
			// but with the minimum number of defined attributes.
			// If any attribute is undefined or off in the argument,
			// that attribute will be undefined in the returned object.
			function getMinimumInputControls(inputControls)
			{
				var robj = {};

				if(inputControls.noteOnVel !== undefined && inputControls.noteOnVel !== "off")
				{
					robj.noteOnVel = inputControls.noteOnVel;
					robj.minVelocity = inputControls.minVelocity;
				}
				if(inputControls.noteOff !== undefined && inputControls.noteOff !== "off")
				{
					robj.noteOff = inputControls.noteOff;
				}
				if(inputControls.pressure !== undefined && inputControls.pressure !== "off")
				{
					robj.pressure = inputControls.pressure;
				}
				if(inputControls.pitchWheel !== undefined && inputControls.pitchWheel !== "off")
				{
					robj.pitchWheel = inputControls.pitchWheel;
				}
				if(inputControls.modulation !== undefined && inputControls.modulation !== "off")
				{
					robj.modulation = inputControls.modulation;
				}
				if(inputControls.maxVolume !== undefined)
				{
					robj.maxVolume = inputControls.maxVolume;
				}
				if(inputControls.minVolume !== undefined)
				{
					robj.minVolume = inputControls.minVolume;
				}
				if(inputControls.speedOption !== undefined && inputControls.speedOption !== "off")
				{
					robj.speedOption = inputControls.speedOption;
					robj.maxSpeedPercent = inputControls.maxSpeedPercent;
				}

				return robj;
			};

			for(i = 0; i < momentsPerTrk.length; ++i)
			{
				workerIndex = workersPerTrk[i];
				momsPerTrk = momentsPerTrk[i];
				if(inputControlsPerTrk[i] !== null)
				{
					inputControls = inputControlsPerTrk[i].getCascadeOver(inputControls);
				}
				minimumInputControls = getMinimumInputControls(inputControls);
				trackWorkers[workerIndex].hasCompleted = false;
				trackWorkers[workerIndex].postMessage({ action: "pushTrk", moments: momsPerTrk, inputControls: minimumInputControls });
			}
			trkData.momentsPerTrk = undefined; // can be garbage collected
		}

		trkData = getTrkData(seqTrks, seqPositionInScore);

		setWorkers(trackWorkers, trkData, inputControls);

		Object.defineProperty(this, "chordIndex", { value: chordIndex, writable: false });
		Object.defineProperty(this, "nextChordIndex", { value: nextChordIndex, writable: false });
		Object.defineProperty(this, "trackWorkers", { value: trackWorkers, writable: false });
		Object.defineProperty(this, "workersPerTrk", { value: trkData.workersPerTrk, writable: false });

		Object.defineProperty(this, "triggeredOn", { value: false, writable: true });
		Object.defineProperty(this, "triggeredOff", { value: false, writable: true });
	},

	API =
	{
		Seq: Seq // constructor
	};
	// end var

	// Called when a noteOn is sent and this is the current Seq.
	Seq.prototype.doNoteOn = function(performedVelocity)
	{
		var trackWorkers = this.trackWorkers,
			workersPerTrk = this.workersPerTrk;

		function postStopImmediately(trackWorkers, workersPerTrk)
		{
			var i;
			for(i = 0; i < workersPerTrk.length; ++i)
			{
				trackWorkers[workersPerTrk[i]].postMessage({ action: "stopImmediately" });
			}
		}

		function postPlay(trackWorkers, workersPerTrk, performedVelocity)
		{
			var i;
			for(i = 0; i < workersPerTrk.length; ++i)
			{
				trackWorkers[workersPerTrk[i]].postMessage({ action: "doNoteOn", velocity: performedVelocity }); // plays according to the inputControls set in the seq's constructor
			}
		}

		postStopImmediately(trackWorkers, workersPerTrk);

		// Maybe call
		//    setTimeout(postPlay(trackWorkers, workersPerTrk), 2);
		// to give the worker more time to stop.
		// (trackWorkers throw exceptions if they are busy when this function is called.)
		postPlay(trackWorkers, workersPerTrk, performedVelocity);

		this.triggeredOn = true; // triggeredOn is used when shunting.
	};

	// Called when a noteOff is sent while the Seq is playing.
	Seq.prototype.doNoteOff = function()
	{
		var i, workersPerTrk = this.workersPerTrk;

		for(i = 0; i < workersPerTrk.length; ++i)
		{
			this.trackWorkers[workersPerTrk[i]].postMessage({ action: "doNoteOff" }); // stops according to the inputControls set in the seq's constructor
		}
		this.triggeredOff = true; // triggeredOff is used when shunting.
	};

	Seq.prototype.setSpeedFactor = function(factor)
	{
		var i, workersPerTrk = this.workersPerTrk;

		for(i = 0; i < workersPerTrk.length; ++i)
		{
			this.trackWorkers[workersPerTrk[i]].postMessage({ action: "setSpeedFactor", factor: factor });
		}
	};

	return API;

}(window));




