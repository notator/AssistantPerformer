/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Performer.js
*  The _AP.player namespace which defines
*
*    // initialization
*    init()
*
*    //  returns an object contining the start and end positions of the player's current segment
*    currentSegmentBounds()
*
*    // message handler for input devices
*    handleMIDIInputEvent(msg)
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

_AP.namespace('_AP.player');

_AP.player = (function()
{
    "use strict";

    // begin var
    var
    Message = _AP.message.Message,
    CMD = _AP.constants.COMMAND,
    CTL = _AP.constants.CONTROL,
    Track = _AP.track.Track,

    //Moment = _AP.moment.Moment,

    // the following are set in init() (used by Sequence.play())
    options, // the options set in Controls.js and passed as the first argument to Sequence.play(...)
    midiOutputDevice,
    tracks, // sequence.tracks
    performersSpeedOptions, // is undefined in performerless performances

    segmentStartIndex = 0, // an index in the performersMsPositionsInScore array (updated when a NoteOn is received)
    performersMsPositionsInScore, // a flat, ordered array containing the msPositions of the live performer's MidiObjects -- set in init(...).

    /******************************/
    /* from old Sequence file     */
    midiObjectMsPositionsInScoreIndex = 0, // the current index in the following array
    midiObjectMsPositionsInScore = [], // a flat, ordered array of msPositions

    currentSegmentMsStartPositionInScore = 0,

    speedFactor = 1.0, // nextMoment()
    previousTimestamp = null, // nextMoment()
    previousMomtMsPosInScore = 0, // nextMoment()
    currentMoment = null, // nextMoment(), resume(), tick()

    // used by setState()
    pausedMoment = null, // set by pause(), used by resume()
    stopped = true, // nextMoment(), stop(), pause(), resume(), isStopped()
    paused = false, // nextMoment(), pause(), isPaused()

    maxDeviation, // for //console.log, set to 0 when performance starts
    reportEndOfSpan, // callback. Can be null or undefined. Set in play().
    reportMsPositionInScore,  // callback. Can be null or undefined. Set in play().
    lastReportedMsPosition = -1, // set by tick() used by nextMoment()
    msPositionToReport = -1,   // set in nextMoment() and used/reset by tick()

    // (performance.now() - performanceStartTime) is the time elapsed since the start of the performance.
    // (performance.now() - segmentStartTime) is the time elapsed since the start of the performance or the last NoteOn in a live performance.
    performanceStartTime = -1,  // set in play(), used by stop(), run()
    segmentStartTime = -1, // set in play() and while performing live. Used in NextMoment
    pauseStartTime = -1, // the performance.now() time at which the performance was paused.

    sequenceRecording, // the sequence being recorded. set in play() and resume(), used by tick()

    /******************************/
    /* functions                  */

    // This function is ALWAYS called, even if there is no input device set in the input device selector.
    // If there is no live performer (apOptions.performersTrackIndex is then null),
    // performersMsPositionsInScore will contains just two values: the startMarkerMsPosition
    // and endMarkerMsPosition. Otherwise it contains all the live performer's midiObject.msPositionInScore
    // values that are >= startMarkerMsPosition and <= endMarkerMsPosition.
    init = function(apOptions, sequenceTracks, startMarkerMsPosition, endMarkerMsPosition)
    {
        var
        i,
        midiObjects,
        positions = [],
        performersTrackIndex = apOptions.performersTrackSelectorIndex;

        // namespace variables
        options = apOptions;
        midiOutputDevice = options.outputDevice;
        tracks = sequenceTracks;

        speedFactor = 1.0; // default speed at start of a performance

        segmentStartIndex = 0;

        if(!options.livePerformance)
        {
            // There is no live performer
            positions.push(startMarkerMsPosition);
            positions.push(endMarkerMsPosition);
        }
        else if(performersTrackIndex >= 0 && performersTrackIndex < tracks.length)
        {
            performersSpeedOptions = options.runtimeOptions.speed; // options.runtimeOptions is undefined in performerless performances

            midiObjects = tracks[performersTrackIndex].midiObjects;
            for(i = 0; i < midiObjects.length; ++i)
            {
                if(midiObjects[i].msPositionInScore >= startMarkerMsPosition)
                {
                    positions.push(midiObjects[i].msPositionInScore);
                }
                if(midiObjects[i].msPositionInScore === endMarkerMsPosition)
                {
                    break;
                }
            }
        }
        else
        {
            throw "Error: Illegal live performer's track index!";
        }

        performersMsPositionsInScore = positions;
    },

    currentSegmentBounds = function()
    {
        var
        bounds = {},
        startIndex = segmentStartIndex,
        endIndex = startIndex + 1;

        if(startIndex < performersMsPositionsInScore.length)
        {
            bounds.msStartPositionInScore = performersMsPositionsInScore[startIndex];
        }
        if(endIndex < performersMsPositionsInScore.length)
        {
            bounds.msEndPositionInScore = performersMsPositionsInScore[endIndex];
        }
        return bounds;
    },

    // copy and adapt this function from Assistant.js
    handleMIDIInputEvent = function(msg)
    {
        //throw "Not implemented exception!";

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

            throw "Not implemented exception.";

            // performersSpeedOptions is undefined in performerless performances

            //if(performersSpeedOptions !== undefined && currentIndex >= 0
            //    && performersSpeedOptions.controllerIndex !== undefined && performersSpeedOptions.controllerIndex === receivedCommandIndexInHTMLMenu
            //    && performersSpeedOptions.fasterRoot !== undefined && performersSpeedOptions.slowerRoot !== undefined)
            //{
            //    speedFactor = getSpeedFactor(performersSpeedOptions.fasterRoot, performersSpeedOptions.slowerRoot, controllerValue);
            //}
        }

        function handleController(runtimeTrackOptions, controlData, value, usesSoloTrack, usesOtherTracks)
        {
            throw "Not implemented exception.";
            //var
            //i,
            //nTracks = allSequences[0].tracks.length,
            //now = performance.now(),
            //trackMoments, nMoments, moment, track;

            //// Returns a new array of (synchronous) trackMoments.
            //// Each trackMoment.moment is a Moment whose .messages attribute contains one message,
            //// trackMoment.trackIndex is the moment's track index (=channel).
            //function getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks)
            //{
            //    var
            //    i, trackMoments = [], trackMoment,
            //    livePerformersTrackIndex = runtimeTrackOptions.livePerformersTrackIndex;

            //    // returns null if no new trackMoment is created.
            //    function newTrackMoment(runtimeTrackOptions, controlData, trackIndex, value)
            //    {
            //        var message, moment = null, trackMoment = null;

            //        // runtimeTrackOptions is a pointer to the runtimeTrackOptions attribute of the global options object.
            //        // The runtimeTrackOptions has the following attributes:
            //        //      trackMinVolumes -- an array of integers in the range 0..127, one value per track.
            //        //      trackScales -- an array of floats in the range 0.0..1.0, one value per track.
            //        // controlData is the controlData received from the live performer (via the controlSelector pop-ups).
            //        // value is the control value received from the live performer.
            //        // trackIndex is the new message's trackIndex (is used to index the arrays in runtimeTrackOptions).
            //        // Returns null if no message is created for some reason.
            //        function newControlMessage(runtimeTrackOptions, controlData, value, trackIndex)
            //        {
            //            var
            //            CMD = _AP.constants.COMMAND,
            //            message = null,
            //            minVolume, scale;

            //            if(controlData.midiControl !== undefined) // a normal control
            //            {
            //                if(controlData.midiControl === _AP.constants.CONTROL.VOLUME)
            //                {
            //                    minVolume = runtimeTrackOptions.minVolumes[trackIndex];
            //                    scale = runtimeTrackOptions.scales[trackIndex];
            //                    value = Math.floor(minVolume + (value * scale));
            //                }
            //                // for other controls, value is unchanged
            //                message = new Message(CMD.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
            //            }
            //            else if(controlData.command !== undefined)
            //            {
            //                switch(controlData.command)
            //                {
            //                    case CMD.AFTERTOUCH:
            //                        if(currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
            //                        {
            //                            message = new Message(CMD.AFTERTOUCH + trackIndex, currentLivePerformersKeyPitch, value);
            //                        }
            //                        break;
            //                    case CMD.CHANNEL_PRESSURE:
            //                        message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value, 0);
            //                        break;
            //                    case CMD.PITCH_WHEEL:
            //                        // value is inputEvent.data[2]
            //                        message = new Message(CMD.PITCH_WHEEL + trackIndex, 0, value);
            //                        break;
            //                    default:
            //                        break;
            //                }
            //            }

            //            return message;
            //        }

            //        message = newControlMessage(runtimeTrackOptions, controlData, value, trackIndex);
            //        if(message !== null)
            //        {
            //            moment = new Moment(_AP.moment.UNDEFINED_TIMESTAMP);  // moment.msPositionInScore becomes UNDEFINED_TIMESTAMP
            //            moment.messages.push(message);
            //            trackMoment = {};
            //            trackMoment.moment = moment;
            //            trackMoment.trackIndex = trackIndex;
            //        }
            //        return trackMoment;
            //    }

            //    if(usesSoloTrack && usesOtherTracks)
            //    {
            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            if(trackIsOnArray[i])
            //            {
            //                trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
            //                if(trackMoment !== null)
            //                {
            //                    trackMoments.push(trackMoment);
            //                }
            //            }
            //        }
            //    }
            //    else if(usesSoloTrack)
            //    {
            //        trackMoment = newTrackMoment(runtimeTrackOptions, controlData, livePerformersTrackIndex, value);
            //        if(trackMoment !== null)
            //        {
            //            trackMoments.push(trackMoment);
            //        }
            //    }
            //    else if(usesOtherTracks)
            //    {
            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            if(trackIsOnArray[i] && i !== livePerformersTrackIndex)
            //            {
            //                trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
            //                if(trackMoment !== null)
            //                {
            //                    trackMoments.push(trackMoment);
            //                }
            //            }
            //        }
            //    }
            //    else
            //    {
            //        throw "Either usesSoloTrack or usesOtherTracks must be set here.";
            //    }

            //    return trackMoments;
            //}

            //trackMoments = getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks);
            //nMoments = trackMoments.length;
            //for(i = 0; i < nMoments; ++i)
            //{
            //    track = recordingSequence.tracks[trackMoments[i].trackIndex];

            //    if(track.isInChord !== undefined) // track.isInChord is defined in track.addLiveScoreMoment()
            //    {
            //        moment = trackMoments[i].moment;
            //        if(recordingSequence !== undefined && recordingSequence !== null)
            //        {
            //            moment.timestamp = now;
            //            track.addLivePerformersControlMoment(moment);
            //        }

            //        outputDevice.send(moment.messages[0].data, now);
            //    }
            //}
        }

        function handleNoteOn(inputEvent, overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            segmentStartIndex++;

            //var
            //allSubsequences = performedSequences;

            //// Shifts the pitches in the subsequence up or down so that the lowest pitch in the
            //// first noteOn moment is newPitch. Similarly with velocity.
            //function overridePitchAndOrVelocity(allSubsequences, currentSubsequenceIndex, soloTrackIndex, newPitch, newVelocity,
            //    overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            //{
            //    var
            //    subsequence = allSubsequences[currentSubsequenceIndex],
            //    NOTE_ON_CMD = _AP.constants.COMMAND.NOTE_ON,
            //    NOTE_OFF_CMD = _AP.constants.COMMAND.NOTE_OFF,
            //    track = subsequence.tracks[soloTrackIndex], message, lowestNoteOnEvt, pitchDelta, velocityDelta,
            //    hangingScorePitchesPerTrack;

            //    // Returns the lowest NoteOn message in the first moment in the track to contain a NoteOnMessage.
            //    // Returns null if there is no such message.
            //    function findLowestNoteOnEvt(NOTE_ON_CMD, track)
            //    {
            //        var i, j, message, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

            //        for(i = 0; i < nMoments; ++i)
            //        {
            //            moment = track.moments[i];
            //            nEvents = moment.messages.length;
            //            for(j = 0; j < nEvents; ++j)
            //            {
            //                message = moment.messages[j];
            //                if((message.command() === NOTE_ON_CMD)
            //                && (lowestNoteOnMessage === null || message.data[1] < lowestNoteOnMessage.data[1]))
            //                {
            //                    lowestNoteOnMessage = message;
            //                }
            //            }
            //            if(lowestNoteOnMessage !== null)
            //            {
            //                break;
            //            }
            //        }
            //        return lowestNoteOnMessage;
            //    }

            //    function midiValue(value)
            //    {
            //        var result = (value >= 0) ? value : 0;
            //        result = (value <= 127) ? value : 127;
            //        return result;
            //    }

            //    // Adjusts the noteOn and noteOff messages inside this subsequence
            //    // Either returns an array of arrays, or null.
            //    // The returned array[track] is an array containing the score pitches which have not been turned off in each track.
            //    // null is returned if all the pitches which are turned on inside the subsequence are also turned off inside the subsequence.
            //    function adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
            //        overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            //    {
            //        var nTracks = subsequence.tracks.length, i, j, k, nMoments, moment, nEvents, index, nPitches,
            //            pendingScorePitchesPerTrack = [], returnPendingScorePitchesPerTrack = [], pendingPitches = false;

            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            pendingScorePitchesPerTrack.push([]);

            //            if((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
            //            || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
            //            {
            //                track = subsequence.tracks[i];
            //                nMoments = track.moments.length;

            //                for(j = 0; j < nMoments; ++j)
            //                {
            //                    moment = track.moments[j];
            //                    nEvents = moment.messages.length;
            //                    for(k = 0; k < nEvents; ++k)
            //                    {
            //                        message = moment.messages[k];
            //                        if(message.command() === NOTE_ON_CMD)
            //                        {
            //                            index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
            //                            if(index === -1)
            //                            {
            //                                pendingScorePitchesPerTrack[i].push(message.data[1]);
            //                            }

            //                            message.data[1] = midiValue(message.data[1] + pitchDelta);
            //                            message.data[2] = midiValue(message.data[2] + velocityDelta);
            //                        }
            //                        if(message.command() === NOTE_OFF_CMD)
            //                        {
            //                            index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
            //                            if(index !== -1) // ignore noteOffs which are not related to noteOns in this subsequence.
            //                            {
            //                                delete pendingScorePitchesPerTrack[i][index];
            //                                message.data[1] = midiValue(message.data[1] + pitchDelta);
            //                            }
            //                        }
            //                    }
            //                }
            //            }
            //        }

            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            returnPendingScorePitchesPerTrack.push([]);
            //            nPitches = pendingScorePitchesPerTrack[i].length;
            //            for(j = 0; j < nPitches; j++)
            //            {
            //                if(pendingScorePitchesPerTrack[i][j] !== undefined)
            //                {
            //                    pendingPitches = true;
            //                    returnPendingScorePitchesPerTrack[i].push(pendingScorePitchesPerTrack[i][j]);
            //                }
            //            }
            //        }
            //        if(pendingPitches === false)
            //        {
            //            returnPendingScorePitchesPerTrack = null;
            //        }

            //        return returnPendingScorePitchesPerTrack;
            //    }

            //    // In each following subsequence and track, looks for the first noteOff corresponding to a hanging note, and adds pitchDelta to its pitch.
            //    function adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack)
            //    {
            //        var trackIndex, nTracks = hangingScorePitchesPerTrack.length, hangingPitches,
            //            i, nHangingPitches, hangingPitch, nextNoteOffMessage;

            //        // returns the first noteOff message corresponding to the hanging Pitch in any of the following subsequences.
            //        function findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch)
            //        {
            //            var
            //            nextSubsequenceIndex = currentSubsequenceIndex + 1,
            //            i, nSubsequences = allSubsequences.length, track,
            //            j, nMoments, moment,
            //            k, nMessages, message, returnMessage = null;

            //            for(i = nextSubsequenceIndex; i < nSubsequences; ++i)
            //            {
            //                track = allSubsequences[i].tracks[trackIndex];
            //                nMoments = track.moments.length;
            //                for(j = 0; j < nMoments; ++j)
            //                {
            //                    moment = track.moments[j];
            //                    nMessages = moment.messages.length;
            //                    for(k = 0; k < nMessages; ++k)
            //                    {
            //                        message = moment.messages[k];
            //                        if(message.data[1] === hangingPitch)
            //                        {
            //                            if(message.command() === NOTE_OFF_CMD)
            //                            {
            //                                returnMessage = message;
            //                                break;
            //                            }
            //                        }
            //                    }
            //                    if(returnMessage !== null)
            //                    {
            //                        break;
            //                    }
            //                }
            //                if(returnMessage !== null)
            //                {
            //                    break;
            //                }
            //            }
            //            return returnMessage;
            //        }

            //        for(trackIndex = 0; trackIndex < nTracks; trackIndex++)
            //        {
            //            hangingPitches = hangingScorePitchesPerTrack[trackIndex];
            //            nHangingPitches = hangingPitches.length;
            //            for(i = 0; i < nHangingPitches; i++)
            //            {
            //                hangingPitch = hangingPitches[i];
            //                nextNoteOffMessage = findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch);
            //                if(nextNoteOffMessage !== null)
            //                {
            //                    nextNoteOffMessage.data[1] = hangingPitch + pitchDelta;
            //                }
            //            }
            //        }

            //    }

            //    lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_CMD, track);
            //    if(lowestNoteOnEvt !== null)
            //    {
            //        pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data[1]) : 0;
            //        velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data[2]) : 0;

            //        if(pitchDelta !== 0 || velocityDelta !== 0)
            //        {
            //            hangingScorePitchesPerTrack =
            //                adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
            //                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);

            //            if(hangingScorePitchesPerTrack !== null)
            //            {
            //                adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack);
            //            }
            //        }
            //    }
            //}

            //function setSpeed(inputEventData)
            //{
            //    // performersSpeedOptions is undefined in performerless performances
            //
            //    if(performersSpeedOptions.controllerIndex === 1)
            //    {
            //        setSpeedFactor(1, inputEventData[1]);
            //    }
            //    else if(performersSpeedOptions.controllerIndex === 2)
            //    {
            //        setSpeedFactor(2, inputEventData[2]);
            //    }
            //}

            ////console.log("NoteOn, pitch:", inputEvent.data[1].toString(), " velocity:", inputEvent.data[2].toString());

            //sequenceStartNow = inputEvent.receivedTime;

            //currentLivePerformersKeyPitch = inputEvent.data[1];

            //if(currentIndex === (performedSequences.length - 1))
            //{
            //    // If the final sequence is playing and a noteOn is received, the performance stops immediately.
            //    // In this case the final sequence must be a restSequence (otherwise a noteOn can't be received).
            //    stop();
            //}
            //else if(inputEvent.data[2] > 0)
            //{
            //    silentlyCompleteCurrentlyPlayingSequence();

            //    if(nextIndex === 0)
            //    {
            //        performanceStartNow = sequenceStartNow;
            //    }

            //    if(nextIndex === 0 || (nextIndex <= endIndex && allSubsequences[nextIndex].chordSequence !== undefined))
            //    {
            //        currentIndex = nextIndex++;
            //        endOfPerformance = (currentIndex === endIndex);

            //        if(overrideSoloPitch || overrideOtherTracksPitch || overrideSoloVelocity || overrideOtherTracksVelocity)
            //        {
            //            overridePitchAndOrVelocity(allSubsequences, currentIndex, options.livePerformersTrackIndex,
            //                inputEvent.data[1], inputEvent.data[2],
            //                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);
            //        }

            //        setSpeed(inputEvent.data);

            //        playSequence(allSubsequences[currentIndex]);
            //    }
            //}
            //else // velocity 0 is "noteOff"
            //{
            //    handleNoteOff(inputEvent);
            //}
        }

        function handleNoteOff(inputEvent)
        {
            //if(inputEvent.data[1] === currentLivePerformersKeyPitch)
            //{
            //    currentLivePerformersKeyPitch = -1;

            //    silentlyCompleteCurrentlyPlayingSequence();

            //    if(endOfPerformance) // see reportEndOfPerformance() above 
            //    {
            //        stop();
            //    }
            //    else if(performedSequences[nextIndex].restSequence !== undefined) // only play the next sequence if it is a restSequence
            //    {
            //        currentIndex = nextIndex++;
            //        endOfPerformance = (currentIndex === endIndex);
            //        sequenceStartNow = inputEvent.receivedTime;
            //        playSequence(performedSequences[currentIndex]);
            //    }
            //    else if(nextIndex <= endIndex)
            //    {
            //        endOfPerformance = (nextIndex === endIndex);
            //        reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            //    }
            //}
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

    /*******************************************************************************************************/

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
            if(reportEndOfSpan !== undefined && reportEndOfSpan !== null)
            {
                reportEndOfSpan(sequenceRecording, performanceMsDuration);
            }
        }
    },

    // Used by tick(), resume(), play(), finishSilently().
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
            scoreMsPosition = midiObjectMsPositionsInScore[currentIndex], // The usual value
            performersSegmentBounds;

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

            // Advances scoreMsPosition until it is equal to toMsPositionInScore.
            function setScoreMsPosition(toMsPositionInScore)
            {
                while(scoreMsPosition !== toMsPositionInScore)
                {
                    scoreMsPosition = advanceScoreMsPosition();
                }
                return scoreMsPosition;
            }

            performersSegmentBounds = currentSegmentBounds();
            if(performersSegmentBounds.msStartPositionInScore !== currentSegmentMsStartPositionInScore)
            {
                // A live performer has moved to the next segment
                scoreMsPosition = setScoreMsPosition(performersSegmentBounds.msStartPositionInScore);
                segmentStartTime = performance.now();
            }
            else if((scoreMsPosition < performersSegmentBounds.msEndPositionInScore)
                    && (performance.now() - segmentStartTime) >= (midiObjectMsPositionsInScore[currentIndex + 1] - performersSegmentBounds.msStartPositionInScore))
            {
                // The scoreMsPosition is moved to that of the next MidiObject (in this segment).
                scoreMsPosition = advanceScoreMsPosition();
            }

            currentSegmentMsStartPositionInScore = performersSegmentBounds.msStartPositionInScore;

            return scoreMsPosition;
        }

        scoreMsPosition = getScoreMsPosition();

        if(!stopped && !paused)
        {
            if(scoreMsPosition === endMarkerPosition)
            {
                stop(); // calls reportEndOfSpan()
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
                stop(); // calls reportEndOfSpan()
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
                    nextMomt.timestamp = segmentStartTime;
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
    //      midiOutputDevice // the midi output device
    //      reportEndOfSpan // can be null
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
            segmentStartTime += pauseMsDuration;

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

    // play();
    // Note that the moment at endMarkerMsPosition will NOT be played as part of the span.
    // endMarkerMsPosition is the msPosition of the endMarker, and moments on the endMarker
    // are never performed.
    //
    // If there is no live performer (i.e. the midiInput device is not connected),
    // performersTrackIndex should null or undefined.
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
    //      reportEndOfSpan(sequenceRecording, performanceMsDuration);
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
    play = function(options, startMarkerMsPosition, endMarkerMsPosition, trackIsOnArray,
                            recording, reportEndOfSpanCallback, reportMsPositionInScoreCallback)
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

        if(options.outputDevice === undefined || options.outputDevice === null)
        {
            throw "The midi output device must be defined.";
        }

        midiOutputDevice = options.outputDevice;
        reportEndOfSpan = reportEndOfSpanCallback; // can be null or undefined
        reportMsPositionInScore = reportMsPositionInScoreCallback; // can be null or undefined

        lastReportedMsPosition = -1;

        maxDeviation = 0; // for //console.log

        setTrackAttributes(tracks, trackIsOnArray, startMarkerMsPosition, endMarkerMsPosition);

        midiObjectMsPositionsInScore = getMidiObjectMsPositionsInScore(tracks, startMarkerMsPosition, endMarkerMsPosition);
        midiObjectMsPositionsInScoreIndex = 0;

        currentSegmentMsStartPositionInScore = startMarkerMsPosition;

        performanceStartTime = performance.now();
        segmentStartTime = performanceStartTime;

        run();
    },

    sendControlMessageNow = function(outputDevice, trackIndex, controller, midiValue)
    {
        var msg;

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
        var msg;
        msg = new _AP.message.Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_COARSE, 0);
        outputDevice.send(msg.data, 0);
        msg = new _AP.message.Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_FINE, 0);
        outputDevice.send(msg.data, 0);
        msg = new _AP.message.Message(CMD.CONTROL_CHANGE + track, CTL.DATA_ENTRY_COARSE, value);
        outputDevice.send(msg.data, 0);

        msg = new _AP.message.Message(CMD.PITCH_WHEEL + track, 0, 64); // centre the pitch wheel
        outputDevice.send(msg.data, 0);
    },

    publicAPI =
    {
        init: init,
        handleMIDIInputEvent: handleMIDIInputEvent,

        play: play,
        pause: pause,
        resume: resume,
        stop: stop,
        isStopped: isStopped,
        isPaused: isPaused,
        isRunning: isRunning,

        sendControlMessageNow: sendControlMessageNow,
        sendSetPitchWheelDeviationMessageNow: sendSetPitchWheelDeviationMessageNow
    };
    // end var

    return publicAPI;

}());
