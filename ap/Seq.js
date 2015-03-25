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
*       Seq(seqTracks, inputControls, endMarkerMsPosInScore) 
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
	//seq.worker // Each seq uses its own web worker to play its moments. The worker owns the moments.
	//seq.seqMsPosIndex  // The index in allSeqMsPositions of the seq's noteOn position.
	//seq.nextSeqMsPosIndex // The index in allSeqMsPositions of the following seq's noteOn position.
	//seq.triggeredOn	// Is set to true when the seq is triggered On. Default is false.
	//seq.triggeredOff	// Is set to true when the seq is triggered Off. Default is false.
	//seq.inputControls // undefined or from inputChord.inputNotes
	Seq = function(seqTracks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, seqPositionInScore, endMarkerMsPosInScore, seqMessageHandler)
	{
		var moments, worker;

		if(!(this instanceof Seq))
		{
			return new Seq(seqTracks, seqMsPosIndex, nextSeqMsPosIndex, inputControls, seqPositionInScore, endMarkerMsPosInScore);
		}

		console.assert(inputControls !== undefined, "inputControls must be defined here");

		// Returns a one-dimensional array containing a sequence of moments ordered according to their msPositionInSeq attributes.
		// Each moment object has a messages[] attribute and an msPositionInSeq attribute. The msPositionInSeq attributes are unique.
		// The messages array contains midiMessages that are to be sent "synchronously".
		// The midiMessages are *clones* of the midiMessages in the original tracks.
		function getMoments(seqTracks, seqPositionInScore)
		{
			var seqMsDuration, tracksMoments = [], moments = [];

			// returns the msPositionReSeq of the end of the last midiObject in the Seq
			function getSeqMsDuration(seqTracks, seqPositionInScore)
			{
				var i, endOfSeqMsPosReScore = 0, seqMsDuration = 0, nTracks = seqTracks.length,
				lastMidiObject, midiObjects, endOfThisTrack;

				for(i = 0; i < nTracks; ++i)
				{
					midiObjects = seqTracks[i];
					lastMidiObject = midiObjects[midiObjects.length - 1];
					endOfThisTrack = lastMidiObject.msPositionInScore + lastMidiObject.msDurationInScore;
					endOfSeqMsPosReScore = (endOfSeqMsPosReScore > endOfThisTrack) ? endOfSeqMsPosReScore : endOfThisTrack;
				}
				seqMsDuration = endOfSeqMsPosReScore - seqPositionInScore;

				return seqMsDuration;
			}

			// Returns an array containing one array per track.
			// Each contained array contains one track's moments.
			// Each moment has a messages[] attribute -- an array containing midiMessages that are to be sent "synchronously",
			// and an msPositionInSeq attribute.
			// The midiMessages are *clones* of the midiMessages in the original tracks.
			function getTracksMoments(seqTracks, seqPositionInScore)
			{
				var i, j, k, trackMoments, moment, momentClone, trackMidiObjects, midiObject, midiObjectMsPosInSeq,
				tracksMoments = [];

				function messageClones(messages)
				{
					var clones = [], i, newUint8Array;

					for(i = 0; i < messages.length; ++i)
					{
						//// Uint8Arrays don't have a split() function, so this seems the best way to make a clone...
						//uint8Array = messages[i].data;
						//newUint8Array = new Uint8Array(uint8Array.length);
						//for(j = 0; j < uint8Array.length; ++j)
						//{
						//	newUint8Array[j] = uint8Array[j];
						//}
						//clones.push(newUint8Array);

						newUint8Array = new Uint8Array(messages[i].data);
						clones.push(newUint8Array);
					}
					return clones;
				}

				for(i = 0; i < seqTracks.length; ++i)
				{
					trackMoments = [];
					trackMidiObjects = seqTracks[i];
					for(j = 0; j < trackMidiObjects.length; ++j)
					{
						midiObject = trackMidiObjects[j];
						midiObjectMsPosInSeq = midiObject.msPositionInScore - seqPositionInScore;
						for(k = 0; k < midiObject.moments.length; ++k)
						{
							moment = midiObject.moments[k];
							if(moment.messages.length > 0) // midiRests can have empty messages.
							{
								momentClone = {};
								// all moments have an msPositionInChord attribute (even in midiRests)
								momentClone.msPositionInSeq = midiObjectMsPosInSeq + moment.msPositionInChord;
								momentClone.messages = messageClones(moment.messages);
								trackMoments.push(momentClone);
							}
						}
					}
					tracksMoments.push(trackMoments);
				}
				return tracksMoments;
			}

			// Returns the tracksMoments collapsed into a 1-dimensional sequence of moments.
			// Each moment has a unique msPositionInSeq.
			function getFlatMoments(tracksMoments, seqMsDuration)
			{
				var i, j,
				nTracks = tracksMoments.length, trackMomentIndices = [], trackPositions = [], moment,
				moments = [], earliestMsPos = 0, earliestTrackIndex = 0, messages;

				for(i = 0; i < nTracks; ++i)
				{
					trackMomentIndices.push(0);
					trackPositions.push(tracksMoments[i][0].msPositionInSeq);
				}

				while(earliestMsPos < Number.MAX_VALUE)
				{
					earliestMsPos = Number.MAX_VALUE;
					earliestTrackIndex = -1;
					for(i = 0; i < nTracks; ++i)
					{
						if(trackMomentIndices[i] < tracksMoments[i].length && (trackPositions[i] <= earliestMsPos))
						{
							earliestTrackIndex = i;
							earliestMsPos = trackPositions[i];
						}
					}
					if(earliestMsPos < Number.MAX_VALUE)
					{
						moment = tracksMoments[earliestTrackIndex][trackMomentIndices[earliestTrackIndex]];
						moments.push(moment);

						trackMomentIndices[earliestTrackIndex]++;
						if(trackMomentIndices[earliestTrackIndex] < tracksMoments[earliestTrackIndex].length)
						{
							trackPositions[earliestTrackIndex] = tracksMoments[earliestTrackIndex][trackMomentIndices[earliestTrackIndex]].msPositionInSeq;
						}
						else
						{
							trackPositions[earliestTrackIndex] = Number.MAX_VALUE;
						}
					}
				}

				return moments;
			}

			seqMsDuration = getSeqMsDuration(seqTracks, seqPositionInScore);
			tracksMoments = getTracksMoments(seqTracks, seqPositionInScore);
			moments = getFlatMoments(tracksMoments, seqMsDuration);

			return moments;
		}

		moments = getMoments(seqTracks, seqPositionInScore);

		worker = new window.Worker("ap/SeqWorker.js");
		worker.onmessage = seqMessageHandler;
		worker.postMessage({ action: "init", moments: moments, inputControls: inputControls });

		Object.defineProperty(this, "worker", { value: worker, writable: false });
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

	Seq.prototype.play = function()
	{
		this.worker.postMessage({ action: "play" }); // plays according to the inputControls set in the seq's constructor
		this.triggeredOn = true; // triggeredOn is used when shunting.
	};

	Seq.prototype.stop = function()
	{
		this.worker.postMessage({ action: "stop" }); // stops according to the inputControls set in the seq's constructor
		this.triggeredOff = true; // triggeredOff is used when shunting.
	};

	Seq.prototype.setSpeedFactor = function(factor)
	{
		this.worker.postMessage({ action: "setSpeedFactor", factor: factor });
	};

	return API;

}(window));




