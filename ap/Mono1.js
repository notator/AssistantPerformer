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
/*global _AP: false, performance: false, console: false */

_AP.namespace('_AP.mono1');

_AP.mono1 = (function()
{
    "use strict";

    // begin var
    var
    UNDEFINED_TIMESTAMP = _AP.moment.UNDEFINED_TIMESTAMP,
    Message = _AP.message.Message,
    Moment = _AP.moment.Moment,

    mainSequence, // the complete scoreSequence, all or part of which is played.
    recordingSequence, // the sequence being recorded

    midiOutputDevice,
    performersOptions,

    currentLivePerformersKeyPitch = -1, // -1 means "no key depressed". This value is set when the live performer sends a noteOff

    readOnlyTrackIsOnArray, // from the SVG track control
    spanTrackIsOnArray = [], // used by individual spans, length initialised in init()

    allPerformersSpansInScore,

    // these variables are initialized by play() and used by handleMIDIInputEvent() 
    performedSpans, // the spans between and including the start and end markers.
    endOfSpansIndex = -1, // the index of the (unplayed) last span in a performance (the end chord or rest or endBarline).
    currentSpanIndex = -1, // the index of the currently playing span (which will be stopped when a noteOn or noteOff arrives).
    endOfPerformance = false, // flag, set to true when (currentSpanIndex === endOfSpansIndex)
    nextSpanIndex = 0, // the index of the span which will be played when a noteOn event arrives
    performanceStartNow, // set when the performance starts, used to set the reported duration of the performance  
    currentSpanIsPlaying,

    stopped = true,

    reportEndOfPerformance, // callback
    reportMsPositionInScore, // callback

    isStopped = function()
    {
        return (stopped === true);
    },

    isRunning = function()
    {
        return (stopped === false);
    },

    setState = function(state)
    {
        switch(state)
        {
            case "stopped":
                mainSequence.stop();
                // these variables are also set in perform() when the state is first set to "running"
                endOfSpansIndex = (performedSpans === undefined) ? -1 : (performedSpans.length - 1);
                currentSpanIndex = -1;
                endOfPerformance = false;
                nextSpanIndex = 0;
                stopped = true;
                currentSpanIsPlaying = false;
                break;
            case "running":
                stopped = false;
                break;
            default:
                throw "Unknown sequencer state!";
        }
    },

    // Can be called when paused or running, but not when stopped.
    stop = function()
    {
        var performanceMsDuration;

        if(stopped === false)
        {
            setState("stopped");

            performanceMsDuration = performance.now() - performanceStartNow;

            reportEndOfPerformance(recordingSequence, performanceMsDuration);
        }
    },

    playSpan = function(performedSpans, currentSpanIndex, nextSpanIndex, isFirstSpan)
    {
        var
        i,
        roTrackIsOnArray = readOnlyTrackIsOnArray, // Read only (belongs to the SVG track control at the top of the score).
        spTrackIsOnArray = spanTrackIsOnArray,
        nTracks = roTrackIsOnArray.length,
        trackSpanIsEmpty = performedSpans[currentSpanIndex].trackSpanIsEmpty,
        spanStart = performedSpans[currentSpanIndex].msPosition,
        spanEnd = performedSpans[nextSpanIndex].msPosition;

        // defined for easier debugging...
        function setSpanTrackIsOnArray(spTrackIsOnArray, roTrackIsOnArray, trackSpanIsEmpty)
        {
            for(i = 0; i < nTracks; ++i)
            {
                spTrackIsOnArray[i] = (roTrackIsOnArray[i] === true && trackSpanIsEmpty[i] === false);
            }
        }

        setSpanTrackIsOnArray(spTrackIsOnArray, roTrackIsOnArray, trackSpanIsEmpty);

        currentSpanIsPlaying = true;
        // The durations will be related to the current speedFactor.
        mainSequence.play(spTrackIsOnArray, spanStart, spanEnd, recordingSequence, isFirstSpan, true);
    },

    // This function is called when a performing span reaches its endMsPosition or is stop()ed by
    // a noteOn or noteOff arriving while it is playing.
    // (mono1.stop() overrides sequence.stop(), so that function is never called.)
    // This function is called with two arguments, which are however always ignored here:
    //      reportEndOfSequence(recordingSequence, performanceMsDuration);
    // The performance and recording continue until reportEndOfPerformance is called in mono1.stop() above.
    reportEndOfSpanCallback = function()
    {
        console.log("reportEndOfSpanCallback: nextSpanIndex=%i", nextSpanIndex);

        currentSpanIsPlaying = false;

        if(endOfPerformance)
        {
            stop();
        }
        else
        {
            reportMsPositionInScore(performedSpans[nextSpanIndex].msPosition);
        }
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
    init = function(scoreSequence, options, reportEndOfPerfCallback, reportMsPosCallback)
    {
        var i, nTracks = scoreSequence.tracks.length;

        // A  flat array of spans in msPosition order.
        // each span is a simple object having an msPosition, and a trackSpanIsEmptyArray attribute.
        // The trackSpanIsEmptyArray is an array of booleans, one value per track,
        //      true if there are no midiChords or midiRests in the track between this span and the next,
        //      false otherwise.
        // The final span is at the msPosition of the final barline in the score, and has no trackSpanIsEmptyArray.
        function getAllPerformersSpansInScore(tracks, performersTrackIndex)
        {
            var
            i, span, spans = [],
            performersTrack = tracks[performersTrackIndex],
            midiObject, midiObjects = performersTrack.midiObjects;

            function getTrackSpanIsEmptyArrays(spans, tracks)
            {
                var
                i, t,
                spansLengthMinusOne = spans.length - 1,
                nTracks = tracks.length;

                function doTrackSpanIsEmptyArray(spans, track, trackIndex)
                {
                    var
                    i,
                    spanIndex = 0, spansLengthMinusOne = spans.length - 1, // the final span has msPosition, but no trackSpanIsEmptyArray
                    moIndex, nMidiObjects = track.midiObjects.length,
                    span, spanStart, spanEnd,
                    midiObject, moStart, moEnd;                    
                    
                    for(moIndex = 0; moIndex < nMidiObjects; ++moIndex)
                    {
                        midiObject = track.midiObjects[moIndex];
                        moStart = midiObject.msPositionInScore;
                        moEnd = moStart + midiObject.msDurationInScore;

                        for(spanIndex = 0; spanIndex < spansLengthMinusOne; ++spanIndex)
                        {
                            spanEnd = spans[spanIndex + 1].msPosition;
                            if(spanEnd < moStart)
                            {
                                continue;
                            }

                            span = spans[spanIndex];
                            spanStart = span.msPosition;
                            if(spanStart > moEnd)
                            {
                                break;
                            }

                            if(midiObject.moments[0].restStart !== undefined)
                            {
                                if(spanStart <= moStart && spanEnd > moStart) // a rest
                                {
                                    span.trackSpanIsEmpty[trackIndex] = false;
                                }
                            }
                            else if(spanStart < moEnd && spanEnd > moStart) // a chord
                            {
                                span.trackSpanIsEmpty[trackIndex] = false;
                            }
                        }
                    }
                }

                // the final span has msPosition, but no trackSpanIsEmptyArray
                for(i = 0; i < spansLengthMinusOne; ++i)
                {
                    spans[i].trackSpanIsEmpty = [];
                    for(t = 0; t < nTracks; ++t)
                    {
                        spans[i].trackSpanIsEmpty.push(true);
                    }
                }

                for(t = 0; t < nTracks; ++t)
                {
                    doTrackSpanIsEmptyArray(spans, tracks[t], t);
                }
            }

            for(i = 0; i < midiObjects.length; ++i)
            {
                midiObject = midiObjects[i];
                span = {};
                span.msPosition = midiObject.msPositionInScore;
                if(midiObject.moments[0].restStart !== undefined)
                {
                    span.restSpan = true;
                }
                else if(midiObject.moments[0].chordStart !== undefined)
                {
                    span.chordSpan = true;
                }
                else
                {
                    throw "Error: each span must begin either with a rest or a chord in the performer's track.";
                }
                spans.push(span);
            }

            span = {};
            span.msPosition = performersTrack.endMsPosition();
            spans.push(span);

            getTrackSpanIsEmptyArrays(spans, tracks);

            return spans;
        }

        if(options === undefined || options.livePerformance !== true)
        {
            throw ("Error creating mono1 player.");
        }

        mainSequence = scoreSequence;

        // calls the prototype function
        //      setState("stopped")
        // and sets the prototype variables
        //      tracks = scoreSequence.tracks;
        //      midiOutputDevice = options.outputDevice;
        //      reportEndOfPerformance = reportEndOfSpanCallback; // called as sequence.endOfPerformance when the span reaches its endMsPosition.
        //      reportMsPositionInScore = reportMsPosCallback;
        //      allMsPositionsInScore = scoreSequence.getAllMsPositionsInScore();
        scoreSequence.init(scoreSequence, options, reportEndOfSpanCallback, reportMsPosCallback);

        spanTrackIsOnArray.length = 0;
        for(i = 0; i < nTracks; ++i)
        {
            spanTrackIsOnArray.push(true);
        }

        reportEndOfPerformance = reportEndOfPerfCallback;
        reportMsPositionInScore = reportMsPosCallback;

        midiOutputDevice = options.outputDevice;
        performersOptions = options.performersOptions;

        // each span is an object having an msPosition, and a trackSpanIsEmptyArray attribute.
        // Note that in assisted performances,
        //      startMarkerMsPositions are only possible where there is a midiChord in the performer's track,
        //      endMarkerMsPositions are only possible where there is a midiChord or midiRest in the performer's track.
        // (Currently there is a bug that allows endMarkerMsPositions to be placed on the right edge of a system,
        //  but this is going to be correctd)
        allPerformersSpansInScore = getAllPerformersSpansInScore(scoreSequence.tracks, performersOptions.trackIndex);

        // The noteOn and noteOff handlers will call
        //      sequence.play(spanStartMsPosInScore, spanEndMsPosInScore, readOnlyTrackIsOnArray, recording)
        // whereby the readOnlyTrackIsOnArray is used (but not changed) in combination with the span.trackSpanIsEmptyArray to
        // set track.isPlaying for each track at the beginning of each span.
    },

    // Called when the Go button is clicked, performersOptions.livePerformance === true and the performersOptions.midieventhandler is Mono1.
    // If performersOptions.livePerformance === false, the main sequence.play(...) is called instead.
    // The assistant's allSequences array, which is set in init(), contains the whole piece as an array of sequence,
    // with one sequence per performer's rest or chord, whereby consecutive rests in the performer's track have been merged.
    // This function sets the performedSpans array, which is the section of the allSequences array between startMarkerMsPosition and
    // endMarkerMsPosition (including moments at the endMarkerMsPosition).
    // Except for reseting the timestamps in the moments which are about to be performed, the performedSpans array does *not* change
    // the data in the mainSequence or the readOnlyTrackIsOnArray.
    // The start and end markers can be moved, and tracks selected or deselected between performances.
    play = function(argTrackIsOnArray, startMarkerMsPosition, endMarkerMsPosition, recording, isFirstSpan, isAssisted)
    {
        // Simply returns the section of allPerformersSpansInScore between startMarkerMsPosition and endMarkerMsPosition,
        // including both startMarkerMsPosition and endMarkerPosition.
        function getPerformedSpans(allPerformersSpansInScore, startMarkerMsPosition, endMarkerMsPosition)
        {
            var span, i,
                nSpans = allPerformersSpansInScore.length,
                performedSpans = []; // an array of spans

            for(i = 0; i < nSpans; ++i)
            {
                span = allPerformersSpansInScore[i];
                if(span.msPosition > endMarkerMsPosition)
                {
                    break;
                }
                if(span.msPosition >= startMarkerMsPosition)
                {
                    performedSpans.push(span);
                }
            }

            return performedSpans;
        }

        // Sets the timestamp of every moment that is about to be performed to UNDEFINED_TIMESTAMP.
        // Uses both the readOnlyTrackIsOnArray and span.trackSpanIsEmpty[] flags. 
        function resetMomentTimestamps(spans, readOnlyTrackIsOnArray)
        {
            var
            nTracks = mainSequence.tracks.length, midiObject, moments, nMoments,
            spanStart, spanEnd,
            i, j, k, m, track, trackLength;

            for(i = 1; i < spans.length; ++i)
            {
                spanStart = spans[i - 1].msPosition;
                spanEnd = spans[i].msPosition;
                for(j = 0; j < nTracks; ++j)
                {
                    track = mainSequence.tracks[j];
                    if(readOnlyTrackIsOnArray[j] === true && spans[i - 1].trackSpanIsEmpty[j] === false)
                    {
                        trackLength = track.midiObjects.length;
                        for(k = 0; k < trackLength; ++k)
                        {
                            midiObject = track.midiObjects[k];
                            if(midiObject.msPositionInScore >= spanEnd)
                            {
                                break;
                            }
                            if(midiObject.msPositionInScore >= spanStart)
                            {
                                moments = midiObject.moments;
                                nMoments = moments.length;
                                for(m = 0; m < nMoments; ++m)
                                {
                                    moments[m].timestamp = UNDEFINED_TIMESTAMP;
                                }
                            }
                        }
                    }
                }
            }
        }

        console.assert(isFirstSpan === true);
        console.assert(isAssisted === true);
        mainSequence.initPlay(argTrackIsOnArray, startMarkerMsPosition, endMarkerMsPosition);

        readOnlyTrackIsOnArray = argTrackIsOnArray;
        performedSpans = getPerformedSpans(allPerformersSpansInScore, startMarkerMsPosition, endMarkerMsPosition);
        resetMomentTimestamps(performedSpans, argTrackIsOnArray);

        recordingSequence = recording;

        // the index of the (unplayed) span at the endMarkerPosition (the end chord or rest or endBarline).
        endOfSpansIndex = performedSpans.length - 1;
        currentSpanIndex = -1;
        endOfPerformance = false;
        nextSpanIndex = 0;
        currentSpanIsPlaying = false;

        setState("running");
    },

    // This is where input MIDIEvents arrive, and are processed.
    // SysEx messages are not handled, and it is assumed that RealTime Midi messages are not going
    // to be part of the arriving stream (so they wont be interrupting the messages being received).
    handleMIDIInputEvent = function(msg)
    {
        var CMD = _AP.constants.COMMAND,
            inputEvent, command, data,
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

        function setSpeedFactor(controllerValue, slowerRoot, fasterRoot)
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
            console.log("mono1: speedFactor=%f" + speedFactor);
            mainSequence.setSpeedFactor(speedFactor);
        }

        function handleController(pOpts, controlData, value, usesTracks)
        {
            var
            i,
            nTracks = mainSequence.tracks.length,
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
                    moment = new Moment(0);  // moment.msPositionInChord is never used (this moment is not part of the score).
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
                    if(readOnlyTrackIsOnArray[i] && controllerUsesTracks[i])
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
                    if(readOnlyTrackIsOnArray[i] && controllerUsesTracks[i])
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
            for(i = 0; i < nMoments; ++i)
            {
                track = recordingSequence.trackRecordings[trackMoments[i].trackIndex];

                if(track.isInChord !== undefined) // track.isInChord is defined in TrackRecording.addLiveScoreMoment()
                {
                    moment = trackMoments[i].moment;
                    moment.timestamp = now;
                    track.addLivePerformersControlMoment(moment);

                    midiOutputDevice.send(moment.messages[0].data, now);
                }
            }
        }

        function handleNoteOff(inputEvent)
        {
            if(inputEvent.data[1] === currentLivePerformersKeyPitch)
            {
                currentLivePerformersKeyPitch = -1;

                if(currentSpanIsPlaying === true)
                {
                    // finish the current span (that ends at performedSpans[nextSpanIndex].msPosition).
                    mainSequence.finishSpanSilently(performedSpans[nextSpanIndex].msPosition);
                }

                currentSpanIndex = nextSpanIndex++;
                endOfPerformance = (currentSpanIndex === endOfSpansIndex);

                if(endOfPerformance) // see reportEndOfPerformance() above 
                {
                    stop();
                }
                else if(performedSpans[currentSpanIndex].restSpan === true) // if the next spans are restSpans, play them.
                {
                    while(performedSpans[currentSpanIndex].restSpan === true && !endOfPerformance)
                    {
                        playSpan(performedSpans, currentSpanIndex, nextSpanIndex, false);
                        currentSpanIndex = nextSpanIndex++;
                        endOfPerformance = (currentSpanIndex === endOfSpansIndex);
                    }
                    if(!endOfPerformance)
                    {
                        currentSpanIndex--;
                        nextSpanIndex--;
                        endOfPerformance = (currentSpanIndex === endOfSpansIndex);
                    }
                }
                else
                {
                    if(performedSpans[currentSpanIndex].chordSpan === undefined)
                    {
                        throw "Error: the current span must be a chordSpan here."; 
                    }
                }
            }
        }

        function handleNoteOn(inputEvent)
        {
            var isFirstSpan = false;

            currentLivePerformersKeyPitch = inputEvent.data[1];

            if(endOfPerformance)
            {
                // If the final sequence is playing and a noteOn is received, the performance stops immediately.
                // In this case the final sequence must be a restSpan (otherwise a noteOn can't be received).
                stop();
            }
            else if(inputEvent.data[2] > 0)
            {
                if(nextSpanIndex === 0)
                {
                    isFirstSpan = true;
                    performanceStartNow = inputEvent.receivedTime;
                }

                if(currentSpanIsPlaying === true)
                {
                    // finish the current span (that ends at performedSpans[nextSpanIndex].msPosition).
                    mainSequence.finishSpanSilently(performedSpans[nextSpanIndex].msPosition);
                }

                currentSpanIndex = nextSpanIndex++;
                endOfPerformance = (currentSpanIndex === endOfSpansIndex);

                // skip to the next chordSpan
                while(performedSpans[currentSpanIndex].restSpan === true && !endOfPerformance)
                {
                    currentSpanIndex = nextSpanIndex++;
                    endOfPerformance = (currentSpanIndex === endOfSpansIndex);
                }

                if(!endOfPerformance)
                {
                    if(performedSpans[currentSpanIndex].chordSpan === undefined)
                    {
                        throw "Error: the current span must be a chordSpan here.";
                    }

                    playSpan(performedSpans, currentSpanIndex, nextSpanIndex, isFirstSpan);
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
            data = inputEvent.data;

            switch(command)
            {
                case CMD.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
                    if(pOpts.speedControllerName === "pressure")
                    {
                        setSpeedFactor(data[1], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    //console.log("ChannelPressure, data[1]=%i", data[1]);  // CHANNEL_PRESSURE control has no data[2]
                    if(pOpts.pressureSubstituteControlData !== undefined)
                    {
                        // CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
                        handleController(pOpts, pOpts.pressureSubstituteControlData, data[1], pOpts.pressureTracks);
                    }
                    break;
                case CMD.AFTERTOUCH: // produced by the EWI breath controller
                    if(pOpts.speedControllerName === "pressure")
                    {
                        setSpeedFactor(data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    //console.log("Aftertouch input, key=%i value=%i" + data[1], data[2]);
                    if(pOpts.pressureSubstituteControlData !== undefined)
                    {
                        // AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch, but I dont need that
                        // because the current pitch is kept in currentLivePerformersKeyPitch (in the closure).
                        // AFTERTOUCH.data[2] is the amount of pressure 0..127.
                        handleController(pOpts, pOpts.pressureSubstituteControlData, data[2], pOpts.pressureTracks);
                    }
                    break;
                case CMD.CONTROL_CHANGE: // sent when the input device's mod wheel changes.
                    if(data[1] === _AP.constants.CONTROL.MODWHEEL)
                    {
                        console.log("Modulation Wheel, data[1]=%i, data[2]=%i", data[1], data[2]);
                        if(pOpts.speedControllerName === "modulation wheel")
                        {
                            setSpeedFactor(data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                        }
                        // (EWI bite, EMU modulation wheel (CC 1, Coarse Modulation))
                        if(pOpts.modWheelSubstituteControlData !== undefined)
                        {
                            // data[2] is the value to which to set the changed control
                            handleController(pOpts, pOpts.modWheelSubstituteControlData, data[2], pOpts.modWheelTracks);
                        }
                    }
                    break;
                case CMD.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
                    if(pOpts.speedControllerName === "pitch wheel")
                    {
                        setSpeedFactor(data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                    }
                    console.log("Pitch Wheel, data[1]=%i, data[2]=%i", data[1], data[2]);
                    // by experiment: data[2] is the "high byte" and has a range 0..127. 
                    if(pOpts.pitchWheelSubstituteControlData !== undefined)
                    {
                        // PITCH_WHEEL.data[1] is the 7-bit LSB (0..127) -- ignored here
                        // PITCH_WHEEL.data[2] is the 7-bit MSB (0..127)
                        handleController(pOpts, pOpts.pitchWheelSubstituteControlData, data[2], pOpts.pitchWheelTracks);
                    }
                    break;
                case CMD.NOTE_ON:
                    console.log("NoteOn, pitch:%i, velocity=%i", data[1], data[2]);
                    if(data[2] !== 0)
                    {
                        if(pOpts.speedControllerName === "noteOn: pitch")
                        {
                            setSpeedFactor(data[1], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                        }
                        else if(pOpts.speedControllerName === "noteOn: velocity")
                        {
                            setSpeedFactor(data[2], pOpts.slowerSpeedRoot, pOpts.fasterSpeedRoot);
                        }
                        handleNoteOn(inputEvent);
                    }
                    else
                    {
                        handleNoteOff(inputEvent);
                    }
                    break;
                case CMD.NOTE_OFF:
                    console.log("NoteOff, pitch:%i, velocity=%i", data[1], data[2]);
                    handleNoteOff(inputEvent);
                    break;
                default:
                    break;
            }
        }
    },

    publicAPI =
    {
        isStopped: isStopped,
        isRunning: isRunning,
        stop: stop,

        init: init,
        play: play,
        handleMIDIInputEvent: handleMIDIInputEvent
    };
    // end var

    return publicAPI;

}());

