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
    // An InputControls object sets performance options for a trk, seq (=inputNote), or inputChord (=voice).
    //    trk.inputOptions temporarily override seq.inputOptions
    //    seq.inputOptions temporarily override inputNote.inputOptions
	//    inputNote.inputOptions temporarily override inputChord.inputOptions
    //    inputChord.inputOptions change the global inputOptions vor the containing voice.
	//
	// Default InputControl objects have no defined fields.
	//
	// Possible fields (all are attributes in score files), and their available values, are:
    //    velocity -- possible values: "scaled", "shared", "overridden"  
    //    pressure -- possible values: "aftertouch", "channelPressure", "pitchWheel", "modulation", "volume", "pan"
    //				                   "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
	//    trkOff -- possible values: "undefined", "stopChord", "stopNow", "fade", "holdAll", "holdLast"
    //    pitchWheel -- possible values: same as pressure
    //    modulation -- possible values: same as pressure
	//    speedOption -- possible values: "noteOnKey", "noteOnVel", "pressure", "pitchWheel", "modulation"
	//    minVelocity -- an integer in range [1..127]. Defined if velocity is defined. 
    //    maxVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
    //    minVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
    //    maxSpeedPercent -- an integer > 100. Defined if speedOption is defined.
	InputControls = function (inputControlsNode)
	{
		if (!(this instanceof InputControls))
		{
			return new InputControls(inputControlsNode);
		}

		var i, attributes = inputControlsNode.attributes, attr, attrLen;

		console.assert(attributes !== undefined && attributes.length > 0);

		attrLen = attributes.length;
		for(i = 0; i < attrLen; ++i)
		{
			attr = attributes[i];
			switch(attr.name)
			{
				case "velocity": // can be undefined
					this.velocity = attr.value;
					break;
				case "pressure": // can be undefined
					this.pressure = attr.value;
					break;
				case "trkOff": // is defined if the either noteOnMsg nor noteOffMsg has the value "trkOff"
					this.trkOff = attr.value;
					break;
				case "pitchWheel": // can be undefined
					this.pitchWheel = attr.value;
					break;
				case "modulation": // can be undefined
					this.modulation = attr.value;
					break;
				case "speedOption": // can be undefined
					this.speedOption = attr.value;
					break;
				case "minVelocity": // is defined if noteOnVel is defined
					this.minVelocity = parseInt(attr.value, 10);
					break;
				case "maxVolume": // is defined if either pressure, pitchwheel or modulation controls are set to control volume
					this.maxVolume = parseInt(attr.value, 10);
					break;
				case "minVolume": // is defined if either pressure, pitchwheel or modulation controls are set to control volume
					this.minVolume = parseInt(attr.value, 10);
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

