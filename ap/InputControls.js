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
    // inputControls sets the performance options for a Seq, by individually overriding the current options in the Seq's Output Voice.
	// contains:  
    //		inputControls.noteOnVel -- possible values: "off", "scaled", "shared", "overridden"
	//		inputControls.minVelocity -- only defined if noteOnVel is defined and set to "scaled", "shared" or "overridden". Is in range [1..127].
	//		inputControls.noteOff -- possible values: "off", "stopChord", "stopNow", "fade"   
    //		inputControls.pressure -- possible values: "off", "aftertouch", "channelPressure", "pitchWheel", "modulation", "volume", "pan"
    //									               "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
    //		inputControls.pitchWheel -- possible values: same as pressure
    //		inputControls.modulation -- possible values: same as pressure
    //		inputControls.maxVolume -- only defined if one of the above controllers is set to "volume". Possible values: 0..127
    //		inputControls.minVolume -- only defined if one of the above controllers is set to "volume". Possible values: 0..127
    //		inputControls.speedOption -- possible values: "off", "noteOnVel", "pressure", "pitchWheel", "modulation"
    //		inputControls.maxSpeedPercent -- only defined if speedOption is not "none". Possible values: an integer > 100
	InputControls = function (arg)
	{
		if (!(this instanceof InputControls))
		{
			return new InputControls(arg);
		}

		var i, attr, attrLen, inputControlsNode;

		if(arg !== undefined) // undefined returns an empty InputControls object
		{
			if(arg instanceof InputControls)
			{
				// construct clone
				if(arg.noteOnVel !== undefined)
				{
					this.noteOnVel = arg.noteOnVel;
					this.minVelocity = arg.minVelocity;
				}
				if(arg.noteOff !== undefined)
				{
					this.noteOff = arg.noteOff;
				}
				if(arg.pressure !== undefined)
				{
					this.pressure = arg.pressure;
				}
				if(arg.pitchWheel !== undefined)
				{
					this.pitchWheel = arg.pitchWheel;
				}
				if(arg.modulation !== undefined)
				{
					this.modulation = arg.modulation;
				}
				if(arg.maxVolume !== undefined)
				{
					this.maxVolume = arg.maxVolume;
				}
				if(arg.minVolume !== undefined)
				{
					this.minVolume = arg.minVolume;
				}
				if(arg.speedOption !== undefined)
				{
					this.speedOption = arg.speedOption;
					this.maxSpeedPercent = arg.maxSpeedPercent;
				}
			}
			else // construct from document
			{
				inputControlsNode = arg;
				attrLen = inputControlsNode.attributes.length;

				// default values
				this.noteOnVel = "off";
				this.noteOff = "off";
				this.pressure = "off";
				this.pitchWheel = "off";
				this.modulation = "off";
				this.speedOption = "off";

				for(i = 0; i < attrLen; ++i)
				{
					attr = inputControlsNode.attributes[i];
					switch(attr.name)
					{
						case "noteOnVel": // can be undefined
							this.noteOnVel = attr.value;
							break;
						case "minVelocity": // is defined if noteOnVel is defined and not "off"
							this.minVelocity = attr.value;
							break;
						case "noteOff": // can be undefined
							this.noteOff = attr.value;
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
						case "maxSpeedPercent": // is defined if speedOption is defined and not "off"
							this.maxSpeedPercent = parseInt(attr.value, 10);
							break;
						default:
							throw (">>>>>>>>>> Illegal InputControls attribute <<<<<<<<<<");
					}
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

	// Returns a new inputControls object that is the result of cascading this inputControls object over the
    // baseInputControls argument. An exception is thrown if the argument is undefined.
	// The returned inputControls object only contains the attributes contained in this and/or the argument.
	// (Attributes that are missing in both this and the argument will be missing in the returned inputControls.)
    InputControls.prototype.getCascadeOver = function(baseInputControls)
    {
    	var rval = {};

    	console.assert(baseInputControls !== undefined, "Error. The baseInputControls argument cannot be undefined");

    	if(this.noteOnVel !== undefined)
    	{
    		rval.noteOnVel = this.noteOnVel;
    		if(rval.noteOnVel !== "off")
    		{
    			rval.minVelocity = this.minVelocity;
    		}
    	}
    	else if(baseInputControls.noteOnVel !== undefined)
    	{
    		rval.noteOnVel = baseInputControls.noteOnVel;
    		if(rval.noteOnVel !== "off")
    		{
    			rval.minVelocity = baseInputControls.minVelocity;
    		}
    	}

    	if(this.noteOff !== undefined)
    	{
    		rval.noteOff = this.noteOff;
    	}
    	else if(baseInputControls.noteOff !== undefined)
    	{
    		rval.noteOff = baseInputControls.noteOff;
    	}

    	if(this.noteOff !== undefined)
    	{
    		rval.noteOff = this.noteOff;
    	}
    	else if(baseInputControls.noteOff !== undefined)
    	{
    		rval.noteOff = baseInputControls.noteOff;
    	}

    	if(this.pressure !== undefined)
    	{
    		rval.pressure = this.pressure;
    		if(rval.pressure === "volume")
    		{
    			rval.maxVolume = this.maxVolume;
    			rval.minVolume = this.minVolume;
    		}
    	}
    	else if(baseInputControls.pressure !== undefined)
    	{
    		rval.pressure = baseInputControls.pressure;
    		if(rval.pressure === "volume")
    		{
    			rval.maxVolume = baseInputControls.maxVolume;
    			rval.minVolume = baseInputControls.minVolume;
    		}
    	}

    	if(this.pitchWheel !== undefined)
    	{
    		rval.pitchWheel = this.pitchWheel;
    		if(rval.pitchWheel === "volume")
    		{
    			rval.maxVolume = this.maxVolume;
    			rval.minVolume = this.minVolume;
    		}
    	}
    	else if(baseInputControls.pitchWheel !== undefined)
    	{
    		rval.pitchWheel = baseInputControls.pitchWheel;
    		if(rval.pitchWheel === "volume")
    		{
    			rval.maxVolume = baseInputControls.maxVolume;
    			rval.minVolume = baseInputControls.minVolume;
    		}
    	}

    	if(this.modulation !== undefined)
    	{
    		rval.modulation = this.modulation;
    		if(rval.modulation === "volume")
    		{
    			rval.maxVolume = this.maxVolume;
    			rval.minVolume = this.minVolume;
    		}
    	}
    	else if(baseInputControls.modulation !== undefined)
    	{
    		rval.modulation = baseInputControls.modulation;
    		if(rval.modulation === "volume")
    		{
    			rval.maxVolume = baseInputControls.maxVolume;
    			rval.minVolume = baseInputControls.minVolume;
    		}
    	}

    	if(this.speedOption !== undefined)
    	{
    		rval.speedOption = this.speedOption;
    		if(rval.speedOption !== "off")
    		{
    			rval.maxSpeedPercent = this.maxSpeedPercent;
    		}
    	}
    	else if(baseInputControls.speedOption !== undefined)
    	{
    		rval.speedOption = baseInputControls.speedOption;
    		if(rval.speedOption !== "off")
    		{
    			rval.maxSpeedPercent = baseInputControls.maxSpeedPercent;
    		}
    	}

    	return rval;
    };

    return publicAPI;

} ());

