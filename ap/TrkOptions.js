/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/TrkOptions.js
 *  Public interface contains:
 *     TrkOptions(trkOptionsNode) // Chord definition constructor. Reads the XML in the trkOptionsNode. 
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.trkOptions');

_AP.trkOptions = (function ()
{
    "use strict";
    var
    // TrkOptions constructor: argument can be an trkOptions node from a document, or another TrkOptions object (to be cloned).
    // An TrkOptions object sets performance options for a trk, seq (=inputNote), or inputChord (=voice).
    //    trk.inputOptions temporarily override seq.inputOptions
    //    seq.inputOptions temporarily override inputNote.inputOptions
	//    inputNote.inputOptions temporarily override inputChord.inputOptions
    //    inputChord.inputOptions change the global inputOptions vor the containing voice.
	//
	// Default TrkOptions objects have no defined fields.
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
	TrkOptions = function (trkOptionsNode)
	{
		if (!(this instanceof TrkOptions))
		{
			return new TrkOptions(trkOptionsNode);
		}

		var i, attributes = trkOptionsNode.attributes, attr, attrLen;

		console.assert(attributes !== undefined && attributes.length > 0);

		attrLen = attributes.length;
		for(i = 0; i < attrLen; ++i)
		{
			attr = attributes[i];
			switch(attr.name)
			{
				// options sent trkOn message
				case "velocity":
					this.velocity = attr.value;
					break;
				case "minVelocity": // is defined if velocity is defined
					this.minVelocity = parseInt(attr.value, 10);
					break;

				// option sent with pressure message (see maxVolume and minVolume below)
				case "pressure":
					this.pressure = attr.value;
					break;

				// option sent with trkOff message
				case "trkOff":
					this.trkOff = attr.value;
					break;

				// option sent with pitchWheel message (when the physical pitchWheel moves)
				case "pitchWheel": // can be undefined  (see maxVolume and minVolume below)
					this.pitchWheel = attr.value;
					break;
				// option sent with modulation message (when the physical modulation wheel moves)
				case "modulation": // can be undefined  (see maxVolume and minVolume below)
					this.modulation = attr.value;
					break;

				// options sent if either pressure, pitchWheel or modulation messages are set to control volume
				case "maxVolume":
					this.maxVolume = parseInt(attr.value, 10);
					break;
				case "minVolume":
					this.minVolume = parseInt(attr.value, 10);
					break;

				// options sent when the changeSpeed message is sent
				case "speedOption":
					this.speedOption = attr.value;
					break;
				case "maxSpeedPercent": // is defined if speedOption is defined
					this.maxSpeedPercent = parseInt(attr.value, 10);
					break;

				default:
					throw (">>>>>>>>>> Illegal TrkOptions attribute <<<<<<<<<<");
			}
		}
        return this;
    },

    // public API
    publicAPI =
    {
        // public TrkOptions(trkOptionsNode) constructor.
        TrkOptions: TrkOptions
    };

    return publicAPI;

} ());

