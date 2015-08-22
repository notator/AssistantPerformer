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
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.inputChordDef');

_AP.inputChordDef = (function ()
{
    "use strict";
	var
	InputControls = _AP.inputControls.InputControls,
	numberArray = _AP.utilities.numberArray,

    // InputChordDef constructor
    // The inputChordDef contains the inputChordDef information from the XML in a form that is easier to program with.
    // The InputChordDef has the following fields:
	//		inputChordDef.inputControls -- undefined or an InputControls object
    //		inputChordDef.inputNotes[] -- see below
    //
    // Each inputNote in the inputChordDef.inputNotes[] has the following fields:
	//		inputNote.notatedKey (a number. The MIDI index of the notated key.)
	//		inputNote.inputControls -- undefined or an InputControls object
    //		inputNote.noteOn -- undefined or see below
	//      inputNote.pressure[] -- undefined or an array of channel indices.
	//      inputNote.noteOff -- undefined or see below
	//
	// inputNote.noteOn has the following fields:
	//      inputNote.noteOn.trkOffs[] -- undefined or an array of channel indices.
	//		inputNote.noteOn.inputControls -- undefined or an InputControls object
	//		inputNote.noteOn.seq -- undefined or an array of trkRef (see below)
	//
	// if defined, inputNote.noteOff has the same fields as inputNote.noteOn:
	//      inputNote.noteOff.trkOffs[] -- undefined or an array of channel indices.
	//		inputNote.noteOff.inputControls -- undefined or an InputControls object
	//		inputNote.noteOff.seq -- undefined or an array of trkRef
	//
	// Each trkRef in inputNote.noteOn.seq (and inputNote.noteOff.seq) has the following fields:
	//		trkRef.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
	//		trkRef.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk)
	//		trkRef.length (compulsory int >= 0. The number of MidiChords and Rests the referenced Trk.)
	//		trkRef.inputControls -- undefined or an InputControls object
	//
	// An inputChordDef.inputControls sets the current values in the midi input channel until further notice.
	// InputControls at lower levels temporarily override the inputControls at higher levels.
	InputChordDef = function (inputNotesNode)
	{
		var chordDef;
		
		function getChordDef(inputNotesNode)
		{
			var i, childNodes = inputNotesNode.childNodes,
				returnValue = {};

			function getInputNote(inputNoteNode)
			{
				var attr,
					inputNote = {},
					attributesLength = inputNoteNode.attributes.length,
					childNodes = inputNoteNode.childNodes,
					i;

				function getNoteOnOrNoteOff(noteOnOrNoteOffNode)
				{
					var i, trkOffsString, childNodes, returnObject = {};

					function getSeq(seqNode)
					{
						var i, childNodes, returnObject = {};

						function getTrkRef(trkRefNode)
						{
							var i, attr,
							trkRef = { msOffset: 0 },
							attrLen = trkRefNode.attributes.length,
							childNodes = trkRefNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = trkRefNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										trkRef.midiChannel = parseInt(attr.value, 10);
										break;
									case "msPosition":
										trkRef.msPosition = parseInt(attr.value, 10);
										break;
									case "durationsCount":
										trkRef.length = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal trkRef attribute.");
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

						returnObject.trkRefs = [];
						childNodes = seqNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'inputControls':
									returnObject.inputControls = new InputControls(childNodes[i]);
									break;
								case 'trkRef':
									returnObject.trkRefs.push(getTrkRef(childNodes[i]));
									break;
							}
						}
						console.assert(returnObject.trkRefs.length > 0, "A seq must contain at least 1 trkRef.");
						return returnObject;
					}

					if(noteOnOrNoteOffNode.attributes.length > 0)
					{
						trkOffsString = noteOnOrNoteOffNode.attributes[0].value;
						returnObject.trkOffs = numberArray(trkOffsString);
					}
					childNodes = noteOnOrNoteOffNode.childNodes;
					for(i = 0; i < childNodes.length; ++i)
					{
						switch(childNodes[i].nodeName)
						{
							case 'seq':
								returnObject.seq = getSeq(childNodes[i]);
								break;
						}
					}

					return returnObject;
				}

				function getPressureChannels(pressureNode)
				{					
					var returnObject;
					if(pressureNode.attributes.length > 0 && pressureNode.attributes[0].name === "channels")
					{
						returnObject = numberArray(pressureNode.attributes[0].value);
					}
					else
					{
						console.assert(false, "The pressure node must have a channels attribute.");
					}
					return returnObject;
				}
				
				for(i = 0; i < attributesLength; ++i)
				{
					attr = inputNoteNode.attributes[i];
					// console.log(attr.name + " = " + attr.value);
					switch(attr.name)
					{
						case "notatedKey":
							inputNote.notatedKey = parseInt(attr.value, 10);
							break;
						default:
							console.assert(false, "Illegal inputNote attribute.");
					}
				}

				console.assert(inputNote.notatedKey !== undefined, "All inputNotes must have a notatedKey attribute.");

				for(i = 0; i < childNodes.length; ++i)
				{
					switch(childNodes[i].nodeName)
					{
						case "inputControls":
							// inputNote.inputControls can be undefined
							inputNote.inputControls = new InputControls(childNodes[i]);
							break;
						case "noteOn":
							inputNote.noteOn = getNoteOnOrNoteOff(childNodes[i]);
							break;
						case "pressure":
							inputNote.pressure = getPressureChannels(childNodes[i]);
							break;
						case "noteOff":
							inputNote.noteOff = getNoteOnOrNoteOff(childNodes[i]);
							break;
					}
				}

				return inputNote;
			}

			returnValue.inputNotes = [];
			for(i = 0; i < childNodes.length; ++i)
			{
				switch(childNodes[i].nodeName)
				{
					case 'inputControls':
						returnValue.inputControls = new InputControls(childNodes[i]);
						break;
					case 'inputNote':
						returnValue.inputNotes.push(getInputNote(childNodes[i]));
						break;

				}
			}
			return returnValue;
		}

		if (!(this instanceof InputChordDef))
		{
			return new InputChordDef(inputNotesNode);
		}

		chordDef = getChordDef(inputNotesNode);
		if(chordDef.inputControls !== undefined)
		{
			this.inputControls = chordDef.inputControls;
		}
		
		console.assert(chordDef.inputNotes.length > 0);

		this.inputNotes = chordDef.inputNotes;

        return this;
    },

    // public API
    publicAPI =
    {
        // public InputChordDef(inputNotesNode) constructor.
        InputChordDef: InputChordDef
    };

    return publicAPI;

} ());

