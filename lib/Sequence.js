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
*      // The point in the score at which this Sequence begins.
*      // This value is set when the Sequence is constructed, and should never change.
*      msPositionInScore
*
*      // add an empty Track to the end of the tracks array
*      addTrack() 
*
*      // Start playing (part of) the Sequence.
*      // Arguments:
*      // midiOutdevice: the output device
*      // fromMs, toMs: the span of the sequence to play (not including toMs)
*      // trackIsOnArray[trackIndex] returns a boolean which determine whether the track will
*      //       be played or not. This array belongs to the caller, and is read only.
*      // reportEndOfSeqCallback: called when the performance ends.
*      // reportMsPositionCallback: called whenever a cursor needs to be updated
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
*
*      // Event timestamps are multiplied by durationFactor.
*      changeEventTimestamps(durationFactor)
*
*      // Event timestamps are set to the value of their moment's timestamp.                                
*      revertEventTimestamps()
*
*      // Returns an array of Sequence. Each sequence in the array is a Sequence whose tracks all
*      // begin at timestamp = 0ms. This Sequence is split at the positions of all rests and chords
*      // to be played by the live performer. See longer comment below.
*      getSubsequences(livePerformersTrackIndex)
*
*      // Returns the first part of a Sequence as a "restSequence" upto (but not including) toMs,
*      // to which a "finalBarline" moment has been added.
*      // The timestamps are relative to the start of that subsequence (i.e. not changed)
*      subsequence = beforeSplit(toMs)
*
*      // Returns a new restSubsequence which starts at fromMs
*      // The timestamps are relative to the start of the new subsequence.
*      subsequence = afterSplit(fromMs)
*
*      // Shifts the pitches in the whole performer's track up or down so that the lowest pitch in the
*      // first noteOn moment is newPitch. Similarly with velocity.
*      // The final four arguments are booleans.
*      overridePitchAndOrVelocity(soloTrackIndex, newPitch, newVelocity,
*                                 overrideSoloPitch, overrideOtherTracksPitch,
*                                 overrideSoloVelocity, overrideOtherTracksVelocity)
*
*      // When called, sends all the sequence's unsent messages, except noteOns, immediately.
*      // Used in an assisted performance, when the live performer starts a new subsequence
*      // while the current one is still playing.
*      finishSilently(),
*
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */


MIDI_API.namespace('MIDI_API.sequence');

