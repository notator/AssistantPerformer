/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Controls.js
*  The _AP.controls namespace which defines the
*  _AP Performer's Graphic User Interface.
*  
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.controls');

_AP.controls = (function (document, window)
{
    "use strict";

    var
    tracksControl = _AP.tracksControl,
    Score = _AP.score.Score,
    Assistant = _AP.assistant.Assistant,

    Sequence = MIDILib.sequence.Sequence,
    COMMAND = MIDILib.constants.COMMAND,
    CONTROL = MIDILib.constants.CONTROL,
    sequenceToSMF = MIDILib.standardMIDIFile.sequenceToSMF,

    midiAccess,
    score,
    svg = {}, // an object containing pointers to functions defined in SVG files
    assistant,
    sequence,
    livePerformerIsSilent = false,
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    svgPagesDiv,
    mo = {}, // main option panel elements
    cl = {}, // control layers

    // constants for control layer opacity values
    METAL = "1", // control layer is completely opaque
    SMOKE = "0.7", // control layer is smoky (semi-transparent)
    GLASS = "0", // control layer is completely transparent

    // Options set in the pop-up menues in the main options dialog
    controlOptions =
    [
        { name: "aftertouch", command: COMMAND.AFTERTOUCH },
        { name: "channel pressure", command: COMMAND.CHANNEL_PRESSURE },
        { name: "pitch wheel", command: COMMAND.PITCH_WHEEL },
        { name: "modulation (1)", midiControl: CONTROL.MODWHEEL },
        { name: "volume (7)", midiControl: CONTROL.VOLUME },
        { name: "pan (10)", midiControl: CONTROL.PAN },
        { name: "expression (11)", midiControl: CONTROL.EXPRESSION },
        { name: "timbre (71)", midiControl: CONTROL.TIMBRE },
        { name: "brightness (74)", midiControl: CONTROL.BRIGHTNESS },
        { name: "effects (91)", midiControl: CONTROL.EFFECTS },
        { name: "tremolo (92)", midiControl: CONTROL.TREMOLO },
        { name: "chorus (93)", midiControl: CONTROL.CHORUS },
        { name: "celeste (94)", midiControl: CONTROL.CELESTE },
        { name: "phaser (95)", midiControl: CONTROL.PHASER }
    ],

    // options set in the top dialog
    options = {},

    scoreHasJustBeenSelected = false,

    // deletes the 'save' button created by createSaveMIDIFileButton() 
    deleteSaveMIDIFileButton = function ()
    {
        var 
        downloadLinkDiv,
        downloadLink = document.getElementById("downloadLink");

        if (downloadLink)
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv");
            downloadLinkDiv.innerHTML = '';

            // Need a small delay for the revokeObjectURL to work properly.
            window.setTimeout(function ()
            {
                window.URL.revokeObjectURL(downloadLink.href); // window.URL is set in Main.js
            }, 1500);
        }
    },

    // Returns true if any of the tracks contain moments, otherwise false.
    // Used to prevent the creation of a 'save' button when there is nothing to save.
    hasData = function (nTracks, tracks)
    {
        var i, has = false;
        for (i = 0; i < nTracks; ++i)
        {
            if (tracks[i].moments.length > 0)
            {
                has = true;
                break;
            }
        }
        return has;
    },

    // Returns the name of the file to be downloaded
    // The date part of the name is formatted as
    //     year-month-day, with month and day always having two characters
    // so that downloaded files will list in order of creation time.
    getMIDIFileName = function (scoreName)
    {
        var 
        d = new Date(),
        dayOfTheMonth = (d.getDate()).toString(),
        month = (d.getMonth() + 1).toString(),
        year = (d.getFullYear()).toString(),
        downloadName;

        if (month.length === 1)
        {
            month = "0".concat(month);
        }

        if (dayOfTheMonth.length === 1)
        {
            dayOfTheMonth = "0".concat(dayOfTheMonth);
        }

        downloadName = scoreName.concat('_', year, '-', month, '-', dayOfTheMonth, '.mid'); // .mid is added in case scoreName contains a '.'.

        return downloadName;
    },

    // Creates a button which, when clicked, downloads a standard MIDI file recording
    // of the sequence which has just stopped playing.
    // The performance may have ended by reaching the stop marker, or by the user clicking
    // the 'stop' button.
    // The 'save' button (and its associated recording) are deleted
    //    either when it is clicked (and the file has been downloaded)
    //    or when a new performance is started
    //    or when the user clicks the 'set options' button
    // Arguments:
    // scoreName is the name of the score (as selected in the main score selector).
    //     The name of the downloaded file is:
    //         scoreName + '_' + the current date (format:year-month-day) + '.mid'.
    //         (e.g. "Study 2c3.1_2013-01-08.mid")
    // sequence is a MIDILib.sequence.Sequence object.
    // sequenceMsDuration is the total duration of the sequence in milliseconds (an integer).
    //      and determines the timing of the end-of-track events. When this is a recorded sequence,
    //      this value is simply the duration between the start and end markers.
    createSaveMIDIFileButton = function (scoreName, sequence, sequenceMsDuration)
    {
        var 
        standardMIDIFile,
        downloadName,
        downloadLinkDiv, a,
        nTracks = sequence.tracks.length;

        if (hasData(nTracks, sequence.tracks))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the empty Element which will contain the link
            downloadName = getMIDIFileName(scoreName);

            standardMIDIFile = sequenceToSMF(sequence, sequenceMsDuration);

            a = document.createElement('a');
            a.id = "downloadLink";
            a.download = downloadName;
            a.href = window.URL.createObjectURL(standardMIDIFile); // window.URL is set in Main.js
            a.innerHTML = '<img id="saveImg" border="0" src="images/saveMouseOut.png" alt="saveMouseOutImage" width="56" height="31">';

            a.onmouseover = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = "images/saveMouseOver.png";
                a.style.cursor = 'default';
            };

            a.onmouseout = function (e)
            {
                var img = document.getElementById("saveImg");
                img.src = "images/saveMouseOut.png";
            };

            a.onclick = function (e)
            {
                deleteSaveMIDIFileButton();
            };

            downloadLinkDiv.appendChild(a);
        }
    },

    // This function is called when the input or output device selectors change.
    setMIDIDevices = function ()
    {
        var 
        inSelector = document.getElementById("midiInputDeviceSelector"),
        outSelector = document.getElementById("midiOutputDeviceSelector");

        if(inSelector.selectedIndex === 0)
        {
            options.inputDevice = null;
        }
        else
        {
            options.inputDevice = inSelector.options[inSelector.selectedIndex].inputDevice;
        }

        if(outSelector.selectedIndex === 0)
        {
            options.outputDevice = null;
        }
        else
        {
            options.outputDevice = outSelector.options[outSelector.selectedIndex].outputDevice;
        }
    },

    setControlSubstitutionSelectorsDisabledState = function ()
    {
        if(mo.usesPressureSoloCheckbox.disabled === false && (mo.usesPressureSoloCheckbox.checked === true || mo.usesPressureOtherTracksCheckbox.checked === true))
        {
            mo.pressureSubstituteControlDataSelector.disabled = false;
        }
        else
        {
            mo.pressureSubstituteControlDataSelector.disabled = true;
        }

        if(mo.usesPitchBendSoloCheckbox.disabled === false && (mo.usesPitchBendSoloCheckbox.checked === true || mo.usesPitchBendOtherTracksCheckbox.checked === true))
        {
            mo.pitchBendSubstituteControlDataSelector.disabled = false;
        }
        else
        {
            mo.pitchBendSubstituteControlDataSelector.disabled = true;
        }

        if(mo.usesModSoloCheckbox.disabled === false && (mo.usesModSoloCheckbox.checked === true || mo.usesModOtherTracksCheckbox.checked === true))
        {
            mo.modSustituteControlSelector.disabled = false;
        }
        else
        {
            mo.modSustituteControlSelector.disabled = true;
        }
    },

    setMainOptionsState = function (mainOptionsState)
    {
        var inputDeviceIndex, scoreIndex, outputDeviceIndex;

        switch (mainOptionsState)
        {
            case "enable":
                mo.controlPanel.style.visibility = "hidden";
                mo.svgPages.style.visibility = "hidden";
                mo.titleOptionsDiv.style.visibility = "visible";

                inputDeviceIndex = mo.midiInputDeviceSelector.selectedIndex;
                scoreIndex = mo.scoreSelector.selectedIndex;
                outputDeviceIndex = mo.midiOutputDeviceSelector.selectedIndex;

                mo.midiInputDeviceSelector.disabled = false;
                mo.scoreSelector.disabled = false;
                mo.midiOutputDeviceSelector.disabled = false;

                if (scoreIndex === 0)
                {
                    mo.trackSelector.disabled = true;

                    mo.soloVelocityOptionCheckbox.disabled = true;
                    mo.otherTracksVelocityOptionCheckbox.disabled = true;
                    mo.soloPitchOptionCheckbox.disabled = true;
                    mo.otherTracksPitchOptionCheckbox.disabled = true;

                    mo.usesPressureSoloCheckbox.disabled = true;
                    mo.usesPressureOtherTracksCheckbox.disabled = true;

                    mo.usesModSoloCheckbox.disabled = true;
                    mo.usesModOtherTracksCheckbox.disabled = true;

                    mo.usesPitchBendSoloCheckbox.disabled = true;
                    mo.usesPitchBendOtherTracksCheckbox.disabled = true;

                    mo.assistantsSpeedInputText.disabled = true;
                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButtonLabel.disabled = true;

                }
                else if (inputDeviceIndex > 0) // && scoreIndex > 0
                {
                    mo.trackSelector.disabled = false;

                    mo.soloVelocityOptionCheckbox.disabled = false;
                    mo.otherTracksVelocityOptionCheckbox.disabled = false;
                    mo.soloPitchOptionCheckbox.disabled = false;
                    mo.otherTracksPitchOptionCheckbox.disabled = false;

                    mo.usesPressureSoloCheckbox.disabled = false;
                    mo.usesPressureOtherTracksCheckbox.disabled = false;

                    mo.usesPitchBendSoloCheckbox.disabled = false;
                    mo.usesPitchBendOtherTracksCheckbox.disabled = false;

                    mo.usesModSoloCheckbox.disabled = false;
                    mo.usesModOtherTracksCheckbox.disabled = false;

                    mo.assistantsSpeedInputText.disabled = false;
                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = false;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = false;
                    mo.assistantUsesRelativeDurationsRadioButtonLabel.disabled = false;
                }
                else // inputDevice === 0, scoreIndex > 0 (The speed option can be used with or without a midi input device).
                {
                    mo.trackSelector.disabled = true;

                    mo.soloVelocityOptionCheckbox.disabled = true;
                    mo.otherTracksVelocityOptionCheckbox.disabled = true;
                    mo.soloPitchOptionCheckbox.disabled = true;
                    mo.otherTracksPitchOptionCheckbox.disabled = true;

                    mo.usesPressureSoloCheckbox.disabled = true;
                    mo.usesPressureOtherTracksCheckbox.disabled = true;

                    mo.usesModSoloCheckbox.disabled = true;
                    mo.usesModOtherTracksCheckbox.disabled = true;

                    mo.usesPitchBendSoloCheckbox.disabled = true;
                    mo.usesPitchBendOtherTracksCheckbox.disabled = true;

                    // The speed option can be used with or without a midi input device.
                    mo.assistantsSpeedInputText.disabled = false;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButtonLabel.disabled = true;
                }

                // Note that the midi input device does not have to be set in order to
                // enable the start button.
                if (scoreIndex !== 0 && outputDeviceIndex !== 0)
                {
                    mo.startRuntimeButton.setAttribute('value', 'Start');
                    mo.startRuntimeButton.disabled = false;
                }
                else
                {
                    mo.startRuntimeButton.setAttribute('value', 'not ready');
                    //mo.startRuntimeButton.value = 'not ready';
                    mo.startRuntimeButton.disabled = true;
                }
                break;
            case "disabled":
                mo.controlPanel.style.visibility = "visible";
                mo.svgPages.style.visibility = "visible";
                mo.titleOptionsDiv.style.visibility = "hidden";

                mo.midiInputDeviceSelector.disabled = true;
                mo.scoreSelector.disabled = true;
                mo.midiOutputDeviceSelector.disabled = true;

                mo.trackSelector.disabled = true;

                mo.soloVelocityOptionCheckbox.disabled = true;
                mo.otherTracksVelocityOptionCheckbox.disabled = true;
                mo.soloPitchOptionCheckbox.disabled = true;
                mo.otherTracksPitchOptionCheckbox.disabled = true;

                mo.usesPressureSoloCheckbox.disabled = true;
                mo.usesPressureOtherTracksCheckbox.disabled = true;
                mo.pressureSubstituteControlDataSelector.disabled = true;

                mo.usesModSoloCheckbox.disabled = true;
                mo.usesModOtherTracksCheckbox.disabled = true;
                mo.modSustituteControlSelector.disabled = true;

                mo.usesPitchBendSoloCheckbox.disabled = true;
                mo.usesPitchBendOtherTracksCheckbox.disabled = true;
                mo.pitchBendSubstituteControlDataSelector.disabled = true;

                mo.assistantUsesAbsoluteDurationsRadioButton.disabled = true;
                mo.assistantsSpeedInputText.disabled = true;
                mo.assistantUsesRelativeDurationsRadioButton.disabled = true;
                mo.assistantUsesRelativeDurationsRadioButtonLabel.disabled = true;
                mo.startRuntimeButton.disabled = true;
                break;
            default:
                throw "Unknown svgControlsState";
        }

        setControlSubstitutionSelectorsDisabledState();
    },

    setStopped = function ()
    {
        if (options.assistedPerformance === true)
        {
            assistant.stop();
        }
        else
        {
            sequence.stop();
        }

        score.moveRunningMarkerToStartMarker();

        score.allNotesOff(options.outputDevice);

        setMainOptionsState("disabled");

        cl.gotoOptionsDisabled.setAttribute("opacity", GLASS);

        if (document.getElementById("midiInputDeviceSelector").selectedIndex === 0)
        {
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);
        }
        else
        {
            cl.livePerformerOnOffDisabled.setAttribute("opacity", GLASS);
        }

        /********* begin performance buttons *******************/
        cl.performanceButtonsDisabled.setAttribute("opacity", GLASS);
        // cl.goUnselected.setAttribute("opacity", METAL); -- never changes
        cl.pauseUnselected.setAttribute("opacity", GLASS);
        cl.pauseSelected.setAttribute("opacity", GLASS);
        cl.goDisabled.setAttribute("opacity", GLASS);

        cl.stopControlDisabled.setAttribute("opacity", SMOKE);

        //cl.setStartControlUnselected("opacity", METAL); -- never changes
        cl.setStartControlSelected.setAttribute("opacity", GLASS);
        cl.setStartControlDisabled.setAttribute("opacity", GLASS);

        //cl.setEndControlUnselected("opacity", METAL); -- never changes
        cl.setEndControlSelected.setAttribute("opacity", GLASS);
        cl.setEndControlDisabled.setAttribute("opacity", GLASS);

        // cl.sendStartToBeginningControlUnselected.setAttribute("opacity", METAL); -- never changes
        cl.sendStartToBeginningControlSelected.setAttribute("opacity", GLASS);
        cl.sendStartToBeginningControlDisabled.setAttribute("opacity", GLASS);

        // cl.sendStopToEndControlUnselected.setAttribute("opacity", METAL); -- never changes
        cl.sendStopToEndControlSelected.setAttribute("opacity", GLASS);
        cl.sendStopToEndControlDisabled.setAttribute("opacity", GLASS);
        /********* end performance buttons *******************/

        tracksControl.setDisabled(false);

        if(options.assistedPerformance === true)
        {
            options.inputDevice.removeEventListener("midimessage", _AP.assistant.handleMIDIInputEvent);
        }
    },

    // callback called when a performing sequence is stopped or has played its last message,
    // or when the assistant is stopped or has played its last subsequence.
    reportEndOfPerformance = function (recordedSequence, performanceMsDuration)
    {
        var
        scoreName = mo.scoreSelector.options[mo.scoreSelector.selectedIndex].text;

        // Moment timestamps in the recording are shifted so as to be relative to the beginning of the
        // recording. Returns false if the if the recorded sequence is undefined, null or has no moments.
        function setTimestampsRelativeToSequence(recordedSequence)
        {
            var i, nTracks = sequence.tracks.length, track,
                j, nMoments, moment,
                offset, success = true;

            // Returns the earliest moment.timestamp in the recordedSequence.
            // Returns Number.MAX_VALUE if recordedSequence is undefined, null or has no moments.
            function findOffset(recordedSequence)
            {
                var
                i, nTracks, track,
                timestamp,
                offset = Number.MAX_VALUE;

                if (recordedSequence !== undefined && recordedSequence !== null)
                {
                    nTracks = recordedSequence.tracks.length;
                    for (i = 0; i < nTracks; ++i)
                    {
                        track = recordedSequence.tracks[i];
                        if (track.moments.length > 0)
                        {
                            timestamp = track.moments[0].timestamp;
                            offset = (offset < timestamp) ? offset : timestamp;
                        }
                    }
                }

                return offset;
            }

            offset = findOffset(recordedSequence);

            if (offset === Number.MAX_VALUE)
            {
                success = false;
            }
            else
            {
                for (i = 0; i < nTracks; ++i)
                {
                    track = recordedSequence.tracks[i];
                    nMoments = track.moments.length;
                    for (j = 0; j < nMoments; ++j)
                    {
                        moment = track.moments[j];
                        moment.timestamp -= offset;
                    }
                }
            }
            return success;
        }

        if (setTimestampsRelativeToSequence(recordedSequence)) 
        {
            createSaveMIDIFileButton(scoreName, recordedSequence, performanceMsDuration);
        }

        // The moment.timestamps do not need to be restored to their original values here
        // because they will be re-assigned next time sequence.nextMoment() is called.

        setStopped();
        // the following line is important, because the stop button is also the pause button.
        svgControlsState = "stopped";
    },

    // callback called by a performing sequence. Reports the msPositionInScore of the
    // Moment curently being sent. When all the events in the span have been played,
    // reportEndOfPerformance() is called (see above).
    reportMsPos = function (msPositionInScore)
    {
        //console.log("Controls: calling score.advanceRunningMarker(msPosition), msPositionInScore=" + msPositionInScore);
        // If there is a graphic object in the score having msPositionInScore,
        // the running cursor is aligned to that object.
        score.advanceRunningMarker(msPositionInScore);
    },

    //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    setSvgControlsState = function (svgCtlsState)
    {
        function setDisabled()
        {
            setMainOptionsState("enable");

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            /********* begin performance buttons *******************/
            cl.performanceButtonsDisabled.setAttribute("opacity", SMOKE);
            cl.goDisabled.setAttribute("opacity", SMOKE);
            cl.stopControlDisabled.setAttribute("opacity", SMOKE);
            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
            /********* end performance buttons *******************/

            tracksControl.setDisabled(true);

            if(options.assistedPerformance === true)
            {
                options.inputDevice.removeEventListener("midimessage", _AP.assistant.handleMIDIInputEvent);
            }
        }

        // setStopped is outer function

        function setPaused()
        {
            if (options.assistedPerformance === true)
            {
                throw "Error: Assisted performances are never paused.";
            }

            if (sequence !== undefined && sequence.isRunning())
            {
                sequence.pause();
            }

            score.allNotesOff(options.outputDevice);

            tracksControl.setDisabled(true);

            if(options.assistedPerformance === true)
            {
                options.inputDevice.removeEventListener("midimessage", _AP.assistant.handleMIDIInputEvent);
            }

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            cl.pauseSelected.setAttribute("opacity", METAL);
            cl.goDisabled.setAttribute("opacity", GLASS);

            cl.stopControlSelected.setAttribute("opacity", GLASS);
            cl.stopControlDisabled.setAttribute("opacity", GLASS);

            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
        }

        function setPlaying()
        {
            var
            trackIsOnArray = tracksControl.getTrackIsOnArray(),
            nTracks = trackIsOnArray.length,
            recordingSequence;

            deleteSaveMIDIFileButton();

            if (options.assistedPerformance === true && assistant !== undefined)
            {
                if (assistant.isStopped())
                {
                    recordingSequence = new Sequence(nTracks);

                    // the running marker is at its correct position:
                    // either at the start marker, or somewhere paused.
                    score.setRunningMarkers();
                    score.moveStartMarkerToTop(svgPagesDiv);

                    assistant.playSpan(options.outputDevice, score.startMarkerMsPosition(), score.endMarkerMsPosition(),
                        trackIsOnArray, recordingSequence);

                    cl.pauseUnselected.setAttribute("opacity", GLASS);
                    cl.pauseSelected.setAttribute("opacity", GLASS);
                    cl.goDisabled.setAttribute("opacity", SMOKE);
                }
            }
            else if (sequence !== undefined) // playing score (main sequence)
            {
                if (sequence.isPaused())
                {
                    sequence.resume();
                }
                else if (sequence.isStopped())
                {
                    recordingSequence = new Sequence(nTracks);

                    // the running marker is at its correct position:
                    // either at the start marker, or somewhere paused.
                    score.setRunningMarkers();
                    score.moveStartMarkerToTop(svgPagesDiv);

                    sequence.playSpan(options.outputDevice, score.startMarkerMsPosition(), score.endMarkerMsPosition(),
                        trackIsOnArray, recordingSequence, reportEndOfPerformance, reportMsPos);
                }

                cl.pauseUnselected.setAttribute("opacity", METAL);
                cl.pauseSelected.setAttribute("opacity", GLASS);
                cl.goDisabled.setAttribute("opacity", GLASS);
            }

            tracksControl.setDisabled(true);

            if(options.assistedPerformance === true)
            {
                options.inputDevice.addEventListener("midimessage", _AP.assistant.handleMIDIInputEvent);
            }

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            cl.stopControlSelected.setAttribute("opacity", GLASS);
            cl.stopControlDisabled.setAttribute("opacity", GLASS);

            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
        }

        function setCursorAndEventListener(svgControlsState)
        {
            var i,
                s = score;

            if (s.svgFrames !== undefined)
            {
                switch (svgControlsState)
                {
                    case 'settingStart':
                        for (i = 0; i < s.svgFrames.length; ++i)
                        {
                            s.svgFrames[i].addEventListener('click', s.setStartMarkerClick, false);
                            s.svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), crosshair";
                        }
                        break;
                    case 'settingEnd':
                        for (i = 0; i < s.svgFrames.length; ++i)
                        {
                            s.svgFrames[i].addEventListener('click', s.setEndMarkerClick, false);
                            s.svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setEndCursor.cur'), pointer";
                        }
                        break;
                    default:
                        for (i = 0; i < s.svgFrames.length; ++i)
                        {
                            // According to
                            // https://developer.mozilla.org/en-US/docs/DOM/element.removeEventListener#Notes
                            // "Calling removeEventListener() with arguments which do not identify any currently 
                            //  registered EventListener on the EventTarget has no effect."
                            s.svgFrames[i].removeEventListener('click', s.setStartMarkerClick, false);
                            s.svgFrames[i].removeEventListener('click', s.setEndMarkerClick, false);
                            s.svgFrames[i].style.cursor = 'auto';
                        }
                        break;
                }
            }
        }

        function setSettingStart()
        {
            // The setStartCursor should be set here when I have extracted the svgFrames from the svgPages.
            // c.f. http://james-ingram.de/MidiBridge/js/apMidiControl.js
            // The cursor should be (re-)set in setSettingStart(), setSettingEnd() and setStopped()

            // svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), auto";

            tracksControl.setDisabled(true);

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            cl.goDisabled.setAttribute("opacity", SMOKE);
            cl.stopControlDisabled.setAttribute("opacity", SMOKE);

            cl.setStartControlSelected.setAttribute("opacity", METAL);
            cl.setStartControlDisabled.setAttribute("opacity", GLASS);

            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);

            setCursorAndEventListener('settingStart');
        }

        function setSettingEnd()
        {
            // The setStartCursor should be set here when I have extracted the svgFrames from the svgPages.
            // c.f. http://james-ingram.de/MidiBridge/js/apMidiControl.js
            // The cursor should be (re-)set in setSettingStart(), setSettingEnd() and setStopped()

            // svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), auto";

            tracksControl.setDisabled(true);

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            cl.goDisabled.setAttribute("opacity", SMOKE);
            cl.stopControlDisabled.setAttribute("opacity", SMOKE);
            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);

            cl.setEndControlSelected.setAttribute("opacity", METAL);
            cl.setEndControlDisabled.setAttribute("opacity", GLASS);

            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);

            setCursorAndEventListener('settingEnd');
        }

        svgControlsState = svgCtlsState;

        setCursorAndEventListener('default');

        switch (svgControlsState)
        {
            case 'disabled':
                setDisabled(); // enables the main options panel
                break;
            case 'stopped':
                setStopped();
                break;
            case 'paused':
                if (options.assistedPerformance === false)
                {
                    setPaused();
                }
                break;
            case 'playing':
                setPlaying();
                break;
            case 'settingStart':
                setSettingStart();
                break;
            case 'settingEnd':
                setSettingEnd();
                break;
        }
    },

    // Sets the states of the main options to the states they have when no score is selected.
    // This function is called by both init() and setScoreDefaultOptions() below.
    setMainOptionsDefaultStates = function ()
    {
        mo.trackSelector.selectedIndex = 0;

        mo.soloPitchOptionCheckbox.checked = false;
        mo.otherTracksPitchOptionCheckbox.checked = false;
        mo.soloVelocityOptionCheckbox.checked = false;
        mo.otherTracksVelocityOptionCheckbox.checked = false;

        mo.usesPressureSoloCheckbox.checked = false;
        mo.usesPressureOtherTracksCheckbox.checked = false;
        mo.pressureSubstituteControlDataSelector.selectedIndex = 0;

        mo.usesPitchBendSoloCheckbox.checked = false;
        mo.usesPitchBendOtherTracksCheckbox.checked = false;
        mo.pitchBendSubstituteControlDataSelector.selectedIndex = 2;

        mo.usesModSoloCheckbox.checked = false;
        mo.usesModOtherTracksCheckbox.checked = false;
        mo.modSustituteControlSelector.selectedIndex = 3;

        mo.assistantsSpeedInputText.value = "100";
        mo.assistantUsesAbsoluteDurationsRadioButton.checked = false;
        mo.assistantUsesRelativeDurationsRadioButton.checked = true;
    },

    // Defines the window.svgLoaded(...) function.
    // Sets up the pop-up menues for scores and MIDI input and output devices.
    init = function (mAccess)
    {
        function getMainOptionElements()
        {
            mo.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            mo.controlPanel = document.getElementById("controlPanel");
            mo.svgPages = document.getElementById("svgPages");

            mo.midiInputDeviceSelector = document.getElementById("midiInputDeviceSelector");
            mo.scoreSelector = document.getElementById("scoreSelector");
            mo.midiOutputDeviceSelector = document.getElementById("midiOutputDeviceSelector");
            mo.trackSelector = document.getElementById("trackSelector");

            mo.soloVelocityOptionCheckbox = document.getElementById("soloVelocityOptionCheckbox");
            mo.otherTracksVelocityOptionCheckbox = document.getElementById("otherTracksVelocityOptionCheckbox");
            mo.soloPitchOptionCheckbox = document.getElementById("soloPitchOptionCheckbox");
            mo.otherTracksPitchOptionCheckbox = document.getElementById("otherTracksPitchOptionCheckbox");

            mo.usesPressureSoloCheckbox = document.getElementById("usesPressureSoloCheckbox");
            mo.usesPressureOtherTracksCheckbox = document.getElementById("usesPressureOtherTracksCheckbox");
            mo.pressureSubstituteControlDataSelector = document.getElementById("pressureSubstituteControlDataSelector");

            mo.usesModSoloCheckbox = document.getElementById("usesModSoloCheckbox");
            mo.usesModOtherTracksCheckbox = document.getElementById("usesModOtherTracksCheckbox");
            mo.modSustituteControlSelector = document.getElementById("modSustituteControlSelector");

            mo.usesPitchBendSoloCheckbox = document.getElementById("usesPitchBendSoloCheckbox");
            mo.usesPitchBendOtherTracksCheckbox = document.getElementById("usesPitchBendOtherTracksCheckbox");
            mo.pitchBendSubstituteControlDataSelector = document.getElementById("pitchBendSubstituteControlDataSelector");

            mo.assistantsSpeedInputText = document.getElementById("assistantsSpeedInputText");
            mo.assistantUsesAbsoluteDurationsRadioButton = document.getElementById("assistantUsesAbsoluteDurationsRadioButton");
            mo.assistantUsesRelativeDurationsRadioButton = document.getElementById("assistantUsesRelativeDurationsRadioButton");
            mo.assistantUsesRelativeDurationsRadioButtonLabel = document.getElementById("assistantUsesRelativeDurationsRadioButtonLabel");
            mo.startRuntimeButton = document.getElementById("startRuntimeButton");
        }

        // sets the options in the device selectors' menus
        function setMIDIDeviceSelectors(midiAccess)
        {
            var
            i, nItems, option,
            is = mo.midiInputDeviceSelector, // = document.getElementById("midiInputDeviceSelector")
            os = mo.midiOutputDeviceSelector, // = document.getElementById("midiOutputDeviceSelector")
            inputs = midiAccess.inputs(),
            outputs = midiAccess.outputs(); // WebMIDIAPI creates new OutputDevices

            option = document.createElement("option");
            option.text = "choose a MIDI input device";
            is.add(option, null);
            nItems = inputs.length;
            for (i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.inputDevice = inputs[i];
                option.text = inputs[i].name;
                //option.inputDevice.addEventListener("midimessage", _AP.assistant.handleMIDIInputEvent);
                is.add(option, null);
            }

            option = document.createElement("option");
            option.text = "choose a MIDI output device";
            os.add(option, null);
            nItems = outputs.length;
            for (i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.outputDevice = outputs[i];
                option.text = outputs[i].name;
                //option.outputDevice = midiAccess.getOutput(i);  // WebMIDIAPI creates a new OutputDevice
                os.add(option, null);
            }
        }

        // resets the score selector in case the browser has cached the last value
        function initScoreSelector(runningMarkerHeightChanged)
        {
            mo.scoreSelector.selectedIndex = 0;
            score = new Score(runningMarkerHeightChanged); // an empty score, with callback function
        }

        function setControlOptionSelectors()
        {
            function populate(selector)
            {
                var
                i, nOptions = controlOptions.length,
                    element, textNode;

                for(i = 0; i < nOptions; ++i)
                {
                    element = document.createElement("option");
                    textNode = document.createTextNode(controlOptions[i].name);
                    element.appendChild(textNode);
                    selector.add(element, null);
                }
            }

            populate(mo.pressureSubstituteControlDataSelector);
            populate(mo.pitchBendSubstituteControlDataSelector);
            populate(mo.modSustituteControlSelector);
        }

        function getControlLayers(document)
        {
            cl.gotoOptionsDisabled = document.getElementById("gotoOptionsDisabled");

            cl.livePerformerOff = document.getElementById("livePerformerOff");
            cl.livePerformerOnOffDisabled = document.getElementById("livePerformerOnOffDisabled");

            cl.performanceButtonsDisabled = document.getElementById("performanceButtonsDisabled");

            //cl.goUnselected = document.getElementById("goUnselected");
            cl.pauseUnselected = document.getElementById("pauseUnselected");
            cl.pauseSelected = document.getElementById("pauseSelected");
            cl.goDisabled = document.getElementById("goDisabled");

            //cl.stopControlUnselected = document.getElementById("stopControlUnselected");
            cl.stopControlSelected = document.getElementById("stopControlSelected");
            cl.stopControlDisabled = document.getElementById("stopControlDisabled");

            //cl.setStartControlUnselected = document.getElementById("setStartControlUnselected");
            cl.setStartControlSelected = document.getElementById("setStartControlSelected");
            cl.setStartControlDisabled = document.getElementById("setStartControlDisabled");

            //cl.setEndControlUnselected = document.getElementById("setEndControlUnselected");
            cl.setEndControlSelected = document.getElementById("setEndControlSelected");
            cl.setEndControlDisabled = document.getElementById("setEndControlDisabled");

            //cl.sendStartToBeginningControlUnselected = document.getElementById("sendStartToBeginningControlUnselected");
            cl.sendStartToBeginningControlSelected = document.getElementById("sendStartToBeginningControlSelected");
            cl.sendStartToBeginningControlDisabled = document.getElementById("sendStartToBeginningControlDisabled");

            //cl.sendStopToEndControlUnselected = document.getElementById("sendStopToEndControlUnselected");
            cl.sendStopToEndControlSelected = document.getElementById("sendStopToEndControlSelected");
            cl.sendStopToEndControlDisabled = document.getElementById("sendStopToEndControlDisabled");
        }

        // callback passed to score. Called when the running marker moves to a new system.
        function runningMarkerHeightChanged(runningMarkerYCoordinates)
        {
            var div = svgPagesDiv,
            height = Math.round(parseFloat(div.style.height));

            if (runningMarkerYCoordinates.bottom > (height + div.scrollTop))
            {
                div.scrollTop = runningMarkerYCoordinates.top - 10;
            }
        }

        function setSvgPagesDivHeight()
        {
            svgPagesDiv = document.getElementById("svgPages");
            svgPagesDiv.style.height = window.innerHeight - 43;
        }

        // This function is called by the first SVG page in a score when it loads (using an onLoad() function).
        // The argument list contains pointers to functions defined in scores/SVG.js
        // The first SVG page in each score contains the line
        //     <script type="text/javascript" xlink:href="../SVG.js"/>
        // Each argument function is added to the local svg object (which only exists for that purpose).
        window._JI_SVGLoaded = function(getSVGDocument)
        {
            svg.getSVGDocument = getSVGDocument;
        };

        midiAccess = mAccess;

        getMainOptionElements();

        setMIDIDeviceSelectors(midiAccess);

        initScoreSelector(runningMarkerHeightChanged);

        setControlOptionSelectors();

        setMainOptionsDefaultStates();

        setSvgPagesDivHeight();

        getControlLayers(document);

        setSvgControlsState('disabled');
    },
 
    // Returns a scoreInfo object constructed from the id string of the score
    // currently selected in the scoreSelector (Defined in assistantPerformer.html.)
    // The id string must contain:
    //    nameString followed by ", " followed by
    //    "nPages="  followed by the number of pages (an integer of any length) followed by ", " followed by
    //    "nTracks="  followed by the number of tracks (an integer of any length)  followed by ", "  followed by
    //    zero or more default performer's options separated by ", " (see setDefaultPerformanceOptions() below)
    //    zero or more default assistant's duration options separated by ", " (see setDefaultAssistantsDurationOptions() below)
    // for example:
    //    "Song Six, nPages=7, nTracks=6, po.pitchWheel.otherTracks"
    // The nameString is used (twice) to construct the URLs for the score pages, for example:
    // "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Song Six/Song Six page 1.svg"
    //
    // The scoreInfo object returned by this function has the following attributes:
    //      scoreInfo.name (e.g. "Song Six"
    //      scoreInfo.nPages (e.g. 7)
    //      scoreInfo.nTracks (e.g. 8)
    // and optionally (if present)
    //      scoreInfo.defaultPerformanceOptions (see below)
    // and optionally (if present)
    //      scoreInfo.defaultAssistantsDurationOptions (see below)
    getScoreInfo = function ()
    {
        var scoreSelectorElem = document.getElementById("scoreSelector"),
            scoreInfoStrings, scoreInfoString, scoreInfo;

        function getScoreInfoStrings(scoreSelectorElem)
        {
            var scoreInfoStrings = [], i, childNode;

            for(i = 0 ; i < scoreSelectorElem.childNodes.length; ++i)
            {
                childNode = scoreSelectorElem.childNodes[i];
                if(childNode.id !== undefined)
                {
                    scoreInfoStrings.push(childNode.id);
                }
            }
            return scoreInfoStrings;
        }

        function analyseString(infoString)
        {
            var i, scoreInfo = {}, components;

            // Default performer's options are all optional. Each begins with the string "po." followed by any of the following:
            // (CheckBoxes are unchecked by default, they are checked if defined here.)
            //    "track=" followed by the default track number (1..nTracks)
            //    "pitch.soloTrack" and/or "pitch.otherTracks"
            //    "velocity.soloTrack" and/or "velocity.otherTracks"
            //    "aftertouch.soloTrack" and/or "aftertouch.otherTracks" and ("aftertouch.selectedIndex=" followed by the selector's index)
            //    "pitchWheel.soloTrack" and/or "pitchWheel.otherTracks" and ("pitchWheel.selectedIndex=" followed by the selector's index)
            //    "modWheel.soloTrack" and/or "modWheel.otherTracks" and ("modWheel.selectedIndex=" followed by the selector's index)
            //
            // In this function, the optionString argument is the part of the option string after "po."
            function setDefaultPerformanceOptions(defaultPerformanceOptions, optionString)
            {
                // soloTrackOtherTracksString is either "soloTrack" or "otherTracks"
                function setSoloOtherOption(option, soloTrackOtherTracksString)
                {
                    if(soloTrackOtherTracksString === "soloTrack")
                    {
                        option.soloTrack = true;
                    }
                    else if(soloTrackOtherTracksString === "otherTracks")
                    {
                        option.otherTracks = true;
                    }
                }

                if(optionString.slice(0, 6) === "track=")
                {
                    defaultPerformanceOptions.track = parseInt(optionString.slice(6), 10);
                }
                else if(optionString.slice(0, 6) === "pitch.")
                {
                    if(defaultPerformanceOptions.pitch === undefined)
                    {
                        defaultPerformanceOptions.pitch = {};
                    }
                    setSoloOtherOption(defaultPerformanceOptions.pitch, optionString.slice(6));
                }
                else if(optionString.slice(0, 9) === "velocity.")
                {
                    if(defaultPerformanceOptions.velocity === undefined)
                    {
                        defaultPerformanceOptions.velocity = {};
                    }
                    setSoloOtherOption(defaultPerformanceOptions.velocity, optionString.slice(9));
                }
                else if(optionString.slice(0, 11) === "aftertouch.")
                {
                    if(defaultPerformanceOptions.aftertouch === undefined)
                    {
                        defaultPerformanceOptions.aftertouch = {};
                    }
                    if(optionString.slice(0, 25) === "aftertouch.selectedIndex=")
                    {
                        defaultPerformanceOptions.aftertouch.selectedIndex = parseInt(optionString.slice(25), 10);
                    }
                    else
                    {
                        setSoloOtherOption(defaultPerformanceOptions.aftertouch, optionString.slice(11));
                    }
                }
                else if(optionString.slice(0, 11) === "pitchWheel.")
                {
                    if(defaultPerformanceOptions.pitchWheel === undefined)
                    {
                        defaultPerformanceOptions.pitchWheel = {};
                    }
                    if(optionString.slice(0, 25) === "pitchWheel.selectedIndex=")
                    {
                        defaultPerformanceOptions.pitchWheel.selectedIndex = parseInt(optionString.slice(25), 10);
                    }
                    else
                    {
                        setSoloOtherOption(defaultPerformanceOptions.pitchWheel, optionString.slice(11));
                    }
                }
                else if(optionString.slice(0, 9) === "modWheel.")
                {
                    if(defaultPerformanceOptions.modWheel === undefined)
                    {
                        defaultPerformanceOptions.modWheel = {};
                    }
                    if(optionString.slice(0, 23) === "modWheel.selectedIndex=")
                    {
                        defaultPerformanceOptions.modWheel.selectedIndex = parseInt(optionString.slice(23), 10);
                    }
                    else
                    {
                        setSoloOtherOption(defaultPerformanceOptions.modWheel, optionString.slice(9));
                    }
                }
            }

            // Default assistant's duration options begin with the string "ado." followed by
            //    "speed=" followed by the (float) string to be put in the text box (e.g. "speed=26"). Default is speed=100.
            //    "fixedSpeed" Default is variable speed.
            //
            // In this function, the optionString argument is the part of the option string after "ado."
            function setDefaultAssistantsDurationOptions(defaultAssistantsDurationOptions, optionString)
            {
                if(optionString.slice(0, 6) === "speed=")
                {
                    defaultAssistantsDurationOptions.speed = optionString.slice(6);
                }
                else if(optionString === "fixedSpeed") // default is variable speed
                {
                    defaultAssistantsDurationOptions.fixedSpeed = true;
                }
            }

            components = infoString.split(", ");

            if(components.length < 3 || components[1].slice(0, 7) !== "nPages=" || components[2].slice(0, 8) !== "nTracks=")
            {
                throw "Illegal id string in assistantPerformer.html";
            }

            scoreInfo.name = components[0];
            scoreInfo.nPages = parseInt(components[1].slice(7), 10);
            scoreInfo.nTracks = parseInt(components[2].slice(8), 10);

            if(components.length > 3)
            {
                for(i = 3; i < components.length; ++i)
                {
                    if(components[i].slice(0, 3) === "po.")
                    {
                        if(scoreInfo.defaultPerformanceOptions === undefined)
                        {
                            scoreInfo.defaultPerformanceOptions = {};
                        }
                        setDefaultPerformanceOptions(scoreInfo.defaultPerformanceOptions, components[i].slice(3));
                    }
                    else if(components[i].slice(0, 4) === "ado.")
                    {
                        if(scoreInfo.defaultAssistantsDurationOptions === undefined)
                        {
                            scoreInfo.defaultAssistantsDurationOptions = {};
                        }
                        setDefaultAssistantsDurationOptions(scoreInfo.defaultAssistantsDurationOptions, components[i].slice(4));
                    }
                }
            }

            return scoreInfo;
        }

        scoreInfoStrings = getScoreInfoStrings(scoreSelectorElem);

        scoreInfoString = scoreInfoStrings[scoreSelectorElem.selectedIndex];

        scoreInfo = analyseString(scoreInfoString);

        return scoreInfo;
    },

    // called when the user clicks a control in the GUI
    doControl = function (controlID)
    {
        // This function sets the html content of the "svgPages" div, and initializes
        // both the performer's track selector (in the main options dialog) and
        // the performance tracksControl (in the SVG controls at the top of the score).
        // The score is actually analysed when the Start button is clicked.
        function setScore()
        {
            var scoreInfo;

            // removes existing mo.trackSelector.ChildNodes
            // adds nTracks new child nodes
            // enables mo.trackSelector 
            function setPerformersTrackSelector(nTracks)
            {
                var i, optionElem, textElem, sibling,
                firstChildNode;

                if (mo.trackSelector.childNodes.length > 0)
                {
                    firstChildNode = mo.trackSelector.childNodes[0];
                    sibling = firstChildNode.nextSibling;
                    while (sibling !== null)
                    {
                        mo.trackSelector.removeChild(sibling);
                        sibling = firstChildNode.nextSibling;
                    }
                    mo.trackSelector.removeChild(firstChildNode);
                }
                for (i = 0; i < nTracks; ++i)
                {
                    optionElem = document.createElement("option");
                    textElem = document.createTextNode((i + 1).toString());
                    optionElem.appendChild(textElem);
                    mo.trackSelector.appendChild(optionElem);
                }
            }

            function setPages(scoreInfo)
            {
                var rootURL = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/",
                    name = scoreInfo.name, // e.g. "Song Six"
                    nPages = scoreInfo.nPages,
                    svgPagesFrame,
                    embedCode = "",
                    pageURL,
                    i;

                function embedPageCode(url)
                {
                    var code = "<embed " +
                                    "src=\'" + url + "\' " +
                                    "content-type=\'image/svg+xml\' " +
                                    "class=\'svgPage\' " +
                                    "width=\'1010\' " +  // the value at the top of the Study2c3.1 svg pages
                                    "height=\'1237\' />" +   // the value at the top of the Study2c3.1 svg pages
                                "<br />";
                    return code;
                }

                for(i = 0; i < nPages; ++i)
                {
                    pageURL = rootURL + name;
                    pageURL = pageURL + "/";
                    pageURL = pageURL + name;
                    pageURL = pageURL + " page ";
                    pageURL = pageURL + (i + 1).toString();
                    pageURL = pageURL + ".svg";
                    // e.g. "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Song Six/Song Six page 1.svg"
                    embedCode += embedPageCode(pageURL);
                }
                svgPagesFrame = document.getElementById('svgPages');
                // should call svgPagesFrame.svgLoaded, and set svgPagesFrame.svgScript 
                svgPagesFrame.innerHTML = embedCode;
            }

            scoreInfo = getScoreInfo();

            setPages(scoreInfo);
            setPerformersTrackSelector(scoreInfo.nTracks);

            tracksControl.setNumberOfTracks(scoreInfo.nTracks);

            svgPagesDiv.scrollTop = 0;
            scoreHasJustBeenSelected = true;
        }

        function goControlClicked()
        {
            if (svgControlsState === 'stopped' || svgControlsState === 'paused')
            {
                setSvgControlsState('playing');
            }
            else if (svgControlsState === 'playing')
            {
                setSvgControlsState('paused');
            }
        }

        // used when the control automatically toggles back
        // toggleBack('setStartControlSelected')
        function toggleBack(selected)
        {
            selected.setAttribute("opacity", "1");
            window.setTimeout(function ()
            {
                selected.setAttribute("opacity", "0");
            }, 200);
        }

        function stopControlClicked()
        {
            if (svgControlsState === 'paused')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }

            if (svgControlsState === 'playing')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }
        }

        function setStartControlClicked()
        {
            if (svgControlsState === 'stopped')
            {
                setSvgControlsState('settingStart');
            }
            else if (svgControlsState === 'settingStart')
            {
                setSvgControlsState('stopped');
                score.moveRunningMarkerToStartMarker();
            }
        }

        function setEndControlClicked()
        {
            if (svgControlsState === 'stopped')
            {
                setSvgControlsState('settingEnd');
            }
            else if (svgControlsState === 'settingEnd')
            {
                setSvgControlsState('stopped');
            }
        }

        function sendStartToBeginningControlClicked()
        {
            if (svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStartToBeginningControlSelected);
                score.sendStartMarkerToStart();
                score.moveRunningMarkerToStartMarker();
            }
        }

        function sendStopToEndControlClicked()
        {
            if (svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStopToEndControlSelected);
                score.sendEndMarkerToEnd();
            }
        }

        function setScoreDefaultOptions()
        {
            var 
            scoreInfo = getScoreInfo(),
            dpo = scoreInfo.defaultPerformanceOptions,
            dado = scoreInfo.defaultAssistantsDurationOptions;

            setMainOptionsDefaultStates(); // also called by init() above

            if(dpo !== undefined)
            {
                if(dpo.track !== undefined)
                {
                    mo.trackSelector.selectedIndex = dpo.track - 1;
                }
                if(dpo.pitch !== undefined)
                {
                    if(dpo.pitch.soloTrack !== undefined)
                    {
                        mo.soloPitchOptionCheckbox.checked = true;
                    }
                    if(dpo.pitch.otherTracks !== undefined)
                    {
                        mo.otherTracksPitchOptionCheckbox.checked = true;
                    }
                }
                if(dpo.velocity !== undefined)
                {
                    if(dpo.velocity.soloTrack !== undefined)
                    {
                        mo.soloVelocityOptionCheckbox.checked = true;
                    }
                    if(dpo.velocity.otherTracks !== undefined)
                    {
                        mo.otherTracksVelocityOptionCheckbox.checked = true;
                    }
                }
                if(dpo.aftertouch !== undefined)
                {
                    if(dpo.aftertouch.soloTrack !== undefined)
                    {
                        mo.usesPressureSoloCheckbox.checked = true;
                    }
                    if(dpo.aftertouch.otherTracks !== undefined)
                    {
                        mo.usesPressureOtherTracksCheckbox.checked = true;
                    }
                    if(dpo.aftertouch.selectedIndex !== undefined)
                    {
                        mo.pressureSubstituteControlDataSelector.selectedIndex = dpo.aftertouch.selectedIndex;
                    }
                }
                if(dpo.pitchWheel !== undefined)
                {
                    if(dpo.pitchWheel.soloTrack !== undefined)
                    {
                        mo.usesPitchBendSoloCheckbox.checked = true;
                    }
                    if(dpo.pitchWheel.otherTracks !== undefined)
                    {
                        mo.usesPitchBendOtherTracksCheckbox.checked = true;
                    }
                    if(dpo.pitchWheel.selectedIndex !== undefined)
                    {
                        mo.pitchBendSubstituteControlDataSelector.selectedIndex = dpo.pitchWheel.selectedIndex;
                    }
                }
                if(dpo.modWheel !== undefined)
                {
                    if(dpo.modWheel.soloTrack !== undefined)
                    {
                        mo.usesModSoloCheckbox.checked = true;
                    }
                    if(dpo.modWheel.otherTracks !== undefined)
                    {
                        mo.usesModOtherTracksCheckbox.checked = true;
                    }
                    if(dpo.modWheel.selectedIndex !== undefined)
                    {
                        mo.modSustituteControlSelector.selectedIndex = dpo.modWheel.selectedIndex;
                    }
                }
            }

            if(dado !== undefined)
            {
                if(dado.speed !== undefined)
                {
                    mo.assistantsSpeedInputText.value = dado.speed;
                }
                if(dado.fixedSpeed !== undefined)
                {
                    mo.assistantUsesAbsoluteDurationsRadioButton.checked = true;
                    mo.assistantUsesRelativeDurationsRadioButton.checked = false;
                }
            }

            setControlSubstitutionSelectorsDisabledState();
        }

        /**** controls in options panel ***/
        if (controlID === "midiInputDeviceSelector"
        || controlID === "scoreSelector"
        || controlID === "midiOutputDeviceSelector"
        || controlID === "usesPressureSoloCheckbox"
        || controlID === "usesPressureOtherTracksCheckbox"
        || controlID === "usesModSoloCheckbox"
        || controlID === "usesModOtherTracksCheckbox"
        || controlID === "usesPitchBendSoloCheckbox"
        || controlID === "usesPitchBendOtherTracksCheckbox"
        || controlID === "assistantUsesAbsoluteDurationsRadioButton"
        || controlID === "assistantUsesRelativeDurationsRadioButton")
        {
            setMainOptionsState("enable"); // enables only the appropriate controls
        }

        if (controlID === "midiInputDeviceSelector")
        {
            setMIDIDevices();
            tracksControl.setInitialTracksControlState(mo.midiInputDeviceSelector.selectedIndex > 0, mo.trackSelector.selectedIndex);
            if(mo.scoreSelector.selectedIndex > 0)
            {
                setScoreDefaultOptions();
            }
        }

        if (controlID === "scoreSelector")
        {
            setScore();
            tracksControl.setInitialTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
            if(mo.midiInputDeviceSelector.selectedIndex > 0)
            {
                setScoreDefaultOptions();
            }
        }

        if (controlID === "midiOutputDeviceSelector")
        {
            setMIDIDevices(midiAccess);
        }

        if (controlID === "trackSelector")
        {
            tracksControl.setInitialTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
        }

        /*** SVG controls ***/
        if (cl.performanceButtonsDisabled.getAttribute("opacity") !== SMOKE)
        {
            switch (controlID)
            {
                case "goControl":
                    goControlClicked();
                    break;
                case "stopControl":
                    stopControlClicked();
                    break;
                case "setStartControl":
                    setStartControlClicked();
                    break;
                case "setEndControl":
                    setEndControlClicked();
                    break;
                case "sendStartToBeginningControl":
                    sendStartToBeginningControlClicked();
                    break;
                case "sendStopToEndControl":
                    sendStopToEndControlClicked();
                    break;
                default:
                    break;
            }
        }

        if (controlID === "livePerformerOnOff")
        {
            if (cl.livePerformerOnOffDisabled.getAttribute("opacity") !== SMOKE)
            {
                options.assistedPerformance = !(options.assistedPerformance);

                if (options.assistedPerformance)
                {
                    tracksControl.setInitialTracksControlState(true, options.livePerformersTrackIndex);
                    tracksControl.refreshDisplay();
                }
                else
                {
                    tracksControl.setInitialTracksControlState(false, options.livePerformersTrackIndex);
                    tracksControl.refreshDisplay();
                }

                sequence = score.createSequence(options.assistantsSpeed);

                if (options.assistedPerformance === true)
                {
                    // this constructor consumes sequence, resetting moment timestamps
                    // relative to the start of their subsection.
                    assistant = new Assistant(sequence, options, reportEndOfPerformance, reportMsPos);
                }
            }
        }

        if (controlID === "gotoOptions")
        {
            deleteSaveMIDIFileButton();

            if (cl.gotoOptionsDisabled.getAttribute("opacity") !== SMOKE)
            {
                setSvgControlsState('disabled');
                score.moveStartMarkerToTop(svgPagesDiv);
                scoreHasJustBeenSelected = false;
            }
        }
    },

    // functions for adjusting the appearance of the score options
    showOverRect = function (overRectID, disabledID)
    {
        var overRectElem = document.getElementById(overRectID),
            disabledElem = document.getElementById(disabledID),
            disabledOpacity = disabledElem.getAttribute("opacity"),
            livePerformerOffLayer;

        if (disabledOpacity !== SMOKE)
        {
            overRectElem.setAttribute("opacity", METAL);
            if (overRectID === 'overLivePerformerOnOffFrame')
            {
                livePerformerOffLayer = document.getElementById('livePerformerOff');
                if (options.assistedPerformance === true)
                {
                    livePerformerOffLayer.setAttribute("opacity", METAL);
                }
                else
                {
                    livePerformerOffLayer.setAttribute("opacity", GLASS);
                }
            }
        }
    },
    hideOverRect = function (overRectID)
    {
        var overRect = document.getElementById(overRectID),
            livePerformerOffLayer;

        overRect.setAttribute("opacity", GLASS);
        if (overRectID === 'overLivePerformerOnOffFrame')
        {
            livePerformerOffLayer = document.getElementById('livePerformerOff');
            if (options.assistedPerformance === true)
            {
                livePerformerOffLayer.setAttribute("opacity", GLASS);
            }
            else
            {
                livePerformerOffLayer.setAttribute("opacity", METAL);
            }
        }
    },

    trackToggled = function (soloistIsSilent)
    {
        score.refreshDisplay(sequence, options.assistedPerformance, options.livePerformersTrackIndex, soloistIsSilent);
        // score.refreshDisplay() sets sequence.tracks[livePerformersTrackIndex] to a silent track, if necessary.
        if(options.assistedPerformance === true && livePerformerIsSilent !== soloistIsSilent)
        {
            livePerformerIsSilent = soloistIsSilent;
            assistant = new Assistant(sequence, options, reportEndOfPerformance, reportMsPos);
        }

    },

    // Called when the Start button is clicked in the top options dialog.
    // The score selector sets the array of svgScorePage urls.
    // The Start button is enabled when a score and MIDI output have been selected.
    // It does not require a MIDI input.
    beginRuntime = function ()
    {
        function getOptions()
        {
            var success;

            function checkSpeedInput()
            {
                var inputText = mo.assistantsSpeedInputText,
                speed = parseFloat(inputText.value), success;

                if (isNaN(speed) || speed <= 0)
                {
                    inputText.style.backgroundColor = "#FFDDDD";
                    success = false;
                }
                else
                {
                    inputText.style.backgroundColor = "#FFFFFF";
                    success = true;
                }
                return success;
            }

            if (checkSpeedInput())
            {
                // options is a global inside this namespace
                options.livePerformersTrackIndex = mo.trackSelector.selectedIndex;

                options.overrideSoloVelocity = mo.soloVelocityOptionCheckbox.checked;
                options.overrideOtherTracksVelocity = mo.otherTracksVelocityOptionCheckbox.checked;
                options.overrideSoloPitch = mo.soloPitchOptionCheckbox.checked;
                options.overrideOtherTracksPitch = mo.otherTracksPitchOptionCheckbox.checked;

                // EWI: breath control (=aftertouch)
                // E-MU keyboard: key pressure (=channel pressure)
                options.usesPressureSolo = mo.usesPressureSoloCheckbox.checked;
                options.usesPressureOtherTracks = mo.usesPressureOtherTracksCheckbox.checked;
                options.pressureSubstituteControlData = null;
                if (options.usesPressureSolo || options.usesPressureOtherTracks)
                {
                    options.pressureSubstituteControlData = controlOptions[mo.pressureSubstituteControlDataSelector.selectedIndex];
                }

                // EWI: pitch-bend controls (=pitch-bend)
                // E-MU keyboard: pitch wheel (=pitch-bend)
                options.usesPitchBendSolo = mo.usesPitchBendSoloCheckbox.checked;
                options.usesPitchBendOtherTracks = mo.usesPitchBendOtherTracksCheckbox.checked;
                options.pitchBendSubstituteControlData = null;
                if (options.usesPitchBendSolo || options.usesPitchBendOtherTracks)
                {
                    options.pitchBendSubstituteControlData = controlOptions[mo.pitchBendSubstituteControlDataSelector.selectedIndex];
                }

                // EWI: bite control (=modulation)
                // E-MU keyboard: modulation wheel (=modulation)
                options.usesModSolo = mo.usesModSoloCheckbox.checked;
                options.usesModOtherTracks = mo.usesModOtherTracksCheckbox.checked;
                options.modSubstituteControlData = null;
                if (options.usesModSolo || options.usesModOtherTracks)
                {
                    options.modSubstituteControlData = controlOptions[mo.modSustituteControlSelector.selectedIndex];
                }

                options.assistantUsesAbsoluteDurations = mo.assistantUsesAbsoluteDurationsRadioButton.checked;

                options.assistantsSpeed = parseFloat(mo.assistantsSpeedInputText.value) / 100.0;

                // options.assistedPerformance is kept up to date by the livePerformerOnOffButton.
                options.assistedPerformance = (cl.livePerformerOff.getAttribute("opacity") === "0");

                success = true;
            }
            else
            {
                success = false;
            }

            return success;
        }

        if (document.getElementById("midiInputDeviceSelector").selectedIndex === 0)
        {
            // alert("Warning: A MIDI input device has not been selected");
            cl.livePerformerOff.setAttribute("opacity", METAL);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);
        }
        else
        {
            cl.livePerformerOff.setAttribute("opacity", GLASS);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);
        }

        if (getOptions())
        {
            if (scoreHasJustBeenSelected)
            {
                score.getEmptyPagesAndSystems(svg); // everything except the timeObjects (which have to take account of speed)
            }

            score.getTimeObjects(svg, options.assistantsSpeed);

            sequence = score.createSequence(options.assistedPerformance, options.livePerformersTrackIndex);

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // TracksControl.refreshDisplay() calls
            //     score.refreshDisplay(isAssistedPerformance, livePerformersTrackIndex, livePerformerisSilent)
            // to tell the score to repaint itself. The score may also update the position of the start marker (which
            // always starts on a chord) if a track becomes disabled.
            tracksControl.getTrackToggledCallback(trackToggled);

            // tracksControl.trackIsOn(trackIndex) returns a boolean which is the on/off status of its trackIndex argument
            score.getTrackIsOnCallback(tracksControl.trackIsOn);

            tracksControl.setInitialTracksControlState(options.assistedPerformance, options.livePerformersTrackIndex);

            score.refreshDisplay(sequence, options.assistedPerformance, options.livePerformersTrackIndex, false);
            if (options.assistedPerformance === true)
            {
                // This constructor resets moment timestamps relative to the start of their subsequence.
                // The sequence therefore needs to be reloaded when the options (performer's track index) change.    
                assistant = new Assistant(sequence, options, reportEndOfPerformance, reportMsPos);
            }

            score.moveStartMarkerToTop(svgPagesDiv);

            setSvgControlsState('stopped');

            if (options.assistedPerformance === true && assistant !== undefined)
            {
                setSvgControlsState('playing');
            }
        }

        mo.startRuntimeButton.setAttribute('value', 'Running'); // the button is disabled/enabled elsewhere
    },

    publicAPI =
    {
        init: init,

        doControl: doControl,
        showOverRect: showOverRect,
        hideOverRect: hideOverRect,

        beginRuntime: beginRuntime
    };
    // end var

    return publicAPI;

} (document, window));
