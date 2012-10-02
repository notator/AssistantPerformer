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
*  
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
            console.log("End of span.");
            // move the cursor back to the startMarker and set the APControls' state to "stopped"
            reportEndOfSpan(); // a system exception is thrown if reportEndOfSpan is null or undefined
        }
        else
        {
            console.log("next moment.timestamp=" + nextMomt.timestamp);
        }
        return nextMomt; // null is stop, end of span
    },

    // Returns either the next message in the sequence, 
    // or null if there are no more moments and no more messages.
    // Moments can be empty of MIDIMessages (i.e. be rests), in which case
    // an object is returned having two attributes:
    //     timestamp = moment.timestamp, and 
    //     isARest = true.
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
                {
                    nextMsg = {};
                    nextMsg.timestamp = currentMoment.timestamp;
                    nextMsg.isARest = true;
                }
            }
        }

        return nextMsg;
    },

    // tick() function, originally by Chris Wilson
    // Chris: "with a conformant sendMIDIMessage w/ timestamps, PREQUEUE could be set to a larger number like 200."
    // James: Changes (as per 30th Sept. 2012)
    //     1. use calls to nextMessage() instead of having a flat sequence as in the original function.
    //     2. two (cosmetic) name changes:
    //           a) output -> midiOutputDevice.
    //           b) domhrtTimeAtStartOfPerformance to domhrtMsOffsetAtStartOfPerformance.
    //              domhrtMsOffsetAtStartOfPerformance takes starting later in a sequence into account.
    //     3. Synchronization with the running cursor in the score
    //           a) reportTimestamp callback:
    //              1. reportTimestamp is an optional callback, set when the performance starts.
    //              2. msg moved outside tick(). The very first msg in the performance is loaded in another function. 
    //              3. currentMomentTimestamp added outside tick(). Initialized when the performance starts.
    //           b) need to synchronize with rest symbols. (Try playing a single track having simple notes and rests.)
    //              If a MIDIMoment contains no messages, nextMessage() returns a msg having timestamp and isARest
    //              attributes. MIDIMessages having an isARest attribute are not sent to the midiOutputDevice.
    //
    // Issue:
    //   This code depends on PREQUEUE being 0. If PREQUEUE were to be increased, exact synchronization with
    //   the score would deteriorate. There would be no way of knowing exactly when the MIDIMessage is really sent.
    //   Possible solutions:
    //   1. Maybe MIDIMessages could have an optional callback, to be called at the actual send time. But that
    //   would not work for rests. Rests are never actually sent to the MIDI output device.
    //   Maybe we need a wrapper for MIDIMessages, which would include both the callback and the
    //   information that this is an empty message.
    //   2. If MIDI programmers are allowed to set the value of PREQUEUE themselves, then different applications
    //   can be given an optimal value. What, precisely, are the pros and cons of having larger values... 
    //
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
        var deviation,
        domhrtRelativeTime = Math.round(window.performance.webkitNow() - domhrtMsOffsetAtStartOfPerformance),
        delay = msg.timestamp - domhrtRelativeTime;

        if (reportTimestamp !== null && msg.timestamp > currentMomentTimestamp)
        {
            //console.log("sequence.tick()1, calling reportTimestamp(msg.timestamp): currentMomentTimestamp=" +
            //                                                 currentMomentTimestamp + ", msg.timestamp=" + msg.timestamp);
            currentMomentTimestamp = msg.timestamp;
            reportTimestamp(msg.timestamp); // updates the cursor position in the score
        }

        while (delay <= PREQUEUE)
        { // send all messages that are due now.

            // running log
            deviation = (domhrtRelativeTime - msg.timestamp);
            maxDeviation = (deviation > maxDeviation) ? deviation : maxDeviation;
            console.log("timestamp: " + msg.timestamp + ", domhrtTime: " + domhrtRelativeTime + ", deviation: " + deviation);

            if (msg.isARest === undefined)
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
            delay = msg.timestamp - domhrtRelativeTime;
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
    // msPosition while performing.
    // This function can be null or undefined, in which case it is simply ignored.
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
            domhrtMsOffsetAtStartOfPerformance = window.performance.webkitNow() - currentMoment.timestamp;
            setState("running");
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
