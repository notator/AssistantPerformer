/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  jiAssistant.js
*  The JI_NAMESPACE.assistant namespace which defines the
*    Assistant() constructor.
*  
*/

JI_NAMESPACE.namespace('JI_NAMESPACE.assistant');

JI_NAMESPACE.assistant = (function (window)
{
    "use strict";
    // begin var
    var jiAPControls = JI_NAMESPACE.apControls,
        jiSequence = JI_NAMESPACE.sequence,
        jiTrack = JI_NAMESPACE.track,
        jiMIDIChord = JI_NAMESPACE.midiChord,

    // midi message types
        UNKNOWN = 0,
        NOTE_ON = 1,
        NOTE_OFF = 2,
        EXPRESSION = 3,
        MODULATION_WHEEL = 4,
        PAN = 5,
        PITCH_WHEEL = 6,

        options, // performance options. This is the options object in jiAPControls.
        reportEndOfPerformance, // callback
        reportMsPosition, // callback

        mainSequence, // the sequence from which the sequences are made
        subsequences, // an array of subsequence. Each subsequence is a Sequence.

    // these variables are initialized by playSpan() and used by handleMidiIn() 
        startIndex = -1,
        endIndex = -1,
        currentIndex = -1, // the index of the currently playing subsequence (which will be stopped when a noteOn or noteOff arrives).
        nextIndex = -2, // the index of the subsequence which will be played when a noteOn msg arrives (initially != startIndex) 
        subsequenceStartNow = 0.0, // used only with the relative durations option
        pausedNow = 0.0, // used only with the relative durations option (the time at which the subsequence was paused).

        stopped = true,
        paused = false,

    // makeSubsequences creates the private subsequences array inside the assistant.
    // This function is called when options.assistedPerformance === true and the Start button is clicked in the upper options panel.
    // See the following comment on Sequence.getSubsequences():
    // Each subsequence in the array is a Sequence, beginning (as all Sequences do) at timestamp = 0ms.
    // A subsequence exists for each chord or rest in the live performer's track.
    // A midiMoment which starts a chord sequence has a chordStart attribute.
    // A midiMoment which starts a rest sequence has a restStart attribute.
    // The restStart and chordStart attributes are first allocated in the MIDIChord and MIDIRest constructors. These
    // attributes may be transferred in Track.addMIDIMoment(), so restStart midiMoments are not necessarily empty.
    // Subsequences corresponding to a live performer's chord are given a chordSubsequence attribute (=true).
    // Subsequences corresponding to a live performer's rest are given a restSubsequence attribute (=true).
        makeSubsequences = function (livePerformersTrackIndex, mainSequence)
        {
            subsequences = mainSequence.getSubsequences(livePerformersTrackIndex);
        },

        setState = function (state)
        {
            switch (state)
            {
                case "stopped":
                    // these variables are also set in playSpan() when the state is first set to "running"
                    startIndex = -1;
                    endIndex = -1; // the index of the (unplayed) end chord or rest or endBarline
                    currentIndex = -1;
                    nextIndex = -1;
                    subsequenceStartNow = 0.0; // used only with the relative durations option
                    pausedNow = 0.0; // used only with the relative durations option (the time at which the subsequence was paused).
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
            var subsequence = subsequences[currentIndex];

            if (paused === true)
            {
                if (options.assistantUsesAbsoluteDurations === false)
                {
                    subsequenceStartNow += (window.performance.webkitNow() - pausedNow);
                }
                subsequences[currentIndex].resume();
                setState("running");
            }
        },

    // Can only be called while running
    // (stopped === false && paused === false)
        pause = function ()
        {
            if (stopped === false && paused === false)
            {
                pausedNow = window.performance.webkitNow();
                subsequences[currentIndex].pause();
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

    // Can only be called while running or paused
    // (stopped === false)
        stop = function ()
        {
            if (stopped === false)
            {
                setState("stopped");
                options.inputDevice.removeEventListener("midimessage", function (msg)
                {
                    this.handleMidiIn(msg);
                });

                if (options.assistantUsesAbsoluteDurations === false)
                {
                    // reset the subsequences (they have changed speed individually during the performance).
                    makeSubsequences(mainSequence, options);
                }

                reportEndOfPerformance();
            }
            else
            {
                throw "Attempt to stop a stopped performance.";
            }
        },

    // If options.assistedPerformance === true, this is where input MIDI messages arrive, and where processing is going to be done.
    // Uses 
    //  startIndex (= -1 when stopped),
    //  endIndex  (= -1 when stopped),
    //  currentIndex (= -1 when stopped) the index of the currently playing subsequence (which should be stopped when a noteOn or noteOff arrives).
    //  nextIndex (= -1 when stopped) the index of the subsequence which will be played when a noteOn msg arrives
        handleMidiIn = function (msg)
        {
            /* test code */
            //if (options.outputDevice)
            //{
            //    options.outputDevice.sendMIDIMessage(msg);
            //}

            var msgType, currentIndex, nextIndex;

            // getMessageType returns one of the following constants:
            //  UNKNOWN = 0, NOTE_ON = 1, NOTE_OFF = 2, EXPRESSION = 3, MODULATION_WHEEL = 4, PAN = 5, PITCH_WHEEL = 6
            function getMessageType(msg)
            {
            }

            function stopCurrentlyPlayingSubsequence()
            {
                // currentIndex is the index of the currently playing subsequence
                // (which should be stopped when a noteOn or noteOff arrives).
                if (currentIndex >= 0 && subsequences[currentIndex].IsStopped() === false)
                {
                    subsequences[currentIndex].stop();
                }
            }

            function playNextSubsequence(msg, nextSubsequence, options)
            {
                var now = window.performance.webkitNow(), // in the time frame used by sequences
                    speed = 1.0;

                if (options.assistantUsesAbsoluteDurations === false)
                {
                    if (currentIndex > 0)
                    {
                        speed = (now - subsequenceStartNow) / subsequences[currentIndex - 1].totalMsDuration();
                        // pausedNow need not be set here. It is set (if at all) in pause().
                        nextSubsequence.changeSpeed(speed);
                    }
                    subsequenceStartNow = now; // used only with the relative durations option
                }
                // if options.assistantUsesAbsoluteDurations === true, the durations will already be correct in all subsequences.
                currentIndex = nextIndex++;
                nextSubsequence.playSpan(options.outputDevice, 0, Number.MAX_VALUE, tracksControl, null, null)
            }

            msgType = getMessageType(msg);

            if ((msgType === EXPRESSION && options.expression === true)
            || (msgType === MODULATION_WHEEL && options.modulationWheel === true)
            || (msgType === PAN && options.pan === true)
            || (msgType === PITCH_WHEEL && options.pitchWheel))
            {
                options.outputDevice.sendMIDIMessage(msg);
            }
            else if (nextIndex < 0 || nextIndex >= subsequences.length)
            {
                throw ("illegal index");
            }
            else if (nextIndex === endIndex)
            {
                stop();
            }
            else if (msgType === NOTE_ON)
            {
                stopCurrentlyPlayingSubsequence();

                if (nextIndex === startIndex || subsequences[nextIndex].chordSubsequence !== undefined)
                {
                    playNextSubsequence(msg, subsequences[nextIndex], options);
                    currentIndex = nextIndex++;
                }
                else // subsequences[currentIndex] is a performer's rest subsequence
                {
                    if (subsequences[currentIndex].restSubsequence === undefined)
                    {
                        throw "Subsequence type error.";
                    }
                    stopCurrentlyPlayingSubsequence(); // subsequences[currentIndex].stop();
                    currentIndex = nextIndex++;
                    handleMidiIn(msg); // recursive call
                }
            }
            else if (msgType === NOTE_OFF)
            {
                stopCurrentlyPlayingSubsequence();
                if (subsequences[nextIndex].restSubsequence !== undefined)
                {
                    playNextSubsequence(msg, subsequences[nextIndex], options, speed);
                    currentIndex = nextIndex++;
                }
            }
        },

    // This function is called when options.assistedPerformance === true and the Go button is clicked (in the performance controls).
    // If options.assistedPerformance === false, sequence.playSpan(...) is called instead.
        playSpan = function (fromMs, toMs)
        {
            setState("running");
            startIndex = getStartIndex(subsequences, fromMs);
            endIndex = getEndIndex(subsequences, toMs); // the index of the (unplayed) end chord or rest or endBarline
            currentIndex = -1;
            nextIndex = startIndex;
            subsequenceStartNow = -1;
            // Remove the event listener again when the performance stops. This disconnects the live player while the score is supposed
            // to be playing alone...
            options.inputDevice.addEventListener("midimessage", function (msg)
            {
                this.handleMidiIn(msg);
            });
        },

    // creats an Assistant, complete with private subsequences
    // called when the Start button is clicked, and options.assistedPerformance === true
        Assistant = function (livePerformersTrackIndex, sequence, reportEndOfPerformance, reportMsPosition)
        {
            if (!(this instanceof Assistant))
            {
                return new Assistant(livePerformersTrackIndex, sequence, reportEndOfPerformance, reportMsPosition);
            }

            setState("stopped");

            mainSequence = sequence;

            makeSubsequences(livePerformersTrackIndex, sequence);

            // Starts an assisted performance 
            this.playSpan = playSpan;

            // Receives and handles incoming midi messages
            this.handleMidiIn = handleMidiIn;

            // these are called by the performance controls
            this.pause = pause; // pause()        
            this.resume = resume; // resume()
            this.stop = stop; // stop()

            this.isStopped = isStopped; // isStopped()
            this.isPaused = isPaused; // isPaused()
        },


        publicAPI =
        {
            // empty Assistant constructor
            Assistant: Assistant
        };
    // end var

    return publicAPI;

} (window));
