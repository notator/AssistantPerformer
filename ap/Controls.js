/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Controls.js
*  The _AP.controls namespace which defines the
*  Assistant Performer's Graphic User Interface. 
*/

/*jslint bitwise: false, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.controls');

_AP.controls = (function(document, window)
{
    "use strict";

    var
    tracksControl = _AP.tracksControl,
    Score = _AP.score.Score,
    sequence = _AP.sequence,
    player = _AP.player,

    SequenceRecording = _AP.sequenceRecording.SequenceRecording,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,
    sequenceToSMF = _AP.standardMIDIFile.sequenceToSMF,

    midiAccess,
    score,
    svg = {}, // an object containing pointers to functions defined in SVG files
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
    deleteSaveMIDIFileButton = function()
    {
        var
        downloadLinkDiv = document.getElementById("downloadLinkDiv"), // the Element which will contain the link
        downloadLink, i;

        for(i = 0; i < downloadLinkDiv.childNodes.length; ++i)
        {
            if(downloadLinkDiv.childNodes[i].id === "downloadLink")
            {
                downloadLink = downloadLinkDiv.childNodes[i];
                break;
            }
        }

        if(downloadLink !== undefined)
        {
            // Need a small delay for the revokeObjectURL to work properly.
            window.setTimeout(function ()
            {
                window.URL.revokeObjectURL(downloadLink.href); // window.URL is set in Main.js
                downloadLinkDiv.removeChild(downloadLink);
            }, 1500);
        }
    },

    // Returns true if any of the trackRecordings contain moments, otherwise false.
    // Used to prevent the creation of a 'save' button when there is nothing to save.
    hasData = function(nTracks, trackRecordings)
    {
        var i, has = false;
        for(i = 0; i < nTracks; ++i)
        {
            if(trackRecordings[i].moments.length > 0)
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
    getMIDIFileName = function(scoreName)
    {
        var
        d = new Date(),
        dayOfTheMonth = (d.getDate()).toString(),
        month = (d.getMonth() + 1).toString(),
        year = (d.getFullYear()).toString(),
        downloadName;

        if(month.length === 1)
        {
            month = "0".concat(month);
        }

        if(dayOfTheMonth.length === 1)
        {
            dayOfTheMonth = "0".concat(dayOfTheMonth);
        }

        downloadName = scoreName.concat('_', year, '-', month, '-', dayOfTheMonth, '.mid'); // .mid is added in case scoreName contains a '.'.

        return downloadName;
    },

    // Creates a button which, when clicked, downloads a standard MIDI file recording
    // of the sequenceRecording which has just stopped being recorded.
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
    // sequenceRecording is a _AP.sequenceRecording.SequenceRecording object.
    // sequenceMsDuration is the total duration of the sequenceRecording in milliseconds (an integer).
    //      and determines the timing of the end-of-track events. When this is a recorded sequenceRecording,
    //      this value is simply the duration between the start and end markers.
    createSaveMIDIFileButton = function(scoreName, sequenceRecording, sequenceMsDuration)
    {
        var
        standardMIDIFile,
        downloadName,
        downloadLinkDiv, downloadLinkFound = false, i, a,
        nTracks = sequenceRecording.trackRecordings.length;

        if(hasData(nTracks, sequenceRecording.trackRecordings))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the Element which will contain the link

            if(downloadLinkDiv !== undefined)
            {
                for(i = 0; i < downloadLinkDiv.childNodes.length; ++i)
                {
                    if(downloadLinkDiv.childNodes[i].id === "downloadLink")
                    {
                        downloadLinkFound = true;
                    }
                }

                if(downloadLinkFound === false)
                {

                    downloadName = getMIDIFileName(scoreName);

                    standardMIDIFile = sequenceToSMF(sequenceRecording, sequenceMsDuration);

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
            }
        }
    },

    // This function is called when the input or output device selectors change.
    setMIDIDevices = function()
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

    setControlVisibilityStates = function()
    {
        function minimumPressureDivVisibility()
        {
            var returnValue = "hidden";

            function isVisibleAndMappedToVolume(selector)
            {
                var rval = false;
                if(selector.style.visibility === "visible" && selector.selectedIndex === 4) // 4 is volume
                {
                    rval = true;
                }
                return rval;
            }

            if(isVisibleAndMappedToVolume(mo.pressureSubstituteControlDataSelector)
                || isVisibleAndMappedToVolume(mo.pitchBendSubstituteControlDataSelector)
                || isVisibleAndMappedToVolume(mo.modSustituteControlSelector))
            {
                return "visible";
            }
            
            return returnValue;
        }

        if(mo.usesPressureSoloCheckbox.disabled === false && (mo.usesPressureSoloCheckbox.checked === true || mo.usesPressureOtherTracksCheckbox.checked === true))
        {
            mo.pressureSubstituteControlDataSelector.style.visibility = "visible";
        }
        else
        {
            mo.pressureSubstituteControlDataSelector.style.visibility = "hidden";
        }

        if(mo.usesPitchBendSoloCheckbox.disabled === false && (mo.usesPitchBendSoloCheckbox.checked === true || mo.usesPitchBendOtherTracksCheckbox.checked === true))
        {
            mo.pitchBendSubstituteControlDataSelector.style.visibility = "visible";
        }
        else
        {
            mo.pitchBendSubstituteControlDataSelector.style.visibility = "hidden";
        }

        if(mo.usesModSoloCheckbox.disabled === false && (mo.usesModSoloCheckbox.checked === true || mo.usesModOtherTracksCheckbox.checked === true))
        {
            mo.modSustituteControlSelector.style.visibility = "visible";
        }
        else
        {
            mo.modSustituteControlSelector.style.visibility = "hidden";
        }

        if(mo.speedControllerSelector.disabled === false && mo.speedControllerSelector.selectedIndex > 0)
        {
            mo.speedControllerMaxSpeedDiv.style.visibility = "visible";
        }
        else
        {
            mo.speedControllerMaxSpeedDiv.style.visibility = "hidden";
        }

        mo.minimumPressureDiv.style.visibility = minimumPressureDivVisibility();
    },

    setMainOptionsState = function(mainOptionsState)
    {
        var inputDeviceIndex, scoreIndex, outputDeviceIndex;

        switch(mainOptionsState)
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

                if(scoreIndex === 0)
                {
                    mo.speedPercentInputText.disabled = true;
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

                    mo.speedControllerSelector.disabled = true;
                }
                else if(inputDeviceIndex > 0) // && scoreIndex > 0
                {
                    // The speed option can be used with or without a midi input device.
                    mo.speedPercentInputText.disabled = false;
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

                    mo.speedControllerSelector.disabled = false;
                }
                else // inputDevice === 0, scoreIndex > 0 (The speed option can be used with or without a midi input device).
                {
                    // The speed option can be used with or without a midi input device.
                    mo.speedPercentInputText.disabled = false;
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

                    mo.speedControllerSelector.disabled = true;
                }

                // Note that the midi input device does not have to be set in order to
                // enable the start button.
                if(scoreIndex !== 0 && outputDeviceIndex !== 0)
                {
                    mo.startRuntimeButton.setAttribute('value', 'Start');
                    mo.startRuntimeButton.disabled = false;
                }
                else
                {
                    mo.startRuntimeButton.setAttribute('value', 'not ready');
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

                mo.speedPercentInputText.disabled = true;

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

                mo.speedControllerSelector.disabled = true;

                mo.startRuntimeButton.disabled = true;
                break;
            default:
                throw "Unknown svgControlsState";
        }

        setControlVisibilityStates();
    },

    // start or stop listening to the input device.
    doInputEventListener = function(options, addOrRemoveEventListener)
    {
        if(options.livePerformance === false)
        {
            throw "This function should only be called when a midi input device is in use.";
        }

        /*********************/
        // Just testing. Delete these lines when options.performerOptions is complete and working.
        if(options.performerOptions === undefined)
        {
            options.performerOptions = {};
        }
        options.performerOptions.inputDeviceType = 'monoInput';
        /*********************/

        switch(options.performerOptions.inputDeviceType)
        {
            case 'monoInput':
                addOrRemoveEventListener("midimessage", _AP.monoInput.handleMIDIInputEvent);
                break;
            case 'polyInput': // The _AP.polyInput namespace is currently just a stub. It might work like a prepared piano.
                addOrRemoveEventListener("midimessage", _AP.polyInput.handleMIDIInputEvent);
                break;
        }
    },

    addInputEventListener = function(options)
    {
        doInputEventListener(options, options.inputDevice.addEventListener);
    },

    removeInputEventListener = function(options)
    {
        doInputEventListener(options, options.inputDevice.removeEventListener);
    },

    setStopped = function()
    {
        player.stop();

        score.moveRunningMarkerToStartMarker();

        score.allNotesOff(options.outputDevice);

        setMainOptionsState("disabled");

        cl.gotoOptionsDisabled.setAttribute("opacity", GLASS);

        if(document.getElementById("midiInputDeviceSelector").selectedIndex === 0)
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

        if(options.livePerformance === true)
        {
            removeInputEventListener(options);
        }
    },

    // callback called when a performing sequenceRecording is stopped or has played its last message,
    // or when the player is stopped or has played its last subsequence.
    reportEndOfPerformance = function(sequenceRecording, performanceMsDuration)
    {
        var
        scoreName = mo.scoreSelector.options[mo.scoreSelector.selectedIndex].text;

        // Moment timestamps in the recording are shifted so as to be relative to the beginning of the
        // recording. Returns false if the if the sequenceRecording is undefined, null or has no moments.
        function setTimestampsRelativeToSequenceRecording(sequenceRecording)
        {
            var i, nTracks = sequenceRecording.trackRecordings.length, trackRecording,
                j, nMoments, moment, 
                offset, success = true;

            // Returns the earliest moment.timestamp in the sequenceRecording.
            // Returns Number.MAX_VALUE if sequenceRecording is undefined, null or has no moments.
            function findOffset(sequenceRecording)
            {
                var
                i, nTracks, trackRecording,
                timestamp,
                offset = Number.MAX_VALUE;

                if(sequenceRecording !== undefined && sequenceRecording !== null)
                {
                    nTracks = sequenceRecording.trackRecordings.length;
                    for(i = 0; i < nTracks; ++i)
                    {
                        trackRecording = sequenceRecording.trackRecordings[i];
                        if(trackRecording.moments.length > 0)
                        {
                            timestamp = trackRecording.moments[0].timestamp;
                            offset = (offset < timestamp) ? offset : timestamp;
                        }
                    }
                }

                return offset;
            }

            offset = findOffset(sequenceRecording);

            if(offset === Number.MAX_VALUE)
            {
                success = false;
            }
            else
            {
                for(i = 0; i < nTracks; ++i)
                {
                    trackRecording = sequenceRecording.trackRecordings[i];
                    nMoments = trackRecording.moments.length;
                    for(j = 0; j < nMoments; ++j)
                    {
                        moment = trackRecording.moments[j];
                        moment.timestamp -= offset;
                    }
                }
            }
            return success;
        }

        if(setTimestampsRelativeToSequenceRecording(sequenceRecording))
        {
            createSaveMIDIFileButton(scoreName, sequenceRecording, performanceMsDuration);
        }

        // The moment.timestamps do not need to be restored to their original values here
        // because they will be re-assigned next time sequenceRecording.nextMoment() is called.

        setStopped();
        // the following line is important, because the stop button is also the pause button.
        svgControlsState = "stopped";
    },

    // callback called by a performing sequence. Reports the msPositionInScore of the
    // Moment curently being sent. When all the events in the span have been played,
    // reportEndOfPerformance() is called (see above).
    reportMsPos = function(msPositionInScore)
    {
        //console.log("Controls: calling score.advanceRunningMarker(msPosition), msPositionInScore=" + msPositionInScore);
        // If there is a graphic object in the score having msPositionInScore,
        // the running cursor is aligned to that object.
        score.advanceRunningMarker(msPositionInScore);
    },

    //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    setSvgControlsState = function(svgCtlsState)
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

            if(options.livePerformance === true)
            {
                removeInputEventListener(options);
            }
        }

        // setStopped is outer function

        function setPaused()
        {
            if(options.livePerformance === true)
            {
                throw "Error: Assisted performances are never paused.";
            }

            if(player.isRunning())
            {
                player.pause();
            }

            score.allNotesOff(options.outputDevice);

            tracksControl.setDisabled(true);

            if(options.livePerformance === true)
            {
                removeInputEventListener(options);
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
            sequenceRecording;

            function sendTrackInitializationMessages(options, isAssistedPerformance)
            {
                var nTracks = trackIsOnArray.length,
                    trackIndex, value;

                for(trackIndex = 0; trackIndex < nTracks; ++trackIndex)
                { 
                    if(options.trackPitchWheelDeviations.length > 0)
                    {
                        value = options.trackPitchWheelDeviations[trackIndex];
                    }
                    else
                    {
                        value = 2;
                    }
                    player.sendSetPitchWheelDeviationMessageNow(options.outputDevice, trackIndex, value);

                    if(isAssistedPerformance && options.pressureSubstituteControlData !== null && options.pressureSubstituteControlData.midiControl === CONTROL.VOLUME)
                    {
                        value = options.runtimeOptions.track.minVolumes[trackIndex];
                    }
                    else if(options.trackMaxVolumes !== undefined && options.trackMaxVolumes.length > 0)
                    {
                        value = options.trackMaxVolumes[trackIndex];
                    }
                    else
                    {
                        value = 127; // default
                    }
                    player.sendControlMessageNow(options.outputDevice, trackIndex, CONTROL.VOLUME, value);

                    if(isAssistedPerformance && options.pressureSubstituteControlData !== null && options.pressureSubstituteControlData.midiControl !== CONTROL.VOLUME)
                    {
                        player.sendControlMessageNow(options.outputDevice, trackIndex, options.pressureSubstituteControlData.midiControl,
                            options.performersMinimumPressure);
                    }
                }
            }

            deleteSaveMIDIFileButton();

            if(sequence.tracks.length > 0)
            {
                if(player.isPaused())
                {
                    player.resume();
                }
                else if(player.isStopped())
                {
                    sequenceRecording = new SequenceRecording(nTracks);

                    // the running marker is at its correct position:
                    // either at the start marker, or somewhere paused.
                    score.setRunningMarkers();
                    score.moveStartMarkerToTop(svgPagesDiv);

                    sendTrackInitializationMessages(options, options.livePerformance);

                    player.sendControlMessageNow(options.outputDevice, CONTROL.VOLUME, 127);

                    player.play(options, score.startMarkerMsPosition(), score.endMarkerMsPosition(),
                        trackIsOnArray, sequenceRecording, reportEndOfPerformance, reportMsPos);
                }

                cl.pauseUnselected.setAttribute("opacity", METAL);
                cl.pauseSelected.setAttribute("opacity", GLASS);
                cl.goDisabled.setAttribute("opacity", GLASS);
            }

            tracksControl.setDisabled(true);

            if(options.livePerformance === true)
            {
                addInputEventListener(options);
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

            if(s.svgFrames !== undefined)
            {
                switch(svgControlsState)
                {
                    case 'settingStart':
                        for(i = 0; i < s.svgFrames.length; ++i)
                        {
                            s.svgFrames[i].addEventListener('click', s.setStartMarkerClick, false);
                            s.svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), crosshair";
                        }
                        break;
                    case 'settingEnd':
                        for(i = 0; i < s.svgFrames.length; ++i)
                        {
                            s.svgFrames[i].addEventListener('click', s.setEndMarkerClick, false);
                            s.svgFrames[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setEndCursor.cur'), pointer";
                        }
                        break;
                    default:
                        for(i = 0; i < s.svgFrames.length; ++i)
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

        switch(svgControlsState)
        {
            case 'disabled':
                setDisabled(); // enables the main options panel
                break;
            case 'stopped':
                setStopped();
                break;
            case 'paused':
                if(options.livePerformance === false)
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
    // This function is called by both init() and setDefaultRuntimeOptions() below.
    setMainOptionsDefaultStates = function()
    {
        mo.trackMaxVolumes = [];
        mo.trackPitchWheelDeviations = [];

        mo.speedPercentInputText.value = "100";

        mo.trackSelector.selectedIndex = 0;

        mo.soloPitchOptionCheckbox.checked = false;
        mo.otherTracksPitchOptionCheckbox.checked = false;
        mo.soloVelocityOptionCheckbox.checked = false;
        mo.otherTracksVelocityOptionCheckbox.checked = false;

        mo.usesPressureSoloCheckbox.checked = false;
        mo.usesPressureOtherTracksCheckbox.checked = false;
        mo.pressureSubstituteControlDataSelector.selectedIndex = 4;

        mo.usesPitchBendSoloCheckbox.checked = false;
        mo.usesPitchBendOtherTracksCheckbox.checked = false;
        mo.pitchBendSubstituteControlDataSelector.selectedIndex = 2;

        mo.usesModSoloCheckbox.checked = false;
        mo.usesModOtherTracksCheckbox.checked = false;
        mo.modSustituteControlSelector.selectedIndex = 3;

        mo.speedControllerSelector.selectedIndex = 0;
        mo.speedControllerMaxSpeedInputText.value = 2;

        mo.minimumPressureInputText.value = 64;  // default value. Only used in assisted performances.
    },

    // Defines the window.svgLoaded(...) function.
    // Sets up the pop-up menues for scores and MIDI input and output devices.
    init = function(mAccess)
    {
        function getMainOptionElements()
        {
            mo.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            mo.controlPanel = document.getElementById("controlPanel");
            mo.svgPages = document.getElementById("svgPages");

            mo.midiInputDeviceSelector = document.getElementById("midiInputDeviceSelector");
            mo.scoreSelector = document.getElementById("scoreSelector");
            mo.midiOutputDeviceSelector = document.getElementById("midiOutputDeviceSelector");

            mo.speedPercentInputText = document.getElementById("speedPercentInputText");

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

            mo.speedControllerSelector = document.getElementById("speedControllerSelector");
            mo.speedControllerMaxSpeedDiv = document.getElementById("speedControllerMaxSpeedDiv");
            mo.speedControllerMaxSpeedInputText = document.getElementById("speedControllerMaxSpeedInputText");

            mo.minimumPressureDiv = document.getElementById("minimumPressureDiv");
            mo.minimumPressureInputText = document.getElementById("minimumPressureInputText");
            
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
            for(i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.inputDevice = inputs[i];
                option.text = inputs[i].name;
                is.add(option, null);
            }

            option = document.createElement("option");
            option.text = "choose a MIDI output device";
            os.add(option, null);
            nItems = outputs.length;
            for(i = 0; i < nItems; ++i)
            {
                option = document.createElement("option");
                option.outputDevice = outputs[i];
                option.text = outputs[i].name;
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

            if(runningMarkerYCoordinates.bottom > (height + div.scrollTop))
            {
                div.scrollTop = runningMarkerYCoordinates.top - 10;
            }
        }

        function setSvgPagesDivHeight()
        {
            svgPagesDiv = document.getElementById("svgPages");
            svgPagesDiv.style.height = window.innerHeight - 43;
        }

        if(document.URL.search("file://") === 0)
        {
            svg.getSVGDocument = function (embedded_element)
            {
                var subdoc;

                if(embedded_element.contentDocument)
                {
                    subdoc = embedded_element.contentDocument;
                }
                else
                {
                    subdoc = null;
                    try
                    {
                        subdoc = embedded_element.getSVGDocument();
                    }
                    catch(e)
                    {
                        alert("Exception thrown: Could not get embedded SVG document.");
                    }
                }
                return subdoc;
            };
        }
        else
        {
            // This function is called by the first SVG page in a score when it loads (using an onLoad() function).
            // The argument list contains pointers to functions defined in scores/SVG.js
            // The first SVG page in each score contains the line
            //     <script type="text/javascript" xlink:href="../SVG.js"/>
            // Each argument function is added to the local svg object (which only exists for that purpose).
            window._JI_SVGLoaded = function (getSVGDocument)
            {
                svg.getSVGDocument = getSVGDocument;
            };
        }

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

    // If this is a live performance, display the options in a panel like the current one. Otherwise
    // either delete the performer's options display panel or grey it out.
    // (In contrast to previous versions of the AP, these options will be fixed in the score, and cant be
    // changed in a dialog.)
    // There will be (at least) two live performance modes, having possibly different sets of options:
    //      options.performerOptions.inputDeviceType === 'monoInput' and
    //      options.performerOptions.inputDeviceType === 'polyInput'
    // See player.play().
    displayPerformerOptions = function(islivePerformance, performerOptions)
    {
        console.log("controls.displayPerformanceOptions() still needs to be written.");
    },

    initTracksPlayerAndPerformer = function (score, options)
    {
        if(scoreHasJustBeenSelected)
        {
            score.getEmptyPagesAndSystems(svg); // everything except the timeObjects (which have to take account of speed)
        }

        score.setPerformerOptions(svg, options); // sets options.performerOptions
        score.setSequenceTracks(svg, options); // sets sequence.tracks

        player.init(options.outputDevice, sequence.tracks); // sets player.nextMoment to simple no inputDevice version.

        displayPerformerOptions(options.livePerformance, options.performerOptions);

        // If this is a live performance, _AP.monoInput.runtimeInit(...) or _AP.polyInput.runtimeInit() will be called from player.play(...).
    },

    // called when the user clicks a control in the GUI
    doControl = function(controlID)
    {
        // This function is called when the user selects a score in the score selector.
        // It analyses the score's id string in the scoreSelector in assistantPerformer.html,
        // and uses the information to:
        //     1. set the options on the main options page to default values,
        //     2. load the score's svg files into the "svgPages" div,
        //     3. and initialize the tracksControl (in the SVG controls at the top of the score).
        // The score is actually analysed when the Start button is clicked.
        function setScore()
        {
            var scoreInfo;

            // Returns a scoreInfo object constructed from the runtimeOptions defined in the score's .mkss file
            // The scoreInfo object returned by this function has the following attributes:
            //      scoreInfo.name (e.g. "Song Six")
            //      scoreInfo.nPages (e.g. 7)
            //      scoreInfo.nTracks (e.g. 8)
            // and optionally (if present)
            //      scoreInfo.trackInitialisationValues (optional maxVolumes and pitchWheelDeviations.)
            // and optionally (if present)
            //      scoreInfo.defaultPerformanceOptions (see below)
            function getScoreRuntimeInfo()
            {
                var scoreSelectorElem = document.getElementById("scoreSelector"),
                    scoreInfo = {}, 
                    runtimeInfoString, trackInitString, mPerformerOptionsString, pPerformerOptionsString;

                function getRuntimeInfoString(scoreName)
                {
                    var
                    scorePath = "scores/" + scoreName + "/" + scoreName + ".mkss",
                    xhr = new XMLHttpRequest(),
                    scoreMkssString,
                    index1, index2,
                    runtimeInfoString;

                    xhr.open('GET', scorePath, false); // asynch used to be true
                    xhr.setRequestHeader("Content-Type", "text/xml");
                    xhr.send(null);

                    scoreMkssString = xhr.responseText;

                    index1 = scoreMkssString.indexOf("<runtimeInfo");
                    index2 = scoreMkssString.indexOf("</runtimeInfo>");
                    runtimeInfoString = scoreMkssString.substr(index1, index2 - index1);

                    return runtimeInfoString;
                }

                // Returns null if the optionsTypeString element does not exist in the runtimeInfoString.
                // Otherwise returns the element as a string, without its closing tag.
                function getPerformanceOptionsString(runtimeInfoString, optionsTypeString)
                {
                    var index, optsString = null;
                    index = runtimeInfoString.indexOf("<" + optionsTypeString);
                    if(index !== -1)
                    {
                        optsString = runtimeInfoString.substr(index);
                        index = optsString.indexOf("/>");
                        if(index === -1)
                        {
                            index = optsString.indexOf("</" + optionsTypeString + ">");
                        }
                        optsString = optsString.substr(0, index);
                    }
                    return optsString;
                }

                // Returns the attribute value string corresponding to the attrName.
                // or null if attrName does not exist in allOpts.
                // The attrName argument must end with a '=' character.
                function attributeValueString(optsString, attrName)
                {
                    var index,
                        valStr,
                        rval = null;

                    if(attrName[attrName.length - 1] !== '=')
                    {
                        throw "The attrName argument must end with a '=' character.";
                    }

                    index = optsString.search(attrName);
                    if(index !== -1)
                    {
                        valStr = optsString.substr(index + attrName.length + 1);
                        index = valStr.search("\"");
                        rval = valStr.substr(0, index);
                    }
                    return rval;
                }

                function getTrackInitOptions(trackOpts)
                {
                    var tio = {},
                        str;

                    function stringToTrackIntArray(str)
                    {
                        var strArray = str.split(','),
                            intArray = [],
                            i;

                        for(i = 0; i < strArray.length; ++i)
                        {
                            intArray.push(parseInt(strArray[i], 10));
                        }
                        return intArray;
                    }

                    str = attributeValueString(trackOpts, "maxVolume=");
                    if(str !== null)
                    {
                        tio.maxVolumes = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "volume=");
                    if(str !== null)
                    {
                        tio.volumes = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "pwDeviation=");
                    if(str !== null)
                    {
                        tio.pwDeviations = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "pitchWheel=");
                    if(str !== null)
                    {
                        tio.pitchWheels = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "expression=");
                    if(str !== null)
                    {
                        tio.expressions = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "pan=");
                    if(str !== null)
                    {
                        tio.pans = stringToTrackIntArray(str);
                    }

                    str = attributeValueString(trackOpts, "modulation=");
                    if(str !== null)
                    {
                        tio.modulations = stringToTrackIntArray(str);
                    }

                    return tio;
                }
                function getMonoPerformerOptions(mPerfOpts)
                {
                    var mpo = {},
                        str;

                    // str is a string containing nTracks characters that are '0's and '1's.
                    function stringToTrackBoolArray(str)
                    {
                        var boolArray = [],
                            i;

                        for(i = 0; i < str.length; ++i)
                        {
                            if(str[i] === '0')
                            {
                                boolArray.push(true);
                            }
                            else
                            {
                                boolArray.push(false);
                            }    
                        }
                        return boolArray;
                    }

                    str = attributeValueString(mPerfOpts, "noteOnPitchTracks=");
                    if(str !== null)
                    {
                        mpo.noteOnPitchTracks = stringToTrackBoolArray(str);
                    }

                    str = attributeValueString(mPerfOpts, "noteOnVelocityTracks=");
                    if(str !== null)
                    {
                        mpo.noteOnVelocityTracks = stringToTrackBoolArray(str);
                    }

                    if(mPerfOpts.search("pressureController=") !== -1)
                    {
                        mpo.pressureController = attributeValueString(mPerfOpts, "pressureController=");
                    }

                    str = attributeValueString(mPerfOpts, "pressureTracks=");
                    if(str !== null)
                    {
                        mpo.pressureTracks = stringToTrackBoolArray(str);
                    }

                    if(mPerfOpts.search("pitchWheelController=") !== -1)
                    {
                        mpo.pitchWheelController = attributeValueString(mPerfOpts, "pitchWheelController=");
                    }

                    str = attributeValueString(mPerfOpts, "pitchWheelTracks=");
                    if(str !== null)
                    {
                        mpo.pitchWheelTracks = stringToTrackBoolArray(str);
                    }

                    if(mPerfOpts.search("modWheelController=") !== -1)
                    {
                        mpo.modWheelController = attributeValueString(mPerfOpts, "modWheelController=");
                    }

                    str = attributeValueString(mPerfOpts, "modWheelTracks=");
                    if(str !== null)
                    {
                        mpo.modWheelTracks = stringToTrackBoolArray(str);
                    }

                    if(mPerfOpts.search("speedController=") !== -1)
                    {
                        mpo.speedController = attributeValueString(mPerfOpts, "speedController=");
                    }

                    str = attributeValueString(mPerfOpts, "speedMaxPercent=");
                    if(str !== null)
                    {
                        mpo.speedMaxPercent = parseFloat(attributeValueString(mPerfOpts, "speedMaxPercent="));
                    }

                    str = attributeValueString(mPerfOpts, "minVolume=");
                    if(str !== null)
                    {
                        mpo.minVolume = parseInt(attributeValueString(mPerfOpts, "minVolume="), 10);
                    }

                    str = attributeValueString(mPerfOpts, "trackIndex=");
                    if(str !== null)
                    {
                        mpo.trackIndex = parseInt(attributeValueString(mPerfOpts, "trackIndex="), 10);
                    }
                                    
                    return mpo;
                }
                function getPolyPerformerOptions(pPerfOpts)
                {
                    var ppo = {},
                        str;
                    return ppo;
                }
                
                scoreInfo.name = scoreSelectorElem.value;
                runtimeInfoString = getRuntimeInfoString(scoreInfo.name);

                scoreInfo.nPages = parseInt(attributeValueString(runtimeInfoString, "nPages="), 10);
                scoreInfo.nTracks = parseInt(attributeValueString(runtimeInfoString, "nTracks="), 10);

                trackInitString = getPerformanceOptionsString(runtimeInfoString, "trackInit");
                if(trackInitString !== null)
                {
                    scoreInfo.trackInitialisationValues = getTrackInitOptions(trackInitString);
                }

                mPerformerOptionsString = getPerformanceOptionsString(runtimeInfoString, "monoPerformerOptions");
                if(mPerformerOptionsString !== null)
                {
                    scoreInfo.monoPerformerOptions = getMonoPerformerOptions(mPerformerOptionsString);
                }
                else
                {
                    pPerformerOptionsString = getPerformanceOptionsString(runtimeInfoString, "polyPerformerOptions");
                    if(pPerformerOptionsString !== null)
                    {
                        scoreInfo.polyPerformerOptions = getMonoPerformerOptions(pPerformerOptionsString);
                    }
                }

                return scoreInfo;
            }

            // removes existing mo.trackSelector.ChildNodes
            // adds nTracks new child nodes
            // enables mo.trackSelector
            // Selects assistantsTrackIndex if it is defined.
            function setPerformersTrackSelector(nTracks, assistantsTrackIndex)
            {
                var i, optionElem, textElem, sibling,
                firstChildNode;

                if(mo.trackSelector.childNodes.length > 0)
                {
                    firstChildNode = mo.trackSelector.childNodes[0];
                    sibling = firstChildNode.nextSibling;
                    while(sibling !== null)
                    {
                        mo.trackSelector.removeChild(sibling);
                        sibling = firstChildNode.nextSibling;
                    }
                    mo.trackSelector.removeChild(firstChildNode);
                }
                for(i = 0; i < nTracks; ++i)
                {
                    optionElem = document.createElement("option");
                    textElem = document.createTextNode((i + 1).toString());
                    optionElem.appendChild(textElem);
                    mo.trackSelector.appendChild(optionElem);
                }
                if(assistantsTrackIndex !== undefined)
                {
                    mo.trackSelector.selectedIndex = assistantsTrackIndex;
                }
            }

            function setPages(scoreName, nPages)
            {
                var rootURL,
                    svgPagesFrame,
                    embedCode = "",
                    pageURL,
                    i;

                // Returns the URL of the scores directory. This can either be in the local server:
                // e.g. "file:///C:/xampp/htdocs/localAssistantPerformer/scores/"
                // or on the web:
                // e.g. "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/"
                function scoresURL(documentURL)
                {
                    var
                    apIndex = documentURL.search("assistantPerformer.html"),
                    url = documentURL.slice(0, apIndex) + "scores/";

                    return url;
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

                rootURL = scoresURL(document.URL);

                for(i = 0; i < nPages; ++i)
                {
                    pageURL = rootURL + scoreName;
                    pageURL = pageURL + "/";
                    pageURL = pageURL + scoreName;
                    pageURL = pageURL + " page ";
                    pageURL = pageURL + (i + 1).toString();
                    pageURL = pageURL + ".svg";
                    // e.g. "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Song Six/Song Six page 1.svg"
                    // or   "file:///C:/xampp/htdocs/localAssistantPerformer/scores/Song Six/Song Six page 1.svg"
                    embedCode += embedPageCode(pageURL);
                }
                svgPagesFrame = document.getElementById('svgPages');
                // should call svgPagesFrame.svgLoaded, and set svgPagesFrame.svgScript 
                svgPagesFrame.innerHTML = embedCode;
            }

            function setDefaultRuntimeOptions(scoreInfo)
            {
                var
                tid = scoreInfo.trackInitialisationValues,
                dpo = scoreInfo.defaultPerformanceOptions;

                setMainOptionsDefaultStates(); // also called by init() above

                if(tid !== undefined)
                {
                    if(tid.maxVolumes !== undefined)
                    {
                        mo.trackMaxVolumes = tid.maxVolumes; // default is empty array
                    }
                    if(tid.pitchWheelDeviations !== undefined)
                    {
                        mo.trackPitchWheelDeviations = tid.pitchWheelDeviations; // default is empty array
                    }
                }

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
                    if(dpo.pressure !== undefined)
                    {
                        if(dpo.pressure.soloTrack !== undefined)
                        {
                            mo.usesPressureSoloCheckbox.checked = true;
                        }
                        if(dpo.pressure.otherTracks !== undefined)
                        {
                            mo.usesPressureOtherTracksCheckbox.checked = true;
                        }
                        if(dpo.pressure.selectedIndex !== undefined)
                        {
                            mo.pressureSubstituteControlDataSelector.selectedIndex = dpo.pressure.selectedIndex;
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
                    if(dpo.speedControl !== undefined)
                    {
                        if(dpo.speedControl.selectedIndex !== undefined)
                        {
                            mo.speedControllerSelector.selectedIndex = dpo.speedControl.selectedIndex;
                        }
                        if(dpo.speedControl.maximumFactor !== undefined)
                        {
                            mo.speedControllerMaxSpeedInputText.value = dpo.speedControl.maximumFactor;
                        }
                    }
                    if(dpo.minimumVolume !== undefined)
                    {
                        mo.minimumPressureInputText.value = dpo.minimumVolume;
                    }
                }

                setControlVisibilityStates();
            }

            scoreInfo = getScoreRuntimeInfo();

            setDefaultRuntimeOptions(scoreInfo);

            setPages(scoreInfo.name, scoreInfo.nPages);

            if(scoreInfo.defaultPerformanceOptions !== undefined)
            {
                setPerformersTrackSelector(scoreInfo.nTracks, scoreInfo.defaultPerformanceOptions.assistantsTrackIndex);
            }
            else
            {
                setPerformersTrackSelector(scoreInfo.nTracks, 0);
            }

            tracksControl.setNumberOfTracks(scoreInfo.nTracks);

            svgPagesDiv.scrollTop = 0;
            scoreHasJustBeenSelected = true;
        }

        function goControlClicked()
        {
            if(svgControlsState === 'stopped' || svgControlsState === 'paused')
            {
                setSvgControlsState('playing');
            }
            else if(svgControlsState === 'playing')
            {
                setSvgControlsState('paused');
            }
        }

        // used when the control automatically toggles back
        // toggleBack('setStartControlSelected')
        function toggleBack(selected)
        {
            selected.setAttribute("opacity", "1");
            window.setTimeout(function()
            {
                selected.setAttribute("opacity", "0");
            }, 200);
        }

        function stopControlClicked()
        {
            if(svgControlsState === 'paused')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }

            if(svgControlsState === 'playing')
            {
                toggleBack(cl.stopControlSelected);
                setSvgControlsState('stopped');
            }
        }

        function setStartControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('settingStart');
            }
            else if(svgControlsState === 'settingStart')
            {
                setSvgControlsState('stopped');
                score.moveRunningMarkerToStartMarker();
            }
        }

        function setEndControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('settingEnd');
            }
            else if(svgControlsState === 'settingEnd')
            {
                setSvgControlsState('stopped');
            }
        }

        function sendStartToBeginningControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStartToBeginningControlSelected);
                score.sendStartMarkerToStart();
                score.moveRunningMarkerToStartMarker();
            }
        }

        function sendStopToEndControlClicked()
        {
            if(svgControlsState === 'stopped')
            {
                toggleBack(cl.sendStopToEndControlSelected);
                score.sendEndMarkerToEnd();
            }
        }

        /**** controls in options panel ***/
        if(controlID === "midiInputDeviceSelector"
        || controlID === "scoreSelector"
        || controlID === "midiOutputDeviceSelector"
        || controlID === "usesPressureSoloCheckbox"
        || controlID === "usesPressureOtherTracksCheckbox"
        || controlID === "usesModSoloCheckbox"
        || controlID === "usesModOtherTracksCheckbox"
        || controlID === "usesPitchBendSoloCheckbox"
        || controlID === "usesPitchBendOtherTracksCheckbox"
        || controlID === "speedControllerSelector")
        {
            setMainOptionsState("enable"); // enables only the appropriate controls
        }

        if(controlID === "midiInputDeviceSelector")
        {
            setMIDIDevices();
            tracksControl.setInitialTracksControlState(mo.midiInputDeviceSelector.selectedIndex > 0, mo.trackSelector.selectedIndex);
        }

        if(controlID === "scoreSelector")
        {
            setScore();
            tracksControl.setInitialTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
        }

        if(controlID === "midiOutputDeviceSelector")
        {
            setMIDIDevices();
        }

        if(controlID === "trackSelector")
        {
            tracksControl.setInitialTracksControlState(mo.trackSelector.selectedIndex >= 0, mo.trackSelector.selectedIndex);
        }

        if (controlID === "pressureSubstituteControlDataSelector"
            || controlID === "pitchBendSubstituteControlDataSelector"
            || controlID === "modSustituteControlSelector")
        {
            setControlVisibilityStates(); // here just sets the visibility of the minimum volume div.
        }

        /*** SVG controls ***/
        if(cl.performanceButtonsDisabled.getAttribute("opacity") !== SMOKE)
        {
            switch(controlID)
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

        if(controlID === "livePerformerOnOff")
        {
            if(cl.livePerformerOnOffDisabled.getAttribute("opacity") !== SMOKE)
            {
                options.livePerformance = !(options.livePerformance);

                if(options.livePerformance)
                {
                    tracksControl.setInitialTracksControlState(true, options.performersTrackSelectorIndex);
                    tracksControl.refreshDisplay();
                }
                else
                {
                    tracksControl.setInitialTracksControlState(false, options.performersTrackSelectorIndex);
                    tracksControl.refreshDisplay();
                }

                initTracksPlayerAndPerformer(score, options);
            }
        }

        if(controlID === "gotoOptions")
        {
            deleteSaveMIDIFileButton();

            if(cl.gotoOptionsDisabled.getAttribute("opacity") !== SMOKE)
            {
                setSvgControlsState('disabled');
                score.moveStartMarkerToTop(svgPagesDiv);
                scoreHasJustBeenSelected = false;
            }
        }
    },

    // functions for adjusting the appearance of the score options
    showOverRect = function(overRectID, disabledID)
    {
        var overRectElem = document.getElementById(overRectID),
            disabledElem = document.getElementById(disabledID),
            disabledOpacity = disabledElem.getAttribute("opacity"),
            livePerformerOffLayer;

        if(disabledOpacity !== SMOKE)
        {
            overRectElem.setAttribute("opacity", METAL);
            if(overRectID === 'overLivePerformerOnOffFrame')
            {
                livePerformerOffLayer = document.getElementById('livePerformerOff');
                if(options.livePerformance === true)
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
    hideOverRect = function(overRectID)
    {
        var overRect = document.getElementById(overRectID),
            livePerformerOffLayer;

        overRect.setAttribute("opacity", GLASS);
        if(overRectID === 'overLivePerformerOnOffFrame')
        {
            livePerformerOffLayer = document.getElementById('livePerformerOff');
            if(options.livePerformance === true)
            {
                livePerformerOffLayer.setAttribute("opacity", GLASS);
            }
            else
            {
                livePerformerOffLayer.setAttribute("opacity", METAL);
            }
        }
    },

    trackToggled = function(soloistIsSilent)
    {
        score.refreshDisplay(sequence, options.livePerformance, options.performersTrackSelectorIndex, soloistIsSilent);
        // score.refreshDisplay() sets sequence.tracks[performersTrackSelectorIndex] to a silent track, if necessary.
        if(options.livePerformance === true)
        {
            options.performersTrackIndex = options.performersTrackSelectorIndex;
            if(livePerformerIsSilent !== soloistIsSilent)
            {
                livePerformerIsSilent = soloistIsSilent;
            }
        }
        else
        {
            options.performersTrackIndex = null;
        }

    },

    // Called when the Start button is clicked in the top options dialog.
    // The score selector sets the array of svgScorePage urls.
    // The Start button is enabled when a score and MIDI output have been selected.
    // It does not require a MIDI input.
    beginRuntime = function()
    {
        function getOptions()
        {
            var success, speedRoots;

            function checkMinVolumeInput()
            {
                var volume = parseInt(mo.minimumPressureInputText.value, 10), success;

                if(isNaN(volume) || Math.floor(volume) !== volume || volume < 0 || volume > 127)
                {
                    alert("Illegal minimum volume.\n\nThe value must be an integer in the range 0..127.");
                    success = false;
                }
                else
                {
                    success = true;
                }

                return success;
            }

            function checkSpeedInput()
            {
                var inputText = mo.speedPercentInputText,
                speed = parseFloat(inputText.value), success;

                if(isNaN(speed) || speed <= 0)
                {
                    alert("Illegal standard speed percentage.\n\n" +
                          "The value must be an integer or\n" +
                          "floating point number greater than 0.");
                    success = false;
                }
                else
                {
                    success = true;
                }

                return success;
            }

            // minVolumes are integers in range 0..127
            function getMinVolumes(maxVolumes, restPressure)
            {
                var minVolumes = [],
                    i;

                for(i = 0; i < maxVolumes.length; ++i)
                {
                    minVolumes.push(Math.floor(maxVolumes[i] * restPressure / 127));
                }

                return minVolumes;
            }

            // scales are floating point values in range 0.0..1.0
            function getScales(maxVolumes, minVolumes)
            {
                var scales = [], i;

                for(i = 0; i < maxVolumes.length; ++i)
                {
                    scales.push((maxVolumes[i] - minVolumes[i]) / 127);
                }

                return scales;
            }

            function getSpeedRoots(speedControllerMaxSpeedInputText)
            {
                var speedRoots = {},
                    maxSpeedFactor = parseFloat(speedControllerMaxSpeedInputText.value) / 100,
                    minSpeedFactor = 1 / maxSpeedFactor;

                speedRoots.faster = 1 / Math.pow(maxSpeedFactor, (1 / 63));
                speedRoots.slower = 1 / Math.pow(minSpeedFactor, (1 / 64));

                return speedRoots;
            }

            if(checkMinVolumeInput() && checkSpeedInput())
            {
                // options.livePerformance is kept up to date by the livePerformerOnOffButton.
                options.livePerformance = (cl.livePerformerOff.getAttribute("opacity") === "0");

                options.trackMaxVolumes = mo.trackMaxVolumes;
                if(options.livePerformance)
                {
                    options.runtimeOptions = {};
                    options.runtimeOptions.track = {};
                    options.runtimeOptions.track.minVolumes = getMinVolumes(options.trackMaxVolumes, parseInt(mo.minimumPressureInputText.value, 10));
                    options.runtimeOptions.track.scales = getScales(options.trackMaxVolumes, options.runtimeOptions.track.minVolumes);

                    options.runtimeOptions.speed = {};
                    options.runtimeOptions.speed.controllerIndex = mo.speedControllerSelector.selectedIndex;
                    speedRoots = getSpeedRoots(mo.speedControllerMaxSpeedInputText);
                    options.runtimeOptions.speed.fasterRoot = speedRoots.faster;
                    options.runtimeOptions.speed.slowerRoot = speedRoots.slower;
                    // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
                    //     factor = fasterRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumFactor
                    // If the controller's value is < 64, the factor which is passed to tick() will be
                    //     factor = slowerRoot ^ (64 - cv) -- if cv = 0, factor will is 1/maximumFactor
                }

                options.trackPitchWheelDeviations = mo.trackPitchWheelDeviations;

                options.performersTrackSelectorIndex = mo.trackSelector.selectedIndex;

                options.overrideSoloVelocity = mo.soloVelocityOptionCheckbox.checked;
                options.overrideOtherTracksVelocity = mo.otherTracksVelocityOptionCheckbox.checked;
                options.overrideSoloPitch = mo.soloPitchOptionCheckbox.checked;
                options.overrideOtherTracksPitch = mo.otherTracksPitchOptionCheckbox.checked;

                // EWI: breath control (=aftertouch)
                // E-MU keyboard: key pressure (=channel pressure)
                options.usesPressureSolo = mo.usesPressureSoloCheckbox.checked;
                options.usesPressureOtherTracks = mo.usesPressureOtherTracksCheckbox.checked;
                options.pressureSubstituteControlData = null;
                if(options.usesPressureSolo || options.usesPressureOtherTracks)
                {
                    options.pressureSubstituteControlData = controlOptions[mo.pressureSubstituteControlDataSelector.selectedIndex];
                }

                // EWI: pitch-bend controls (=pitch-bend)
                // E-MU keyboard: pitch wheel (=pitch-bend)
                options.usesPitchBendSolo = mo.usesPitchBendSoloCheckbox.checked;
                options.usesPitchBendOtherTracks = mo.usesPitchBendOtherTracksCheckbox.checked;
                options.pitchBendSubstituteControlData = null;
                if(options.usesPitchBendSolo || options.usesPitchBendOtherTracks)
                {
                    options.pitchBendSubstituteControlData = controlOptions[mo.pitchBendSubstituteControlDataSelector.selectedIndex];
                }

                // EWI: bite control (=modulation)
                // E-MU keyboard: modulation wheel (=modulation)
                options.usesModSolo = mo.usesModSoloCheckbox.checked;
                options.usesModOtherTracks = mo.usesModOtherTracksCheckbox.checked;
                options.modSubstituteControlData = null;
                if(options.usesModSolo || options.usesModOtherTracks)
                {
                    options.modSubstituteControlData = controlOptions[mo.modSustituteControlSelector.selectedIndex];
                }

                options.globalSpeed = parseFloat(mo.speedPercentInputText.value) / 100.0;

                options.minimumInputPressure = parseInt(mo.minimumPressureInputText.value, 10);

                success = true;
            }
            else
            {
                success = false;
            }

            return success;
        }

        if(document.getElementById("midiInputDeviceSelector").selectedIndex === 0)
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

        if(getOptions())
        {
            initTracksPlayerAndPerformer(score, options);

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // TracksControl.refreshDisplay() calls
            //     score.refreshDisplay(isAssistedPerformance, performersTrackSelectorIndex, livePerformerisSilent)
            // to tell the score to repaint itself. The score may also update the position of the start marker (which
            // always starts on a chord) if a track becomes disabled.
            tracksControl.getTrackToggledCallback(trackToggled);

            // tracksControl.trackIsOn(trackIndex) returns a boolean which is the on/off status of its trackIndex argument
            score.getTrackIsOnCallback(tracksControl.trackIsOn);

            tracksControl.setInitialTracksControlState(options.livePerformance, options.performersTrackSelectorIndex);

            score.refreshDisplay(sequence, options.livePerformance, options.performersTrackSelectorIndex, false);

            if(options.livePerformance === true)
            {
                options.performersTrackIndex = options.performersTrackSelectorIndex;
            }
            else
            {
                options.performersTrackIndex = null;
            }

            score.moveStartMarkerToTop(svgPagesDiv);

            setSvgControlsState('stopped');

            if(options.livePerformance === true)
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

}(document, window));
