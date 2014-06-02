/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/MonoInputHandler.js
*  The _AP.monoInputHandler namespace which defines
*
*       // message handler for input devices
*       handleMIDIInputEvent(msg)  
*       
*       // called by player.play()
*       // Throws an exception if the options are undefined.
*       // Sets the internal options object to the options that are set in the monoInputDialog.
*       init: init, 
*       
*       // MIDI input message handler
*       handleMIDIInputEvent: handleMIDIInputEvent
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.monoInputHandler');

_AP.monoInputHandler = (function()
{
    "use strict";

    // begin var
    var
    Message = _AP.message.Message,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,

    // set in init()
    outputDevice,
    tracks = [], // sequence.tracks. All the tracks, complete from the beginning to the end of the piece.
    options, // the performersOptions
    // A flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    midiObjectMsPositionsInScore = [],
    midiObjectMsPositionsInScoreIndex = 0, // the current index in the above array

    // a flat, ordered array containing the msPositions of the live performer's MidiObjects.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    performersMsPositionsInScore = [],
    performersMsPositionsInScoreIndex = 0, // an index in the performersMsPositionsInScore array (updated when a NoteOn is received)

    performanceStartTime, // the time at which the performance starts
    // Not sure if pausing is relevant in live performances...
    // Maybe delete startTimeAdjustedForPauses and disable the pause button in live performances.
    startTimeAdjustedForPauses,

    // This is where input MIDIEvents arrive, and where processing of the monoInput's input is going to be done.
    // Both RealTime and SysEx messages are ignored.
    // It is assumed that RealTime messages will not interrupt the messages being received.    
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
            rInputEvent = {};

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
                    rInputEvent = new Message(data[0], data[1], 0);
                }
                else if(data.length === 3)
                {
                    rInputEvent = new Message(data[0], data[1], data[2]);
                }

                // other data is simply ignored

                if(rInputEvent.data !== undefined)
                {
                    rInputEvent.receivedTime = now;
                }
            }

            return rInputEvent;
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

            console.log("monoInput.setSpeedFactor() has not yet been written.");
            throw "Not yet implemented.";

            //if(performersSpeedOptions !== undefined && currentIndex >= 0
            //    && performersSpeedOptions.controllerIndex !== undefined && performersSpeedOptions.controllerIndex === receivedCommandIndexInHTMLMenu
            //    && performersSpeedOptions.fasterRoot !== undefined && performersSpeedOptions.slowerRoot !== undefined)
            //{
            //    speedFactor = getSpeedFactor(performersSpeedOptions.fasterRoot, performersSpeedOptions.slowerRoot, controllerValue);
            //    performedSequences[currentIndex].setSpeedFactor(speedFactor);
            //}
        }

        function handleController(runtimeTrackOptions, controlData, value, usesSoloTrack, usesOtherTracks)
        {
            var
            i,
            nTracks = allSequences[0].tracks.length,
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
                        COMMAND = _AP.constants.COMMAND,
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
                            message = new Message(COMMAND.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
                        }
                        else if(controlData.command !== undefined)
                        {
                            switch(controlData.command)
                            {
                                case COMMAND.AFTERTOUCH:
                                    if(currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
                                    {
                                        message = new Message(COMMAND.AFTERTOUCH + trackIndex, currentLivePerformersKeyPitch, value);
                                    }
                                    break;
                                case COMMAND.CHANNEL_PRESSURE:
                                    message = new Message(COMMAND.CHANNEL_PRESSURE + trackIndex, value, 0);
                                    break;
                                case COMMAND.PITCH_WHEEL:
                                    // value is inputEvent.data[2]
                                    message = new Message(COMMAND.PITCH_WHEEL + trackIndex, 0, value);
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
                        moment = new Moment(_AP.moment.UNDEFINED_TIMESTAMP);  // moment.msPositionInScore becomes UNDEFINED_TIMESTAMP
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
                        if(trackIsOnArray[i])
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
                track = recordingSequence.tracks[trackMoments[i].trackIndex];

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
            throw "Not yet implemented.";

            //// currentIndex is the index of the currently playing sequence
            //// (which should be silently completed when a noteOn arrives).
            //if(currentIndex >= 0 && currentIndex < performedSequences.length)
            //{
            //    performedSequences[currentIndex].finishSilently();
            //}
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
            throw "Not yet implemented.";

            //if(endOfPerformance)
            //{
            //    stop();
            //}
            //else
            //{
            //    reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            //}
        }

        function playSequence(sequence)
        {
            throw "Not yet implemented.";
            //// The durations will be related to the moment.msPositionReSubsequence attrbutes (which have been
            //// set relative to the start of each subsequence), and to speedFactorObject argument.
            //sequence.play(outputDevice, 0, Number.MAX_VALUE, trackIsOnArray, recordingSequence, reportEndOfSequence, reportMsPosition);
        }

        function handleNoteOff(inputEvent)
        {
            throw "Not yet implemented.";
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
                NOTE_ON_COMMAND = _AP.constants.COMMAND.NOTE_ON,
                NOTE_OFF_COMMAND = _AP.constants.COMMAND.NOTE_OFF,
                track = subsequence.tracks[soloTrackIndex], message, lowestNoteOnEvt, pitchDelta, velocityDelta,
                hangingScorePitchesPerTrack;

                // Returns the lowest NoteOn message in the first moment in the track to contain a NoteOnMessage.
                // Returns null if there is no such message.
                function findLowestNoteOnEvt(NOTE_ON_COMMAND, track)
                {
                    var i, j, message, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

                    for(i = 0; i < nMoments; ++i)
                    {
                        moment = track.moments[i];
                        nEvents = moment.messages.length;
                        for(j = 0; j < nEvents; ++j)
                        {
                            message = moment.messages[j];
                            if((message.command() === NOTE_ON_COMMAND)
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
                function adjustTracks(NOTE_ON_COMMAND, NOTE_OFF_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
                    overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
                {
                    var nTracks = subsequence.tracks.length, i, j, k, nMoments, moment, nEvents, index, nPitches,
                        pendingScorePitchesPerTrack = [], returnPendingScorePitchesPerTrack = [], pendingPitches = false;

                    for(i = 0; i < nTracks; ++i)
                    {
                        pendingScorePitchesPerTrack.push([]);

                        if((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
                        || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
                        {
                            track = subsequence.tracks[i];
                            nMoments = track.moments.length;

                            for(j = 0; j < nMoments; ++j)
                            {
                                moment = track.moments[j];
                                nEvents = moment.messages.length;
                                for(k = 0; k < nEvents; ++k)
                                {
                                    message = moment.messages[k];
                                    if(message.command() === NOTE_ON_COMMAND)
                                    {
                                        index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
                                        if(index === -1)
                                        {
                                            pendingScorePitchesPerTrack[i].push(message.data[1]);
                                        }

                                        message.data[1] = midiValue(message.data[1] + pitchDelta);
                                        message.data[2] = midiValue(message.data[2] + velocityDelta);
                                    }
                                    if(message.command() === NOTE_OFF_COMMAND)
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
                function adjustSubsequentNoteOffs(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack)
                {
                    var trackIndex, nTracks = hangingScorePitchesPerTrack.length, hangingPitches,
                        i, nHangingPitches, hangingPitch, nextNoteOffMessage;

                    // returns the first noteOff message corresponding to the hanging Pitch in any of the following subsequences.
                    function findNextNoteOffMessage(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch)
                    {
                        var
                        nextSubsequenceIndex = currentSubsequenceIndex + 1,
                        i, nSubsequences = allSubsequences.length, track,
                        j, nMoments, moment,
                        k, nMessages, message, returnMessage = null;

                        for(i = nextSubsequenceIndex; i < nSubsequences; ++i)
                        {
                            track = allSubsequences[i].tracks[trackIndex];
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
                                        if(message.command() === NOTE_OFF_COMMAND)
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
                            nextNoteOffMessage = findNextNoteOffMessage(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch);
                            if(nextNoteOffMessage !== null)
                            {
                                nextNoteOffMessage.data[1] = hangingPitch + pitchDelta;
                            }
                        }
                    }

                }

                lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_COMMAND, track);
                if(lowestNoteOnEvt !== null)
                {
                    pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data[1]) : 0;
                    velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data[2]) : 0;

                    if(pitchDelta !== 0 || velocityDelta !== 0)
                    {
                        hangingScorePitchesPerTrack =
                            adjustTracks(NOTE_ON_COMMAND, NOTE_OFF_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
                            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);

                        if(hangingScorePitchesPerTrack !== null)
                        {
                            adjustSubsequentNoteOffs(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack);
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
                case COMMAND.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
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
                case COMMAND.AFTERTOUCH: // produced by the EWI breath controller
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
                case COMMAND.CONTROL_CHANGE: // sent when the input device's mod wheel changes.
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
                case COMMAND.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
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
                case COMMAND.NOTE_ON:
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
                case COMMAND.NOTE_OFF:
                    handleNoteOff(inputEvent);
                    break;
                default:
                    break;
            }
        }
    },

    currentSegmentBounds = function()
    {
        throw "Not yet implemented.";
        //var
        //bounds = {},
        //startIndex = performersMsPositionsInScoreIndex,
        //endIndex = startIndex + 1;

        //if(startIndex < performersMsPositionsInScore.length)
        //{
        //    bounds.msStartPositionInScore = performersMsPositionsInScore[startIndex];
        //}
        //if(endIndex < performersMsPositionsInScore.length)
        //{
        //    bounds.msEndPositionInScore = performersMsPositionsInScore[endIndex];
        //}
        //return bounds;
    },

    nextMoment = function()
    {
        throw "Not yet implemented.";
    },

    // init() is called from player.play() if this is an assisted performance and performer is monoInput.
    // Arguments:
    //      outputDevice: the midiOutputDevice.
    //      allTracks: all the tracks, complete from the beginning to the end of the piece (not including the final barline).
    //      moMsPositionsInScore: a flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    //          The first value in this array is the position of the startMarker, the last value is final position before the endMarker.
    //      performersOptions: the monoInput options from the dialog (see below).
    //      usePerformersNextMomentFunction: a callback function that sets the player to use the monoInput's nextMoment function
    //          which is defined in this namespace and uses variables local to this namespace.
    //
    // The performersOptions object has the following attributes:
    //
    //      nTracks -- the number of tracks in the score
    //      trackIndex -- the performer's trackIndex
    //      midiEventHandler -- the namespace, in this case _AP.monoInputHandler
    //      noteOnPitchTracks -- undefined or array of bool, length nTracks
    //      noteOnVelocityTracks -- undefined or array of bool, length nTracks
    //      pressureSubstituteControlData -- undefined or a controlData object (see below)
    //      pressureTracks -- undefined or array of bool, length nTracks
    //      pitchWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      pitchWheelTracks -- undefined or array of bool, length nTracks
    //      modWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      modWheelTracks -- undefined or array of bool, length nTracks
    //      minVolume -- undefined (if volume is not being contrlled) or int in range 0..127
    //      masterVolumes -- array of int, range 0..127, length nTracks
    //      speedControllerName -- undefined, or one of the effective mpoSpeedControllerSelect option strings (see below)
    //      speedMaxFactor -- undefined (if speed is not being controlled) or a float greater or equal to 1. (not a percent)
    //
    // A controlData object is set from the dialog's current controlOptions settings.
    // It has one of the following attributes:
    //      command
    //      midiControl
    // If the controlData object is undefined, then so is the corresponding ...Tracks array.
    //
    // The effective mpoSpeedControllerSelect option strings are: (see speedController above):
    //      "noteOn: pitch"
    //      "noteOn: velocity"
    //      "pressure"
    //      "pitch wheel"
    //      "modulation wheel"
    // If the speedController is undefined, then so is the corresponding speedMaxFactor.
    init = function(midiOutputDevice, allTracks, moMsPositionsInScore, performersOptions, usePerformersNextMomentFunction)
    {
        // Sets the global performersMsPositionsInScore to contain the positions of all the performer's midiObjects
        // These positions are greater than or equal to the startMarker position, and less than the endMarkerPosition.
        function getPerformersMsPositions(performersMidiObjects, moMsPositionsInScore)
        {
            var
            i,
            startMarkerPosition = moMsPositionsInScore[0],
            endMarkerPosition = moMsPositionsInScore[moMsPositionsInScore.length - 1];

            performersMsPositionsInScore.length = 0;
            for(i = 0; i < performersMidiObjects.length; ++i)
            {
                if(performersMidiObjects[i].msPositionInScore >= endMarkerPosition)
                {
                    break;
                }

                if(performersMidiObjects[i].msPositionInScore >= startMarkerPosition)
                {
                    performersMsPositionsInScore.push(performersMidiObjects[i].msPositionInScore);
                }
            }

            if((performersMsPositionsInScore[0] !== moMsPositionsInScore[0])
            || (performersMsPositionsInScore[performersMsPositionsInScore.length - 1] >= endMarkerPosition))
            {
                throw "Error constructing performersMsPositionsInScore array.";
            }
        }

        outputDevice = midiOutputDevice; // the output device
        tracks = allTracks;   
        midiObjectMsPositionsInScore = moMsPositionsInScore; // a flat, ordered array of all msPositions in the performance
        options = performersOptions;

        // set the player to use the above, monoInput.nextMoment() function
        usePerformersNextMomentFunction(nextMoment);

        // Sets the global performersMsPositionsInScore to contain values which are
        // greater than or equal to the startMarkerPosition, and less than the endMarkerPosition.
        getPerformersMsPositions(allTracks[options.trackIndex].midiObjects, moMsPositionsInScore);

        performanceStartTime = performance.now();
        startTimeAdjustedForPauses = performanceStartTime;
    },

    publicAPI =
    {
        // Called in player.play(). Takes account of startMarker and endMarker positions etc.
        // Receives the options that are set in the performers options dialog.
        // See detailed comment above.
        init: init,

        handleMIDIInputEvent: handleMIDIInputEvent
    };
    // end var

    return publicAPI;

}(document));
