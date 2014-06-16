/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Mono1.js
*  The _AP.mono1 namespace which has the following interface
*  
*       init()
*
*       play()
*       pause()
*       resume()
*       stop()
*       isStopped()
*       isPaused()
*
*       handleMIDIInputEvent(msg) [message handler for input devices]. 
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.mono1');

_AP.mono1 = (function ()
{
    "use strict";

    // begin var
    var
    UNDEFINED_TIMESTAMP = _AP.moment.UNDEFINED_TIMESTAMP,
    CMD = _AP.constants.COMMAND,
    Message = _AP.message.Message,
    Moment = _AP.moment.Moment,
    Sequence = _AP.sequence.Sequence,
 
    trackIsOnArray,

    currentLivePerformersKeyPitch = -1, // -1 means "no key depressed". This value is set when the live performer sends a noteOff

    performersOptions,
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

    // Each performedSequence calls this function (with two arguments) when
    // it stops:
    //      reportEndOfSequence(recordingSequence, performanceMsDuration);
    // but those arguments are ignored here. The recording continues until
    // the end of the performance, and performanceMsDuration is the duration
    // set by the beginning of the following performedSequence.
    // These values are passed back to the calling environment, when the
    // assistant stops, using the callback:
    //      reportEndOfPerformance(recordingSequence, performanceMsDuration);
    reportEndOfSequence = function()
    {
        if(endOfPerformance)
        {
            stop();
        }
        else
        {
            reportMsPosition(performedSequences[nextIndex].msPositionInScore);
        }
    },

    // If performersOptions.livePerformance === true, this is where input
    // MIDIEvents arrive, and where processing is going to be done.
    // The Assistant
    // a) ignores both RealTime and SysEx messages in its input, and
    // b) assumes that RealTime messages will not interrupt the messages being received.    
    handleMIDIInputEvent = function (msg)
    {
        var inputEvent, command,
            pOpts = performersOptions;

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

        function setSpeedFactor(sequenceIndex, controllerValue, slowerRoot, fasterRoot)
        {
            var speedFactor;
            // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
            //     factor = fasterRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumFactor
            // If the controller's value is < 64, the factor which is passed to tick() will be
            //     factor = slowerRoot ^ (64 - cv) -- if cv = 0, factor will be 1/maximumFactor
            function getSpeedFactor(controllerValue, slowerRoot, fasterRoot)
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

                return factor;
            }

            speedFactor = getSpeedFactor(controllerValue, slowerRoot, fasterRoot);
            console.log("mono1: speedFactor=" + speedFactor.toString(10));
            performedSequences[sequenceIndex].setSpeedFactor(speedFactor);
        }

        function handleController(pOpts, controlData, value, usesTracks)
        {
            var
            i,
            nTracks = allSequences[0].tracks.length,
            now = performance.now(),
            trackMoments, nMoments, moment, track;
        
            // Each trackMoment.moment is a Moment whose .messages attribute contains one message,
            // trackMoment.trackIndex is the moment's track index (=channel).
            // Returns null if no new trackMoment is created.
            function newTrackMoment(controlData, trackIndex, value)
            {
                var message, moment = null, trackMoment = null;

                // controlData is the controlData received from the live performer (via the controlSelector pop-ups).
                // value is the control value received from the live performer (or a newly calculated volume value).
                // trackIndex is the new message's trackIndex.
                // Returns null if no message is created for some reason.
                function newControlMessage(controlData, value, trackIndex)
                {
                    var
                    CMD = _AP.constants.COMMAND,
                    message = null;

                    if(controlData.midiControl !== undefined) // a normal control (including volume, whose value is handled earlier)
                    {
                        message = new Message(CMD.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
                    }
                    else if(controlData.command !== undefined)
                    {
                        switch(controlData.command)
                        {
                            case CMD.AFTERTOUCH:
                                if(currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
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

                message = newControlMessage(controlData, value, trackIndex);
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

            // Returns a new array of (synchronous) volume trackMoments.
            // This function calculates new volume values for each track.
            function getTrackVolumeMoments(pOpts, nTracks, controlData, value, controllerUsesTracks)
            {
                var
                i, trackMoments = [], trackMoment, abstractVolume, trackVolume;

                if(controlData.midiControl !== _AP.constants.CONTROL.VOLUME)
                {
                    throw "Error: this function only handles volume.";
                }

                abstractVolume = pOpts.minVolume + (value * pOpts.volumeScale);

                for(i = 0; i < nTracks; ++i)
                {
                    if(trackIsOnArray[i] && controllerUsesTracks[i])
                    {
                        trackVolume = (pOpts.masterVolumes[i] / 127) * abstractVolume;

                        trackMoment = newTrackMoment(controlData, i, trackVolume);
                        if(trackMoment !== null)
                        {
                            trackMoments.push(trackMoment);
                        }
                    }
                }

                return trackMoments;
            }

            // Returns a new array of (synchronous) trackMoments.
            // Each trackMoment.moment is a Moment whose .messages attribute contains one message,
            // trackMoment.trackIndex is the moment's track index (=channel).
            function getTrackMoments(nTracks, controlData, value, controllerUsesTracks)
            {
                var
                i, trackMoments = [], trackMoment;

                for(i = 0; i < nTracks; ++i)
                {
                    if(trackIsOnArray[i] && controllerUsesTracks[i])
                    {
                        trackMoment = newTrackMoment(controlData, i, value);
                        if(trackMoment !== null)
                        {
                            trackMoments.push(trackMoment);
                        }
                    }
                }

                return trackMoments;
            }

            if(controlData.midiControl === _AP.constants.CONTROL.VOLUME)
            {
                trackMoments = getTrackVolumeMoments(pOpts, nTracks, controlData, value, usesTracks);
            }
            else
            {
                trackMoments = getTrackMoments(nTracks, controlData, value, usesTracks);
            }
            nMoments = trackMoments.length;
            if(recordingSequence === undefined || recordingSequence === null)
            {
                throw "Error: a recordingSequence must be available here.";
            }
            for (i = 0; i < nMoments; ++i)
            {
                track = recordingSequence.trackRecordings[trackMoments[i].trackIndex];

                if(track.isInChord !== undefined) // track.isInChord is defined in TrackRecording.addLiveScoreMoment()
                {
                    moment = trackMoments[i].moment;
                    moment.timestamp = now;
                    track.addLivePerformersControlMoment(moment);

                    pOpts.outputDevice.send(moment.messages[0].data, now);
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

        function playSequence(sequence)
        {
            // The durations will be related to the moment.msPositionReSubsequence attributes (which have been
            // set relative to the start of each subsequence), and to the speedFactor which has been set.
            sequence.play(0, Number.MAX_VALUE, trackIsOnArray, recordingSequence);
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

        function handleNoteOn(inputEvent)
        {
            var
            allSubsequences = performedSequences;

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
                    if(pOpts.speedControllerName === "pressure")
                    {
                        setSpeedFactor(currentIndex, inputEvent.data[1], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    console.log("ChannelPressure, data[1]:", inputEvent.data[1].toString());  // CHANNEL_PRESSURE control has no data[2]
                    if(pOpts.pressureSubstituteControlData !== undefined)
                    {
                        // CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
                        handleController(pOpts, pOpts.pressureSubstituteControlData, inputEvent.data[1], pOpts.pressureTracks);
                    }
                    break;
                case CMD.AFTERTOUCH: // produced by the EWI breath controller
                    if(pOpts.speedControllerName === "pressure")
                    {
                        setSpeedFactor(currentIndex, inputEvent.data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    console.log("Aftertouch input, key:" + inputEvent.data[1].toString() + " value:", inputEvent.data[2].toString()); 
                    if (pOpts.pressureSubstituteControlData !== undefined)
                    {
                        // AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch, but I dont need that
                        // because the current pitch is kept in currentLivePerformersKeyPitch (in the closure).
                        // AFTERTOUCH.data[2] is the amount of pressure 0..127.
                        handleController(pOpts, pOpts.pressureSubstituteControlData, inputEvent.data[2], pOpts.pressureTracks);
                    }
                    break;
                case CMD.CONTROL_CHANGE: // sent when the input device's mod wheel changes.
                    if(inputEvent.data[1] === _AP.constants.CONTROL.MODWHEEL)
                    {
                        console.log("Modulation Wheel, data[1]:", inputEvent.data[1].toString() + " data[2]:", inputEvent.data[2].toString());
                        if(pOpts.speedControllerName === "modulation wheel")
                        {
                            setSpeedFactor(currentIndex, inputEvent.data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                        }
                        // (EWI bite, EMU modulation wheel (CC 1, Coarse Modulation))
                        if(pOpts.modWheelSubstituteControlData !== undefined)
                        {
                            // inputEvent.data[2] is the value to which to set the changed control
                            handleController(pOpts, pOpts.modWheelSubstituteControlData, inputEvent.data[2], pOpts.modWheelTracks);
                        }
                    }
                    break;
                case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
                    if(pOpts.speedControllerName === "pitch wheel")
                    {
                        setSpeedFactor(currentIndex, inputEvent.data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    console.log("Pitch Wheel, data[1]:", inputEvent.data[1].toString() + " data[2]:", inputEvent.data[2].toString());
                    // by experiment: inputEvent.data[2] is the "high byte" and has a range 0..127. 
                    if(pOpts.pitchWheelSubstituteControlData !== undefined)
                    {
                        // PITCH_WHEEL.data[1] is the 7-bit LSB (0..127) -- ignored here
                        // PITCH_WHEEL.data[2] is the 7-bit MSB (0..127)
                        handleController(pOpts, pOpts.pitchWheelSubstituteControlData, inputEvent.data[2], pOpts.pitchWheelTracks);
                    }
                    break;
                case CMD.NOTE_ON:
                    console.log("NoteOn, pitch:", inputEvent.data[1].toString(), " velocity:", inputEvent.data[2].toString());
                    if(inputEvent.data[2] !== 0)
                    {
                        if(nextIndex < performedSequences.length)
                        {
                            if(pOpts.speedControllerName === "noteOn: pitch")
                            {
                                setSpeedFactor(nextIndex, inputEvent.data[1], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                            }
                            else if(pOpts.speedControllerName === "noteOn: velocity")
                            {
                                setSpeedFactor(nextIndex, inputEvent.data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                            }
                        }
                        handleNoteOn(inputEvent);
                    }
                    else
                    {
                        handleNoteOff(inputEvent);
                    }
                    break;
                case CMD.NOTE_OFF:
                    console.log("NoteOff, pitch:", inputEvent.data[1].toString(), " velocity:", inputEvent.data[2].toString());
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
            if (performersOptions.assistantUsesAbsoluteDurations === false)
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

    // mono1.init(...) is called when the Start button is clicked, options.livePerformance === true and
    // options.performersOptions.midiEventHandler === mono1.
    // The options object has the following attributes:
    //      .globalSpeed -- now redundant
    //      .inputDevice  -- now reundant
    //      .livePerformance -- now redundant (always true here)
    //      .outputDevice
    //      .performersOptions
    //
    // options.performersOptions can have the following attributes:
    //
    //      nTracks -- the number of tracks in the score
    //      trackIndex -- the performer's trackIndex
    //      midiEventHandler -- the namespace containing the event handler
    //      pressureSubstituteControlData -- undefined or a controlData object (see below)
    //      pressureTracks -- undefined or array of bool, length nTracks
    //      pitchWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      pitchWheelTracks -- undefined or array of bool, length nTracks
    //      modWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      modWheelTracks -- undefined or array of bool, length nTracks
    //      masterVolumes -- array of int, range 0..127, length nTracks
    //      minVolume -- int in range 0..127 (0 by default if volume is not being controlled)
    //      volumeScale -- (127 - options.minVolume) / 127 (see below)
    //      speedControllerName -- undefined, or one of the effective poSpeedControllerSelect option strings (see below)
    //      speedMaxFactor -- undefined (if speed is not being controlled) or a float greater or equal to 1. (not a percent)
    //
    // If the volume is being controlled live, track volumes will be set as follows: 
    //      abstractVolume = options.minVolume + (receivedVolumeValue * volumeScale);
    //      trackVolume =  (trackMasterVolume / 127 ) * abstractVolume).
    //
    // A controlData object is set from the dialog's current controlOptions settings.
    // It has one of the following attributes:
    //      command
    //      midiControl
    // If the controlData object is undefined, then so is the corresponding ...Tracks array.
    //
    // The effective poSpeedControllerSelect option strings are: (see speedController above):
    //      "noteOn: pitch"
    //      "noteOn: velocity"
    //      "pressure"
    //      "pitch wheel"
    //      "modulation wheel"
    // If the speedController is undefined, then so are slowerSpeedRoot and fasterSpeedRoot.
    // The roots are calculated as follows:
    // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
    //     factor = fasterSpeedRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumSpeedFactor
    // If the controller's value is < 64, the factor which is passed to tick() will be
    //     factor = slowerSpeedRoot ^ (64 - cv) -- if cv = 0, factor will is 1/maximumFactor
    // fasterSpeedRoot is therefore the 63rd root of maximumSpeedFactor, and
    // slowerSpeedRoot is the 63rd root of 1/maximumSpeedFactor.
    init = function(sequenceTracks, options, reportEndOfPerf, reportMsPos)
    {
        var i, sequences, nSequences, sequence;

        // Returns an array of Sequence.
        // Each sequence in the array contains moments from the main sequence (which contains no barlines).
        // A sequence is first created for each chord or rest symbol. 
        // Sequences corresponding to a live performer's chord are given a chordSequence attribute (=true).
        // Sequences corresponding to a live performer's rest are given a restSequence attribute (=true).
        // Consecutive restSequences are merged: When performing, consecutive rests in the performer's track are treated
        // as one. The live performer only starts the first one (with a noteOff). Following rests play automatically until
        // the next chord (chordSequence) in the performer's track.
        // The msPositionReSubsequence attributes are set for all midiObjects.
        function getSequences(sequenceTracks, livePerformersTrackIndex)
        {
            var
            sequences = [],
            nTracks = sequenceTracks.length,
            trackIndex;

            // The returned empty sequences have been given an msPositionInScore attribute,
            // and either a restSequence or a chordSequence attribute, 
            // depending on whether they correspond to a live player's rest or chord.
            // They also contain the correct number of empty tracks.
            function getEmptySequences(nTracks, livePerformersTrack)
            {
                var s, emptySequences = [],
                    performersMIDIObjects, nPerformersMIDIObjects, i,
                    midiObject;

                performersMIDIObjects = livePerformersTrack.midiObjects;
                nPerformersMIDIObjects = performersMIDIObjects.length;
                for(i = 0; i < nPerformersMIDIObjects; ++i)
                {
                    s = null;
                    midiObject = performersMIDIObjects[i];

                    if((midiObject.moments.length === 1 && midiObject.moments[0].restStart === true))
                    {
                        s = new Sequence(nTracks);
                        Object.defineProperty(s, "restSequence", { value: true, writable: false });
                        Object.defineProperty(s, "msPositionInScore", { value: midiObject.msPositionInScore, writable: false });
                        //console.log("Rest Sequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }
                    else // is Chord
                    {
                        s = new Sequence(nTracks);
                        Object.defineProperty(s, "chordSequence", { value: true, writable: false });
                        Object.defineProperty(s, "msPositionInScore", { value: midiObject.msPositionInScore, writable: false });
                        //console.log("Chord Sequence: msPositionInScore=" + s.msPositionInScore.toString());
                    }

                    if(s !== null)
                    {
                        emptySequences.push(s);
                    }
                }
                return emptySequences;
            }

            function fillSequences(sequences, mainSequenceTracks, trackIndex)  // 'base' function in outer scope.
            {
                var track, midiObjects = mainSequenceTracks[trackIndex].midiObjects,
                    midiObject, midiObjectsIndex = 0,
                    nMidiObjects = midiObjects.length,
                    sequence, sequencesIndex,
                    nSequences = sequences.length, // including the final barline
                    nextSequenceMsPositionInScore;

                function getNextSequenceMsPositionInScore(sequences, sequencesIndex, nSequences)
                {
                    var nextSequenceMsPositionInScore, nextIndex = sequencesIndex + 1;

                    if(nextIndex < nSequences)
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
                for(sequencesIndex = 0; sequencesIndex < nSequences; ++sequencesIndex)
                {
                    sequence = sequences[sequencesIndex];
                    nextSequenceMsPositionInScore = getNextSequenceMsPositionInScore(sequences, sequencesIndex, nSequences);
                    track = sequence.tracks[trackIndex];
                    // nMidiObjects may be 0 (an empty track)
                    if(nMidiObjects > 0 && midiObjectsIndex < nMidiObjects)
                    {
                        midiObject = midiObjects[midiObjectsIndex];

                        while(midiObject.msPositionInScore < nextSequenceMsPositionInScore)
                        {
                            track.midiObjects.push(midiObject);
                            ++midiObjectsIndex;
                            if(midiObjectsIndex === nMidiObjects)
                            {
                                break;
                            }
                            midiObject = midiObjects[midiObjectsIndex];
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
                sequence, t, currentTrack, trackToAppend, nMidiObjects,
                im;

                newSequences.push(sequences[0]);

                for(i = 1; i < nSequences; ++i)
                {
                    lastNewS = newSequences[newSequences.length - 1];
                    if(lastNewS.restSequence !== undefined && sequences[i].restSequence !== undefined)
                    {
                        sequence = sequences[i];
                        // append sequence to lastnewS
                        for(t = 0; t < nTracks; ++t)
                        {
                            currentTrack = lastNewS.tracks[t];
                            trackToAppend = sequence.tracks[t];
                            nMidiObjects = trackToAppend.midiObjects.length;
                            for(im = 0; im < nMidiObjects; ++im)
                            {
                                currentTrack.midiObjects.push(trackToAppend.midiObjects[im]);
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
                nTracks = sequences[0].tracks.length, midiObject,
                i, j, k, track, trackLength;

                for(i = 0; i < sequences.length; ++i)
                {
                    sequence = sequences[i];
                    for(j = 0; j < nTracks; ++j)
                    {
                        track = sequence.tracks[j];
                        trackLength = track.midiObjects.length;
                        for(k = 0; k < trackLength; ++k)
                        {
                            midiObject = track.midiObjects[k];
                            midiObject.msPositionReSubsequence = midiObject.msPositionInScore - sequence.msPositionInScore;
                        }
                    }
                }
            }

            sequences = getEmptySequences(nTracks, sequenceTracks[livePerformersTrackIndex]);

            for(trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                fillSequences(sequences, sequenceTracks, trackIndex);
                //fillSequences(sequences, sequence.tracks[trackIndex].moments);
            }

            sequences = mergeRestSequences(sequences);

            setMsPositionsReSubsequences(sequences);

            return sequences;
        }

        if(options === undefined || options.livePerformance !== true)
        {
            throw ("Error creating mono1 player.");
        }

        performersOptions = options.performersOptions;

        setState("stopped");

        reportEndOfPerformance = reportEndOfPerf;
        reportMsPosition = reportMsPos;

        sequences = getSequences(sequenceTracks, performersOptions.trackIndex);

        nSequences = sequences.length; 
        for(i = 0; i < nSequences; ++i)
        {
            sequence = sequences[i];
            sequence.init(sequence.tracks, options, reportEndOfSequence, reportMsPos);
        }

        allSequences = sequences;
    },

    // Called when the Go button is clicked, performersOptions.livePerformance === true and the performersOptions.midieventhandler is Mono1.
    // If performersOptions.livePerformance === false, the main sequence.play(...) is called instead.
    // The assistant's allSequences array, which is set in init(), contains the whole piece as an array of sequence,
    // with one sequence per performer's rest or chord, whereby consecutive rests in the performer's track have been merged.
    // This function sets the performedSequences array, which is the section of the allSequences array between startMarkerMsPosition and
    // endMarkerMsPosition (not including moments at the endMarkerMsPosition).
    // Creating the performedSequences array does *not* change the data in allSequences, so the start and end markers can be moved between
    // performances.
    play = function(startMarkerMsPosition, endMarkerMsPosition, argTrackIsOnArray, recording)
    {
        function getPerformedSequences(allSequences, startMarkerMsPosition, endMarkerMsPosition)
        {
            var sequence, i,
                nSequences = allSequences.length,
                performedSequences = []; // an array of sequences

            function resetTimestamps(sequences)
            {
                var
                nTracks = sequence.tracks.length, moments, nMoments,
                i, j, k, m, track, trackLength;

                for(i = 0; i < sequences.length; ++i)
                {
                    sequence = sequences[i];
                    for(j = 0; j < nTracks; ++j)
                    {
                        track = sequence.tracks[j];
                        trackLength = track.midiObjects.length;
                        for(k = 0; k < trackLength; ++k)
                        {
                            moments = track.midiObjects[k].moments;
                            nMoments = moments.length;
                            for(m = 0; m < nMoments; ++m)
                            {
                                moments[m].timestamp = UNDEFINED_TIMESTAMP;
                            }
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

        // trackIsOnArray is read only
        trackIsOnArray = argTrackIsOnArray;
        performedSequences = getPerformedSequences(allSequences, startMarkerMsPosition, endMarkerMsPosition);
        recordingSequence = recording;

        endIndex = performedSequences.length - 1;
        currentIndex = -1;
        endOfPerformance = false;
        nextIndex = 0;
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

        handleMIDIInputEvent: handleMIDIInputEvent
    };
    // end var

    forwardSetState = setState;

    return publicAPI;

}());
