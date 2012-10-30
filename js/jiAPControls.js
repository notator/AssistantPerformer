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

JI_NAMESPACE.namespace('JI_NAMESPACE.apControls');

JI_NAMESPACE.apControls = (function (document, window)
{
    "use strict";

    // module dependencies (see Javascript Patterns p.98)
    var svgTracksControl = JI_NAMESPACE.apTracksControl,
        jiScore = JI_NAMESPACE.score,
        jiAssistant = JI_NAMESPACE.assistant,
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

    // options set in the top dialog
        options = {},

        scoreHasJustBeenSelected = false,

    // This is set when the input or output device selectors change.
    setMidiDevices = function (input, output)
    {
        options.inputDevice = input;
        options.outputDevice = output;
    },

    setMainOptionsState = function (mainOptionsState)
    {
        var inputDeviceIndex, scoreIndex, outputDeviceIndex;

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
                    mo.velocityOptionCheckbox.disabled = true;
                    mo.pitchOptionCheckbox.disabled = true;
                    mo.expressionOptionCheckbox.disabled = true;
                    mo.modulationWheelOptionCheckbox.disabled = true;
                    mo.panOptionCheckbox.disabled = true;
                    mo.pitchWheelOptionCheckbox.disabled = true;
                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = true;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = true;
                    mo.assistantsSpeedInputText.disabled = true;
                }
                else
                {
                    mo.trackSelector.disabled = false;
                    mo.velocityOptionCheckbox.disabled = false;
                    mo.pitchOptionCheckbox.disabled = false;
                    mo.expressionOptionCheckbox.disabled = false;
                    mo.modulationWheelOptionCheckbox.disabled = false;
                    mo.panOptionCheckbox.disabled = false;
                    mo.pitchWheelOptionCheckbox.disabled = false;
                    mo.assistantUsesAbsoluteDurationsRadioButton.disabled = false;
                    mo.assistantUsesRelativeDurationsRadioButton.disabled = false;
                    mo.assistantsSpeedInputText.disabled = false;
                }

                if (inputDeviceIndex === 0)
                {
                    mo.trackSelector.disabled = true;
                    mo.velocityOptionCheckbox.disabled = true;
                    mo.pitchOptionCheckbox.disabled = true;
                    mo.expressionOptionCheckbox.disabled = true;
                    mo.modulationWheelOptionCheckbox.disabled = true;
                    mo.panOptionCheckbox.disabled = true;
                    mo.pitchWheelOptionCheckbox.disabled = true;

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
                mo.velocityOptionCheckbox.disabled = true;
                mo.pitchOptionCheckbox.disabled = true;
                mo.expressionOptionCheckbox.disabled = true;
                mo.modulationWheelOptionCheckbox.disabled = true;
                mo.panOptionCheckbox.disabled = true;
                mo.pitchWheelOptionCheckbox.disabled = true;
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
            if (sequence !== undefined && !(sequence.isStopped()))
            {
                score.moveRunningMarkerToStartMarker();
                sequence.stop();
            }

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

            svgTracksControl.setDisabled(false);
        },

    // callback called when a performing sequence has played the last message in the span.
    reportEndOfSpan = function ()
    {
        setStopped();
        // The following line is important.
        // Otherwise svgControlsState is 'paused' because of the way the go button works.
        svgControlsState = 'stopped';
    },

    // optional callback: Called by a performing sequence, and reports
    // the timestamp (=msPosition) of the MIDIMoment curently being sent.
    // When all the MidiMessages in the span have been played,
    // reportEndOfSpan() is called (see above).
    reportMsPos = function (msPosition)
    {
        //console.log("jiAPControls: calling score.advanceRunningMarker(msPosition), msPosition=" + msPosition);
        // If there is a graphic object in the score having msPosition,
        // the running cursor is aligned to that object.
        score.advanceRunningMarker(msPosition);
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

            svgTracksControl.setDisabled(true);
        }

        // setStopped is outer function

        function setPaused()
        {
            score.allNotesOff(options.outputDevice);

            svgTracksControl.setDisabled(true);

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

            if (sequence !== undefined && !(sequence.isStopped()) && !(sequence.isPaused()))
            {
                sequence.pause();
            }
        }

        function setPlaying()
        {
            var player = sequence;
            if (options.assistedPerformance === true)
            {
                player = assistant;
            }

            svgTracksControl.setDisabled(true);

            cl.gotoOptionsDisabled.setAttribute("opacity", SMOKE);
            cl.livePerformerOnOffDisabled.setAttribute("opacity", SMOKE);

            cl.pauseUnselected.setAttribute("opacity", METAL);
            cl.pauseSelected.setAttribute("opacity", GLASS);
            cl.goDisabled.setAttribute("opacity", GLASS);

            cl.stopControlSelected.setAttribute("opacity", GLASS);
            cl.stopControlDisabled.setAttribute("opacity", GLASS);

            cl.setStartControlDisabled.setAttribute("opacity", SMOKE);
            cl.setEndControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStartToBeginningControlDisabled.setAttribute("opacity", SMOKE);
            cl.sendStopToEndControlDisabled.setAttribute("opacity", SMOKE);

            if (player !== undefined && (player.isStopped() || player.isPaused()))
            {
                if (player.isPaused())
                {
                    player.resume();
                }
                else
                {
                    // the running marker is at its correct position:
                    // either at the start marker, or somewhere paused.
                    score.setRunningMarkers(svgTracksControl);
                    score.moveStartMarkerToTop(svgPagesDiv);
                    player.playSpan(options.outputDevice, score.startMarkerMsPosition(), score.endMarkerMsPosition(),
                        svgTracksControl, reportEndOfSpan, reportMsPos);
                }
            }
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

            svgTracksControl.setDisabled(true);

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

            svgTracksControl.setDisabled(true);

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

        //alert("setting controls svgControlsState: " + svgControlsState);
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
                setPaused();
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

    init = function ()
    {
        function getMainOptionElements()
        {
            mo.midiInputDeviceSelector = document.getElementById("midiInputDeviceSelector");
            mo.scoreSelector = document.getElementById("scoreSelector");
            mo.midiOutputDeviceSelector = document.getElementById("midiOutputDeviceSelector");
            mo.trackSelector = document.getElementById("trackSelector");
            mo.velocityOptionCheckbox = document.getElementById("velocityOptionCheckbox");
            mo.pitchOptionCheckbox = document.getElementById("pitchOptionCheckbox");
            mo.expressionOptionCheckbox = document.getElementById("expressionOptionCheckbox");
            mo.modulationWheelOptionCheckbox = document.getElementById("modulationWheelOptionCheckbox");
            mo.panOptionCheckbox = document.getElementById("panOptionCheckbox");
            mo.pitchWheelOptionCheckbox = document.getElementById("pitchWheelOptionCheckbox");
            mo.assistantUsesAbsoluteDurationsRadioButton = document.getElementById("assistantUsesAbsoluteDurationsRadioButton");
            mo.assistantsSpeedInputText = document.getElementById("assistantsSpeedInputText");
            mo.assistantUsesRelativeDurationsRadioButton = document.getElementById("assistantUsesRelativeDurationsRadioButton");
            mo.startRuntimeButton = document.getElementById("startRuntimeButton");
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

        score = new jiScore.Score(runningMarkerHeightChanged); // an empty score, with callback function

        setSvgPagesDivHeight();

        getMainOptionElements();

        getControlLayers(document);

        setSvgControlsState('disabled');

        window.scrollTo(0, 0);
    },

    doControl = function (controlID)
    {
        // This function sets the html content of the "svgPages" div, and initializes
        // both the performer's track selector (in the main options dialog) and
        // the performance svgTracksControl (in the SVG controls at the top of the score).
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
            svgTracksControl.init(nTracks);
            svgPagesDiv.scrollTop = 0;

            scoreHasJustBeenSelected = true;
        }

        function goControlClicked()
        {
            // options.assistedPerformance is kept up to date by the livePerformerOnOffButton.
            if (options.assistedPerformance)
            {
                svgTracksControl.setTrackOn(options.livePerformersTrackIndex);
            }

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
            setTimeout(function ()
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
        if (controlID === "scoreSelector")
        {
            setScore();
        }
        if (controlID === "midiInputDeviceSelector"
        || controlID === "scoreSelector"
        || controlID === "midiOutputDeviceSelector"
        || controlID === "assistantUsesAbsoluteDurationsRadioButton"
        || controlID === "assistantUsesRelativeDurationsRadioButton")
        {
            setMainOptionsState("enable"); // enables only the appropriate controls
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
            }
        }

        if (controlID === "gotoOptions")
        {
            if (cl.gotoOptionsDisabled.getAttribute("opacity") !== SMOKE)
            {
                setSvgControlsState('disabled');
                score.moveStartMarkerToTop(svgPagesDiv);
                window.scrollTo(0, 0);
                scoreHasJustBeenSelected = false;
            }
        }
    },

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
            var trackSelector = document.getElementById("trackSelector"),
                velocityOptionCheckbox = document.getElementById("velocityOptionCheckbox"),
                pitchOptionCheckbox = document.getElementById("pitchOptionCheckbox"),
                expressionOptionCheckbox = document.getElementById("expressionOptionCheckbox"),
                modulationWheelOptionCheckbox = document.getElementById("modulationWheelOptionCheckbox"),
                panOptionCheckbox = document.getElementById("panOptionCheckbox"),
                pitchWheelOptionCheckbox = document.getElementById("pitchWheelOptionCheckbox"),
                assistantUsesAbsoluteDurationsRadioButton = document.getElementById("assistantUsesAbsoluteDurationsRadioButton"),
                assistantsSpeedInputText = document.getElementById("assistantsSpeedInputText"),
                success;

            function checkSpeedInput()
            {
                var inputText = document.getElementById("assistantsSpeedInputText"),
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
                options.livePerformersTrackIndex = trackSelector.selectedIndex;
                options.velocity = velocityOptionCheckbox.checked;
                options.pitch = pitchOptionCheckbox.checked;
                options.expression = expressionOptionCheckbox.checked;
                options.modulationWheel = modulationWheelOptionCheckbox.checked;
                options.pan = panOptionCheckbox.checked;
                options.pitchWheel = pitchWheelOptionCheckbox.checked;
                options.assistantUsesAbsoluteDurations = assistantUsesAbsoluteDurationsRadioButton.checked;

                options.assistantsSpeed = parseFloat(assistantsSpeedInputText.value) / 100.0;

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

            sequence = score.getSequence(options.assistantsSpeed);

            if (options.assistedPerformance === true)
            {
                assistant = new jiAssistant.Assistant(options.livePerformersTrackIndex, sequence, reportEndOfSpan, reportMsPos);
            }

            // The sequence's play() functions can now play its internal tracks
            // Each track is an array of midiMoments ordered in temporal sequence.

            window.scrollTo(0, 630); // 600 is the absolute position of the controlPanel div (!)

            score.moveStartMarkerToTop(svgPagesDiv);

            setSvgControlsState('stopped');
        }
    },

    publicAPI =
    {
        init: init,

        setMidiDevices: setMidiDevices,

        doControl: doControl,
        showOverRect: showOverRect,
        hideOverRect: hideOverRect,

        beginRuntime: beginRuntime
    };
    // end var

    return publicAPI;

} (document, window));
