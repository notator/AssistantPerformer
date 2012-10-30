/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  jiSequence.js
*  The JI_NAMESPACE.sequence namespace which defines the
*    Sequence() empty sequence constructor.
*
*  A Sequence has the following public interface:
*       addTrack(track)
*       playSpan(midiOutDevice, fromMs, toMs, tracksControl, reportEndOfSpan, reportMsPosition)
*       pause()        
*       resume()
*       stop()
*       isStopped()
*       isPaused()  
*/

JI_NAMESPACE.namespace('JI_NAMESPACE.sequence');

JI_NAMESPACE.sequence = (function (window)
{
    "use strict";

    var // the variables in this (outer) scope are common to all sequences and subsequences  
    jiTrack = JI_NAMESPACE.track,
    reportEndOfSpan, // compulsory callback. An exception is thrown if reportEndOfSpan is null or undefined
    reportMsPositionInScore, // optional callback. Info used for setting the position of the running cursor in the GUI.
    PREQUEUE = 0, // this needs to be set to a larger value later. See comment on tick() function.
    maxDeviation, // for console.log, set to 0 when performance starts
    midiOutputDevice, // set when performance starts

    fillSubsequences = function (subsequences, midiMoments)  // 'base' function in outer scope.
    {
        var track,
            midiMoment, midiMomentsIndex = 0, nMidiMoments,
            subsequence, subsequencesIndex, nSubsequences,
            nextTimestamp;

        function getNextTimestamp(subsequences, subsequencesIndex, nSubsequences)
        {
            var nextTimestamp;

            if (subsequencesIndex < nSubsequences - 1)
            {
                nextTimestamp = subsequences[subsequencesIndex + 1].timestamp;
            }
            else
            {
                nextTimestamp = Number.MAX_VALUE;
            }

            return nextTimestamp;
        }

        function position(midiMoment)
        {
            var timestamp;
            if (midiMoment.messages.length === 0)
            {
                // must have a restStart attribute
                if (midiMoment.restStart === undefined)
                {
                    throw "midiMoment.restStart must be defined if there are no messages.";
                }
                timestamp = midiMoment.timestamp;
            }
            else if (midiMoment.messages.length > 0)
            {
                // midiMoment can be of any type, including restStart
                timestamp = midiMoment.messages[0].timestamp;
            }
            else
            {
                throw "Unknown position.";
            }

            return timestamp;
        }

        function subtractTime(midiMoment, zeroOffsetTime)
        {
            if (midiMoment.messages.length === 0)
            {
                midiMoment.timestamp -= zeroOffsetTime;
            }
            else if (midiMoment.messages.length > 0)
            {
                // midiMoment can be of any type, including restStart
                midiMoment.messages[0].timestamp -= zeroOffsetTime;
            }
        }

        nSubsequences = subsequences.length - 1;
        nMidiMoments = midiMoments.length;
        for (subsequencesIndex = 0; subsequencesIndex < nSubsequences; ++subsequencesIndex)
        {
            nextTimestamp = getNextTimestamp(subsequences, subsequencesIndex, nSubsequences);
            subsequence = subsequences[subsequencesIndex];
            track = new jiTrack.Track();
            midiMoment = midiMoments[midiMomentsIndex++];
            while (midiMomentsIndex < nMidiMoments && position(midiMoment) < nextTimestamp)
            {
                subtractTime(midiMoment, subsequence.timestamp);
                track.addMIDIMoment(midiMoment);
                midiMoment = midiMoments[midiMomentsIndex++];
            }
            subsequence.addTrack(track);
        }
    },

    // An empty sequence is created. It contains an empty tracks array.
    Sequence = function ()
    {
        var tracks = [],

        lastSpanTimestamp,
        lastSequenceTimestamp,
        currentMoment,
        messageIndex,
        currentMomentLength,
        stopped,
        paused,
        currentMomentTimestamp, // set when performance starts
        performanceStart, // set to true when performance starts 
        domhrtMsOffsetAtStartOfPerformance, // set when performance starts
        msg; // the very first message in a performance is loaded elsewhere (when the performance  starts)
        // msg is never null when tick() is called.;

        function setState(state)
        {
            switch (state)
            {
                case "stopped":
                    currentMoment = null;
                    messageIndex = -1;
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
                    throw "Unknown sequencer state!";
            }
        }

        // Returns the earliest moment indexed by the track.currentIndex indices,
        // or null if track.currentIndex > track.toIndex in all tracks.
        // Moment.messages.length can be 0 (a rest moment).
        function nextMoment()
        {
            var i, nTracks = tracks.length,
                track = tracks[0],
                nextMomt = null, nextMomentTrackIndex,
                moment, minTimestamp = Number.MAX_VALUE;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                if (track.isPerforming && track.currentIndex <= track.toIndex) // toIndex is the last valid index
                {
                    moment = track.midiMoments[track.currentIndex];
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
                if (nextMomt.timestamp === lastSpanTimestamp && nextMomt.timestamp < lastSequenceTimestamp)
                {
                    nextMomt = null; // dont perform it, but call reportEndOfSpan() (below) and then stop
                }
                else
                {
                    tracks[nextMomentTrackIndex].currentIndex++;
                }
            }

            // Ask again. nextMomt may have been set to null in the last statement.
            if (nextMomt === null)
            {
                //console.log("End of span.");
                // move the cursor back to the startMarker and set the APControls' state to "stopped"
                reportEndOfSpan(); // a system exception is thrown if reportEndOfSpan is null or undefined
            }

            return nextMomt; // null is stop, end of span
        }

        // Returns either the next message in the sequence, 
        // or null if there are no more midiMoments and no more messages.
        // MidiMoments can be empty of MIDIMessages (i.e. be rests), in which case
        // a 'message' is returned having three attributes:
        //     timestamp = moment.timestamp 
        //     isEmpty = true
        //     msPositionInScore = MidiMoment.msPositionInScore
        // Otherwise, the message belongs to a MIDIChord.
        // Both the first message in the first moment and the first message in the last moment
        // in each MIDIChord are given a msPositionInScore attribute in the MIDIChord constructor
        // (see jiMIDIChord.js).
        function nextMessage()
        {
            var nextMsg = null;
            if (!stopped && !paused)
            {
                if (currentMoment === null || messageIndex >= currentMomentLength)
                {
                    currentMoment = nextMoment();
                    if (currentMoment === null)
                    {
                        setState("stopped");
                    }
                    else
                    {
                        currentMomentLength = currentMoment.messages.length; // can be 0!
                        messageIndex = 0;
                    }
                }
                if (currentMoment !== null)
                {
                    if (currentMomentLength > 0)
                    {
                        nextMsg = currentMoment.messages[messageIndex++];
                    }
                    else
                    {   // a rest
                        nextMsg = {};
                        nextMsg.timestamp = currentMoment.timestamp;
                        nextMsg.isEmpty = true;
                        nextMsg.msPositionInScore = currentMoment.msPositionInScore; // force this message's msPositionInScore to be reported
                    }
                }
            }

            return nextMsg;
        }

        // tick() function -- which began as an idea by Chris Wilson
        // This function has become rather complicated, but it has been tested thoroughly as far as possible without
        // having "a conformant sendMIDIMessage w/ timestamps", and appears to be correct.
        // It needs testing again with the conformant sendMIDIMessage and a higher value for PREQUEUE. What would the
        // ideal value for PREQUEUE be? It needs to be small enough for time differences between cursor position and
        // sound to be unnoticeable.
        // Email correspondence (End of Oct. 2012):
        //      James: "...how do I decide how big PREQUEUE should be?"
        //      Chris: "Well, you're trading off two things:
        //          - 'precision' of visual display (though keep in mind this is fundamentally limited to the 16.67ms tick
        //            of the visual refresh rate (for a 60Hz display) - and this also affects how quickly you can respond
        //            to tempo changes (or stopping/pausing playback).
        //          - reliance on how accurate the setTimeout/setInterval clock is (for this reason alone, the lookahead
        //            probably needs to be >5ms).
        //          So, in short, you'll just have to test on your target systems."
        //      James: "Yes, that's more or less what I thought. I'll start testing with PREQUEUE at 16.67ms."
        //
        // See the conclusion at the end of this comment: "In the worst case, the cursor will advance to the corresponding
        // symbol PREQUEUE milliseconds before the sound is actually heard."
        //
        // Synchronizing with the running cursor in the score:
        // 1. reportMsPositionInScore(msPositionInScore) is an optional callback, set when the performance starts.
        //    It moves the cursor to the next rest or chord symbol in the score (whose msPosition is the one reported).
        // 2. msg is outside tick(). The very first msg in the performance is loaded in another function when the
        //    performance starts. 
        // 3. currentMomentTimestamp is also outside tick(). Is also initialized when the performance starts.
        // 4. msPositionInScore attributes, which MUST be reported, are now cached inside the while{} loop.
        //    (Rest "messages" are given this attribute in the nextMessage() function, the first message in the first and
        //    last midiMoments in a MIDIChord are given this attribute in the MIDIChord constructor.)
        //    All the cached msPositionInScore attributes, except the one which will be reported at the beginning of the
        //    next tick, are then reported when the loop exits.
        //    In the worst case, the cursor will advance to the corresponding symbol PREQUEUE milliseconds before the sound
        //    is actually heard.
        function tick()
        {
            var deviation, i,
            nMsPositionsToReport, msPositionsToReport = [],
            domhrtRelativeTime = Math.round(window.performance.webkitNow() - domhrtMsOffsetAtStartOfPerformance),
            delay = msg.timestamp - domhrtRelativeTime;

            if (msg.msPositionInScore !== undefined && msg.timestamp > currentMomentTimestamp && reportMsPositionInScore !== null)
            {
                currentMomentTimestamp = msg.timestamp;
                reportMsPositionInScore(msg.msPositionInScore); // update the cursor for the timestamp which
                // is going to be scheduled for currentMomentTimestamp (i.e. sent immediately, now)
                //console.log("1: timestamp reported, currentMomentTimestamp now=" + currentMomentTimestamp);
            }

            // send all messages that are due between now and PREQUEUE ms later.
            // delay is (msg.timestamp - domhrtRelativeTime) -- which compensates for inaccuracies in setTimeout
            while (delay <= PREQUEUE)
            {
                // these values are only used by console.log (See end of file too!)
                deviation = (domhrtRelativeTime - msg.timestamp);
                maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;
                //console.log("timestamp: " + msg.timestamp + ", domhrtTime: " + domhrtRelativeTime + ", deviation: " + deviation);

                if (msg.isEmpty === undefined)
                {
                    // sendMIDIMessage needs msg.timestamp to be absolute DOMHRT time.
                    msg.timestamp += domhrtMsOffsetAtStartOfPerformance;
                    midiOutputDevice.sendMIDIMessage(msg);
                    // subtract again, otherwise the sequence gets corrupted
                    msg.timestamp -= domhrtMsOffsetAtStartOfPerformance;
                }

                msg = nextMessage();

                if (msg === null)
                {
                    // we're pausing, or have hit the end of the sequence.
                    console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                    return;
                }
                if (msg.msPositionInScore !== undefined && msg.timestamp > currentMomentTimestamp && reportMsPositionInScore !== null)
                {
                    msPositionsToReport.push(msg);
                }
                delay = msg.timestamp - domhrtRelativeTime;
            }

            if (msPositionsToReport.length > 0)
            {
                // Report all timestamps which need to be reported, but whose messages were scheduled during
                // the above loop.
                // Note that msPositionsToReport only contains timestamps if they belong to a rest or the first
                // message in the first or last moment in a MIDIChord.
                // Since, when we have a "conformant sendMIDIMessage w/ timestamps", the messages are actually sent
                // to the output device later, this will lead to the GUI cursor position moving to the respective
                // position in the GUI before the sound is actually heard.
                // In the worst case, the cursor will move to its chord or rest PREQUEUE milliseconds before the
                // sound is heard. 
                nMsPositionsToReport = msPositionsToReport.length;

                for (i = 0; i < nMsPositionsToReport; ++i)
                {
                    if (msPositionsToReport[i].timestamp < msg.timestamp && msPositionsToReport[i].timestamp > currentMomentTimestamp)
                    {
                        currentMomentTimestamp = msPositionsToReport[i].timestamp;
                        reportMsPositionInScore(msPositionsToReport[i].msPositionInScore);  // updates the cursor position in the score
                        //console.log("After: **** reporting timestamp before its msg is really sent and the sound actually happens ****");
                        //console.log("2: currentMomentTimestamp=" + currentMomentTimestamp + ", next msg.timestamp=" + msg.timestamp);
                    }
                }
            }

            window.setTimeout(tick, delay);  // this will schedule the next tick.
        }

        // Called when initiating a performance, but not when resuming.
        // Sets each track's isPerforming attribute. If the track is performing,
        // its fromIndex, currentIndex and toIndex attributes are also set.
        // Note that the final MIDIMoment can be at the final barline (noteOffs).
        function setTracks(tracksControl, msOffsetFromStartOfScore, toMs)
        {
            var i, nTracks = tracks.length, track,
            trackMoments, j, trackLength;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackMoments = track.midiMoments;
                trackLength = trackMoments.length;

                track.isPerforming = tracksControl.trackIsOn(i);
                if (track.isPerforming)
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

        // Sets lastSpanTimestamp to toMs,
        //  and lastSequenceTimestamp to the largest timestamp in any track (i.e. the end of the sequence)
        function setLastTimestamps(toMs)
        {
            var i, nTracks = tracks.length, track,
            trackMoments, trackLength,
            lastTrackTimestamp;

            lastSpanTimestamp = toMs;
            lastSequenceTimestamp = Number.MIN_VALUE;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackMoments = track.midiMoments;
                trackLength = trackMoments.length;
                lastTrackTimestamp = trackMoments[trackLength - 1].timestamp;
                lastSequenceTimestamp = (lastSequenceTimestamp > lastTrackTimestamp) ? lastSequenceTimestamp : lastTrackTimestamp;
            }
        }

        // playSpan();
        // Note that the final MIDIMoment (at toMs) is often at the final barline
        // (which may or may not contain noteOff MIDIMessages).
        //
        // The reportEOS argument is a compulsory callback function (having no arguments)
        // which is called when the last MIDIMessage in the span or sequence has been sent.
        // If the span is set to end after the end of the sequence, this callback is simply
        // called (without any error) when the last message in the sequence has been sent.
        //
        // The reportMsPosition argument is a callback function which reports the current
        // msPosition back to the GUI while performing.
        // reportMsPosition can be null or undefined, in which case it is simply ignored.
        // Otherwise, the msPosition it passes back is the original number of milliseconds
        // from the start of the score. This value is used to identify chord symbols in the
        // score, and so to synchronize the running cursor. It is explicitly different from
        // the timestamp used when sending MidiMessages. The timestamp can change dynamically
        // during an assisted performance (when using durations which are relative to the
        // live performer's durations).
        function playSpan(midiOutDevice, fromMs, toMs, tracksControl, reportEOS, reportMsPosition)
        {
            if (midiOutDevice !== null && midiOutDevice !== undefined)
            {
                reportEndOfSpan = reportEOS;
                if (reportMsPosition === undefined || reportMsPosition === null)
                {
                    reportMsPositionInScore = null;
                }
                else
                {
                    reportMsPositionInScore = reportMsPosition;
                }

                setTracks(tracksControl, fromMs, toMs);
                setLastTimestamps(toMs);
                setState("running");

                maxDeviation = 0; // for console.log
                midiOutputDevice = midiOutDevice;
                currentMomentTimestamp = fromMs;
                performanceStart = true;
                domhrtMsOffsetAtStartOfPerformance = window.performance.webkitNow() - fromMs;
                msg = nextMessage(); // the very first message
                if (msg === null)
                {
                    // This shouldn't be hit, except for an empty initial sequence
                    return;
                }
                tick();
            }
        }

        // Can only be called when paused is true.
        function resume()
        {
            if (paused === true && currentMoment !== null)
            {
                setState("running");
                domhrtMsOffsetAtStartOfPerformance = window.performance.webkitNow() - currentMoment.timestamp;
                msg = nextMessage(); // the very first message after the resume
                if (msg === null)
                {
                    // This shouldn't be hit, except for an empty initial sequence
                    return;
                }
                tick();
            }
        }

        // Can only be called while running
        // (stopped === false && paused === false)
        function pause()
        {
            if (stopped === false && paused === false)
            {
                setState("paused");
            }
            else
            {
                throw "Attempt to pause a stopped or paused sequence.";
            }
        }

        function isStopped()
        {
            return stopped === true;
        }

        function isPaused()
        {
            return paused === true;
        }

        // Can only be called while running or paused
        // (stopped === false)
        function stop()
        {
            if (stopped === false)
            {
                setState("stopped");
            }
            else
            {
                throw "Attempt to stop a stopped sequence.";
            }
        }

        function addTrack(newTrack)
        {
            tracks.push(newTrack);
        }

        // used in assisted performances having relative durations
        function totalMsDuration()
        {
            var nTracks = tracks.length,
                i,
                trackMsDuration,
                msDuration = 0.0;

            for (i = 0; i < nTracks; ++i)
            {
                trackMsDuration = tracks[i].midiMoments[tracks[i].midiMoments.length - 1].timestamp;
                msDuration = (msDuration > trackMsDuration) ? msDuration : trackMsDuration;
            }
            return msDuration;
        }

        // used in assisted performances having relative durations
        function changeSpeed(speed)
        {
            var nTracks = tracks.length,
                i, j, track, trackLength, midiMoment;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackLength = track.midiMoments.length;
                for (j = 0; j < trackLength; ++j)
                {
                    midiMoment = track.midiMoments[j];
                    midiMoment.timestamp *= speed;
                }
            }
        }

        // Returns an array. Each subsequence in the array is a Sequence, beginning (as all Sequences do) at timestamp = 0ms.
        // A subsequence exists for each chord or rest and for the final barline in the live performer's track.
        // The final barline has a subsequence with a restSubsequence attribute.
        // A midiMoment which starts a chord sequence has a chordStart attribute.
        // A midiMoment which starts a rest sequence has a restStart attribute.
        // The restStart and chordStart attributes are first allocated in the MIDIChord and MIDIRest constructors. These
        // attributes may be transferred in Track.addMIDIMoment(), so restStart midiMoments are not necessarily empty.
        // Subsequences corresponding to a live performer's chord are given a chordSubsequence attribute (=true).
        // Subsequences corresponding to a live performer's rest are given a restSubsequence attribute (=true).
        function getSubsequences(livePerformersTrackIndex)
        {
            var subsequences = [], nSubsequences,
            i, trackIndex, nTracks;

            // The returned subsequences have a temporary timestamp attribute and
            // either a restSubsequence or a chordSubsequence attribute, 
            // depending on whether they correspond to a live player's rest or chord.
            // The timestamp attribute is deleted in fillSubsequences() below.
            // The subsequences do not yet contain any tracks.
            function getEmptySubsequences(livePerformersTrack)
            {
                var s, emptySubsequences = [],
                    performersMidiMoments, nPerformersMidiMoments, i,
                    midiMoment, timestamp;

                performersMidiMoments = livePerformersTrack.midiMoments;
                nPerformersMidiMoments = performersMidiMoments.length;
                for (i = 0; i < nPerformersMidiMoments; ++i)
                {
                    midiMoment = performersMidiMoments[i];
                    if (midiMoment.restStart !== undefined)
                    {
                        s = new Sequence();
                        if (midiMoment.messages.length > 0)
                        {
                            timestamp = midiMoment.messages[0].timestamp;
                            console.log("Rest Subsequence: timestamp=" + timestamp.toString() + " (empty)");
                        }
                        else
                        {
                            timestamp = midiMoment.timestamp;
                            console.log("Rest Subsequence: timestamp=" + timestamp.toString() + " (not empty)");
                        }
                        s.restSubsequence = true;
                        s.timestamp = timestamp;
                        emptySubsequences.push(s);
                    }
                    else if (midiMoment.chordStart !== undefined)
                    {
                        s = new Sequence();
                        s.chordSubsequence = true;
                        s.timestamp = midiMoment.messages[0].timestamp;
                        emptySubsequences.push(s);
                        console.log("Chord Subsequence: timestamp=" + s.timestamp.toString());
                    }
                }
                return emptySubsequences;
            }

            subsequences = getEmptySubsequences(tracks[livePerformersTrackIndex]);

            nTracks = tracks.length;
            for (trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                fillSubsequences(subsequences, tracks[trackIndex].midiMoments); // 'base' function in outer scope
            }

            nSubsequences = subsequences.length;
            for (i = 0; i < nSubsequences; ++i)
            {
                delete subsequences[i].timestamp;
            }

            return subsequences;
        }

        if (!(this instanceof Sequence))
        {
            return new Sequence();
        }

        tracks = [];

        setState("stopped");

        this.addTrack = addTrack; // addTrack(track)

        // These three functions are used in assisted performances
        this.totalMsDuration = totalMsDuration; // totalMsDuration()
        this.changeSpeed = changeSpeed; // changeSpeed(speed)
        this.getSubsequences = getSubsequences; // getSubsequences(livePerformersTrackIndex)

        this.playSpan = playSpan; // playSpan(midiOutDevice, fromMs, toMs, tracksControl, reportEndOfSpan, reportMsPosition)

        this.pause = pause; // pause()        
        this.resume = resume; // resume()
        this.stop = stop; // stop()

        this.isStopped = isStopped; // isStopped()
        this.isPaused = isPaused; // isPaused()
    },

    publicAPI =
    {
        // creates an empty sequence
        Sequence: Sequence
    };
    // end var

    return publicAPI;

} (window));
