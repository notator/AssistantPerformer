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

JI_NAMESPACE.sequence = (function ()
{
    "use strict";

    var 
    //jiTrack = JI_NAMESPACE.track,
    tracks = [],
    reportEndOfSpan, // compulsory callback. An exception is thrown if reportEndOfSpan is null or undefined
    reportTimestamp, // optional callback. Info used for setting the position of the running cursor in the GUI.
    lastSpanTimestamp,
    lastSequenceTimestamp,
    currentMoment,
    messageIndex,
    currentMomentLength,
    stopped,
    paused,

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


    // Returns the earliest moment indexed by the track.currentIndex indices,
    // or null if track.currentIndex > track.toIndex in all tracks.
    // Moment.messages.length can be 0 (a rest moment).
    nextMoment = function ()
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
    },

    // Returns either the next message in the sequence, 
    // or null if there are no more moments and no more messages.
    // Moments can be empty of MIDIMessages (i.e. be rests), in which case
    // a 'message' is returned having three attributes:
    //     timestamp = moment.timestamp 
    //     isEmpty = true
    //     reportTimestamp = true
    // Otherwise, the message belongs to a MIDIChord.
    // Both the first message in the first moment and the first message in the last moment
    // in each MIDIChord are given a reportTimestamp attribute in the MIDIChord constructor
    // (see jiMIDIChord.js).
    nextMessage = function ()
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
                    nextMsg.reportTimestamp = true; // force this message's timestamp to be reported
                }
            }
        }

        return nextMsg;
    },

    // tick() function, which began as an idea by Chris Wilson
    // Chris: "with a conformant sendMIDIMessage w/ timestamps, PREQUEUE could be set to a larger number like 200."
    // James: (2nd Oct. 2012)
    // This function has become rather complicated, but it has been tested thoroughly as far as possible without
    // having "a conformant sendMIDIMessage w/ timestamps", and appears to be correct.
    // It needs testing again with the conformant sendMIDIMessage and a higher value for PREQUEUE. What would the
    // ideal value for PREQUEUE be? It needs to be small enough for time differences between cursor position and
    // sound to be unnoticeable.
    // Synchronizing with the running cursor in the score:
    // 1. reportTimestamp(timestamp) is an optional callback, set when the performance starts. It moves the cursor
    //    to the next rest or chord symbol in the score (whose timestamp is the one reported).
    // 2. msg is outside tick(). The very first msg in the performance is loaded in another function when the
    //    performance starts. 
    // 3. currentMomentTimestamp is also outside tick(). Is also initialized when the performance starts.
    // 4. timestamps which MUST be reported are now cached inside the while{} loop. (This is done by giving the
    //    appropriate messages a reportTimestamp attribute: Rest "messages" are given this attribute in the
    //    nextMessage() function, the first message in the first and last moments in a MIDIChord are given this
    //    attribute in the MIDIChord constructor.) All the cached timestamps, except the one which will be reported
    //    at the beginning of the next tick, are then reported when the loop exits. In the worst case, the cursor
    //    will advance to the corresponding symbol PREQUEUE milliseconds before the sound is actually heard.
    PREQUEUE = 0,
    maxDeviation, // for console.log, set to 0 when performance starts
    midiOutputDevice, // set when performance starts
    currentMomentTimestamp, // set when performance starts
    performanceStart, // set to true when performance starts 
    domhrtMsOffsetAtStartOfPerformance, // set when performance starts
    msg, // the very first message in a performance is loaded elsewhere (when the performance  starts)
    // msg is never null when tick() is called.

    tick = function ()
    {
        var deviation, i,
        nTimestampsToReport, timeStampsToReport = [],
        domhrtRelativeTime = Math.round(window.performance.webkitNow() - domhrtMsOffsetAtStartOfPerformance),
        delay = msg.timestamp - domhrtRelativeTime;

        if (msg.reportTimestamp !== undefined && msg.timestamp > currentMomentTimestamp && reportTimestamp !== null)
        {
            currentMomentTimestamp = msg.timestamp;
            reportTimestamp(currentMomentTimestamp); // update the cursor for the timestamp which
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
            if (msg.reportTimestamp !== undefined && msg.timestamp > currentMomentTimestamp && reportTimestamp !== null)
            {
                timeStampsToReport.push(msg.timestamp);
            }
            delay = msg.timestamp - domhrtRelativeTime;
        }

        if (timeStampsToReport.length > 0)
        {
            // Report all timestamps which need to be reported, but whose messages were scheduled during
            // the above loop.
            // Note that timeStampsToReport only contains timestamps if they belong to a rest or the first
            // message in the first or last moment in a MIDIChord.
            // Since, when we have a "conformant sendMIDIMessage w/ timestamps", the messages are actually sent
            // to the output device later, this will lead to the GUI cursor position moving to the respective
            // position in the GUI before the sound is actually heard.
            // In the worst case, the cursor will move to its chord or rest PREQUEUE milliseconds before the
            // sound is heard. 
            nTimestampsToReport = timeStampsToReport.length;

            for (i = 0; i < nTimestampsToReport; ++i)
            {
                if (timeStampsToReport[i] < msg.timestamp && timeStampsToReport[i] > currentMomentTimestamp)
                {
                    currentMomentTimestamp = timeStampsToReport[i];
                    reportTimestamp(currentMomentTimestamp);  // updates the cursor position in the score
                    //console.log("After: **** reporting timestamp before its msg is really sent and the sound actually happens ****");
                    //console.log("2: currentMomentTimestamp=" + currentMomentTimestamp + ", next msg.timestamp=" + msg.timestamp);
                }
            }
        }

        window.setTimeout(tick, delay);  // this will schedule the next tick.
    },

    // Called when initiating a performance, but not when resuming.
    // Sets each track's isPerforming attribute. If the track is performing,
    // its fromIndex, currentIndex and toIndex attributes are also set.
    // Note that the final MIDIMoment can be at the final barline (noteOffs).
    setTracks = function (tracksControl, msOffsetFromStartOfScore, toMs)
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
    },

    // Sets lastSpanTimestamp to toMs,
    //  and lastSequenceTimestamp to the largest timestamp in any track (i.e. the end of the sequence)
    setLastTimestamps = function (toMs)
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
    },

    /************************************************************************/
    // public interface

    // Note that the final MIDIMoment (at toMs) is often at the final barline and
    // contains noteOff MIDIMessages.
    //
    // The reportEOS argument is a compulsory callback function (having no arguments)
    // which is called when the last MIDIMessage in the span or sequence has been sent.
    // If the span is set to end after the end of the file, this callback is simply
    // called (without any error) when the last message in the sequence has been sent.
    //
    // The reportMsPosition argument is a callback function which reports the current
    // msPosition back to the GUI while performing.
    // reportMsPosition can be null or undefined, in which case it is simply ignored.
    // Otherwise, the msPosition it passes back is the number of milliseconds from the
    // start of the score, i.e. the original timestamp set in each MIDIMoment and
    // MIDIMessage in the original sequence.
    // The Assistant Performer uses this value to identify chord symbols in the score,
    // and so to synchronize the running cursor.
    playSpan = function (midiOutDevice, fromMs, toMs, tracksControl, reportEOS, reportMsPosition)
    {
        if (midiOutDevice !== null && midiOutDevice !== undefined)
        {
            reportEndOfSpan = reportEOS;
            if (reportMsPosition === undefined || reportMsPosition === null)
            {
                reportTimestamp = null;
            }
            else
            {
                reportTimestamp = reportMsPosition;
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
    },

    // Can only be called when paused is true.
    resume = function ()
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
            throw "Attempt to stop a paused sequence.";
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

    // Can only be called while running
    // (stopped === false && paused === false)
    stop = function ()
    {
        if (stopped === false && paused === false)
        {
            setState("stopped");
        }
        else
        {
            throw "Attempt to stop a stopped sequence.";
        }
    },

    addTrack = function (newTrack)
    {
        tracks.push(newTrack);
    },

    // An empty sequence is created. It contains an empty tracks array.
    Sequence = function ()
    {
        if (!(this instanceof Sequence))
        {
            return new Sequence();
        }

        tracks = [];

        setState("stopped");

        this.addTrack = addTrack; // addTrack(track)

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

} ());
