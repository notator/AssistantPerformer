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
*	 // initialize the data structure to be played
*    // init(sequence, options, reportEndOfPerformance, reportMsPos),
*    //
*    // Start playing (part of) the Sequence.
*    // Arguments:
*    // options: the options set in Controls.js
*    // startMarkerMsPosition, endMarkerMsPosition: the part of the sequence to play 
*    //      (not including endMarkerMsPosition)
*    // trackIsOnArray[trackIndex] returns a boolean which determines whether the track will
*    //       be played or not. This array is read only.
*    // [optional] recording: a sequence in which the performed messages will be recorded.
*    // [optional] reportEndOfSpanCallback: called when the performance ends.
*    // [optional] reportMsPositionInScoreCallback: called whenever a cursor needs to be updated
*    //       in the score.
*    play(options, startMarkerMsPosition, endMarkerMsPosition, trackIsOnArray,
*                           recording, reportEndOfSpanCallback, reportMsPositionInScoreCallback)
*    
*    // pause a running performance
*    pause(),
*    
*    // resume a paused performance
*    resume()
*    
*    // stop a running performance
*    stop()
*    
*    // Is the performance stopped?
*    isStopped()
*    
*    // Is the performance paused?
*    isPaused()
*    
*    // Is the performance running?
*    isRunning()
*
*    // Sends the controller message to the given track immediately.
*    sendControlMessageNow(outputDevice, track, controller, midiValue)
*
*    /// Sets the track's pitchWheel deviation to value
*    sendSetPitchWheelDeviationMessageNow(outputDevice, track, value)
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  performance: false, console: false */


/*************************************************************************************************
*
* ACHTUNG: This file is just a placeholder. Adapt the other files they are working.
*
**************************************************************************************************/

_AP.namespace('_AP.keyboard1');

_AP.keyboard1 = (function()
{
    "use strict";

	var
	// set or called in init(...)
	inputTracks,
	outputTracks,
	trackIsOnArray,
	midiInputDevice,
    midiOutputDevice,
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

    midiObjectMsPositionsInScoreIndex = 0, // the current index in the following array
    midiObjectMsPositionsInScore = [], // a flat, ordered array of msPositions

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
    	//    currentMoment = pausedMoment; // the last moment whose messages were sent.

    	//    setState("running"); // sets pausedMoment to null.

    	//    currentMoment.timestamp += pauseMsDuration;
    	//    previousTimestamp += pauseMsDuration;
    	//    startTimeAdjustedForPauses += pauseMsDuration;

    	//    currentMoment = nextMoment();
    	//    if(currentMoment === null)
    	//    {
    	//        return;
    	//    }
    	//    currentMoment.timestamp = performance.now();
    	//    tick();
    	//}
    	//else
    	//{
    	//    throw "Error: resume() should only be called when this sequence is paused.";
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
    //      reportEndOfPerformance(sequenceRecording, performanceMsDuration);
    // The reportMsPosCallback argument is a callback function which reports the current msPositionInScore back
    // to the GUI while performing. Can be undefined or null.
    // It is called here as:
    //      reportMsPositionInScore(msPositionToReport);
    // The msPosition it passes back is the original number of milliseconds from the start of
    // the score (taking the global speed option into account). This value is used to identify
    // chord and rest symbols in the score, and so to synchronize the running cursor.
    // Moments whose msPositionInScore is to be reported are given chordStart or restStart
    // attributes before play() is called.
    init = function(inputDevice, outputDevice, reportEndOfPerfCallback, reportMsPosCallback)
    {
    	if(inputDevice === undefined || inputDevice === null)
    	{
    		throw "The midi input device must be defined.";
    	}

    	if(outputDevice === undefined || outputDevice === null)
    	{
    		throw "The midi output device must be defined.";
    	}

    	if(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
            || reportMsPosCallback === undefined || reportMsPosCallback === null)
    	{
    		throw "Error: both the position reporting callbacks must be defined.";
    	}

    	midiInputDevice = inputDevice;
    	midiOutputDevice = outputDevice;
    	reportEndOfPerformance = reportEndOfPerfCallback;
    	reportMsPositionInScore = reportMsPosCallback;

    	setState("stopped");

    	// TODO: use this.inputTracks and this.outputTracks
    	// (which have been set before calling this init() function)
    	// to set up the data structures for the prepared keyboard algorithm
    },

	// play()
    //
    // trackIsOnArray[trackIndex] returns a boolean which determines whether each output or input
	// track will be played or not. This array is read only.
    // recording is a Sequence to which timestamped moments are added as they are performed.
    // It should be an empty Sequence having the same number of output tracks as the score.
    play = function(trackIsOnArrayArg, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
    {
    	// Sets each input track's isPerforming attribute to the value set in the trackIsOnArray -- from the trackControl settings,
		// If track.isPerforming is true, track._currentTimeObjectIndex, and track.currentTimeObject are set.
    	function initPlay(that, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
    	{
    		var i, inputTrack, inputTrackIndex = 0,
			nInputTracks = that.inputTracks.length,
    		nOutputTracks = that.outputTracks.length,
			nTracks = nOutputTracks + nInputTracks;

    		for(i = nOutputTracks; i < nTracks; ++i)
    		{
    			inputTrack = that.inputTracks[inputTrackIndex++];
    			inputTrack.isPerforming = trackIsOnArray[i];

    			if(inputTrack.isPerforming)
    			{
    				inputTrack.setForInputSpan(startMarkerMsPosInScore, endMarkerMsPosInScore);
    			}
    		}
    	}

    	sequenceRecording = recording;

    	trackIsOnArray = trackIsOnArrayArg;
    	endMarkerMsPosition = endMarkerMsPosInScore;
    	startTimeAdjustedForPauses = performanceStartTime;

    	initPlay(this, trackIsOnArrayArg, startMarkerMsPosInScore, endMarkerMsPosInScore);

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
