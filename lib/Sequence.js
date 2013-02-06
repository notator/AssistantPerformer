/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  Sequence.js
*  The MIDI_API.sequence namespace which defines the
*    Sequence(msPositionInScore) empty sequence constructor.
*
*  Public Interface (See longer descriptions in the code.):
*
*      // an array of Tracks
*      tracks
*
*      // The point in the score (if any) at which this Sequence begins.
*      // This value is set when the Sequence is constructed, and should never change.
*      // If there is no score, the Sequence constructor should be called with no arguments,
*      // in which case msPositionInScore defaults to 0.
*      msPositionInScore
*
*      // Start playing (part of) the Sequence.
*      // Arguments:
*      // midiOutdevice: the output device
*      // fromMs, toMs: the span of the sequence to play (not including toMs)
*      // trackIsOnArray[trackIndex] returns a boolean which determine whether the track will
*      //       be played or not. This array belongs to the caller, and is read only.
*      // [optional] reportEndOfSeqCallback: called when the performance ends.
*      // [optional] reportMsPositionCallback: called whenever a cursor needs to be updated
*      //       in the score.
*      playSpan(midiOutDevice, fromMs, toMs, trackIsOnArray,
*               reportEndOfSeqCallback, reportMsPositionCallback)
*
*      // pause a running performance
*      pause(),
*
*      // resume a paused performance
*      resume()
*
*      // stop a running performance
*      stop()
*
*      // Is the performance stopped?
*      isStopped(),
*
*      // Is the performance paused()?
*      isPaused()
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */


MIDI_API.namespace('MIDI_API.sequence');