MIDI_API.sequence = (function (window)
{
    "use strict";
    var
    CMD = MIDI_API.constants.COMMAND,
    Event = MIDI_API.event.Event,
    Track = MIDI_API.track.Track,

    // An empty sequence is created. It contains an empty array of MIDI_API.track.Tracks.
    Sequence = function (msPosition)
    {
        if (!(this instanceof Sequence))
        {
            return new Sequence(msPosition);
        }

        this.tracks = []; // an array of Tracks
        Object.defineProperty(this, "msPositionInScore", { value: msPosition, writable: false });
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
        tracks, // set to this.tracks in API functions
        msPositionInScore, // set to this.msPositionInScore in API functions

        maxDeviation, // for console.log, set to 0 when performance starts
        midiOutputDevice, // set in Sequence constructor
        reportEndOfSequence, // callback. Can be null. Set in Sequence constructor.
        reportMsPositionInScore, // compulsory callback. Info used for setting the position of the running cursor in the GUI.

        currentMoment = null,
        thatIsLastMoment = false,
        eventIndex = -1,
        currentMomentLength = 0,
        stopped = true,
        paused = false,

        domhrtMsAtStartOfSequence = 0,
        domhrtMsOffsetAtStartOfSequence = 0,

        event = null,

        endMarkerTimestamp = -1,
        lastSequenceTimestamp = -1,
        recordedSequence,

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
            var sequenceMsDuration;

            if (stopped === false)
            {
                setState("stopped");
                if (domhrtMsAtStartOfSequence > 0)
                {
                    sequenceMsDuration = Math.floor(window.performance.now() - domhrtMsAtStartOfSequence);
                    domhrtMsAtStartOfSequence = 0;
                    reportEndOfSequence(recordedSequence, sequenceMsDuration, false);
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

        // Returns either the next event in the sequence, 
        // or null if there are no more moments and no more events.
        // A Moment always has at least one event, since restStart moments now contain either
        // the final events from the previous chord, or an 'empty Event'.
        // (see the MIDIRest constructor and Track.addMoment() ).
        nextEvent = function ()
        {
            var
            nextEvent = null,
            nTracks = tracks.length;

            // Returns the earliest moment indexed by the track.currentIndex indices, or null if
            // track.currentIndex > track.toIndex in all tracks.
            function nextMoment()
            {
                var track, i, nextMomt = null, nextMomentTrackIndex,
                    moment, minTimestamp = Number.MAX_VALUE;

                for (i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
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
                        tracks[nextMomentTrackIndex].currentIndex++;
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
        //      reportMsPosition // compulsory
        //      domhrtMsNowAtStartOfSequence // system time offset at start of sequence    
        //
        // Synchronizing with the running cursor in the score:
        // reportMsPositionInScore(msPositionInScore) is a callback, set when playSpan() is called. This function
        // increments the cursor position on screen until it reaches the symbol whose position is msPositionInScore.
        // An msPositionInScore attribute exists only on the first event in the first moment in a rest or chord symbol on
        // each track. Note that the cursor can only be updated once per tick.
        tick = function ()
        {
            var deviation, PREQUEUE = 0, // that needs to be set to a larger value later. See above.
            domhrtRelativeTime = window.performance.now() - domhrtMsOffsetAtStartOfSequence,
            reported = false,
            delay, domhrtTimestamp;

            if (event === null)
            {
                console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                return;
            }

            delay = event.timestamp - domhrtRelativeTime; // compensates for inaccuracies in setTimeout
            //console.log("tick: delay = " + delay);
            // send all events that are due between now and PREQUEUE ms later. 
            while (delay <= PREQUEUE)
            {
                // these values are only used by console.log (See end of file too!)
                deviation = (domhrtRelativeTime - event.timestamp);
                maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;

                if (event.msPositionInScore !== undefined && reported === false && !thatIsLastMoment)
                {
                    //console.log("Reporting event.msPositionInScore at ", event.msPositionInScore);
                    reportMsPositionInScore(event.msPositionInScore);
                    reported = true;
                }

                if (event.isEmpty === undefined) // the first event in a rest symbol can have an isEmpty attribute 
                {
                    recordedSequence.tracks[event.channel()].addEvent(event, recordedSequence.msPositionInScore);

                    // the sent timestamp needs to be absolute DOMHRT time when the event is sent.
                    // Note that Jazz 1.2 always send Events immediately. Jazz 1.2 does not support timestamps.
                    domhrtTimestamp = event.timestamp += domhrtMsOffsetAtStartOfSequence;
                    midiOutputDevice.send(event.data, domhrtTimestamp);
                }

                event = nextEvent();

                if (event === null)
                {
                    // we're pausing, or have hit the end of the sequence.
                    //console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                    return;
                }
                delay = event.timestamp - domhrtRelativeTime;
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
        // The reportEndOfSeq argument is a callback function (having no arguments)
        // which is called when the last Event in the sequence or subsequence has been sent.
        //
        // The reportMsPosition argument is a callback function which reports the current
        // msPosition back to the GUI while performing.
        // The msPosition it passes back is the original number of milliseconds
        // from the start of the score. This value is used to identify chord symbols in the
        // score, and so to synchronize the running cursor. It is explicitly different from
        // the timestamp used when sending MidiMessages. The timestamp can change dynamically
        // during an assisted performance (when using durations which are relative to the
        // live performer's durations).
        playSpan = function (midiOutDevice, fromMs, toMs, trackIsOnArray, reportEndOfSeq, reportMsPosition)
        {
            var
            i, nTracks = this.tracks.length;

            // Called when initiating a performance, but not when resuming.
            // Sets each track's isPerforming attribute. If the track is performing,
            // its fromIndex, currentIndex and toIndex attributes are also set.
            // Note that the final Moment can be at the final barline (noteOffs).
            function setTracks(trackIsOnArray, msOffsetFromStartOfScore, toMs)
            {
                var i, track, nTracks = tracks.length,
                    trackMoments, j, trackLength;

                for (i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
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

            // Sets endMarkerTimestamp and
            // lastSequenceTimestamp to the largest timestamp in any track (i.e. the end of the sequence)
            // Invoked from sequence
            function setLastSequenceTimeStamp(toMs)
            {
                var i, nTracks = tracks.length, track,
                lastTrackTimestamp;

                endMarkerTimestamp = toMs;
                lastSequenceTimestamp = -1;

                for (i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
                    if (track.moments.length > 0)
                    {
                        lastTrackTimestamp = track.moments[track.moments.length - 1].timestamp;
                        lastSequenceTimestamp = (lastSequenceTimestamp > lastTrackTimestamp) ? lastSequenceTimestamp : lastTrackTimestamp;
                    }
                }
            }

            tracks = this.tracks;
            msPositionInScore = this.msPositionInScore;

            domhrtMsAtStartOfSequence = 0; // stops stop() calling reportEndOfSequence(...)
            stop(); //  sets state to "stopped" if it isn't already.

            recordedSequence = new Sequence(fromMs);
            for (i = 0; i < nTracks; ++i)
            {
                recordedSequence.tracks.push(new Track());
            }

            if (midiOutDevice === undefined || midiOutDevice === null)
            {
                throw "The midi output device must be defined.";
            }

            if (reportMsPosition === undefined || reportMsPosition === null)
            {
                throw "The reportMsPosition callback must be defined.";
            }

            if (reportEndOfSeq === undefined || reportEndOfSeq === null)
            {
                throw "The reportEndOfSequence callback must be defined.";
            }

            midiOutputDevice = midiOutDevice;
            reportEndOfSequence = reportEndOfSeq;
            reportMsPositionInScore = reportMsPosition;

            setTracks(trackIsOnArray, fromMs, toMs);
            setLastSequenceTimeStamp(toMs);
            setState("running");

            maxDeviation = 0; // for console.log

            domhrtMsAtStartOfSequence = window.performance.now();
            domhrtMsOffsetAtStartOfSequence = domhrtMsAtStartOfSequence - fromMs;

            event = nextEvent(); // the very first event
            if (event === null)
            {
                // This shouldn't be hit, except for an empty initial sequence
                return;
            }
            tick();
        },

        // Used in assisted performances having relative durations
        // Event timestamps are multiplied by durationFactor.
        // timestamps on the containiing MidiMoment are unchanged, and are used to revert
        // the event timestamps when the stop button is clicked, or when the performance
        // reaches the end marker. (See revertTimestamps() below)
        changeEventTimestamps = function (durationFactor)
        {
            var
            nTracks = this.tracks.length,
            i, j, k, track, trackLength, moment, events, nEvents, timestamp;

            for (i = 0; i < nTracks; ++i)
            {
                track = this.tracks[i];
                trackLength = track.moments.length;
                for (j = 0; j < trackLength; ++j)
                {
                    moment = track.moments[j];
                    timestamp = moment.timestamp * durationFactor;
                    events = moment.events;
                    nEvents = events.length;
                    for (k = 0; k < nEvents; ++k)
                    {
                        events[k].timestamp = timestamp;
                    }
                }
            }
        },

        // Used in assisted performances having relative durations
        // Event timestamps are set to the value of their moment's timestamp.
        // This function is called when the stop button is clicked, or when the
        // performance reaches the end marker. (See changeEventTimestamps() above)
        revertEventTimestamps = function ()
        {
            var
            nTracks = this.tracks.length,
            i, j, k, track, trackLength, moment, events, nEvents, timestamp;

            for (i = 0; i < nTracks; ++i)
            {
                track = this.tracks[i];
                trackLength = track.moments.length;
                for (j = 0; j < trackLength; ++j)
                {
                    moment = track.moments[j];
                    timestamp = moment.timestamp;
                    events = moment.events;
                    nEvents = events.length;
                    for (k = 0; k < nEvents; ++k)
                    {
                        events[k].timestamp = timestamp;
                    }
                }
            }
        },

        // Returns an array. Each subsequence in the array is a Sequence, whose tracks all begin at timestamp = 0ms.
        // Each subsequence has an msPositionInScore attribute, which is first allocated to empty subsequences, and
        // then used when filling them.
        // A subsequence is first created for each chord or rest symbol and for the final barline in the live performer's track.
        // The final barline has a subsequence with a restSubsequence attribute.
        // A moment which starts a chord sequence has a chordStart attribute (boolean, true).
        // A moment which starts a rest sequence has a restStart attribute (boolean, true).
        // The restStart and chordStart attributes are first allocated in the MIDIChord and MIDIRest constructors, but
        // if two moments have the same timestamp, they can be moved to the previous moment by the Moment.mergeMoment()
        // In practice, that means that restStart moments usually do not just contain an 'empty MIDImessage', they
        // often contain noteOFF events from the final moment of the preceding MIDIChord.  
        // Subsequences corresponding to a live performer's chord are given a chordSubsequence attribute (=true).
        // Subsequences corresponding to a live performer's rest are given a restSubsequence attribute (=true).
        // Consecutive restSubsequences are merged: When performing, consecutive rests in the performer's track are treated
        // as one. The live performer only starts the first one (with a noteOff). Following rests play automatically until
        // the next chord (chordSubsequence) in the performer's track.
        getSubsequences = function (livePerformersTrackIndex)
        {
            var
            nTracks = this.tracks.length,
            subsequences = [], trackIndex;

            // The returned subsequences have a temporary timestamp attribute and
            // either a restSubsequence or a chordSubsequence attribute, 
            // depending on whether they correspond to a live player's rest or chord.
            // The timestamp attribute is deleted in fillSubsequences() below.
            // The subsequences do not yet contain any tracks.
            function getEmptySubsequences(livePerformersTrack)  // 'base' function in outer scope.
            {
                var s, emptySubsequences = [],
                    performersMidiMoments, nPerformersMidiMoments, i,
                    moment;

                performersMidiMoments = livePerformersTrack.moments;
                nPerformersMidiMoments = performersMidiMoments.length;
                for (i = 0; i < nPerformersMidiMoments; ++i)
                {
                    s = null;
                    moment = performersMidiMoments[i];

                    if (moment.restStart !== undefined)
                    {
                        s = new Sequence(moment.events[0].msPositionInScore);
                        s.restSubsequence = true;
                        //console.log("Rest Subsequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }
                    else if (moment.chordStart !== undefined)
                    {
                        s = new Sequence(moment.events[0].msPositionInScore);
                        s.chordSubsequence = true;
                        //console.log("Chord Subsequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }

                    if (s !== null)
                    {
                        emptySubsequences.push(s);
                    }
                }
                return emptySubsequences;
            }

            function fillSubsequences(subsequences, moments)  // 'base' function in outer scope.
            {
                var track,
                    moment, momentsIndex = 0,
                    nMidiMoments = moments.length,
                    subsequence, subsequencesIndex,
                    nSubsequences = subsequences.length, // including the final barline
                    subsequenceMsPositionInScore, nextSubsequenceMsPositionInScore;

                function getNextSubsequenceMsPositionInScore(subsequences, subsequencesIndex, nSubsequences)
                {
                    var nextSubsequenceMsPositionInScore, nextIndex = subsequencesIndex + 1;

                    if (nextIndex < nSubsequences)
                    {
                        nextSubsequenceMsPositionInScore = subsequences[nextIndex].msPositionInScore;
                    }
                    else
                    {
                        nextSubsequenceMsPositionInScore = Number.MAX_VALUE;
                    }

                    return nextSubsequenceMsPositionInScore;
                }

                // nSubsequences includes the final barline (a restSubsequence which may contain noteOff events).
                for (subsequencesIndex = 0; subsequencesIndex < nSubsequences; ++subsequencesIndex)
                {
                    subsequence = subsequences[subsequencesIndex];
                    subsequenceMsPositionInScore = subsequence.msPositionInScore;
                    nextSubsequenceMsPositionInScore = getNextSubsequenceMsPositionInScore(subsequences, subsequencesIndex, nSubsequences);
                    track = new MIDI_API.track.Track();
                    // nMidiMoments may be 0 (an empty track)
                    if (nMidiMoments > 0 && momentsIndex < nMidiMoments)
                    {
                        moment = moments[momentsIndex];
                        while (moment.timestamp < nextSubsequenceMsPositionInScore)
                        {
                            track.addMoment(moment, subsequenceMsPositionInScore);
                            ++momentsIndex;
                            if (momentsIndex === nMidiMoments)
                            {
                                break;
                            }
                            moment = moments[momentsIndex];
                        }
                    }
                    subsequence.addTrack(track);
                }
            }

            // When performing, consecutive rests in the performer's track are treated as one.
            // The live performer only starts the first one (with a noteOff). Following rests
            // play automatically until the next chord in the performer's track.
            function mergeRestSubsequences(subsequences)
            {
                var i, nSubsequences = subsequences.length,
                newSubsequences = [], lastNewS,
                nTracks = tracks.length,
                subS, timeDelta, t, newTrack, trackToAppend, nMoments,
                iMom, newMoment, nEvents, events, iEvt;

                newSubsequences.push(subsequences[0]);

                for (i = 1; i < nSubsequences; ++i)
                {
                    lastNewS = newSubsequences[newSubsequences.length - 1];
                    if (lastNewS.restSubsequence !== undefined && subsequences[i].restSubsequence !== undefined)
                    {
                        subS = subsequences[i];
                        timeDelta = subS.msPositionInScore - lastNewS.msPositionInScore;
                        // append subS to lastnewS
                        for (t = 0; t < nTracks; ++t)
                        {
                            newTrack = lastNewS.tracks[t];
                            trackToAppend = subS.tracks[t];
                            nMoments = trackToAppend.moments.length;
                            for (iMom = 0; iMom < nMoments; ++iMom)
                            {
                                newMoment = trackToAppend.moments[iMom];

                                newMoment.timestamp += timeDelta;
                                nEvents = newMoment.events.length;
                                events = newMoment.events;
                                if (events[0].isEmpty === undefined)
                                {
                                    for (iEvt = 0; iEvt < nEvents; ++iEvt)
                                    {
                                        events[iEvt].timestamp = newMoment.timestamp;
                                    }
                                    newTrack.addMoment(newMoment, 0);
                                }
                            }
                        }
                    }
                    else
                    {
                        newSubsequences.push(subsequences[i]);
                    }
                }

                return newSubsequences;
            }

            tracks = this.tracks;
            msPositionInScore = this.msPositionInScore;

            subsequences = getEmptySubsequences(tracks[livePerformersTrackIndex]);

            for (trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                fillSubsequences(subsequences, tracks[trackIndex].moments);
            }

            subsequences = mergeRestSubsequences(subsequences);

            return subsequences;
        },

        appendFinalBarlineMoment = function (track, sequenceMsPositionInScore, timestamp)
        {
            var i, finalBarlineMoment, restEvt;

            finalBarlineMoment = new MIDI_API.moment.Moment(timestamp);
            finalBarlineMoment.restStart = true;
            // the event will never be sent, because it is given an isEmpty attribute
            restEvt = new Event(CMD.NOTE_OFF + i, 0, 0, timestamp);
            restEvt.msPositionInScore = sequenceMsPositionInScore + timestamp;
            restEvt.isEmpty = true;

            finalBarlineMoment.addEvent(restEvt);

            track.addMoment(finalBarlineMoment, 0);
        },

        // Returns a new restSequence equal to the one upto (but not including) toMs,
        // to which a "finalBarline" moment has been added.
        // The timestamps are relative to the start of this subsequence (i.e. not changed)
        beforeSplit = function (toMs)
        {
            var
            tracks = this.tracks,
            msPositionInScore = this.msPositionInScore,
            nTracks = tracks.length,
            returnSeq = new Sequence(msPositionInScore),
            t, track, newTrack, nMoments, momentToAppend, iMom, limit;

            if (this.restSubsequence === undefined)
            {
                throw "Error: this must be a restSequence.";
            }

            returnSeq.restSubsequence = true;
            limit = toMs - msPositionInScore;

            for (t = 0; t < nTracks; ++t)
            {
                newTrack = new MIDI_API.track.Track();
                track = tracks[t];
                nMoments = track.moments.length;
                for (iMom = 0; iMom < nMoments; ++iMom)
                {
                    momentToAppend = track.moments[iMom];
                    if (momentToAppend.timestamp >= limit)
                    {
                        break;
                    }

                    newTrack.addMoment(momentToAppend, 0);
                }

                appendFinalBarlineMoment(newTrack, msPositionInScore, limit);

                returnSeq.addTrack(newTrack);
            }
            return returnSeq;
        },

        // Returns a new restSubsequence which starts at fromMs
        // The timestamps are relative to the start of the subsequence.
        afterSplit = function (fromMs)
        {
            var
            msPositionInScore = this.msPositionInScore,
            returnSeq = new Sequence(fromMs),
            t, nTracks = this.tracks.length, track,
            newTrack, nMoments, moment, newMoment, event, events,
            iMom, nEvents, iEvt, newEvt, momentI;

            function indexOfLastMomentBeforeFromMs(moments, timestamp)
            {
                var nMoments = moments.length, i, r;
                for (i = nMoments - 1; i >= 0; --i)
                {
                    if (moments[i].timestamp <= timestamp)
                    {
                        r = i;
                        break;
                    }
                }
                return r;
            }

            if (msPositionInScore >= fromMs || this.restSubsequence === undefined)
            {
                throw "Error: this must be a restSequence which begins before the split point.";
            }

            returnSeq.restSubsequence = true;
            returnSeq.msPositionInScore = fromMs;

            for (t = 0; t < nTracks; ++t)
            {
                newTrack = new MIDI_API.track.Track();
                track = this.tracks[t];
                nMoments = track.moments.length;

                newMoment = new MIDI_API.moment.Moment(0);
                newMoment.restStart = true;
                // this event will never be sent, because it is given an isEmpty attribute
                newEvt = new Event(CMD.NOTE_OFF + t, 0, 0, 0); // newEvt.timestamp = 0;
                newEvt.msPositionInScore = msPositionInScore;
                newEvt.isEmpty = true;
                newMoment.addEvent(newEvt);
                newTrack.addMoment(newMoment, 0);

                if (nMoments > 0)
                {
                    momentI = indexOfLastMomentBeforeFromMs(track.moments, fromMs - msPositionInScore);
                    if (momentI === undefined)
                    {
                        // track.moments[0].timestamp was greater than (fromMs - msPositionInScore)
                        // i.e. copy *all* the subsequent events to the new track.
                        momentI = 0;
                    }
                    else if (track.moments[momentI].timestamp + msPositionInScore < fromMs)
                    {
                        ++momentI;
                    }
                    for (iMom = momentI; iMom < nMoments; ++iMom)
                    {
                        moment = track.moments[iMom];
                        events = moment.events;
                        nEvents = moment.events.length;

                        newMoment = new MIDI_API.moment.Moment(moment.timestamp + msPositionInScore - fromMs);
                        if (moment.restStart !== undefined)
                        {
                            newMoment.restStart = true;
                        }
                        else if (moment.chordStart !== undefined)
                        {
                            newMoment.chordStart = true;
                        }

                        for (iEvt = 0; iEvt < nEvents; ++iEvt)
                        {
                            event = events[iEvt];
                            // Event(command+channel, data1, data2, timestamp)
                            newEvt = new Event(event.data[0], event.data[1], event.data[2], newMoment.timestamp);
                            if (event.msPositionInScore !== undefined)
                            {
                                newEvt.msPositionInScore = event.msPositionInScore;
                            }
                            if (event.isEmpty !== undefined)
                            {
                                newEvt.isEmpty = true;
                            }
                            newMoment.addEvent(newEvt);
                        }
                        newTrack.addMoment(newMoment, 0);
                    }
                }
                returnSeq.addTrack(newTrack);
            }

            return returnSeq;

        },

        // Shifts the pitches in the whole performer's track up or down so that the lowest pitch in the
        // first noteOn moment is newPitch. Similarly with velocity.
        overridePitchAndOrVelocity = function (soloTrackIndex, newPitch, newVelocity,
            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            var
            tracks = this.tracks,
            NOTE_ON_CMD = CMD.NOTE_ON,
            track = tracks[soloTrackIndex], event, lowestNoteOnEvt, pitchDelta, velocityDelta;

            // Returns the lowest NoteOn event in the first moment in the track to contain a NoteOnMessage.
            // Returns null if there is no such event.
            function findLowestNoteOnEvt(NOTE_ON_CMD, track)
            {
                var i, j, event, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

                for (i = 0; i < nMoments; ++i)
                {
                    moment = track.moments[i];
                    nEvents = moment.events.length;
                    for (j = 0; j < nEvents; ++j)
                    {
                        event = moment.events[j];
                        if ((event.command() === NOTE_ON_CMD)
                        && (lowestNoteOnMessage === null || event.data[1] < lowestNoteOnMessage.data1))
                        {
                            lowestNoteOnMessage = event;
                        }
                    }
                    if (lowestNoteOnMessage !== null)
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

            function adjustTracks(NOTE_ON_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            {
                var nTracks = tracks.length, i, j, k, nMoments, moment, nEvents;

                for (i = 0; i < nTracks; ++i)
                {
                    if ((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
                    || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
                    {
                        track = tracks[i];
                        nMoments = track.moments.length;

                        for (j = 0; j < nMoments; ++j)
                        {
                            moment = track.moments[j];
                            nEvents = moment.events.length;
                            for (k = 0; k < nEvents; ++k)
                            {
                                event = moment.events[k];
                                if (event.command() === NOTE_ON_CMD)
                                {
                                    event.data[1] = midiValue(event.data[1] + pitchDelta);
                                    event.data[2] = midiValue(event.data[2] + velocityDelta);
                                }
                            }
                        }
                    }
                }
            }

            lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_CMD, track);
            if (lowestNoteOnEvt !== null)
            {
                pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data1) : 0;
                velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data2) : 0;

                if (pitchDelta !== 0 || velocityDelta !== 0)
                {
                    adjustTracks(NOTE_ON_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                        overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);
                }
            }
        },

        // When called, sends all the sequence's unsent messages, except noteOns, immediately.
        finishSilently = function ()
        {
            var 
            silentEvent,
            i = 0,
            event = nextEvent(),
            now = window.performance.now();

            while (event !== null)
            {
                if (!((event.command() === CMD.NOTE_ON && event.data[2] > 0) || event.isEmpty !== undefined))
                {
                    silentEvent = new Event(event.data[0], event.data[1], event.data[2], now);
                    midiOutputDevice.send(silentEvent);
                    ++i;
                }
                event = nextEvent();
            }
            stop();
            //console.log("sequence finished silently: " + i.toString() + " events sent.");
        },

        addTrack = function ()
        {
            this.tracks.push(new Track());
        },

        publicPrototypeAPI =
        {
            playSpan: playSpan,
            pause: pause,
            resume: resume,
            stop: stop,
            isStopped: isStopped,
            isPaused: isPaused,
            changeEventTimestamps: changeEventTimestamps,
            revertEventTimestamps: revertEventTimestamps,
            getSubsequences: getSubsequences,
            beforeSplit: beforeSplit,
            afterSplit: afterSplit,
            overridePitchAndOrVelocity: overridePitchAndOrVelocity,
            finishSilently: finishSilently,
            addTrack: addTrack
        };

        return publicPrototypeAPI;

    } (window));

    return publicSequenceAPI;

} (window));



