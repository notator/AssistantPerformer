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
	//		inputChordDef.trkOptions -- undefined or a TrkOptions object
    //		inputChordDef.inputNotes[] -- an array of inputNote.
    //
    // Each inputNote in the inputChordDef.inputNotes[] has the following fields:
	//		inputNote.notatedKey (a number. The MIDI index of the notated key.)
	//		inputNote.trkOptions -- undefined or an TrkOptions object
    //		inputNote.noteOn -- undefined or see below
	//      inputNote.noteOff -- undefined or see below
	//
	// if defined, inputNote.noteOn has the following fields:
	//      inputNote.noteOn.seq -- is undefined or an array of trkRef with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOn.pressures -- is undefined or an array of midiChannel with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOn.pitchWheels -- is undefined or an array of midiChannel with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOn.modWheels -- is undefined or an array of midiChannel with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOn.trkOffs -- is undefined or an array of trkOff.
	//
	// if defined, inputNote.noteOff has no pressures field, but otherwise the same fields as inputNote.noteOn:
	//      inputNote.noteOff.seq -- is undefined or an array of trkRef with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOff.pitchWheels -- is undefined or an array of midiChannel with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOff.modWheels -- is undefined or an array of midiChannel with a (possibly undefined) TrkOptions field.
	//		inputNote.noteOff.trkOffs -- is undefined or an array of trkOff.
	//
	// A trkRef, which has the element name "trk" in the score, has the following fields:
	//		trkOn.trkOptions -- undefined or an TrkOptions object
	//		trkOn.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
	//		trkOn.msPosition (compulsory int >= 0 in seq and trkOffs, otherwise omitted). The msPositionInScore of the referenced Trk.
	//		trkOn.nMidiObjects (compulsory int >= 0 in seq elements, otherwise omitted). The number of MidiChords and Rests in the referenced Trk.)
	//
	// A trkOff, which also has the element name "trk" in the score, has the following fields:
	//		trkOn.midiChannel (compulsory int >= 0. The midiChannel of the voice containing the referenced Trk. )
	//		trkOn.msPosition (compulsory int >= 0 in seq and trkOffs, otherwise omitted). The msPositionInScore of the referenced Trk.
	//
	// An inputChordDef.trkOptions sets the current values in the midi input channel until further notice.
	// Individual TrkOptions at lower levels temporarily override individual trkOptions at higher levels.
	InputChordDef = function (inputNotesNode)
	{
		var chordDef;
		
		function getChordDef(inputNotesNode)
		{
			var i, childNodes = inputNotesNode.childNodes,
				chordDef = {};

			function getInputNote(inputNoteNode)
			{
				var attr,
					inputNote = {},
					attrs = inputNoteNode.attributes,
					nAttributes = attrs.length,
					childNodes = inputNoteNode.childNodes,
					i;

				// returns an object that can have seq, pressures, pitchWheels, modWheels and trkOff attributes
				function getNoteOnOrNoteOff(noteOnOrNoteOffNode)
				{
					var i, childNodes = noteOnOrNoteOffNode.childNodes, nChildNodes = childNodes.length,
					noteOnOrNoteOff = {};

					// returns an array of trkRef, possibly having an trkOptions attribute 
					function getSeq(seqNode)
					{
						var i, childNodes, seq = [];

						function getSeqTrk(seqTrkNode)
						{
							var i, attr,
							seqTrk = {},
							attrLen = seqTrkNode.attributes.length,
							childNodes = seqTrkNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = seqTrkNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										seqTrk.midiChannel = parseInt(attr.value, 10);
										break;
									case "msPosition":
										seqTrk.msPosition = parseInt(attr.value, 10);
										break;
									case "nMidiObjects":
										seqTrk.nMidiObjects = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal attribute for trk element in seq.");
								}
							}

							for(i = 0; i < childNodes.length; ++i)
							{
								if(childNodes[i].nodeName === "trkOptions")
								{
									seqTrk.trkOptions = new TrkOptions(childNodes[i]);
									break;
								}
							}

							return seqTrk;
						}

						childNodes = seqNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'trkOptions':
									seq.trkOptions = new TrkOptions(childNodes[i]);
									break;
								case 'trk':
									seq.push(getSeqTrk(childNodes[i]));
									break;
							}
						}
						return seq;
					}

					function getChannelRefs(channelRefsNode)
					{
						var i, channelRefs = [], childNodes = channelRefsNode.childNodes;

						function getChannelRef(midiChannelNode)
						{
							var i, attr,
							midiChannel = {},
							attrLen = midiChannelNode.attributes.length,
							childNodes = midiChannelNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = midiChannelNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										midiChannel.midiChannel = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal midiChannel attribute.");
								}
							}

							for(i = 0; i < childNodes.length; ++i)
							{
								if(childNodes[i].nodeName === "trkOptions")
								{
									midiChannel.trkOptions = new TrkOptions(childNodes[i]);
									break;
								}
							}

							return midiChannel;
						}

						childNodes = channelRefsNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'trk':
									channelRefs.push(getChannelRef(childNodes[i]));
									break;
							}
						}

						for(i = 0; i < childNodes.length; ++i)
						{
							if(childNodes[i].nodeName === "trkOptions")
							{
								channelRefs.trkOptions = new TrkOptions(childNodes[i]);
								break;
							}
						}
						return channelRefs;

					}

					// returns an array of trkOff
					function getTrkOffs(trkOffsNode)
					{
						var i, childNodes, trkOffs = [];

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

							return trkOff;
						}

						childNodes = trkOffsNode.childNodes;
						for(i = 0; i < childNodes.length; ++i)
						{
							switch(childNodes[i].nodeName)
							{
								case 'trk':
									trkOffs.push(getTrkOff(childNodes[i]));
									break;
							}
						}
						return trkOffs;
					}

					for(i = 0; i < nChildNodes; ++i)
					{
						switch(childNodes[i].nodeName)
						{
							case 'seq':
								noteOnOrNoteOff.seq = getSeq(childNodes[i]);
								break;
							case 'pressures':
								noteOnOrNoteOff.pressures = getChannelRefs(childNodes[i]); // NoteOff never has a pressures element
								break;
							case 'pitchWheels':
								noteOnOrNoteOff.pitchWheels = getChannelRefs(childNodes[i]);
								break;
							case 'modWheels':
								noteOnOrNoteOff.modWheels = getChannelRefs(childNodes[i]);
								break;	
							case 'trkOffs':
								noteOnOrNoteOff.trkOffs = getTrkOffs(childNodes[i]);
								break;
						}
					}

					return noteOnOrNoteOff;
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
						case "noteOff":
							inputNote.noteOff = getNoteOnOrNoteOff(childNodes[i]);
							break;
					}
				}

				return inputNote;
			}

			chordDef.inputNotes = [];
			for(i = 0; i < childNodes.length; ++i)
			{
				switch(childNodes[i].nodeName)
				{
					case 'trkOptions':
						chordDef.trkOptions = new TrkOptions(childNodes[i]);
						break;
					case 'inputNote':
						chordDef.inputNotes.push(getInputNote(childNodes[i]));
						break;

				}
			}
			return chordDef;
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
			seq = noteOnOff.seq, nSeqTrks,
			pressures = noteOnOff.pressures, nPressures,
			pitchWheels = noteOnOff.pitchWheels, nPitchWheels,
			modWheels = noteOnOff.modWheels, nModWheels,
			trkOffs = noteOnOff.trkOffs, nTrkOffs,
			outputChannels = [];

			if(seq !== undefined)
			{
				nSeqTrks = seq.length;
				for(i = 0; i < nSeqTrks; ++i)
				{
					outputChannels.push(seq[i].midiChannel);
				}
			}
			if(pressures !== undefined)
			{
				nPressures = pressures.length
				for(i = 0; i < nPressures; ++i)
				{
					outputChannels.push(pressures[i].midiChannel);
				}
			}
			if(pitchWheels !== undefined)
			{
				nPitchWheels = pitchWheels.length
				for(i = 0; i < nPitchWheels; ++i)
				{
					outputChannels.push(pitchWheels[i].midiChannel);
				}
			}
			if(modWheels !== undefined)
			{
				nModWheels = modWheels.length
				for(i = 0; i < nModWheels; ++i)
				{
					outputChannels.push(modWheels[i].midiChannel);
				}
			}
			if(trkOffs !== undefined)
			{
				nTrkOffs = trkOffs.length
				for(i = 0; i < nTrkOffs; ++i)
				{
					outputChannels.push(trkOffs[i].midiChannel);
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

