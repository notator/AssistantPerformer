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
	TrkOptions = _AP.trkOptions.TrkOptions,

    // InputChordDef constructor
    // The inputChordDef contains the inputChordDef information from the XML in a form that is easier to program with.
    // The InputChordDef has the following fields:
	//		inputChordDef.trkOptions -- undefined or an TrkOptions object
    //		inputChordDef.inputNotes[] -- see below
    //
    // Each inputNote in the inputChordDef.inputNotes[] has the following fields:
	//		inputNote.notatedKey (a number. The MIDI index of the notated key.)
	//		inputNote.trkOptions -- undefined or an TrkOptions object
    //		inputNote.noteOn -- undefined or see below
	//      inputNote.pressures -- undefined or an array of pressure objects.
	//      inputNote.noteOff -- undefined or see below
	//
	// if defined, inputNote.noteOn has the following fields:
	//      inputNote.noteOn.trkOns -- undefined or an array of trkOn with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOn.trkOffs -- undefined or an array of trkOff with a (possibly undefined) TrkOptions field.
	//
	// if defined, inputNote.pressures contains an array of pressure objects with a (possibly undefined) TrkOptions field.
	//      Each pressure object has a midiChannel and a (possibly undefined) TrkOptions field. 
	//
	// if defined, inputNote.noteOff has the same fields as inputNote.noteOn:
	//      inputNote.noteOff.trkOns -- undefined or an array of trkOn with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOff.trkOffs -- undefined or an array of trkOff with a (possibly undefined) TrkOptions field.
	//
	// if defined, trkOn has the following fields:
	//		trkOn.trkOptions -- undefined or an TrkOptions object
	//		trkOn.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
	//		trkOn.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk)
	//		trkOn.nMidiObjects (compulsory int >= 0. The number of MidiChords and Rests in the referenced Trk.)
	//
	// if defined, trkOff has the following fields:
	//		trkOn.trkOptions -- undefined or an TrkOptions object
	//		trkOn.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
	//		trkOn.msPosition (compulsory int >= 0. The msPositionInScore of the referenced Trk)
	//
	// An inputChordDef.trkOptions sets the current values in the midi input channel until further notice.
	// TrkOptions at lower levels temporarily override the trkOptions at higher levels.
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
					attrs = inputNoteNode.attributes,
					nAttributes = attrs.length,
					childNodes = inputNoteNode.childNodes,
					i;

				// returns an object that can have trkOns and trkOffs attributes
				function getNoteOnOrNoteOff(noteOnOrNoteOffNode)
				{
					var i, childNodes = noteOnOrNoteOffNode.childNodes, nChildNodes = childNodes.length,
					returnObject = {};

					// returns an array of trkOn, possibly having an trkOptions attribute 
					function getOnSeq(trkOnsNode)
					{
						var i, childNodes, returnArray = [];

						function getTrkOn(trkOnNode)
						{
							var i, attr,
							trkOn = {},
							attrLen = trkOnNode.attributes.length,
							childNodes = trkOnNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = trkOnNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										trkOn.midiChannel = parseInt(attr.value, 10);
										break;
									case "msPosition":
										trkOn.msPosition = parseInt(attr.value, 10);
										break;
									case "nMidiObjects":
										trkOn.nMidiObjects = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal trkOn attribute.");
								}
							}

							for(i = 0; i < childNodes.length; ++i)
							{
								if(childNodes[i].nodeName === "trkOptions")
								{
									trkOn.trkOptions = new TrkOptions(childNodes[i]);
									break;
								}
							}

							return trkOn;
						}

						childNodes = trkOnsNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'trkOptions':
									returnArray.trkOptions = new TrkOptions(childNodes[i]);
									break;
								case 'trkOn':
									returnArray.push(getTrkOn(childNodes[i]));
									break;
							}
						}
						return returnArray;
					}

					// returns an array of trkOn, possibly having an trkOptions attribute
					function getOffSeq(trkOffsNode)
					{
						var i, childNodes, returnArray = [];

						function getTrkOff(trkOffNode)
						{
							var i, attr,
							trkOff = {},
							attrLen = trkOffNode.attributes.length,
							childNodes = trkOffNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = trkOffNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										trkOff.midiChannel = parseInt(attr.value, 10);
										break;
									case "msPosition":
										trkOff.msPosition = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal trkOff attribute.");
								}
							}

							for(i = 0; i < childNodes.length; ++i)
							{
								if(childNodes[i].nodeName === "trkOptions")
								{
									trkOff.trkOptions = new TrkOptions(childNodes[i]);
									break;
								}
							}

							return trkOff;
						}

						childNodes = trkOffsNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'trkOptions':
									returnArray.trkOptions = new TrkOptions(childNodes[i]);
									break;
								case 'trkOff':
									returnArray.push(getTrkOff(childNodes[i]));
									break;
							}
						}
						return returnArray;
					}

					for(i = 0; i < nChildNodes; ++i)
					{
						switch(childNodes[i].nodeName)
						{
							case 'onSeq':
								returnObject.onSeq = getOnSeq(childNodes[i]);
								break;
							case 'offSeq':
								returnObject.offSeq = getOffSeq(childNodes[i]);
								break;
						}
					}

					return returnObject;
				}

				function getChannels(channelsNode)
				{
					var i, childNodes = channelsNode.childNodes, channelOptions, channels = [];

					function getChannelOptions(channelNode)
					{
						var i, channelOptions, attrs, childNodes = channelNode.childNodes;

						attrs = channelNode.attributes;
						console.assert(attrs.length === 1 && attrs[0].name === 'midiChannel');
						channelOptions = {};
						channelOptions.midiChannel = parseInt(attrs[0].value, 10);

						for(i = 0; i < childNodes.length; ++i)
						{
							if(childNodes[i].nodeName === 'trkOptions')
							{
								channelOptions.trkOptions = new TrkOptions(childNodes[i]);
							}
						}
						return channelOptions;
					}

					for(i = 0; i < childNodes.length; ++i)
					{
						switch(childNodes[i].nodeName)
						{
							case 'trkOptions':
								channels.trkOptions = new TrkOptions(childNodes[i]);
								break;
							case 'channel':
								channelOptions = getChannelOptions(childNodes[i]);
								channels.push(channelOptions);
								break;
						}
					}
					return channels;
				}
				
				for(i = 0; i < nAttributes; ++i)
				{
					attr = attrs[i];
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
						case "trkOptions":
							// inputNote.trkOptions can be undefined
							inputNote.trkOptions = new TrkOptions(childNodes[i]);
							break;
						case "noteOn":
							inputNote.noteOn = getNoteOnOrNoteOff(childNodes[i]);
							break;
						case "pressures":
							inputNote.pressures = getChannels(childNodes[i]);
							break;
						case "pitchWheels":
							inputNote.pitchWheels = getChannels(childNodes[i]);
							break;
						case "modWheels":
							inputNote.modWheels = getChannels(childNodes[i]);
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
					case 'trkOptions':
						returnValue.trkOptions = new TrkOptions(childNodes[i]);
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
		if(chordDef.trkOptions !== undefined)
		{
			this.trkOptions = chordDef.trkOptions;
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

	// returns an array of output midi channel indices
	InputChordDef.prototype.referencedOutputMidiChannels = function()
	{
		var i, j, inputNote, nInputNotes = this.inputNotes.length, nonUniqueOutputChannels = [], returnArray = [];

		function outChannels(noteOnOff)
		{
			var i,
			onSeq = noteOnOff.onSeq, nTrkOns = onSeq.length,
			offSeq = noteOnOff.offSeq, nTrkOffs = offSeq.length,
			outputChannels = [];

			if(onSeq !== undefined)
			{
				for(i = 0; i < nTrkOns; ++i)
				{
					outputChannels.push(onSeq[i].midiChannel);
				}
			}
			if(offSeq !== undefined)
			{
				for(i = 0; i < nTrkOffs; ++i)
				{
					outputChannels.push(offSeq[i].midiChannel);
				}
			}

			return outputChannels;
		}

		function uniqueOutputChannels(nonUniqueOutputChannels)
		{
			var i, nAllOutputChannels = nonUniqueOutputChannels.length, rVal = [];
			for(i = 0; i < nAllOutputChannels; ++i)
			{
				if(rVal.indexOf(nonUniqueOutputChannels[i]) < 0)
				{
					rVal.push(nonUniqueOutputChannels[i]);
				}
			}
			return rVal;
		}

		for(i = 0; i < nInputNotes; ++i)
		{
			inputNote = this.inputNotes[i];
			if(inputNote.noteOn !== undefined)
			{
				nonUniqueOutputChannels = nonUniqueOutputChannels.concat(outChannels(inputNote.noteOn));
			}
			if(inputNote.pressures !== undefined)
			{
				for(j = 0; j < inputNote.pressures.length; ++j)
				{
					nonUniqueOutputChannels = nonUniqueOutputChannels.concat(inputNote.pressures[j].midiChannel);
				}
			}
			if(inputNote.pitchWheels !== undefined)
			{
				for(j = 0; j < inputNote.pitchWheels.length; ++j)
				{
					nonUniqueOutputChannels = nonUniqueOutputChannels.concat(inputNote.pitchWheels[j].midiChannel);
				}
			}
			if(inputNote.modWheels !== undefined)
			{
				for(j = 0; j < inputNote.modWheels.length; ++j)
				{
					nonUniqueOutputChannels = nonUniqueOutputChannels.concat(inputNote.modWheels[j].midiChannel);
				}
			}
			if(inputNote.noteOff !== undefined)
			{
				nonUniqueOutputChannels = nonUniqueOutputChannels.concat(outChannels(inputNote.noteOff));
			}
		}

		returnArray = uniqueOutputChannels(nonUniqueOutputChannels);

		return returnArray;
	};

    return publicAPI;

} ());

