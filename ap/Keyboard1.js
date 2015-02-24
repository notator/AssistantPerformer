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
    play = function(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
    {
    	// Sets each input track's isPerforming attribute to the value set in the trackIsOnArray -- from the trackControl settings,
		// If track.isPerforming is true, track._currentTimeObjectIndex, and track.currentTimeObject are set.
    	function initPlay(that, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
    	{
    		var i, track,
			nInputTracks = that.inputTracks.length,
    		nOutputTracks = that.outputTracks.length,
			nTracks = nOutputTracks + nInputTracks;

    		for(i = nOutputTracks; i < nTracks; ++i)
    		{
    			track = that.inputTracks[i - nOutputTracks];
    			track.isPerforming = trackIsOnArray[i];

    			if(track.isPerforming)
    			{
    				track.setForInputSpan(startMarkerMsPosInScore, endMarkerMsPosInScore);
    			}
    		}
    	}

    	sequenceRecording = recording;

    	performanceStartTime = performance.now();
    	endMarkerMsPosition = endMarkerMsPosInScore;
    	startTimeAdjustedForPauses = performanceStartTime;

    	initPlay(this, trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);

    	pausedMoment = null;
    	pauseStartTime = -1;
    	previousTimestamp = null;
    	previousMomtMsPos = startMarkerMsPosInScore;
    	msPositionToReport = -1;
    	lastReportedMsPosition = -1;

    	setState("running");
    },

    // Public function. Should only be called when this sequence is paused (and pausedMoment is set correctly).
    // The sequence pauses if nextMoment() sets currentMoment to null while tick() is waiting for setTimeout().
    // So the messages in pausedMoment (set to the last non-null currentMoment) have already been sent.
    resume = function()
    {
        var
        pauseMsDuration = performance.now() - pauseStartTime;

        if(isPaused())
        {
            currentMoment = pausedMoment; // the last moment whose messages were sent.

            setState("running"); // sets pausedMoment to null.

            currentMoment.timestamp += pauseMsDuration;
            previousTimestamp += pauseMsDuration;
            startTimeAdjustedForPauses += pauseMsDuration;

            currentMoment = nextMoment();
            if(currentMoment === null)
            {
                return;
            }
            currentMoment.timestamp = performance.now();
            tick();
        }
        else
        {
            throw "Error: resume() should only be called when this sequence is paused.";
        }
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

    handleMIDIInputEvent = function(msg)
    {
        var inputEvent, command, inputPressure,
            localOptions = options, trackOptions = localOptions.runtimeOptions.track;

        // The returned object is either empty, or has .data and .receivedTime attributes,
        // and so constitutes a timestamped Message. (Web MIDI API simply calls this an Event)
        // The Assistant ignores both realTime and SysEx messages, even though these are
        // defined (untested 8.3.2013) in the ap library, so this function only returns
        // the other types of message (having 2 or 3 data bytes).
        // If the input data is undefined, an empty object is returned, otherwise data must
        // be an array of numbers in range 0..0xF0. An exception is thrown if the data is illegal.
        function getInputEvent(data, now)
        {
            var
            SYSTEM_EXCLUSIVE = _AP.constants.SYSTEM_EXCLUSIVE,
            isRealTimeStatus = _AP.constants.isRealTimeStatus,
            inputEvent = {};

            if(data !== undefined)
            {
                if(data[0] === SYSTEM_EXCLUSIVE.START)
                {
                    if(!(data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END))
                    {
                        throw "Error in System Exclusive inputEvent.";
                    }
                    // SysExMessages are ignored by the assistant, so do nothing here.
                    // Note that SysExMessages may contain realTime messages at this point (they
                    // would have to be removed somehow before creating a sysEx event), but since
                    // we are ignoring both realTime and sysEx, nothing needs doing here.
                }
                else if((data[0] & 0xF0) === 0xF0)
                {
                    if(!(isRealTimeStatus(data[0])))
                    {
                        throw "Error: illegal data.";
                    }
                    // RealTime messages are ignored by the assistant, so do nothing here.
                }
                else if(data.length === 2)
                {
                    inputEvent = new Message(data[0], data[1], 0);
                }
                else if(data.length === 3)
                {
                    inputEvent = new Message(data[0], data[1], data[2]);
                }

                // other data is simply ignored

                if(inputEvent.data !== undefined)
                {
                    inputEvent.receivedTime = now;
                }
            }

            return inputEvent;
        }

        function setSpeedFactor(receivedCommandIndexInHTMLMenu, controllerValue)
        {
            var speedFactor;
            // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
            //     factor = fasterRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumFactor
            // If the controller's value is < 64, the factor which is passed to tick() will be
            //     factor = slowerRoot ^ (64 - cv) -- if cv = 0, factor will is 1/maximumFactor
            function getSpeedFactor(fasterRoot, slowerRoot, controllerValue)
            {
                var factor;
                if(controllerValue < 64) // 0..63
                {
                    factor = Math.pow(slowerRoot, (64 - controllerValue));
                }
                else // 64..127
                {
                    factor = Math.pow(fasterRoot, (controllerValue - 64));
                }

                console.log("assistant: factor=" + factor.toString(10));

                return factor;
            }

            if(performersSpeedOptions !== undefined && currentIndex >= 0
                && performersSpeedOptions.controllerIndex !== undefined && performersSpeedOptions.controllerIndex === receivedCommandIndexInHTMLMenu
                && performersSpeedOptions.fasterRoot !== undefined && performersSpeedOptions.slowerRoot !== undefined)
            {
                speedFactor = getSpeedFactor(performersSpeedOptions.fasterRoot, performersSpeedOptions.slowerRoot, controllerValue);
                performedSequences[currentIndex].setSpeedFactor(speedFactor);
            }
        }

        function handleController(runtimeTrackOptions, controlData, value, usesSoloTrack, usesOtherTracks)
        {
            var
            i,
            nTracks = allSequences[0].inputTracks.length,
            now = performance.now(),
            trackMoments, nMoments, moment, track;

            // Returns a new array of (synchronous) trackMoments.
            // Each trackMoment.moment is a Moment whose .messages attribute contains one message,
            // trackMoment.trackIndex is the moment's track index (=channel).
            function getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks)
            {
                var
                i, trackMoments = [], trackMoment,
                livePerformersTrackIndex = runtimeTrackOptions.livePerformersTrackIndex;

                // returns null if no new trackMoment is created.
                function newTrackMoment(runtimeTrackOptions, controlData, trackIndex, value)
                {
                    var message, moment = null, trackMoment = null;

                    // runtimeTrackOptions is a pointer to the runtimeTrackOptions attribute of the global options object.
                    // The runtimeTrackOptions has the following attributes:
                    //      trackMinVolumes -- an array of integers in the range 0..127, one value per track.
                    //      trackScales -- an array of floats in the range 0.0..1.0, one value per track.
                    // controlData is the controlData received from the live performer (via the controlSelector pop-ups).
                    // value is the control value received from the live performer.
                    // trackIndex is the new message's trackIndex (is used to index the arrays in runtimeTrackOptions).
                    // Returns null if no message is created for some reason.
                    function newControlMessage(runtimeTrackOptions, controlData, value, trackIndex)
                    {
                        var
                        CMD = _AP.constants.COMMAND,
                        message = null,
                        minVolume, scale;

                        if(controlData.midiControl !== undefined) // a normal control
                        {
                            if(controlData.midiControl === _AP.constants.CONTROL.VOLUME)
                            {
                                minVolume = runtimeTrackOptions.minVolumes[trackIndex];
                                scale = runtimeTrackOptions.scales[trackIndex];
                                value = Math.floor(minVolume + (value * scale));
                            }
                            // for other controls, value is unchanged
                            message = new Message(CMD.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
                        }
                        else if(controlData.command !== undefined)
                        {
                            switch(controlData.command)
                            {
                                case CMD.AFTERTOUCH:
                                    if(currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
                                    {
                                        message = new Message(CMD.AFTERTOUCH + trackIndex, currentLivePerformersKeyPitch, value);
                                    }
                                    break;
                                case CMD.CHANNEL_PRESSURE:
                                    message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value, 0);
                                    break;
                                case CMD.PITCH_WHEEL:
                                    // value is inputEvent.data[2]
                                    message = new Message(CMD.PITCH_WHEEL + trackIndex, 0, value);
                                    break;
                                default:
                                    break;
                            }
                        }

                        return message;
                    }

                    message = newControlMessage(runtimeTrackOptions, controlData, value, trackIndex);
                    if(message !== null)
                    {
                        moment = new Moment(0);  // moment.msPositionInChord is never used (this moment is not part of the score).
                        moment.messages.push(message);
                        trackMoment = {};
                        trackMoment.moment = moment;
                        trackMoment.trackIndex = trackIndex;
                    }
                    return trackMoment;
                }

                if(usesSoloTrack && usesOtherTracks)
                {
                    for(i = 0; i < nTracks; ++i)
                    {
                    	if(trackIsOnArray === undefined || trackIsOnArray[i] === true)
                        {
                            trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
                            if(trackMoment !== null)
                            {
                                trackMoments.push(trackMoment);
                            }
                        }
                    }
                }
                else if(usesSoloTrack)
                {
                    trackMoment = newTrackMoment(runtimeTrackOptions, controlData, livePerformersTrackIndex, value);
                    if(trackMoment !== null)
                    {
                        trackMoments.push(trackMoment);
                    }
                }
                else if(usesOtherTracks)
                {
                    for(i = 0; i < nTracks; ++i)
                    {
                        if(trackIsOnArray[i] && i !== livePerformersTrackIndex)
                        {
                            trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
                            if(trackMoment !== null)
                            {
                                trackMoments.push(trackMoment);
                            }
                        }
                    }
                }
                else
                {
                    throw "Either usesSoloTrack or usesOtherTracks must be set here.";
                }

                return trackMoments;
            }

            trackMoments = getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks);
            nMoments = trackMoments.length;
            for(i = 0; i < nMoments; ++i)
            {
                track = recordingSequence.inputTracks[trackMoments[i].trackIndex];

                if(track.isInChord !== undefined) // track.isInChord is defined in track.addLiveScoreMoment()
                {
                    moment = trackMoments[i].moment;
                    if(recordingSequence !== undefined && recordingSequence !== null)
                    {
                        moment.timestamp = now;
                        track.addLivePerformersControlMoment(moment);
                    }

                    outputDevice.send(moment.messages[0].data, now);
                }
            }
        }

        function silentlyCompleteCurrentlyPlayingSequence()
        {
            // currentIndex is the index of the currently playing sequence
            // (which should be silently completed when a noteOn arrives).
            if(currentIndex >= 0 && currentIndex < performedSequences.length)
            {
                performedSequences[currentIndex].finishSilently();
            }
        }

        // Each performedSequence calls this function (with two arguments) when
        // it stops:
        //      reportEndOfSequence(recordingSequence, performanceMsDuration);
        // but those arguments are ignored here. The recording continues until
        // the end of the performance, and performanceMsDuration is the duration
        // set by the beginning of the following performedSequence.
        // These values are passed back to the calling environment, when the
        // assistant stops, using the callback:
        //      reportEndOfPerformance(recordingSequence, performanceMsDuration);
        function reportEndOfSequence()
        {
            if(endOfPerformance)
            {
                stop();
            }
            else
            {
                reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            }
        }

        function playSequence(sequence)
        {
            // The durations will be related to the moment.msPositionReSubsequence attrbutes (which have been
            // set relative to the start of each subsequence), and to speedFactorObject argument.
            sequence.play(outputDevice, 0, Number.MAX_VALUE, trackIsOnArray, recordingSequence, reportEndOfSequence, reportMsPosition);
        }

        function handleNoteOff(inputEvent)
        {
            if(inputEvent.data[1] === currentLivePerformersKeyPitch)
            {
                currentLivePerformersKeyPitch = -1;

                silentlyCompleteCurrentlyPlayingSequence();

                if(endOfPerformance) // see reportEndOfPerformance() above 
                {
                    stop();
                }
                else if(performedSequences[nextIndex].restSequence !== undefined) // only play the next sequence if it is a restSequence
                {
                    currentIndex = nextIndex++;
                    endOfPerformance = (currentIndex === endIndex);
                    sequenceStartNow = inputEvent.receivedTime;
                    playSequence(performedSequences[currentIndex]);
                }
                else if(nextIndex <= endIndex)
                {
                    endOfPerformance = (nextIndex === endIndex);
                    reportMsPosition(performedSequences[nextIndex].msPositionInScore);
                }
            }
        }

        function handleNoteOn(inputEvent, overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            var
            allSubsequences = performedSequences;

            // Shifts the pitches in the subsequence up or down so that the lowest pitch in the
            // first noteOn moment is newPitch. Similarly with velocity.
            function overridePitchAndOrVelocity(allSubsequences, currentSubsequenceIndex, soloTrackIndex, newPitch, newVelocity,
                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            {
                var
                subsequence = allSubsequences[currentSubsequenceIndex],
                NOTE_ON_CMD = _AP.constants.COMMAND.NOTE_ON,
                NOTE_OFF_CMD = _AP.constants.COMMAND.NOTE_OFF,
                track = subsequence.inputTracks[soloTrackIndex], message, lowestNoteOnEvt, pitchDelta, velocityDelta,
                hangingScorePitchesPerTrack;

                // Returns the lowest NoteOn message in the first moment in the track to contain a NoteOnMessage.
                // Returns null if there is no such message.
                function findLowestNoteOnEvt(NOTE_ON_CMD, track)
                {
                    var i, j, message, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

                    for(i = 0; i < nMoments; ++i)
                    {
                        moment = track.moments[i];
                        nEvents = moment.messages.length;
                        for(j = 0; j < nEvents; ++j)
                        {
                            message = moment.messages[j];
                            if((message.command() === NOTE_ON_CMD)
                            && (lowestNoteOnMessage === null || message.data[1] < lowestNoteOnMessage.data[1]))
                            {
                                lowestNoteOnMessage = message;
                            }
                        }
                        if(lowestNoteOnMessage !== null)
                        {
                            break;
                        }
                    }
                    return lowestNoteOnMessage;
                }

                function midiValue(value)
                {
                    var result = (value >= 0) ? value : 0;
                    result = (value <= 127) ? value : 127;
                    return result;
                }

                // Adjusts the noteOn and noteOff messages inside this subsequence
                // Either returns an array of arrays, or null.
                // The returned array[track] is an array containing the score pitches which have not been turned off in each track.
                // null is returned if all the pitches which are turned on inside the subsequence are also turned off inside the subsequence.
                function adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                    overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
                {
                    var nTracks = subsequence.inputTracks.length, i, j, k, nMoments, moment, nEvents, index, nPitches,
                        pendingScorePitchesPerTrack = [], returnPendingScorePitchesPerTrack = [], pendingPitches = false;

                    for(i = 0; i < nTracks; ++i)
                    {
                        pendingScorePitchesPerTrack.push([]);

                        if((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
                        || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
                        {
                            track = subsequence.inputTracks[i];
                            nMoments = track.moments.length;

                            for(j = 0; j < nMoments; ++j)
                            {
                                moment = track.moments[j];
                                nEvents = moment.messages.length;
                                for(k = 0; k < nEvents; ++k)
                                {
                                    message = moment.messages[k];
                                    if(message.command() === NOTE_ON_CMD)
                                    {
                                        index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
                                        if(index === -1)
                                        {
                                            pendingScorePitchesPerTrack[i].push(message.data[1]);
                                        }

                                        message.data[1] = midiValue(message.data[1] + pitchDelta);
                                        message.data[2] = midiValue(message.data[2] + velocityDelta);
                                    }
                                    if(message.command() === NOTE_OFF_CMD)
                                    {
                                        index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
                                        if(index !== -1) // ignore noteOffs which are not related to noteOns in this subsequence.
                                        {
                                            delete pendingScorePitchesPerTrack[i][index];
                                            message.data[1] = midiValue(message.data[1] + pitchDelta);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    for(i = 0; i < nTracks; ++i)
                    {
                        returnPendingScorePitchesPerTrack.push([]);
                        nPitches = pendingScorePitchesPerTrack[i].length;
                        for(j = 0; j < nPitches; j++)
                        {
                            if(pendingScorePitchesPerTrack[i][j] !== undefined)
                            {
                                pendingPitches = true;
                                returnPendingScorePitchesPerTrack[i].push(pendingScorePitchesPerTrack[i][j]);
                            }
                        }
                    }
                    if(pendingPitches === false)
                    {
                        returnPendingScorePitchesPerTrack = null;
                    }

                    return returnPendingScorePitchesPerTrack;
                }

                // In each following subsequence and track, looks for the first noteOff corresponding to a hanging note, and adds pitchDelta to its pitch.
                function adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack)
                {
                    var trackIndex, nTracks = hangingScorePitchesPerTrack.length, hangingPitches,
                        i, nHangingPitches, hangingPitch, nextNoteOffMessage;

                    // returns the first noteOff message corresponding to the hanging Pitch in any of the following subsequences.
                    function findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch)
                    {
                        var
                        nextSubsequenceIndex = currentSubsequenceIndex + 1,
                        i, nSubsequences = allSubsequences.length, track,
                        j, nMoments, moment,
                        k, nMessages, message, returnMessage = null;

                        for(i = nextSubsequenceIndex; i < nSubsequences; ++i)
                        {
                            track = allSubsequences[i].inputTracks[trackIndex];
                            nMoments = track.moments.length;
                            for(j = 0; j < nMoments; ++j)
                            {
                                moment = track.moments[j];
                                nMessages = moment.messages.length;
                                for(k = 0; k < nMessages; ++k)
                                {
                                    message = moment.messages[k];
                                    if(message.data[1] === hangingPitch)
                                    {
                                        if(message.command() === NOTE_OFF_CMD)
                                        {
                                            returnMessage = message;
                                            break;
                                        }
                                    }
                                }
                                if(returnMessage !== null)
                                {
                                    break;
                                }
                            }
                            if(returnMessage !== null)
                            {
                                break;
                            }
                        }
                        return returnMessage;
                    }

                    for(trackIndex = 0; trackIndex < nTracks; trackIndex++)
                    {
                        hangingPitches = hangingScorePitchesPerTrack[trackIndex];
                        nHangingPitches = hangingPitches.length;
                        for(i = 0; i < nHangingPitches; i++)
                        {
                            hangingPitch = hangingPitches[i];
                            nextNoteOffMessage = findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch);
                            if(nextNoteOffMessage !== null)
                            {
                                nextNoteOffMessage.data[1] = hangingPitch + pitchDelta;
                            }
                        }
                    }

                }

                lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_CMD, track);
                if(lowestNoteOnEvt !== null)
                {
                    pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data[1]) : 0;
                    velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data[2]) : 0;

                    if(pitchDelta !== 0 || velocityDelta !== 0)
                    {
                        hangingScorePitchesPerTrack =
                            adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);

                        if(hangingScorePitchesPerTrack !== null)
                        {
                            adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack);
                        }
                    }
                }
            }

            function setSpeed(inputEventData)
            {
                if(performersSpeedOptions.controllerIndex === 1)
                {
                    setSpeedFactor(1, inputEventData[1]);
                }
                else if(performersSpeedOptions.controllerIndex === 2)
                {
                    setSpeedFactor(2, inputEventData[2]);
                }
            }

            //console.log("NoteOn, pitch:", inputEvent.data[1].toString(), " velocity:", inputEvent.data[2].toString());

            sequenceStartNow = inputEvent.receivedTime;

            currentLivePerformersKeyPitch = inputEvent.data[1];

            if(currentIndex === (performedSequences.length - 1))
            {
                // If the final sequence is playing and a noteOn is received, the performance stops immediately.
                // In this case the final sequence must be a restSequence (otherwise a noteOn can't be received).
                stop();
            }
            else if(inputEvent.data[2] > 0)
            {
                silentlyCompleteCurrentlyPlayingSequence();

                if(nextIndex === 0)
                {
                    performanceStartNow = sequenceStartNow;
                }

                if(nextIndex === 0 || (nextIndex <= endIndex && allSubsequences[nextIndex].chordSequence !== undefined))
                {
                    currentIndex = nextIndex++;
                    endOfPerformance = (currentIndex === endIndex);

                    if(overrideSoloPitch || overrideOtherTracksPitch || overrideSoloVelocity || overrideOtherTracksVelocity)
                    {
                        overridePitchAndOrVelocity(allSubsequences, currentIndex, options.livePerformersTrackIndex,
                            inputEvent.data[1], inputEvent.data[2],
                            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);
                    }

                    setSpeed(inputEvent.data);

                    playSequence(allSubsequences[currentIndex]);
                }
            }
            else // velocity 0 is "noteOff"
            {
                handleNoteOff(inputEvent);
            }
        }

        inputEvent = getInputEvent(msg.data, performance.now());

        if(inputEvent.data !== undefined)
        {
            command = inputEvent.command();

            switch(command)
            {
                case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
                    inputPressure = (inputEvent.data[1] > options.minimumInputPressure) ? inputEvent.data[1] : options.minimumInputPressure;
                    setSpeedFactor(3, inputEvent.data[1]);
                    //console.log("ChannelPressure, data[1]:", inputEvent.data[1].toString());  // CHANNEL_PRESSURE control has no data[2]
                    if(localOptions.pressureSubstituteControlData !== null)
                    {
                        // CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
                        handleController(trackOptions, localOptions.pressureSubstituteControlData, inputPressure,
                                                    localOptions.usesPressureSolo, localOptions.usesPressureOtherTracks);
                    }
                    break;
                case CMD.AFTERTOUCH: // produced by the EWI breath controller
                    inputPressure = (inputEvent.data[2] > options.minimumInputPressure) ? inputEvent.data[2] : options.minimumInputPressure;
                    setSpeedFactor(3, inputEvent.data[2]);
                    //console.log("Aftertouch input, key:" + inputEvent.data[1].toString() + " value:", inputEvent.data[2].toString()); 
                    if(localOptions.pressureSubstituteControlData !== null)
                    {
                        // AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch, but I dont need that
                        // because the current pitch is kept in currentLivePerformersKeyPitch (in the closure).
                        // AFTERTOUCH.data[2] is the amount of pressure 0..127.
                        handleController(trackOptions, localOptions.pressureSubstituteControlData, inputPressure,
                                                    localOptions.usesPressureSolo, localOptions.usesPressureOtherTracks);
                    }
                    break;
                case CMD.CONTROL_CHANGE: // sent when the input device's mod wheel changes.
                    if(inputEvent.data[1] === _AP.constants.CONTROL.MODWHEEL)
                    {
                        setSpeedFactor(5, inputEvent.data[2]);
                        // (EWI bite, EMU modulation wheel (CC 1, Coarse Modulation))
                        if(localOptions.modSubstituteControlData !== null)
                        {
                            // inputEvent.data[2] is the value to which to set the changed control
                            handleController(trackOptions, localOptions.modSubstituteControlData, inputEvent.data[2],
                                                        localOptions.usesModSolo, localOptions.usesModOtherTracks);
                        }
                    }
                    break;
                case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
                    setSpeedFactor(4, inputEvent.data[2]);
                    //console.log("Pitch Wheel, data[1]:", inputEvent.data[1].toString() + " data[2]:", inputEvent.data[2].toString());
                    // by experiment: inputEvent.data[2] is the "high byte" and has a range 0..127. 
                    if(localOptions.pitchBendSubstituteControlData !== null)
                    {
                        // PITCH_WHEEL.data[1] is the 7-bit LSB (0..127) -- ignored here
                        // PITCH_WHEEL.data[2] is the 7-bit MSB (0..127)
                        handleController(trackOptions, localOptions.pitchBendSubstituteControlData, inputEvent.data[2],
                                                    localOptions.usesPitchBendSolo, localOptions.usesPitchBendOtherTracks);
                    }
                    break;
                case CMD.NOTE_ON:
                    if(inputEvent.data[2] !== 0)
                    {
                        // setSpeedFactor is called inside handleNoteOn(...) because currentIndex needs to be >= 0.
                        handleNoteOn(inputEvent,
                            localOptions.overrideSoloPitch, localOptions.overrideOtherTracksPitch,
                            localOptions.overrideSoloVelocity, localOptions.overrideOtherTracksVelocity);
                    }
                    else
                    {
                        handleNoteOff(inputEvent);
                    }
                    break;
                case CMD.NOTE_OFF:
                    handleNoteOff(inputEvent);
                    break;
                default:
                    break;
            }
        }
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
