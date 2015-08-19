/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/InputControls.js
 *  Public interface contains:
 *     InputControls(inputControlsNode) // Chord definition constructor. Reads the XML in the inputControlsNode. 
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.inputControls');

_AP.inputControls = (function ()
{
    "use strict";
    var
    // InputControls constructor: argument can be an inputControls node from a document, or another InputControls object (to be cloned).
    // An InputControls object sets performance options for a Trk, inputNote (=seq), or inputChord (=voice).
    //    trk.InputOptions temporarily override inputNote.InputOptions
    //    inputNote.InputOptions temporarily override inputChord.InputOptions
    //    inputChord.InputOptions change the global InputOptions vor the containing voice.
	//
	// Default options are:
	//    noteOnMsg = "trkOn"
	//    noteOffMsg = "trkOff"
	//    trkOff = "stopNow"
	// All other defaults are undefined.
	//
	// Possible options, and their available values in the constructors argument, are:
	//    noteOnMsg -- "undefined", "trkOn", "trkOff"
	//    noteOffMsg -- "undefined", "trkOn", "trkOff"
    //    trkVel -- possible values: "scaled", "shared", "overridden"
	//    minVelocity -- defined if trkVel is defined. Is in range [1..127].
	//    trkOff -- possible values: "undefined", "stopChord", "stopNow", "fade", "holdAll", "holdLast"   
    //    pressure -- possible values: "aftertouch", "channelPressure", "pitchWheel", "modulation", "volume", "pan"
    //				                   "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
    //    pitchWheel -- possible values: same as pressure
    //    modulation -- possible values: same as pressure
    //    maxVolume -- defined if one of the above controllers is set to "volume". Possible values: 0..127
    //    minVolume -- defined if one of the above controllers is set to "volume". Possible values: 0..127
    //    speedOption -- possible values: "noteOnKey", "noteOnVel", "pressure", "pitchWheel", "modulation"
    //    maxSpeedPercent -- defined if speedOption is defined. Possible values: an integer > 100
	InputControls = function (arg)
	{
		if (!(this instanceof InputControls))
		{
			return new InputControls(arg);
		}

		// defaults
		this.noteOnMsg = "trkOn";
		this.noteOffMsg = "trkOff";
		this.trkOff = "stopNow";

		var i, attr, attrLen, inputControlsNode;

		inputControlsNode = arg;
		attrLen = inputControlsNode.attributes.length;

		for(i = 0; i < attrLen; ++i)
		{
			attr = inputControlsNode.attributes[i];
			switch(attr.name)
			{
				case "noteOnMsg":
					this.noteOnMsg = attr.value;
					break;
				case "noteOffMsg":
					this.noteOffMsg = attr.value;
					break;
				case "trkVel": // can be undefined
					this.trkVel = attr.value;
					break;
				case "minVelocity": // is defined if noteOnVel is defined
					this.minVelocity = attr.value;
					break;
				case "trkOff": // is defined if the either noteOnMsg nor noteOffMsg has the value "trkOff"
					this.trkOff = attr.value;
					break;
				case "pressure": // can be undefined
					this.pressure = attr.value;
					break;
				case "pitchWheel": // can be undefined
					this.pitchWheel = attr.value;
					break;
				case "modulation": // can be undefined
					this.modulation = attr.value;
					break;
				case "maxVolume": // is defined if either pressure, pitchwheel or modulation controls are set to control volume
					this.maxVolume = parseInt(attr.value, 10);
					break;
				case "minVolume": // is defined if either pressure, pitchwheel or modulation controls are set to control volume
					this.minVolume = parseInt(attr.value, 10);
					break;
				case "speedOption": // can be undefined
					this.speedOption = attr.value;
					break;
				case "maxSpeedPercent": // is defined if speedOption is defined
					this.maxSpeedPercent = parseInt(attr.value, 10);
					break;
				default:
					throw (">>>>>>>>>> Illegal InputControls attribute <<<<<<<<<<");
			}
		}
        return this;
    },

    // public API
    publicAPI =
    {
        // public InputControls(inputControlsNode) constructor.
        InputControls: InputControls
    };

    return publicAPI;

} ());

