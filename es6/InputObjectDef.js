/*
 *  Public interface contains:
 *     InputChordDef(inputNotesNode) // constructor. Reads the XML in the inputNotesNode.
 *     InputRestDef(msDuration) // constructor
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
 *     trkOn.msPositionInScore (compulsory int >= 0 in seqDef and trkOffs, otherwise omitted). The msPositioninScore of the referenced Trk.
 *     trkOn.nMidiObjects (compulsory int >= 0 in seqDef elements, otherwise omitted). The number of MidiChords and Rests in the referenced Trk.)
 *  
 *  A trkOff, which also has the element name "trk" in the score, has the following fields:
 *     trkOff.trackIndex (compulsory int >= 0. The trackIndex of the voice containing the referenced Trk. )
 *  
 *   An inputChordDef.trkOptions sets the current values in the midi input channel until further notice.
 *   Individual TrkOptions at lower levels temporarily override individual trkOptions at higher levels.
 */

import { TrkOptions } from "./TrkOptions.js";
import { utilities } from "./Utilities.js";

export class InputChordDef
{
	constructor(inputChordNode, midiChannelPerOutputTrack, msDurationInScore)
	{
		var i, chordChildElems, outputTrackPerMidiChannel;

		Object.defineProperty(this, "msDurationInScore", { value: msDurationInScore, writable: false });

		outputTrackPerMidiChannel = this.getOutputTrackPerMidiChannel(midiChannelPerOutputTrack);

		chordChildElems = inputChordNode.children;
		for(i = 0; i < chordChildElems.length; ++i)
		{
			switch(chordChildElems[i].nodeName)
			{
				case 'score:ccSettings':
					this.ccSettings = this.getCCSettings(chordChildElems[i], outputTrackPerMidiChannel, midiChannelPerOutputTrack.length);
					break;
				case 'score:trkOptions':
					this.trkOptions = new TrkOptions(chordChildElems[i]);
					break;
				case 'score:inputNotes':
					this.inputNotes = this.getInputNotes(chordChildElems[i], outputTrackPerMidiChannel);
					break;
			}
		}
		console.assert(this.inputNotes.length > 0);

		return this;
	}

	getOutputTrackPerMidiChannel(midiChannelPerOutputTrack)
	{
		var i, outputTrackPerMidiChannel = [];

		for(i = 0; i < 16; ++i)
		{
			outputTrackPerMidiChannel.push(-1);
		}
		for(i = 0; i < midiChannelPerOutputTrack.length; ++i)
		{
			outputTrackPerMidiChannel[midiChannelPerOutputTrack[i]] = i;
		}
		return outputTrackPerMidiChannel;
	}

	getCCSettings(ccSettingsNode, outputTrackPerMidiChannel, nOutputTracks)
	{
		var i, childElems = ccSettingsNode.children,
			nChildElems = childElems.length,
			ccSettings = [], defaultSettings, trackSettings;

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
					case "trkIndex":
						if(gettingDefault)
						{
							console.assert(false, "Error: Default ccSettings may not have a trkIndex attribute.");
						}
						settings.trackIndex = outputTrackPerMidiChannel[parseInt(attr.value, 10)];
						if(settings.trackIndex < 0)
						{
							console.assert(false, "Error: Unknown MIDI channel.");
						}
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

	getInputNotes(inputNotesNode, outputTrackPerMidiChannel)
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
								case "trkIndex":
									Object.defineProperty(seqTrk, "trackIndex", { value: outputTrackPerMidiChannel[parseInt(attr.value, 10)], writable: false });
									break;
								case "nMidiObjects":
									Object.defineProperty(seqTrk, "nMidiObjects", { value: parseInt(attr.value, 10), writable: false });
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
					midiChannels = utilities.numberArray(midiChannelsString);

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
				if(attr.name === "notatedKey")
				{
					inputNote.notatedKey = parseInt(attr.value, 10);
				}
				else
				{
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

	// returns an array of output track indices
	referencedOutputTrackIndices()
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
	}
}

export class InputRestDef
{
	constructor(msDuration)
	{
		Object.defineProperty(this, "msDurationInScore", { value: msDuration, writable: false });
	}
}