MIDI_API.sequence = (function (window)
{
    "use strict";
    var
    CMD = MIDI_API.constants.COMMAND,

    // An empty sequence is created. It contains an empty array of MIDI_API.track.Tracks.
    // The msPositionInScore argument defaults to 0.
    Sequence = function (msPositionInScore)
    {
        if (!(this instanceof Sequence))
        {
            return new Sequence(msPositionInScore);
        }

        msPositionInScore = (msPositionInScore === undefined) ? 0 : msPositionInScore;

        this.tracks = []; // an array of Tracks
        Object.defineProperty(this, "msPositionInScore", { value: msPositionInScore, writable: false });
    },

    publicSequenceAPI =
    {
        // creates an empty sequence
        Sequence: Sequence
    };
    // end var

    Sequence.prototype = (function (window)
    {
        var
        // used by setState()
        currentMoment = null, // nextEvent(), resume()
        thatIsLastMoment = false, // nextEvent(), tick()
        eventIndex = -1, // nextEvent()
        currentMomentLength = 0, // nextEvent()
        stopped = true, // nextEvent(), stop(), pause(), resume(), isStopped()
        paused = false, // nextEvent(), pause(), isPaused()

        that, // closure variable set by playSpan(), used by nextEvent()

        maxDeviation, // for console.log, set to 0 when performance starts
        midiOutputDevice, // set in playSpan(), used by tick()
        reportEndOfSequence, // callback. Can be null or undefined. Set in playSpan().
        reportMsPositionInScore,  // callback. Can be null or undefined. Set in playSpan().

        domhrtMsOffsetAtStartOfSequence = 0, // set in playSpan() and resume(), used by tick()

        event = null, // set in playSpan() and tick(), used by tick()

        endMarkerTimestamp = -1,  // set in playSpan(), used by nextEvent()
        startNow = -1,  // set in playSpan(), used by nextEvent()
        lastSequenceTimestamp = -1, // set in playSpan(), used by nextEvent()
        recordingSequence, // set in playSpan() and resume(), used by tick()

        setState = function (state)
        {
            switch (state)
            {
                case "stopped":
                    currentMoment = null;
                    thatIsLastMoment = false;
                    eventIndex = -1;
                    currentMomentLength = 0;
                    stopped = true;
                    paused = false;
                    break;
                case "paused":
                    stopped = false;
                    paused = true;
                    break;
                case "running":
                    stopped = false;
                    paused = false;
                    break;
                default:
                    throw "Unknown sequence state!";
            }
        },

        // Can only be called while running
        // (stopped === false && paused === false)
        pause = function ()
        {
            if (stopped === false && paused === false)
            {
                setState("paused");
            }
            else
            {
                throw "Attempt to pause a stopped or paused sequence.";
            }
        },

        // does nothing if the sequence is already stopped
        stop = function ()
        {
            var
            endNow = window.performance.now(),
            sequenceDuration = Math.ceil(endNow - startNow);

            if (stopped === false)
            {
                setState("stopped");
                if (reportEndOfSequence !== undefined && reportEndOfSequence !== null)
                {
                    reportEndOfSequence(recordingSequence, sequenceDuration, false);
                }
            }
        },

        isStopped = function ()
        {
            return stopped === true;
        },

        isPaused = function ()
        {
            return paused === true;
        },

        // used by tick(), resume(), playSpan(), finishSilently()
        // Returns either the next event in the sequence, 
        // or null if there are no more moments and no more events.
        // A Moment always has at least one event, since restStart moments now contain either
        // the final events from the previous chord, or an 'empty Event'.
        // (see the MIDIRest constructor).
        nextEvent = function ()
        {
            var nextEvent = null;

            // Returns the earliest moment indexed by the track.currentIndex indices, or null if
            // track.currentIndex > track.toIndex in all tracks.
            function nextMoment()
            {
                var
                the = that, // that is set in playSpan(). Maybe using a local variable is faster...
                nTracks = the.tracks.length,
                track, i, nextMomt = null, nextMomentTrackIndex,
                moment, minTimestamp = Number.MAX_VALUE;

                for (i = 0; i < nTracks; ++i)
                {
                    track = the.tracks[i];
                    if (track.isPerforming && track.currentIndex <= track.toIndex) // toIndex is the last valid index
                    {
                        moment = track.moments[track.currentIndex];
                        if (moment.timestamp < minTimestamp)
                        {
                            nextMomt = moment;
                            minTimestamp = moment.timestamp;
                            nextMomentTrackIndex = i;
                        }
                    }
                }

                // nextMomt is now either null (= end of span) or the next moment.

                if (nextMomt !== null)
                {
                    // Only perform the last moment in the span if it is the last moment in the sequence.
                    if (nextMomt.timestamp === endMarkerTimestamp && nextMomt.timestamp < lastSequenceTimestamp)
                    {
                        // Do not perform the last moment in a span or sequence, but call stop() (below).
                        nextMomt = null;
                    }
                    else
                    {
                        the.tracks[nextMomentTrackIndex].currentIndex++;
                        if (nextMomt.timestamp === lastSequenceTimestamp)
                        {
                            thatIsLastMoment = true;
                        }
                    }
                }

                // Ask again. nextMomt may have been set to null in the last statement.
                if (nextMomt === null)
                {
                    stop();
                }

                return nextMomt; // null is stop, end of span
            }

            if (!stopped && !paused)
            {
                if (currentMoment === null || eventIndex >= currentMomentLength)
                {
                    currentMoment = nextMoment();
                    if (currentMoment !== null) // if null, then the performance has stopped
                    {
                        currentMomentLength = currentMoment.events.length; // should never be 0!
                        eventIndex = 0;
                    }
                }
                if (currentMoment !== null)
                {
                    nextEvent = currentMoment.events[eventIndex++];
                }
            }

            return nextEvent;
        },

        // tick() function -- which began as an idea by Chris Wilson
        // Recursive function. Also used by resume(), playSpan()
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
        // The following variables are initialised in playSpan() to start playing that sequence:
        //      event // the first event in the sequence
        //      track attributes:
        //          isPerforming // set by referring to the track control
        //          fromIndex // the index of the first moment in the track to play
        //          toIndex // the index of the final moment in the track (which does not play)
        //          currentIndex // = fromIndex
        //      endMarkerTimestamp // the toMs argument to playSpan()
        //      lastSequenceTimestamp // the largest timestamp in any track (i.e. the end of the sequence)
        //      maxDeviation = 0; // just for console.log
        //      midiOutputDevice // the midi output device
        //      reportEndOfSequence // can be null
        //      reportMsPosition // can be null
        //      domhrtMsNowAtStartOfSequence // system time offset at start of sequence    
        //
        // Synchronizing with the running cursor in the score:
        // reportMsPositionInScore(msPositionInScore) is a callback, set when playSpan() is called. This function
        // increments the cursor position on screen until it reaches the symbol whose position is msPositionInScore.
        // An msPositionInScore attribute exists only on the first event in the first moment in a rest or chord symbol on
        // each track. Note that the cursor can only be updated once per tick.
        tick = function ()
        {
            var
            evt = event, // local variable may be faster
            deviation, PREQUEUE = 0, // that needs to be set to a larger value later. See above.
            domhrtRelativeTime = window.performance.now() - domhrtMsOffsetAtStartOfSequence,
            reported = false,
            delay, domhrtTimestamp;

            if (evt === null)
            {
                console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                return;
            }

            delay = evt.timestamp - domhrtRelativeTime; // compensates for inaccuracies in setTimeout
            //console.log("tick: delay = " + delay);
            // send all events that are due between now and PREQUEUE ms later. 
            while (delay <= PREQUEUE)
            {
                // these values are only used by console.log (See end of file too!)
                deviation = (domhrtRelativeTime - evt.timestamp);
                maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;

                if (reportMsPositionInScore !== undefined && reportMsPositionInScore !== null
                && evt.msPositionInScore !== undefined && reported === false && !thatIsLastMoment)
                {
                    //console.log("Reporting event.msPositionInScore at ", event.msPositionInScore);
                    reportMsPositionInScore(evt.msPositionInScore);
                    reported = true;
                }

                if (evt.isEmpty === undefined) // the first event in a rest symbol can have an isEmpty attribute 
                {
                    // evt.timestamps are measured from the start of the _score_ here, but
                    // Chris says that the sent timestamp should be absolute DOMHRT time
                    // when the event is sent.
                    // Note that Jazz 1.2 always send Events immediately.
                    // Jazz 1.2 does not actually support timestamps.
                    domhrtTimestamp = evt.timestamp + domhrtMsOffsetAtStartOfSequence;
                    midiOutputDevice.send(evt.data, domhrtTimestamp);

                    if (recordingSequence !== undefined && recordingSequence !== null)
                    {
                        // If the evt.timestamps are to be stored in a Standard MIDI File,
                        // they are set relative to the start of the recording in
                        // in the reportEndOfPerformance function.
                        recordingSequence.tracks[evt.channel()].recordEvent(evt);
                    }
                }

                event = nextEvent();
                evt = event;

                if (evt === null)
                {
                    // we're pausing, or have hit the end of the sequence.
                    //console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                    return;
                }
                delay = evt.timestamp - domhrtRelativeTime;
            }

            window.setTimeout(tick, delay);  // that will schedule the next tick.
        },

        // Can only be called when paused is true.
        resume = function ()
        {
            if (paused === true && currentMoment !== null)
            {
                setState("running");
                domhrtMsOffsetAtStartOfSequence = window.performance.now() - currentMoment.timestamp;
                event = nextEvent(); // the very first event after the resume
                if (event === null)
                {
                    // This shouldn't be hit, except for an empty initial sequence
                    return;
                }
                tick();
            }
        },

        // playSpan();
        // Note that the final Moment (at toMs) is often at the final barline
        // (which may or may not contain noteOff Events).
        //
        // trackIsOnArray[trackIndex] returns a boolean which determine whether the track will
        // be played or not. This array belongs to the caller, and is read only.
        //
        // recording is a Sequence to which events are added as they are performed.
        // Can be undefined or null.
        //
        // The reportEndOfSeq argument is a callback function (having no arguments)
        // which is called when the last Event in the sequence or subsequence has been sent.
        // Can be undefined or null.
        //
        // The reportMsPosition argument is a callback function which reports the current
        // msPosition back to the GUI while performing. Can be undefined or null.
        // The msPosition it passes back is the original number of milliseconds
        // from the start of the score. This value is used to identify chord symbols in the
        // score, and so to synchronize the running cursor. It is explicitly different from
        // the timestamp used when sending MidiMessages. The timestamp can change dynamically
        // during an assisted performance (when using durations which are relative to the
        // live performer's durations).
        playSpan = function (midiOutDevice, fromMs, toMs, trackIsOnArray, recording, reportEndOfSeq, reportMsPosition)
        {
            // Called when initiating a performance, but not when resuming.
            // Sets each track's isPerforming attribute. If the track is performing,
            // its fromIndex, currentIndex and toIndex attributes are also set.
            // Note that the final Moment can be at the final barline (noteOffs).
            function setTracks(trackIsOnArray, msOffsetFromStartOfScore, toMs)
            {
                var i, track, nTracks = that.tracks.length,
                    trackMoments, j, trackLength;

                for (i = 0; i < nTracks; ++i)
                {
                    track = that.tracks[i];
                    trackMoments = track.moments;
                    trackLength = trackMoments.length;

                    // trackLength can be 0, if nothing happens during
                    // the track (maybe during a during a subsequence)
                    if (trackLength === 0)
                    {
                        track.isPerforming = false;
                    }
                    else
                    {
                        track.isPerforming = trackIsOnArray[i];
                    }

                    if (track.isPerforming) // trackLength is > 0
                    {
                        for (j = 0; j < trackLength; ++j)
                        {
                            if (trackMoments[j].timestamp >= msOffsetFromStartOfScore)
                            {
                                track.fromIndex = j;
                                break;
                            }
                        }
                        for (j = track.fromIndex; j < trackLength; ++j)
                        {
                            // the track's final position can be the position
                            // of the final barline (noteOffs) 
                            if (trackMoments[j].timestamp <= toMs)
                            {
                                track.toIndex = j;
                            }
                            else
                            {
                                break;
                            }
                        }

                        track.currentIndex = track.fromIndex;
                    }
                }
            }

            // Sets lastSequenceTimestamp to the largest timestamp in any track (i.e. the end of the sequence)
            function setLastSequenceTimeStamp()
            {
                var i, nTracks = that.tracks.length, track,
                lastTrackTimestamp;

                lastSequenceTimestamp = -1;

                for (i = 0; i < nTracks; ++i)
                {
                    track = that.tracks[i];
                    if (track.moments.length > 0)
                    {
                        lastTrackTimestamp = track.moments[track.moments.length - 1].timestamp;
                        lastSequenceTimestamp = (lastSequenceTimestamp > lastTrackTimestamp) ? lastSequenceTimestamp : lastTrackTimestamp;
                    }
                }
            }

            that = this;

            stop(); //  sets state to "stopped" if it isn't already.

            recordingSequence = recording; // can be undefined or null

            if (midiOutDevice === undefined || midiOutDevice === null)
            {
                throw "The midi output device must be defined.";
            }

            midiOutputDevice = midiOutDevice;
            reportEndOfSequence = reportEndOfSeq; // can be null or undefined
            reportMsPositionInScore = reportMsPosition; // can be null or undefined

            setTracks(trackIsOnArray, fromMs, toMs);
            endMarkerTimestamp = toMs;
            setLastSequenceTimeStamp();
            setState("running");

            maxDeviation = 0; // for console.log

            startNow = window.performance.now();
            domhrtMsOffsetAtStartOfSequence = startNow - fromMs;

            event = nextEvent(); // the very first event
            if (event === null)
            {
                // This shouldn't be hit, except for an empty initial sequence
                return;
            }
            tick();
        },

        // When called, sends all the sequence's unsent messages, except noteOns, immediately.
        // These events are not recorded.
        finishSilently = function ()
        {
            var
            i = 0,
            event = nextEvent(),
            now = window.performance.now();

            while (event !== null)
            {
                if (!((event.command() === CMD.NOTE_ON && event.data[2] > 0) || event.isEmpty !== undefined))
                {
                    midiOutputDevice.send(event.data, now);
                    ++i;
                }
                event = nextEvent();
            }
            stop();
            //console.log("sequence finished silently: " + i.toString() + " events sent.");
        },

        publicPrototypeAPI =
        {
            playSpan: playSpan,
            pause: pause,
            resume: resume,
            stop: stop,
            isStopped: isStopped,
            isPaused: isPaused,
            finishSilently: finishSilently
        };

        return publicPrototypeAPI;

    } (window));

    return publicSequenceAPI;

} (window));



