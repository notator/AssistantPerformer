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

_AP.namespace('_AP.controls');

_AP.controls = (function(document, window)
{
    "use strict";

    var
    residentSf2Synth,

    tracksControl = _AP.tracksControl,
    Score = _AP.score.Score,
    sequence = _AP.sequence,
    player, // player can be set to sequence, or to MIDI input event handlers such as _AP.mono1 or _AP.keyboard1.
    SequenceRecording = _AP.sequenceRecording.SequenceRecording,
    sequenceToSMF = _AP.standardMidiFile.sequenceToSMF,

    midiAccess,
    score,
    svgControlsState = 'stopped', //svgControlsState can be 'disabled', 'stopped', 'paused', 'playing', 'settingStart', 'settingEnd', conducting.
    globalElements = {}, // assistantPerformer.html elements 
    cl = {}, // control layers

    // constants for control layer opacity values
    METAL = "1", // control layer is completely opaque
    SMOKE = "0.7", // control layer is smoky (semi-transparent)
    GLASS = "0", // control layer is completely transparent

    PIANOLA_MUSIC_SCORE_INDEX = 1,
    STUDY1_SCORE_INDEX = 2,
    STUDY2_SCORE_INDEX = 3,
    STUDY3_SKETCH1_SCORE_INDEX1 = 4,
    STUDY3_SKETCH1_SCORE_INDEX2 = 5,
    STUDY3_SKETCH2_SCORE_INDEX1 = 6,
    STUDY3_SKETCH2_SCORE_INDEX2 = 7,
    TOMBEAU1_SCORE_INDEX = 8,

    RESIDENT_SYNTH_INDEX = 1,

    SPEEDCONTROL_MIDDLE = 90, // range is 0..180

    // options set in the top dialog
    options = {},

    scoreHasJustBeenSelected = false,

    // deletes the 'save' button created by createSaveMIDIFileLink() 
    deleteSaveLink = function()
    {
        let
        downloadLinkDiv = document.getElementById("downloadLinkDiv"), 
        saveLink = document.getElementById("saveLink");

        if(downloadLinkDiv !== null && saveLink !== null)
        {
            // Need a small delay for the revokeObjectURL to work properly.
            window.setTimeout(function()
            {
                window.URL.revokeObjectURL(saveLink.href); // window.URL is set in Main.js
                downloadLinkDiv.removeChild(saveLink);
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
    createSaveMIDIFileLink = function(scoreName, sequenceRecording, sequenceMsDuration)
    {
        var
        standardMidiFile,
        downloadName,
        downloadLinkDiv, saveLink, i, a,
        nOutputVoices = sequenceRecording.trackRecordings.length;

        if(hasData(nOutputVoices, sequenceRecording.trackRecordings))
        {
            downloadLinkDiv = document.getElementById("downloadLinkDiv"); // the Element which will contain the link

            if(downloadLinkDiv !== null)
            {
                saveLink = document.getElementById("saveLink");

                if(saveLink === null) // It doesn't exist, so can be created and added to downloadLinkDiv.
                {
                    downloadName = getMIDIFileName(scoreName);

                    standardMidiFile = sequenceToSMF(sequenceRecording, sequenceMsDuration);

                    a = document.createElement('a');
                    a.id = "saveLink";
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
                        if(img !== null)
                        {
                            img.src = "images/saveMouseOut.png";
                        }
                    };

                    a.onclick = function() // there is an event argument, but it is ignored
                    {
                        // The link's download field has been set, so the file is downloaded here.
                        deleteSaveLink();
                    };

                    downloadLinkDiv.appendChild(a);
                }
            }
        }
    },

    residentSynthCanPlayScore = function(scoreIndex)
    {
        var rval = false,
            playableScores = [PIANOLA_MUSIC_SCORE_INDEX, STUDY1_SCORE_INDEX, TOMBEAU1_SCORE_INDEX];

        console.assert(scoreIndex > 0, "This function should only be called with valid score indices.");

        if(playableScores.indexOf(scoreIndex) >= 0)
        {
            rval = true;
        }
        return rval;
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
                globalElements.needsMIDIAccessDiv.style.display = "none";
                globalElements.aboutLinkDiv.style.display = "none";
                globalElements.startRuntimeButton.style.display = "none";
                globalElements.svgRuntimeControls.style.visibility = "hidden";
                globalElements.svgPagesFrame.style.visibility = "hidden";

                if(scoreIndex > 0)
                {
                    globalElements.aboutLinkDiv.style.display = "block";

                    if(residentSynthCanPlayScore(scoreIndex) === true || (residentSynthCanPlayScore(scoreIndex) === false && midiAccess !== null))
                    {
                        if(globalElements.waitingForSoundFontDiv.style.display === "none"
                            && scoreIndex > 0 && outputDeviceIndex > 0)
                        {
                            globalElements.startRuntimeButton.style.display = "initial";
                        }
                    }
                    else
                    {
                        globalElements.needsMIDIAccessDiv.style.display = "block";
                    }
                }
                break;
            case "toBack": // set svg controls and score visible
                globalElements.titleOptionsDiv.style.visibility = "hidden";
                globalElements.svgRuntimeControls.style.visibility = "visible";
                globalElements.svgPagesFrame.style.visibility = "visible";
                break;
            default:
                throw "Unknown program state.";
        }
    },

    setConductorControlClicked = function()
    {
        // The conductor control is disabled if this is a live performance.
        if(cl.setConductorControlDisabled.getAttribute("opacity") === GLASS)
        {
            // the button is enabled 
            if(svgControlsState === 'stopped')
            {
                setSvgControlsState('conducting'); // sets options.isConducting = true and score.setConducting(true);
            }
            else if(svgControlsState === 'conducting')
            {
                setSvgControlsState('stopped'); // sets options.isConducting = false and score.setConducting(false);
            }
        }
    },

    setCursorAndEventListener = function(svgControlsState)
    {
        var i,
            s = score;

        if(s.markersLayers !== undefined)
        {
            switch(svgControlsState)
            {
                case 'settingStart':
                    for(i = 0; i < s.markersLayers.length; ++i)
                    {
                        s.markersLayers[i].addEventListener('click', s.setStartMarkerClick, false);
                        s.markersLayers[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setStartCursor.cur'), crosshair";
                    }
                    break;
                case 'settingEnd':
                    for(i = 0; i < s.markersLayers.length; ++i)
                    {
                        s.markersLayers[i].addEventListener('click', s.setEndMarkerClick, false);
                        s.markersLayers[i].style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/setEndCursor.cur'), pointer";
                    }
                    break;
                case 'conducting':
                    globalElements.conductingLayer.style.visibility = "visible";
                    globalElements.conductingLayer.addEventListener('mousemove', s.conduct, false);
                    globalElements.conductingLayer.addEventListener('click', setConductorControlClicked, false);
                    globalElements.conductingLayer.style.cursor = "url('http://james-ingram-act-two.de/open-source/assistantPerformer/cursors/conductor.cur'), move";
                    break;
                case 'stopped':
                    // According to
                    // https://developer.mozilla.org/en-US/docs/DOM/element.removeEventListener#Notes
                    // "Calling removeEventListener() with arguments which do not identify any currently 
                    //  registered EventListener on the EventTarget has no effect."
                    for(i = 0; i < s.markersLayers.length; ++i)
                    {
                        s.markersLayers[i].removeEventListener('click', s.setStartMarkerClick, false);
                        s.markersLayers[i].removeEventListener('click', s.setEndMarkerClick, false);
                        s.markersLayers[i].style.cursor = 'auto';
                    }
                    globalElements.conductingLayer.style.visibility = "hidden";
                    globalElements.conductingLayer.removeEventListener('mousemove', s.conduct, false);
                    globalElements.conductingLayer.removeEventListener('click', setConductorControlClicked, false);
                    globalElements.conductingLayer.style.cursor = 'auto';
                    break;
                default:
                    throw "Unknown state!";
            }
        }
    },

    setStopped = function()
    {
        player.stop();

        if(options.isConducting === true && options.livePerformance === false)
        {
            //score.moveStartMarkerToTop(globalElements.svgPagesFrame);
            options.isConducting = false;
            score.setConducting(false);
            initializePlayer(score, options);
        }

        score.hideRunningMarkers();
        score.moveRunningMarkersToStartMarkers();

        options.outputDevice.reset();

        setMainOptionsState("toBack");

        setCursorAndEventListener('stopped');

        svgControlsState = 'stopped';

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

        cl.setConductorControlSelected.setAttribute("opacity", GLASS);
        cl.setConductorControlDisabled.setAttribute("opacity", GLASS);
        /********* end performance buttons *******************/

        tracksControl.setDisabled(false);

        globalElements.speedControlInput.disabled = false;
        globalElements.speedControlSmokeDiv.style.display = "none";
    },

    // callback called when a performing sequenceRecording is stopped or has played its last message,
    // or when the player is stopped or has played its last subsequence.
    reportEndOfPerformance = function(sequenceRecording, performanceMsDuration)
    {
        var
        scoreName = globalElements.scoreSelect.options[globalElements.scoreSelect.selectedIndex].text;

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
            createSaveMIDIFileLink(scoreName, sequenceRecording, performanceMsDuration);
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
    reportMsPos = function(msPositionInScore, systemIndex)
    {
        //console.log("Controls: calling score.advanceRunningMarker(msPosition), msPositionInScore=" + msPositionInScore);
        // If there is a graphic object in the score having msPositionInScore,
        // the running cursor is aligned to that object.
        score.advanceRunningMarker(msPositionInScore, systemIndex);
    },

    startPlaying = function(isLivePerformance)
    {
        var startMarkerMsPosition, endMarkerMsPosition, baseSpeed,
        sequenceRecording, trackIsOnArray = [];

        deleteSaveLink();

        if(isLivePerformance === false && player.isPaused())
        {
            player.resume();
        }
        else if(player.isStopped())
        {
            sequenceRecording = new SequenceRecording(player.outputTracks.length);

            // the running marker is at its correct position:
            // either at the start marker, or somewhere paused.
            score.setRunningMarkers();
            score.moveStartMarkerToTop(globalElements.svgPagesFrame);
            score.getReadOnlyTrackIsOnArray(trackIsOnArray);

            startMarkerMsPosition = score.startMarkerMsPosition();
            endMarkerMsPosition = score.endMarkerMsPosition();
            if(options.isConducting === true)
            {
                baseSpeed = 1;
            }
            else // isLivePerformance == true or false (player is Keyboard1 or normal Sequence)
            {
                baseSpeed = speedSliderValue(globalElements.speedControlInput.value);
            }

            player.play(trackIsOnArray, startMarkerMsPosition, endMarkerMsPosition, baseSpeed, sequenceRecording);
        }

        if(options.isConducting === false)
        {
            if(isLivePerformance === true)
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
            cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);
        }
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
            cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);
            /********* end performance buttons *******************/

            // The tracksControl is only initialised after a specific score is loaded.

            setCursorAndEventListener('stopped');
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

            options.outputDevice.reset();

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
            cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);
        }

        function setSettingStart()
        {
            tracksControl.setDisabled(true);

            globalElements.speedControlInput.disabled = true;
            globalElements.speedControlCheckbox.disabled = true;
            globalElements.speedControlSmokeDiv.style.display = "block";

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);

            cl.goDisabled.setAttribute("opacity", SMOKE);
            cl.stopControlDisabled.setAttribute("opacity", SMOKE);

            cl.setStartControlSelected.setAttribute("opacity", METAL);
            cl.setStartControlDisabled.setAttribute("opacity", GLASS);

            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);

            setCursorAndEventListener('settingStart');
        }

        function setSettingEnd()
        {
            tracksControl.setDisabled(true);

            globalElements.speedControlInput.disabled = true;
            globalElements.speedControlCheckbox.disabled = true;
            globalElements.speedControlSmokeDiv.style.display = "block";

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);

            cl.goDisabled.setAttribute("opacity", SMOKE);
            cl.stopControlDisabled.setAttribute("opacity", SMOKE);
            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);

            cl.setEndControlSelected.setAttribute("opacity", METAL);
            cl.setEndControlDisabled.setAttribute("opacity", GLASS);

            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);

            setCursorAndEventListener('settingEnd');
        }

        function toggleConducting()
        {
            if(options.isConducting)
            {
                setStopped();
                score.setConducting(false);
                options.isConducting = false;
            }
            else
            {
                tracksControl.setDisabled(true);

                globalElements.speedControlInput.disabled = true;
                globalElements.speedControlCheckbox.disabled = true;
                globalElements.speedControlSmokeDiv.style.display = "block";

                // begin performance buttons
                cl.goDisabled.setAttribute("opacity", SMOKE);
                cl.stopControlDisabled.setAttribute("opacity", SMOKE);
                cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
                cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
                cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
                cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);
                cl.setConductorControlSelected.setAttribute("opacity", METAL);
                // end performance buttons

                cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);

                setCursorAndEventListener('conducting');

                score.setConducting(true);
                score.moveStartMarkerToTop(globalElements.svgPagesFrame);

                options.isConducting = true;

                initializePlayer(score, options);               
            }

        }

        svgControlsState = svgCtlsState;

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
                startPlaying(options.livePerformance);
                break;
            case 'settingStart':
                setSettingStart();
                break;
            case 'settingEnd':
                setSettingEnd();
                break;
            case 'conducting':                 
                toggleConducting();
                break;
        }
    },

    // sets the options in the input device selector
    // midiAccess can be null
    setMIDIInputDeviceSelector = function(midiAccess)
    {
        var
        option,
        is = globalElements.inputDeviceSelect; // = document.getElementById("inputDeviceSelect")

        is.options.length = 0; // important when called by midiAccess.onstatechange 

        option = document.createElement("option");
        if(midiAccess !== null)
        {
            option.text = "choose a MIDI input device";
            is.add(option, null);
            midiAccess.inputs.forEach(function(port)
            {
                //console.log('input id:', port.id, ' input name:', port.name);
                option = document.createElement("option");
                option.inputDevice = port;
                option.text = port.name;
                is.add(option, null);
            });
        }
        else
        {
            option.text = "browser does not support Web MIDI";
            is.add(option, null);
            globalElements.inputDeviceSelect.disabled = true;
        }
    },

    // sets the options in the output device selector
    // midiAccess can be null
    setMIDIOutputDeviceSelector = function(midiAccess, residentSf2Synth)
    {
        var
        option,
        os = globalElements.outputDeviceSelect; // = document.getElementById("outputDeviceSelect")

        os.options.length = 0; // important when called by midiAccess.onstatechange

        option = document.createElement("option");
        option.text = "choose a MIDI output device";
        os.add(option, null);

        option = document.createElement("option");
        option.outputDevice = residentSf2Synth;
        option.text = "Resident Sf2 Synth";
        os.add(option, null);

        if(midiAccess !== null)
        {
            midiAccess.outputs.forEach(function(port)
            {
                //console.log('output id:', port.id, ' output name:', port.name);
                option = document.createElement("option");
                option.outputDevice = port;
                option.text = port.name;
                os.add(option, null);
            });
        }
    },

    onMIDIDeviceStateChange = function(e)
    {
        var
        is = globalElements.inputDeviceSelect, // = document.getElementById("inputDeviceSelect")
        os = globalElements.outputDeviceSelect, // = document.getElementById("outputDeviceSelect")
        inputOptionsLength = is.options.length,
        currentOutputDeviceIndex = os.selectedIndex;

        switch(e.port.type)
        {
            case "input":
                setMIDIInputDeviceSelector(midiAccess);
                if(inputOptionsLength < is.options.length)
                {
                    // input device added
                    is.selectedIndex = is.options.length - 1;
                }
                else
                {
                    // input device removed
                    is.selectedIndex = 0;
                }
                break;
            case "output":
                setMIDIOutputDeviceSelector(midiAccess, residentSf2Synth);
                // Output devices are currently handled differently from the input devices...
                // (I don't want the output device selector's selected index to change 
                // every time an input device is connected or disconnected.)
                if(currentOutputDeviceIndex < os.options.length)
                {
                    os.selectedIndex = currentOutputDeviceIndex;
                }
                else
                {
                    os.SelectedIndex = 0;
                }
                break;
        }
    },

    // Defines the window.svgLoaded(...) function.
    // Sets up the pop-up menues for scores and MIDI input and output devices.
    // Loads SoundFonts, adding them to the relevant scoreSelect option(s).
    // mAccess is null if the browser does not support the Web MIDI API
    init = function(mAccess)
    {
        function getGlobalElements()
        {
            globalElements.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            globalElements.inputDeviceSelect = document.getElementById("inputDeviceSelect");
            globalElements.scoreSelect = document.getElementById("scoreSelect");
            globalElements.outputDeviceSelect = document.getElementById("outputDeviceSelect");
            globalElements.waitingForSoundFontDiv = document.getElementById("waitingForSoundFontDiv");
            globalElements.waitingForScoreDiv = document.getElementById("waitingForScoreDiv");
            globalElements.aboutLinkDiv = document.getElementById("aboutLinkDiv");
            globalElements.needsMIDIAccessDiv = document.getElementById("needsMIDIAccessDiv");
            globalElements.startRuntimeButton = document.getElementById("startRuntimeButton");

            globalElements.svgRuntimeControls = document.getElementById("svgRuntimeControls");
            globalElements.speedControlInput = document.getElementById("speedControlInput");
            globalElements.speedControlCheckbox = document.getElementById("speedControlCheckbox");
            globalElements.speedControlLabel2 = document.getElementById("speedControlLabel2");
            globalElements.speedControlSmokeDiv = document.getElementById("speedControlSmokeDiv");

            globalElements.conductingLayer = document.getElementById("conductingLayer");
            globalElements.svgPagesFrame = document.getElementById("svgPagesFrame");
        }

        // resets the score selector in case the browser has cached the last value
        function initScoreSelector(runningMarkerHeightChanged)
        {
            // There is one soundFont per score type.
            // The soundFont is added as an attribute to the scoreSelect option for the score.
            function loadSoundFonts(scoreSelect)
            {
                var
                firstSoundFontLoaded = false,
                soundFontIndex = 0,
                soundFontData =
                [
                    //{
                    //    name: "SongSix",
                    //    url: "http://james-ingram-act-two.de/soundFonts/Arachno/SongSix.sf2",
                    //    presetIndices: [60, 67, 72, 74, 76, 78, 79, 115, 117, 122, 123, 124, 125, 126, 127],
                    //    scoreSelectIndices: [1]
                    //},
                    //{
                    //    name: "Study2",
                    //    url: "http://james-ingram-act-two.de/soundFonts/Arachno/Study2.sf2",
                    //    presetIndices: [8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 26, 27],
                    //    scoreSelectIndices: [2]
                    //},
                    //{
                    //    name: "Study3Sketch",
                    //    url: "http://james-ingram-act-two.de/soundFonts/Arachno/Study3Sketch.sf2",
                    //    presetIndices: [72, 78, 79, 113, 115, 117, 118],
                    //    scoreSelectIndices: [3, 4, 5, 6]
                    //},
                    {
                        name: "Grand Piano",
                        url: "http://james-ingram-act-two.de/soundFonts/Arachno/Arachno1.0selection-grand piano.sf2",
                        presetIndices: [0],
                        scoreSelectIndices: [PIANOLA_MUSIC_SCORE_INDEX, STUDY1_SCORE_INDEX, TOMBEAU1_SCORE_INDEX]
                    }
                ];

                // Note that XMLHttpRequest does not work with local files (localhost:).
                // To make it work, run the app from the web (http:).
                function loadSoundFontAsynch()
                {
                    var
                    soundFont,
                    soundFontURL = soundFontData[soundFontIndex].url,
                    soundFontName = soundFontData[soundFontIndex].name,
                    presetIndices = soundFontData[soundFontIndex].presetIndices,
                    scoreSelectIndices = soundFontData[soundFontIndex].scoreSelectIndices;

                    function onLoad()
                    {
                        var i, option;

                        function loadFirstSoundFont(synth, soundFont)
                        {
                            var channelIndex;

                            synth.setSoundFont(soundFont);

                            // For some reason, the first noteOn to be sent by the host, reacts only after a delay.
                            // This noteOn/noteOff pair is sent so that the *next* noteOn will react immediately.
                            // This is actually a kludge. I have been unable to solve the root problem.
                            // (Is there an uninitialized buffer somewhere?)
                            if(synth.setMasterVolume)
                            {
                                // consoleSf2Synth can't/shouldn't do this.
                                // (It has no setMasterVolume function)
                                synth.setMasterVolume(0);
                                for(channelIndex = 0; channelIndex < 16; ++channelIndex)
                                {
                                    synth.noteOn(channelIndex, 64, 100);
                                    synth.noteOff(channelIndex, 64, 100);
                                }
                            }
                            // Wait for the above noteOn/noteOff kludge to work.
                            setTimeout(function()
                            {
                                if(synth.setMasterVolume)
                                {
                                    synth.setMasterVolume(16384);
                                }
                                firstSoundFontLoaded = true;
                            }, 2400);

                            setMainOptionsState("toFront"); // hides "soundFont loading" message
                        }

                        soundFont.init();
                        for(i = 0; i < scoreSelectIndices.length; ++i)
                        {
                            if(scoreSelectIndices[i] < scoreSelect.options.length)
                            {
                                option = scoreSelect.options[scoreSelectIndices[i]];
                                option.soundFont = soundFont;
                            }
                        }

                        if(!firstSoundFontLoaded)
                        {
                            loadFirstSoundFont(residentSf2Synth, soundFont);
                        }

                        console.log(soundFontName + ": loading complete.");

                        soundFontIndex++;
                        if(soundFontIndex < soundFontData.length)
                        {
                            console.log('loading the "' + soundFontData[soundFontIndex].name + '" soundFont (' + (soundFontIndex + 1) + "/" + soundFontData.length + ")...");
                            loadSoundFontAsynch();
                        }
                    }

                    console.log('loading the "' + soundFontName + '" soundFont (' + (soundFontIndex + 1) + "/" + soundFontData.length + ")...");
                    soundFont = new WebMIDI.soundFont.SoundFont(soundFontURL, soundFontName, presetIndices, onLoad);
                }

                loadSoundFontAsynch();
            }

            globalElements.scoreSelect.selectedIndex = 0;
            score = new Score(runningMarkerHeightChanged); // an empty score, with callback function
            loadSoundFonts(globalElements.scoreSelect);
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

            cl.setConductorControlSelected = document.getElementById("setConductorControlSelected");
            cl.setConductorControlDisabled = document.getElementById("setConductorControlDisabled");
        }

        // callback passed to score. Called when the running marker moves to a new system.
        function runningMarkerHeightChanged(runningMarkerYCoordinates)
        {
            var div = globalElements.svgPagesFrame,
            height = Math.round(parseFloat(div.style.height));

            if(runningMarkerYCoordinates.bottom > (height + div.scrollTop))
            {
                div.scrollTop = runningMarkerYCoordinates.top - 10;
            }
        }

        midiAccess = mAccess;

        residentSf2Synth = new WebMIDI.residentSf2Synth.ResidentSf2Synth();
        residentSf2Synth.init();

        getGlobalElements();

        setMIDIInputDeviceSelector(midiAccess);
        setMIDIOutputDeviceSelector(midiAccess, residentSf2Synth);

        if(midiAccess !== null)
        {
            // update the device selectors when devices get connected, disconnected, opened or closed
            midiAccess.addEventListener('statechange', onMIDIDeviceStateChange, false);
        }

        initScoreSelector(runningMarkerHeightChanged);

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

    resetSpeed = function()
    {
        if (player.setSpeed !== undefined)
        {
            // Keyboard1 does nothing here if the trackWorkers have not yet been initialised.
            player.setSpeed(1);
        }
        globalElements.speedControlInput.value = SPEEDCONTROL_MIDDLE;
        globalElements.speedControlCheckbox.checked = false;
        globalElements.speedControlCheckbox.disabled = true;
        globalElements.speedControlLabel2.innerHTML = "100%";
    },

    // see: http://stackoverflow.com/questions/846221/logarithmic-slider
    // Returns the speed from the (logarithmic) speed slider control.
    speedSliderValue = function (position)
    {
        var
        // the slider has min="0" max="180" (default value=SPEEDCONTROL_MIDDLE (=90))
        minp = 0, maxp = 180, // The slider has width 180px
        // The result will be between 1/10 and 9.99, the middle value is 1.
        minv = Math.log(0.1), maxv = Math.log(9.99),
        // the adjustment factor
        scale = (maxv - minv) / (maxp - minp);

        return Math.exp(minv + scale * (position - minp));
    },

    // Called from beginRuntime() with options.isConducting===false when the start button is clicked on page 1.
    // Called again with options.isConducting===true if the conduct performance button is toggled on.
    // If this is a live-conducted performance, sets the now() function to be the conductor's now().
    // Otherwise performance.now() is used (for normal and Keyboard1 performances).
    // Note that the performance's basic speed is always 1 for conducted performances, but that it can change
    // (live) during other performances (normal Sequence and Keyboard1).
    initializePlayer = function(score, options)
    {
        var timer, speed, tracksData = score.getTracksData();

        player = sequence; // sequence is a namespace, not a class.
        player.outputTracks = tracksData.outputTracks; // public player.outputTracks is needed for sending track initialization messages

        if(options.isConducting)
        {
            speed = speedSliderValue(globalElements.speedControlInput.value);
            timer = score.getConductor(speed); // use conductor.now()
        }
        else
        {
            timer = performance; // use performance.now()           
        }        
        player.init(timer, options.outputDevice, reportEndOfPerformance, reportMsPos);
    },

    // called when the user clicks a control in the GUI
    doControl = function(controlID)
    {
        // This function analyses the score's id string in the scoreSelector in assistantPerformer.html,
        // and uses the information to load the score's svg files into the "svgPagesFrame" div,
        // The score is actually analysed when the Start button is clicked.
        function setScore(scoreIndex)
        {
            var scoreInfo, nPagesLoading;

            // The scoreSelectIndex argument is the index of the score in the score selector
            // Returns a scoreInfo object having the following fields:
            //    scoreInfo.path -- the path to the score's file
            //    scoreInfo.inputHandler
            //    scoreInfo.aboutText
            //    scoreInfo.aboutURL
            // The path setting includes the complete path from the Assistant Performer's "scores" folder
            // to the page(s) to be used, and ends with either "(scroll)" or "(<nPages> pages)" -- e.g. "(14 pages)".
            // "Song Six/Song Six (scroll).svg" is a file. If separate pages are to be used, their paths will be:
            // "Song Six/Song Six page 1.svg", "Song Six/Song Six page 2.svg", "Song Six/Song Six page 3.svg" etc.
            // Note that if annotated page(s) are to be used, their path value will include the name of their
            // folder (e.g. "Song Six/annotated/Song Six (14 pages)").
            // If the score contains input voices, the inputHandler= option will be defined: It selects one of the
            // Assistant Performer's inputHandlers. If omitted, the inputHandler is given its default value "none".
            function getScoreInfo(scoreSelectIndex)
            {
                var scoreInfo = { path: "", inputHandler: "none", aboutText: "", aboutURL: "" };

                switch(scoreSelectIndex)
                {
                    case PIANOLA_MUSIC_SCORE_INDEX:
                        scoreInfo.path = "Pianola Music/Pianola Music (scroll)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Pianola Music";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/pianolaMusic/aboutPianolaMusic.html";
                        break;
                    case STUDY1_SCORE_INDEX:
                        scoreInfo.path = "Study 1/Study 1 (scroll)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Study 1";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/study1/aboutStudy1.html";
                        break;
                    case STUDY2_SCORE_INDEX:
                        scoreInfo.path = "Study 2/Study 2 (scroll)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Study 2";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/study2/aboutStudy2.html";
                        break;
                    case STUDY3_SKETCH1_SCORE_INDEX1:
                        scoreInfo.path = "Study 3 sketch 1/Study 3 sketch 1 (scroll)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case STUDY3_SKETCH1_SCORE_INDEX2:
                        scoreInfo.path = "Study 3 sketch 1/Study 3 sketch 1 (2 pages)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case STUDY3_SKETCH2_SCORE_INDEX1:
                        scoreInfo.path = "Study 3 sketch 2.1 - with input/Study 3 sketch 2 (scroll)";
                        scoreInfo.inputHandler = "keyboard1";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case STUDY3_SKETCH2_SCORE_INDEX2:
                        scoreInfo.path = "Study 3 sketch 2.2 - less visible/Study 3 sketch 2 (scroll)";
                        scoreInfo.inputHandler = "keyboard1";
                        scoreInfo.aboutText = "about Study 3 Sketch";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/sketches/study3Sketch/aboutStudy3Sketch.html";
                        break;
                    case TOMBEAU1_SCORE_INDEX:
                        scoreInfo.path = "Tombeau 1/Tombeau 1 (scroll)";
                        scoreInfo.inputHandler = "none";
                        scoreInfo.aboutText = "about Tombeau 1";
                        scoreInfo.aboutURL = "http://james-ingram-act-two.de/compositions/tombeau1/aboutTombeau1.html";
                        break;
                    default:
                        break;
                }

                return scoreInfo;
            }

            function getPathData(path)
            {
                var pathData = {}, components;

                components = path.split("(");
                if(components[0][components[0].length - 1] !== ' ')
                {
                    alert("Error in pages path string:\nThere must be a space character before the '('");
                }
                pathData.basePath = components[0] + "page ";

                // the second search argument is a regular expression for a single ')' character.
                if(components[1].search("page") < 0 || components[1].search(/\)/i) < 0)
                {
                    alert("Error in pages path string:\nThe number of pages is not correctly defined in the final bracket.");
                }

                pathData.nPages = parseInt(components[1], 10);
                if(pathData.nPages === null || pathData.nPages === undefined || pathData.nPages < 1)
                {
                    alert("Error in pages path string:\nIllegal number of pages.");
                }

                return pathData;
            }

            function setAboutLink(scoreInfo)
            {
                var linkDivElem = document.getElementById('aboutLinkDiv');

                linkDivElem.style.display = "none";
                if(scoreInfo.aboutURL !== undefined)
                {
                    linkDivElem.innerHTML = '<a href=\"' + scoreInfo.aboutURL + '\" target="_blank">' + scoreInfo.aboutText + '</a>';
                    linkDivElem.style.display = "block";
                }
            }

            function setScoreLoadedState()
            {
                nPagesLoading--;
                if(nPagesLoading === 0)
                {
                    globalElements.waitingForScoreDiv.style.display = "none";
                    globalElements.outputDeviceSelect.disabled = false;
                }
            }

            function setLoadingScoreState()
            {
                if(nPagesLoading === 0)
                {
                    globalElements.waitingForScoreDiv.style.display = "block";
                    globalElements.outputDeviceSelect.disabled = true;
                }
                nPagesLoading++;
            }

            function getNewSvgPageElem(pageURL)
            {
                var newNode;

                newNode = document.createElement("object");

                newNode.setAttribute("data", pageURL);
                newNode.setAttribute("type", "image/svg+xml");
                newNode.setAttribute("class", "svgPage");
                newNode.addEventListener('load', function() { setScoreLoadedState(); });

                return newNode;
            }

            // Returns the URL of the scores directory. This can either be a file:
            // e.g. "file:///D:/Visual Studio/Projects/MyWebsite/james-ingram-act-two/open-source/assistantPerformer/scores/"
            // served from IIS:
            // e.g. "http://localhost:49560/james-ingram-act-two.de/open-source/assistantPerformer/scores/"
            // or on the web:
            // e.g. "http://james-ingram-act-two.de/open-source/assistantPerformer/scores/"
            // Note that Chrome needs to be started with its --allow-file-access-from-files flag to use the first of these.
            function getScoresURL()
            {
                var documentURL = document.URL,
                apIndex = documentURL.search("assistantPerformer.html"),
                url = documentURL.slice(0, apIndex) + "scores/";

                return url;
            }

            function setPages(scoreInfo)
            {
                var i, scoresURL, newNode,
                    svgPagesFrame,
                    pathData,
                    pageURL;

                scoresURL = getScoresURL();
                svgPagesFrame = document.getElementById('svgPagesFrame');
                svgPagesFrame.innerHTML = "";
                nPagesLoading = 0;

                if(scoreInfo.path.search("(scroll)") >= 0)
                {
                    setLoadingScoreState();
                    pageURL = scoresURL + scoreInfo.path + ".svg";
                    newNode = getNewSvgPageElem(pageURL);
                    svgPagesFrame.appendChild(newNode);
                }
                else
                {
                    pathData = getPathData(scoreInfo.path);
                    for(i = 0; i < pathData.nPages; ++i)
                    {
                        setLoadingScoreState();
                        pageURL = scoresURL + pathData.basePath + (i + 1).toString(10) + ".svg";
                        newNode = getNewSvgPageElem(pageURL);
                        svgPagesFrame.appendChild(newNode);
                    }
                }
            }

            function setOptionsInputHandler(scoreInfoInputHandler)
            {
                if(scoreInfoInputHandler === "none")
                {
                    if(globalElements.inputDeviceSelect.disabled === false)
                    {
                        globalElements.inputDeviceSelect.selectedIndex = 0;
                        globalElements.inputDeviceSelect.options[0].text = "this score does not accept live input";
                        globalElements.inputDeviceSelect.disabled = true;
                        options.inputHandler = undefined;
                    }
                }
                else
                {
                    // globalElements.inputDeviceSelect.selectedIndex is not changed here
                    globalElements.inputDeviceSelect.options[0].text = "choose a MIDI input device";
                    globalElements.inputDeviceSelect.disabled = false;

                    if(scoreInfoInputHandler === "keyboard1")
                    {
                        options.inputHandler = _AP.keyboard1;
                    }
                    else
                    {
                        console.assert(false, "Error: unknown scoreInfo.inputType");
                    }
                }
            }

            scoreInfo = getScoreInfo(scoreIndex);

            setAboutLink(scoreInfo);

            if(residentSynthCanPlayScore(scoreIndex) === true || (residentSynthCanPlayScore(scoreIndex) === false && midiAccess !== null))
            {
                setPages(scoreInfo);

                setOptionsInputHandler(scoreInfo.inputHandler);

                globalElements.svgPagesFrame.scrollTop = 0;
                scoreHasJustBeenSelected = true;
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
                score.hideRunningMarkers();
                score.moveRunningMarkersToStartMarkers();
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
                score.hideRunningMarkers();
                score.moveRunningMarkersToStartMarkers();
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

        function waitForSoundFont()
        {
            if(residentSynthCanPlayScore(globalElements.scoreSelect.selectedIndex)
            && globalElements.scoreSelect.options[globalElements.scoreSelect.selectedIndex].soundFont === undefined)
            {
                globalElements.waitingForSoundFontDiv.style.display = "block";
                globalElements.outputDeviceSelect.disabled = true;
            }
            else
            {
                globalElements.waitingForSoundFontDiv.style.display = "none";
                globalElements.outputDeviceSelect.disabled = false;
            }
            doControl("scoreSelect");
        }

        if(controlID === "scoreSelect")
        {
            globalElements.outputDeviceSelect.selectedIndex = 0;

            if(globalElements.scoreSelect.selectedIndex > 0)
            {
                if(residentSynthCanPlayScore(globalElements.scoreSelect.selectedIndex))
                {
                    globalElements.outputDeviceSelect.options[RESIDENT_SYNTH_INDEX].disabled = false;
                }
                else
                {
                    globalElements.outputDeviceSelect.options[RESIDENT_SYNTH_INDEX].disabled = true;
                }

                setScore(globalElements.scoreSelect.selectedIndex);
            }
            else
            {
                setMainOptionsState("toFront"); // hides startRuntimeButton and "about" text
            }
        }

        /**** controls in options panel ***/
        if(controlID === "inputDeviceSelect"
        || controlID === "outputDeviceSelect")
        {
            setMainOptionsState("toFront"); // enables only the appropriate controls
        }

        if(controlID === "scoreSelect")
        {
            if(residentSynthCanPlayScore(globalElements.scoreSelect.selectedIndex)
            && globalElements.scoreSelect.options[globalElements.scoreSelect.selectedIndex].soundFont === undefined)
            {
                setTimeout(waitForSoundFont, 200);
            }
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
                case "setConductorControl":
                    setConductorControlClicked();
                    break;
                default:
                    break;
            }
        }

        if(controlID === "gotoOptions")
        {
            deleteSaveLink();

            if(midiAccess !== null)
            {
                midiAccess.addEventListener('statechange', onMIDIDeviceStateChange, false);
            }

            if(cl.gotoOptionsDisabled.getAttribute("opacity") !== SMOKE)
            {
                setSvgControlsState('disabled');
                score.moveStartMarkerToTop(globalElements.svgPagesFrame);
                scoreHasJustBeenSelected = false;
            }
        }

        if(controlID === "speedControlMousemove")
        {
            var speed = speedSliderValue(globalElements.speedControlInput.value);
            if (player.setSpeed !== undefined)
            {
                player.setSpeed(speed);
            }

            if(globalElements.speedControlInput.value === SPEEDCONTROL_MIDDLE)
            {
                globalElements.speedControlCheckbox.checked = true;
                globalElements.speedControlCheckbox.disabled = true;
            }
            else
            {
                globalElements.speedControlCheckbox.checked = false;
                globalElements.speedControlCheckbox.disabled = false;
            }
            globalElements.speedControlLabel2.innerHTML = Math.round(speed * 100) + "%";
        }

        if(controlID === "speedControlCheckboxClick")
        {
            resetSpeed();
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
        var tracksData;

        function setMIDIDevices(options)
        {
            var i,
            inSelector = document.getElementById("inputDeviceSelect"),
            scoreSelector = document.getElementById("scoreSelect"),
            outSelector = document.getElementById("outputDeviceSelect");

            // inputDevices are opened and closed by the input event handling module (e.g. Keyboard1)
            if(inSelector.selectedIndex === 0)
            {
                options.inputDevice = null;
            }
            else
            {
                options.inputDevice = inSelector.options[inSelector.selectedIndex].inputDevice;
            }

            for(i = 1; i < outSelector.options.length; ++i)
            {
                if(outSelector.options[i].outputDevice)
                {
                    outSelector.options[i].outputDevice.close();
                }
            }

            if(outSelector.selectedIndex === 0)
            {
                options.outputDevice = null;
            }
            else
            {
                options.outputDevice = outSelector.options[outSelector.selectedIndex].outputDevice;
                options.outputDevice.open();
            }

            if(options.outputDevice.setSoundFont !== undefined)
            {
                options.outputDevice.setSoundFont(scoreSelector[scoreSelector.selectedIndex].soundFont);
            }
        }

        // tracksData is set up inside score (where it can be retrieved
        // again later) and returned by this function.
        function getTracksData(score, options)
        {
            var tracksData;
            if(scoreHasJustBeenSelected)
            {
                // everything except the timeObjects (which have to take account of speed)
                score.getEmptySystems(options.livePerformance, startPlaying); // startPlaying is a callback for the conductor);
            }

            score.setTracksData();
            // tracksData contains the following attributes:
            //        inputTracks[]
            //        outputTracks[]
            //        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
            //            inputKeyRange.bottomKey
            //            inputKeyRange.topKey
            tracksData = score.getTracksData();

            // The tracksControl is in charge of refreshing the entire display, including both itself and the score.
            // It calls the score.refreshDisplay(isLivePerformance, trackIsOnArray) function as a callback when one
            // of its track controls is turned on or off.
            // score.refreshDisplay(isLivePerformance, trackIsOnArray) simply tells the score to repaint itself.
            // Repainting includes using the correct staff colours, but the score may also update the position of
            // its start marker (which always starts on a chord) if a track is turned off.
			tracksControl.init(tracksData.outputTracks, tracksData.inputTracks, options.livePerformance, score.refreshDisplay);

			return tracksData;
        }

        function setOutputDeviceFunctions(outputDevice)
        {
            var resetMessages = [];

            function getResetMessages()
            {
                var byte1, channelIndex,
                    constants = _AP.constants,
                    CONTROL_CHANGE = constants.COMMAND.CONTROL_CHANGE,
                    ALL_CONTROLLERS_OFF = constants.CONTROL.ALL_CONTROLLERS_OFF,
                    ALL_SOUND_OFF = constants.CONTROL.ALL_SOUND_OFF;

                for(channelIndex = 0; channelIndex < 16; channelIndex++)
                {
                    byte1 = CONTROL_CHANGE + channelIndex;
                    resetMessages.push(new Uint8Array([byte1, ALL_CONTROLLERS_OFF, 0]));
                    resetMessages.push(new Uint8Array([byte1, ALL_SOUND_OFF, 0]));
                }
            }

            function reset()
            {
                var i;
                for(i = 0; i < resetMessages.length; i++)
                {
                    this.send(resetMessages[i], performance.now());
                }
            }

            function sendStartStateMessages(tracks)
            {
                var i, j, nTracks = tracks.length, track, msgs, nMsgs;

                for(i = 0; i < nTracks; ++i)
                {
                    track = tracks[i];
                    if(track.isPerforming)
                    {
                        msgs = tracks[i].startStateMessages;
                        nMsgs = msgs.length;
                        for(j = 0; j < nMsgs; ++j)
                        {
                            this.send(msgs[j].data, 0);
                        }
                    }
                }
            }

            getResetMessages();

            if(outputDevice !== null)
            {
                outputDevice.reset = reset;
                outputDevice.sendStartStateMessages = sendStartStateMessages;
            }
        }

        function setSpeedControl(tracksControlWidth)
        {
            var
            speedControlDiv = document.getElementById("speedControlDiv"),
            performanceButtonsSVG = document.getElementById("performanceButtonsSVG"),
            speedControlSmokeDivWidth = parseInt(globalElements.speedControlSmokeDiv.style.width, 10),
            performanceButtonsSVGLeft = parseInt(performanceButtonsSVG.style.left, 10),
            margin = Math.round((performanceButtonsSVGLeft - tracksControlWidth - speedControlSmokeDivWidth) / 2),
            speedControlDivLeft;

            margin = (margin < 4) ? 4 : margin;

            speedControlDivLeft = tracksControlWidth + margin -1;
            performanceButtonsSVGLeft = speedControlDivLeft + speedControlSmokeDivWidth + margin;
            speedControlDiv.style.left = speedControlDivLeft.toString(10) + "px";
            performanceButtonsSVG.style.left = performanceButtonsSVGLeft.toString(10) + "px";

            globalElements.speedControlSmokeDiv.style.display = "none";   
        }

        //try
        //{
            options.livePerformance = (globalElements.inputDeviceSelect.disabled === false && globalElements.inputDeviceSelect.selectedIndex > 0); 
            options.isConducting = false;

            if(options.livePerformance)
            {
                //disable conductor button
                cl.setConductorControlDisabled.setAttribute("opacity", SMOKE);
            }
            else
            {
                cl.setConductorControlDisabled.setAttribute("opacity", GLASS);                
            }

            setMIDIDevices(options);

            setOutputDeviceFunctions(options.outputDevice);

            // This function can throw an exception
            // (e.g. if an attempt is made to create an event that has no duration).
            tracksData = getTracksData(score, options);

            if(options.livePerformance)
            {
                player = options.inputHandler; // e.g. keyboard1 -- the "prepared piano"
                player.outputTracks = tracksData.outputTracks; // public player.outputTracks is needed for sending track initialization messages
                player.init(options.inputDevice, options.outputDevice, tracksData, reportEndOfPerformance, reportMsPos);
            }
            else
            {
                // can be called again for conducted performance
                initializePlayer(score, options);
            }

            setSpeedControl(tracksControl.width());

            resetSpeed(); // if (player.setSpeed !== undefined) calls player.setSpeed(1) (100%)

            if(midiAccess !== null)
            {
                midiAccess.removeEventListener('statechange', onMIDIDeviceStateChange, false);
            }

            score.refreshDisplay(); // undefined trackIsOnArray

            score.moveStartMarkerToTop(globalElements.svgPagesFrame);

            setSvgControlsState('stopped');

            if(options.livePerformance === true)
            {
                goControlClicked();
            }
        //}
        //catch(e)
        //{
        //    window.alert(e);
        //}
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
