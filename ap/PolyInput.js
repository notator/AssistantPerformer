
/********************************************************************
*
*  ACHTUNG: This file is just a stub.
*  The functions (and special performance options) need completing.
*
********************************************************************/

/*
*  copyright 2014 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/PolyInput.js
*  The _AP.polyInput namespace which defines
*
*    // initialization
*    init(player, score.performerOptions)
*
*    //  returns an object contining the start and end positions of the player's current segment
*    currentSegmentBounds()
*
*    // message handler for input devices
*    handleMIDIInputEvent(msg)   
*/

/*jslint bitwise: true, nomen: true, plusplus: true, white: true */

_AP.namespace('_AP.polyInput');

_AP.polyInput = (function()
{
    "use strict";

    // begin var
    var

    options = {},
    /***********************
    midiOutputDevice,

    tracks, // sequence.tracks. All the tracks, complete from the beginning to the end of the piece.
    performersOptions, // retrieved from the score

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
    ***********************/

   hidden = function(isHidden)
   {
       var optionsDiv = document.getElementById("polyPerformersOptions");

       if(isHidden === false)
       {
           optionsDiv.style.display = "normal";
       }
       else
       {
           optionsDiv.style.display = "none";
       }
   },

    // If disabled === true, disable all controls, else enable the controls that should be enabled.
    setDisabled = function(disabled)
    {
        throw "Not yet implemented (see monoInput).";
    },

        // Gets all the controls in monoInput html, disables them all, and
    // sets them to the default values they have when no score is selected.
    initControls = function(nTracks)
    {
        throw "Not yet implemented (see monoInput).";
    },

    // Sets the monoInput dialog from the mPerformerOptionsString in the score's .mkss file.
    // The values of the controls will be used by the event handler. 
    setControlsFromString = function(mPerformerOptionsString, nTracks)
    {
        throw "Not yet implemented (see monoInput).";
    },

    // Sets the controls to the state they have when a score
    // is loaded but has no performance options.
    setDefaultControls = function(nTracks)
    {
        throw "Not yet implemented (see monoInput).";
    },


    /******************* runtime ********************************/


    doControl = function(controlID)
    {
        console.log("polyInput.setTrackSelector has not yet been written.");
        throw "Not yet implemented.";
    },
        // removes existing mo.trackSelector.ChildNodes
    // adds nTracks new child nodes
    // enables mo.trackSelector
    // Selects assistantsTrackIndex if it is defined.
    setTrackSelector = function(nTracks, assistantsTrackIndex)
    {
        console.log("polyInput.setTrackSelector has not yet been written.");
        throw "Not yet implemented.";
        //var i, optionElem, textElem, sibling,
        //firstChildNode;

        //if(mo.trackSelector.childNodes.length > 0)
        //{
        //    firstChildNode = mo.trackSelector.childNodes[0];
        //    sibling = firstChildNode.nextSibling;
        //    while(sibling !== null)
        //    {
        //        mo.trackSelector.removeChild(sibling);
        //        sibling = firstChildNode.nextSibling;
        //    }
        //    mo.trackSelector.removeChild(firstChildNode);
        //}
        //for(i = 0; i < nTracks; ++i)
        //{
        //    optionElem = document.createElement("option");
        //    textElem = document.createTextNode((i + 1).toString());
        //    optionElem.appendChild(textElem);
        //    mo.trackSelector.appendChild(optionElem);
        //}
        //if(assistantsTrackIndex !== undefined)
        //{
        //    mo.trackSelector.selectedIndex = assistantsTrackIndex;
        //}
    },

    // Sets the states of the options to the states they have when no score is selected.
    // This function is called by both init() and setDefaultRuntimeOptions() below.
    setDefaultOptions = function()
    {
        console.log("polyInput.setDefaultOptions has not yet been written.");
        throw "Not yet implemented.";
        /*******************
        controlIDs are:
            mpoTrackSelect

            mpoNoteOnPitchTrackSelect
            mpoNOPCheckBoxTrack1 // 1..16

            mpoNoteOnVelocityTrackSelect
            mpoNOVCheckBoxTrack1 // 1..16

            mpoPressureMidiSelect
            mpoPressureTrackSelect
            mpoPressureCheckBoxTrack1 // 1..16

            mpoPitchWheelMidiSelect
            mpoPitchWheelTrackSelect
            mpoPitchWheelCheckBoxTrack1 // 1..16

            mpoModWheelMidiSelect
            mpoModWheelTrackSelect
            mpoModWheelCheckBoxTrack1 // 1..16

            mpoSpeedControllerSelect
            mpoMaxSpeedInput // number
            mpoMinVolumeInput // number        
        
        old-----------------------------------------------------
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

        mo.globalSpeedInput.selectedIndex = 0;
        mo.speedControllerMaxSpeedInputText.value = 2;

        mo.minimumPressureInputText.value = 64;  // default value. Only used in assisted performances.
        ***/
    },

    // Sets the options dialog from the performerOptionsString in the .mkss file.
    // Also sets the options object (defined above) which will be used by the event handler.
    setControlsFromString = function(pPerfOptsString)
    {
        console.log("polyInput.setControlsFromString has not yet been written.");
        throw "Not yet implemented.";
    },

    // This is where input MIDIEvents arrive, and where processing is going to be done.
    // Both RealTime and SysEx messages are ignored.
    // it is assumed that RealTime messages will not interrupt the messages being received.
    //
    // This function treats each received input key (NoteOn/NoteOff) in its own right.
    // Can work like a prepared piano. There may be options that decide that. Needs thinking about.
    handleMIDIInputEvent = function(msg)
    {   
        console.log("polyInput.handleMIDIInputEvent(msg) has not yet been written.");
        throw "Not yet implemented.";
    },

    currentSegmentBounds = function()
    {
        console.log("polyInput.currentSegmentBounds() has not yet been written.");
        throw "Not yet implemented.";
    },

    nextMoment = function()
    {
        console.log("polyInput.nextMoment() has not yet been written.");
        throw "Not yet implemented.";
    },

    init = function()
    {
        function getOptionElements()
        {
            console.log("polyInput.init().getOptionElements() has not yet been written.");
            /************* old ******************/
            //mo.titleOptionsDiv = document.getElementById("titleOptionsDiv");
            //mo.controlPanel = document.getElementById("svgRuntimeControls");
            //mo.svgPages = document.getElementById("svgPages");

            //mo.inputDeviceSelect = document.getElementById("inputDeviceSelect");
            //mo.scoreSelector = document.getElementById("scoreSelector");
            //mo.outputDeviceSelect = document.getElementById("outputDeviceSelect");

            //mo.speedPercentInputText = document.getElementById("speedPercentInputText");

            //mo.trackSelector = document.getElementById("trackSelector");

            //mo.soloVelocityOptionCheckbox = document.getElementById("soloVelocityOptionCheckbox");
            //mo.otherTracksVelocityOptionCheckbox = document.getElementById("otherTracksVelocityOptionCheckbox");
            //mo.soloPitchOptionCheckbox = document.getElementById("soloPitchOptionCheckbox");
            //mo.otherTracksPitchOptionCheckbox = document.getElementById("otherTracksPitchOptionCheckbox");

            //mo.usesPressureSoloCheckbox = document.getElementById("usesPressureSoloCheckbox");
            //mo.usesPressureOtherTracksCheckbox = document.getElementById("usesPressureOtherTracksCheckbox");
            //mo.pressureSubstituteControlDataSelector = document.getElementById("pressureSubstituteControlDataSelector");

            //mo.usesModSoloCheckbox = document.getElementById("usesModSoloCheckbox");
            //mo.usesModOtherTracksCheckbox = document.getElementById("usesModOtherTracksCheckbox");
            //mo.modSustituteControlSelector = document.getElementById("modSustituteControlSelector");

            //mo.usesPitchBendSoloCheckbox = document.getElementById("usesPitchBendSoloCheckbox");
            //mo.usesPitchBendOtherTracksCheckbox = document.getElementById("usesPitchBendOtherTracksCheckbox");
            //mo.pitchBendSubstituteControlDataSelector = document.getElementById("pitchBendSubstituteControlDataSelector");

            //mo.globalSpeedInput = document.getElementById("globalSpeedInput");
            //mo.speedControllerMaxSpeedDiv = document.getElementById("speedControllerMaxSpeedDiv");
            //mo.speedControllerMaxSpeedInputText = document.getElementById("speedControllerMaxSpeedInputText");

            //mo.minimumPressureDiv = document.getElementById("minimumPressureDiv");
            //mo.minimumPressureInputText = document.getElementById("minimumPressureInputText");

            //mo.startRuntimeButton = document.getElementById("startRuntimeButton");
        }

        getOptionElements();
        setDefaultOptions();
        hidden(false);
    },

    // runtimeInit() is called from player.play() if options.livePerformance is true, and
    // options.performerOptions.inputDeviceType === 'polyInput'. 
    // Arguments:
    //      outputDevice: the midiOutputDevice.
    //      allTracks: all the tracks, complete from the beginning to the end of the piece.
    //      moMsPositionsInScore: a flat, ordered array containing all the unique msPositions of midiObjects in the performance.
    //          The first value in this array is the position of the startMarker, the last value is the position of the endMarker.
    //      scorePerformerOptions: the polyInput options retrieved from the score.
    //      usePerformersNextMomentFunction: a callback function that sets the player to use the polyInput's nextMoment function
    //          which is defined in this namespace and uses variables local to this namespace.
    runtimeInit = function(outputDevice, allTracks, moMsPositionsInScore, scorePerformerOptions, usePerformersNextMomentFunction)
    {
        console.log("polyInput.runtimeInit() has not yet been written.");
        throw "Not yet implemented.";
    },

    publicAPI =
    {
        hidden: hidden,
        setDisabled: setDisabled,
        setControlsFromString: setControlsFromString,
        setDefaultControls: setDefaultControls,
        doControl: doControl,

        // ********* runtime ************

        runtimeInit: runtimeInit,
        handleMIDIInputEvent: handleMIDIInputEvent,
    };
    // end var

    return publicAPI;

}());
