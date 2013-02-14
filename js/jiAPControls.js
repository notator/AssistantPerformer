/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  jiAPControls.js
*  The JI_NAMESPACE.apControls namespace which defines the
*  Assistant Performer's Graphic User Interface.
*  
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

JI_NAMESPACE.namespace('JI_NAMESPACE.apControls');

JI_NAMESPACE.apControls = (function (document, window)
{
    "use strict";

    var 
    tracksControl = JI_NAMESPACE.apTracksControl,
    Score = JI_NAMESPACE.score.Score,
    Assistant = JI_NAMESPACE.assistant.Assistant,

    Track = MIDI_API.track.Track,
    Sequence = MIDI_API.sequence.Sequence,
    sequenceToSMF = MIDI_API.standardMIDIFile.sequenceToSMF,

    midiAccess,
    score,
    assistant,
    sequence,
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    svgPagesDiv,
    mo = {}, // main option panel elements
    cl = {}, // control layers

    // constants for control layer opacity values
    METAL = "1", // control layer is completely opaque
    SMOKE = "0.7", // control layer is smoky (semi-transparent)
    GLASS = "0", // control layer is completely transparent

    // options set in the pop-up menues in the main options dialog
    controlOptions =
    [
        { name: "channel pressure", statusHighNibble: 0xD0 },
        { name: "pitch wheel", statusHighNibble: 0xE0 },
        { name: "modulation (1)", midiControl: 1 },
        { name: "volume (7)", midiControl: 7 },
        { name: "pan (10)", midiControl: 10 },
        { name: "expression (11)", midiControl: 11 },
        { name: "timbre (71)", midiControl: 71 },
        { name: "brightness (74)", midiControl: 74 },
        { name: "effects (91)", midiControl: 91 },
        { name: "tremolo (92)", midiControl: 92 },
        { name: "chorus (93)", midiControl: 93 },
        { name: "celeste (94)", midiControl: 94 },
        { name: "phaser (95)", midiControl: 95 }
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
                window.URL.revokeObjectURL(downloadLink.href); // window.URL is set in jiMain.js
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
    // sequence is a MIDI_API.sequence.Sequence object.
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
            a.href = window.URL.createObjectURL(standardMIDIFile); // window.URL is set in jiMain.js
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
    setMidiDevices = function (midiAccess)
    {
        var 
        inSelector = document.getElementById("midiInputDeviceSelector"),
        outSelector = document.getElementById("midiOutputDeviceSelector");

        options.inputDeviceId = inSelector.selectedIndex - 1;
        options.outputDeviceId = outSelector.selectedIndex - 1;
        options.getInputDevice = function (midiInputEventHandler)
        {
            if (options.inputDevice !== undefined && options.inputDevice !== null)
            {
                options.inputDevice.close();
                options.inputDevice = null;
            }
            if (options.inputDeviceId !== -1)
            {
                options.inputDevice = midiAccess.getInput(options.inputDeviceId);
                if (midiInputEventHandler !== null)
                {
                    //// 14.01.2013: W3C says there is simply an onmessage field in InputDevice
                    //options.inputDevice.onmessage = midiInputEventHandler;

                    //options.inputDevice.addEventListener("midimessage", function (msg)
                    //{
                    //    midiInputEventHandler(msg);
                    //});

                    options.inputDevice.addEventListener("message", function (msg)
                    {
                        midiInputEventHandler(msg);
                    });
                }
            }
        };

        if (options.outputDevice !== undefined && options.outputDevice !== null)
        {
            options.outputDevice.close();
            options.outputDevice = null;
        }

        if (options.outputDeviceId !== -1)
        {
            options.outputDevice = midiAccess.getOutput(options.outputDeviceId);
        }
    },

    setMainOptionsState = function (mainOptionsState)
    {
        var inputDeviceIndex, scoreIndex, outputDeviceIndex;

        function disableSelector(selector)
        {
            if (selector.disabled === false)
            {
                selector.disabled = true;
                while (selector.options !== undefined && selector.options.length > 0)
                {
                    selector.remove(0);
                }
            }
        }

        function enableSelector(selector, defaultString)
        {
            var options, i, nOptions;
            function populate(selector)
            {
                var 
                i, nOptions = controlOptions.length,
                    element, textNode;

                for (i = 0; i < nOptions; ++i)
                {
                    element = document.createElement("option");
                    textNode = document.createTextNode(controlOptions[i].name);
                    element.appendChild(textNode);
                    selector.add(element, null);
                }
            }

            if (selector.disabled)
            {
                selector.disabled = false;
                if (selector.selectedIndex < 0)
                {
                    populate(selector);
                    options = selector.options;
                    nOptions = options.length;
                    for (i = 0; i < nOptions; ++i)
                    {
                        if (options[i].childNodes[0].nodeValue === defaultString)
                        {
                            selector.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        }

        switch (mainOptionsState)
        {
            case "enable":
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
                    mo.pressureSubstituteControlDataSelector.disabled = true;

                    mo.usesModSoloCheckbox.disabled = true;
                    mo.usesModOtherTracksCheckbox.disabled = true;
                    mo.modSustituteControlSelector.disabled = true;

                    mo.usesPitchBendSoloCheckbox.disabled = true;
                    mo.usesPitchBendOtherTracksCheckbox.disabled = true;
                    mo.pitchBendSubstituteControlDataSelector.disabled = true;

                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = true;
                    mo.assistantsSpeedInputText.disabled = true;
                }
                else if (inputDeviceIndex !== 0)
                {
                    mo.trackSelector.disabled = false;

                    mo.soloVelocityOptionCheckbox.disabled = false;
                    mo.otherTracksVelocityOptionCheckbox.disabled = false;
                    mo.soloPitchOptionCheckbox.disabled = false;
                    mo.otherTracksPitchOptionCheckbox.disabled = false;

                    mo.usesPressureSoloCheckbox.disabled = false;
                    mo.usesPressureOtherTracksCheckbox.disabled = false;
                    if (mo.usesPressureSoloCheckbox.checked || mo.usesPressureOtherTracksCheckbox.checked)
                    {
                        enableSelector(mo.pressureSubstituteControlDataSelector, "channel pressure");
                    }
                    else
                    {
                        disableSelector(mo.pressureSubstituteControlDataSelector);
                    }

                    mo.usesPitchBendSoloCheckbox.disabled = false;
                    mo.usesPitchBendOtherTracksCheckbox.disabled = false;
                    if (mo.usesPitchBendSoloCheckbox.checked || mo.usesPitchBendOtherTracksCheckbox.checked)
                    {
                        enableSelector(mo.pitchBendSubstituteControlDataSelector, "pitch wheel");
                    }
                    else
                    {
                        disableSelector(mo.pitchBendSubstituteControlDataSelector);
                    }

                    mo.usesModSoloCheckbox.disabled = false;
                    mo.usesModOtherTracksCheckbox.disabled = false;
                    if (mo.usesModSoloCheckbox.checked || mo.usesModOtherTracksCheckbox.checked)
                    {
                        enableSelector(mo.modSustituteControlSelector, "modulation (1)");
                    }
                    else
                    {
                        disableSelector(mo.modSustituteControlSelector);
                    }

                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = false;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = false;
                    mo.assistantsSpeedInputText.disabled = false;
                }
                else // inputDevice === 0
                {
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

                    //mo.assistantUsesAbsoluteDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = true;

                    mo.assistantUsesAbsoluteDurationsRadioButton.checked = true;
                    mo.assistantUsesRelativeDurationsRadioButton.checked = false;
                    // The speed option can be used with or without a midi input device.
                }

                if (mo.assistantUsesAbsoluteDurationsRadioButton.checked === false
                || mo.assistantUsesAbsoluteDurationsRadioButton.disabled === true)
                {
                    mo.assistantsSpeedInputText.disabled = true;
                }
                else
                {
                    mo.assistantsSpeedInputText.disabled = false;
                }

                // Note that the midi input device does not have to be set in order to
                // enable the start button.

                if (scoreIndex !== 0 && outputDeviceIndex !== 0)
                {
                    mo.startRuntimeButton.disabled = false;
                }
                else
                {
                    mo.startRuntimeButton.disabled = true;
                }
                break;
            case "disabled":
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
                mo.startRuntimeButton.disabled = true;
                break;
            default:
                throw "Unknown svgControlsState";
        }
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
    },

    // callback called when a performing sequence is stopped or has played its last message,
    // or when the assistant is stopped or has played its last subsequence.
    reportEndOfPerformance = function (recordedSequence, performanceMsDuration)
    {
        var
        scoreName = mo.scoreSelector.options[mo.scoreSelector.selectedIndex].text;

        // Event timestamps are shifted so as to be relative to the beginning of the
        // recording.
        // Returns false if the recordedSequence was empty, otherwise true.
        function zeroEventTimestampsOrigin(recordedSequence)
        {
            var i, nTracks = sequence.tracks.length, track,
                j, nMoments, moment,
                k, nEvents,
                offset, success = true;

            // Returns the earliest event.timestamp in the recordedSequence.
            function findOffset(recordedSequence)
            {
                var
                i, nTracks = recordedSequence.tracks.length, track, nMoments,
                timestamp,
                offset = Number.MAX_VALUE;

                for (i = 0; i < nTracks; ++i)
                {
                    track = recordedSequence.tracks[i];
                    nMoments = track.moments.length;
                    if (nMoments > 0 && track.moments[0].events.length > 0)
                    {
                        timestamp = track.moments[0].events[0].timestamp;
                        offset = (offset < timestamp) ? offset : timestamp;
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
                        nEvents = moment.events.length;
                        for (k = 0; k < nEvents; ++k)
                        {
                            moment.events[k].timestamp -= offset;
                        }
                    }
                }
            }
            return success;
        }

        if (recordedSequence !== undefined && recordedSequence !== null)
        {
            if (zeroEventTimestampsOrigin(recordedSequence))  // false if the recorded sequence is empty
            {
                createSaveMIDIFileButton(scoreName, recordedSequence, performanceMsDuration);
            }
        }

        if (assistant !== undefined)
        {
            assistant.revertTimestamps();
        }
        else
        {
            sequence.revertTimestamps();
        }

        setStopped();
        // the following line is important, because the stop button is also the pause button.
        svgControlsState = "stopped";
    },

    // callback called by a performing sequence. Reports the msPositionInScore of the
    // Moment curently being sent. When all the events in the span have been played,
    // reportEndOfPerformance() is called (see above).
    reportMsPos = function (msPositionInScore)
    {
        //console.log("jiAPControls: calling score.advanceRunningMarker(msPosition), msPositionInScore=" + msPositionInScore);
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
        }

        // setStopped is outer function

        function setPaused()
        {
            if (options.assistedPerformance === true)
            {
                throw "Error: Assisted performances are never paused.";
            }

            if (sequence !== undefined && !(sequence.isStopped()) && !(sequence.isPaused()))
            {
                sequence.pause();
            }

            score.allNotesOff(options.outputDevice);

            tracksControl.setDisabled(true);

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
            i, nTracks = trackIsOnArray.length,
            recordingSequence = new Sequence(score.startMarkerMsPosition());

            for (i = 0; i < nTracks; ++i)
            {
                recordingSequence.tracks.push(new Track());
            }

            deleteSaveMIDIFileButton();

            if (options.assistedPerformance === true && assistant !== undefined)
            {
                if (assistant.isStopped())
                {
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
            // c.f. http://james-ingram.de/MidiBridge/js/jiMidiControl.js
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
            // c.f. http://james-ingram.de/MidiBridge/js/jiMidiControl.js
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

    // S ets up the pop-up menues for scores and MIDI input and output devices.
    init = function (mAccess)
    {
        function getMainOptionElements()
        {
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

            mo.assistantUsesAbsoluteDurationsRadioButton = document.getElementById("assistantUsesAbsoluteDurationsRadioButton");
            mo.assistantsSpeedInputText = document.getElementById("assistantsSpeedInputText");
            mo.assistantUsesRelativeDurationsRadioButton = document.getElementById("assistantUsesRelativeDurationsRadioButton");
            mo.startRuntimeButton = document.getElementById("startRuntimeButton");
        }

        // sets the options in the device selectors' menus
        function setMIDIDeviceSelectors(midiAccess)
        {
            var 
            i, nItems, option,
            is = mo.midiInputDeviceSelector, // = document.getElementById("midiInputDeviceSelector")
            os = mo.midiOutputDeviceSelector, // = document.getElementById("midiOutputDeviceSelector")
            inputs = midiAccess.enumerateInputs(),
            outputs = midiAccess.enumerateOutputs();

            option = document.createElement("option");
            option.text = "choose a MIDI input device";
            is.add(option, null);
            nItems = inputs.length;
            for (i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.text = inputs[i].name;
                is.add(option, null);
            }

            option = document.createElement("option");
            option.text = "choose a MIDI output device";
            os.add(option, null);
            nItems = outputs.length;
            for (i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.text = outputs[i].name;
                os.add(option, null);
            }
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
            height = Math.round(parseFloat(div.style.height)),
            scrollTop = div.scrollTop;

            if (runningMarkerYCoordinates.bottom > (height + scrollTop))
            {
                div.scrollTop = runningMarkerYCoordinates.top - 10;
            }
        }

        function setSvgPagesDivHeight()
        {
            svgPagesDiv = document.getElementById("svgPages");
            svgPagesDiv.style.height = window.innerHeight - 43;
        }

        midiAccess = mAccess;

        getMainOptionElements();

        setMIDIDeviceSelectors(midiAccess);

        score = new Score(runningMarkerHeightChanged); // an empty score, with callback function

        setSvgPagesDivHeight();

        getControlLayers(document);

        setSvgControlsState('disabled');

        window.scrollTo(0, 0);
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
            var scoreSelectorElem = document.getElementById("scoreSelector"),
                nTracks = 0;

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

            // To embed other scores, simply follow this pattern with the appropriate number of pages.
            // The page size defined at the top of the svg pages should be 1010 x 1037, as in Study2c3.1.
            function setStudy2c3_1()
            {
                var embedCode = "",
                    page1Url = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study 2c3.1/Study 2c3.1 page 1.svg",
                    page2Url = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study 2c3.1/Study 2c3.1 page 2.svg",
                    page3Url = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study 2c3.1/Study 2c3.1 page 3.svg";

                embedCode += embedPageCode(page1Url);
                embedCode += embedPageCode(page2Url);
                embedCode += embedPageCode(page3Url);

                document.getElementById('svgPages').innerHTML = embedCode;

                return 3; // the number of tracks
            }

            function setStudy3Sketch1()
            {
                var embedCode = "",
                    page1Url = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study 3 sketch 1/Study 3 sketch 1 page 1.svg",
                    page2Url = "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Study 3 sketch 1/Study 3 sketch 1 page 2.svg";

                embedCode += embedPageCode(page1Url);
                embedCode += embedPageCode(page2Url);

                document.getElementById('svgPages').innerHTML = embedCode;

                return 8; // the number of tracks
            }

            switch (scoreSelectorElem.selectedIndex)
            {
                case 0:
                    nTracks = 0;
                    break;
                case 1:
                    nTracks = setStudy2c3_1();
                    break;
                case 2:
                    nTracks = setStudy3Sketch1();
                    break;
                default:
                    throw "unknown score!";
            }

            setPerformersTrackSelector(nTracks);
            tracksControl.init(nTracks);
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
            setMidiDevices(midiAccess);
            tracksControl.setTracksControlState(mo.midiInputDeviceSelector.selectedIndex > 0, mo.trackSelector.selectedIndex);
        }

        if (controlID === "scoreSelector")
        {
            setScore();
            tracksControl.setTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
        }

        if (controlID === "midiOutputDeviceSelector")
        {
            setMidiDevices(midiAccess);
        }

        if (controlID === "trackSelector")
        {
            tracksControl.setTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
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
                    tracksControl.setTracksControlState(true, options.livePerformersTrackIndex);
                    tracksControl.refreshDisplay();
                }
                else
                {
                    tracksControl.setTracksControlState(false, options.livePerformersTrackIndex);
                    tracksControl.refreshDisplay();
                }

                sequence = score.createSequence(options.assistantsSpeed);

                if (options.assistedPerformance === true)
                {// this constructor consumes sequence, resetting moment timestamps relative to the start of their subsection.
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
                window.scrollTo(0, 0);
                scoreHasJustBeenSelected = false;
            }
        }
    },

    // functions for adjusting the appearance of the options dialog
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
                score.getEmptyPagesAndSystems(); // everything except the timeObjects (which have to take account of speed)
            }

            score.getTimeObjects(options.assistantsSpeed);

            sequence = score.createSequence(options.assistantsSpeed);

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // TracksControl.refreshDisplay() calls score.refreshDisplay(isAssistedPerformance, livePerformersTrackIndex)
            // to tell the score to repaint itself. The score may also update the position of the start marker (which
            // always starts on a chord) if a track becomes disabled.
            tracksControl.getUpdateDisplayCallback(score.refreshDisplay);

            // tracksControl.trackIsOn(trackIndex) returns a boolean which is the on/off status of its trackIndex argument
            score.getTrackIsOnCallback(tracksControl.trackIsOn);

            tracksControl.setTracksControlState(options.assistedPerformance, options.livePerformersTrackIndex);
            tracksControl.setAllTracksOn();

            tracksControl.refreshDisplay(); // refreshes itself and the score

            if (options.assistedPerformance === true)
            {
                // This constructor resets moment timestamps relative to the start of their subsequence.
                // The sequence therefore needs to be reloaded when the options (performer's track index) change.    
                assistant = new Assistant(sequence, options, reportEndOfPerformance, reportMsPos);
            }

            window.scrollTo(0, 630); // 600 is the absolute position of the controlPanel div (!)

            score.moveStartMarkerToTop(svgPagesDiv);

            setSvgControlsState('stopped');

            if (options.assistedPerformance === true && assistant !== undefined)
            {
                setSvgControlsState('playing');
            }
        }
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
