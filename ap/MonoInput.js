/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/MonoInput.js
*  The _AP.monoInput namespace which defines
*
*
*    //  returns an object contining the start and end positions of the player's current segment
*    currentSegmentBounds()
*
*    // message handler for input devices
*    handleMIDIInputEvent(msg)   
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.monoInput');

_AP.monoInput = (function()
{
    "use strict";

    // begin var
    var
    U = _AP.utilities,
    Message = _AP.message.Message,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,

    //Track = _AP.track.Track,
    runtimeTracksControl = _AP.tracksControl, // The control on the left of the SVG controls above the score.
    midiOutputDevice,

    tracks = [], // sequence.tracks. All the tracks, complete from the beginning to the end of the piece.
    controls = {}, // the control elements in the monoPerformersOptions div in assistantPerformer.html
    options = {}, // this variable is set at runtime (when the Start button is clicked)

    // A flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    midiObjectMsPositionsInScore = [],
    midiObjectMsPositionsInScoreIndex = 0, // the current index in the above array

    // a flat, ordered array containing the msPositions of the live performer's MidiObjects.
    // The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    performersMsPositionsInScore = [],
    performersMsPositionsInScoreIndex = 0, // an index in the performersMsPositionsInScore array (updated when a NoteOn is received)

    performanceStartTime, // the time at which the performance starts
    // Not sure if pausing is relevant in live performances...
    // Maybe delete startTimeAdjustedForPauses and disable the pause button in live performances.
    startTimeAdjustedForPauses,

    hidden = function(isHidden)
    {
        var optionsDiv = document.getElementById("monoPerformersOptions");

        if(isHidden === false)
        {
            optionsDiv.style.display = "block";
        }
        else
        {
            optionsDiv.style.display = "none";
        }
    },

    showOrHideMinimumVolumeRowDiv = function()
    {
        if(controls.pressureMidiSelect.selectedIndex === 5 // volume
        || controls.pitchWheelMidiSelect.selectedIndex === 5 // volume
        || controls.modWheelMidiSelect.selectedIndex === 5 ) // volume
        {
            controls.minimumVolumeRowDiv.show();
        }
        else
        {
            controls.minimumVolumeRowDiv.hide();
        }
    },

    showOrHideMaximumSpeedRowDiv = function()
    {
        if(controls.speedControllerSelect.selectedIndex > 0)
        {
            controls.maximumSpeedRowDiv.show();
        }
        else
        {
            controls.maximumSpeedRowDiv.hide();
        }
    },

    setDisplayForPerformer = function(performersTrackIndex)
    {
        controls.trackSelect.selectedIndex = performersTrackIndex;
        controls.controllerTrackNumberLabels.SetDisplayForPerformersTrack(controls.controllerTrackNumberLabels, performersTrackIndex);
        controls.noteOnPitchCheckBoxDivs.SetDisplayForPerformersTrack(controls.noteOnPitchCheckBoxDivs, performersTrackIndex);
        controls.noteOnVelocityCheckBoxDivs.SetDisplayForPerformersTrack(controls.noteOnVelocityCheckBoxDivs, performersTrackIndex);
        controls.pressureCheckBoxDivs.SetDisplayForPerformersTrack(controls.pressureCheckBoxDivs, performersTrackIndex);
        controls.pitchWheelCheckBoxDivs.SetDisplayForPerformersTrack(controls.pitchWheelCheckBoxDivs, performersTrackIndex);
        controls.modWheelCheckBoxDivs.SetDisplayForPerformersTrack(controls.modWheelCheckBoxDivs, performersTrackIndex);
        controls.masterVolumeDivs.SetDisplayForPerformersTrack(controls.masterVolumeDivs, performersTrackIndex);

        showOrHideMinimumVolumeRowDiv();

        showOrHideMaximumSpeedRowDiv();
    },

    controlOptions =
    [
        { name: "none" }, // The command/midiControl attribute is undefined. No attempt should be made to use it!
        { name: "aftertouch", command: COMMAND.AFTERTOUCH },
        { name: "channel pressure", command: COMMAND.CHANNEL_PRESSURE },
        { name: "pitch wheel", command: COMMAND.PITCH_WHEEL },
        { name: "modulation (1)", midiControl: CONTROL.MODWHEEL },
        { name: "volume (7)", midiControl: CONTROL.VOLUME }, // index 5 is used for volume elsewhere in this code
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

    // Gets all the controls in monoInput html, disables them all, and
    // sets them to the default values they have when no score is selected.
    initControls = function()
    {
        function getControls(controls)
        {
            function get16Elements(idRootString)
            {
                var i, element, elements = [];

                for(i = 1; i < 17; ++i)
                {
                    element = document.getElementById(idRootString + i.toString(10));
                    elements.push(element);
                }

                if(elements.length !== 16)
                {
                    throw "There must be 16 checkboxes in the array!";
                }

                return elements;
            }

            function setDivsBorderStyle(divs, performersTrackIndex, performersBorderStyle)
            {
                var i;

                for(i = 0; i < 16; ++i)
                {
                    divs[i].style.borderStyle = performersBorderStyle;
                }

                for(i = 0; i < 16; ++i)
                {
                    if(i === performersTrackIndex)
                    {
                        divs[i].style.borderColor = "#008000";
                        divs[i].style.borderStyle = performersBorderStyle;
                    }
                    else
                    {
                        divs[i].style.borderColor = "transparent";
                    }
                }
            }
            function setOrRemoveBoxBorder(divs, performersTrackIndex)
            {
                setDivsBorderStyle(divs, performersTrackIndex, "solid solid solid solid");
            }
            function setOrRemoveCapBorder(divs, performersTrackIndex)
            {
                setDivsBorderStyle(divs, performersTrackIndex, "solid solid none solid");
            }
            function setOrRemoveSidesBorder(divs, performersTrackIndex)
            {
                setDivsBorderStyle(divs, performersTrackIndex, "none solid none solid");
            }
            function setOrRemoveCupBorder(divs, performersTrackIndex)
            {
                setDivsBorderStyle(divs, performersTrackIndex, "none solid solid solid");            
            }

            // row 1
            controls.controllerTrackNumberLabels = get16Elements("mpoControllerTrackNumber"); // 16 labels
            controls.controllerTrackNumberLabels.SetDisplayForPerformersTrack = setOrRemoveCapBorder; // takes a trackNumber argument
           
            // row 2
            controls.trackSelect = document.getElementById("mpoPerformersTrackSelect");
            controls.noteOnPitchTrackSelect = document.getElementById("mpoNoteOnPitchTrackSelect");
            controls.noteOnPitchCheckBoxDivs = get16Elements("mpoNOPCheckBoxDiv"); // 16 check box divs
            controls.noteOnPitchCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveSidesBorder; // takes a trackIndex argument
            controls.noteOnPitchCheckBoxes = get16Elements("mpoNOPCheckBoxTrack"); // 16 check boxes

            // row 3
            controls.noteOnVelocityTrackSelect = document.getElementById("mpoNoteOnVelocityTrackSelect");
            controls.noteOnVelocityCheckBoxDivs = get16Elements("mpoNOVCheckBoxDiv"); // 16 check box divs
            controls.noteOnVelocityCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveCupBorder; // takes a trackIndex argument
            controls.noteOnVelocityCheckBoxes = get16Elements("mpoNOVCheckBoxTrack"); // 16 check boxes

            // row 4 just labels
            // row 5
            controls.pressureMidiSelect = document.getElementById("mpoPressureMidiSelect");
            controls.pressureTrackSelect = document.getElementById("mpoPressureTrackSelect");
            controls.pressureCheckBoxDivs = get16Elements("mpoPressureCheckBoxDiv"); // 16 check box divs
            controls.pressureCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveCapBorder; // takes a trackIndex argument
            controls.pressureCheckBoxes = get16Elements("mpoPressureCheckBoxTrack"); // 16 check boxes

            // row 6
            controls.pitchWheelMidiSelect = document.getElementById("mpoPitchWheelMidiSelect");
            controls.pitchWheelTrackSelect = document.getElementById("mpoPitchWheelTrackSelect");
            controls.pitchWheelCheckBoxDivs = get16Elements("mpoPitchWheelCheckBoxDiv"); // 16 check box divs
            controls.pitchWheelCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveSidesBorder; // takes a trackIndex argument
            controls.pitchWheelCheckBoxes = get16Elements("mpoPitchWheelCheckBoxTrack"); // 16 check boxes

            // row 7
            controls.modWheelMidiSelect = document.getElementById("mpoModWheelMidiSelect");
            controls.modWheelTrackSelect = document.getElementById("mpoModWheelTrackSelect");
            controls.modWheelCheckBoxDivs = get16Elements("mpoModWheelCheckBoxDiv"); // 16 check box divs
            controls.modWheelCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveCupBorder; // takes a trackIndex argument
            controls.modWheelCheckBoxes = get16Elements("mpoModWheelCheckBoxTrack"); // 16 check boxes

            // row 8
            controls.minimumVolumeRowDiv = document.getElementById("minimumVolumeRowDiv"); // div (to be toggled between display:table and display:none
            controls.minimumVolumeRowDiv.hide = function()
            {
                controls.minimumVolumeRowDiv.style.display = "none";
            };
            controls.minimumVolumeRowDiv.show = function()
            {
                controls.minimumVolumeRowDiv.style.display = "table";
            };

            controls.minVolumeInput = document.getElementById("mpoMinVolumeInput"); // number

            // row 9 just labels
            // row 10
            controls.masterVolumeDivs = get16Elements("mpoMasterVolume"); // 16 divs
            controls.masterVolumeDivs.SetDisplayForPerformersTrack = setOrRemoveBoxBorder; // takes a trackNumber argument
            controls.masterVolumeInputs = get16Elements("mpoMasterVolumeInput"); // 16 inputs

            // row 11
            controls.speedControllerSelect = document.getElementById("mpoSpeedControllerSelect");

            // row 12
            controls.maximumSpeedRowDiv = document.getElementById("maximumSpeedRowDiv"); // div (to be toggled between display:table and display:none
            controls.maximumSpeedRowDiv.hide = function()
            {
                controls.maximumSpeedRowDiv.style.display = "none";
            };
            controls.maximumSpeedRowDiv.show = function()
            {
                controls.maximumSpeedRowDiv.style.display = "table";
            };
            controls.maxSpeedInput = document.getElementById("mpoMaxSpeedInput"); // number
        }

        // Disables all controls, and sets them to the default values they have when no score is selected.
        // Sets all select control contents and their selectedIndex to 0. (empties the track select).
        // Removes all performer track display characteristics.
        // Hides the minimumVolume and maximumSpeed rows.
        function setDefaultControlState()
        {
            function setNoPerformer()
            {
                function emptyTrackSelect(trackSelect)
                {
                    var i;
                    for(i = trackSelect.options.length - 1; i >= 0; --i)
                    {
                        trackSelect.remove(i);
                    }
                }

                emptyTrackSelect(controls.trackSelect);
                setDisplayForPerformer(0);
            }

            function populateControlOptionSelectors(controls)
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

                populate(controls.pressureMidiSelect);
                populate(controls.pitchWheelMidiSelect);
                populate(controls.modWheelMidiSelect);
            }

            function disableControls(labels)
            {
                var i;
                for(i = 0; i < 16; ++i)
                {
                    labels[i].disabled = true;
                }
            }
            function clearAndHideCheckBoxes(checkBoxes)
            {
                var i;
                for(i = 0; i < 16; ++i)
                {
                    checkBoxes[i].checked = false;
                    //checkBoxes[i].disabled = true;
                    checkBoxes[i].style.visibility = "hidden";
                }
            }
            function clearAndHideInputs(inputs)
            {
                var i;
                for(i = 0; i < 16; ++i)
                {
                    inputs[i].value = "";
                    //inputs[i].disabled = true;
                    inputs[i].style.visibility = "hidden";
                }
            }

            setNoPerformer();

            populateControlOptionSelectors(controls);

            disableControls(controls.controllerTrackNumberLabels);
            controls.trackSelect.disabled = true;

            controls.noteOnPitchTrackSelect.selectedIndex = 0; // none;
            controls.noteOnPitchTrackSelect.disabled = true;
            clearAndHideCheckBoxes(controls.noteOnPitchCheckBoxes); // 16 check boxes

            controls.noteOnVelocityTrackSelect.selectedIndex = 0; // none;
            controls.noteOnVelocityTrackSelect.disabled = true;
            clearAndHideCheckBoxes(controls.noteOnVelocityCheckBoxes); // 16 check boxes

            controls.pressureMidiSelect.selectedIndex = 0; // none
            controls.pressureMidiSelect.disabled = true;
            controls.pressureTrackSelect.selectedIndex = 0; // none;
            controls.pressureTrackSelect.disabled = true;
            clearAndHideCheckBoxes(controls.pressureCheckBoxes); // 16 check boxes

            controls.pitchWheelMidiSelect.selectedIndex = 0; // none
            controls.pitchWheelMidiSelect.disabled = true;
            controls.pitchWheelTrackSelect.selectedIndex = 0; // none;
            controls.pitchWheelTrackSelect.disabled = true;
            clearAndHideCheckBoxes(controls.pitchWheelCheckBoxes); // 16 check boxes

            controls.modWheelMidiSelect.selectedIndex = 0; // none
            controls.modWheelMidiSelect.disabled = true;
            controls.modWheelTrackSelect.selectedIndex = 0; // none;
            controls.modWheelTrackSelect.disabled = true;
            clearAndHideCheckBoxes(controls.modWheelCheckBoxes); // 16 check boxes

            controls.minVolumeInput.value = 64; // number input
            controls.minimumVolumeRowDiv.hide();

            disableControls(controls.masterVolumeDivs);
            clearAndHideInputs(controls.masterVolumeInputs);

            controls.speedControllerSelect.selectedIndex = 0;
            controls.speedControllerSelect.disabled = true;

            controls.maxSpeedInput.value = 400; // number input
            controls.maximumSpeedRowDiv.hide();
        }

        getControls(controls);
        setDefaultControlState(); // disables all controls, sets all select control contents (empties the track select) 
    },

    // Call this whenever the master volumes have changed. 
    // A master volume value must be an integer in range 0..127.
    // Default values (100) are displayed in blue.
    checkMasterVolumes = function()
    {
        var i, ntracks = controls.trackSelect.length;
        for(i = 0; i < ntracks; ++i)
        {
            U.checkIntRange(controls.masterVolumeInputs[i], 0, 127);
            U.setDefaultValueToBlue(controls.masterVolumeInputs[i], 100);
        }
    },

    // Enables all the performers controls.
    // Sets the default volume in the first nTracks.
    enablePerformersControls = function(nTracks)
    {
        var i;

        // The number of tracks in the score is always controls.trackSelect.size
        // When there is no score, there are no tracks!
        function setTrackSelect(nTracks)
        {
            var
            i, optionElem,
            ts = controls.trackSelect;

            for(i = ts.options.length - 1; i >= 0; --i)
            {
                ts.remove(i);
            }

            if(nTracks > 0)
            {
                for(i = 1; i <= nTracks; ++i)
                {
                    optionElem = document.createElement("option");
                    optionElem.text = i.toString(10);
                    ts.add(optionElem, null);
                }
            }
        }

        setTrackSelect(nTracks);

        for(i = 0; i < nTracks; ++i)
        {
            controls.controllerTrackNumberLabels[i].disabled = false;
            controls.noteOnPitchCheckBoxDivs[i].disabled = false;
            controls.noteOnPitchCheckBoxes[i].style.visibility = "visible";
            controls.noteOnVelocityCheckBoxDivs[i].disabled = false;
            controls.noteOnVelocityCheckBoxes[i].style.visibility = "visible";
            controls.pressureCheckBoxDivs[i].disabled = false;
            controls.pressureCheckBoxes[i].style.visibility = "visible";
            controls.pitchWheelCheckBoxDivs[i].disabled = false;
            controls.pitchWheelCheckBoxes[i].style.visibility = "visible";
            controls.modWheelCheckBoxDivs[i].disabled = false;
            controls.modWheelCheckBoxes[i].style.visibility = "visible";
            controls.masterVolumeDivs[i].disabled = false;
            controls.masterVolumeInputs[i].style.visibility = "visible";
            controls.masterVolumeInputs[i].value = 100; // default master volume is 100
        }

        checkMasterVolumes();

        controls.trackSelect.disabled = false;
        controls.noteOnPitchTrackSelect.disabled = false;
        controls.noteOnVelocityTrackSelect.disabled = false;
        //controls.pressureMidiSelect.disabled = false;
        controls.pressureTrackSelect.disabled = false;
        //controls.pitchWheelMidiSelect.disabled = false;
        controls.pitchWheelTrackSelect.disabled = false;
        //controls.modWheelMidiSelect.disabled = false;
        controls.modWheelTrackSelect.disabled = false;
        controls.minVolumeInput.disabled = false;
        controls.speedControllerSelect.disabled = false;
        controls.maxSpeedInput.disabled = false;
        controls.maximumSpeedRowDiv.disabled = false;
    },

    // sets one of the following options in the trackCBselect from the trackBoolArray and performersTrackIndex
    //      none
    //      all
    //      performer
    //      other
    //      custom
    // Note that checkBoxes.length is always 16.
    setTrackCheckBoxesSelect = function (trackCBSelect, checkBoxes, performersTrackIndex)
    {
        var found, i,
        nTracks = controls.trackSelect.length;

        trackCBSelect.selectedIndex = 0; // 'none';
        found = true;
        for(i = 0; i < nTracks; ++i)
        {
            if(checkBoxes[i].checked === true)
            {
                found = false;
                break;
            }
        }
        if(!found)
        {                
            trackCBSelect.selectedIndex = 1; // 'all';
            found = true;
            for(i = 0; i < nTracks; ++i)
            {
                if(checkBoxes[i].checked === false)
                {
                    found = false;
                    break;
                }
            }
        }
        if(!found)
        {
            trackCBSelect.selectedIndex = 2; // 'performer';
            found = true;
            for(i = 0; i < nTracks; ++i)
            {
                if((checkBoxes[i].checked === false && i === performersTrackIndex)
                || (checkBoxes[i].checked === true && i !== performersTrackIndex))
                {
                    found = false;
                    break;
                }
            }
        }
        if(!found)
        {
            trackCBSelect.selectedIndex = 3; // 'other';
            found = true;
            for(i = 0; i < nTracks; ++i)
            {
                if((checkBoxes[i].checked === true && i === performersTrackIndex)
                || (checkBoxes[i].checked === false && i !== performersTrackIndex))
                {
                    found = false;
                    break;
                }
            }
        }
        if(!found)
        {
            trackCBSelect.selectedIndex = 4; // 'custom';
        }
    },

    setMidiSelect = function(controlTrackSelect, controlMidiSelect)
    {
        if(controlTrackSelect.selectedIndex === 0) // 'none'
        {
            controlMidiSelect.selectedIndex = 0; // 'none'
            controlMidiSelect.disabled = true;
        }
        else
        {
            controlMidiSelect.disabled = false;
        }
    },

    // Sets the monoInput dialog from the mPerformerOptionsString in the score's .mkss file.
    // The values of the controls will be used by the event handler. 
    setControlsFromString = function(mPerformerOptionsString, nTracks)
    {
        var str, trackBoolArray, trackIntArray, performersTrackIndex, attrValueString;

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

        // str is a string containing nTracks characters that are '0's and '1's.
        function stringToTrackBoolArray(str)
        {
            var boolArray = [],
                i;

            for(i = 0; i < str.length; ++i)
            {
                if(str[i] === '0')
                {
                    boolArray.push(false);
                }
                else
                {
                    boolArray.push(true);
                }
            }

            if(boolArray.length !== nTracks)
            {
                throw "Error in monoPerformanceOptions.";
            }
            return boolArray;
        }

        function setCheckBoxesFromBoolArray(checkBoxes, boolArray)
        {
            var i;
            for(i = 0; i < boolArray.length; ++i)
            {
                checkBoxes[i].checked = boolArray[i];
            }
        }

        function setInputsFromIntArray(numberInputs, intArray)
        {
            var i;
            for(i = 0; i < intArray.length; ++i)
            {
                numberInputs[i].value = intArray[i];
            }
        }

        function indexOfControlOption(optionStr)
        {
            var i, rval = -1;

            for(i = 0; i < controlOptions.length; ++i)
            {
                if(controlOptions[i].name === optionStr)
                {
                    rval = i;
                    break;
                }
            }
            
            if(rval === -1)
            {
                throw "Error: Unknown control type.";
            }

            return rval;

        }

        initControls();

        enablePerformersControls(nTracks);

        str = attributeValueString(mPerformerOptionsString, "trackIndex=");
        if(str !== null)
        {
            performersTrackIndex = parseInt(str, 10);
        }

        if(performersTrackIndex === undefined)
        {
            throw "track index must be defined!";
        }

        str = attributeValueString(mPerformerOptionsString, "noteOnPitchTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.noteOnPitchCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.noteOnPitchTrackSelect, controls.noteOnPitchCheckBoxes, performersTrackIndex);
        }

        str = attributeValueString(mPerformerOptionsString, "noteOnVelocityTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.noteOnVelocityCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.noteOnVelocityTrackSelect, controls.noteOnVelocityCheckBoxes, performersTrackIndex);
        }

        if(mPerformerOptionsString.search("pressureController=") !== -1)
        {
            attrValueString = attributeValueString(mPerformerOptionsString, "pressureController=");
            controls.pressureMidiSelect.selectedIndex = indexOfControlOption(attrValueString);
        }

        str = attributeValueString(mPerformerOptionsString, "pressureTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.pressureCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, performersTrackIndex);
            setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
        }

        if(mPerformerOptionsString.search("pitchWheelController=") !== -1)
        {
            attrValueString = attributeValueString(mPerformerOptionsString, "pitchWheelController=");
            controls.pitchWheelMidiSelect.selectedIndex = indexOfControlOption(attrValueString);
        }

        str = attributeValueString(mPerformerOptionsString, "pitchWheelTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.pitchWheelCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, performersTrackIndex);
            setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
        }

        if(mPerformerOptionsString.search("modWheelController=") !== -1)
        {
            attrValueString = attributeValueString(mPerformerOptionsString, "modWheelController=");
            controls.modWheelMidiSelect.selectedIndex = indexOfControlOption(attrValueString);
        }

        str = attributeValueString(mPerformerOptionsString, "modWheelTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.modWheelCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, performersTrackIndex);
            setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
        }

        str = attributeValueString(mPerformerOptionsString, "minVolume=");
        if(str !== null)
        {
            controls.minVolumeInput.value = parseInt(attributeValueString(mPerformerOptionsString, "minVolume="), 10);
            controls.minimumVolumeRowDiv.show();
        }
        else
        {
            controls.minimumVolumeRowDiv.hide();
        }

        trackIntArray = U.intArrayFromAttribute(nTracks, mPerformerOptionsString, "masterVolumes=", 100);
        setInputsFromIntArray(controls.masterVolumeInputs, trackIntArray);
        checkMasterVolumes(); // sets default colours

        if(mPerformerOptionsString.search("speedController=") !== -1)
        {
            controls.speedControllerSelect.text = attributeValueString(mPerformerOptionsString, "speedController=");
        }

        str = attributeValueString(mPerformerOptionsString, "speedMaxPercent=");
        if(str !== null)
        {
            controls.maxSpeedInput.value = parseFloat(attributeValueString(mPerformerOptionsString, "speedMaxPercent="));
            controls.maximumSpeedRowDiv.show();
        }
        else
        {
            controls.maximumSpeedRowDiv.hide();
        }

        setDisplayForPerformer(performersTrackIndex);
    },

    // Sets the controls to the state they have when a score
    // is loaded but has no performance options.
    setDefaultControls = function(nTracks)
    {
        var i;

        initControls();

        enablePerformersControls(nTracks);

        setDisplayForPerformer(0);
    },

    trackSelect = function()
    {
        return controls.trackSelect;
    },

    doControl = function(controlID)
    {
        var
        performersTrackIndex = controls.trackSelect.selectedIndex;
        
        // sets the checkBoxes corresponding to a trackSelect control
        function handleTrackSelect(tracksSelectID)
        {
            function setCheckBoxRow(select, checkBoxes)
            {
                var i, nTracks = controls.trackSelect.length;

                switch(select.selectedIndex)
                {
                    case 0: // none
                        for(i = 0; i < nTracks; ++i)
                        {
                            checkBoxes[i].checked = false;
                        }
                        break;
                    case 1: // all
                        for(i = 0; i < nTracks; ++i)
                        {
                            checkBoxes[i].checked = true;
                        }
                        break;
                    case 2: // performer
                        for(i = 0; i < nTracks; ++i)
                        {
                            if(i === performersTrackIndex)
                            {
                                checkBoxes[i].checked = true;
                            }
                            else
                            {
                                checkBoxes[i].checked = false;
                            }
                        }
                        break;
                    case 3: // other
                        for(i = 0; i < nTracks; ++i)
                        {
                            if(i === performersTrackIndex)
                            {
                                checkBoxes[i].checked = false;
                            }
                            else
                            {
                                checkBoxes[i].checked = true;
                            }
                        }
                        break;
                    case 4: // custom: selecting custom resets the select according to the checkBoxes
                        setTrackCheckBoxesSelect(select, checkBoxes, performersTrackIndex);
                        break;
                }
            }

            switch(tracksSelectID)
            {
                case "mpoNoteOnPitchTrackSelect": // controls.noteOnPitchTrackSelect
                    setCheckBoxRow(controls.noteOnPitchTrackSelect, controls.noteOnPitchCheckBoxes);
                    break;
                case "mpoNoteOnVelocityTrackSelect": // controls.noteOnVelocityTrackSelect
                    setCheckBoxRow(controls.noteOnVelocityTrackSelect, controls.noteOnVelocityCheckBoxes);
                    break;
                case "mpoPressureTrackSelect": // okay controls.pressureTrackSelect
                    setCheckBoxRow(controls.pressureTrackSelect, controls.pressureCheckBoxes);
                    setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
                    break;
                case "mpoPitchWheelTrackSelect": // okay controls.pitchWheelTrackSelect
                    setCheckBoxRow(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes);
                    setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
                    break;
                case "mpoModWheelTrackSelect":// okay controls.modWheelTrackSelect
                    setCheckBoxRow(controls.modWheelTrackSelect, controls.modWheelCheckBoxes);
                    setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
                    break;
            }
        }

        // handles checkBoxIDs of the form:
        // mpoNOPCheckBoxTrack1-16 // controls.noteOnPitchCheckBoxes[i]
        // mpoNOVCheckBoxTrack1-16 // controls.noteOnVelocityCheckBoxes[i]
        // mpoPressureCheckBoxTrack1-16 // controls.pressureCheckBoxes[i]
        // mpoPitchWheelCheckBoxTrack1-16 // controls.pitchWheelCheckBoxes[i]
        // mpoModWheelCheckBoxTrack1-16 // controls.modWheelCheckBoxes[i]
        // and
        // mpoMasterVolumeInput1-16 // controls.masterVolumeInputs[i]
        function handleMultiInput(ctlID)
        {
            if(ctlID.search("mpoNOPCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.noteOnPitchTrackSelect, controls.noteOnPitchCheckBoxes, performersTrackIndex);
            }
            else if(ctlID.search("mpoNOVCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.noteOnVelocityTrackSelect, controls.noteOnVelocityCheckBoxes, performersTrackIndex);
            }
            else if(ctlID.search("mpoPressureCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
            }
            else if(ctlID.search("mpoPitchWheelCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
            }
            else if(ctlID.search("mpoModWheelCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
            }
            else if(ctlID.search("mpoMasterVolumeInput") === 0)
            {
                checkMasterVolumes();
            }
        }

        /**************************************/

        switch(controlID)
        {
            case "mpoPerformersTrackSelect": //controls.trackSelect
                setDisplayForPerformer(performersTrackIndex);
                setTrackCheckBoxesSelect(controls.noteOnPitchTrackSelect, controls.noteOnPitchCheckBoxes, performersTrackIndex);
                setTrackCheckBoxesSelect(controls.noteOnVelocityTrackSelect, controls.noteOnVelocityCheckBoxes, performersTrackIndex);
                setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
                setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
                setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, performersTrackIndex);
                setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
                break;

            case "mpoPressureMidiSelect": // okay controls.pressureMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break
            case "mpoPitchWheelMidiSelect": // okay controls.pitchWheelMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break
            case "mpoModWheelMidiSelect": // okay controls.modWheelMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break

            case "mpoNoteOnPitchTrackSelect": // okay controls.noteOnPitchTrackSelect
                handleTrackSelect("mpoNoteOnPitchTrackSelect");
                break;
            case "mpoNoteOnVelocityTrackSelect": // okay controls.noteOnVelocityTrackSelect
                handleTrackSelect("mpoNoteOnVelocityTrackSelect");
                break;
            case "mpoPressureTrackSelect": // okay controls.pressureTrackSelect
                handleTrackSelect("mpoPressureTrackSelect");
                break;
            case "mpoPitchWheelTrackSelect": // okay controls.pitchWheelTrackSelect
                handleTrackSelect("mpoPitchWheelTrackSelect");
                break;
            case "mpoModWheelTrackSelect": // okay controls.modWheelTrackSelect
                handleTrackSelect("mpoModWheelTrackSelect");
                break;

            case "mpoMinVolumeInput": // okay controls.minVolumeInput
                break;

            case "mpoSpeedControllerSelect": // okay controls.speedControllerSelect
                showOrHideMaximumSpeedRowDiv();
                break;

            case "mpoMaxSpeedInput": // okay controls.maxSpeedInput
                U.checkFloatRange(controls.maxSpeedInput, 100, 800000);
                break;

            default:
                handleMultiInput(controlID); // handles individual checkBox and masterVolume inputs 
                break;
        }
    },

    /******************* runtime ********************************/

    trackIndex = function()
    {
        return controls.trackSelect.selectedIndex;
    },

    // This is where input MIDIEvents arrive, and where processing of the monoInput's input is going to be done.
    // Both RealTime and SysEx messages are ignored.
    // it is assumed that RealTime messages will not interrupt the messages being received.    
    handleMIDIInputEvent = function(msg)
    {
        var inputEvent, command, inputPressure,
            localOptions = options, trackOptions = localOptions.runtimeOptions.track;

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
            rInputEvent = {};

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
                    rInputEvent = new Message(data[0], data[1], 0);
                }
                else if(data.length === 3)
                {
                    rInputEvent = new Message(data[0], data[1], data[2]);
                }

                // other data is simply ignored

                if(rInputEvent.data !== undefined)
                {
                    rInputEvent.receivedTime = now;
                }
            }

            return rInputEvent;
        }

        function setSpeedFactor(receivedCommandIndexInHTMLMenu, controllerValue)
        {
            var speedFactor;
            // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
            //     factor = fasterRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumFactor
            // If the controller's value is < 64, the factor which is passed to tick() will be
            //     factor = slowerRoot ^ (64 - cv) -- if cv = 0, factor will is 1/maximumFactor
            function getSpeedFactor(fasterRoot, slowerRoot, controllerValue)
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

                console.log("assistant: factor=" + factor.toString(10));

                return factor;
            }

            console.log("monoInput.setSpeedFactor() has not yet been written.");
            throw "Not yet implemented.";

            //if(performersSpeedOptions !== undefined && currentIndex >= 0
            //    && performersSpeedOptions.controllerIndex !== undefined && performersSpeedOptions.controllerIndex === receivedCommandIndexInHTMLMenu
            //    && performersSpeedOptions.fasterRoot !== undefined && performersSpeedOptions.slowerRoot !== undefined)
            //{
            //    speedFactor = getSpeedFactor(performersSpeedOptions.fasterRoot, performersSpeedOptions.slowerRoot, controllerValue);
            //    performedSequences[currentIndex].setSpeedFactor(speedFactor);
            //}
        }

        function handleController(runtimeTrackOptions, controlData, value, usesSoloTrack, usesOtherTracks)
        {
            console.log("monoInput.handleController() has not yet been written.");
            throw "Not yet implemented.";

            //var
            //i,
            //nTracks = allSequences[0].tracks.length,
            //now = performance.now(),
            //trackMoments, nMoments, moment, track;

            //// Returns a new array of (synchronous) trackMoments.
            //// Each trackMoment.moment is a Moment whose .messages attribute contains one message,
            //// trackMoment.trackIndex is the moment's track index (=channel).
            //function getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks)
            //{
            //    var
            //    i, trackMoments = [], trackMoment,
            //    livePerformersTrackIndex = runtimeTrackOptions.livePerformersTrackIndex;

            //    // returns null if no new trackMoment is created.
            //    function newTrackMoment(runtimeTrackOptions, controlData, trackIndex, value)
            //    {
            //        var message, moment = null, trackMoment = null;

            //        // runtimeTrackOptions is a pointer to the runtimeTrackOptions attribute of the global options object.
            //        // The runtimeTrackOptions has the following attributes:
            //        //      trackMinVolumes -- an array of integers in the range 0..127, one value per track.
            //        //      trackScales -- an array of floats in the range 0.0..1.0, one value per track.
            //        // controlData is the controlData received from the live performer (via the controlSelector pop-ups).
            //        // value is the control value received from the live performer.
            //        // trackIndex is the new message's trackIndex (is used to index the arrays in runtimeTrackOptions).
            //        // Returns null if no message is created for some reason.
            //        function newControlMessage(runtimeTrackOptions, controlData, value, trackIndex)
            //        {
            //            var
            //            COMMAND = _AP.constants.COMMAND,
            //            message = null,
            //            minVolume, scale;

            //            if(controlData.midiControl !== undefined) // a normal control
            //            {
            //                if(controlData.midiControl === _AP.constants.CONTROL.VOLUME)
            //                {
            //                    minVolume = runtimeTrackOptions.minVolumes[trackIndex];
            //                    scale = runtimeTrackOptions.scales[trackIndex];
            //                    value = Math.floor(minVolume + (value * scale));
            //                }
            //                // for other controls, value is unchanged
            //                message = new Message(COMMAND.CONTROL_CHANGE + trackIndex, controlData.midiControl, value);
            //            }
            //            else if(controlData.command !== undefined)
            //            {
            //                switch(controlData.command)
            //                {
            //                    case COMMAND.AFTERTOUCH:
            //                        if(currentLivePerformersKeyPitch >= 0)  // is -1 when no note is playing
            //                        {
            //                            message = new Message(COMMAND.AFTERTOUCH + trackIndex, currentLivePerformersKeyPitch, value);
            //                        }
            //                        break;
            //                    case COMMAND.CHANNEL_PRESSURE:
            //                        message = new Message(COMMAND.CHANNEL_PRESSURE + trackIndex, value, 0);
            //                        break;
            //                    case COMMAND.PITCH_WHEEL:
            //                        // value is inputEvent.data[2]
            //                        message = new Message(COMMAND.PITCH_WHEEL + trackIndex, 0, value);
            //                        break;
            //                    default:
            //                        break;
            //                }
            //            }

            //            return message;
            //        }

            //        message = newControlMessage(runtimeTrackOptions, controlData, value, trackIndex);
            //        if(message !== null)
            //        {
            //            moment = new Moment(_AP.moment.UNDEFINED_TIMESTAMP);  // moment.msPositionInScore becomes UNDEFINED_TIMESTAMP
            //            moment.messages.push(message);
            //            trackMoment = {};
            //            trackMoment.moment = moment;
            //            trackMoment.trackIndex = trackIndex;
            //        }
            //        return trackMoment;
            //    }

            //    if(usesSoloTrack && usesOtherTracks)
            //    {
            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            if(trackIsOnArray[i])
            //            {
            //                trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
            //                if(trackMoment !== null)
            //                {
            //                    trackMoments.push(trackMoment);
            //                }
            //            }
            //        }
            //    }
            //    else if(usesSoloTrack)
            //    {
            //        trackMoment = newTrackMoment(runtimeTrackOptions, controlData, livePerformersTrackIndex, value);
            //        if(trackMoment !== null)
            //        {
            //            trackMoments.push(trackMoment);
            //        }
            //    }
            //    else if(usesOtherTracks)
            //    {
            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            if(trackIsOnArray[i] && i !== livePerformersTrackIndex)
            //            {
            //                trackMoment = newTrackMoment(runtimeTrackOptions, controlData, i, value);
            //                if(trackMoment !== null)
            //                {
            //                    trackMoments.push(trackMoment);
            //                }
            //            }
            //        }
            //    }
            //    else
            //    {
            //        throw "Either usesSoloTrack or usesOtherTracks must be set here.";
            //    }

            //    return trackMoments;
            //}

            //trackMoments = getTrackMoments(runtimeTrackOptions, nTracks, controlData, value, usesSoloTrack, usesOtherTracks);
            //nMoments = trackMoments.length;
            //for(i = 0; i < nMoments; ++i)
            //{
            //    track = recordingSequence.tracks[trackMoments[i].trackIndex];

            //    if(track.isInChord !== undefined) // track.isInChord is defined in track.addLiveScoreMoment()
            //    {
            //        moment = trackMoments[i].moment;
            //        if(recordingSequence !== undefined && recordingSequence !== null)
            //        {
            //            moment.timestamp = now;
            //            track.addLivePerformersControlMoment(moment);
            //        }

            //        outputDevice.send(moment.messages[0].data, now);
            //    }
            //}
        }

        function silentlyCompleteCurrentlyPlayingSequence()
        {
            throw "Not yet implemented.";

            //// currentIndex is the index of the currently playing sequence
            //// (which should be silently completed when a noteOn arrives).
            //if(currentIndex >= 0 && currentIndex < performedSequences.length)
            //{
            //    performedSequences[currentIndex].finishSilently();
            //}
        }

        // Each performedSequence calls this function (with two arguments) when
        // it stops:
        //      reportEndOfSequence(recordingSequence, performanceMsDuration);
        // but those arguments are ignored here. The recording continues until
        // the end of the performance, and performanceMsDuration is the duration
        // set by the beginning of the following performedSequence.
        // These values are passed back to the calling environment, when the
        // assistant stops, using the callback:
        //      reportEndOfPerformance(recordingSequence, performanceMsDuration);
        function reportEndOfSequence()
        {
            throw "Not yet implemented.";

            //if(endOfPerformance)
            //{
            //    stop();
            //}
            //else
            //{
            //    reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            //}
        }

        function playSequence(sequence)
        {
            throw "Not yet implemented.";
            //// The durations will be related to the moment.msPositionReSubsequence attrbutes (which have been
            //// set relative to the start of each subsequence), and to speedFactorObject argument.
            //sequence.play(outputDevice, 0, Number.MAX_VALUE, trackIsOnArray, recordingSequence, reportEndOfSequence, reportMsPosition);
        }

        function handleNoteOff(inputEvent)
        {
            throw "Not yet implemented.";
            //if(inputEvent.data[1] === currentLivePerformersKeyPitch)
            //{
            //    currentLivePerformersKeyPitch = -1;

            //    silentlyCompleteCurrentlyPlayingSequence();

            //    if(endOfPerformance) // see reportEndOfPerformance() above 
            //    {
            //        stop();
            //    }
            //    else if(performedSequences[nextIndex].restSequence !== undefined) // only play the next sequence if it is a restSequence
            //    {
            //        currentIndex = nextIndex++;
            //        endOfPerformance = (currentIndex === endIndex);
            //        sequenceStartNow = inputEvent.receivedTime;
            //        playSequence(performedSequences[currentIndex]);
            //    }
            //    else if(nextIndex <= endIndex)
            //    {
            //        endOfPerformance = (nextIndex === endIndex);
            //        reportMsPosition(performedSequences[nextIndex].msPositionInScore);
            //    }
            //}
        }

        function handleNoteOn(inputEvent, overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
        {
            throw "Not yet implemented.";
            //var
            //allSubsequences = performedSequences;

            //// Shifts the pitches in the subsequence up or down so that the lowest pitch in the
            //// first noteOn moment is newPitch. Similarly with velocity.
            //function overridePitchAndOrVelocity(allSubsequences, currentSubsequenceIndex, soloTrackIndex, newPitch, newVelocity,
            //    overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            //{
            //    var
            //    subsequence = allSubsequences[currentSubsequenceIndex],
            //    NOTE_ON_COMMAND = _AP.constants.COMMAND.NOTE_ON,
            //    NOTE_OFF_COMMAND = _AP.constants.COMMAND.NOTE_OFF,
            //    track = subsequence.tracks[soloTrackIndex], message, lowestNoteOnEvt, pitchDelta, velocityDelta,
            //    hangingScorePitchesPerTrack;

            //    // Returns the lowest NoteOn message in the first moment in the track to contain a NoteOnMessage.
            //    // Returns null if there is no such message.
            //    function findLowestNoteOnEvt(NOTE_ON_COMMAND, track)
            //    {
            //        var i, j, message, moment, nEvents, nMoments = track.moments.length, lowestNoteOnMessage = null;

            //        for(i = 0; i < nMoments; ++i)
            //        {
            //            moment = track.moments[i];
            //            nEvents = moment.messages.length;
            //            for(j = 0; j < nEvents; ++j)
            //            {
            //                message = moment.messages[j];
            //                if((message.command() === NOTE_ON_COMMAND)
            //                && (lowestNoteOnMessage === null || message.data[1] < lowestNoteOnMessage.data[1]))
            //                {
            //                    lowestNoteOnMessage = message;
            //                }
            //            }
            //            if(lowestNoteOnMessage !== null)
            //            {
            //                break;
            //            }
            //        }
            //        return lowestNoteOnMessage;
            //    }

            //    function midiValue(value)
            //    {
            //        var result = (value >= 0) ? value : 0;
            //        result = (value <= 127) ? value : 127;
            //        return result;
            //    }

            //    // Adjusts the noteOn and noteOff messages inside this subsequence
            //    // Either returns an array of arrays, or null.
            //    // The returned array[track] is an array containing the score pitches which have not been turned off in each track.
            //    // null is returned if all the pitches which are turned on inside the subsequence are also turned off inside the subsequence.
            //    function adjustTracks(NOTE_ON_COMMAND, NOTE_OFF_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
            //        overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity)
            //    {
            //        var nTracks = subsequence.tracks.length, i, j, k, nMoments, moment, nEvents, index, nPitches,
            //            pendingScorePitchesPerTrack = [], returnPendingScorePitchesPerTrack = [], pendingPitches = false;

            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            pendingScorePitchesPerTrack.push([]);

            //            if((i === soloTrackIndex && (overrideSoloPitch || overrideSoloVelocity))
            //            || (i !== soloTrackIndex && (overrideOtherTracksPitch || overrideOtherTracksVelocity)))
            //            {
            //                track = subsequence.tracks[i];
            //                nMoments = track.moments.length;

            //                for(j = 0; j < nMoments; ++j)
            //                {
            //                    moment = track.moments[j];
            //                    nEvents = moment.messages.length;
            //                    for(k = 0; k < nEvents; ++k)
            //                    {
            //                        message = moment.messages[k];
            //                        if(message.command() === NOTE_ON_COMMAND)
            //                        {
            //                            index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
            //                            if(index === -1)
            //                            {
            //                                pendingScorePitchesPerTrack[i].push(message.data[1]);
            //                            }

            //                            message.data[1] = midiValue(message.data[1] + pitchDelta);
            //                            message.data[2] = midiValue(message.data[2] + velocityDelta);
            //                        }
            //                        if(message.command() === NOTE_OFF_COMMAND)
            //                        {
            //                            index = pendingScorePitchesPerTrack[i].indexOf(message.data[1]);
            //                            if(index !== -1) // ignore noteOffs which are not related to noteOns in this subsequence.
            //                            {
            //                                delete pendingScorePitchesPerTrack[i][index];
            //                                message.data[1] = midiValue(message.data[1] + pitchDelta);
            //                            }
            //                        }
            //                    }
            //                }
            //            }
            //        }

            //        for(i = 0; i < nTracks; ++i)
            //        {
            //            returnPendingScorePitchesPerTrack.push([]);
            //            nPitches = pendingScorePitchesPerTrack[i].length;
            //            for(j = 0; j < nPitches; j++)
            //            {
            //                if(pendingScorePitchesPerTrack[i][j] !== undefined)
            //                {
            //                    pendingPitches = true;
            //                    returnPendingScorePitchesPerTrack[i].push(pendingScorePitchesPerTrack[i][j]);
            //                }
            //            }
            //        }
            //        if(pendingPitches === false)
            //        {
            //            returnPendingScorePitchesPerTrack = null;
            //        }

            //        return returnPendingScorePitchesPerTrack;
            //    }

            //    // In each following subsequence and track, looks for the first noteOff corresponding to a hanging note, and adds pitchDelta to its pitch.
            //    function adjustSubsequentNoteOffs(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack)
            //    {
            //        var trackIndex, nTracks = hangingScorePitchesPerTrack.length, hangingPitches,
            //            i, nHangingPitches, hangingPitch, nextNoteOffMessage;

            //        // returns the first noteOff message corresponding to the hanging Pitch in any of the following subsequences.
            //        function findNextNoteOffMessage(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch)
            //        {
            //            var
            //            nextSubsequenceIndex = currentSubsequenceIndex + 1,
            //            i, nSubsequences = allSubsequences.length, track,
            //            j, nMoments, moment,
            //            k, nMessages, message, returnMessage = null;

            //            for(i = nextSubsequenceIndex; i < nSubsequences; ++i)
            //            {
            //                track = allSubsequences[i].tracks[trackIndex];
            //                nMoments = track.moments.length;
            //                for(j = 0; j < nMoments; ++j)
            //                {
            //                    moment = track.moments[j];
            //                    nMessages = moment.messages.length;
            //                    for(k = 0; k < nMessages; ++k)
            //                    {
            //                        message = moment.messages[k];
            //                        if(message.data[1] === hangingPitch)
            //                        {
            //                            if(message.command() === NOTE_OFF_COMMAND)
            //                            {
            //                                returnMessage = message;
            //                                break;
            //                            }
            //                        }
            //                    }
            //                    if(returnMessage !== null)
            //                    {
            //                        break;
            //                    }
            //                }
            //                if(returnMessage !== null)
            //                {
            //                    break;
            //                }
            //            }
            //            return returnMessage;
            //        }

            //        for(trackIndex = 0; trackIndex < nTracks; trackIndex++)
            //        {
            //            hangingPitches = hangingScorePitchesPerTrack[trackIndex];
            //            nHangingPitches = hangingPitches.length;
            //            for(i = 0; i < nHangingPitches; i++)
            //            {
            //                hangingPitch = hangingPitches[i];
            //                nextNoteOffMessage = findNextNoteOffMessage(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, trackIndex, hangingPitch);
            //                if(nextNoteOffMessage !== null)
            //                {
            //                    nextNoteOffMessage.data[1] = hangingPitch + pitchDelta;
            //                }
            //            }
            //        }

            //    }

            //    lowestNoteOnEvt = findLowestNoteOnEvt(NOTE_ON_COMMAND, track);
            //    if(lowestNoteOnEvt !== null)
            //    {
            //        pitchDelta = (overrideSoloPitch || overrideOtherTracksPitch) ? (newPitch - lowestNoteOnEvt.data[1]) : 0;
            //        velocityDelta = (overrideSoloVelocity || overrideOtherTracksVelocity) ? (newVelocity - lowestNoteOnEvt.data[2]) : 0;

            //        if(pitchDelta !== 0 || velocityDelta !== 0)
            //        {
            //            hangingScorePitchesPerTrack =
            //                adjustTracks(NOTE_ON_COMMAND, NOTE_OFF_COMMAND, soloTrackIndex, pitchDelta, velocityDelta,
            //                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);

            //            if(hangingScorePitchesPerTrack !== null)
            //            {
            //                adjustSubsequentNoteOffs(NOTE_OFF_COMMAND, allSubsequences, currentSubsequenceIndex, pitchDelta, hangingScorePitchesPerTrack);
            //            }
            //        }
            //    }
            //}

            //function setSpeed(inputEventData)
            //{
            //    if(performersSpeedOptions.controllerIndex === 1)
            //    {
            //        setSpeedFactor(1, inputEventData[1]);
            //    }
            //    else if(performersSpeedOptions.controllerIndex === 2)
            //    {
            //        setSpeedFactor(2, inputEventData[2]);
            //    }
            //}

            ////console.log("NoteOn, pitch:", inputEvent.data[1].toString(), " velocity:", inputEvent.data[2].toString());

            //sequenceStartNow = inputEvent.receivedTime;

            //currentLivePerformersKeyPitch = inputEvent.data[1];

            //if(currentIndex === (performedSequences.length - 1))
            //{
            //    // If the final sequence is playing and a noteOn is received, the performance stops immediately.
            //    // In this case the final sequence must be a restSequence (otherwise a noteOn can't be received).
            //    stop();
            //}
            //else if(inputEvent.data[2] > 0)
            //{
            //    silentlyCompleteCurrentlyPlayingSequence();

            //    if(nextIndex === 0)
            //    {
            //        performanceStartNow = sequenceStartNow;
            //    }

            //    if(nextIndex === 0 || (nextIndex <= endIndex && allSubsequences[nextIndex].chordSequence !== undefined))
            //    {
            //        currentIndex = nextIndex++;
            //        endOfPerformance = (currentIndex === endIndex);

            //        if(overrideSoloPitch || overrideOtherTracksPitch || overrideSoloVelocity || overrideOtherTracksVelocity)
            //        {
            //            overridePitchAndOrVelocity(allSubsequences, currentIndex, options.livePerformersTrackIndex,
            //                inputEvent.data[1], inputEvent.data[2],
            //                overrideSoloPitch, overrideOtherTracksPitch, overrideSoloVelocity, overrideOtherTracksVelocity);
            //        }

            //        setSpeed(inputEvent.data);

            //        playSequence(allSubsequences[currentIndex]);
            //    }
            //}
            //else // velocity 0 is "noteOff"
            //{
            //    handleNoteOff(inputEvent);
            //}
        }

        inputEvent = getInputEvent(msg.data, performance.now());

        if(inputEvent.data !== undefined)
        {
            command = inputEvent.command();

            switch(command)
            {
                case COMMAND.CHANNEL_PRESSURE: // produced by both R2M and E-MU XBoard49 when using "aftertouch"
                    inputPressure = (inputEvent.data[1] > options.minimumInputPressure) ? inputEvent.data[1] : options.minimumInputPressure;
                    setSpeedFactor(3, inputEvent.data[1]);
                    //console.log("ChannelPressure, data[1]:", inputEvent.data[1].toString());  // CHANNEL_PRESSURE control has no data[2]
                    if(localOptions.pressureSubstituteControlData !== null)
                    {
                        // CHANNEL_PRESSURE.data[1] is the amount of pressure 0..127.
                        handleController(trackOptions, localOptions.pressureSubstituteControlData, inputPressure,
                                                    localOptions.usesPressureSolo, localOptions.usesPressureOtherTracks);
                    }
                    break;
                case COMMAND.AFTERTOUCH: // produced by the EWI breath controller
                    inputPressure = (inputEvent.data[2] > options.minimumInputPressure) ? inputEvent.data[2] : options.minimumInputPressure;
                    setSpeedFactor(3, inputEvent.data[2]);
                    //console.log("Aftertouch input, key:" + inputEvent.data[1].toString() + " value:", inputEvent.data[2].toString()); 
                    if(localOptions.pressureSubstituteControlData !== null)
                    {
                        // AFTERTOUCH.data[1] is the MIDIpitch to which to apply the aftertouch, but I dont need that
                        // because the current pitch is kept in currentLivePerformersKeyPitch (in the closure).
                        // AFTERTOUCH.data[2] is the amount of pressure 0..127.
                        handleController(trackOptions, localOptions.pressureSubstituteControlData, inputPressure,
                                                    localOptions.usesPressureSolo, localOptions.usesPressureOtherTracks);
                    }
                    break;
                case COMMAND.CONTROL_CHANGE: // sent when the input device's mod wheel changes.
                    if(inputEvent.data[1] === _AP.constants.CONTROL.MODWHEEL)
                    {
                        setSpeedFactor(5, inputEvent.data[2]);
                        // (EWI bite, EMU modulation wheel (CC 1, Coarse Modulation))
                        if(localOptions.modSubstituteControlData !== null)
                        {
                            // inputEvent.data[2] is the value to which to set the changed control
                            handleController(trackOptions, localOptions.modSubstituteControlData, inputEvent.data[2],
                                                        localOptions.usesModSolo, localOptions.usesModOtherTracks);
                        }
                    }
                    break;
                case COMMAND.PITCH_WHEEL: // EWI pitch bend up/down controllers, EMU pitch wheel
                    setSpeedFactor(4, inputEvent.data[2]);
                    //console.log("Pitch Wheel, data[1]:", inputEvent.data[1].toString() + " data[2]:", inputEvent.data[2].toString());
                    // by experiment: inputEvent.data[2] is the "high byte" and has a range 0..127. 
                    if(localOptions.pitchBendSubstituteControlData !== null)
                    {
                        // PITCH_WHEEL.data[1] is the 7-bit LSB (0..127) -- ignored here
                        // PITCH_WHEEL.data[2] is the 7-bit MSB (0..127)
                        handleController(trackOptions, localOptions.pitchBendSubstituteControlData, inputEvent.data[2],
                                                    localOptions.usesPitchBendSolo, localOptions.usesPitchBendOtherTracks);
                    }
                    break;
                case COMMAND.NOTE_ON:
                    if(inputEvent.data[2] !== 0)
                    {
                        // setSpeedFactor is called inside handleNoteOn(...) because currentIndex needs to be >= 0.
                        handleNoteOn(inputEvent,
                            localOptions.overrideSoloPitch, localOptions.overrideOtherTracksPitch,
                            localOptions.overrideSoloVelocity, localOptions.overrideOtherTracksVelocity);
                    }
                    else
                    {
                        handleNoteOff(inputEvent);
                    }
                    break;
                case COMMAND.NOTE_OFF:
                    handleNoteOff(inputEvent);
                    break;
                default:
                    break;
            }
        }
    },

    currentSegmentBounds = function()
    {
        throw "Not yet implemented.";
        //var
        //bounds = {},
        //startIndex = performersMsPositionsInScoreIndex,
        //endIndex = startIndex + 1;

        //if(startIndex < performersMsPositionsInScore.length)
        //{
        //    bounds.msStartPositionInScore = performersMsPositionsInScore[startIndex];
        //}
        //if(endIndex < performersMsPositionsInScore.length)
        //{
        //    bounds.msEndPositionInScore = performersMsPositionsInScore[endIndex];
        //}
        //return bounds;
    },

    nextMoment = function()
    {
        throw "Not yet implemented.";
    },

    // Called from controls.beginRuntime() if this is an assisted performance and performer is monoInput.
    // Sets the internal monoInput.options variable, designed for speed of execution by the event handler. 
    runtimeInit = function(nTracks)
    {
        var i;

        // Sets the options variable from the state of the controls.
        function getOptionsfromDialog(nTracks)
        {
            throw "Not yet implemented.";
        }

        options = getOptionsfromDialog(nTracks);
    },

    // Called from player.play() if this is an assisted performance and performer is monoInput.
    // Arguments:
    //      outputDevice: the midiOutputDevice.
    //      allTracks: all the tracks, complete from the beginning to the end of the piece.
    //      moMsPositionsInScore: a flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    //          The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    //      scorePerformerOptions: the monoInput options retrieved from the score.
    //      usePerformersNextMomentFunction: a callback function that sets the player to use the monoInput's nextMoment function
    //          which is defined in this namespace and uses variables local to this namespace.
    playtimeInit = function(outputDevice, allTracks, moMsPositionsInScore, scorePerformerOptions, usePerformersNextMomentFunction)
    {
        function getPerformersMsPositions(performersTrack, moMsPositionsInScore)
        {
            var
            i,
            startMarkerPosition = moMsPositionsInScore[0],
            endMarkerPosition = moMsPositionsInScore[moMsPositionsInScore.length - 1];

            performersMsPositionsInScore.length = 0;
            for(i = 0; i < performersTrack.length; ++i)
            {
                if(performersTrack[i].msPositionInScore > endMarkerPosition)
                {
                    break;
                }

                if(performersTrack[i].msPositionInScore >= startMarkerPosition)
                {
                    performersMsPositionsInScore.push(performersTrack[i].msPositionInScore);
                }
            }

            if((performersMsPositionsInScore[0] !== moMsPositionsInScore[0])
            || (performersMsPositionsInScore[performersMsPositionsInScore.length - 1] !== moMsPositionsInScore[moMsPositionsInScore.length - 1]))
            {
                throw "Error constructing performersMsPositionsInScore array.";
            }
        }

        // a flat, ordered array of all msPositions in the performance
        midiObjectMsPositionsInScore = moMsPositionsInScore;

        getPerformersMsPositions(allTracks[scorePerformerOptions.trackIndex], moMsPositionsInScore);

        // set the player to use the above, monoInput.nextMoment() function
        usePerformersNextMomentFunction(nextMoment);

        performanceStartTime = performance.now();
        startTimeAdjustedForPauses = performanceStartTime;
    },

    publicAPI =
    {
        hidden: hidden,
        setControlsFromString: setControlsFromString,
        setDefaultControls: setDefaultControls,
        trackSelect: trackSelect, // function that returns the track selector element
        doControl: doControl,

        // ********* runtime ************
        // called in Controls.js.beginRuntime().

        // Sets the local 'options' variable -- which is constant for all performances.
        // The options variable is designed to optimize the use
        // of the options (set in the dialog) during performances.
        runtimeInit: runtimeInit,

        // Takes account of startMarker and endMarker positions etc.
        playtimeInit: playtimeInit, // called in player.play()
        handleMIDIInputEvent: handleMIDIInputEvent
    };
    // end var

    return publicAPI;

}(document));
