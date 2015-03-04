/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Keyboard1.js
*  The _AP.keyboard1 namespace which defines
*
*	// Initialize Keyboard1
*	// Arguments:
*	// inputDevice: The midi input device.
*	// outputdevice: The midi output device.
*	// reportEndOfPerfCallback: a callback function which is called when performing sequence
*	//		reaches the endMarkerMsPosition (see play(), or stop() is called. Can be undefined or null.
*	//		It is called in this file as:
*	//			reportEndOfPerformance(sequenceRecording, performanceMsDuration);
*	// reportMsPosCallback: a callback function which reports the current msPositionInScore
*	//		back to the GUI while performing. Can be undefined or null.
*	//		It is called here as:
*	//			reportMsPositionInScore(msPositionToReport);
*	//		The msPosition it passes back is the original number of milliseconds from the start of
*	//		the score (taking the global speed option into account). This value is used to identify
*	//		chord and rest symbols in the score, and so to synchronize the running cursor.
*	init = function(inputDevice, outputDevice, reportEndOfPerfCallback, reportMsPosCallback)
* 
*	// Start playing (part of) the Sequence.
*	// Arguments:
*	// trackIsOnArrayArg an array containing a boolean per track, determining whether it will
*	//	   be played or not. This array is read only.
*	// startMarkerMsPosition, endMarkerMsPosition: the part of the sequence to play 
*	//	  (not including endMarkerMsPosition)
*	// [optional] recording: a sequence in which the performed messages will be recorded.
*	play(trackIsOnArrayArg, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
*	
*	// pause a running performance
*	pause(),
*	
*	// resume a paused performance
*	resume()
*	
*	// stop a running performance
*	stop()
*	
*	// Is the performance stopped?
*	isStopped()
*	
*	// Is the performance paused?
*	isPaused()
*	
*	// Is the performance running?
*	isRunning()
*
*	// Sends the controller message to the given track immediately.
*	sendControlMessageNow(outputDevice, track, controller, midiValue)
*
*	/// Sets the track's pitchWheel deviation to value
*	sendSetPitchWheelDeviationMessageNow(outputDevice, track, value)
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.keyboard1');

_AP.keyboard1 = (function()
{
	"use strict";

	var
	// set or called in init(...)
	midiInputDevice,
	midiOutputDevice,
	inputControls, // the running controls, initialized in initPlay() and updated while performing.
	currentMsPosIndex, // initialized to 0 when playing starts. Is the index in the following array.
	msPosObjs,
	keyData,
	keyRange, // keyRange.bottomKey and keyRange.topKey are the bottom and top midi key values that can be used by the score.
	reportEndOfPerformance, // callback -- called here as reportEndOfPerformance(sequenceRecording, performanceMsDuration);
	reportMsPositionInScore, // callback -- called here as reportMsPositionInScore(msPositionToReport);

	endMarkerMsPosition,

	// (performance.now() - performanceStartTime) is the real time elapsed since the start of the performance.
	performanceStartTime = -1,  // set in play(), used by stop(), run()
	// (performance.now() - startTimeAdjustedForPauses) is the current performance duration excluding the durations of pauses.
	startTimeAdjustedForPauses = -1, // performanceStartTime minus the durations of pauses. Used in nextMoment()
	pauseStartTime = -1, // the performance.now() time at which the performance was paused.

	// used by setState()
	pausedMoment = null, // set by pause(), used by resume()
	stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
	paused = false, // nextMoment(), pause(), isPaused()
	previousTimestamp = null, // nextMoment()
	previousMomtMsPosInScore = 0, // nextMoment()
	currentMoment = null, // nextMoment(), resume(), tick()
	reportEndOfSpan, // callback. Can be null or undefined. Set in play().

	speedFactor = 1.0, // nextMoment(), setSpeedFactor() in handleMIDIInputEvent()
	//maxDeviation, // for //console.log, set to 0 when performance starts

	lastReportedMsPosition = -1, // set by tick() used by nextMoment()
	msPositionToReport = -1,   // set in nextMoment() and used/reset by tick()
	previousMomtMsPos,

	sequenceRecording, // the sequence being recorded. set in play() and resume(), used by tick()

	// TODO: complete resume()
	// Public function. Should only be called when this sequence is paused (and pausedMoment is set correctly).
	// The sequence pauses if nextMoment() sets currentMoment to null while tick() is waiting for setTimeout().
	// So the messages in pausedMoment (set to the last non-null currentMoment) have already been sent.
	resume = function()
	{
		//var
		//pauseMsDuration = performance.now() - pauseStartTime;

		//if(isPaused())
		//{
		//	currentMoment = pausedMoment; // the last moment whose messages were sent.

		//	setState("running"); // sets pausedMoment to null.

		//	currentMoment.timestamp += pauseMsDuration;
		//	previousTimestamp += pauseMsDuration;
		//	startTimeAdjustedForPauses += pauseMsDuration;

		//	currentMoment = nextMoment();
		//	if(currentMoment === null)
		//	{
		//		return;
		//	}
		//	currentMoment.timestamp = performance.now();
		//	tick();
		//}
		//else
		//{
		//	throw "Error: resume() should only be called when this sequence is paused.";
		//}
	},

	sendCommandMessageNow = function(outputDevice, trackIndex, command, midiValue)
	{
		var
		msg;

		msg = new _AP.message.Message(command + trackIndex, 0, midiValue); // controller 7 is volume control
		outputDevice.send(msg.data, 0);
	},

	sendControlMessageNow = function(outputDevice, trackIndex, controller, midiValue)
	{
		var
		msg,
		CMD = _AP.constants.COMMAND;

		msg = new _AP.message.Message(CMD.CONTROL_CHANGE + trackIndex, controller, midiValue); // controller 7 is volume control
		outputDevice.send(msg.data, 0);
	},

	// Sets the track's pitchWheel deviation to value, and the pitchWheel to 64 (=centre position).
	// Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
	// pitch wheel so that it can be set by the subsequent DataEntry messages.
	// A DataEntryFine message is not set, because it is not needed and has no effect anyway.
	// However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
	sendSetPitchWheelDeviationMessageNow = function(outputDevice, track, value)
	{
		var
		msg,
		Message = _AP.message.Message,
		CMD = _AP.constants.COMMAND,
		CTL = _AP.constants.CONTROL;

		msg = new Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_COARSE, 0);
		outputDevice.send(msg.data, 0);
		msg = new Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_FINE, 0);
		outputDevice.send(msg.data, 0);
		msg = new Message(CMD.CONTROL_CHANGE + track, CTL.DATA_ENTRY_COARSE, value);
		outputDevice.send(msg.data, 0);

		msg = new Message(CMD.PITCH_WHEEL + track, 0, 64); // centre the pitch wheel
		outputDevice.send(msg.data, 0);
	},

	// TODO: complete handleMIDIInputEvent(msg)
	// see _PreparedSynthAlgorithm.txt
	handleMIDIInputEvent = function(msg)
	{

	},

	setState = function(state)
	{
		switch(state)
		{
			case "stopped":
				stopped = true;
				paused = false;
				pausedMoment = null;
				previousTimestamp = null;
				previousMomtMsPosInScore = 0;
				midiInputDevice.removeEventListener("midimessage", handleMIDIInputEvent);
				break;
			case "paused":
				stopped = false;
				paused = true;
				pausedMoment = currentMoment;
				midiInputDevice.removeEventListener("midimessage", handleMIDIInputEvent);
				break;
			case "running":
				stopped = false;
				paused = false;
				pausedMoment = null;
				midiInputDevice.addEventListener("midimessage", handleMIDIInputEvent);
				break;
			default:
				throw "Unknown sequence state!";
		}
	},

	isStopped = function()
	{
		return (stopped === true && paused === false);
	},

	isPaused = function()
	{
		return (stopped === false && paused === true);
	},

	isRunning = function()
	{
		return (stopped === false && paused === false);
	},

	// Should only be called while running
	pause = function()
	{
		if(isRunning())
		{
			setState("paused");
			pauseStartTime = performance.now();
		}
		else
		{
			throw "Attempt to pause a stopped or paused sequence.";
		}
	},

	// does nothing if the sequence is already stopped
	stop = function()
	{
		var performanceMsDuration;

		if(!isStopped())
		{
			performanceMsDuration = Math.ceil(performance.now() - performanceStartTime);
			currentMoment = null;
			setState("stopped");
			if(reportEndOfSpan !== undefined && reportEndOfSpan !== null)
			{
				reportEndOfSpan(sequenceRecording, performanceMsDuration);
			}
		}
	},

	// The reportEndOfPerfCallback argument is a callback function which is called when performing sequence
	// reaches the endMarkerMsPosition (see play(), or stop() is called. Can be undefined or null.
	// It is called in this file as:
	//	  reportEndOfPerformance(sequenceRecording, performanceMsDuration);
	// The reportMsPosCallback argument is a callback function which reports the current msPositionInScore back
	// to the GUI while performing. Can be undefined or null.
	// It is called here as:
	//	  reportMsPositionInScore(msPositionToReport);
	// The msPosition it passes back is the original number of milliseconds from the start of
	// the score (taking the global speed option into account). This value is used to identify
	// chord and rest symbols in the score, and so to synchronize the running cursor.
	// Moments whose msPositionInScore is to be reported are given chordStart or restStart
	// attributes before play() is called.
	init = function(inputDevice, outputDevice, inputKeyRange, reportEndOfPerfCallback, reportMsPosCallback)
	{
		console.assert((inputDevice !== undefined && inputDevice !== null), "The midi input device must be defined.");
		console.assert((outputDevice !== undefined && outputDevice !== null), "The midi output device must be defined.");
		console.assert(!(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
						|| reportMsPosCallback === undefined || reportMsPosCallback === null),
						"Error: both the position reporting callbacks must be defined.");
		console.assert((inputKeyRange !== undefined && inputKeyRange !== null), "The inputKeyRange must be defined.");

		midiInputDevice = inputDevice;
		midiOutputDevice = outputDevice;
		keyRange = inputKeyRange; // these are the bottom and top midi key values that can be used by the score.
		reportEndOfPerformance = reportEndOfPerfCallback;
		reportMsPositionInScore = reportMsPosCallback;

		setState("stopped");
	},

	// play()
	//
	// trackIsOnArray[trackIndex] returns a boolean which determines whether each output or input
	// track will be played or not. This array is read only.
	// recording is a Sequence to which timestamped moments are added as they are performed.
	// It should be an empty Sequence having the same number of output tracks as the score.
	play = function(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
	{
		function initPlay(that, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
		{
			var
			nOutputTracks = that.outputTracks.length,
			nTracks = nOutputTracks + that.inputTracks.length;

			// Returns the inputControls current when the span starts.
			// (Shunts in all playing inputTracks from the start of the score.)
			// This "global" inputControls always has a complete set of attributes.
			function getCurrentInputControls(inputTracks, trackIsOnArray, nOutputTracks, nTracks, startMarkerMsPosInScore)
			{
				var returnInputControlsObj = {}, currentTrackInputControlsObj,
				i, inputTrackIndex = 0, inputTrack;

				// returns null or an object having msPositionInScore and inputControls attributes
				// The inputControls will contain a complete set of attributes.
				function getCurrentTrackInputControlsObj(inputObjects, startMarkerMsPosInScore)
				{
					var i, nInputObjects = inputObjects.length, inputObject, returnInputControlsObj = null;

					for(i = 0; i < nInputObjects; ++i)
					{
						inputObject = inputObjects[i];
						if(inputObject.msPositionInScore >= startMarkerMsPosInScore)
						{
							break;
						}
						if(inputObject.inputControls !== undefined)
						{
							returnInputControlsObj = {};
							returnInputControlsObj.msPositionInScore = inputObject.msPositionInScore;
							returnInputControlsObj.inputControls = inputObject.inputControls.getCascadeOver(new _AP.inputControls.InputControls());
						}
					}
					return returnInputControlsObj;
				}

				returnInputControlsObj.msPositionInScore = 0;
				returnInputControlsObj.inputControls = new _AP.inputControls.InputControls();
				
				for(i = nOutputTracks; i < nTracks; ++i)
				{
					inputTrack = inputTracks[inputTrackIndex++];

					if(trackIsOnArray[i])
					{
						currentTrackInputControlsObj = getCurrentTrackInputControlsObj(inputTrack.inputObjects, startMarkerMsPosInScore);
						if(currentTrackInputControlsObj !== null)
						{
							console.assert(!(returnInputControlsObj.msPositionInScore > 0
								&& (returnInputControlsObj.msPositionInScore === currentTrackInputControlsObj.msPositionInScore)),
								"Error. Synchronous inputControl objects are not allowed.");

							if(currentTrackInputControlsObj.msPositionInScore === 0
							|| currentTrackInputControlsObj.msPositionInScore > returnInputControlsObj.msPositionInScore)
							{
								returnInputControlsObj = currentTrackInputControlsObj;
							}	
						}
					}
				}

				return returnInputControlsObj.inputControls;
			}

			// Returns an array of msPosObj, from startMarkerMsPositionInScore to (not including) endMarkerMsPositionInScore,
			// ordered by msPosObj.msPositionInScore. The "span" is the section of the score in this msPosition range.
			// This array includes the positions of all inputChords and inputRests in the span, but not if their track has been turned off.
			// It does not include the positions of outputChords and outputRests.
			function getMsPosObjs(inputTracks, trackIsOnArray, nOutputTracks, nTracks, startMarkerMsPosInScore, endMarkerMsPosInScore)
			{
				var i, inputTrackIndex = 0, inputTrack, msPosObjs = [];

				// the inputTrack is performing
				function addTrackSpanToMsPosObjs(inputTrack, msPosObjs, startMarkerMsPosInScore, endMarkerMsPosInScore)
				{
					var trackSpanMsPosObjsArray;

					function getTrackSpanMsPosObjsArray(inputObjects, startMarkerMsPosInScore, endMarkerMsPosInScore)
					{
						var i, nInputObjects = inputObjects.length, inputObject, msPosObj, trackSpanMsPosObjsArray = [];

						for(i = 0; i < nInputObjects; ++i)
						{
							inputObject = inputObjects[i]; // an inputChord or inputRest
							if(inputObject.msPositionInScore >= endMarkerMsPosInScore)
							{
								break;
							}
							if(inputObject.msPositionInScore >= startMarkerMsPosInScore)
							{
								//	msPosObj has the following fields:
								//	msPosObj.msPositionInScore // used when updating the runningMarker position.
								//	msPosObj.inputControls // undefined or from an inputChord
								msPosObj = {};
								msPosObj.msPositionInScore = inputObject.msPositionInScore;
								if(inputObject.inputControls !== undefined)
								{
									msPosObj.inputControls = inputObject.inputControls;
								}
								trackSpanMsPosObjsArray.push(msPosObj);
							}
						}
						return trackSpanMsPosObjsArray;
					}

					// Returns the result of merging newArray into oldArray.
					// The merged array has one object per msPositionInScore, ordered according to msPositionInScore.
					// It is an error for more than one synchronous inputChord to have inputControls attribute!
					function getMergedArrays(newArray, oldArray)
					{
						var mergedArray = [], indexNew, indexOld = 0, obj, newObj;

						if(oldArray.length === 0)
						{
							mergedArray = newArray;
						}
						else
						{
							for(indexNew = 0; indexNew < newArray.length; ++indexNew)
							{
								console.assert(false, "This block of code has not been tested!");

								newObj = newArray[indexNew];
								while((newObj.msPositionInScore > oldArray[indexOld].msPositionInScore)
									 && indexOld < oldArray.length)
								{
									mergedArray.push(oldArray[indexOld++]);
								}

								if(indexOld === oldArray.length || newObj.msPositionInScore < oldArray[indexOld].msPositionInScore)
								{
									mergedArray.push(newObj);
								}
								else if(newObj.msPositionInScore === oldArray[indexOld].msPositionInScore)
								{
									obj = oldArray[indexOld++];

									console.assert(!(obj.inputControls !== undefined && newObj.inputControls !== undefined),
										"It is an error for two synchronous inputChords to have an inputControls attribute!");

									if(newObj.inputControls !== undefined)
									{
										obj.inputControls = newObj.inputControls;
									}

									mergedArray.push(obj);
								}
							}
						}
						return mergedArray;
					}

					trackSpanMsPosObjsArray = getTrackSpanMsPosObjsArray(inputTrack.inputObjects, startMarkerMsPosInScore, endMarkerMsPosInScore);
					msPosObjs = getMergedArrays(trackSpanMsPosObjsArray, msPosObjs);

					return msPosObjs;
				}

				for(i = nOutputTracks; i < nTracks; ++i)
				{
					inputTrack = inputTracks[inputTrackIndex++];
					// inputTrack.isPerforming = false;

					if(trackIsOnArray[i])
					{
						// inputTrack.isPerforming = true;
						inputTrack.setForInputSpan(startMarkerMsPosInScore, endMarkerMsPosInScore);
						msPosObjs = addTrackSpanToMsPosObjs(inputTrack, msPosObjs, startMarkerMsPosInScore, endMarkerMsPosInScore);
					}
				}
				return msPosObjs;
			}			
			
			function getKeyData(inputTracks, outputTracks, trackIsOnArray, msPosObjs, endMarkerMsPosInScore)
			{
				var keyData = [], keySeqs = [], midiKey,
					bottomKey = keyRange.bottomKey, topKey = keyRange.topKey; // keyRange was been set in keyboard1.init().

				// TODO: complete getKeySeqs(...)
				function getKeySeqs(midiKey, inputTracks, outputTracks, trackIsOnArray, msPosObjs, endMarkerMsPosInScore)
				{
					//keySeqs is an object having the following fields:
					//keySeqs.index	// Initialized to 0. The current index in the keySeqs array attributes (below).	
					//keySeqs.seqs[]	An array of seq -- initialized from the span (see below).
					//					This array is ordered by msPositionInScore.
					//					There is a seq for each inputNote having this midiKey, unless the seq's inputTrack has been turned off, or
					//					all its outputTracks have been turned off. In either case, the seq is simply not created. 
					//keySeqs.onIndices[]  // The index in msPosObjs of each seq's noteOn position.
					//keySeqs.offIndices[] // The index in msPosObjs of each seq's noteOff position.
					//keySeqs.triggeredOns[]	// An array of booleans. One value per seq.
					//							// Each value is initialised to false, but set to true when the inputNote's (seq's) noteOn is used (accepted).
					//keySeqs.triggeredOffs[]	// An array of booleans. One value per inputNote (seq) played by the key.
					//							// Each value is initialised to false, but set to true when the inputNote's (seq's) noteOff is used (accepted).

					//seq is an object having the following fields:
					//seq.trks[]	// An array of parallel trk - initialized from inputChord.inputNotes in the span (excluding non-playing outputTracks).
					//				// This array is never empty. If it would be empty (because tracks have been turned off), the seq is not created.
					//				// The outputChords and outputRests in each trk are also in range of the span (they do not continue beyond endMarkerMsPosition).
					//seq.inputControls // undefined or from inputChord.inputNotes
					var keySeqs = [];

					// etc...

					return keySeqs;
					/* end of getKeySeqs(...) */
				}
				
				for(midiKey = bottomKey; midiKey <= topKey; ++midiKey)
				{
					keySeqs = getKeySeqs(midiKey, inputTracks, outputTracks, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);
					keyData.push(keySeqs);
				}
				return keyData;
			}
			
			/*** begin initPlay() ***/

			// keyboard1.inputControls. This "global" inputControls always has a complete set of attributes.
			inputControls = getCurrentInputControls(that.inputTracks, trackIsOnArray, nOutputTracks, nTracks, startMarkerMsPosInScore);

			// keyboard1.currentMsPosIndex
			currentMsPosIndex = 0; // the index in the following array

			// keyboard1.msPosObjs. The msPositionsInScore (and inputControls, if defined) of all inputChords and inputRests in the span. 
			msPosObjs = getMsPosObjs(that.inputTracks, trackIsOnArray, nOutputTracks, nTracks, startMarkerMsPosInScore, endMarkerMsPosInScore);

			console.assert(msPosObjs[0].msPositionInScore === startMarkerMsPosInScore);

			// keyboard1.keyData
			keyData = getKeyData(that.inputTracks, that.outputTracks, trackIsOnArray, msPosObjs, endMarkerMsPosInScore);
		}

		sequenceRecording = recording;

		endMarkerMsPosition = endMarkerMsPosInScore;
		startTimeAdjustedForPauses = performanceStartTime;

		initPlay(this, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);

		pausedMoment = null;
		pauseStartTime = -1;
		previousTimestamp = null;
		previousMomtMsPos = startMarkerMsPosInScore;
		msPositionToReport = -1;
		lastReportedMsPosition = -1;

		performanceStartTime = performance.now();
		setState("running");
	},

	publicAPI =
	{
		init: init,

		play: play,
		pause: pause,
		resume: resume,
		stop: stop,
		isStopped: isStopped,
		isPaused: isPaused,
		isRunning: isRunning,

		sendCommandMessageNow: sendCommandMessageNow,
		sendControlMessageNow: sendControlMessageNow,
		sendSetPitchWheelDeviationMessageNow: sendSetPitchWheelDeviationMessageNow,

		handleMIDIInputEvent: handleMIDIInputEvent
	};
	// end var

	return publicAPI;

}());
