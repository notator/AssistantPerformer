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
    //
    // Each inputNote in the inputChordDef.inputNotes[] has the following fields:
    //		inputNote.notatedKey (compulsory int)
    //		inputNote.seqRefs (an array of seqRef)
	//
	// Each seqRef in inputNote.seqRefs has the following fields:
	//		seqRef.voiceID (compulsory int >= 0. The voiceId of the voice containing the referenced Seq. )	
	//		seqRef.length (compulsory int >= 0. The length of the referenced Seq.)
	//		seqRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
	//		seqRef.inputControls (optional: can be contained in either Output Voice or seqRef elements.)
	//
	// seqRef.inputControls sets the performance options for a Seq, by individually overriding the current options in the Seq's Output Voice.
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
				seqRefsNode = inputNoteDef.firstElementChild,
                i;

			function getSeqRefs(seqRefsNode)
			{
				var seqRefsArray = [],
				seqRefNode = seqRefsNode.firstElementChild;

				function getSeqRef(seqRefNode)
				{
					var i, attr,
					seqRef = {},
					attrLen = seqRefNode.attributes.length,
					inputControlsNode = seqRefNode.firstElementChild;

					for(i = 0; i < attrLen; ++i)
					{
						attr = seqRefNode.attributes[i];
						switch(attr.name)
						{
							//		seqRef.voiceID (compulsory int >= 0. The voiceId of the voice containing the referenced Seq. )	
							//		seqRef.length (compulsory int >= 0. The length of the referenced Seq.)
							//		seqRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
							case "voiceID":
								seqRef.voiceID = parseInt(attr.value, 10);
								break;
							case "length":
								seqRef.length = parseInt(attr.value, 10);
								break;
							case "msOffset":
								seqRef.msOffset = parseInt(attr.value, 10);
								break;
							default:
								throw (">>>>>>>>>> Illegal seqRef attribute <<<<<<<<<<");
						}
					}

					if(inputControlsNode !== undefined && inputControlsNode !== null)
					{
						seqRef.inputControls = new InputControls(inputControlsNode);
					}
					return seqRef;
				}

				while(seqRefNode)
				{
					try
					{
						seqRefsArray.push(getSeqRef(seqRefNode));
						seqRefNode = seqRefNode.nextElementSibling;
					}
					catch(ex)
					{
						console.log(ex);
					}
				}
				return seqRefsArray;
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

			inputNote.seqRefs = getSeqRefs(seqRefsNode);

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

