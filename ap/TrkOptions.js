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
 *  If the argument is undefined, or has no attributes, or no valid attributes, a default (empty) TrkOptions object is returned.
 *     TrkOptions(trkOptionsNode); 
 *     
 *  A TrkOptions object sets performance options for a trk, seq (=inputNote), or inputChord (=voice).
 *     trk.trkOptions temporarily override seq.trkOptions
 *     seq.trkOptions temporarily override inputNote.trkOptions
 *     inputNote.trkOptions temporarily override inputChord.trkOptions
 *     inputChord.trkOptions change the global trkOptions for the containing voice (i.e. they are carried forward).
 *
 * Possible fields (all are attributes in score files), and their available values, are:
 *     pedal -- possible values: "undefined", "holdAll", "holdLast"
 *     velocity -- possible values: "undefined", "scaled", "shared", "overridden"  
 *     minVelocity -- an integer in range [1..127]. Defined if velocity is defined.
 *     speed --  the value by which to divide output durations in the trk. (A float value greater than 0. Higher values mean higher speed.)  
 *     trkOff -- possible values: "undefined", "stopChord", "stopNow", "fade"
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

					case "speed":
						this.speed = parseFloat(attr.value, 10);
						break;

					case "trkOff":
						this.trkOff = attr.value;
						break;

					default:
						alert(">>>>>>>>>> Illegal trkOptions attribute <<<<<<<<<<");
						console.assert(false);
				}
			}
		}
        return this;
    },

    publicAPI =
    {
        TrkOptions: TrkOptions
    };

    TrkOptions.prototype.clone = function()
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

    	if(this.speed)
    	{
    		cfOptions.speed = this.speed;
    	}

    	if(this.trkOff)
    	{
    		cfOptions.trkOff = this.trkOff;
    	}

    	return cfOptions;
    };

    return publicAPI;

} ());

