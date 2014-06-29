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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.controls');

_AP.controls = (function(document, window)
{
    "use strict";

    var
    U = _AP.utilities,
    tracksControl = _AP.tracksControl,
    Score = _AP.score.Score,
    sequence, // set by reading the score
    player, // player can be set to sequence, or to MIDI input event handlers such as _AP.mono1 or _AP.keyboard1.
    performersOptionsDialog = _AP.performersOptionsDialog,
    SequenceRecording = _AP.sequenceRecording.SequenceRecording,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,
    sequenceToSMF = _AP.standardMIDIFile.sequenceToSMF,

    midiAccess,
    scoreInfo, // set when a score is loaded
    score,
    svg = {}, // an object containing pointers to functions defined in SVG files
    livePerformerIsSilent = false,
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    svgPagesDiv,
    globalElements = {}, // assistantPerformer.html elements (but not performerOptions) 
    cl = {}, // control layers

    // constants for control layer opacity values
    METAL = "1", // control layer is completely opaque
    SMOKE = "0.7", // control layer is smoky (semi-transparent)
    GLASS = "0", // control layer is completely transparent

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
            window.setTimeout(function()
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

                    a.onmouseover = function(e)
                    {
                        var img = document.getElementById("saveImg");
                        img.src = "images/saveMouseOver.png";
                        a.style.cursor = 'default';
                    };

                    a.onmouseout = function(e)
                    {
                        var img = document.getElementById("saveImg");
                        img.src = "images/saveMouseOut.png";
                    };

                    a.onclick = function(e)
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
        inSelector = document.getElementById("inputDeviceSelect"),
        outSelector = document.getElementById("outputDeviceSelect");

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

    setMainOptionsState = function(mainOptionsState)
    {
        var
        inputDeviceIndex = globalElements.inputDeviceSelect.selectedIndex,
        scoreIndex = globalElements.scoreSelect.selectedIndex,
        outputDeviceIndex = globalElements.outputDeviceSelect.selectedIndex;

        switch(mainOptionsState)
        {
            case "toFront": // set main options visible with the appropriate controls enabled/disabled
                globalElements.titleOptionsDiv.style.visibility = "visible";
                globalElements.globalSpeedDiv.style.display = "none";
                globalElements.startRuntimeButton.style.display = "none";
                globalElements.svgRuntimeControls.style.visibility = "hidden";
                globalElements.svgPages.style.visibility = "hidden";

                if(outputDeviceIndex === 0)
                {
                    performersOptionsDialog.hidden(true);
                }
                else if(scoreIndex > 0)
                {
                    globalElements.globalSpeedDiv.style.display = "block";
                    // Note that the midi input device does not have to be set in order to enable the start button.
                    globalElements.startRuntimeButton.style.display = "initial";

                    if(inputDeviceIndex > 0)
                    {
                        performersOptionsDialog.hidden(false);
                    }
                    else if(performersOptionsDialog !== undefined)
                    {
                        performersOptionsDialog.hidden(true);
                    }
                }
                break;
            case "toBack": // set svg controls and score visible
                globalElements.titleOptionsDiv.style.visibility = "hidden";
                globalElements.svgRuntimeControls.style.visibility = "visible";
                globalElements.svgPages.style.visibility = "visible";
                break;
            default:
                throw "Unknown program state.";
        }
    },

    addInputEventListener = function(options)
    {
        options.inputDevice.addEventListener("midimessage", options.performersOptions.midiEventHandler.handleMIDIInputEvent);
    },

    removeInputEventListener = function(options)
    {
        options.inputDevice.removeEventListener("midimessage", options.performersOptions.midiEventHandler.handleMIDIInputEvent);
    },

    setStopped = function()
    {
        player.stop();

        score.moveRunningMarkerToStartMarker();

        score.allNotesOff(options.outputDevice);

        setMainOptionsState("toBack");

        cl.gotoOptionsDisabled.setAttribute("opacity", GLASS);

        if(document.getElementById("inputDeviceSelect").selectedIndex === 0)
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
        scoreName = globalElements.scoreSelect.value;
        

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
                i, nTrks, trackRec,
                timestamp,
                rOffset = Number.MAX_VALUE;

                if(sequenceRecording !== undefined && sequenceRecording !== null)
                {
                    nTrks = sequenceRecording.trackRecordings.length;
                    for(i = 0; i < nTrks; ++i)
                    {
                        trackRec = sequenceRecording.trackRecordings[i];
                        if(trackRec.moments.length > 0)
                        {
                            timestamp = trackRec.moments[0].timestamp;
                            rOffset = (rOffset < timestamp) ? rOffset : timestamp;
                        }
                    }
                }

                return rOffset;
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
            setMainOptionsState("toFront");

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

            function sendTrackInitializationMessages(options, trackInitialisationValues)
            {
                var rNTracks = trackIsOnArray.length,
                    trackIndex, value,
                    tiv = trackInitialisationValues;

                function sendCommandMessageNow(outputDevice, trackIndex, command, midiValue)
                {
                    var
                    msg;

                    msg = new _AP.message.Message(command + trackIndex, 0, midiValue); // controller 7 is volume control
                    outputDevice.send(msg.data, 0);
                }

                function sendControlMessageNow(outputDevice, trackIndex, controller, midiValue)
                {
                    var
                    msg,
                    CMD = _AP.constants.COMMAND;

                    msg = new _AP.message.Message(CMD.CONTROL_CHANGE + trackIndex, controller, midiValue); // controller 7 is volume control
                    outputDevice.send(msg.data, 0);
                }

                // Sets the track's pitchWheel deviation to value, and the pitchWheel to 64 (=centre position).
                // Sets both RegisteredParameter controls to 0 (zero). This is standard MIDI for selecting the
                // pitch wheel so that it can be set by the subsequent DataEntry messages.
                // A DataEntryFine message is not set, because it is not needed and has no effect anyway.
                // However, RegisteredParameterFine MUST be set, otherwise the messages as a whole have no effect!
                function sendSetPitchWheelDeviationMessageNow(outputDevice, track, value)
                {
                    var
                    msg,
                    Message = _AP.message.Message,
                    CMD = _AP.constants.COMMAND,
                    CTL = _AP.constants.CONTROL;

                    msg = new Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_COARSE, 0);
                    outputDevice.send(msg.data, 0);
                    msg = new Message(CMD.CONTROL_CHANGE + track, CTL.REGISTERED_PARAMETER_FINE, 0);
                    outputDevice.send(msg.data, 0);
                    msg = new Message(CMD.CONTROL_CHANGE + track, CTL.DATA_ENTRY_COARSE, value);
                    outputDevice.send(msg.data, 0);

                    msg = new Message(CMD.PITCH_WHEEL + track, 0, 64); // centre the pitch wheel
                    outputDevice.send(msg.data, 0);
                }

                for(trackIndex = 0; trackIndex < rNTracks; ++trackIndex)
                {
                    if(options.performersOptions === undefined)
                    {
                        value = (tiv.volumes.length > 0) ? tiv.volumes[trackIndex] : 100; // default 100
                    }
                    else
                    {
                        value = options.performersOptions.masterVolumes[trackIndex];
                    }
                    sendControlMessageNow(options.outputDevice, trackIndex, CONTROL.VOLUME, value);

                    value = (tiv.pwDeviations.length > 0) ? tiv.pwDeviations[trackIndex] : 2; // default 2
                    sendSetPitchWheelDeviationMessageNow(options.outputDevice, trackIndex, value);
                 
                    value = (tiv.pitchWheels.length > 0) ? tiv.pitchWheels[trackIndex] : 64; // default 64
                    sendCommandMessageNow(options.outputDevice, trackIndex, COMMAND.PITCH_WHEEL, value);

                    value = (tiv.expressions.length > 0) ? tiv.expressions[trackIndex] : 127; // default 127
                    sendControlMessageNow(options.outputDevice, trackIndex, CONTROL.EXPRESSION, value);
                    
                    value = (tiv.pans.length > 0) ? tiv.pans[trackIndex] : 64; // default 64
                    sendControlMessageNow(options.outputDevice, trackIndex, CONTROL.PAN, value);
                                        
                    value = (tiv.modulations.length > 0) ? tiv.modulations[trackIndex] : 0; // default 0
                    sendControlMessageNow(options.outputDevice, trackIndex, CONTROL.MODWHEEL, value);
                }
            }

            deleteSaveMIDIFileButton();

            if(sequence.tracks.length > 0)
            {
                if(options.livePerformance === false && player.isPaused())
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

                    sendTrackInitializationMessages(options, scoreInfo.trackInitialisationValues);

                    player.play(trackIsOnArray, score.startMarkerMsPosition(), score.endMarkerMsPosition(), sequenceRecording, true, options.livePerformance);
                }

                if(options.livePerformance === true)
                {
                    addInputEventListener(options);
                    cl.goDisabled.setAttribute("opacity", SMOKE);
                }
                else
                {
                    cl.goDisabled.setAttribute("opacity", GLASS);
                }
                cl.pauseUnselected.setAttribute("opacity", METAL);
                cl.pauseSelected.setAttribute("opacity", GLASS);
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
                if(options.livePerformance === false) // live performances cannot be paused
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

    // Defines the window.svgLoaded(...) function.
    // Sets up the pop-up menues for scores and MIDI input and output devices.
    init = function(mAccess)
    {
        function getGlobalElements()
        {
            globalElements.inputDeviceSelect = document.getElementById("inputDeviceSelect");
            globalElements.scoreSelect = document.getElementById("scoreSelect");
            globalElements.outputDeviceSelect = document.getElementById("outputDeviceSelect");
            globalElements.globalSpeedDiv = document.getElementById("globalSpeedDiv");
            globalElements.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            globalElements.startRuntimeButton = document.getElementById("startRuntimeButton");
            globalElements.svgRuntimeControls = document.getElementById("svgRuntimeControls");
            globalElements.svgPages = document.getElementById("svgPages");
        }

        // sets the options in the device selectors' menus
        function setMIDIDeviceSelectors(midiAccess)
        {
            var
            i, nItems, option,
            is = globalElements.inputDeviceSelect,
            os = globalElements.outputDeviceSelect, // document.getElementById("outputDeviceSelect")
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
            globalElements.scoreSelect.selectedIndex = 0;
            score = new Score(runningMarkerHeightChanged); // an empty score, with callback function
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
            svg.getSVGDocument = function(embedded_element)
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
            window._JI_SVGLoaded = function(getSVGDocument)
            {
                svg.getSVGDocument = getSVGDocument;
            };
        }

        midiAccess = mAccess;

        getGlobalElements();

        setMIDIDeviceSelectors(midiAccess);

        initScoreSelector(runningMarkerHeightChanged);

        setSvgPagesDivHeight();

        getControlLayers(document);

        setSvgControlsState('disabled');
    },

    initTracksAndPlayer = function(score, options)
    {
        var trackIndex = -1;

        if(options.livePerformance)
        {
            trackIndex = options.performersOptions.trackIndex;
        }

        if(scoreHasJustBeenSelected)
        {
            score.getEmptyPagesAndSystems(svg); // everything except the timeObjects (which have to take account of speed)
        }

        // sequence is a new Sequence, whose tracks have been filled with the data from the score.
        sequence = score.getSequence(svg, options.livePerformance, trackIndex, options.globalSpeed);

        if(options.livePerformance)
        {
            player = options.performersOptions.midiEventHandler;
        }
        else
        {
            player = sequence; // the playing functions are in sequence.prototype.  
        }

        // The first argument has no effect if the sequence is playing itself.
        player.init(sequence, options, reportEndOfPerformance, reportMsPos);
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
            // If the score selector's index is 0, this function returns undefined, otherwise it returns
            // a scoreInfo object constructed from the runtimeOptions defined in the score's .mkss file
            // The scoreInfo object returned by this function has the following attributes:
            //      scoreInfo.name (e.g. "Song Six")
            //      scoreInfo.nPages (e.g. 7)
            //      scoreInfo.nTracks (e.g. 8)
            //      scoreInfo.loadPerformersOptionsDialog()
            // and optionally (if present)
            //      scoreInfo.trackInitialisationValues
            function getScoreRuntimeInfo()
            {
                var rScoreInfo,
                    runtimeInfoString, trackInitString, performersOptionsString;

                function getRuntimeInfoString(scoreName)
                {
                    var
                    scorePath = "scores/" + scoreName + "/" + scoreName + ".mkss",
                    xhr = new XMLHttpRequest(),
                    scoreMkssString,
                    index,
                    rRuntimeInfoString;

                    xhr.open('GET', scorePath, false); // asynch used to be true
                    xhr.setRequestHeader("Content-Type", "text/xml");
                    xhr.send(null);

                    scoreMkssString = xhr.responseText;

                    index = scoreMkssString.search("<runtimeInfo");
                    rRuntimeInfoString = scoreMkssString.substr(index);
                    index = rRuntimeInfoString.search("</runtimeInfo>");
                    if(index < 0)
                    {
                        index = rRuntimeInfoString.search("/>");
                    }
                    rRuntimeInfoString = rRuntimeInfoString.substr(0, index);

                    return rRuntimeInfoString;
                }

                // Returns the single int attribute value corresponding to the attrName
                // The attrName argument must end with a '=' character.
                function intAttribute(optsString, attrName)
                {
                    var index,
                        valStr,
                        rvalString,
                        rval = -1;

                    if(attrName[attrName.length - 1] !== '=')
                    {
                        throw "The attrName argument must end with a '=' character.";
                    }

                    index = optsString.search(attrName);
                    if(index !== -1)
                    {
                        valStr = optsString.substr(index + attrName.length + 1);
                        index = valStr.search("\"");
                        rvalString = valStr.substr(0, index);
                        rval = parseInt(rvalString, 10);
                    }
                    if(rval <= 0)
                    {
                        throw "Error getting int attribute.";
                    }
                    return rval;
                }

                // Returns null if the optionsTypeString element does not exist in the runtimeInfoString.
                // Otherwise returns the element as a string, without its closing tag.
                function getPerformersOptionsString(runtimeInfoString, optionsTypeString)
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

                // If the score is being performed live, masterVolume values override these volume settings.
                function getTrackInitValues(nTracks, trackOpts)
                {
                    var tio = {};

                    tio.volumes = U.intArrayFromAttribute(nTracks, trackOpts, "volume=", 100);
                    tio.pwDeviations = U.intArrayFromAttribute(nTracks, trackOpts, "pwDeviation=", 2);
                    tio.pitchWheels = U.intArrayFromAttribute(nTracks, trackOpts, "pitchWheel=", 64);
                    tio.expressions = U.intArrayFromAttribute(nTracks, trackOpts, "expression=", 127);
                    tio.pans = U.intArrayFromAttribute(nTracks, trackOpts, "pan=", 64);
                    tio.modulations = U.intArrayFromAttribute(nTracks, trackOpts, "modulation=", 0);

                    return tio;
                }

                if(globalElements.scoreSelect.selectedIndex > 0)
                {
                    rScoreInfo = {};

                    rScoreInfo.name = globalElements.scoreSelect.value;
                    runtimeInfoString = getRuntimeInfoString(rScoreInfo.name);

                    rScoreInfo.nPages = intAttribute(runtimeInfoString, "nPages=");
                    rScoreInfo.nTracks = intAttribute(runtimeInfoString, "nTracks=");

                    trackInitString = getPerformersOptionsString(runtimeInfoString, "trackInit");
                    rScoreInfo.trackInitialisationValues = getTrackInitValues(rScoreInfo.nTracks, trackInitString);

                    // this is defined as a function to make keeping track of the
                    // performersOptionsDialog easy when selectors are being juggled at the top level.
                    rScoreInfo.loadPerformersOptionsDialog = function()
                        {
                            performersOptionsString = getPerformersOptionsString(runtimeInfoString, "performersOptions");
                            if(performersOptionsString === null)
                            {
                                performersOptionsDialog.resetControls(rScoreInfo.nTracks);
                            }
                            else
                            {
                                performersOptionsDialog.loadControlsFromString(performersOptionsString, rScoreInfo.nTracks);
                            }
                        };
                }

                return rScoreInfo;
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

            scoreInfo = getScoreRuntimeInfo(); // loads performersOptionsDialog with values defined in the score's .mkss file.

            setPages(scoreInfo.name, scoreInfo.nPages);

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

        if(controlID === "inputDeviceSelect")
        {
            setMIDIDevices();
            if(scoreInfo !== undefined)
            {
                scoreInfo.loadPerformersOptionsDialog();
                tracksControl.setInitialTracksControlState(globalElements.inputDeviceSelect.selectedIndex >= 0, performersOptionsDialog.trackIndex());
            }
        }

        if(controlID === "scoreSelect")
        {
            setScore();
            scoreInfo.loadPerformersOptionsDialog();
            tracksControl.setInitialTracksControlState(globalElements.inputDeviceSelect.selectedIndex >= 0, performersOptionsDialog.trackIndex());
        }

        if(controlID === "outputDeviceSelect")
        {
            setMIDIDevices();
        }

        if(controlID === "globalSpeedInput")
        {
            U.checkFloatRange(document.getElementById("globalSpeedInput"), 0.001, 800000);
        }

        /**** controls in options panel ***/
        if(controlID === "inputDeviceSelect"
        || controlID === "scoreSelect"
        || controlID === "outputDeviceSelect"
        || controlID === "globalSpeedInput")
        {
            setMainOptionsState("toFront"); // enables only the appropriate controls
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
                    tracksControl.setInitialTracksControlState(true, options.performersOptions.trackIndex);
                }
                else
                {
                    tracksControl.setInitialTracksControlState(false, options.performersOptions.trackIndex);
                }

                initTracksAndPlayer(score, options);
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
        var trackIndex = -1;

        if(options.livePerformance === true)
        {
            options.performersOptions = performersOptionsDialog.getPerformersOptions();
            trackIndex = options.performersOptions.trackIndex;
            if(livePerformerIsSilent !== soloistIsSilent)
            {
                livePerformerIsSilent = soloistIsSilent;
            }
        }

        score.refreshDisplay(sequence, options.livePerformance, trackIndex, soloistIsSilent);
        // score.refreshDisplay() sets sequence.tracks[performersTrackSelectorIndex] to a silent track, if necessary.
    },

    // Called when the Start button is clicked.
    // The score selector sets the array of svgScorePage urls.
    // The Start button is enabled when a score and MIDI output have been selected.
    // It does not require a MIDI input.
    beginRuntime = function()
    {
        var okayToRun = true,
            performersTrackIndex = -1; // when there is no performersOptions

        if(document.getElementById("inputDeviceSelect").selectedIndex === 0)
        {
            // alert("Warning: A MIDI input device has not been selected");
            cl.livePerformerOff.setAttribute("opacity", METAL);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);
            options.livePerformance = false;
            options.performersOptions = undefined;
        }
        else
        {
            cl.livePerformerOff.setAttribute("opacity", GLASS);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);
            options.livePerformance = true;
            options.performersOptions = performersOptionsDialog.getPerformersOptions();
            performersTrackIndex = options.performersOptions.trackIndex;
            if(options.performersOptions === undefined)
            {
                okayToRun = false;
            }
        }

        if(okayToRun)
        {
            options.globalSpeed = document.getElementById("globalSpeedInput").value / 100;

            initTracksAndPlayer(score, options);

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // TracksControl.refreshDisplay() calls
            //     score.refreshDisplay(isAssistedPerformance, performersTrackSelectorIndex, livePerformerisSilent)
            // to tell the score to repaint itself. The score may also update the position of the start marker (which
            // always starts on a chord) if a track becomes disabled.
            tracksControl.getTrackToggledCallback(trackToggled);

            // tracksControl.trackIsOn(trackIndex) returns a boolean which is the on/off status of its trackIndex argument
            score.getTrackIsOnCallback(tracksControl.trackIsOn);

            tracksControl.setInitialTracksControlState(options.livePerformance, performersTrackIndex);

            score.refreshDisplay(sequence, options.livePerformance, performersTrackIndex, false);

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
