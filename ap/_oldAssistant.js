/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Assistant.js
*  The _AP.assistant namespace which defines
*    Assistant() [constructor]
*    handleMIDIInputEvent(msg) [message handler for input devices]. 
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.assistant');

_AP.assistant = (function ()
{
    "use strict";

    // begin var
    var
    UNDEFINED_TIMESTAMP = _AP.moment.UNDEFINED_TIMESTAMP,
    CMD = _AP.constants.COMMAND,
    Message = _AP.message.Message,
    Moment = _AP.moment.Moment,
    Sequence = _AP.sequence.Sequence,
 
    outputDevice,
    trackIsOnArray,

    performersSpeedOptions,
    currentLivePerformersKeyPitch = -1, // -1 means "no key depressed". This value is set when the live performer sends a noteOff

    options, // performance options. This is the mo (=options) object in Controls.
    reportEndOfPerformance, // callback
    recordingSequence, // initially set by assistant.perform(...), passed repeatedly to sequence.play(...), returned by reportEndOfPerformance()
    reportMsPosition, // callback

    // An array of Sequence containing one sequence for each chord or rest
    // symbol in the whole live performer's track (except that the sequences
    // in consecutive rests have been concatenated to one sequence).
    // This array is set in the Assistant constructor.
    allSequences,

    // An array containing only the sequences which are to be performed.
    // This array is constructed in perform() from allSequences, using
    // startMarkerMsPosition and endMarkerMsPosition.
    performedSequences,

    // these variables are initialized by perform() and used by handleMIDIInputEvent() 
    endIndex = -1,
    currentIndex = -1, // the index of the currently playing sequence (which will be stopped when a noteOn or noteOff arrives).
    endOfPerformance = false, // flag, set to true when (currentIndex === endIndex)
    nextIndex = 0, // the index of the sequence which will be played when a noteOn evt arrives
    performanceStartNow, // set when the first sequence starts, used to set the reported duration of the performance 
    sequenceStartNow, // set when a sequence starts playing 

    stopped = true,
    paused = false,

    forwardSetState, // forward declaration, set to setState later.

    stop = function ()
    {
        var performanceMsDuration;

        if (stopped === false)
        {
            forwardSetState("stopped");

            performanceMsDuration = performance.now() - performanceStartNow;

            reportEndOfPerformance(recordingSequence, performanceMsDuration);
        }
    },

    // If options.livePerformance === true, this is where input
    // MIDIEvents arrive, and where processing is going to be done.
    // The Assistant
    // a) ignores both RealTime and SysEx messages in its input, and
    // b) assumes that RealTime messages will not interrupt the messages being received.    
    handleMIDIInputEvent = function (msg)
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
            inputEvent = {};

            if (data !== undefined)
            {
                if (data[0] === SYSTEM_EXCLUSIVE.START)
                {
                    if (!(data.length > 2 && data[data.length - 1] === SYSTEM_EXCLUSIVE.END))
                    {
                        throw "Error in System Exclusive inputEvent.";
                    }
                    // SysExMessages are ignored by the assistant, so do nothing here.
                    // Note that SysExMessages may contain realTime messages at this point (they
                    // would have to be removed somehow before creating a sysEx event), but since
                    // we are ignoring both realTime and sysEx, nothing needs doing here.
                }
                else if ((data[0] & 0xF0) === 0xF0)
                {
                    if (!(isRealTimeStatus(data[0])))
                    {
                        throw "Error: illegal data.";
                    }
                    // RealTime messages are ignored by the assistant, so do nothing here.
                }
                else if (data.length === 2)
                {
                    inputEvent = new Message(data[0], data[1], 0);
                }
                else if (data.length === 3)
                {
                    inputEvent = new Message(data[0], data[1], data[2]);
                }

                // other data is simply ignored

                if (inputEvent.data !== undefined)
                {
                    inputEvent.receivedTime = now;
                }
            }

            return inputEvent;
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

            if(performersSpeedOptions !== undefined && currentIndex >= 0
                && performersSpeedOptions.controllerIndex !== undefined && performersSpeedOptions.controllerIndex === receivedCommandIndexInHTMLMenu
                && performersSpeedOptions.fasterRoot !== undefined && performersSpeedOptions.slowerRoot !== undefined)
            {
                speedFactor = getSpeedFactor(performersSpeedOptions.fasterRoot, performersSpeedOptions.slowerRoot, controllerValue);
                performedSequences[currentIndex].setSpeedFactor(speedFactor);
            }
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
                        CMD = _AP.constants.COMMAND,
                        message = null,
                        minVolume, scale;

                        if (controlData.midiControl !== undefined) // a normal control
                        {
                            if(controlData.midiControl === _AP.constants.CONTROL.VOLUME)
                            {
                                minVolume = runtimeTrackOptions.minVolumes[trackIndex];
                                scale = runtimeTrackOptions.scales[trackIndex];
                                value = Math.floor(minVolume + (value * scale));
                            }
                            // for other controls, value is unchanged
                            message = new Message(CMD.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
                        }
                        else if (controlData.command !== undefined)
                        {
                            switch (controlData.command)
                            {
                                case CMD.AFTERTOUCH:
                                    if (currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
                                    {
                                        message = new Message(CMD.AFTERTOUCH + trackIndex, currentLivePerformersKeyPitch, value);
                                    }
                                    break;
                                case CMD.CHANNEL_PRESSURE:
                                    message = new Message(CMD.CHANNEL_PRESSURE + trackIndex, value, 0);
                                    break;
                                case CMD.PITCH_WHEEL:
                                    // value is inputEvent.data[2]
                                    message = new Message(CMD.PITCH_WHEEL + trackIndex, 0, value);
                                    break;
                                default:
                                    break;
                            }
                        }

                        return message;
                    }

                    message = newControlMessage(runtimeTrackOptions, controlData, value, trackIndex);
                    if (message !== null)
                    {
                        moment = new Moment(_AP.moment.UNDEFINED_TIMESTAMP);  // moment.msPositionInScore becomes UNDEFINED_TIMESTAMP
                        moment.messages.push(message);
                        trackMoment = {};
                        trackMoment.moment = moment;
                        trackMoment.trackIndex = trackIndex;
                    }
                    return trackMoment;
                }

                if (usesSoloTrack && usesOtherTracks)
                {
                    for (i = 0; i < nTracks; ++i)
                    {
                        if (trackIsOnArray[i])
                        {
                            trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
                            if (trackMoment !== null)
                            {
                                trackMoments.push(trackMoment);
                            }
                        }
                    }
                }
                else if (usesSoloTrack)
                {
                    trackMoment = newTrackMoment(runtimeTrackOptions, controlData, livePerformersTrackIndex, value);
                    if (trackMoment !== null)
                    {
                        trackMoments.push(trackMoment);
                    }
                }
                else if (usesOtherTracks)
                {
                    for (i = 0; i < nTracks; ++i)
                    {
                        if (trackIsOnArray[i] && i !== livePerformersTrackIndex)
                        {
                            trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
                            if (trackMoment !== null)
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
            for (i = 0; i < nMoments; ++i)
            {
                track = recordingSequence.tracks[trackMoments[i].trackIndex];

                if (track.isInChord !== undefined) // track.isInChord is defined in track.addLiveScoreMoment()
                {
                    moment = trackMoments[i].moment;
                    if (recordingSequence !== undefined && recordingSequence !== null)
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
            // currentIndex is the index of the currently playing sequence
            // (which should be silently completed when a noteOn arrives).
            if(currentIndex >= 0 && currentIndex < performedSequences.length)
            {
                performedSequences[currentIndex].finishSilently();
            }
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
            if(endOfPerformance)
            {
                stop();
            }
            else
            {
                reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            }
        }

        function playSequence(sequence)
        {
            // The durations will be related to the moment.msPositionReSubsequence attrbutes (which have been
            // set relative to the start of each subsequence), and to speedFactorObject argument.
            sequence.play(outputDevice, 0, Number.MAX_VALUE, trackIsOnArray, recordingSequence, reportEndOfSequence, reportMsPosition);
        }

        function handleNoteOff(inputEvent)
        {
            if (inputEvent.data[1] === currentLivePerformersKeyPitch)
            {
                currentLivePerformersKeyPitch = -1;

                silentlyCompleteCurrentlyPlayingSequence();

                if(endOfPerformance) // see reportEndOfPerformance() above 
                {
                    stop();
                }
                else if (performedSequences[nextIndex].restSequence !== undefined) // only play the next sequence if it is a restSequence
                {
                    currentIndex = nextIndex++;
                    endOfPerformance = (currentIndex === endIndex);
                    sequenceStartNow = inputEvent.receivedTime;
                    playSequence(performedSequences[currentIndex]);
                }
                else if (nextIndex <= endIndex)
                {
                    endOfPerformance = (nextIndex === endIndex);
                    reportMsPosition(performedSequences[nextIndex].msPositionInScore);
                }
            }
        }

        function handleNoteOn(inputEvent, overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            var
            allSubsequences = performedSequences;

            // Shifts the pitches in the subsequence up or down so that the lowest pitch in the
            // first noteOn moment is newPitch. Similarly with velocity.
            function overridePitchAndOrVelocity (allSubsequences, currentSubsequenceIndex, soloTrackIndex, newPitch, newVelocity,
                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            {
                var
                subsequence = allSubsequences[currentSubsequenceIndex],
                NOTE_ON_CMD = _AP.constants.COMMAND.NOTE_ON,
                NOTE_OFF_CMD = _AP.constants.COMMAND.NOTE_OFF,
                track = subsequence.tracks[soloTrackIndex], message, lowestNoteOnEvt, pitchDelta, velocityDelta,
                hangingScorePitchesPerTrack;

                // Returns the lowest NoteOn message in the first moment in the track to contain a NoteOnMessage.
                // Returns null if there is no such message.
                function findLowestNoteOnEvt(NOTE_ON_CMD, track)
                {
                    var i, j, message, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

                    for (i = 0; i < nMoments; ++i)
                    {
                        moment = track.moments[i];
                        nEvents = moment.messages.length;
                        for (j = 0; j < nEvents; ++j)
                        {
                            message = moment.messages[j];
                            if ((message.command() === NOTE_ON_CMD)
                            && (lowestNoteOnMessage === null || message.data[1] < lowestNoteOnMessage.data[1]))
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

                // Adjusts the noteOn and noteOff messages inside this subsequence
                // Either returns an array of arrays, or null.
                // The returned array[track] is an array containing the score pitches which have not been turned off in each track.
                // null is returned if all the pitches which are turned on inside the subsequence are also turned off inside the subsequence.
                function adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                    overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
                {
                    var nTracks = subsequence.tracks.length, i, j, k, nMoments, moment, nEvents, index, nPitches,
                        pendingScorePitchesPerTrack = [], returnPendingScorePitchesPerTrack = [], pendingPitches = false;

                    for (i = 0; i < nTracks; ++i)
                    {
                        pendingScorePitchesPerTrack.push([]);

                        if ((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
                        || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
                        {
                            track = subsequence.tracks[i];
                            nMoments = track.moments.length;

                            for (j = 0; j < nMoments; ++j)
                            {
                                moment = track.moments[j];
                                nEvents = moment.messages.length;
                                for (k = 0; k < nEvents; ++k)
                                {
                                    message = moment.messages[k];
                                    if (message.command() === NOTE_ON_CMD)
                                    {
                                        index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
                                        if(index === -1)
                                        {
                                            pendingScorePitchesPerTrack[i].push(message.data[1]);
                                        }
                                        
                                        message.data[1] = midiValue(message.data[1] + pitchDelta);
                                        message.data[2] = midiValue(message.data[2] + velocityDelta);
                                    }
                                    if(message.command() === NOTE_OFF_CMD)
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
                    if(pendingPitches === false) {
                        returnPendingScorePitchesPerTrack = null;
                    }

                    return returnPendingScorePitchesPerTrack;
                }

                // In each following subsequence and track, looks for the first noteOff corresponding to a hanging note, and adds pitchDelta to its pitch.
                function adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack)
                {
                    var trackIndex, nTracks = hangingScorePitchesPerTrack.length, hangingPitches,
                        i, nHangingPitches, hangingPitch, nextNoteOffMessage;

                    // returns the first noteOff message corresponding to the hanging Pitch in any of the following subsequences.
                    function findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch)
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
                                        if(message.command() === NOTE_OFF_CMD)
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
                            nextNoteOffMessage = findNextNoteOffMessage(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch);
                            if(nextNoteOffMessage !== null)
                            {
                                nextNoteOffMessage.data[1] = hangingPitch + pitchDelta;
                            }
                        }
                    }

                }

                lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_CMD, track);
                if (lowestNoteOnEvt !== null)
                {
                    pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data[1]) : 0;
                    velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data[2]) : 0;

                    if (pitchDelta !== 0 || velocityDelta !== 0)
                    {
                        hangingScorePitchesPerTrack =
                            adjustTracks(NOTE_ON_CMD, NOTE_OFF_CMD, soloTrackIndex, pitchDelta, velocityDelta,
                            overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);

                        if(hangingScorePitchesPerTrack !== null)
                        {
                            adjustSubsequentNoteOffs(NOTE_OFF_CMD, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack);
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
            else if (inputEvent.data[2] > 0)
            {
                silentlyCompleteCurrentlyPlayingSequence();

                if (nextIndex === 0)
                {
                    performanceStartNow = sequenceStartNow;
                }

                if (nextIndex === 0 || (nextIndex <= endIndex && allSubsequences[nextIndex].chordSequence !== undefined))
                {
                    currentIndex = nextIndex++;
                    endOfPerformance = (currentIndex === endIndex);
                    
                    if (overrideSoloPitch || overrideOtherTracksPitch || overrideSoloVelocity || overrideOtherTracksVelocity)
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

        if (inputEvent.data !== undefined)
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
                    if (localOptions.pressureSubstituteControlData !== null)
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
                    if (localOptions.pitchBendSubstituteControlData !== null)
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

    setState = function (state)
    {
        switch (state)
        {
            case "stopped":
                if (currentIndex >= 0 && performedSequences[currentIndex].isStopped() === false)
                {
                    performedSequences[currentIndex].stop();
                }
                // these variables are also set in perform() when the state is first set to "running"
                endIndex = (performedSequences === undefined) ? -1 : (performedSequences.length - 1); // the index of the (unplayed) end chord or rest or endBarline
                currentIndex = -1;
                endOfPerformance = false;
                nextIndex = 0;
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

    // Can only be called when paused is true.
    resume = function ()
    {
        if (paused === true)
        {
            if (options.assistantUsesAbsoluteDurations === false)
            {
                sequenceStartNow = performance.now();
            }
            performedSequences[currentIndex].resume();
            setState("running");
        }
    },

    // Can only be called while running
    // (stopped === false && paused === false)
    pause = function ()
    {
        if (stopped === false && paused === false)
        {
            performedSequences[currentIndex].pause();
            setState("paused");
        }
        else
        {
            throw "Attempt to pause a stopped or paused sequence.";
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

    // This function is called when options.livePerformance === true and the Go button is clicked (in the performance controls).
    // If options.livePerformance === false, the main sequence.play(...) is called instead.
    // The assistant's allSequences array (set in the assistant's constructor), contains the whole piece as an array of sequence,
    // with one sequence per performer's rest or chord, whereby consecutive rests in the performer's track have been merged.
    // This function sets the performedSequences array, which is the section of the allSequences array between startMarkerMsPosition and
    // endMarkerMsPosition (not including moments at the endMarkerMsPosition).
    // Creating the performedSequences array does *not* change the data in allSequences, so the start and end markers can be moved between
    // performances without reconstructing the assistant.
    perform = function (outDevice, startMarkerMsPosition, endMarkerMsPosition, performersSpeedOpts, argTrackIsOnArray, recordingSeq)
    {
        function getPerformedSequences(allSequences, startMarkerMsPosition, endMarkerMsPosition)
        {
            var sequence, i,
                nSequences = allSequences.length,
                performedSequences = []; // an array of sequences

            function resetTimestamps(sequences)
            {
                var
                nTracks = sequence.tracks.length, moment,
                i, j, k, track, trackLength;

                for(i = 0; i < sequences.length; ++i)
                {
                    sequence = sequences[i];
                    for(j = 0; j < nTracks; ++j)
                    {
                        track = sequence.tracks[j];
                        trackLength = track.moments.length;
                        for(k = 0; k < trackLength; ++k)
                        {
                            moment = track.moments[k];
                            moment.timestamp = UNDEFINED_TIMESTAMP;
                        }
                    }
                }
            }

            for(i = 0; i < nSequences; ++i)
            {
                sequence = allSequences[i];
                if(sequence.msPositionInScore >= endMarkerMsPosition)
                {
                    break;
                }
                if(sequence.msPositionInScore >= startMarkerMsPosition)
                {
                    performedSequences.push(sequence);
                }
            }
            if(performedSequences[0].chordSequence === undefined || performedSequences[0].msPositionInScore !== startMarkerMsPosition)
            {
                throw "The performance must start with a chordSequence at the startMarker's msPosition";
            }

            resetTimestamps(performedSequences);

            return performedSequences;
        }

        setState("running");
        outputDevice = outDevice;
        performersSpeedOptions = performersSpeedOpts;
        // trackIsOnArray is read only
        trackIsOnArray = argTrackIsOnArray;
        performedSequences = getPerformedSequences(allSequences, startMarkerMsPosition, endMarkerMsPosition);
        recordingSequence = recordingSeq;

        endIndex = performedSequences.length - 1;
        currentIndex = -1;
        endOfPerformance = false;
        nextIndex = 0;
    },

    // creats an Assistant, complete with private sequences
    // called when the Start button is clicked, and options.livePerformance === true
    Assistant = function (sequence, apControlOptions, reportEndOfWholePerformance, reportMillisecondPosition)
    {
        // Returns an array of Sequence.
        // Each sequence in the array contains moments from the main sequence (which contains no barlines).
        // A sequence is first created for each chord or rest symbol. 
        // Sequences corresponding to a live performer's chord are given a chordSequence attribute (=true).
        // Sequences corresponding to a live performer's rest are given a restSequence attribute (=true).
        // Consecutive restSequences are merged: When performing, consecutive rests in the performer's track are treated
        // as one. The live performer only starts the first one (with a noteOff). Following rests play automatically until
        // the next chord (chordSequence) in the performer's track.
        // The msPositionReSubsequence attributes are set for all moments.
        function getSequences(mainSequence, livePerformersTrackIndex)
        {
            var
            sequences = [],
            nTracks = sequence.tracks.length,
            trackIndex;

            // The returned empty sequences have been given an msPositionInScore attribute,
            // and either a restSequence or a chordSequence attribute, 
            // depending on whether they correspond to a live player's rest or chord.
            // They also contain the correct number of empty tracks.
            function getEmptySequences(nTracks, livePerformersTrack)
            {
                var s, emptySequences = [],
                    performersMIDIMoments, nPerformersMIDIMoments, i,
                    moment;

                performersMIDIMoments = livePerformersTrack.moments;
                nPerformersMIDIMoments = performersMIDIMoments.length;
                for (i = 0; i < nPerformersMIDIMoments; ++i)
                {
                    s = null;
                    moment = performersMIDIMoments[i];

                    if (moment.restStart !== undefined)
                    {
                        s = new Sequence(nTracks);
                        Object.defineProperty(s, "restSequence", { value: true, writable: false });
                        Object.defineProperty(s, "msPositionInScore", { value: moment.msPositionInScore, writable: false });
                        //console.log("Rest Sequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }
                    else if (moment.chordStart !== undefined)
                    {
                        s = new Sequence(nTracks);
                        Object.defineProperty(s, "chordSequence", { value: true, writable: false });
                        Object.defineProperty(s, "msPositionInScore", { value: moment.msPositionInScore, writable: false });
                        //console.log("Chord Sequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }

                    if (s !== null)
                    {
                        emptySequences.push(s);
                    }
                }
                return emptySequences;
            }

            function fillSequences(sequences, mainSequence, trackIndex)  // 'base' function in outer scope.
            {
                var track, moments = mainSequence.tracks[trackIndex].moments,
                    moment, momentsIndex = 0,
                    nMIDIMoments = moments.length,
                    sequence, sequencesIndex,
                    nSequences = sequences.length, // including the final barline
                    nextSequenceMsPositionInScore;

                function getNextSequenceMsPositionInScore(sequences, sequencesIndex, nSequences)
                {
                    var nextSequenceMsPositionInScore, nextIndex = sequencesIndex + 1;

                    if (nextIndex < nSequences)
                    {
                        nextSequenceMsPositionInScore = sequences[nextIndex].msPositionInScore;
                    }
                    else
                    {
                        nextSequenceMsPositionInScore = Number.MAX_VALUE;
                    }

                    return nextSequenceMsPositionInScore;
                }

                // nSequences includes the final barline (a restSequence which may contain noteOff messages).
                for (sequencesIndex = 0; sequencesIndex < nSequences; ++sequencesIndex)
                {
                    sequence = sequences[sequencesIndex];
                    nextSequenceMsPositionInScore = getNextSequenceMsPositionInScore(sequences, sequencesIndex, nSequences);
                    track = sequence.tracks[trackIndex];
                    // nMIDIMoments may be 0 (an empty track)
                    if (nMIDIMoments > 0 && momentsIndex < nMIDIMoments)
                    {
                        moment = moments[momentsIndex];

                        while (moment.msPositionInScore < nextSequenceMsPositionInScore)
                        {
                            track.addMoment(moment);
                            ++momentsIndex;
                            if (momentsIndex === nMIDIMoments)
                            {
                                break;
                            }
                            moment = moments[momentsIndex];
                        }
                    }
                }
            }

            // When performing, consecutive rests in the performer's track are treated as one.
            // The live performer only starts the first one (with a noteOff). Following rests
            // play automatically until the next chord in the performer's track.
            function mergeRestSequences(sequences)
            {
                var i, nSequences = sequences.length,
                newSequences = [], lastNewS,
                nTracks = sequences[0].tracks.length,
                sequence, t, currentTrack, trackToAppend, nMoments,
                iMom;

                newSequences.push(sequences[0]);

                for (i = 1; i < nSequences; ++i)
                {
                    lastNewS = newSequences[newSequences.length - 1];
                    if (lastNewS.restSequence !== undefined && sequences[i].restSequence !== undefined)
                    {
                        sequence = sequences[i];
                        // append sequence to lastnewS
                        for (t = 0; t < nTracks; ++t)
                        {
                            currentTrack = lastNewS.tracks[t];
                            trackToAppend = sequence.tracks[t];
                            nMoments = trackToAppend.moments.length;
                            for (iMom = 0; iMom < nMoments; ++iMom)
                            {
                                currentTrack.addMoment(trackToAppend.moments[iMom]);
                            }
                        }
                    }
                    else
                    {
                        newSequences.push(sequences[i]);
                    }
                }

                return newSequences;
            }

            function setMsPositionsReSubsequences(sequences)
            {
                var
                nTracks = sequence.tracks.length, moment,
                i, j, k, track, trackLength;

                for(i = 0; i < sequences.length; ++i)
                {
                    sequence = sequences[i];
                    for(j = 0; j < nTracks; ++j)
                    {
                        track = sequence.tracks[j];
                        trackLength = track.moments.length;
                        for(k = 0; k < trackLength; ++k)
                        {
                            moment = track.moments[k];
                            moment.msPositionReSubsequence = moment.msPositionInScore - sequence.msPositionInScore;
                        }
                    }
                }
            }

            sequences = getEmptySequences(nTracks, sequence.tracks[livePerformersTrackIndex]);

            for (trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                fillSequences(sequences, mainSequence, trackIndex);
                //fillSequences(sequences, sequence.tracks[trackIndex].moments);
            }

            sequences = mergeRestSequences(sequences);

            setMsPositionsReSubsequences(sequences);

            return sequences;
        }

        if (!(this instanceof Assistant))
        {
            return new Assistant(sequence, apControlOptions, reportEndOfWholePerformance, reportMillisecondPosition);
        }

        if (apControlOptions === undefined || apControlOptions.livePerformance !== true)
        {
            throw ("Error creating Assistant.");
        }

        options = apControlOptions;

        setState("stopped");

        reportEndOfPerformance = reportEndOfWholePerformance;
        reportMsPosition = reportMillisecondPosition;

        allSequences = getSequences(sequence, options.livePerformersTrackIndex);

        // Starts an assisted performance 
        this.perform = perform;

        // these are called by the performance controls
        this.pause = pause; // pause()        
        this.resume = resume; // resume()
        this.stop = stop; // stop()

        this.isStopped = isStopped; // isStopped()
        this.isPaused = isPaused; // isPaused()

        this.sequences = allSequences; // consulted by score when setting start and end marker positions.
    },

    publicAPI =
    {
        // empty Assistant constructor
        Assistant: Assistant,
        handleMIDIInputEvent: handleMIDIInputEvent
    };
    // end var

    forwardSetState = setState;

    return publicAPI;

}());
