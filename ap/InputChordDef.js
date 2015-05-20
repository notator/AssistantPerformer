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
	//		trkRef.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )	
	//		trkRef.length (compulsory int >= 0. The length of the referenced Trk.)
	//		trkRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
	//		trkRef.inputControls -- can be undefined
	//
	// An inputChordDef.inputControls sets the current values in the midi input channel permanently by cascading the current values.
	// inputNote.inputControls and trkRef.inputControls cascade with the current values, but do not change those values permanently.
	InputChordDef = function (inputNotesNode)
	{
		function getInputNotes(inputNotesNode)
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
					var trkRefsArray = [], trkRef,
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
								//		trkRef.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )	
								//		trkRef.length (compulsory int >= 0. The length of the referenced Trk.)
								//		trkRef.msOffset (compulsory int >= 0 -- if attribute is not present, is 0 by default)
								case "midiChannel":
									trkRef.midiChannel = parseInt(attr.value, 10);
									break;
								case "length":
									trkRef.length = parseInt(attr.value, 10);
									break;
								case "msOffset":
									trkRef.msOffset = parseInt(attr.value, 10);
									break;
								default:
									console.assert(false, ">>>>>>>>>> Illegal trkRef attribute <<<<<<<<<<");
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
						trkRef = getTrkRef(trkRefNode);
						trkRefsArray.push(trkRef);
						trkRefNode = trkRefNode.nextElementSibling;
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
							console.assert(false, ">>>>>>>>>> Illegal inputNote attribute <<<<<<<<<<");
					}
				}

				console.assert(inputNote.notatedKey !== undefined, "All inputNotes must have a notatedKey attribute");

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

				console.assert(inputNote.trkRefs !== undefined, "inputNote.trkRefs must be defined!");

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
		}

		if (!(this instanceof InputChordDef))
		{
			return new InputChordDef(inputNotesNode);
		}

        this.inputNotes = getInputNotes(inputNotesNode);

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

