/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Sequence.js
*  The _AP.sequence namespace containing the following public interface functions
*  This namespace is for playing the default sequence, defined
*  in a score's output voices, without a live performer.
*  
*       init(...)
*       initPlay(...)
*       
*       play()
*       pause()
*       resume()
*       stop()
*       isStopped()
*       isPaused()
*       isRunning()
*       
*       finishSpanSilently()
*       setSpeedFactor()
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */


_AP.namespace('_AP.sequence');

_AP.sequence = (function(window)
{
    "use strict";
    var
    midiOutputDevice,
	tracks,

    speedFactor = 1.0, // nextMoment(), setSpeedFactor() in handleMIDIInputEvent()
    previousTimestamp = null, // nextMoment()
    previousMomtMsPos, // nextMoment()
    currentMoment = null, // nextMoment(), resume(), tick()
    endMarkerMsPosition,

    // used by setState()
    pausedMoment = null, // set by pause(), used by resume()
    stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
    paused = false, // nextMoment(), pause(), isPaused()

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
                pauseStartTime = performance.now();
                pausedMoment = currentMoment;
                currentMoment = null;
                break;
            case "paused":
                stopped = false;
                paused = true;
                pauseStartTime = performance.now();
                pausedMoment = currentMoment;
                currentMoment = null;
                break;
            case "running":
                stopped = false;
                paused = false;
                pauseStartTime = -1;
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

    // Should only be called while running a non-assisted performance
    pause = function()
    {
        if(isRunning())
        {
            setState("paused");
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
            setState("stopped");
            reportEndOfPerformance(sequenceRecording, performanceMsDuration);
        }
    },

    // nextMoment is used by tick(), resume(), play(), finishSpanSilently().
    // Returns the earliest track.nextMoment or null.
    // Null is returned if there are no more moments or if the sequence is paused or stopped.
    nextMoment = function()
    {
        var
        track, nTracks = tracks.length, trackMsPos,
        nextMomtMsPos,
        nextMomt = null,
        inLoopPhase = false;

        // Returns the looping track having the earliest nextMsPosition (= the position of the first unsent Moment in the track),
        // or null if the earliest nextMsPosition is >= endMarkerMsPosition.
        function getNextLoopingTrack(tracks, nTracks)
        {
            var track, i, nextTrack = null, nextMomt = null, trackMsPos, nextMomtMsPos = Number.MAX_VALUE;

            for(i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                if(track.isPerforming)
                {
                    trackMsPos = track.currentMsPosition(); // returns Number.MAX_VALUE at end of track

                    // ACHTUNG: inLoopPhase is true. Check track.currentMidiObject.msPositionInScore here! (c.f. the function below)
                    if((track.currentMidiObject.msPositionInScore < endMarkerMsPosition) && (trackMsPos < nextMomtMsPos))
                    {
                        nextTrack = track;
                        nextMomtMsPos = trackMsPos;
                    }
                }
            }

            return { track: nextTrack, nextMomtMsPos: nextMomtMsPos };
        }

        // Returns the (non-looping) track having the earliest nextMsPosition (= the position of the first unsent Moment in the track),
        // or null if the earliest nextMsPosition is >= endMarkerMsPosition.
        function getNextTrack(tracks, nTracks)
        {
            var track, i, nextTrack = null, nextMomt = null, trackMsPos, nextMomtMsPos = Number.MAX_VALUE;

            for(i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                if(track.isPerforming)
                {
                    trackMsPos = track.currentMsPosition(); // returns Number.MAX_VALUE at end of track

                    // ACHTUNG: inLoopPhase is false. Check trackMsPos here (c.f. the above function)
                    if((trackMsPos < endMarkerMsPosition) && (trackMsPos < nextMomtMsPos))
                    {
                        nextTrack = track;
                        nextMomtMsPos = trackMsPos;
                    }
                }
            }

            return { track: nextTrack, nextMomtMsPos: nextMomtMsPos };
        }

        if(inLoopPhase)
        {
            trackMsPos = getNextLoopingTrack(tracks, nTracks);
        }
        else
        {
            trackMsPos = getNextTrack(tracks, nTracks);
        }

        track = trackMsPos.track;

        if(track === null)
        {
            stop(); // calls reportEndOfPerformance(). An assisted performance waits for a noteOff...
        }
        else
        {
            nextMomt = track.currentMoment;
            track.advanceCurrentMoment(inLoopPhase);
        }

        if(!stopped && !paused)
        {
            if(inLoopPhase === false)
            {
                nextMomtMsPos = trackMsPos.nextMomtMsPos;

                if((nextMomt.chordStart || nextMomt.restStart)
                && (nextMomtMsPos > lastReportedMsPosition))
                {
                    // the position will be reported by tick() when nextMomt is sent.
                    msPositionToReport = nextMomtMsPos;
                    //console.log("msPositionToReport=%i", msPositionToReport);
                }

                if(previousTimestamp === null)
                {
                    nextMomt.timestamp = startTimeAdjustedForPauses;
                }
                else
                {
                    nextMomt.timestamp = ((nextMomtMsPos - previousMomtMsPos) * speedFactor) + previousTimestamp;
                }
            }
            else // inLoopPhase === true
            {
                nextMomtMsPos = trackMsPos.nextMomtMsPos;
                nextMomt.timestamp = ((nextMomtMsPos - previousMomtMsPos) * speedFactor) + previousTimestamp;

                //console.log("inLoopPhase: endMarkerMsPosition=%i, nextMomtMsPos=%i", endMarkerMsPosition, nextMomtMsPos);
            }

            previousTimestamp = nextMomt.timestamp;
            previousMomtMsPos = nextMomtMsPos;
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
    //      reportEndOfPerformance // can be null
    //      reportMsPosition // can be null    
    tick = function()
    {
        var
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
            return;
        }

        delay = currentMoment.timestamp - now; // compensates for inaccuracies in setTimeout
        ////console.log("tick: delay1=%f", delay);
        ////console.log("currentMoment.msPositionInScore=%i", currentMoment.msPositionInScore);
        ////console.log("currentMoment.timestamp=%f", currentMoment.timestamp);
        // send all messages that are due between now and PREQUEUE ms later. 
        while(delay <= PREQUEUE)
        {
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
                return;
            }

            delay = currentMoment.timestamp - now;
        }

        window.setTimeout(tick, delay);  // that will schedule the next tick.
    },

    // Public function. Should only be called when this sequence is paused (and pausedMoment is set correctly).
    // The sequence pauses if nextMoment() sets currentMoment to null while tick() is waiting for setTimeout().
    // So the messages in pausedMoment (set to the last non-null currentMoment) have already been sent.
    resume = function()
    {
        var pauseMsDuration;

        if(pausedMoment === null || pauseStartTime < 0)
        {
            throw "Error: pausedMoment and pauseStartTime must be defined here.";
        }

        currentMoment = pausedMoment; // the last moment whose messages were sent.
        pauseMsDuration = performance.now() - pauseStartTime;

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
    },

    run = function()
    {
        if(pausedMoment !== null)
        {
            resume();
        }
        else
        {
            setState("running");

            currentMoment = nextMoment();
            if(currentMoment === null)
            {
                return;
            }
            tick();
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
    init = function(outputDevice, reportEndOfPerfCallback, reportMsPosCallback)
    {
        if(outputDevice === undefined || outputDevice === null)
        {
        	throw "The midi output device must be defined.";
        }

        if(reportEndOfPerfCallback === undefined || reportEndOfPerfCallback === null
            || reportMsPosCallback === undefined || reportMsPosCallback === null)
        {
        	throw "Error: both the position reporting callbacks must be defined.";
        }

        setState("stopped");

        tracks = this.outputTracks;
        midiOutputDevice = outputDevice;
        reportEndOfPerformance = reportEndOfPerfCallback;
        reportMsPositionInScore = reportMsPosCallback;
    },

    // play()
    //
    // trackIsOnArray[trackIndex] returns a boolean which determines whether the track will
    // be played or not. This array belongs to its creator, and is read only.
    //
    // recording is a Sequence to which timestamped moments are added as they are performed.
    // Can be undefined or null. If used, it should be an empty Sequence having the same number
    // of tracks as this (calling) sequence.
    play = function(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore, recording)
    {
    	// Sets each (output) track's isPerforming attribute.
    	// If the track is set to perform (in the trackIsOnArray -- the trackControl settings),
    	// sets track._currentMidiObjectIndex, track.currentMidiObject and track.currentMoment.
    	// all subsequent midiChords before endMarkerMsPosInScore are set to start at their beginnings.
    	function initPlay(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore)
    	{
    		var i,
				// Note that the trackIsOnArray will also include input tracks if the score has any,
				// but that these are ignored here because _tracks_ only contains the _output_ tracks.
				nTracks = tracks.length,
				track;

    		for(i = 0; i < nTracks; ++i)
    		{
    			track = tracks[i];
    			track.isPerforming = trackIsOnArray[i];

    			if(track.isPerforming)
    			{
    				track.setForOutputSpan(startMarkerMsPosInScore, endMarkerMsPosInScore);
    			}
    		}
    	}

        sequenceRecording = recording; // can be undefined or null

        performanceStartTime = performance.now();
        endMarkerMsPosition = endMarkerMsPosInScore;
        startTimeAdjustedForPauses = performanceStartTime;

        initPlay(trackIsOnArray, startMarkerMsPosInScore, endMarkerMsPosInScore);

        pausedMoment = null;
        pauseStartTime = -1;
        previousTimestamp = null;
        previousMomtMsPos = startMarkerMsPosInScore;
        msPositionToReport = -1;
        lastReportedMsPosition = -1;

        run();
    },

    // Immediately sends all the span's NOTE_OFF commands that happen
    // before endOfSpanMsPosition, and then calls stop().
    // Other commands (NOTE_ON, AFTERTOUCH, CONTROL_CHANGE, PROGRAM_CHANGE, CHANNEL_PRESSURE, PITCH_WHEEL) are NOT sent.
    // Called in assisted performances when a NOTE_OFF arrives before a span has finished.
    // The sent noteOff messages are recorded.
    finishSpanSilently = function(endOfSpanMsPosition)
    {
        var
        i, nTracks = tracks.length, track,
        lastMsPos, lastTrackMomentMsPositionInScore,
        now = performance.now(),
        noteOffsMoment;

        function addNoteOffs(moment, noteOffsMoment)
        {
            var CMD = _AP.constants.COMMAND,
            messages = moment.messages,
            i, nMessages = messages.length, message, command;

            for(i = 0; i < nMessages; ++i)
            {
                message = messages[i];
                command = message.command();
                if(command === CMD.NOTE_OFF || (command === CMD.NOTE_ON && message.data[2] === 0))
                {
                    noteOffsMoment.messages.push(message);
                }
            }
        }

        function sendMessages(moment)
        {
            var
            messages = moment.messages,
            i, nMessages = messages.length;

            for(i = 0; i < nMessages; ++i)
            {
                midiOutputDevice.send(messages[i].data, moment.timestamp);
            }
        }


        for(i = 0; i < nTracks; ++i)
        {
            track = tracks[i];
            // track.currentMoment is null when the complete track has no more moments
            // if track.currentMoment !== null then track.currentMidiObject should also be !== null!
            if(track.isPerforming)
            {
                noteOffsMoment = new _AP.moment.Moment(0);
                lastTrackMomentMsPositionInScore = Number.MAX_VALUE;

                while(true)
                {
                    lastMsPos = track.currentMsPosition();
                    if(lastMsPos >= endOfSpanMsPosition)
                    {
                        break;
                    }
                    lastTrackMomentMsPositionInScore = lastMsPos; // the last msPosition before the end marker
                    addNoteOffs(track.currentMoment, noteOffsMoment);
                    track.advanceCurrentMoment(); // undefined argument: means don't loop midiChords.
                }

                if(track.currentMsPosition() === endOfSpanMsPosition)
                {
                    addNoteOffs(track.currentMoment, noteOffsMoment);
                }

                if(lastTrackMomentMsPositionInScore < endOfSpanMsPosition)
                {
                    noteOffsMoment.timestamp = now;
                    sendMessages(noteOffsMoment);

                    if(sequenceRecording !== undefined && sequenceRecording !== null && noteOffsMoment.messages.length > 0)
                    {
                        sequenceRecording.trackRecordings[noteOffsMoment.messages[0].channel()].addLiveScoreMoment(noteOffsMoment);
                    }

                    // previousMomtMsPos is used in the next span when setting the next moment's timestamp
                    previousMomtMsPos = (previousMomtMsPos > lastTrackMomentMsPositionInScore) ? previousMomtMsPos : lastTrackMomentMsPositionInScore;
                }
            }
        }

        stop();
    },

    setSpeedFactor = function(factor)
    {
        speedFactor = factor;
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

        finishSpanSilently: finishSpanSilently,
        setSpeedFactor: setSpeedFactor
    };
    // end var

    return publicAPI;

}(window));




