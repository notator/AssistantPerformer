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
 *  An InputChordDef contains the raw inputChordDef information read directly from the XML.
 *  It is converted later to an InputChord.
 *  An InputChordDef has the following fields:
 *     inputChordDef.ccSettings -- an array of continuous controller settings, one value per output track
 *     inputChordDef.trkOptions -- undefined or a TrkOptions object
 *     inputChordDef.inputNotes[] -- an array of inputNote.
 * 
 *  Each object in the ccSettings array can be undefined. Even if present, the pressure and/or pitchWheel and/or modWheel
 *  attributes may be missing (i.e. be undefined). The following attributes are possible:
 *     pressure -- possible values: "disabled", "aftertouch", "channelPressure", "modulation", "volume",
 *                                  "expression", "timbre", "brightness", "effects", "tremolo", "chorus", "celeste", "phaser"
 *     pitchWheel -- "disabled", "pitch", "speed" or "pan".
 *     modWheel -- possible values: same as pressure
 *     maxVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
 *     minVolume -- an integer in range [1..127]. Defined if one of the above controllers is set to "volume".
 *     pitchWheelDeviation -- the number of semitones deviation when pitchWheel="pitch"
 *     speedDeviation -- the speed factor when pitchWheel="speed"
 *     panOrigin -- the position around which pitchWheel="pan" moves (range 0..127, centre is 64)
 *  These settings determine the effect that each physical controller (pressure, pitchWheel and modWheel) has on each output
 *  track, from the beginning of this inputChord until further notice.
 *  If settings or subsettings are undefined in these ccSettings, the corresponding running track settings remain unchanged.
 *  (The running track settings themselves are never undefined. The default states of the running track pressure.control,
 *  pitchWheel.control and modWheel.control are 'disabled', meaning that that control does not send messages to the track. 
 *  
 *  Each inputNote in the inputChordDef.inputNotes[] has the following fields:
 *     inputNote.notatedKey (a number. The MIDI index of the notated key.)
 *     inputNote.trkOptions -- undefined or an TrkOptions object
 *     inputNote.noteOn -- undefined or see below
 *     inputNote.noteOff -- undefined or see below
 *  
 *  if defined, inputNote.noteOn has the following fields:
 *     inputNote.noteOn.seqDef -- is undefined or an array of trkRef with a (possibly undefined) TrkOptions field.
 *     inputNote.noteOn.trkOffs -- is undefined or an array of trackIndices
 *  
 *  if defined, inputNote.noteOff has no pressures field, but otherwise the same fields as inputNote.noteOn:
 *     inputNote.noteOff.seqDef -- is undefined or an array of trkRef with a (possibly undefined) TrkOptions field.
 *     inputNote.noteOff.trkOffs -- is undefined or an array of trackIndices.
 *  
 *  A trkRef, which has the element name "trk" in the score, has the following fields:
 *     trkOn.trkOptions -- undefined or an TrkOptions object
 *     trkOn.trackIndex (compulsory int >= 0. The trackIndex of the voice containing the referenced Trk. )
 *     trkOn.msPosition (compulsory int >= 0 in seqDef and trkOffs, otherwise omitted). The msPositionInScore of the referenced Trk.
 *     trkOn.nMidiObjects (compulsory int >= 0 in seqDef elements, otherwise omitted). The number of MidiChords and Rests in the referenced Trk.)
 *  
 *  A trkOff, which also has the element name "trk" in the score, has the following fields:
 *     trkOff.trackIndex (compulsory int >= 0. The trackIndex of the voice containing the referenced Trk. )
 *  
 *   An inputChordDef.trkOptions sets the current values in the midi input channel until further notice.
 *   Individual TrkOptions at lower levels temporarily override individual trkOptions at higher levels.
 */

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.inputChordDef');

