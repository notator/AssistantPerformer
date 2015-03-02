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
    sequence = _AP.sequence,
    player, // player can be set to sequence, or to MIDI input event handlers such as _AP.mono1 or _AP.keyboard1.
    SequenceRecording = _AP.sequenceRecording.SequenceRecording,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,
    sequenceToSMF = _AP.standardMidiFile.sequenceToSMF,

    midiAccess,
    score,
    svg = {}, // an object containing pointers to functions defined in SVG files
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd'.
    svgPagesDiv,
    globalElements = {}, // assistantPerformer.html elements 
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
    hasData = function(nOutputVoices, trackRecordings)
    {
        var i, has = false;
        for(i = 0; i < nOutputVoices; ++i)
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
        standardMidiFile,
        downloadName,
        downloadLinkDiv, downloadLinkFound = false, i, a,
        nOutputVoices = sequenceRecording.trackRecordings.length;

        if(hasData(nOutputVoices, sequenceRecording.trackRecordings))
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

                    standardMidiFile = sequenceToSMF(sequenceRecording, sequenceMsDuration);

                    a = document.createElement('a');
                    a.id = "downloadLink";
                    a.download = downloadName;
                    a.href = window.URL.createObjectURL(standardMidiFile); // window.URL is set in Main.js
                    a.innerHTML = '<img id="saveImg" border="0" src="images/saveMouseOut.png" alt="saveMouseOutImage" width="56" height="31">';

                    a.onmouseover = function() // there is an event argument, but it is ignored
                    {
                        var img = document.getElementById("saveImg");
                        img.src = "images/saveMouseOver.png";
                        a.style.cursor = 'default';
                    };

                    a.onmouseout = function() // there is an event argument, but it is ignored
                    {
                        var img = document.getElementById("saveImg");
                        img.src = "images/saveMouseOut.png";
                    };

                    a.onclick = function() // there is an event argument, but it is ignored
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

                if(scoreIndex > 0 && outputDeviceIndex > 0)
                {
                    globalElements.globalSpeedDiv.style.display = "block";
                    // Note that the midi input device does not have to be set in order to enable the start button.
                    globalElements.startRuntimeButton.style.display = "initial";
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

    setStopped = function()
    {
        player.stop();

        score.moveRunningMarkerToStartMarker();

        score.allNotesOff(options.outputDevice);

        setMainOptionsState("toBack");

        cl.gotoOptionsDisabled.setAttribute("opacity", GLASS);

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
            var i, nOutputVoices = sequenceRecording.trackRecordings.length, trackRecording,
                j, nMoments, moment,
                offset, success = true;

            // Returns the earliest moment.timestamp in the sequenceRecording.
            // Returns Number.MAX_VALUE if sequenceRecording is undefined, null or has no moments.
            function findOffset(sequenceRecording)
            {
                var
                k, nTrks, trackRec,
                timestamp,
                rOffset = Number.MAX_VALUE;

                if(sequenceRecording !== undefined && sequenceRecording !== null)
                {
                    nTrks = sequenceRecording.trackRecordings.length;
                    for(k = 0; k < nTrks; ++k)
                    {
                        trackRec = sequenceRecording.trackRecordings[k];
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
                for(i = 0; i < nOutputVoices; ++i)
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

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);

            cl.pauseSelected.setAttribute("opacity", METAL);
            cl.goDisabled.setAttribute("opacity", GLASS);

            cl.stopControlSelected.setAttribute("opacity", GLASS);
            cl.stopControlDisabled.setAttribute("opacity", GLASS);

            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
        }

        function setPlaying(isLivePerformance)
        {
            var
            trackIsOnArray = tracksControl.getTrackIsOnArray(),
            sequenceRecording;

            function sendTrackInitializationMessages(options, outputTracks)
            {
                var track, trackIndex, nOutputTracks = outputTracks.length;

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

                for(trackIndex = 0; trackIndex < nOutputTracks; ++trackIndex)
                {
                	track = outputTracks[trackIndex];
                	if(track.class === "outputTrack")
                	{
                		sendControlMessageNow(options.outputDevice, track.midiChannel, CONTROL.VOLUME, track.masterVolume);
                		sendSetPitchWheelDeviationMessageNow(options.outputDevice, track.midiChannel, 2);
                		sendCommandMessageNow(options.outputDevice, track.midiChannel, COMMAND.PITCH_WHEEL, 64);
                		sendControlMessageNow(options.outputDevice, track.midiChannel, CONTROL.EXPRESSION, 100);
                		sendControlMessageNow(options.outputDevice, track.midiChannel, CONTROL.PAN, 64);
                		sendControlMessageNow(options.outputDevice, track.midiChannel, CONTROL.MODWHEEL, 0);
                	}
                }
            }

            deleteSaveMIDIFileButton();

            if(options.livePerformance === false && player.isPaused())
            {
                player.resume();
            }
            else if(player.isStopped())
            {
            	sequenceRecording = new SequenceRecording(player.outputTracks.length);

                // the running marker is at its correct position:
                // either at the start marker, or somewhere paused.
                score.setRunningMarkers(isLivePerformance, trackIsOnArray);
                score.moveStartMarkerToTop(svgPagesDiv);

                sendTrackInitializationMessages(options, player.outputTracks);

                player.play(trackIsOnArray, score.startMarkerMsPosition(), score.endMarkerMsPosition(), sequenceRecording);
            }

            if(options.livePerformance === true)
            {
                cl.goDisabled.setAttribute("opacity", SMOKE);
            }
            else
            {
                cl.goDisabled.setAttribute("opacity", GLASS);
            }
            cl.pauseUnselected.setAttribute("opacity", METAL);
            cl.pauseSelected.setAttribute("opacity", GLASS);

            tracksControl.setDisabled(true);

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);

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
            	setPlaying(options.livePerformance);
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
			option,
            is = globalElements.inputDeviceSelect, // = document.getElementById("inputDeviceSelect")
            os = globalElements.outputDeviceSelect, // = document.getElementById("outputDeviceSelect")
			inputsIterator = midiAccess.inputs.values(),
			outputsIterator = midiAccess.outputs.values(),
			port,
			data;

        	option = document.createElement("option");
        	option.text = "choose a MIDI input device";
        	is.add(option, null);
        	while((data = inputsIterator.next()).done !== true)
        	{
        		port = data.value;
        		//console.log('input id:', port.id, ' input name:', port.name);
        		option = document.createElement("option");
        		option.inputDevice = port;
        		option.text = port.name;
        		is.add(option, null);
        	}

        	option = document.createElement("option");
        	option.text = "choose a MIDI output device";
        	os.add(option, null);
        	while((data = outputsIterator.next()).done !== true)
        	{
        		port = data.value;
        		//console.log('input id:', port.id, ' input name:', port.name);
        		option = document.createElement("option");
        		option.outputDevice = port;
        		option.text = port.name;
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

            cl.performanceButtonsDisabled = document.getElementById("performanceButtonsDisabled");

            cl.pauseUnselected = document.getElementById("pauseUnselected");
            cl.pauseSelected = document.getElementById("pauseSelected");
            cl.goDisabled = document.getElementById("goDisabled");

            cl.stopControlSelected = document.getElementById("stopControlSelected");
            cl.stopControlDisabled = document.getElementById("stopControlDisabled");

            cl.setStartControlSelected = document.getElementById("setStartControlSelected");
            cl.setStartControlDisabled = document.getElementById("setStartControlDisabled");

            cl.setEndControlSelected = document.getElementById("setEndControlSelected");
            cl.setEndControlDisabled = document.getElementById("setEndControlDisabled");

            cl.sendStartToBeginningControlSelected = document.getElementById("sendStartToBeginningControlSelected");
            cl.sendStartToBeginningControlDisabled = document.getElementById("sendStartToBeginningControlDisabled");

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

	// The Go control can be clicked directly.
	// Also, it is called automatically when assisted performances start.
	goControlClicked = function()
	{
		if(svgControlsState === 'stopped' || svgControlsState === 'paused')
		{
			setSvgControlsState('playing');
		}
		else if(svgControlsState === 'playing')
		{
			setSvgControlsState('paused');
		}
	},

    // called when the user clicks a control in the GUI
    doControl = function(controlID)
    {
    	// This function analyses the score's id string in the scoreSelector in assistantPerformer.html,
    	// and uses the information to load the score's svg files into the "svgPages" div,
    	// The score is actually analysed when the Start button is clicked.
    	function setScore()
    	{
    		var scoreInfo;

    		// Returns a scoreInfo object constructed from the id string of the score currently selected in the scoreSelector
    		// (Defined in assistantPerformer.html.)
    		// The id string contains the following items, each separated by a 'separator'. The 'separator' consists of a comma
    		// and any amount of whitespace on either side.
    		//    nameString followed by the separator 
    		//    "nPages="  followed by the number of pages (an integer of any length) followed by the separator followed by
    		//    "nOutputVoices="  followed by the number of output tracks (an integer of any length)  followed by the separator followed by
    		//    "nInputVoices="  followed by the number of input tracks (an integer of any length)
    		// for example:
    		//    "Song Six, nPages=7, nOutputVoices=6"
    		// The nameString is used (twice) to construct the URLs for the score pages, for example:
    		// "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Song Six/Song Six page 1.svg"
    		// or
    		// "file:///C:/xampp/htdocs/localAssistantPerformer/scores/Song Six/Song Six page 1.svg"
    		//
    		// The scoreInfo object returned by this function has the following attributes:
    		//      scoreInfo.name (e.g. "Song Six"
    		//      scoreInfo.nPages (e.g. 7)
    		//      scoreInfo.nOutputVoices (e.g. 8)
    		//      scoreInfo.nInputVoices (e.g. 1)
    		//      scoreInfo.speedPercent (optional. If undefined, default is 100)
    		// and optionally (if present)
    		//      scoreInfo.trackInitialisationValues (optional maxVolumes and pitchWheelDeviations. If undefined, defaults are all 127 and/or all 2, see below)
    		// and optionally (if present)
    		//      scoreInfo.defaultPerformanceOptions (see below)
    		function getScoreInfo()
    		{
    			var scoreSelectorElem = document.getElementById("scoreSelect"),
                    scoreInfoStrings, scoreInfoString, scoreInfo;

    			function getScoreInfoStrings(scoreSelectorElem)
    			{
    				var scoreInfoStrings = [], i, childNode;

    				for(i = 0 ; i < scoreSelectorElem.childNodes.length; ++i)
    				{
    					childNode = scoreSelectorElem.childNodes[i];
    					if(childNode.value !== undefined)
    					{
    						scoreInfoStrings.push(childNode.value);
    					}
    				}
    				return scoreInfoStrings;
    			}

    			function analyseString(infoString)
    			{
    				var i, scoreInfo = {}, components;

    				components = infoString.split(",");
    				for(i = 0; i < components.length; ++i)
    				{
    					components[i] = components[i].trim();
    				}

    				if((components.length === 1 && components[0] !== "choose a score")
    				|| components.length !== 8
					|| components[0].slice(0, 7) !== "folder="
					|| components[1].slice(0, 6) !== "title="
					|| components[2].slice(0, 7) !== "nPages="
					|| components[3].slice(0, 13) !== "svgPageWidth="
					|| components[4].slice(0, 14) !== "svgPageHeight="
					|| components[5].slice(0, 14) !== "nOutputVoices="
					|| components[6].slice(0, 13) !== "nInputVoices="
					|| components[7].slice(0, 13) !== "inputHandler=")
    				{
    					throw "Illegal option value in assistantPerformer.html";
    				}

    				if(components.length === 8)
    				{
    					scoreInfo.folder = components[0].slice(7);
    					scoreInfo.title = components[1].slice(6);
    					scoreInfo.nPages = parseInt(components[2].slice(7), 10);
    					scoreInfo.svgPageWidthStr = components[3].slice(13);
    					scoreInfo.svgPageHeightStr = components[4].slice(14);
    					scoreInfo.nOutputVoices = parseInt(components[5].slice(14), 10);
    					scoreInfo.nInputVoices = parseInt(components[6].slice(13), 10);
    					scoreInfo.inputHandler = components[7].slice(13); // e.g. "keyboard1[36..84]"
    				}

    				return scoreInfo;
    			}

    			scoreInfoStrings = getScoreInfoStrings(scoreSelectorElem);

    			scoreInfoString = scoreInfoStrings[scoreSelectorElem.selectedIndex];

    			scoreInfo = analyseString(scoreInfoString);

    			return scoreInfo;
    		}

    		function setPages(scoreInfo)
    		{
    			var rootURL,
                    folder = scoreInfo.folder, // e.g. "Study 3 sketch 2.1 - with input"
					title = scoreInfo.title, // e.g. "Study 3 sketch 2"
                    nPages = scoreInfo.nPages,
					widthStr = scoreInfo.svgPageWidthStr,
					heightStr = scoreInfo.svgPageHeightStr,
                    svgPagesFrame,
                    embedCode = "",
                    pageURL,
                    i,
                    frameWidth = parseInt(widthStr, 10) + 17;

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

    			function embedPageCode(url, widthStr, heightStr)
    			{
    				var code = "<embed " +
                                    "src=\'" + url + "\' " +
                                    "content-type=\'image/svg+xml\' " +
                                    "class=\'svgPage\' " +
                                    "width=\'" + widthStr + "\' " +  // the width value at the top of each svg page
                                    "height=\'" + heightStr + "\' />" +   // the height value at the top of each svg page
                                "<br />";
    				return code;
    			}

    			rootURL = scoresURL(document.URL);

    			for(i = 0; i < nPages; ++i)
    			{
    				pageURL = rootURL + folder;
    				pageURL = pageURL + "/";
    				pageURL = pageURL + title;
    				pageURL = pageURL + " page ";
    				pageURL = pageURL + (i + 1).toString();
    				pageURL = pageURL + ".svg";
    				// e.g. "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/Song Six/Song Six page 1.svg"
    				// or   "file:///C:/xampp/htdocs/localAssistantPerformer/scores/Song Six/Song Six page 1.svg"

    				embedCode += embedPageCode(pageURL, widthStr, heightStr);
    			}
    			svgPagesFrame = document.getElementById('svgPages');
    			svgPagesFrame.style.width = frameWidth.toString(10);
    			svgPagesFrame.style.marginLeft = (1446 - frameWidth) / 2;
    			svgPagesFrame.innerHTML = embedCode;
    		}

    		// scoreInfoInputHandler includes the keyRange (e.g: "keyboard1[36..84]").
    		function setInputDeviceOptions(scoreInfoInputHandler)
    		{
    			var handler, range;

    			// rangeString is of the form "[36..84]" containing two numbers
    			// that are returned as range.bottomKey and range.topKey
    			function getRange(rangeString)
    			{
    				var strs, range = {};

    				strs = rangeString.split("..");
    				strs[0] = strs[0].replace("[", "");
    				strs[1] = strs[1].replace("]", "");
    				range.bottomKey = parseInt(strs[0], 10);
    				range.topKey = parseInt(strs[1], 10);

    				return range;
    			}

    			if(scoreInfoInputHandler === "none")
    			{
    				globalElements.inputDeviceSelect.selectedIndex = 0;
    				globalElements.inputDeviceSelect.options[0].text = "this score does not accept live input";
    				globalElements.inputDeviceSelect.disabled = true;
    				options.inputHandler = undefined;
    			}
    			else
    			{
    				// globalElements.inputDeviceSelect.selectedIndex is not changed here
    				globalElements.inputDeviceSelect.options[0].text = "choose a MIDI input device";
    				globalElements.inputDeviceSelect.disabled = false;

    				if(scoreInfoInputHandler.indexOf("keyboard1") === 0)
    				{
    					handler = _AP.keyboard1;
    					range = getRange(scoreInfoInputHandler.slice("keyboard1".length));
    				}
    				else
    				{
    					console.assert(false, "Error: unknown scoreInfo.inputType")
    				}

    				options.inputHandler = handler;
    				options.inputKeyRange = range;
    			}
    		}

    		scoreInfo = getScoreInfo();

    		setPages(scoreInfo);

    		setInputDeviceOptions(scoreInfo.inputHandler);

    		svgPagesDiv.scrollTop = 0;
    		scoreHasJustBeenSelected = true;
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

    	// goControlClicked is an outer function

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
            if(globalElements.scoreSelect.selectedIndex > 0)
            {
            	setScore();
            }
        }

        if(controlID === "scoreSelect")
        {
        	if(globalElements.scoreSelect.selectedIndex > 0)
        	{
        		setScore();
        	}
        	else
        	{
        		setMainOptionsState("toFront"); // hides startRuntimeButton
        	}
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
            disabledOpacity = disabledElem.getAttribute("opacity");

        if(disabledOpacity !== SMOKE)
        {
            overRectElem.setAttribute("opacity", METAL);
        }
    },
    hideOverRect = function(overRectID)
    {
        var overRect = document.getElementById(overRectID);

        overRect.setAttribute("opacity", GLASS);
    },

    // Called when the Start button is clicked.
    // The score selector sets the array of svgScorePage urls.
    // The Start button is enabled when a score and MIDI output have been selected.
    // It does not require a MIDI input.
    beginRuntime = function()
    {
    	function getTracksAndPlayer(score, options)
    	{
    		var tracks;

    		if(scoreHasJustBeenSelected)
    		{
    			// everything except the timeObjects (which have to take account of speed)
    			// if options.livePerformance === false, the InputVoices are not constructed.
    			score.getEmptyPagesAndSystems(svg, options.livePerformance);
    		}

    		// tracks will contain the input and output tracks from the score
    		// in two attributes; inputTracks[] and outputTracks[].
    		tracks = score.getTracks(svg, options.livePerformance, options.globalSpeed);

    		if(options.livePerformance)
    		{			
    			player = options.inputHandler; // e.g. keyboard1 -- the "prepared piano"
    			player.inputTracks = tracks.inputTracks;
    			player.outputTracks = tracks.outputTracks; // public player.outputTracks is needed for sending track initialization messages
    			player.init(options.inputDevice, options.outputDevice, options.inputKeyRange, reportEndOfPerformance, reportMsPos);
			}
    		else
    		{
    			player = sequence; // sequence is a namespace, not a class.
    			player.outputTracks = tracks.outputTracks; // public player.outputTracks is needed for sending track initialization messages
    			player.init(options.outputDevice, reportEndOfPerformance, reportMsPos);
    		}

    		// The tracksControl is in charge of refreshing the entire display, including both itself and the score.
    		// It calls the score.refreshDisplay(isLivePerformance, trackIsOnArray) function as a callback when one
    		// of its track controls is turned on or off.
    		// score.refreshDisplay(isLivePerformance, trackIsOnArray) simply tells the score to repaint itself.
    		// Repainting includes using the correct staff colours, but the score may also update the position of
    		// its start marker (which always starts on a chord) if a track is turned off.
    		tracksControl.init(tracks.outputTracks.length, tracks.inputTracks.length, options.livePerformance, score.refreshDisplay);
    	}

        if(document.getElementById("inputDeviceSelect").selectedIndex === 0)
        {
            options.livePerformance = false;
        }
        else
        {
            options.livePerformance = true;
        }

        options.globalSpeed = document.getElementById("globalSpeedInput").value / 100;

        getTracksAndPlayer(score, options);

        score.refreshDisplay(options.livePerformance); // undefined trackIsOnArray is the same as all track states are "on"

        score.moveStartMarkerToTop(svgPagesDiv);

        setSvgControlsState('stopped');

        if(options.livePerformance === true)
        {
        	goControlClicked();
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
