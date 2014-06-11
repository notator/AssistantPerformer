/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/ScorePlayer.js
*  The _AP.scorePlayer namespace which defines
*
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

_AP.namespace('_AP.scorePlayer');

_AP.scorePlayer = (function()
{
    "use strict";

    var
    midiOutputDevice,
    tracks, // sequence.tracks

    /******************************/
    /* from old Sequence file     */
    midiObjectMsPositionsInScoreIndex = 0, // the current index in the following array
    midiObjectMsPositionsInScore = [], // a flat, ordered array of msPositions

    speedFactor = 1.0, // nextMoment(), setSpeedFactor() in handleMIDIInputEvent()
    previousTimestamp = null, // nextMoment()
    previousMomtMsPosInScore = 0, // nextMoment()
    currentMoment = null, // nextMoment(), resume(), tick()

    // used by setState()
    pausedMoment = null, // set by pause(), used by resume()
    stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
    paused = false, // nextMoment(), pause(), isPaused()

    maxDeviation, // for //console.log, set to 0 when performance starts
    reportEndOfPerformance, // callback. Can be null or undefined. Set in play().
    reportMsPositionInScore,  // callback. Can be null or undefined. Set in play().
    lastReportedMsPosition = -1, // set by tick() used by nextMoment()
    msPositionToReport = -1,   // set in nextMoment() and used/reset by tick()

    // (performance.now() - performanceStartTime) is the real time elapsed since the start of the performance.
    performanceStartTime = -1,  // set in play(), used by stop(), run()
    // (performance.now() - startTimeAdjustedForPauses) is the current performance duration excluding the durations of pauses.
    startTimeAdjustedForPauses = -1, // performanceStartTime minus the durations of pauses. Used in nextMoment()
    pauseStartTime = -1, // the performance.now() time at which the performance was paused.

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
                break;
            case "paused":
                stopped = false;
                paused = true;
                pausedMoment = currentMoment;
                break;
            case "running":
                stopped = false;
                paused = false;
                pausedMoment = null;
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
            if(reportEndOfPerformance !== undefined && reportEndOfPerformance !== null)
            {
                reportEndOfPerformance(sequenceRecording, performanceMsDuration);
            }
        }
    },

    // nextMoment is used by tick(), resume(), play(), finishSilently().
    // Returns the earliest track.nextMoment or null.
    // Null is returned if there are no more moments or if the sequence is paused or stopped.
    nextMoment = function()
    {
        var
        nTracks = tracks.length,
        track, i, currentTrack = null,
        trackMomentMsPosInScore, nextMomtMsPosInScore = Number.MAX_VALUE,
        nextMomt = null,
        scoreMsPosition,
        endMarkerPosition = midiObjectMsPositionsInScore[midiObjectMsPositionsInScore.length - 1];

        // Sets scoreMsPosition to one of the midiObjectMsPositionsInScore.
        function getScoreMsPosition()
        {
            var
            currentIndex = midiObjectMsPositionsInScoreIndex,
            scoreMsPosition = midiObjectMsPositionsInScore[currentIndex]; // The usual value

            function advanceTrackMidiObjects(tracks, scoreMsPosition)
            {
                for(i = 0; i < tracks.length; ++i)
                {
                    if(tracks[i].isPerforming)
                    {
                        tracks[i].advanceMidiObject(scoreMsPosition);
                    }
                }
            }

            function advanceScoreMsPosition()
            {
                var currentIndex, newScoreMsPosition;

                midiObjectMsPositionsInScoreIndex++;
                currentIndex = midiObjectMsPositionsInScoreIndex;
                if(currentIndex < midiObjectMsPositionsInScore.length)
                {
                    newScoreMsPosition = midiObjectMsPositionsInScore[currentIndex];
                    advanceTrackMidiObjects(tracks, newScoreMsPosition);
                }
                return newScoreMsPosition;
            }

            if((performance.now() - startTimeAdjustedForPauses) >= (midiObjectMsPositionsInScore[currentIndex + 1] - midiObjectMsPositionsInScore[0]))
            {
                // The scoreMsPosition is moved to that of the next MidiObject.
                scoreMsPosition = advanceScoreMsPosition();
            }

            return scoreMsPosition;
        }

        scoreMsPosition = getScoreMsPosition();

        if(!stopped && !paused)
        {
            if(scoreMsPosition === endMarkerPosition)
            {
                stop(); // calls reportEndOfPerformance()
            }

            // find the track having the earliest nextMoment and nextMomtMsPosInScore.
            for(i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                // track.currentMoment is null when the track has no more moments
                // if track.currentMoment !== null then track.currentMidiObject should also be !== null!
                if(track.isPerforming && track.currentMoment !== null)
                {
                    trackMomentMsPosInScore = track.currentMidiObject.msPositionInScore + track.currentMoment.msPositionInChord;
                    if(trackMomentMsPosInScore < nextMomtMsPosInScore)
                    {
                        currentTrack = track;
                        nextMomtMsPosInScore = trackMomentMsPosInScore;
                    }
                }
            }

            if(currentTrack !== null)
            {
                nextMomt = currentTrack.currentMoment;
                currentTrack.advanceMoment();
            }

            // nextMomt is now either null (= end of span) or the next moment.

            if(nextMomt === null)
            {
                stop(); // calls reportEndOfPerformance()
            }
            else
            {
                if(reportMsPositionInScore !== undefined && reportMsPositionInScore !== null
                && (nextMomt.chordStart || nextMomt.restStart) // These attributes are set when loading a score.
                && (nextMomtMsPosInScore > lastReportedMsPosition))
                {
                    // the position will be reported by tick() when nextMomt is sent.
                    msPositionToReport = nextMomtMsPosInScore;
                    ////console.log("msPositionToReport=" + msPositionToReport);
                }

                if(previousTimestamp === null)
                {
                    nextMomt.timestamp = startTimeAdjustedForPauses;
                }
                else
                {
                    nextMomt.timestamp = ((nextMomtMsPosInScore - previousMomtMsPosInScore) * speedFactor) + previousTimestamp;
                }

                previousTimestamp = nextMomt.timestamp;
                previousMomtMsPosInScore = nextMomtMsPosInScore;
            }
        }

        return nextMomt; // null stops tick().
    },

    // tick() function -- which ows a lot to Chris Wilson of the Web Audio Group
    // Recursive function. Also used by resume(), play()
    // This function has been tested as far as possible without having "a conformant outputDevice.send() with timestamps".
    // It needs testing again with the conformant outputDevice.send() and a higher value for PREQUEUE. What would the
    // ideal value for PREQUEUE be? 
    // Email correspondence with Chris Wilson (End of Oct. 2012):
    //      James: "...how do I decide how big PREQUEUE should be?"
    //      Chris: "Well, you're trading off two things:
    //          - 'precision' of visual display (though keep in mind that is fundamentally limited to the 16.67ms tick
    //            of the visual refresh rate (for a 60Hz display) - and that also affects how quickly you can respond
    //            to tempo changes (or stopping/pausing playback).
    //          - reliance on how accurate the setTimeout/setInterval clock is (for that reason alone, the lookahead
    //            probably needs to be >5ms).
    //          So, in short, you'll just have to test on your target systems."
    //      James: "Yes, that's more or less what I thought. I'll start testing with PREQUEUE at 16.67ms."
    //
    // 16th Nov. 2012: The cursor can only be updated once per tick, so PREQUEUE needs to be small enough for that not
    // to matter.
    // 18th Jan. 2013 -- Jazz 1.2 does not support timestamps.
    //
    // The following variables are initialised in play() to start playing the span:
    //      currentMoment // the first moment in the sequence
    //      track attributes:
    //          isPerforming // set by referring to the track control
    //          fromIndex // the index of the first moment in the track to play
    //          toIndex // the index of the final moment in the track (which does not play)
    //          currentIndex // = fromIndex
    //      maxDeviation = 0; // just for //console.log
    //      reportEndOfPerformance // can be null
    //      reportMsPosition // can be null    
    tick = function()
    {
        var
        deviation,
        PREQUEUE = 0, // needs to be set to a larger value later. See above.
        now = performance.now(),
        delay;

        // moment.timestamps are always absolute DOMHRT values here.
        // (Chris said that the timestamp should be absolute DOMHRT time when the moment is sent.)
        // Note that Jazz 1.2 does not support timestamps. It always sends Messages immediately.
        function sendMessages(moment)
        {
            var
            messages = moment.messages,
            i, nMessages = messages.length, timestamp = moment.timestamp;

            for(i = 0; i < nMessages; ++i)
            {
                midiOutputDevice.send(messages[i].data, timestamp);
            }
        }

        if(currentMoment === null)
        {
            ////console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
            return;
        }

        delay = currentMoment.timestamp - now; // compensates for inaccuracies in setTimeout
        ////console.log("tick: delay1 = " + delay.toString(10));
        ////console.log("currentMoment.msPositionInScore: " + currentMoment.msPositionInScore);
        ////console.log("currentMoment.timestamp: " + currentMoment.timestamp);
        // send all messages that are due between now and PREQUEUE ms later. 
        while(delay <= PREQUEUE)
        {
            // these values are only used by //console.log (See end of file too!)
            deviation = (now - currentMoment.timestamp);
            maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;
            ////console.log("deviation: " + deviation + "ms");

            if(msPositionToReport >= 0)
            {
                reportMsPositionInScore(msPositionToReport);
                lastReportedMsPosition = msPositionToReport; // lastReportedMsPosition is used in nextMoment() above.
                msPositionToReport = -1;
            }

            if(currentMoment.messages.length > 0) // rest moments can be empty (but should be reported above) 
            {
                sendMessages(currentMoment);

                if(sequenceRecording !== undefined && sequenceRecording !== null)
                {
                    // The moments are recorded with their current (absolute DOMHRT) timestamp values.
                    // These values are adjusted relative to the first moment.timestamp
                    // before saving them in a Standard MIDI File.
                    // (i.e. the value of the earliest timestamp in the recording is
                    // subtracted from all the timestamps in the recording) 
                    sequenceRecording.trackRecordings[currentMoment.messages[0].channel()].addLiveScoreMoment(currentMoment);
                }
            }

            currentMoment = nextMoment();

            if(currentMoment === null)
            {
                // we're pausing, or have hit the end of the sequence.
                ////console.log("Pause, or end of sequence.  maxDeviation: " + maxDeviation + "ms");
                return;
            }

            delay = currentMoment.timestamp - now;

            ////console.log("tick: delay2 = " + delay.toString(10));
        }

        ////console.log("tick: delay3 = " + delay);
        window.setTimeout(tick, delay);  // that will schedule the next tick.
    },

    // Should only be called when the sequence is stopped.
    run = function()
    {
        if(isStopped())
        {
            setState("running");

            currentMoment = nextMoment();
            if(currentMoment === null)
            {
                return;
            }
            tick();
        }
        else
        {
            throw "Error: run() should only be called when the sequence is stopped.";
        }
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

    init = function(sequenceTracks, options, reportEndOfPerf, reportMsPos)
    {
        if(options === undefined || options.outputDevice === undefined || options.outputDevice === null)
        {
            throw "The midi output device must be defined.";
        }

        tracks = sequenceTracks;
        midiOutputDevice = options.outputDevice;
        reportEndOfPerformance = reportEndOfPerf;
        reportMsPositionInScore = reportMsPos;
    },

    // play();
    // Note that the moment at endMarkerMsPosition will NOT be played as part of the span.
    // endMarkerMsPosition is the msPosition of the endMarker, and moments on the endMarker
    // are never performed.
    //
    // trackIsOnArray[trackIndex] returns a boolean which determines whether the track will
    // be played or not. This array belongs to its creator, and is read only.
    //
    // recording is a Sequence to which timestamped moments are added as they are performed.
    // Can be undefined or null. If used, it should be an empty Sequence having the same number
    // of tracks as this (calling) sequence.
    //
    // The reportEndOfSpanCallback argument is a callback function which is called when the
    // performance stops -- either because the end of the span has been reached, or when the
    // user stops the performance prematurely. Can be undefined or null.
    // It is called here as:
    //      reportEndOfPerformance(sequenceRecording, performanceMsDuration);
    // The arguments are a Sequence containing a recording of the (timestamped) messages
    // which have been sent, and the total duration of the performance (in milliseconds). 
    //
    // The reportMsPositionInScoreCallback argument is a callback function which reports
    // the current msPositionInScore back to the GUI while performing. Can be undefined or null.
    // It is called here as:
    //      reportMsPositionInScore(msPositionToReport);
    // The msPosition it passes back is the original number of milliseconds from the start of
    // the score (taking the global speed option into account). This value is used to identify
    // chord and rest symbols in the score, and so to synchronize the running cursor.
    // Moments whose msPositionInScore is to be reported are given chordStart or restStart
    // attributes before play() is called.
    play = function(startMarkerMsPosition, endMarkerMsPosition, trackIsOnArray, recording)
    {
        // Sets each track's isPerforming attribute.
        // If the track is set to perform (in the trackIsOnArray -- the trackControl settings),
        // an attempt is made to set its fromIndex, currentIndex and toIndex attributes such that
        //     fromIndex is the index of the first midiObject at or after startMarkerMsPosition
        //     toIndex is the index of the last midiObject before endMarkerMsPosition.
        //     currentIndex is set to fromIndex
        // If, however, the track contains no such moments, track.isPerforming is set to false. 
        function setTrackAttributes(tracks, trackIsOnArray, startMarkerMsPosition, endMarkerMsPosition)
        {
            var
            i, nTracks = tracks.length, track,
            j, trackMidiObjects, trackLength;

            function getToIndex(track, endMarkerMsPosition)
            {
                var toIndex = -1,
                    trackMidiObjects = track.midiObjects,
                    trackLength = trackMidiObjects.length;

                if(track.fromIndex < 0)
                {
                    throw "error: track.fromIndex should be >= 0 here.";
                }

                track.toIndex = -1;
                for(j = track.fromIndex; j < trackLength; ++j)
                {
                    // endMarkerMsPosition is the position of the endMarker.
                    // moments at the endMarker's msPosition should not be played.
                    // track.toIndex is the index of the last performed moment.
                    if(trackMidiObjects[j].msPositionInScore < endMarkerMsPosition)
                    {
                        toIndex = j + 1; // the last midiObject to be played is trackMidiObjects[track.toIndex - 1]
                    }
                    else
                    {
                        break;
                    }
                }

                return toIndex;
            }

            for(i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackMidiObjects = track.midiObjects;
                trackLength = trackMidiObjects.length;
                track.fromIndex = -1;
                track.toIndex = -1;

                // trackLength can be 0, if nothing happens during
                // the track (maybe during a during a subsequence)
                if(trackLength === 0)
                {
                    track.isPerforming = false;
                }
                else
                {
                    track.isPerforming = trackIsOnArray[i];
                }

                if(track.isPerforming)
                {
                    for(j = 0; j < trackLength; ++j)
                    {
                        if(trackMidiObjects[j].msPositionInScore >= startMarkerMsPosition)
                        {
                            track.fromIndex = j;
                            break;
                        }
                    }

                    if(track.fromIndex >= 0)
                    {
                        track.toIndex = getToIndex(track, endMarkerMsPosition);
                        if(track.toIndex > track.fromIndex)
                        {
                            track.runtimeInit(track.fromIndex, track.toIndex);
                        }
                    }
                }
            }
        }

        // Returns a flat, ordered array of unique msPositions that contains
        // all the midiObject.msPositionInScore values that are >= startMarkerMsPosition and <= endMarkerMsPosition.
        function getMidiObjectMsPositionsInScore(tracks, startMarkerMsPosition, endMarkerMsPosition)
        {
            var positions = [], newPosition, trackIndices = [], i, nTracks = tracks.length, track;

            for(i = 0; i < nTracks; ++i)
            {
                trackIndices.push(tracks[i].fromIndex);
            }

            while(true)
            {
                // Find the earliest position in any track, greater than positions[positions.length-1].
                newPosition = Number.MAX_VALUE;
                for(i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
                    if(track.isPerforming)
                    {
                        if(trackIndices[i] < track.midiObjects.length
                        && track.midiObjects[trackIndices[i]].msPositionInScore === positions[positions.length - 1])
                        {
                            trackIndices[i]++;
                        }
                        if(trackIndices[i] < track.midiObjects.length
                        && track.midiObjects[trackIndices[i]].msPositionInScore < newPosition)
                        {
                            newPosition = track.midiObjects[trackIndices[i]].msPositionInScore;
                        }
                    }
                }
                if(newPosition === Number.MAX_VALUE || newPosition >= endMarkerMsPosition)
                {
                    break;
                }
                if(newPosition >= startMarkerMsPosition)
                {
                    positions.push(newPosition);
                }
            }

            positions.push(endMarkerMsPosition);

            return positions;
        }

        setState("stopped");

        sequenceRecording = recording; // can be undefined or null

        lastReportedMsPosition = -1;

        maxDeviation = 0; // for //console.log

        setTrackAttributes(tracks, trackIsOnArray, startMarkerMsPosition, endMarkerMsPosition);

        midiObjectMsPositionsInScore = getMidiObjectMsPositionsInScore(tracks, startMarkerMsPosition, endMarkerMsPosition);
        midiObjectMsPositionsInScoreIndex = 0;

        performanceStartTime = performance.now();
        startTimeAdjustedForPauses = performanceStartTime;
        run();
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
        sendSetPitchWheelDeviationMessageNow: sendSetPitchWheelDeviationMessageNow
    };
    // end var

    return publicAPI;

}());