_AP.inputChordDef = (function ()
{
    "use strict";
	var

	InputChordDef = function(inputChordNode, outputTrackPerMidiChannel)
	{
		var TrkOptions = _AP.trkOptions.TrkOptions,
			i, chordChildElems;
		
		function getCCSettings(ccSettingsNode, outputTrackPerMidiChannel)
		{
			var i, childElems = ccSettingsNode.children,
			nChildElems = childElems.length,
			ccSettings = [], defaultSettings, trackSettings, nOutputTracks = outputTrackPerMidiChannel.length;

			function getSettings(settingsNode, outputTrackPerMidiChannel, gettingDefault)
			{
				var settings = {},
				attributes = settingsNode.attributes,
				attr, attrLen = attributes.length;

				for(i = 0; i < attrLen; ++i)
				{
					attr = attributes[i];
					switch(attr.name)
					{
						case "midiChannel":
							if(gettingDefault)
							{
								alert("Error: Default ccSettings may not have a midiChannel attribute.");
								console.assert(false);
							}
							settings.trackIndex = outputTrackPerMidiChannel[parseInt(attr.value, 10)];
							break;

						case "pressure": // can be undefined
							settings.pressure = attr.value;
							break;

						case "pitchWheel": // can be undefined
							settings.pitchWheel = attr.value;
							break;

						case "modWheel": // can be undefined  (see also maxVolume and minVolume below)
							settings.modWheel = attr.value;
							break;

							// options set if either pressure, or modulation messages are set to control volume
						case "minVolume":
							settings.minVolume = parseInt(attr.value, 10);
							break;
						case "maxVolume":
							settings.maxVolume = parseInt(attr.value, 10);
							break;

						case "pitchWheelDeviation":
							settings.pitchWheelDeviation = parseInt(attr.value, 10);
							break;
						case "speedDeviation":
							settings.speedDeviation = parseFloat(attr.value, 10);
							break;
						case "panOrigin":
							settings.panOrigin = parseInt(attr.value, 10); // (range 0..127, centre is 64)
							break;

						default:
							alert(">>>>>>>>>> Illegal ccSettings attribute <<<<<<<<<<");
							console.assert(false);
					}
				}
				return settings;
			}

			function getDefaultSettings(childElems, outputTrackPerMidiChannel)
			{
				var i, defaultSettings;
				for(i = 0; i < childElems.length; ++i)
				{
					if(childElems[i].nodeName === 'default')
					{
						defaultSettings = getSettings(childElems[i], outputTrackPerMidiChannel, true);
						break;
					}
				}
				return defaultSettings;
			}

			defaultSettings = getDefaultSettings(childElems, outputTrackPerMidiChannel);

			for(i = 0; i < nOutputTracks; ++i)
			{
				ccSettings.push(defaultSettings); // can be undefined (if there are no default settings)
			}

			for(i = 0; i < nChildElems; ++i)
			{
				if(childElems[i].nodeName === 'track')
				{
					trackSettings = getSettings(childElems[i], outputTrackPerMidiChannel, false);
					ccSettings[trackSettings.trackIndex] = trackSettings;
				}
			}
			return ccSettings;
		}

		function getInputNotes(inputNotesNode, outputTrackPerMidiChannel)
		{
			var i, childNodes = inputNotesNode.childNodes,
				inputNotes = [];

			function getInputNote(inputNoteNode, outputTrackPerMidiChannel)
			{
				var attr,
					inputNote = {},
					attrs = inputNoteNode.attributes,
					nAttributes = attrs.length,
					childNodes = inputNoteNode.childNodes,
					i;

				// returns an object that can have seqDef and trkOff attributes
				function getNoteOnOrNoteOff(noteOnOrNoteOffNode, outputTrackPerMidiChannel)
				{
					var i, childNodes = noteOnOrNoteOffNode.childNodes, nChildNodes = childNodes.length,
					noteOnOrNoteOff = {};

					// returns an array of trkRef, possibly having a trkOptions attribute 
					function getSeq(seqNode)
					{
						var i, childNodes, trkRef = [];

						function getTrkRef(trkRefNode)
						{
							var i, attr,
							seqTrk = {},
							attrLen = trkRefNode.attributes.length,
							childNodes = trkRefNode.childNodes;

							for(i = 0; i < attrLen; ++i)
							{
								attr = trkRefNode.attributes[i];
								switch(attr.name)
								{
									case "midiChannel":
										seqTrk.trackIndex = outputTrackPerMidiChannel[parseInt(attr.value, 10)];
										break;
									case "msPosition":
										seqTrk.msPosition = parseInt(attr.value, 10);
										break;
									case "nMidiObjects":
										seqTrk.nMidiObjects = parseInt(attr.value, 10);
										break;
									default:
										console.assert(false, "Illegal attribute for trk element in seqDef.");
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
									trkRef.trkOptions = new TrkOptions(childNodes[i]);
									break;
								case 'trkRef':
									trkRef.push(getTrkRef(childNodes[i]));
									break;
							}
						}
						return trkRef;
					}

					// returns an array of trackIndices
					function getTrkOffs(trkOffsNode)
					{
						var i, midiChannelsString, midiChannels, trkOffs = [];

						console.assert(trkOffsNode.attributes.length === 1 && trkOffsNode.attributes[0].name === "midiChannels",
								"Error: The trkOffs element must always have a single 'midiChannels' attribute.");

						midiChannelsString = trkOffsNode.attributes[0].value;
						midiChannels = _AP.utilities.numberArray(midiChannelsString);
						
						for(i = 0; i < midiChannels.length; ++i)
						{
							trkOffs.push(outputTrackPerMidiChannel[midiChannels[i]]);
						}

						return trkOffs;
					}

					for(i = 0; i < nChildNodes; ++i)
					{
						switch(childNodes[i].nodeName)
						{
							case 'seq':
								noteOnOrNoteOff.seqDef = getSeq(childNodes[i]);
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
							inputNote.noteOn = getNoteOnOrNoteOff(childNodes[i], outputTrackPerMidiChannel);
							break;
						case "noteOff":
							inputNote.noteOff = getNoteOnOrNoteOff(childNodes[i], outputTrackPerMidiChannel);
							break;
					}
				}

				return inputNote;
			}

			for(i = 0; i < childNodes.length; ++i)
			{
				if(childNodes[i].nodeName === 'inputNote')
				{
					inputNotes.push(getInputNote(childNodes[i], outputTrackPerMidiChannel));
				}
			}
			return inputNotes;
		}

		if (!(this instanceof InputChordDef))
		{
			return new InputChordDef(inputChordNode, outputTrackPerMidiChannel);
		}

		chordChildElems = inputChordNode.children;
		for(i = 0; i < chordChildElems.length; ++i)
		{
			switch(chordChildElems[i].nodeName)
			{
				case 'score:ccSettings':
					this.ccSettings = getCCSettings(chordChildElems[i], outputTrackPerMidiChannel);
					break;
				case 'score:trkOptions':
					this.trkOptions = new TrkOptions(chordChildElems[i]);
					break;
				case 'score:inputNotes':
					this.inputNotes = getInputNotes(chordChildElems[i], outputTrackPerMidiChannel);
					break;
			}
		}		
		console.assert(this.inputNotes.length > 0);

        return this;
    },

    // public API
    publicAPI =
    {
        // public InputChordDef(inputNotesNode) constructor.
        InputChordDef: InputChordDef
    };

	// returns an array of output track indices
	InputChordDef.prototype.referencedOutputTrackIndices = function()
	{
		var i, inputNote, nInputNotes = this.inputNotes.length, nonUniqueOutputIndices = [], returnArray = [];

		function outIndices(noteOnOff)
		{
			var i,
			seqDef = noteOnOff.seqDef, nSeqTrks,
			trkOffs = noteOnOff.trkOffs, nTrkOffs,
			outputIndices = [];

			if(seqDef !== undefined)
			{
				nSeqTrks = seqDef.length;
				for(i = 0; i < nSeqTrks; ++i)
				{
					outputIndices.push(seqDef[i].trackIndex);
				}
			}
			if(trkOffs !== undefined)
			{
				nTrkOffs = trkOffs.length;
				for(i = 0; i < nTrkOffs; ++i)
				{
					outputIndices.push(trkOffs[i]);
				}
			}

			return outputIndices;
		}

		function uniqueOutputIndices(nonUniqueOutputIndices)
		{
			var i, nAllOutputIndices = nonUniqueOutputIndices.length, rVal = [];
			for(i = 0; i < nAllOutputIndices; ++i)
			{
				if(rVal.indexOf(nonUniqueOutputIndices[i]) < 0)
				{
					rVal.push(nonUniqueOutputIndices[i]);
				}
			}
			return rVal;
		}

		for(i = 0; i < nInputNotes; ++i)
		{
			inputNote = this.inputNotes[i];
			if(inputNote.noteOn !== undefined)
			{
				nonUniqueOutputIndices = nonUniqueOutputIndices.concat(outIndices(inputNote.noteOn));
			}
			if(inputNote.noteOff !== undefined)
			{
				nonUniqueOutputIndices = nonUniqueOutputIndices.concat(outIndices(inputNote.noteOff));
			}
		}

		returnArray = uniqueOutputIndices(nonUniqueOutputIndices);

		return returnArray;
	};

    return publicAPI;

} ());

