/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/MonoInputDialog.js
*  The _AP.performersOptionsDialog namespace which defines the following interface:
* 
*     // hides or shows the performersOptionsDialog
*     function hidden(isHidden);
*
*     // Sets the monoInput dialog from the mPerformerOptionsString in the score's .mkss file.
*     // The values of the controls will be used by the event handler. 
*     loadControlsFromString(mPerformerOptionsString, nTracks);
*
*     // Sets the dialog to the state it has when a score is loaded but has no performance options.
*     setDefaultControls(nTracks);
*
*     // Returns the track index currently set in the track select element (=trackSelect.selectedIndex)
*     trackIndex: trackIndex,
*
*     // Handles local interaction with the dialog. 
*     doControl: doControl,
*
*     // ********* runtime ************
*     // called by Controls.js.beginRuntime().
*     // Gets the local 'options' from the dialog then calls _AP.MonoInputHandler.Init(options).
*     // Returns undefined if there are errors in the values in this dialog.
*     getPerformersOptions: getPerformersOptions,  
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.performersOptionsDialog');

_AP.performersOptionsDialog = (function()
{
    "use strict";

    // begin var
    var
    U = _AP.utilities,
    COMMAND = _AP.constants.COMMAND,
    CONTROL = _AP.constants.CONTROL,
    tracksControl = _AP.tracksControl, // The SVG tracksControl at the top of the score.

    controls = {}, // the control elements in the performersOptions div in assistantPerformer.html

    hidden = function(isHidden)
    {
        var optionsDiv = document.getElementById("performersOptions");

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

    setDisplayForPerformer = function(trackIndex)
    {
        controls.trackSelect.selectedIndex = trackIndex;
        controls.controllerTrackNumberLabels.SetDisplayForPerformersTrack(controls.controllerTrackNumberLabels, trackIndex);
        controls.pressureCheckBoxDivs.SetDisplayForPerformersTrack(controls.pressureCheckBoxDivs, trackIndex);
        controls.pitchWheelCheckBoxDivs.SetDisplayForPerformersTrack(controls.pitchWheelCheckBoxDivs, trackIndex);
        controls.modWheelCheckBoxDivs.SetDisplayForPerformersTrack(controls.modWheelCheckBoxDivs, trackIndex);
        controls.masterVolumeDivs.SetDisplayForPerformersTrack(controls.masterVolumeDivs, trackIndex);

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

    // Gets all the controls in the peformersOptions html, disables them all, and
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

            function setDivsBorderStyle(divs, trackIndex, performersBorderStyle)
            {
                var i;

                for(i = 0; i < 16; ++i)
                {
                    divs[i].style.borderStyle = performersBorderStyle;
                }

                for(i = 0; i < 16; ++i)
                {
                    if(i === trackIndex)
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
            function setOrRemoveBoxBorder(divs, trackIndex)
            {
                setDivsBorderStyle(divs, trackIndex, "solid solid solid solid");
            }
            function setOrRemoveCapBorder(divs, trackIndex)
            {
                setDivsBorderStyle(divs, trackIndex, "solid solid none solid");
            }
            function setOrRemoveSidesBorder(divs, trackIndex)
            {
                setDivsBorderStyle(divs, trackIndex, "none solid none solid");
            }
            function setOrRemoveCupBorder(divs, trackIndex)
            {
                setDivsBorderStyle(divs, trackIndex, "none solid solid solid");            
            }

            // row 0
            controls.trackSelect = document.getElementById("poPerformersTrackSelect");
            controls.eventHandlerSelect = document.getElementById("poEventHandlerSelect"); // number

            // row 1 was labels           
            // row 2 was noteOnPitch
            // row 3 was noteOnVelocity

            // row 4
            controls.controllerTrackNumberLabels = get16Elements("poControllerTrackNumber"); // 16 labels
            controls.controllerTrackNumberLabels.SetDisplayForPerformersTrack = setOrRemoveCapBorder; // takes a trackNumber argument

            // row 5
            controls.pressureMidiSelect = document.getElementById("poPressureMidiSelect");
            controls.pressureTrackSelect = document.getElementById("poPressureTrackSelect");
            controls.pressureCheckBoxDivs = get16Elements("poPressureCheckBoxDiv"); // 16 check box divs
            controls.pressureCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveSidesBorder; // takes a trackIndex argument
            controls.pressureCheckBoxes = get16Elements("poPressureCheckBoxTrack"); // 16 check boxes

            // row 6
            controls.pitchWheelMidiSelect = document.getElementById("poPitchWheelMidiSelect");
            controls.pitchWheelTrackSelect = document.getElementById("poPitchWheelTrackSelect");
            controls.pitchWheelCheckBoxDivs = get16Elements("poPitchWheelCheckBoxDiv"); // 16 check box divs
            controls.pitchWheelCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveSidesBorder; // takes a trackIndex argument
            controls.pitchWheelCheckBoxes = get16Elements("poPitchWheelCheckBoxTrack"); // 16 check boxes

            // row 7
            controls.modWheelMidiSelect = document.getElementById("poModWheelMidiSelect");
            controls.modWheelTrackSelect = document.getElementById("poModWheelTrackSelect");
            controls.modWheelCheckBoxDivs = get16Elements("poModWheelCheckBoxDiv"); // 16 check box divs
            controls.modWheelCheckBoxDivs.SetDisplayForPerformersTrack = setOrRemoveCupBorder; // takes a trackIndex argument
            controls.modWheelCheckBoxes = get16Elements("poModWheelCheckBoxTrack"); // 16 check boxes

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

            controls.minVolumeInput = document.getElementById("poMinVolumeInput"); // number

            // row 9 just labels
            // row 10
            controls.masterVolumeDivs = get16Elements("poMasterVolume"); // 16 divs
            controls.masterVolumeDivs.SetDisplayForPerformersTrack = setOrRemoveBoxBorder; // takes a trackNumber argument
            controls.masterVolumeInputs = get16Elements("poMasterVolumeInput"); // 16 inputs

            // row 11
            controls.speedControllerSelect = document.getElementById("poSpeedControllerSelect");

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
            controls.maxSpeedInput = document.getElementById("poMaxSpeedInput"); // number

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
                    for(i = trackSelect.length - 1; i >= 0; --i)
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
            controls.eventHandlerSelect.selectedIndex = 0; // none
            controls.eventHandlerSelect.disabled = true;

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

        // The number of tracks in the score is always controls.trackSelect.length
        // When there is no score, there are no tracks!
        function setTrackSelect(nTracks)
        {
            var
            j, optionElem,
            ts = controls.trackSelect;

            for(j = ts.length - 1; j >= 0; --j)
            {
                ts.remove(j);
            }

            if(nTracks > 0)
            {
                for(j = 1; j <= nTracks; ++j)
                {
                    optionElem = document.createElement("option");
                    optionElem.text = j.toString(10);
                    ts.add(optionElem, null);
                }
            }
        }

        setTrackSelect(nTracks);

        for(i = 0; i < nTracks; ++i)
        {
            controls.controllerTrackNumberLabels[i].disabled = false;
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
        controls.eventHandlerSelect.disabled = false;
        controls.pressureTrackSelect.disabled = false;
        controls.pitchWheelTrackSelect.disabled = false;
        controls.modWheelTrackSelect.disabled = false;
        controls.minVolumeInput.disabled = false;
        controls.speedControllerSelect.disabled = false;
        controls.maxSpeedInput.disabled = false;
        controls.maximumSpeedRowDiv.disabled = false;
    },

    // sets one of the following options in the trackCBselect from the trackBoolArray and trackIndex
    //      none
    //      all
    //      performer
    //      other
    //      custom
    // Note that checkBoxes.length is always 16.
    setTrackCheckBoxesSelect = function (trackCBSelect, checkBoxes, trackIndex)
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
                if((checkBoxes[i].checked === false && i === trackIndex)
                || (checkBoxes[i].checked === true && i !== trackIndex))
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
                if((checkBoxes[i].checked === true && i === trackIndex)
                || (checkBoxes[i].checked === false && i !== trackIndex))
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

        showOrHideMinimumVolumeRowDiv();
    },

    // sets the controls to the state they have if no performersoptions are defined in the .mkss file. 
    resetControls = function(nTracks)
    {
        initControls();
        enablePerformersControls(nTracks);
    },

    // Sets the controls in the dialog from the performersOptionsString retrieved from the score's .mkss file.
    // The values of the controls will be used by the event handler. 
    loadControlsFromString = function(performersOptionsString, nTracks)
    {
        var str, trackBoolArray, trackIntArray, trackIndex, attrValueString;

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

        function indexOfSelectOption(select, optionStr)
        {
            var i, rval = -1;

            for(i = 0; i < select.options.length; ++i)
            {
                if(select.options[i].text === optionStr)
                {
                    rval = i;
                    break;
                }
            }
            
            if(rval === -1)
            {
                throw "Error: Unknown option.";
            }

            return rval;

        }

        resetControls(nTracks);

        str = attributeValueString(performersOptionsString, "trackIndex=");
        if(str !== null)
        {
            trackIndex = parseInt(str, 10);
            controls.trackSelect.selectedIndex = trackIndex;
        }

        if(trackIndex === undefined)
        {
            throw "track index must be defined!";
        }

        attrValueString = attributeValueString(performersOptionsString, "performersEventHandler=");
        controls.eventHandlerSelect.selectedIndex = indexOfSelectOption(controls.eventHandlerSelect, attrValueString);

        if(performersOptionsString.search("pressureController=") !== -1)
        {
            attrValueString = attributeValueString(performersOptionsString, "pressureController=");
            controls.pressureMidiSelect.selectedIndex = indexOfSelectOption(controls.pressureMidiSelect, attrValueString);
        }

        str = attributeValueString(performersOptionsString, "pressureTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.pressureCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, trackIndex);
            setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
        }

        if(performersOptionsString.search("pitchWheelController=") !== -1)
        {
            attrValueString = attributeValueString(performersOptionsString, "pitchWheelController=");
            controls.pitchWheelMidiSelect.selectedIndex = indexOfSelectOption(controls.pitchWheelMidiSelect, attrValueString);
        }

        str = attributeValueString(performersOptionsString, "pitchWheelTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.pitchWheelCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, trackIndex);
            setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
        }

        if(performersOptionsString.search("modWheelController=") !== -1)
        {
            attrValueString = attributeValueString(performersOptionsString, "modWheelController=");
            controls.modWheelMidiSelect.selectedIndex = indexOfSelectOption(controls.modWheelMidiSelect, attrValueString);
        }

        str = attributeValueString(performersOptionsString, "modWheelTracks=");
        if(str !== null)
        {
            trackBoolArray = stringToTrackBoolArray(str);
            setCheckBoxesFromBoolArray(controls.modWheelCheckBoxes, trackBoolArray);
            setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, trackIndex);
            setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
        }

        str = attributeValueString(performersOptionsString, "minVolume=");
        if(str !== null)
        {
            controls.minVolumeInput.value = parseInt(attributeValueString(performersOptionsString, "minVolume="), 10);
            controls.minimumVolumeRowDiv.show();
        }
        else
        {
            controls.minimumVolumeRowDiv.hide();
        }

        trackIntArray = U.intArrayFromAttribute(nTracks, performersOptionsString, "masterVolumes=", 100);
        setInputsFromIntArray(controls.masterVolumeInputs, trackIntArray);
        checkMasterVolumes(); // sets default colours

        if(performersOptionsString.search("speedController=") !== -1)
        {
            attrValueString = attributeValueString(performersOptionsString, "speedController=");
            controls.speedControllerSelect.selectedIndex = indexOfSelectOption(controls.speedControllerSelect, attrValueString);
        }

        str = attributeValueString(performersOptionsString, "speedMaxPercent=");
        if(str !== null)
        {
            controls.maxSpeedInput.value = parseFloat(attributeValueString(performersOptionsString, "speedMaxPercent="));
            controls.maximumSpeedRowDiv.show();
        }
        else
        {
            controls.maximumSpeedRowDiv.hide();
        }

        setDisplayForPerformer(trackIndex);
    },

    // Sets the controls to the state they have when a score
    // is loaded but has no performance options.
    setDefaultControls = function(nTracks)
    {
        initControls();

        enablePerformersControls(nTracks);

        setDisplayForPerformer(0);
    },

    trackIndex = function()
    {
        return controls.trackSelect.selectedindex;
    },

    doControl = function(controlID)
    {
        var
        trackIndex = controls.trackSelect.selectedIndex;
        
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
                            if(i === trackIndex)
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
                            if(i === trackIndex)
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
                        setTrackCheckBoxesSelect(select, checkBoxes, trackIndex);
                        break;
                }
            }

            switch(tracksSelectID)
            {
                case "poPressureTrackSelect": // okay controls.pressureTrackSelect
                    setCheckBoxRow(controls.pressureTrackSelect, controls.pressureCheckBoxes);
                    setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
                    break;
                case "poPitchWheelTrackSelect": // okay controls.pitchWheelTrackSelect
                    setCheckBoxRow(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes);
                    setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
                    break;
                case "poModWheelTrackSelect":// okay controls.modWheelTrackSelect
                    setCheckBoxRow(controls.modWheelTrackSelect, controls.modWheelCheckBoxes);
                    setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
                    break;
            }
        }

        // handles checkBoxIDs of the form:
        // poPressureCheckBoxTrack1-16 // controls.pressureCheckBoxes[i]
        // poPitchWheelCheckBoxTrack1-16 // controls.pitchWheelCheckBoxes[i]
        // poModWheelCheckBoxTrack1-16 // controls.modWheelCheckBoxes[i]
        // and
        // poMasterVolumeInput1-16 // controls.masterVolumeInputs[i]
        function handleMultiInput(ctlID)
        {
            if(ctlID.search("poPressureCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, trackIndex);
                setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
            }
            else if(ctlID.search("poPitchWheelCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, trackIndex);
                setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
            }
            else if(ctlID.search("poModWheelCheckBoxTrack") === 0)
            {
                setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, trackIndex);
                setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
            }
            else if(ctlID.search("poMasterVolumeInput") === 0)
            {
                checkMasterVolumes();
            }
        }

        /**************************************/

        switch(controlID)
        {
            case "poPerformersTrackSelect": //controls.trackSelect
                setDisplayForPerformer(trackIndex);
                setTrackCheckBoxesSelect(controls.pressureTrackSelect, controls.pressureCheckBoxes, trackIndex);
                setMidiSelect(controls.pressureTrackSelect, controls.pressureMidiSelect);
                setTrackCheckBoxesSelect(controls.pitchWheelTrackSelect, controls.pitchWheelCheckBoxes, trackIndex);
                setMidiSelect(controls.pitchWheelTrackSelect, controls.pitchWheelMidiSelect);
                setTrackCheckBoxesSelect(controls.modWheelTrackSelect, controls.modWheelCheckBoxes, trackIndex);
                setMidiSelect(controls.modWheelTrackSelect, controls.modWheelMidiSelect);
                break;

            case "poPressureMidiSelect": // okay controls.pressureMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break;
            case "poPitchWheelMidiSelect": // okay controls.pitchWheelMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break;
            case "poModWheelMidiSelect": // okay controls.modWheelMidiSelect
                showOrHideMinimumVolumeRowDiv();
                break;

            case "poPressureTrackSelect": // okay controls.pressureTrackSelect
                handleTrackSelect("poPressureTrackSelect");
                break;
            case "poPitchWheelTrackSelect": // okay controls.pitchWheelTrackSelect
                handleTrackSelect("poPitchWheelTrackSelect");
                break;
            case "poModWheelTrackSelect": // okay controls.modWheelTrackSelect
                handleTrackSelect("poModWheelTrackSelect");
                break;

            case "poMinVolumeInput": // okay controls.minVolumeInput
                U.checkIntRange(controls.minVolumeInput, 0, 127);
                break;

            case "poSpeedControllerSelect": // okay controls.speedControllerSelect
                showOrHideMaximumSpeedRowDiv();
                break;

            case "poMaxSpeedInput": // okay controls.maxSpeedInput
                U.checkFloatRange(controls.maxSpeedInput, 100, 800000);
                break;

            default:
                handleMultiInput(controlID); // handles individual checkBox and masterVolume inputs 
                break;
        }
    },

    // This function is called when the "start" button is clicked and the dialog is hidden.
    // It is called by controls.beginRuntime() if this is an assisted performance and performer is monoInput. 
    // Returns undefined if there are errors in the values in the dialog.
    // The returned options object has the following attributes:
    //
    //      nTracks -- the number of tracks in the score
    //      trackIndex -- the performer's trackIndex
    //      midiEventHandler -- the namespace containing the event handler
    //      pressureSubstituteControlData -- undefined or a controlData object (see below)
    //      pressureTracks -- undefined or array of bool, length nTracks
    //      pitchWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      pitchWheelTracks -- undefined or array of bool, length nTracks
    //      modWheelSubstituteControlData -- undefined or a controlData object (see below)
    //      modWheelTracks -- undefined or array of bool, length nTracks
    //      masterVolumes -- array of int, range 0..127, length nTracks
    //      minVolume -- int in range 0..127 (0 by default if volume is not being controlled)
    //      volumeScale -- (127 - options.minVolume) / 127 (see below)
    //      speedControllerName -- undefined, or one of the effective poSpeedControllerSelect option strings (see below)
    //      slowerSpeedRoot -- defined if speedControllerName is defined (see below)
    //      fasterSpeedRoot -- defined if speedControllerName is defined (see below)
    //
    // If the volume is being controlled live, track volumes will be set as follows: 
    //      abstractVolume = options.minVolume + (receivedVolumeValue * volumeScale);
    //      trackVolume =  (trackMasterVolume / 127 ) * abstractVolume).
    //
    // A controlData object is set from the dialog's current controlOptions settings.
    // It has one of the following attributes:
    //      command
    //      midiControl
    // If the controlData object is undefined, then so is the corresponding ...Tracks array.
    //
    // The effective poSpeedControllerSelect option strings are: (see speedController above):
    //      "noteOn: pitch"
    //      "noteOn: velocity"
    //      "pressure"
    //      "pitch wheel"
    //      "modulation wheel"
    // If the speedController is undefined, then so are slowerSpeedRoot and fasterSpeedRoot.
    // The roots are calculated as follows:
    // If the controller's value (cv, in range 0..127) is >= 64, the factor which is passed to tick() will be
    //     factor = fasterSpeedRoot ^ (cv - 64) -- if cv = 64, factor is 1, if cv is 127, factor is maximumSpeedFactor
    // If the controller's value is < 64, the factor which is passed to tick() will be
    //     factor = slowerSpeedRoot ^ (64 - cv) -- if cv = 0, factor will is 1/maximumFactor
    // fasterSpeedRoot is therefore the 63rd root of maximumSpeedFactor, and
    // slowerSpeedRoot is the 63rd root of 1/maximumSpeedFactor.
    getPerformersOptions = function()
    {
        var
            nTracks = controls.trackSelect.length,
            options, okayToRun = true;

        // If there are one or more illegal values in the dialog,
        // This function puts up an alert message and returns false.
        // Otherwise it returns true.
        function checkDialogForIllegalValues(nTracks)
        {
            var i,
                rval = true;

            if(controls.minimumVolumeRowDiv.style.display === "table" // controls.minVolumeInput is visible 
            && controls.minVolumeInput.jiError !== undefined)
                rval = false;

            for(i = 0; i < nTracks; ++i)
            { 
                if(controls.masterVolumeInputs[i].jiError !== undefined)
                {
                    rval = false;
                }
            }

            if(controls.speedControllerSelect.selectedIndex > 0 // controls.minVolumeInput is visible 
            && controls.maxSpeedInput.jiError !== undefined)
                rval = false;

            if(rval === false)
            {
                alert("Cannot start: illegal value in performer's options dialog");
            }

            return rval;
        }

        // Sets the options variable from the state of this dialog.
        // Passes the options to the monoInputHandler.
        function getOptionsfromDialog(nTracks)
        {
            var
            speedMaxFactor,
            handlers = [_AP.mono1, _AP.keyboard1],
            options = {};

            function boolArrayFromCheckBoxes(nTracks, checkBoxes)
            {
                var i, rArray = [];

                for(i = 0; i < nTracks; ++i)
                {
                    rArray.push(checkBoxes[i].checked);
                }

                return rArray;
            }

            function intArrayFromNumberInputs(nTracks, numberInputs)
            {
                var i, rArray = [];
                for(i = 0; i < nTracks; ++i)
                {
                    rArray.push(parseInt(numberInputs[i].value, 10));
                }
                return rArray;
            }

            options.nTracks = nTracks;
            options.trackIndex = controls.trackSelect.selectedIndex;
            options.midiEventHandler = handlers[controls.eventHandlerSelect.selectedIndex];

            if(controls.pressureMidiSelect.selectedIndex > 0)
            {
                options.pressureSubstituteControlData = controlOptions[controls.pressureMidiSelect.selectedIndex];
                options.pressureTracks = boolArrayFromCheckBoxes(nTracks, controls.pressureCheckBoxes);
            }
            if(controls.pitchWheelMidiSelect.selectedIndex > 0)
            {
                options.pitchWheelSubstituteControlData = controlOptions[controls.pitchWheelMidiSelect.selectedIndex];
                options.pitchWheelTracks = boolArrayFromCheckBoxes(nTracks, controls.pitchWheelCheckBoxes);
            }
            if(controls.modWheelMidiSelect.selectedIndex > 0)
            {
                options.modWheelSubstituteControlData = controlOptions[controls.modWheelMidiSelect.selectedIndex];
                options.modWheelTracks = boolArrayFromCheckBoxes(nTracks, controls.modWheelCheckBoxes);
            }

            options.masterVolumes = intArrayFromNumberInputs(nTracks, controls.masterVolumeInputs);

            if(controls.minimumVolumeRowDiv.style.display === "table") // controls.minVolumeInput is visible
            {
                options.minVolume = parseInt(controls.minVolumeInput.value, 10);
            }
            else
            {
                options.minVolume = 0;
            }

            options.volumeScale = (127 - options.minVolume) / 127;

            if(controls.speedControllerSelect.selectedIndex > 0)
            {
                options.speedControllerName = controls.speedControllerSelect.options[controls.speedControllerSelect.selectedIndex].text;
                speedMaxFactor = parseFloat(controls.maxSpeedInput.value) / 100;
                options.fasterSpeedRoot = Math.pow(speedMaxFactor, 1 / 63);
                options.slowerSpeedRoot = Math.pow(1 / speedMaxFactor, 1 / 63);
            }
            
            return options;
        }

        okayToRun = checkDialogForIllegalValues(nTracks)
        if(okayToRun)
        {
            options = getOptionsfromDialog(nTracks);
        }
        return options;
    },

    publicAPI =
    {
        hidden: hidden,
        resetControls: resetControls,
        loadControlsFromString: loadControlsFromString,
        setDefaultControls: setDefaultControls,
        trackIndex: trackIndex, // the current index in the track selector element
        doControl: doControl,

        // ********* runtime ************
        // called by Controls.js.beginRuntime().
        // Gets the local 'options' from the dialog then calls _AP.MonoInputHandler.Init(options).
        // Returns false if there are errors in the values in this dialog.
        getPerformersOptions: getPerformersOptions
    };
    // end var

    return publicAPI;

}(document));
