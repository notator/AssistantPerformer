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

_AP.namespace('_AP.inputControls');

_AP.inputControls = (function ()
{
    "use strict";
    var
    // InputControls constructor
    // inputControls sets the performance options for a Seq, by individually overriding the current options in the Seq's Output Voice.
	// contains:
    //		inputControls.onlySeq -- possible values: "0" or "1", default is "0" 
	//		inputControls.noteOnKey -- possible values: "ignore", "transpose", "matchExactly" 
	//		inputControls.noteOnVel -- possible values: "ignore", "scale"  
	//		inputControls.noteOff -- possible values: "ignore", "stop", "stopNow", "fade", "shortFade"  
	//		inputControls.shortFade  -- possible values: an integer >= 0. 
	//		inputControls.pressure -- possible values: "ignore", "aftertouch", "channelPressure", "pitchWheel", "modulation", "volume", "pan"
	//									               "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
	//		inputControls.pitchWheel -- possible values: same as pressure
	//		inputControls.modulation -- possible values: same as pressure
	//		inputControls.maxVolume -- possible values: 0..127
	//		inputControls.minVolume -- possible values: 0..127
	//		inputControls.speedOption -- possible values: "none", "noteOnKey", "noteOnVel", "pressure", "pitchWheel", "modulation"
	//		inputControls.maxSpeedPercent -- possible values: an integer > 100
	InputControls = function (inputControlsNode)
	{
		if (!(this instanceof InputControls))
		{
			return new InputControls(inputControlsNode);
		}

		var i, attr, attrLen;

		if(inputControlsNode === undefined || inputControlsNode === null)
		{
			// each OutputVoice is initialized with this set of default options 
			this.noteOnKey = "ignore";
			this.noteOnVel = "ignore";
			this.noteOff = "ignore";
			this.pressure = "ignore";
			this.pitchWheel = "ignore";
			this.modulation = "ignore";
			this.speedOption = "none";
		}
		else
		{
			attrLen = inputControlsNode.attributes.length;

			for(i = 0; i < attrLen; ++i)
			{
				attr = inputControlsNode.attributes[i];
				switch(attr.name)
				{
					case "onlySeq":
						this.onlySeq = attr.value;
						break;
					case "noteOnKey":
						this.noteOnKey = attr.value;
						break;
					case "noteOnVel":
						this.noteOnVel = attr.value;
						break;
					case "noteOff":
						this.noteOff = attr.value;
						break;
					case "shortFade":
						this.shortFade = parseInt(attr.value, 10);
						break;
					case "pressure":
						this.pressure = attr.value;
						break;
					case "pitchWheel":
						this.pitchWheel = attr.value;
						break;
					case "modulation":
						this.modulation = attr.value;
						break;
					case "maxVolume":
						this.maxVolume = parseInt(attr.value, 10);
						break;
					case "minVolume":
						this.minVolume = parseInt(attr.value, 10);
						break;
					case "speedOption":
						this.speedOption = attr.value;
						break;
					case "maxSpeedPercent":
						this.maxSpeedPercent = parseInt(attr.value, 10);
						break;
					default:
						throw (">>>>>>>>>> Illegal InputControls attribute <<<<<<<<<<");
				}
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

