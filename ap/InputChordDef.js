/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/InputChordDef.js
 *  Public interface contains:
 *     InputChordDef(inputNotesNode) // Chord definition constructor. Reads the XML in the inputNotesNode. 
 *  
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

_AP.namespace('_AP.inputChordDef');

_AP.inputChordDef = (function ()
{
    "use strict";
	var
	InputControls = _AP.inputControls.InputControls,

    // InputChordDef constructor
    // The inputChordDef contains the inputChordDef information from the XML in a form that is easier to program with.
    // The InputChordDef has the following fields:
    //		inputChordDef.inputNotes[]
	//		inputChordDef.inputControls -- can be undefined
    //
    // Each inputNote in the inputChordDef.inputNotes[] has the following fields:
    //		inputNote.notatedKey (compulsory int)
	//		inputNote.inputControls -- can be undefined
    //		inputNote.trkRefs (an array of trkRef)
	//
	// Each trkRef in inputNote.trkRefs has the following fields:
	//		trkRef.voiceID (compulsory int >= 0. The voiceId of the voice containing the referenced Seq. )	
	//		trkRef.length (compulsory int >= 0. The length of the referenced Seq.)
	//		trkRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
	//		trkRef.inputControls -- can be undefined
	//
	// An inputChordDef.inputControls sets the current values in the midi input channel permanently by cascading the current values.
	// inputNote.inputControls and trkRef.inputControls cascade with the current values in the midi input channel, but do not change
	// those values permanently.
	// inputControls contain:
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
	InputChordDef = function (inputNotesNode)
	{
		if (!(this instanceof InputChordDef))
		{
			return new InputChordDef(inputNotesNode);
		}

        this.inputNotes = this.getInputNotes(inputNotesNode);

        return this;
    },

    // public API
    publicAPI =
    {
        // public InputChordDef(inputNotesNode) constructor.
        InputChordDef: InputChordDef
    };

	InputChordDef.prototype.getInputNotes = function(inputNotesNode)
	{
		var inputNoteDef = inputNotesNode.firstElementChild,
            inputNotesArray = [];

		function getInputNote(inputNoteDef)
		{
			var attr,
                inputNote = {},
                attributesLength = inputNoteDef.attributes.length,
				childNodes = inputNoteDef.childNodes,
                i;

			function getTrkRefs(trkRefsNode)
			{
				var trkRefsArray = [],
				trkRefNode = trkRefsNode.firstElementChild;

				function getTrkRef(trkRefNode)
				{
					var i, attr,
					trkRef = {},
					attrLen = trkRefNode.attributes.length,
					childNodes = trkRefNode.childNodes;

					for(i = 0; i < attrLen; ++i)
					{
						attr = trkRefNode.attributes[i];
						switch(attr.name)
						{
							//		trkRef.voiceID (compulsory int >= 0. The voiceId of the voice containing the referenced Seq. )	
							//		trkRef.length (compulsory int >= 0. The length of the referenced Seq.)
							//		trkRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
							case "voiceID":
								trkRef.voiceID = parseInt(attr.value, 10);
								break;
							case "length":
								trkRef.length = parseInt(attr.value, 10);
								break;
							case "msOffset":
								trkRef.msOffset = parseInt(attr.value, 10);
								break;
							default:
								throw (">>>>>>>>>> Illegal trkRef attribute <<<<<<<<<<");
						}
					}

					for(i = 0; i < childNodes.length; ++i)
					{
						if(childNodes[i].nodeName === "inputControls")
						{
							trkRef.inputControls = new InputControls(childNodes[i]);
							break;
						}
					}

					return trkRef;
				}

				while(trkRefNode)
				{
					try
					{
						trkRefsArray.push(getTrkRef(trkRefNode));
						trkRefNode = trkRefNode.nextElementSibling;
					}
					catch(ex)
					{
						console.log(ex);
					}
				}
				return trkRefsArray;
			}

			for(i = 0; i < attributesLength; ++i)
			{
				attr = inputNoteDef.attributes[i];
				// console.log(attr.name + " = " + attr.value);
				switch(attr.name)
				{
					case "notatedKey":
						inputNote.notatedKey = parseInt(attr.value, 10);
						break;
					default:
						throw (">>>>>>>>>> Illegal inputNote attribute <<<<<<<<<<");
				}
			}

			if(inputNote.notatedKey === undefined)
			{
				throw ("Error: all inputNotes must have a notatedKey attribute");
			}

			for(i = 0; i < childNodes.length; ++i)
			{
				switch(childNodes[i].nodeName)
				{
					case "inputControls":
						// inputNote.inputControls can be undefined
						inputNote.inputControls = new InputControls(childNodes[i]);
						break;
					case "trkRefs":
						inputNote.trkRefs = getTrkRefs(childNodes[i]);
						break;
				}
			}

			if(inputNote.trkRefs === undefined)
			{
				throw "inputNote.trkRefs must be defined!";
			}

			return inputNote;
		}

		while(inputNoteDef)
		{
			try
			{
				inputNotesArray.push(getInputNote(inputNoteDef));
				inputNoteDef = inputNoteDef.nextElementSibling;
			}
			catch(ex)
			{
				console.log(ex);
			}
		}
		return inputNotesArray;
	};

    return publicAPI;

} ());

