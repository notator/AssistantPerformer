/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/TrkOptions.js
 * 
 *  TrkOptions object constructor. Reads the XML in its trkOptionsNode argument.
 *  If the argument is undefined, or has no attributes, or no valid attributes, a default (empty) TrkObjects object is returned.
 *     TrkOptions(trkOptionsNode); 
 *     
 *  A TrkOptions object sets performance options for a trk, seq (=inputNote), or inputChord (=voice).
 *     trk.trkOptions temporarily override seq.trkOptions
 *     seq.trkOptions temporarily override inputNote.trkOptions
 *     inputNote.trkOptions temporarily override inputChord.trkOptions
 *     inputChord.trkOptions change the global trkOptions for the containing voice, except that continuous controller options are not carried forward.
 *
 * Possible fields (all are attributes in score files), and their available values, are:
 *     pedal -- possible values: "holdAll", "holdLast"
 *     velocity -- possible values: "scaled", "shared", "overridden"  
 *     trkOff -- possible values: "stopChord", "stopNow", "fade"
 *     pressure -- possible values: "aftertouch", "channelPressure", "modulation", "volume",
 *                                  "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
 *     pitchWheel -- "pitch", "speed" or "pan".
 *     modWheel -- possible values: same as pressure
 *     minVelocity -- an integer in range [1..127]. Defined if velocity is defined. 
 *     maxVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
 *     minVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
 *     maxSpeedPercent -- an integer > 100. Defined if speedOption is defined.
 *     pitchWheelDeviation -- the number of semitones deviation when pitchWheel="pitch"
 *     speedDeviation -- the speed factor when pitchWheel="speed"
 *     panOrigin -- the position around which pitchWheel="pan" moves (range 0..127, centre is 64)
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.trkOptions');

_AP.trkOptions = (function ()
{
    "use strict";
    var
	TrkOptions = function (trkOptionsNode)
	{
		if (!(this instanceof TrkOptions))
		{
			return new TrkOptions(trkOptionsNode);
		}

		var i, attributes, attr, attrLen,
		hasNodeArg = !(trkOptionsNode === undefined || trkOptionsNode.attributes === undefined || trkOptionsNode.attributes.length === 0);

		if(hasNodeArg)
		{
			attributes = trkOptionsNode.attributes;

			attrLen = attributes.length;
			for(i = 0; i < attrLen; ++i)
			{
				attr = attributes[i];
				switch(attr.name)
				{
					case "pedal":
						this.pedal = attr.value;
						break;

					case "velocity":
						this.velocity = attr.value;
						break;
					case "minVelocity": // is defined if velocity is defined
						this.minVelocity = parseInt(attr.value, 10);
						break;

					case "trkOff":
						this.trkOff = attr.value;
						break;

					case "pressure":
						this.pressure = attr.value;
						break;

					case "pitchWheel": // can be undefined
						this.pitchWheel = attr.value;
						break;

					case "modWheel": // can be undefined  (see also maxVolume and minVolume below)
						this.modWheel = attr.value;
						break;

						// options set if either pressure, or modulation messages are set to control volume
					case "minVolume":
						this.minVolume = parseInt(attr.value, 10);
						break;
					case "maxVolume":
						this.maxVolume = parseInt(attr.value, 10);
						break;

					case "pitchWheelDeviation":
						this.pitchWheelDeviation = parseInt(attr.value, 10);
						break;
					case "speedDeviation":
						this.speedDeviation = parseFloat(attr.value, 10);
						break;
					case "panOrigin":
						this.panOrigin = parseInt(attr.value, 10); // (range 0..127, centre is 64)
						break;

					default:
						throw (">>>>>>>>>> Illegal TrkOptions attribute <<<<<<<<<<");
				}
			}
		}
        return this;
    },

    publicAPI =
    {
        TrkOptions: TrkOptions
    };

	// Returns a clone of the caller, without the continuous controller options.
	// The continuous controller options are not carried forward.
    TrkOptions.prototype.getCarriedForwardOptions = function()
    {
    	var cfOptions = new TrkOptions();

    	if(this.pedal)
    	{
    		cfOptions.pedal = this.pedal;
    	}

    	if(this.velocity)
    	{
    		cfOptions.velocity = this.velocity;
    		cfOptions.minVelocity = this.minVelocity;
    	}

    	if(this.trkOff)
    	{
    		cfOptions.trkOff = this.trkOff;
    	}

    	return cfOptions;
    };

    return publicAPI;

} ());

