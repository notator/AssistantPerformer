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

        subsequences, // an array of subsequence. Each subsequence is a Sequence.

        // these variables are initialized by playSpan() and used by handleMidiIn() 
        startIndex = -1,
        endIndex = -1,
        currentIndex = -1, // the index of the currently playing subsequence (which will be stopped when a noteOn or noteOff arrives).
        nextIndex = -1, // the index of the subsequence which will be played when a noteOn msg arrives 
        subsequenceStartNow = 0.0, // used only with the relative durations option
        pausedNow = 0.0, // used only with the relative durations option (the time at which the subsequence was paused).

        stopped = true,
        paused = false,

        // makeSubsequences creates the private subsequences array inside the assistant.
        // This function is called when options.assistedPerformance === true and the Start button is clicked in the upper options panel.
        // The msPositions in each subsequence begin at 0ms, and (if absolute speed is set) the speed option is taken into account.
        // A subsequence contains all the MidiMoments (in _all_ tracks) between the first and last MidiMoments (inclusive)
        // in each of the live performer's chords or rests. A subsequence is actually a short Sequence.
        // (In a Track, the first message in the first and last messages in a chord has a boolean 'reportTimeStamp' attribute.
        // Rests occur where the msPosition of the first MidiMoment in a chord is greater than the msPosition of the last MidiMoment
        // in the previous chord.)
        // Each MIDIMoment which has is given a new attribute:
        //      msPositionInScore
        // These are used as arguments to
        makeSubsequences = function (sequence, options)
        {
            var speed = 1.0;
            if (options.assistantUsesAbsoluteDurations === true)
            {
                speed = options.assistantsSpeed;
            }

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
                    subsequenceStartNow = 0.0, // used only with the relative durations option
                    pausedNow = 0.0, // used only with the relative durations option (the time at which the subsequence was paused).
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
                    subsequenceStartNow += (window.performance.webkitNow() - pauseNow);
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
                pauseNow = window.performance.webkitNow();
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
                    makeSubsequences(sequence, options);
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

            var msgType;

            // getMessageType returns one of the following constants:
            //  UNKNOWN = 0, NOTE_ON = 1, NOTE_OFF = 2, EXPRESSION = 3, MODULATION_WHEEL = 4, PAN = 5, PITCH_WHEEL = 6
            function getMessageType(msg)
            {
            }

            function stopCurrentlyPlayingSubsequence()
            {
                // currentIndex is the index of the currently playing subsequence
                // (which should be stopped when a noteOn or noteOff arrives).
                if (currentIndex > 0 && subsequences[currentIndex].IsStopped() === false)
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
                        speed = (now - subsequenceStartNow) / subsequences[currentIndex - 1].totalMsDuration(); // add this function to Sequence
                        // pausedNow need not be set here, it is set (if at all) in pause().
                        nextSubsequence.changeSpeed(speed); // add this function to Sequence
                    }

                    subsequenceStartNow = now; // used only with the relative durations option
                }
                // if options.assistantUsesAbsoluteDurations === true, the durations will already be correct in the subsequence.

                currentIndex = nextIndex++;
                nextSubsequence.setAbsoluteTime(now); // add this to Sequence
                nextSubsequence.playSpan(options.outputDevice, fromMs, toMs, tracksControl, null, null)
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

                if (subsequences[nextIndex].isAChordSubsequence || nextIndex === startIndex)
                {
                    playNextSubsequence(msg, subsequences[nextIndex], options);
                }
                else // subsequences[index] is a performer's rest subsequence
                {
                    subsequences[index].stop();
                    index++;
                    handleMidiIn(msg); // recursive call
                }
            }
            else if (msgType === NOTE_OFF)
            {
                stopCurrentlyPlayingSubsequence();
                if (subsequences[nextIndex].isAChordSubsequence === false)
                {
                    playNextSubsequence(msg, subsequences[nextIndex], options, speed);
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
        Assistant = function (sequence, options, reportEndOfPerformance, reportMsPosition)
        {
            if (!(this instanceof Assistant))
            {
                return new Assistant(sequence, options, reportEndOfPerformance, reportMsPosition);
            }

            setState("stopped");

            makeSubsequences(sequence, options);

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
