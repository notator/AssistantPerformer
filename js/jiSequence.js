/*
*  Copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  jiSequence.js
*  The JI_NAMESPACE.sequence namespace which defines the
*    Sequence(msPositionInScore) empty sequence constructor. 
*/

JI_NAMESPACE.namespace('JI_NAMESPACE.sequence');

JI_NAMESPACE.sequence = (function (window)
{
    "use strict";
    var 
    // An empty sequence is created. It contains an empty tracks array.
    Sequence = function (msPosition)
    {
        if (!(this instanceof Sequence))
        {
            return new Sequence(msPosition);
        }

        this.tracks = [];
        this.msPositionInScore = msPosition;
        // defined in the prototype:
        //      setState(stateString),
        //      playSpan(midiOutDevice, fromMs, toMs, tracksControl, reportEndOfSequence, reportMsPosition)
        //      pause(),
        //      resume(),
        //      stop(),
        //      isStopped(),
        //      isPaused(),
        //      addTrack(newTrack),
        //      changeMessageTimestamps(durationFactor),
        //      getSubsequences(livePerformersTrackIndex)

        this.setState("stopped");
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
        maxDeviation, // for console.log, set to 0 when performance starts
        midiOutputDevice, // set in Sequence constructor
        reportEndOfSpan, // callback. Can be null. Set in Sequence constructor.
        reportMsPositionInScore, // compulsory callback. Info used for setting the position of the running cursor in the GUI.

        currentMoment = null,
        messageIndex = -1,
        currentMomentLength = 0,
        stopped = true,
        paused = false,

        domhrtMsOffsetAtStartOfSequence = 0,
        msg = null,

        lastSpanTimestamp = -1,
        lastSequenceTimestamp = -1,
        tracks = [],

        setState = function (state)
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
        },

        // Returns either the next message in the sequence, 
        // or null if there are no more midiMoments and no more messages.
        // A MIDIMoment always has at least one message, since restStart moments now contain either
        // the final messages from the previous chord, or an 'empty MIDIMessage' (see the MIDIRest
        // constructor and Track.addMIDIMoment()).
        nextMessage = function ()
        {
            var nextMsg = null,
                nTracks = tracks.length,
                track = tracks[0];

            // Returns the earliest moment indexed by the track.currentIndex indices, or null if
            // track.currentIndex > track.toIndex in all tracks.
            function nextMoment()
            {
                var i, nextMomt = null, nextMomentTrackIndex,
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
                    if (reportEndOfSpan !== null)
                    {
                        reportEndOfSpan(); // nothing happens if this is a null function
                    }
                }

                return nextMomt; // null is stop, end of span
            }

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
                        currentMomentLength = currentMoment.messages.length; // should never be 0!
                        messageIndex = 0;
                    }
                }
                if (currentMoment !== null)
                {
                    nextMsg = currentMoment.messages[messageIndex++];
                }
            }

            return nextMsg;
        },

        // tick() function -- which began as an idea by Chris Wilson
        // This function has been tested as far as possible without having "a conformant sendMIDIMessage with timestamps".
        // It needs testing again with the conformant sendMIDIMessage and a higher value for PREQUEUE. What would the
        // ideal value for PREQUEUE be? 
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
        // 16th Nov. 2012: The cursor can only be updated once per tick, so PREQUEUE needs to be small enough for this not
        // to matter.
        //
        // The following variables are initialised in playSpan() to start playing this sequence:
        //      msg // the first message in the sequence
        //      track attributes:
        //          isPerforming // set by referring to the track control
        //          fromIndex // the index of the first moment in the track to play
        //          toIndex // the index of the final moment in the track (which does not play)
        //          currentIndex // = fromIndex
        //      lastSpanTimestamp // the toMs argument to playSpan()
        //      lastSequenceTimestamp // the largest timestamp in any track (i.e. the end of the sequence)
        //      maxDeviation = 0; // just for console.log
        //      midiOutputDevice // the midi output device
        //      reportEndOfSpan // can be null
        //      reportMsPosition // compulsory
        //      domhrtMsOffsetAtStartOfSequence // system time offset at start of sequence    
        //
        // Synchronizing with the running cursor in the score:
        // reportMsPositionInScore(msPositionInScore) is a compulsory callback, set when playSpan() is called. This function
        // increments the cursor position on screen until it reaches the symbol whose position is msPositionInScore.
        // An msPositionInScore attribute exists only on the first message in the first moment in a rest or chord symbol on
        // each track. Note that the cursor can only be updated once per tick.
        tick = function ()
        {
            var deviation, PREQUEUE = 0, // this needs to be set to a larger value later. See comment on tick() function.
            domhrtRelativeTime = Math.round(window.performance.webkitNow() - domhrtMsOffsetAtStartOfSequence),
            reported = false,
            delay;

            if (msg === null)
            {
                console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                return;
            }

            delay = msg.timestamp - domhrtRelativeTime; // compensates for inaccuracies in setTimeout

            // send all messages that are due between now and PREQUEUE ms later. 
            while (delay <= PREQUEUE)
            {
                // these values are only used by console.log (See end of file too!)
                deviation = (domhrtRelativeTime - msg.timestamp);
                maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;

                if (msg.msPositionInScore !== undefined && reported === false)
                {
                    //console.log("Reporting msg.msPositionInScore at ", msg.msPositionInScore);
                    reportMsPositionInScore(msg.msPositionInScore);
                    reported = true;
                }

                if (msg.isEmpty === undefined) // the first message in a rest symbol can have an isEmpty attribute 
                {
                    // sendMIDIMessage needs msg.timestamp to be absolute DOMHRT time.
                    msg.timestamp += domhrtMsOffsetAtStartOfSequence;
                    midiOutputDevice.sendMIDIMessage(msg);
                    // subtract again, otherwise the sequence gets corrupted
                    msg.timestamp -= domhrtMsOffsetAtStartOfSequence;
                }

                msg = nextMessage();

                if (msg === null)
                {
                    // we're pausing, or have hit the end of the sequence.
                    console.log("Pause, or end of sequence.  maxDeviation is " + maxDeviation + "ms");
                    return;
                }
                delay = msg.timestamp - domhrtRelativeTime;
            }

            window.setTimeout(tick, delay);  // this will schedule the next tick.
        },

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
        // The msPosition it passes back is the original number of milliseconds
        // from the start of the score. This value is used to identify chord symbols in the
        // score, and so to synchronize the running cursor. It is explicitly different from
        // the timestamp used when sending MidiMessages. The timestamp can change dynamically
        // during an assisted performance (when using durations which are relative to the
        // live performer's durations).
        playSpan = function (midiOutDevice, fromMs, toMs, tracksControl, reportEndOfSequence, reportMsPosition)
        {
            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.

            // Called when initiating a performance, but not when resuming.
            // Sets each track's isPerforming attribute. If the track is performing,
            // its fromIndex, currentIndex and toIndex attributes are also set.
            // Note that the final MIDIMoment can be at the final barline (noteOffs).
            function setTracks(tracksControl, msOffsetFromStartOfScore, toMs)
            {
                var i, track, nTracks = tracks.length,
                    trackMoments, j, trackLength;

                for (i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
                    trackMoments = track.midiMoments;
                    trackLength = trackMoments.length;

                    if (trackLength === 0) // can happen if nothing happens in the track during the subsequence
                    {
                        track.isPerforming = false;
                    }
                    else
                    {
                        track.isPerforming = tracksControl.trackIsOn(i);
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

            // Sets lastSpanTimestamp and
            // lastSequenceTimestamp to the largest timestamp in any track (i.e. the end of the sequence)
            // Invoked from sequence
            function setLastSequenceTimeStamp(toMs)
            {
                var i, nTracks = tracks.length, track,
                lastTrackTimestamp;

                lastSpanTimestamp = toMs;
                lastSequenceTimestamp = Number.MIN_VALUE;

                for (i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
                    if (track.midiMoments.length > 0)
                    {
                        lastTrackTimestamp = track.midiMoments[track.midiMoments.length - 1].timestamp;
                        lastSequenceTimestamp = (lastSequenceTimestamp > lastTrackTimestamp) ? lastSequenceTimestamp : lastTrackTimestamp;
                    }
                }
            }

            if (midiOutDevice === undefined || midiOutDevice === null)
            {
                throw "The midi output device must be defined.";
            }

            if (reportMsPosition === undefined || reportMsPosition === null)
            {
                throw "The reportMsPosition callback must be defined.";
            }

            midiOutputDevice = midiOutDevice;
            reportEndOfSpan = reportEndOfSequence; // can be null
            reportMsPositionInScore = reportMsPosition;

            setTracks(tracksControl, fromMs, toMs);
            setLastSequenceTimeStamp(toMs);
            setState("running");

            maxDeviation = 0; // for console.log
            domhrtMsOffsetAtStartOfSequence = window.performance.webkitNow() - fromMs;
            msg = nextMessage(); // the very first message
            if (msg === null)
            {
                // This shouldn't be hit, except for an empty initial sequence
                return;
            }
            tick();
        },

        // Can only be called when paused is true.
        resume = function ()
        {
            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.

            if (paused === true && currentMoment !== null)
            {
                setState("running");
                domhrtMsOffsetAtStartOfSequence = window.performance.webkitNow() - currentMoment.timestamp;
                msg = nextMessage(); // the very first message after the resume
                if (msg === null)
                {
                    // This shouldn't be hit, except for an empty initial sequence
                    return;
                }
                tick();
            }
        },

        // Can only be called while running
        // (stopped === false && paused === false)
        pause = function ()
        {
            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.

            if (stopped === false && paused === false)
            {
                setState("paused");
            }
            else
            {
                throw "Attempt to pause a stopped or paused sequence.";
            }
        },

        // Can only be called while running or paused
        // (stopped === false)
        stop = function ()
        {
            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.

            if (stopped === false)
            {
                setState("stopped");
            }
            else
            {
                throw "Attempt to stop a stopped sequence.";
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

        addTrack = function (newTrack)
        {
            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.
            tracks.push(newTrack);
        },

        // Used in assisted performances having relative durations
        // Message timestamps are multiplied by durationFactor.
        // MidiMoment timestamps are unchanged, and are used to revert the message timestamps
        // when the stop button is clicked, or when the performance reaches the end marker.
        // (See revertTimestamps() below)
        changeMessageTimestamps = function (durationFactor)
        {
            var nTracks, i, j, k, track, trackLength, midiMoment, messages, nMessages, timestamp;

            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.
            nTracks = tracks.length;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackLength = track.midiMoments.length;
                for (j = 0; j < trackLength; ++j)
                {
                    midiMoment = track.midiMoments[j];
                    timestamp = midiMoment.timestamp * durationFactor;
                    messages = midiMoment.messages;
                    nMessages = messages.length;
                    for (k = 0; k < nMessages; ++k)
                    {
                        messages[k].timestamp = timestamp;
                    }
                }
            }
        },

        // Used in assisted performances having relative durations
        // Message timestamps are set to the value of their midiMoment's timestamp.
        // This function is called when the stop button is clicked, or when the
        // performance reaches the end marker. (See changeMessageTimestamps() above)
        revertMessageTimestamps = function ()
        {
            var nTracks, i, j, k, track, trackLength, midiMoment, messages, nMessages, timestamp;

            tracks = this.tracks; // invoked only by a Sequence, 'this' is the sequence.
            nTracks = tracks.length;

            for (i = 0; i < nTracks; ++i)
            {
                track = tracks[i];
                trackLength = track.midiMoments.length;
                for (j = 0; j < trackLength; ++j)
                {
                    midiMoment = track.midiMoments[j];
                    timestamp = midiMoment.timestamp;
                    messages = midiMoment.messages;
                    nMessages = messages.length;
                    for (k = 0; k < nMessages; ++k)
                    {
                        messages[k].timestamp = timestamp;
                    }
                }
            }
        },

        // Returns an array. Each subsequence in the array is a Sequence, whose tracks all begin at timestamp = 0ms.
        // Each subsequence has an msPositionInScore attribute, which is first allocated to empty subsequences, and
        // then used when filling them.
        // A subsequence is first created for each chord or rest and for the final barline in the live performer's track.
        // The final barline has a subsequence with a restSubsequence attribute.
        // A midiMoment which starts a chord sequence has a chordStart attribute (boolean, true).
        // A midiMoment which starts a rest sequence has a restStart attribute (boolean, true).
        // The restStart and chordStart attributes are first allocated in the MIDIChord and MIDIRest constructors, but
        // if two moments have the same timestamp, they can be moved to the previous moment by the MIDIMoment.mergeMIDIMoment()
        // In practice, this means that restStart midiMoments usually do not just contain an 'empty MIDImessage', they
        // often contain noteOFF messages from the final midiMoment of the preceding MIDIChord.  
        // Subsequences corresponding to a live performer's chord are given a chordSubsequence attribute (=true).
        // Subsequences corresponding to a live performer's rest are given a restSubsequence attribute (=true).
        // Consecutive restSubsequences are merged: When performing, consecutive rests in the performer's track are treated
        // as one. The live performer only starts the first one (with a noteOff). Following rests play automatically until
        // the next chord (chordSubsequence) in the performer's track.
        getSubsequences = function (livePerformersTrackIndex)
        {
            var subsequences = [],
                tracks = this.tracks, // invoked only by a Sequence, 'this' is the sequence.
                nTracks = tracks.length,
                trackIndex;

            // The returned subsequences have a temporary timestamp attribute and
            // either a restSubsequence or a chordSubsequence attribute, 
            // depending on whether they correspond to a live player's rest or chord.
            // The timestamp attribute is deleted in fillSubsequences() below.
            // The subsequences do not yet contain any tracks.
            function getEmptySubsequences(livePerformersTrack)  // 'base' function in outer scope.
            {
                var s, emptySubsequences = [],
                    performersMidiMoments, nPerformersMidiMoments, i,
                    midiMoment;

                performersMidiMoments = livePerformersTrack.midiMoments;
                nPerformersMidiMoments = performersMidiMoments.length;
                for (i = 0; i < nPerformersMidiMoments; ++i)
                {
                    s = null;
                    midiMoment = performersMidiMoments[i];

                    if (midiMoment.restStart !== undefined)
                    {
                        s = new JI_NAMESPACE.sequence.Sequence(midiMoment.messages[0].msPositionInScore);
                        s.restSubsequence = true;
                        //console.log("Rest Subsequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }
                    else if (midiMoment.chordStart !== undefined)
                    {
                        s = new JI_NAMESPACE.sequence.Sequence(midiMoment.messages[0].msPositionInScore);
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

            function fillSubsequences(subsequences, midiMoments)  // 'base' function in outer scope.
            {
                var track,
                    midiMoment, midiMomentsIndex = 0,
                    nMidiMoments = midiMoments.length,
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

                // nSubsequences includes the final barline (a restSubsequence which may contain noteOff messages).
                for (subsequencesIndex = 0; subsequencesIndex < nSubsequences; ++subsequencesIndex)
                {
                    subsequence = subsequences[subsequencesIndex];
                    subsequenceMsPositionInScore = subsequence.msPositionInScore;
                    nextSubsequenceMsPositionInScore = getNextSubsequenceMsPositionInScore(subsequences, subsequencesIndex, nSubsequences);
                    track = new JI_NAMESPACE.track.Track();
                    // note that nMidiMoments may be 0 (an empty track)
                    if (nMidiMoments > 0 && midiMomentsIndex < nMidiMoments)
                    {
                        midiMoment = midiMoments[midiMomentsIndex];
                        while (midiMoment.timestamp < nextSubsequenceMsPositionInScore)
                        {
                            track.addMIDIMoment(midiMoment, subsequenceMsPositionInScore);
                            ++midiMomentsIndex;
                            if (midiMomentsIndex === nMidiMoments)
                            {
                                break;
                            }
                            midiMoment = midiMoments[midiMomentsIndex];
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
                subS, timeDelta, t, newTrack, oldTrack, nMoments,
                iMom, newMoment, nMessages, messages, iMsg;

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
                            oldTrack = subS.tracks[t];
                            nMoments = oldTrack.midiMoments.length;
                            for (iMom = 0; iMom < nMoments; ++iMom)
                            {
                                newMoment = oldTrack.midiMoments[iMom];

                                newMoment.timestamp += timeDelta;
                                nMessages = newMoment.messages.length;
                                messages = newMoment.messages;
                                if (messages[0].isEmpty === undefined)
                                {
                                    for (iMsg = 0; iMsg < nMessages; ++iMsg)
                                    {
                                        messages[iMsg].timestamp += timeDelta;
                                    }
                                    newTrack.midiMoments.push(newMoment);
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

            subsequences = getEmptySubsequences(tracks[livePerformersTrackIndex]);

            for (trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                fillSubsequences(subsequences, tracks[trackIndex].midiMoments); // 'base' function in outer scope
            }

            subsequences = mergeRestSubsequences(subsequences);

            return subsequences;
        },

        // Shifts the pitches in the whole performer's track up or down so that the lowest pitch in the first noteOn moment is newPitch.
        // Similarly with velocity.
        overridePitchAndOrVelocity = function (NOTE_ON_COMMAND, soloTrackIndex, newPitch, newVelocity,
            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            var track = this.tracks[soloTrackIndex], message, lowestNoteOnMsg, pitchDelta, velocityDelta;

            // Returns the lowest NoteOn message in the first midiMoment in the track to contain a NoteOnMessage.
            // Returns null if there is no such message.
            function findLowestNoteOnMsg(NOTE_ON_COMMAND, track)
            {
                var i, j, message, midiMoment, nMessages, nMoments = track.midiMoments.length, lowestNoteOnMessage = null;

                for (i = 0; i < nMoments; ++i)
                {
                    midiMoment = track.midiMoments[i];
                    nMessages = midiMoment.messages.length;
                    for (j = 0; j < nMessages; ++j)
                    {
                        message = midiMoment.messages[j];
                        if ((message.command === NOTE_ON_COMMAND)
                        && (lowestNoteOnMessage === null || message.data1 < lowestNoteOnMessage.data1))
                        {
                            lowestNoteOnMessage = message;
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

            function adjustTracks(tracks, NOTE_ON_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            {
                var nTracks = tracks.length, i, j, k, nMoments, midiMoment, nMessages;

                for (i = 0; i < nTracks; ++i)
                {
                    if ((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
                    || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
                    {
                        track = tracks[i];
                        nMoments = track.midiMoments.length;

                        for (j = 0; j < nMoments; ++j)
                        {
                            midiMoment = track.midiMoments[j];
                            nMessages = midiMoment.messages.length;
                            for (k = 0; k < nMessages; ++k)
                            {
                                message = midiMoment.messages[k];
                                if (message.command === NOTE_ON_COMMAND)
                                {
                                    message.data1 = midiValue(message.data1 + pitchDelta);
                                    message.data2 = midiValue(message.data2 + velocityDelta);
                                }
                            }
                        }
                    }
                }
            }

            lowestNoteOnMsg = findLowestNoteOnMsg(NOTE_ON_COMMAND, track);
            if (lowestNoteOnMsg !== null)
            {
                pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnMsg.data1) : 0;
                velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnMsg.data2) : 0;

                if (pitchDelta !== 0 || velocityDelta !== 0)
                {
                    adjustTracks(this.tracks, NOTE_ON_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
                        overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);
                }
            }
        },

        finishSilently = function ()
        {
            var message, i = 0, msg = {},
                NOTEON_COMMAND = 0x90;

            message = nextMessage();
            while (message !== null)
            {
                if (!((message.command === NOTEON_COMMAND && message.data2 > 0) || message.isEmpty !== undefined))
                {
                    msg.status = message.status;
                    msg.data1 = message.data1;
                    msg.data2 = message.data2;
                    msg.timestamp = 0;
                    midiOutputDevice.sendMIDIMessage(msg);
                    ++i;
                }
                message = nextMessage();
            }
            console.log("sequence finished silently: " + i.toString() + " messages sent.");
        },

        publicPrototypeAPI =
        {
            setState: setState,
            playSpan: playSpan,
            pause: pause,
            resume: resume,
            stop: stop,
            isStopped: isStopped,
            isPaused: isPaused,
            addTrack: addTrack,
            changeMessageTimestamps: changeMessageTimestamps,
            revertMessageTimestamps: revertMessageTimestamps,
            getSubsequences: getSubsequences,
            overridePitchAndOrVelocity: overridePitchAndOrVelocity,
            finishSilently: finishSilently
        };

        return publicPrototypeAPI;

    } (window));

    return publicSequenceAPI;

} (window));



