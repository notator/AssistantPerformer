import { StartMarker } from "./Markers.js";
import { EndMarker } from "./Markers.js";
import { Cursor } from "./Cursor.js";
import { MidiChord, MidiRest } from "./MidiObject.js";
import { Track } from "./Track.js";
import { InputChordDef, InputRestDef } from "./InputObjectDef.js";
import { InputChord } from "./InputChord.js";
import { RegionDef } from "./RegionDef.js";

const BLACK_COLOR = "#000000",
	GREY_COLOR = "#7888A0",
	ENABLED_INPUT_TITLE_COLOR = "#3333EE",
	DISABLED_PINK_COLOR = "#FFBBBB";

let midiChannelPerOutputTrack = [], // only output tracks

	tracksData = {},
	// This array is initialized to all tracks on (=true) when the score is loaded,
	// and reset when the tracksControl calls refreshDisplay().
	trackIsOnArray = [], // all tracks, including input tracks

	viewBox,
	viewBoxScale,

	// The frame containing the cursorLine and the start- and end-markers
	markersLayer,

	regionSequence, // a list of unique region definitions. Used at runtime by tracks, and to calculate regionInstanceNamesPerMsPosInScore.
	regionNamesPerMsPosInScore,
	startRegionIndex,
	endRegionIndex,
	currentRegionIndex,
	regionName = "", // used by regionName selector

	setMarkerEvent,
	setMarkerState,

	// See comments in the publicAPI definition at the bottom of this file.
	systemElems = [], // an array of all the systemElems
	systems = [], // an array of all the systems

	// This value is changed when the start runtime button is clicked.
	// It is used when setting the positions of the start and end markers.
	isKeyboard1Performance = false,

	startMarker,
	endMarker,
	cursor, // The (grey) cursor
	systemChanged, // callback, called when running cursor changes systems

	// This callback is called by sequence.tick() if it can't keep up with the speed of a performance,
	// so that moments having different msPositionInScore have had to be sent "synchronously" in a tight loop.
	// nAsynchMomentsSentAtOnce is the number of moments sent "synchronously" during the overload.
	reportTickOverload = function()
	{
		let tickOverloadMarkerElem = cursor.element.cloneNode();

		const LIGHT_BLUE = "#AAAAFF";

		let strokeWidth = parseInt(tickOverloadMarkerElem.style.strokeWidth) / 2,
			strokeWidthString = strokeWidth.toString() + "px";

		tickOverloadMarkerElem.style.stroke = LIGHT_BLUE;
		tickOverloadMarkerElem.style.strokeWidth = strokeWidthString;
		tickOverloadMarkerElem.setAttribute("class", "tickOverloadMarker");

		markersLayer.appendChild(tickOverloadMarkerElem);
	},

	deleteTickOverloadMarkers = function()
	{
		let markerElems = markersLayer.getElementsByClassName("tickOverloadMarker");
		for(let i = markerElems.length - 1; i >= 0; --i)
		{
			markersLayer.removeChild(markerElems[i]);
		}
	},

	// Pushes the values in the trackIsOnArray into the argument (which is an empty array).
	// The returnArray will be garbage collected when it is finished with.
	// This rigmarole so that values in the trackIsOnArray can't be changed except by the tracksControl.
	getReadOnlyTrackIsOnArray = function(returnArray)
	{
		var i;
		console.assert(returnArray.length === 0);

		for(i = 0; i < trackIsOnArray.length; ++i)
		{
			returnArray.push(trackIsOnArray[i]);
		}
	},

	hideStartMarkersExcept = function(startMarker)
	{
		var i, sMarker;
		for(i = 0; i < systems.length; ++i)
		{
			sMarker = systems[i].startMarker;
			if(sMarker === startMarker)
			{
				sMarker.setVisible(true);
			}
			else
			{
				sMarker.setVisible(false);
			}
		}
	},

	hideEndMarkersExcept = function(endMarker)
	{
		var i, eMarker;
		for(i = 0; i < systems.length; ++i)
		{
			eMarker = systems[i].endMarker;
			if(eMarker === endMarker)
			{
				eMarker.setVisible(true);
			}
			else
			{
				eMarker.setVisible(false);
			}
		}
	},

	getTimeObjectsArray = function(system)
	{
		var i, nStaves = system.staves.length, j, voice, nVoices, timeObjects, timeObjectsArray = [];

		for(i = 0; i < nStaves; ++i)
		{
			nVoices = system.staves[i].voices.length;
			for(j = 0; j < nVoices; ++j)
			{
				voice = system.staves[i].voices[j];
				timeObjects = voice.timeObjects;
				timeObjectsArray.push(timeObjects);
			}
		}
		return timeObjectsArray;
	},

	// Returns null or the performing midiChord, midiRest, inputChord, voice end TimeObject or barline closest to alignment
	// (in any performing input or output track, depending on findInput).
	// Displays an alert if an attempt is made to position the start marker at the end of a system, or
	// the end marker at the beginning of a system.
	// If trackIndex is defined, the returned timeObject will be in that track.
	// Returns null if no timeObject can be found that matches the arguments.
	findPerformingTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, findInput, alignment, trackIndex, state)
	{
		var i, j, timeObjects, timeObject = null, timeObjectBefore = null, timeObjectAfter = null, returnTimeObject = null, nTimeObjects,
			nAllTracks = timeObjectsArray.length, deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE, startIndex, endIndex;

		function hasPerformingTrack(inputChordDef, trackIsOnArray)
		{
			var i, outputTrackFound = false, outputTrackIndices;

			console.assert(inputChordDef !== undefined, "inputChordDef must be defined.");

			outputTrackIndices = inputChordDef.referencedOutputTrackIndices();
			for(i = 0; i < outputTrackIndices.length; ++i)
			{
				if(trackIsOnArray[outputTrackIndices[i]])
				{
					outputTrackFound = true;
					break;
				}
				if(outputTrackFound === true)
				{
					break;
				}
			}
			return outputTrackFound;
		}

		startIndex = (findInput === true) ? nOutputTracks : 0;
		endIndex = (findInput === true) ? nAllTracks : nOutputTracks;

		for(i = startIndex; i < endIndex; ++i)
		{
			if(trackIndex === undefined || findInput === true || (i === trackIndex))
			{
				timeObjects = timeObjectsArray[i];
				if(trackIsOnArray[i] === true)
				{
					nTimeObjects = timeObjects.length;
					for(j = 0; j < nTimeObjects; ++j)
					{
						timeObject = timeObjects[j];
						if((findInput === false)  // timeObject contains a midiRest or midiChord
							|| (findInput && // find an inputChord
								(timeObject instanceof InputChordDef && hasPerformingTrack(timeObject, trackIsOnArray))))
						{
							if(alignment === timeObject.alignment)
							{
								returnTimeObject = timeObject;
								break;
							}
							if(alignment > timeObject.alignment && (deltaBefore > (alignment - timeObject.alignment)))
							{
								timeObjectBefore = timeObject;
								deltaBefore = alignment - timeObject.alignment;
							}
							if(alignment < timeObject.alignment && (deltaAfter > (timeObject.alignment - alignment)))
							{
								timeObjectAfter = timeObject;
								deltaAfter = timeObject.alignment - alignment;
							}
						}
					}
				}
			}
		}

		if(returnTimeObject === null)
		{
			if(timeObjectBefore !== null && timeObjectAfter === null)
			{
				returnTimeObject = timeObjectBefore;
			}
			else if(timeObjectAfter !== null && timeObjectBefore === null)
			{
				returnTimeObject = timeObjectAfter;
			}
			else
			{
				returnTimeObject = (deltaAfter < deltaBefore) ? timeObjectAfter : timeObjectBefore;
			}
		}

		if((state.localeCompare('settingEnd') === 0) && returnTimeObject === timeObjects[0])
		{
			alert("The end marker cannot be set at the beginning of a system.\nSet it at the end of the previous one.");
			returnTimeObject = null;
		}

		if(state.localeCompare('settingStart') === 0)
		{
			if(returnTimeObject === timeObjects[timeObjects.length - 1])
			{
				alert("The start marker cannot be set at the end of a system.\nSet it at the start of the next one.");
				returnTimeObject = null;
			}
		}

		return returnTimeObject;
	},

	findPerformingInputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex, state)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, true, alignment, trackIndex, state);
		return returnTimeObject;
	},

	findPerformingOutputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex, state)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, false, alignment, trackIndex, state);
		return returnTimeObject;
	},

	// This function is called by the tracksControl whenever a track's on/off state is toggled.
	// It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
	// Either argument can be undefined, in which case the corresponding internal attribute is not changed.
	refreshDisplay = function(isKeyboard1PerformanceArg, trackIsOnArrayArg)
	{
		var i, system = systems[startMarker.systemIndex],
			startMarkerAlignment = startMarker.alignment,
			timeObjectsArray = getTimeObjectsArray(system), timeObject,
			nOutputTracks = midiChannelPerOutputTrack.length;

		// This function sets the opacity of the visible OutputStaves.
		// (there are no InputStaves in the system, when isKeyboard1Performance === false)
		// Staves have either one or two voices (=tracks).
		// The tracks are 0-indexed channels from top to bottom of the system.
		// If trackIsOnArray[trackIndex] is true, its stafflines opacity is set to 1.
		// If trackIsOnArray[trackIndex] is false, its stafflines opacity is set to 0.3.
		// When the staff has one track, all its stafflines are set for the track.
		// When the staff has two tracks, the top three stafflines are set for the upper track,
		// and the lower two lines are set for the lower track. 
		function setOutputView(trackIsOnArray)
		{
			var i, nSystems = systems.length, j, nStaves = systems[0].staves.length,
				staff, trackIndex, t, nTracksPerStaff,
				opacity, voiceGraphicElements, voiceGraphicElement, g;

			function setStafflinesOpacity(voice, trackIsOnArray, trackIndex, nTracksPerStaff, opacity)
			{
				var voiceStafflinesElem = voice.stafflinesElem;

				if(voiceStafflinesElem !== undefined)
				{
					if(nTracksPerStaff > 1 && (trackIsOnArray[trackIndex] !== trackIsOnArray[trackIndex + 1]))
					{
						opacity = 1;
					}
					voiceStafflinesElem.style.opacity = opacity;
				}
			}

			for(i = 0; i < nSystems; ++i)
			{
				trackIndex = 0;
				for(j = 0; j < nStaves; ++j)
				{
					staff = systems[i].staves[j];
					if(staff.isOutput === false)
					{
						break;
					}
					nTracksPerStaff = staff.voices.length;
					for(t = 0; t < nTracksPerStaff; ++t)
					{
						opacity = (trackIsOnArray[trackIndex]) ? 1 : 0.3;

						setStafflinesOpacity(staff.voices[t], trackIsOnArray, trackIndex, nTracksPerStaff, opacity);

						voiceGraphicElements = staff.voices[t].graphicElements;
						for(g = 0; g < voiceGraphicElements.length; ++g)
						{
							voiceGraphicElement = voiceGraphicElements[g];
							voiceGraphicElement.style.opacity = opacity;
						}

						++trackIndex;
					}
				}
			}
		}

		if(isKeyboard1PerformanceArg !== undefined)
		{
			isKeyboard1Performance = isKeyboard1PerformanceArg;
		}

		if(trackIsOnArrayArg !== undefined)
		{
			trackIsOnArray = trackIsOnArrayArg; // reset by track control
		}
		else if(trackIsOnArray !== undefined)
		{
			// This happens both when the score is initialised, and when
			// it is reloaded after it has already been displayed.
			for(i = 0; i < trackIsOnArray.length; ++i)
			{
				trackIsOnArray[i] = true;
			}
		}

		setOutputView(trackIsOnArray);

		if(isKeyboard1Performance)
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment, undefined, 'settingStart');
		}
		else
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment, undefined, 'settingStart');
		}
		// Move the start marker if necessary.
		// timeObject will be null if there are only rests to be found. In this case, the startMarker doesn't need to be moved.
		if(timeObject !== null && timeObject.alignment !== startMarkerAlignment)
		{
			let barline = system.barlines.find(x => x.msPositionInScore === timeObject.msPositionInScore);
			if(barline !== undefined)
			{
				startMarker.moveTo(barline);
			}
			else
			{
				startMarker.moveTo(timeObject);
			}
		}
	},

	// this function is called only when state is 'settingStart' or 'settingEnd'.
	// It is called again by regionSelectControlMouseOut (above) after selecting a regionName
	svgPageClicked = function(e, state)
	{
		var cursorX = e.pageX,
			cursorY = e.pageY,
			systemIndex, system,
			timeObjectsArray, timeObject, trackIndex, barlineTimeObject,
			nOutputTracks = midiChannelPerOutputTrack.length;

		// Returns the system having stafflines closest to cursorY.
		function findSystemIndex(cursorY)
		{
			var i, topLimit, bottomLimit, systemIndex;

			if(systems.length === 1)
			{
				systemIndex = 0;
			}
			else
			{
				systemIndex = systems.length - 1;
				topLimit = -1;
				for(i = 0; i < systems.length - 1; ++i)
				{
					system = systems[i];
					bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
					if(cursorY >= topLimit && cursorY < bottomLimit)
					{
						systemIndex = i;
						break;
					}
					topLimit = bottomLimit;
				}
			}
			return systemIndex;
		}

		// Returns the index of the visible staff having stafflines closest to cursorY
		// Invisble staves have undefined topLineY and bottomLineY attributes.
		// Note that the correct staff index will be returned, even if the staff has been disabled.
		function findStaffIndex(cursorY, staves)
		{
			var rStaffIndex, i, nStaves = staves.length, staff,
				topYs = [], bottomYs = [], visibleStaffIndices = [], midYBelows = [];

			for(i = 0; i < nStaves; ++i)
			{
				staff = staves[i];
				if(staff.topLineY !== undefined)
				{
					// the staff has stafflines (i.e. is visible)
					visibleStaffIndices.push(i);
					topYs.push(staff.topLineY);
					bottomYs.push(staff.bottomLineY);
				}
			}

			if(visibleStaffIndices.length === 1)
			{
				rStaffIndex = visibleStaffIndices[0];
			}
			else
			{
				for(i = 1; i < visibleStaffIndices.length; ++i)
				{
					midYBelows[i - 1] = (bottomYs[i - 1] + topYs[i]) / 2;
				}
				midYBelows[visibleStaffIndices.length - 1] = Number.MAX_VALUE;

				for(i = 0; i < midYBelows.length; ++i)
				{
					if(cursorY < midYBelows[i])
					{
						rStaffIndex = visibleStaffIndices[i];
						break;
					}
				}
			}

			return rStaffIndex;
		}

		// Returns the index of the voice closest to cursorY
		// The staff containing the voice is visible, but may have been disabled.
		function findVoiceIndex(cursorY, voices)
		{
			var index, nVoices = voices.length, midY;
			if(nVoices === 1)
			{
				index = 0;
			}
			else
			{
				midY = (voices[0].centreY + voices[1].centreY) / 2;
				index = (cursorY < midY) ? 0 : 1;
			}
			return index;
		}

		// Returns the track closest to the cursor, even if the track has been disabled.
		function findTrackIndex(cursorY, system)
		{
			var i, j, staff, staffIndex = findStaffIndex(cursorY, system.staves),
				voiceIndex = findVoiceIndex(cursorY, system.staves[staffIndex].voices),
				trackIndex = 0, found = false;

			for(i = 0; i < system.staves.length; ++i)
			{
				staff = system.staves[i];
				for(j = 0; j < staff.voices.length; ++j)
				{
					if(staffIndex === i && voiceIndex === j)
					{
						found = true;
						break;
					}
					trackIndex++;
				}
				if(found === true)
				{
					break;
				}
			}
			return trackIndex;
		}

		// Returns -1 if the regionName is not present in regionSequence
		function indexInRegionSequence(regionName)
		{
			let index = -1;
			for(let i = 0; i < regionSequence.length; ++i)
			{
				let region = regionSequence[i];
				if(regionName.localeCompare(region.name) === 0)
				{
					index = i;
					break;
				}
			}
			return index;
		}

		// Displays an alert if an attempt was made to set the startMarker or endMarker in the wrong order.
		function selectRegionIndex(timeObject, settingEndMarker)
		{
			function findMsPositionForRegions(timeObject, settingEndMarker)
			{
				let msPos = timeObject.msPositionInScore;
				if(settingEndMarker === true && timeObject.typeString !== undefined && timeObject.typeString.indexOf('Barline') > -1)
				{
					msPos--;
				}
				return msPos;
			}

			function findRegionNamesAtMsPos(msPositionInScore)
			{
				let regionNames = undefined;
				for(let i = 1; i < regionNamesPerMsPosInScore.length; ++i)
				{
					if(regionNamesPerMsPosInScore[i - 1].msPosInScore <= msPositionInScore
						&& regionNamesPerMsPosInScore[i].msPosInScore > msPositionInScore)
					{
						regionNames = regionNamesPerMsPosInScore[i - 1].regionNames;
						break;
					}
				}
				return regionNames;
			}

			// Creates the regionSelectElem and its containing div (=layer).
			// Populates the regionSelectElem's options, and adds the div to the document.
			function openRegionSelectControl(possibleRegionNames, cursorX, cursorY)
			{
				function makeSelectElem(possibleRegionNames, cursorX, cursorY)
				{
					// sets the global regionName variable to the select's current value,
					// then deletes the tempSelectRegionLayer (together with its 'select' element).
					function regionSelectControlMouseLeave()
					{
						let selectElem = document.getElementById("tempRegionSelectElem");

						if(selectElem.selectedIndex > 0)
						{
							regionName = selectElem.options[selectElem.selectedIndex].text.slice(0);

							selectElem.removeEventListener('mouseleave', regionSelectControlMouseLeave, false);

							let selectRegionLayer = document.getElementById("tempSelectRegionLayer");
							selectRegionLayer.removeChild(selectElem);
							document.body.removeChild(selectRegionLayer);

							svgPageClicked(setMarkerEvent, setMarkerState);

							regionName = "";
						}
					}

					let selectElem = document.createElement("select"),
						svgPagesFrame = document.getElementById("svgPagesFrame"),
						scrollTop = svgPagesFrame.scrollTop;

					selectElem.id = "tempRegionSelectElem";
					selectElem.style.position = "absolute";
					selectElem.style.top = (cursorY - scrollTop).toString(10) + "px";
					selectElem.style.left = cursorX.toString(10) + "px";
					selectElem.style.width = "65px";
					selectElem.addEventListener('mouseleave', regionSelectControlMouseLeave);

					var option = document.createElement("option");
					option.text = "region:";
					selectElem.add(option);

					for(let name of possibleRegionNames)
					{
						var option = document.createElement("option");
						option.text = name;
						selectElem.add(option);
					}

					return selectElem;
				}

				function makeSelectRegionLayer(selectElem)
				{
					let svgPagesFrame = document.getElementById("svgPagesFrame"),
						layer = document.createElement("div");

					layer.id = "tempSelectRegionLayer"; // used when deleting this div.
					layer.style.position = "absolute";
					layer.style.margin = "0";
					layer.style.padding = "0";
					layer.style.top = svgPagesFrame.style.top;
					layer.style.left = svgPagesFrame.style.left;
					layer.style.width = svgPagesFrame.style.width;
					layer.style.height = svgPagesFrame.style.height;

					layer.appendChild(selectElem);

					return layer;
				}

				let selectElem = makeSelectElem(possibleRegionNames, cursorX, cursorY),
					selectRegionLayer = makeSelectRegionLayer(selectElem);

				document.body.appendChild(selectRegionLayer);
			}

			function getPossibleRegionNames(msPositionInScore, regionNames, settingEndMarker)
			{
				let possibleNames = [];
				for(let name of regionNames)
				{
					let index = indexInRegionSequence(name);
					if(settingEndMarker === false)
					{
						if(index < endRegionIndex || (index === endRegionIndex && msPositionInScore < endMarker.msPositionInScore))
						{
							possibleNames.push(name);
						}
					}
					else // find end region names
					{
						if(index > startRegionIndex || (index === startRegionIndex && msPositionInScore > startMarker.msPositionInScore))
						{
							possibleNames.push(name);
						}
					}
				}

				if(possibleNames.length === 0)
				{
					if(settingEndMarker === false)
					{
						alert("Can't position the startMarker on or after the endMarker.");
					}
					else
					{
						alert("Can't position the endMarker on or before the startMarker.");
					}
				}

				return possibleNames;
			}

			let msPositionForRegions = findMsPositionForRegions(timeObject, settingEndMarker),
				regionNames = findRegionNamesAtMsPos(msPositionForRegions),
				possibleRegionNames = getPossibleRegionNames(msPositionForRegions, regionNames, settingEndMarker),
				regionIndex = -1;

			if(possibleRegionNames.length > 1)
			{
				openRegionSelectControl(possibleRegionNames, cursorX, cursorY);
			}
			else if(possibleRegionNames.length === 1)
			{
				regionName = possibleRegionNames[0];
				regionIndex = indexInRegionSequence(regionName);
				regionName = "";
			}

			return regionIndex;
		}

		systemIndex = findSystemIndex(cursorY);
		system = systems[systemIndex];

		timeObjectsArray = getTimeObjectsArray(system);

		trackIndex = findTrackIndex(cursorY, system);

		if(isKeyboard1Performance === true)
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex, state);
		}
		else
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex, state);
		}

		// timeObject is either null (if the track has been disabled) or is now the nearest performing chord to the click,
		// either in a live performers voice (if there is one and it is performing) or in a performing output voice.
		if(timeObject !== null)
		{
			barlineTimeObject = system.barlines.find(x => x.msPositionInScore === timeObject.msPositionInScore);
			timeObject = (barlineTimeObject === undefined) ? timeObject : barlineTimeObject;

			let regionIndex = 0;
			switch(state)
			{
				case 'settingStart':
					if(regionName.localeCompare("") === 0)
					{
						regionIndex = selectRegionIndex(timeObject, false);
						setMarkerEvent = e; // gobal: This function is called again with this event when a regionName has been selected.
						setMarkerState = state; // gobal: This function is called again with this state when a regionName has been selected. 
					}
					else regionIndex = indexInRegionSequence(regionName);

					if(regionIndex >= 0 && (regionSequence.length === 1 || regionIndex <= endRegionIndex))
					{
						startRegionIndex = regionIndex;
						startMarker = system.startMarker;
						hideStartMarkersExcept(startMarker);
						startMarker.moveTo(timeObject);
						if(regionSequence.length > 1)
						{
							startMarker.setName(regionSequence[startRegionIndex].name);
						}
					}
					currentRegionIndex = regionIndex;
					break;
				case 'settingEnd':
					if(regionName.localeCompare("") === 0)
					{
						regionIndex = selectRegionIndex(timeObject, true);
						setMarkerEvent = e; // gobal: This function is called again with this event when a regionName has been selected.
						setMarkerState = state; // gobal: This function is called again with this state when a regionName has been selected. 
					}
					else regionIndex = indexInRegionSequence(regionName);

					if(regionIndex >= 0 && (regionSequence.length === 1 || regionIndex >= startRegionIndex))
					{
						endRegionIndex = regionIndex;
						endMarker = system.endMarker;
						hideEndMarkersExcept(endMarker);
						endMarker.moveTo(timeObject);
						if(regionSequence.length > 1)
						{
							endMarker.setName(regionSequence[endRegionIndex].name);
						}
					}
					break;
				default:
					break;
			}
		}
	},

	hideCursor = function()
	{
		cursor.setVisible(false);
	},

	setActiveInfoStringsStyle = function(regionIndex)
    {
        // setActiveInfoStringsStyle is only defined if there are InfoStrings whose style needs to be set.
        // There are no InfoStrings if the score contains no regionInfoStringElems. This is the case for
        // all scores prior to Tombeau 1.
        // see Score.getRegionData(svgElem).
        if(regionSequence[regionIndex].setActiveInfoStringsStyle !== undefined)
        {
            console.assert(regionSequence.length > 1, "console assertion failed!");
            regionSequence[regionIndex].setActiveInfoStringsStyle(true);
        }
	},

	leaveRegion = function(regionIndex)
	{
		// There are no regionInfo boxes if there is only one region.
		if(regionSequence.length > 1)
		{
			// regionIndex is -1 when starting in the first region.
			if(regionIndex >= 0)  
			{
				regionSequence[regionIndex].setActiveInfoStringsStyle(false);
			}

			currentRegionIndex = regionIndex + 1;
			if(currentRegionIndex < regionSequence.length)
			{
				regionSequence[currentRegionIndex].setActiveInfoStringsStyle(true);
			}
		}
	},

	resetRegionInfoStrings = function()
	{
		// There are no regionInfo boxes if there is only one region.
		if(regionSequence.length > 1)
		{
			for(let regionDef of regionSequence)
			{
				regionDef.setActiveInfoStringsStyle(false);
			}
		}
	},

	// Called when the go button or a startConducting button is clicked.
	setCursor = function()
	{
		cursor.set(systems, startMarker.msPositionInScore, endMarker.msPositionInScore, trackIsOnArray);
	},

	// Constructs empty systems for all the pages.
	// Each page has a frame and the correct number of empty systems.
	// Each system has a startMarker and an endMarker, but these are left
	// on the left edge of the page.
	// Each system has the correct number of staves containing the correct number of voices.
	// The staves have a boolean isOutput attribute that is set to true or false.
	// The voices have a set boolean isOutput attribute, but as yet no timeObject arrays.
	// The score's trackIsOnArray is initialized to all tracks on (=true).
	// If isKeyboard1Performance === true, then outputStaves are grey, inputStaves are black.
	// If isKeyboard1Performance === false, then outputStaves are black, inputStaves are pink.
	getEmptySystems = function(isKeyboard1PerformanceArg)
	{
		var system, svgPageEmbeds,
			svgPage, svgElem, pageSystemsElem, pageSystemElems, systemElem;

		function resetContent(isKeyboard1PerformanceArg)
		{
			isKeyboard1Performance = isKeyboard1PerformanceArg;
			systemElems.length = 0;
			systems.length = 0;
			midiChannelPerOutputTrack.length = 0;
			trackIsOnArray.length = 0;
		}

		function getSVGElem(svgPage)
		{
			let svgPageContent = svgPage.contentDocument;
			svgElem = svgPageContent.getElementsByTagName("svg")[0];

			return svgElem;
		}

		function getEmptySystem(viewBoxScale, systemElem)
		{
			var i, j,
				systemDy, staffDy,
				staffElems, staffElem, stafflinesElem,
				outputVoiceElems, inputVoiceElems,
				staff, stafflineInfo,
				voice;

			function getElems(containerElem, classString1, classString2)
			{
				var elems1 = containerElem.getElementsByClassName(classString1),
					elems2 = containerElem.getElementsByClassName(classString2),
					elems = [],
					i;

				for(i = 0; i < elems1.length; ++i)
				{
					elems.push(elems1[i]);
				}
				for(i = 0; i < elems2.length; ++i)
				{
					elems.push(elems2[i]);
				}

				return elems;
			}

			// returns an info object containing left, right and stafflineYs
			function getStafflineInfo(stafflinesElem, dy)
			{
				var i, rStafflineInfo = {}, stafflineYs = [], left, right, stafflineY,
					lineElem, staffLinesElemChildren = stafflinesElem.children;

				for(i = 0; i < staffLinesElemChildren.length; ++i)
				{
					console.assert(staffLinesElemChildren[i].nodeName === "line");
					lineElem = staffLinesElemChildren[i];
					stafflineY = parseFloat(lineElem.getAttribute('y1')) + dy;
					stafflineYs.push((stafflineY / viewBoxScale));
					left = parseFloat(lineElem.getAttribute('x1'));
					left /= viewBoxScale;
					right = parseFloat(lineElem.getAttribute('x2'));
					right /= viewBoxScale;
				}

				rStafflineInfo.left = left;
				rStafflineInfo.right = right;
				rStafflineInfo.stafflineYs = stafflineYs;

				return rStafflineInfo;
			}

			function setVoiceCentreYs(staffTopY, staffBottomY, voices)
			{
				if(voices.length === 1)
				{
					voices[0].centreY = (staffTopY + staffBottomY) / 2;
				}
				else // voices.length === 2
				{
					voices[0].centreY = staffTopY;
					voices[1].centreY = staffBottomY;
				}
			}

			function setStaffColours(staff, isKeyboard1Performance)
			{
				function setStaffNameStyle(staff, titleColor)
				{
					staff.nameElem.style.fill = titleColor;

					if(titleColor === ENABLED_INPUT_TITLE_COLOR)
					{
						staff.nameElem.style.fontWeight = 'bold';
					}
					else
					{
						staff.nameElem.style.fontWeight = 'normal';
					}
				}

				function setStafflinesColor(staff, color)
				{
					let stafflines = staff.stafflines;
					let nStafflines = stafflines.length;
					for(let i = 0; i < nStafflines; ++i)
					{
						stafflines[i].style.stroke = color;
					}
				}

				function setGreyDisplay(staff)
				{
					setStaffNameStyle(staff, GREY_COLOR);
					setStafflinesColor(staff, GREY_COLOR);
				}

				function setBlackDisplay(staff)
				{
					setStaffNameStyle(staff, BLACK_COLOR);
					setStafflinesColor(staff, BLACK_COLOR);
				}

				function setLiveInputDisplay(staff)
				{
					setStaffNameStyle(staff, ENABLED_INPUT_TITLE_COLOR);
					setStafflinesColor(staff, BLACK_COLOR);
				}

				function setDisabledInputDisplay(staff)
				{
					setStaffNameStyle(staff, DISABLED_PINK_COLOR);
					setStafflinesColor(staff, DISABLED_PINK_COLOR);
				}

				if(staff.isOutput === true)
				{
					if(isKeyboard1Performance)
					{
						setGreyDisplay(staff);
					}
					else
					{
						setBlackDisplay(staff);
					}
				}
				if(staff.isOutput === false)
				{
					if(isKeyboard1Performance)
					{
						setLiveInputDisplay(staff);
					}
					else
					{
						setDisabledInputDisplay(staff);
					}
				}
			}

			function getNameElem(staffChild)
			{
				var i, voiceChildren = staffChild.childNodes, nameElem;

				for(i = 0; i < voiceChildren.length; ++i)
				{
					if(voiceChildren[i].nodeName === "text")
					{
						nameElem = voiceChildren[i];
						break;
					}
				}
				return nameElem;
			}

			function getDy(nodeElem)
			{
				var dy = 0, transformStr, indexOfTranslate, params, yStr;

				transformStr = nodeElem.getAttribute("transform");

				if(transformStr !== null)
				{
					indexOfTranslate = transformStr.indexOf("translate(");
					if(indexOfTranslate >= 0)
					{
						params = transformStr.slice(indexOfTranslate + "translate(".length);
						yStr = params.split(",")[1];
						dy = parseFloat(yStr);
					}
				}

				return dy;
			}

			system = {};
			systemDy = getDy(systemElem);

			system.staves = [];

			staffElems = getElems(systemElem, "staff", "inputStaff");

			for(i = 0; i < staffElems.length; ++i)
			{
				staffElem = staffElems[i];
				staff = {};
				staffDy = systemDy + getDy(staffElem);
				staff.isOutput = (staffElem.getAttribute("class") === "staff");
				staff.voices = [];
				system.staves.push(staff);

				if(staff.isOutput === true)
				{
					outputVoiceElems = staffElem.getElementsByClassName("voice");
					stafflinesElem = staffElem.getElementsByClassName("stafflines")[0];
					staff.nameElem = getNameElem(outputVoiceElems[0]);
					for(j = 0; j < outputVoiceElems.length; ++j)
					{
						voice = {};
						voice.isOutput = true;
						staff.voices.push(voice);
					}
				}
				else // input staff
				{
					inputVoiceElems = staffElem.getElementsByClassName("inputVoice");
					stafflinesElem = staffElem.getElementsByClassName("inputStafflines")[0];
					staff.nameElem = getNameElem(inputVoiceElems[0]);
					for(j = 0; j < inputVoiceElems.length; ++j)
					{
						voice = {};
						voice.isOutput = false;
						staff.voices.push(voice);
					}
				}

				if(stafflinesElem !== undefined)
				{
					stafflineInfo = getStafflineInfo(stafflinesElem, staffDy);
					system.left = stafflineInfo.left;
					system.right = stafflineInfo.right;

					staff.stafflines = stafflinesElem.children;
					staff.topLineY = stafflineInfo.stafflineYs[0];
					staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];

					setStaffColours(staff, isKeyboard1Performance);
					setVoiceCentreYs(staff.topLineY, staff.bottomLineY, staff.voices);

					if(system.topLineY === undefined)
					{
						system.topLineY = staff.topLineY;
						system.bottomLineY = staff.bottomLineY;
					}
					else
					{
						system.topLineY = (system.topLineY < staff.topLineY) ? system.topLineY : staff.topLineY;
						system.bottomLineY = (system.bottomLineY > staff.bottomLineY) ? system.bottomLineY : staff.bottomLineY;
					}
				}
			}

			return system;
		}

		// uses the <regionSequence> element to set the following values (global inside Score.js):
		// 	   startRegionIndex, endRegionIndex, regionSequence.
		function getRegionData(svgElem)
		{
			let regionSeq = [],
				regionDefElems = svgElem.getElementsByClassName("regionDef"),
				regionInfoStringElems = svgElem.getElementsByClassName("regionInfoString");

			if(regionDefElems.length === 0)
			{
				// default is to define a region that contains the whole score
				regionSeq.push({ name: "a", fromStartOfBar: 1, startMsPosInScore: 0, toEndOfBar: "last", endMsPosInScore: Number.MAX_VALUE });
			}
			else
			{
				for(let regionDefElem of regionDefElems)
				{
					let regionDef = new RegionDef(regionDefElem, regionInfoStringElems);
					regionSeq.push(regionDef);
				}

				//The first regionDef must have startMsPosInScore = "0".
				console.assert(regionSeq[0].startMsPosInScore === 0);
			}

			startRegionIndex = 0;
			endRegionIndex = regionSeq.length - 1;
			regionSequence = regionSeq;
		}

		// Creates the internal global markersLayer and its startMarkers and endMarkers
		function setMarkersLayer(svgElem, systems, regionSequence, vbScale)
		{
			// Creates a new "g" element at the top level of the svg page.
			// The element contains a transparent, clickable rect.
			// The markers and timePointer are added to the markersLayer later.
			function createMarkersLayer(svgElem)
			{
				var viewBox = svgElem.viewBox.baseVal,
					markersLayer = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

				markersLayer.setAttribute("style", "display:inline");

				rect.setAttribute("x", viewBox.x.toString(10));
				rect.setAttribute("y", viewBox.y.toString(10));
				rect.setAttribute("width", viewBox.width.toString(10));
				rect.setAttribute("height", viewBox.height.toString(10));
				rect.setAttribute("style", "stroke:none; fill:#ffffff; fill-opacity:0");
				markersLayer.appendChild(rect);

				svgElem.appendChild(markersLayer);

				return markersLayer;
			}

			// returns an array containing nSystems {top, bottom} objects
			function getMarkerYLimitsArray(systems)
			{
				let ys = [], nSystems = systems.length,
					topDelta = 10 + (systems[0].topLineY / 2);

				ys.push(topDelta);
				for(let i = 1; i < nSystems; ++i)
				{
					ys.push(systems[i - 1].bottomLineY + ((systems[i].topLineY - systems[i - 1].bottomLineY) / 2));
				}
				let bottomDelta = (nSystems === 1) ? topDelta : ((systems[nSystems - 1].topLineY - systems[nSystems - 2].bottomLineY) / 2);
				ys.push(systems[nSystems - 1].bottomLineY + bottomDelta);

				let returnArray = [];
				for(let i = 0; i < nSystems; ++i)
				{
					returnArray.push({ "top": ys[i], "bottom": ys[i + 1] });
				}

				return returnArray;
			}

			// markersLayer is global inside the score namespace
			markersLayer = createMarkersLayer(svgElem);

			let markerYLimitsArray = getMarkerYLimitsArray(systems);
			for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
			{
				let yCoordinates = { top: markerYLimitsArray[systemIndex].top + 5, bottom: markerYLimitsArray[systemIndex].bottom - 5 };

				system = systems[systemIndex];

				system.startMarker = new StartMarker(yCoordinates, systemIndex, regionSequence, vbScale);
				markersLayer.appendChild(system.startMarker.element);

				system.endMarker = new EndMarker(yCoordinates, systemIndex, regionSequence, vbScale);
				markersLayer.appendChild(system.endMarker.element);
			}
		}

		function initializeTrackIsOnArray(system)
		{
			var i, j, staff;

			trackIsOnArray = []; // score variable
			for(i = 0; i < system.staves.length; ++i)
			{
				staff = system.staves[i];
				for(j = 0; j < staff.voices.length; ++j)
				{
					if(staff.voices[j].isOutput === false && isKeyboard1Performance === false)
					{
						trackIsOnArray.push(false);
					}
					else
					{
						trackIsOnArray.push(true);
					}
				}
			}
		}

		// Sets the global viewBox object and the sizes and positions of the objects on the svgPagesFrame)
		// Returns the viewBox in the final page of the score.
		function setGraphics()
		{
			var
				i, svgPage, svgElem, embedsWidth, pagesFrameWidth,
				svgRuntimeControlsElem = document.getElementById("svgRuntimeControls"),
				svgPagesFrameElem = document.getElementById("svgPagesFrame"), svgPagesFrameElemHeight,
				svgPageEmbeds = svgPagesFrameElem.getElementsByClassName("svgPage"),
				leftpx, nPages = svgPageEmbeds.length;

			function getViewBox(svgElem)
			{
				var height, viewBox = {}, viewBoxStr, viewBoxStrings;

				height = parseFloat(svgElem.getAttribute('height'));
				viewBoxStr = svgElem.getAttribute('viewBox');
				viewBoxStrings = viewBoxStr.split(' ');

				viewBox.x = parseFloat(viewBoxStrings[0]);
				viewBox.y = parseFloat(viewBoxStrings[1]);
				viewBox.width = parseFloat(viewBoxStrings[2]);
				viewBox.height = parseFloat(viewBoxStrings[3]);
				viewBox.scale = viewBox.height / height;

				return viewBox;
			}

			leftpx = ((window.innerWidth - parseInt(svgRuntimeControlsElem.style.width, 10)) / 2).toString() + "px";
			svgRuntimeControlsElem.style.left = leftpx;

			for(i = 0; i < nPages; ++i)
			{
				svgPage = svgPageEmbeds[i];
				svgElem = getSVGElem(svgPage);
				viewBox = getViewBox(svgElem); // global
				embedsWidth = Math.ceil(viewBox.width / viewBox.scale);
				svgPageEmbeds[i].style.width = embedsWidth.toString() + "px";
				svgPageEmbeds[i].style.height = (Math.ceil(viewBox.height / viewBox.scale)).toString() + "px";
			}

			pagesFrameWidth = embedsWidth + 17;
			svgPagesFrameElem.style.width = pagesFrameWidth.toString() + "px";
			svgPagesFrameElemHeight = (window.innerHeight - parseInt(svgPagesFrameElem.style.top, 10) - 2);
			svgPagesFrameElem.style.height = svgPagesFrameElemHeight.toString() + "px";
			leftpx = (Math.ceil((window.innerWidth - pagesFrameWidth) / 2)).toString() + "px";
			svgPagesFrameElem.style.left = leftpx;

			viewBoxScale = viewBox.scale;

			return viewBox;
		}

		/*************** end of getEmptySystems function definitions *****************************/

		resetContent(isKeyboard1PerformanceArg);

		viewBox = setGraphics(); // the viewBox is the area in which the score can be seen and is scrolled

		svgPageEmbeds = document.getElementsByClassName("svgPage");

		if(svgPageEmbeds.length !== 1)
		{
			throw "Only single page (scroll) scores are supported.";
		}
		svgPage = svgPageEmbeds[0];
		svgElem = getSVGElem(svgPage);
		pageSystemsElem = svgElem.getElementsByClassName("systems")[0];
		pageSystemElems = pageSystemsElem.getElementsByClassName("system");

		getRegionData(svgElem); // sets regionSequence and default values for startRegionIndex, endRegionIndex. 
 
		for(let systemIndex = 0; systemIndex < pageSystemElems.length; ++systemIndex)
		{
			systemElem = pageSystemElems[systemIndex];
			systemElems.push(systemElem);

			system = getEmptySystem(viewBox.scale, systemElem);
			systems.push(system); // systems is global inside the score namespace
		}

		// markersLayer is a new layer in (on top of) the svg of the score
		setMarkersLayer(svgElem, systems, regionSequence, viewBox.scale);

		initializeTrackIsOnArray(systems[0]);
	},

	setEndMarkerClick = function(e)
	{
		svgPageClicked(e, 'settingEnd');
	},

	setStartMarkerClick = function(e)
	{
		svgPageClicked(e, 'settingStart');
	},

	sendStartMarkerToStart = function()
	{
		startMarker = systems[0].startMarker;
		startMarker.setName(regionSequence[0].name);
		hideStartMarkersExcept(startMarker);
		startMarker.moveTo(systems[0].barlines[0]);
		startMarker.setVisible(true);
		startRegionIndex = 0;
	},

	sendEndMarkerToEnd = function()
	{
		function getSystemIndex(endMsPosInScore)
		{
			var endSystemIndex = systems.length - 1;
			for(var i = 0; i < systems.length; i++)
			{
				var timeObjects = systems[i].staves[0].voices[0].timeObjects;
				if(timeObjects[timeObjects.length - 1].msPositionInScore >= endMsPosInScore)
				{
					endSystemIndex = i;
					break;
				}
			}
			return endSystemIndex;
		}

		var endMsPosInScore = regionSequence[regionSequence.length - 1].endMsPosInScore,
			endSystemIndex = getSystemIndex(endMsPosInScore),
			barlineTimeObjects = systems[endSystemIndex].barlines,
			barlineTimeObject = barlineTimeObjects.find(x => x.msPositionInScore === endMsPosInScore); 

		endMarker = systems[endSystemIndex].endMarker;
		endMarker.setName(regionSequence[regionSequence.length - 1].name);
		hideEndMarkersExcept(endMarker);
		endMarker.moveTo(barlineTimeObject);
		endMarker.setVisible(true);
		endRegionIndex = regionSequence.length - 1;
	},

	startMarkerMsPosition = function()
	{
		return startMarker.msPositionInScore;
	},

	endMarkerMsPosition = function()
	{
		return endMarker.msPositionInScore;
	},

	// Called when the start button is clicked in the top options panel,
	// and when setOptions button is clicked at the top of the score.
	// If the startMarker is not fully visible in the svgPagesDiv, move
	// it to the top of the div.
	moveStartMarkerToTop = function(svgPagesDiv)
	{
		var height = Math.round(parseFloat(svgPagesDiv.style.height)),
			scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

		startMarkerYCoordinates = startMarker.yCoordinates;

		if((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
		{
			if(startMarker.systemIndex === 0)
			{
				svgPagesDiv.scrollTop = 0;
			}
			else
			{
				svgPagesDiv.scrollTop = startMarkerYCoordinates.top - 10;
			}
		}
	},

	// Advances the cursor to msPosition (in any channel)
	// Sets the cursor invisible when the end of the score is reached.
	advanceCursor = function(msPositionInScore)
	{
		if(msPositionInScore === endMarker.msPositionInScore && currentRegionIndex === endRegionIndex)
		{
			cursor.setVisible(false);
		}
		else
		{
			cursor.moveElementTo(msPositionInScore);
		}
	},

	// tracksData has the following defined attributes:
	//        inputTracks[] - an array of tracks containing inputChords
	//        outputTracks[] - an array of tracks containing midiChords and midiRests
	//        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
	//            inputKeyRange.bottomKey
	//            inputKeyRange.topKey
	setTracksData = function()
	{
		// systems->staves->voices->timeObjects
		var
			inputTracks = [], outputTracks = [],
			outputTrackIndex = 0, inputTrackIndex = 0, inputTrack, outputTrack,
			timeObjectIndex, nTimeObjects, timeObject,
			voiceIndex, nVoices, voice,
			staffIndex, nStaves, staff,
			sysIndex, nSystems = systems.length, system, systemElem,
			inputChord;

		// Gets the chord and rest timeObjects for both input and output voices, and
		// the barline timeObjects for each system. 
		function getVoiceAndSystemTimeObjects()
		{
			var i;

			function getVoiceTimeObjects()
			{

				function getStaffElems(systemElem)
				{
					var outputStaffElems = systemElem.getElementsByClassName("staff"),
						inputStaffElems = systemElem.getElementsByClassName("inputStaff"),
						i, staffElems = [];

					for(i = 0; i < outputStaffElems.length; ++i)
					{
						staffElems.push(outputStaffElems[i]);
					}
					for(i = 0; i < inputStaffElems.length; ++i)
					{
						staffElems.push(inputStaffElems[i]);
					}
					return staffElems;
				}

				function getTimeObjects(systemIndex, voiceElem, viewBoxScale1)
				{
					var noteObjectElems, noteObjectClass,
						timeObjects = [], noteObjectAlignment, msDuration,
						timeObject, i, j, noteObjectElem, noteObjectChildren,
						scoreMidiElem;

					noteObjectElems = voiceElem.children;
					for(i = 0; i < noteObjectElems.length; ++i)
					{
						noteObjectElem = noteObjectElems[i];
						noteObjectClass = noteObjectElem.getAttribute('class');
						// noteObjectAlignment will be null if this is not a chord or rest, or if the chord or rest is invisible
						noteObjectAlignment = noteObjectElem.getAttribute('score:alignment');

						if(noteObjectClass === 'chord' || noteObjectClass === 'rest')
						{
							noteObjectChildren = noteObjectElem.children;
							for(j = 0; j < noteObjectChildren.length; ++j)
							{
								if(noteObjectChildren[j].nodeName === "score:midi")
								{
									scoreMidiElem = noteObjectChildren[j];
									if(noteObjectClass === 'chord')
									{
										timeObject = new MidiChord(scoreMidiElem, systemIndex);
									}
									else
									{
										timeObject = new MidiRest(scoreMidiElem, systemIndex); // see MidiChord constructor.
									}
									break;
								}
							}
							if(timeObject.msDurationInScore < 1)
							{
								throw "Error: The score contains chords having zero duration!";
							}

							if(noteObjectAlignment !== null)
							{
								timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
							}
							timeObjects.push(timeObject);
						}
						else if(noteObjectClass === 'inputChord' || noteObjectClass === 'inputRest')
						{
							msDuration = parseInt(noteObjectElem.getAttribute('score:msDuration'), 10);
							if(noteObjectClass === 'inputChord')
							{
								timeObject = new InputChordDef(noteObjectElem, midiChannelPerOutputTrack, msDuration);
							}
							else if(noteObjectClass === 'inputRest')
							{
								timeObject = new InputRestDef(msDuration);
							}

							if(noteObjectAlignment !== null)
							{
								timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;
							}

							timeObjects.push(timeObject);
						}
					}

					return timeObjects;
				}

				// These are SVG elements in the voice that will have their opacity changed when the voice is disabled.
				function getGraphicElements(systemIndex, voiceElem)
				{
					var graphicElements = [], type, i, noteObjectElems, noteObjectElem;

					noteObjectElems = voiceElem.children;
					for(i = 0; i < noteObjectElems.length; ++i)
					{
						noteObjectElem = noteObjectElems[i];
						type = noteObjectElem.getAttribute('class');
						if(type === 'staffName'
							|| type === 'clef'
							|| type === 'cautionaryChord'
							|| type === 'beamBlock'
							|| type === 'chord' || type === 'rest'
							|| type === 'smallClef'
							|| type === 'barline'
							|| type === 'endBarline' // note that this is a group (a barline and a thickBarline)
							|| type === 'inputStaffName'
							|| type === 'inputClef'
							|| type === 'inputBeamBlock'
							|| type === 'inputChord' || type === 'inputRest'
							|| type === 'inputSmallClef')
						{
							graphicElements.push(noteObjectElem);
						}
					}

					return graphicElements;
				}

				function setVoices(systemIndex, staff, staffElem, voiceType, viewBoxScale1)
				{
					var voiceElems, voiceElem, isFirstVoiceInStaff;

					voiceElems = staffElem.getElementsByClassName(voiceType);
					isFirstVoiceInStaff = true;
					for(voiceIndex = 0; voiceIndex < voiceElems.length; ++voiceIndex)
					{
						voiceElem = voiceElems[voiceIndex];
						voice = staff.voices[voiceIndex];
						voice.timeObjects = getTimeObjects(systemIndex, voiceElem, viewBoxScale1);
						if(voice.timeObjects[0].alignment !== undefined)  // is undefined if the voice is invisible
						{
							voice.graphicElements = getGraphicElements(systemIndex, voiceElem); // will be used to set opacity when the voice is disabled
							if(isFirstVoiceInStaff === true)
							{
								voice.staffLinesElem = staffElem.getElementsByClassName("staffLines");
								isFirstVoiceInStaff = false;
							}
						}
					}
				}

				function getSystemOutputVoiceObjects(systemIndex, systemElem, system, viewBoxScale1)
				{
					var staffElems, staffElem,
						staff,
						staffIndex;

					// Moritz now always enforces that
					// 1. Every system contains all tracks
					// 2. Each track's MidiChannel is the same as its index (from top to bottom in each system).
					// The top track therefore always has MidiChannel == 0, and the
					// MidiChannels increase contiguously from top to bottom of each system.
					function getMidiChannelPerOutputTrack(system)
					{
						let staves = system.staves, staffIndex, voiceIndex, voices, trackIndex = 0;

						midiChannelPerOutputTrack.length = 0; // global array

						for(staffIndex = 0; staffIndex < staves.length; staffIndex++)
						{
							if(staves[staffIndex].isOutput === false)
							{
								break;
							}
							voices = staves[staffIndex].voices;
							for(voiceIndex = 0; voiceIndex < voices.length; voiceIndex++)
							{
								midiChannelPerOutputTrack.push(trackIndex++);
							}
						}
					}

					staffElems = getStaffElems(systemElem);
					staffIndex = 0;
					while(staffIndex < staffElems.length)
					{
						staff = system.staves[staffIndex];
						if(staff.isOutput === false)
						{
							break;
						}
						staffElem = staffElems[staffIndex];
						setVoices(systemIndex, staff, staffElem, "voice", viewBoxScale1);
						staffIndex++;
					}

					if(systemIndex === 0)
					{
						getMidiChannelPerOutputTrack(systems[0]);
					}
				}

				function getSystemInputVoiceObjects(systemIndex, systemElem, system, viewBoxScale1)
				{
					var staffElems, staffElem,
						staff,
						staffIndex,
						nOutputTracks = midiChannelPerOutputTrack.length;

					staffElems = getStaffElems(systemElem);

					for(staffIndex = nOutputTracks; staffIndex < staffElems.length; ++staffIndex)
					{
						staff = system.staves[staffIndex];
						staffElem = staffElems[staffIndex];
						setVoices(systemIndex, staff, staffElem, "inputVoice", viewBoxScale1);
						staffIndex++;
					}
				}

				// Sets the msPosition of each timeObject (input and output rests and chords) in the voice.timeObjects arrays.
				function setMsPositions(systems)
				{
					var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
						timeObject, timeObjects, nTimeObjects, tIndex;

					nSystems = systems.length;
					nStaves = systems[0].staves.length;
					msPosition = 0;
					for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
					{
						nVoices = systems[0].staves[staffIndex].voices.length;
						for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
						{
							for(systemIndex = 0; systemIndex < nSystems; ++systemIndex)
							{
								timeObjects = systems[systemIndex].staves[staffIndex].voices[voiceIndex].timeObjects;
								if(timeObjects !== undefined)
								{
									nTimeObjects = timeObjects.length;
									for(tIndex = 0; tIndex < nTimeObjects; ++tIndex)
									{
										timeObject = timeObjects[tIndex];

										if(timeObject instanceof MidiChord || timeObject instanceof MidiRest ||
											timeObject instanceof InputChordDef || timeObject instanceof InputRestDef)
										{
											Object.defineProperty(timeObject, "msPositionInScore", { value: msPosition, writable: false });
										}

										msPosition += timeObject.msDurationInScore;
									}
								}
							}
							msPosition = 0;
						}

					}
				}

				// If the first timeObject in a voice has no Alignment attribute,
				// it is set to the value for the system.
				function setFirstTimeObjectAlignment(systems)
				{
					var i, nSystems = systems.length, system,
						firstAlignment;

					function getFirstAlignment(system)
					{
						var j, k, staff, nStaves = system.staves.length,
							voice, nVoices, firstAlignment = -1;

						for(j = 0; j < nStaves; ++j)
						{
							staff = system.staves[j];
							nVoices = staff.voices.length;
							for(k = 0; k < nVoices; ++k)
							{
								voice = staff.voices[k];
								if(voice.timeObjects[0].alignment !== undefined)
								{
									firstAlignment = voice.timeObjects[0].alignment;
									break;
								}
							}
							if(firstAlignment > -1)
							{
								break;
							}
						}
						return firstAlignment;
					}

					function setFirstAlignment(system, firstAlignment)
					{
						var j, k, staff, nStaves = system.staves.length,
							voice, nVoices;

						for(j = 0; j < nStaves; ++j)
						{
							staff = system.staves[j];
							nVoices = staff.voices.length;
							for(k = 0; k < nVoices; ++k)
							{
								voice = staff.voices[k];
								if(voice.timeObjects !== undefined && voice.timeObjects[0].alignment === undefined)
								{
									voice.timeObjects[0].alignment = firstAlignment;
								}
							}
						}
					}

					for(i = 0; i < nSystems; ++i)
					{
						system = systems[i];
						firstAlignment = getFirstAlignment(system);
						setFirstAlignment(system, firstAlignment);
					}
				}

				// These are needed for aligning start and end markers.
				function appendVoiceEndTimeObjects(systems)
				{
					var systemIndex, nSystems = systems.length, system,
						j, nStaves, staff,
						k, nVoices, voice,
						rightmostAlignment = systems[0].right,
						startMsPositionOfNextSystem,
						lastTimeObject,
						endMsPositionInScore;

					function getStartMsPositionOfNextSystem(staves)
					{
						var i, j, firstMsPos, nStaves = staves.length, minMsPos = Number.MAX_VALUE;

						for(i = 0; i < nStaves; ++i)
						{
							staff = staves[i];
							for(j = 0; j < staff.voices.length; ++j)
							{
								if(staff.voices[j].timeObjects !== undefined)
								{
									firstMsPos = staff.voices[j].timeObjects[0].msPositionInScore;
									minMsPos = (minMsPos < firstMsPos) ? minMsPos : firstMsPos;
								}
							}
						}
						return minMsPos;
					}

					for(systemIndex = 0; systemIndex < nSystems; ++systemIndex)
					{
						system = systems[systemIndex];
						if(systemIndex < nSystems - 1)
						{
							startMsPositionOfNextSystem = getStartMsPositionOfNextSystem(systems[systemIndex + 1].staves);
						}
						nStaves = system.staves.length;
						for(j = 0; j < nStaves; ++j)
						{
							staff = system.staves[j];
							nVoices = staff.voices.length;
							for(k = 0; k < nVoices; ++k)
							{
								voice = staff.voices[k];
								if(voice.timeObjects !== undefined)
								{
									timeObject = {}; // the final barline in the voice (used when changing speed)
									Object.defineProperty(timeObject, "msDurationInScore", { value: 0, writable: false });
									Object.defineProperty(timeObject, "systemIndex", { value: systemIndex, writable: false });
									Object.defineProperty(timeObject, "alignment", { value: rightmostAlignment, writable: false });
									if(systemIndex < nSystems - 1)
									{
										Object.defineProperty(timeObject, "msPositionInScore", { value: startMsPositionOfNextSystem, writable: false });
									}
									else
									{
										lastTimeObject = voice.timeObjects[voice.timeObjects.length - 1];
										endMsPositionInScore = lastTimeObject.msPositionInScore + lastTimeObject.msDurationInScore;
										Object.defineProperty(timeObject, "msPositionInScore", { value: endMsPositionInScore, writable: false });
									}

									voice.timeObjects.push(timeObject);
								}
							}
						}
					}
				}

				/*************** end of getVoiceAndSystemTimeObjects function definitions *****************************/

				for(i = 0; i < systemElems.length; ++i)
				{
					systemElem = systemElems[i];
					system = systems[i];

					getSystemOutputVoiceObjects(i, systemElem, system, viewBoxScale);

					if(isKeyboard1Performance)
					{
						getSystemInputVoiceObjects(i, systemElem, system, viewBoxScale);
					}
				}

				setMsPositions(systems);
				setFirstTimeObjectAlignment(systems);
				appendVoiceEndTimeObjects(systems);
			}

			function getSystemBarlineTimeObjects(systemElems, systemElem)
			{
				function getBarlineObjects(voiceTimeObjects, systemElem)
				{
					function getBarlineTypeAndAlignments(barlineElems, typeString)
					{
						let barlineElem, barlineX1,
							barlineObjs = [], barlineObj, thickBarlines,
							alignment, currentAlignment = -1;

						for(var i = 0; i < barlineElems.length; i++)
						{
							barlineElem = barlineElems[i];
							thickBarlines = barlineElem.getElementsByClassName('thickBarline');
							if(thickBarlines.length === 0)
							{
								barlineX1 = barlineElem.getAttribute('x1');
							}
							else
							{
								barlineX1 = thickBarlines[0].getAttribute('x1');
							}
							alignment = parseFloat(barlineX1, 10) / viewBoxScale; 
							if(alignment > currentAlignment)
							{
								barlineObj = {};
								barlineObj.typeString = typeString;
								barlineObj.alignment = alignment;
								barlineObjs.push(barlineObj);

								currentAlignment = alignment;
							}
							else
							{
								break;
							}
						}

						return barlineObjs;
					}

					let normalBarlineElems = Array.from(systemElem.getElementsByClassName('normalBarline')),
						startRegionBarlineElems = Array.from(systemElem.getElementsByClassName('startRegionBarline')),
						endAndStartRegionBarlineElems = Array.from(systemElem.getElementsByClassName('endAndStartRegionBarline')),
						endRegionBarlineElems = Array.from(systemElem.getElementsByClassName('endRegionBarline')),
						endOfScoreBarlineElems = Array.from(systemElem.getElementsByClassName('endOfScoreBarline')),
						barlineObjs, normalBarlineTimeObjs = [], startBarlineTimeObjs = [], endBarlineTimeObjs = [], endOfScoreTimeObjs = [],
						endAndStartBarlineTimeObjs = [];

					normalBarlineTimeObjs = getBarlineTypeAndAlignments(normalBarlineElems, "normalBarline");
					startBarlineTimeObjs = getBarlineTypeAndAlignments(startRegionBarlineElems, "startRegionBarline");
					endBarlineTimeObjs = getBarlineTypeAndAlignments(endRegionBarlineElems, "endRegionBarline");
					endOfScoreTimeObjs = getBarlineTypeAndAlignments(endOfScoreBarlineElems, "endOfScoreBarline");
					endAndStartBarlineTimeObjs = getBarlineTypeAndAlignments(endAndStartRegionBarlineElems, "endAndStartRegionBarline");

					barlineObjs = [...normalBarlineTimeObjs, ...startBarlineTimeObjs, ...endAndStartBarlineTimeObjs, ...endBarlineTimeObjs, ...endOfScoreTimeObjs];
					barlineObjs.sort((x, y) => x.alignment - y.alignment);

					if(barlineObjs[barlineObjs.length - 1].typeString === "endOfScoreBarline")
					{
						barlineObjs.splice(barlineObjs.length - 2, 1); // remove the normalBarline contained in the endOfScoreBarline
					}

					let jIndex = 0;
					for(let i = 0; i < barlineObjs.length; i++)
					{
						let barline = barlineObjs[i];
						for(var j = jIndex; j < voiceTimeObjects.length; j++)
						{
							let voiceTimeObject = voiceTimeObjects[j];
							if((voiceTimeObject instanceof MidiChord || voiceTimeObject instanceof MidiRest)
								&& voiceTimeObject.alignment > barline.alignment)
							{
								barline.msPositionInScore = voiceTimeObject.msPositionInScore;
								jIndex = j + 1;
								break;
							}
						}
					}
                    let lastRegionBarline = barlineObjs[barlineObjs.length - 1],
                        lastDurationObject = voiceTimeObjects[voiceTimeObjects.length - 2],
                        lastBarlineMsPos = lastDurationObject.msPositionInScore + lastDurationObject.msDurationInScore;

                    lastRegionBarline.msPositionInScore = lastBarlineMsPos;

					return barlineObjs;
				}

				let voiceTimeObjects;
				for(let systemIndex = 0; systemIndex < systems.length; ++systemIndex)
				{
					system = systems[systemIndex];
					systemElem = systemElems[systemIndex];
					voiceTimeObjects = system.staves[0].voices[0].timeObjects,
					//allNoteObjectElems = systemElems[systemIndex].getElementsByClassName("voice")[0].children;

					system.barlines = getBarlineObjects(voiceTimeObjects, systemElem);
				}
			}

			getVoiceTimeObjects();

			getSystemBarlineTimeObjects(systemElems, systems);
		}

		function setMarkers(systems)
		{
			var i, nSystems = systems.length, system;
			for(i = 0; i < nSystems; ++i)
			{
				system = systems[i];
				system.startMarker.setVisible(false);
				system.endMarker.setVisible(false);
			}

			// When this function returns, startMarker is used to set the Cursor position.
			// sendStartMarkerToStart() is called later to make startMarker visible and move it to the first barline.
			startMarker = systems[0].startMarker;
			startMarker.moveTo(systems[0].staves[0].voices[0].timeObjects[0]);
			sendEndMarkerToEnd();
		}

		function setTrackAttributes(outputTracks, inputTracks, system0staves)
		{
			var outputTrackIndex = 0, inputTrackIndex = 0, staffIndex, voiceIndex, nStaves = system0staves.length, staff, voice;
			for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				staff = system0staves[staffIndex];
				for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
				{
					voice = staff.voices[voiceIndex];
					if(voice.isOutput === true)
					{
						outputTracks.push(new Track());
						outputTracks[outputTrackIndex].midiObjects = [];
						outputTrackIndex++;
					}
					else // voice.isOutput === false 
					{
						inputTracks.push(new Track());
						inputTracks[inputTrackIndex].inputObjects = [];
						inputTrackIndex++;
					}
				}
			}
		}

		function getInputKeyRange(inputTracks)
		{
			var i, j, k, nTracks = inputTracks.length, track, inputNotes, key,
				inputKeyRange = {}, bottomKey = Number.MAX_VALUE, topKey = Number.MIN_VALUE;

			for(i = 0; i < nTracks; ++i)
			{
				track = inputTracks[i];
				for(j = 0; j < track.inputObjects.length; ++j)
				{
					if(track.inputObjects[j].inputNotes !== undefined)
					{
						// an inputChord
						inputNotes = track.inputObjects[j].inputNotes;
						for(k = 0; k < inputNotes.length; ++k)
						{
							key = inputNotes[k].notatedKey;
							bottomKey = (bottomKey < key) ? bottomKey : key;
							topKey = (topKey > key) ? topKey : key;
						}
					}
				}
			}

			inputKeyRange.bottomKey = bottomKey;
			inputKeyRange.topKey = topKey;

			return inputKeyRange;
		}

		function setRegionData(outputTracks, systems)
		{
			// Sets regionNamesPerMsPosInScore (global in score),
			// which is used by the SetStartMarker and SetEndMarker tools.
			function setRegionNamesPerMsPosInScore(regionSequence)
			{
				// Returns an array containing one unique name per performed region.
				// Uses Moritz' algorithm (A, A1, A2 etc.).
				function getRegionNameSequence(regionSequence)
				{
					let names = [];
					for(let region of regionSequence)
					{
						names.push(region.name);
					}
					return names;
				}

				function getRegionMsPosBounds(regionSequence)
				{
					let regionMsPosBounds = [];
					for(let region of regionSequence)
					{
						let msPositionInScore = region.startMsPosInScore;
						if(regionMsPosBounds.indexOf(msPositionInScore) === -1)
						{
							regionMsPosBounds.push(msPositionInScore);
						}
						msPositionInScore = region.endMsPosInScore;
						if(regionMsPosBounds.indexOf(msPositionInScore) === -1)
						{
							regionMsPosBounds.push(msPositionInScore);
						}
					}
					regionMsPosBounds.sort((a, b) => (a - b));

					return regionMsPosBounds;
				}

				let regionNameSequence = getRegionNameSequence(regionSequence);
				let regionMsPosBoundsInScore = getRegionMsPosBounds(regionSequence);

				// global in Score.js: will contain objects of the form {startMsPosInScore, array of regionInstanceName}
				regionNamesPerMsPosInScore = [];
				for(let msPosInScore of regionMsPosBoundsInScore)
				{
					let regionNames = [];
					for(let i = 0; i < regionSequence.length; ++i)
					{
						let region = regionSequence[i],
							regionName = regionNameSequence[i],
							duration = region.endMsPosInScore - region.startMsPosInScore;

						if(msPosInScore >= region.startMsPosInScore && msPosInScore < (region.startMsPosInScore + duration))
						{
							regionNames.push(regionName);
						}
					}
					let entry = { msPosInScore, regionNames };
					regionNamesPerMsPosInScore.push(entry);
				}
			}

			setRegionNamesPerMsPosInScore(regionSequence);

			if(regionSequence.length === 1)
			{
				let finalSystemBarlines = systems[systems.length - 1].barlines;

				regionSequence[0].endMsPosInScore = finalSystemBarlines[finalSystemBarlines.length - 1].msPositionInScore;
			}

			for(let outputTrack of outputTracks)
			{
				outputTrack.setRegionLinks(regionSequence);
			}
		}

		getVoiceAndSystemTimeObjects();

		setTrackAttributes(outputTracks, inputTracks, systems[0].staves);

		nStaves = systems[0].staves.length;

		for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
		{
			system = systems[sysIndex];
			outputTrackIndex = 0;
			for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
			{
				staff = system.staves[staffIndex];
				nVoices = staff.voices.length;
				for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
				{
					voice = staff.voices[voiceIndex];
					if(voice.isOutput === true)
					{
						nTimeObjects = voice.timeObjects.length;
						outputTrack = outputTracks[outputTrackIndex];
						for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
						{
							timeObject = voice.timeObjects[timeObjectIndex];
							if(timeObject instanceof MidiChord || timeObject instanceof MidiRest)
							{
								if(isKeyboard1Performance)
								{
									timeObject.systemIndex = sysIndex; // currently used used only in Keyboard1 performances (09.10.2018)
								}
								outputTrack.midiObjects.push(timeObject);
							}
						}
						++outputTrackIndex;
					}
				}
			}
		}

		if(isKeyboard1Performance)
		{
			for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
			{
				system = systems[sysIndex];
				inputTrackIndex = 0;
				for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
				{
					staff = system.staves[staffIndex];
					nVoices = staff.voices.length;
					for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
					{
						voice = staff.voices[voiceIndex];
						nTimeObjects = voice.timeObjects.length;
						if(voice.isOutput === false)
						{
							inputTrack = inputTracks[inputTrackIndex];
							for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
							{
								timeObject = voice.timeObjects[timeObjectIndex];
								if(timeObject instanceof InputChordDef)
								{
									inputChord = new InputChord(timeObject, outputTracks, sysIndex); // the outputTracks should already be complete here
									inputTrack.inputObjects.push(inputChord);
								}
								// inputRestDefs have been used to calculate inputChordDef.msPositionInScore, but are no longer needed.
							}
							++inputTrackIndex;
						}
					}
				}
			}
		}

		tracksData.inputTracks = inputTracks;
		tracksData.outputTracks = outputTracks;

		setRegionData(outputTracks, systems);

		setMarkers(systems);

		// cursor is accessed outside the score using a getter function
		cursor = new Cursor(systemChanged, viewBoxScale);
		cursor.set(systems, startMarker.msPositionInScore, endMarker.msPositionInScore, trackIsOnArray);

		markersLayer.appendChild(cursor.element);

		//    if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
		//        inputKeyRange.bottomKey
		//        inputKeyRange.topKey
		if(inputTracks.length > 0)
		{
			tracksData.inputKeyRange = getInputKeyRange(inputTracks);
		}
	},

	getSystems = function()
	{
		return systems;
	},

	getCursor = function()
	{
		return cursor;
	},

	getRegionSequence = function()
	{
		return regionSequence;
	},

	getTracksData = function()
	{
		return tracksData;
	},

	getMarkersLayer = function()
	{
		return markersLayer; // is undefined before a score is loaded
	},

	getStartMarker = function()
	{
		return startMarker; // is undefined before a score is loaded
	},

	getRegionNamesPerMsPosInScore = function()
	{
		return regionNamesPerMsPosInScore; // is undefined before a score is loaded (used at runtime)
	},

	getStartRegionIndex = function()
	{
		return startRegionIndex;
	},

	getEndRegionIndex = function()
	{
		return endRegionIndex;
	};

export class Score
{	
	// an empty score
	constructor(callback)
	{
		systems = [];

		systemChanged = callback;

		// functions called when setting the start or end marker
		this.setStartMarkerClick = setStartMarkerClick;
		this.setEndMarkerClick = setEndMarkerClick;

		// functions called when clicking the sendStartMarkerToStart of senEndMarkerToEnd buttons
		this.sendStartMarkerToStart = sendStartMarkerToStart;
		this.sendEndMarkerToEnd = sendEndMarkerToEnd;

		this.startMarkerMsPosition = startMarkerMsPosition;
		this.endMarkerMsPosition = endMarkerMsPosition;
		this.getReadOnlyTrackIsOnArray = getReadOnlyTrackIsOnArray;

		// Called when the start button is clicked in the top options panel,
		// and when setOptions button is clicked at the top of the score.
		// If the startMarker is not fully visible in the svgPagesDiv, move
		// it to the top of the div.
		this.moveStartMarkerToTop = moveStartMarkerToTop;

		// Recalculates the timeObject lists for the cursor using trackIsOnArray
		// (tracksControl.trackIsOnArray) to take into account which tracks are actually performing.
		// When the score is first read, all tracks perform by default.
		this.setCursor = setCursor;
		// Advances the cursor to the following timeObject (in any channel)
		// if the msPosition argument is >= that object's msPosition. Otherwise does nothing.
		this.advanceCursor = advanceCursor;
		this.hideCursor = hideCursor;

		this.resetRegionInfoStrings = resetRegionInfoStrings;
		this.setActiveInfoStringsStyle = setActiveInfoStringsStyle;
		this.leaveRegion = leaveRegion;

		this.getEmptySystems = getEmptySystems;

		// tracksData is an object having the following defined attributes:
		//        inputTracks[] - an array of tracks containing inputChords
		//        outputTracks[] - an array of tracks containing outputChords and outputRests
		//        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
		//            inputKeyRange.bottomKey
		//            inputKeyRange.topKey
		this.setTracksData = setTracksData;
		this.getTracksData = getTracksData;

		// The markersLayer is set when a specific score is loaded.
		// It contains the cursor line and the start- and endMarkers for each system in the score.
		// It is also the transparent, clickable surface used when setting the start and end markers.
		this.getMarkersLayer = getMarkersLayer;
		this.getSystems = getSystems;
		this.getCursor = getCursor;
		this.getStartMarker = getStartMarker;
		this.getRegionSequence = getRegionSequence;
		this.getRegionNamesPerMsPosInScore = getRegionNamesPerMsPosInScore;
		this.getStartRegionIndex = getStartRegionIndex;
		this.getEndRegionIndex = getEndRegionIndex;

		// The TracksControl controls the display, and should be the only module to call this function.
		this.refreshDisplay = refreshDisplay;

		this.reportTickOverload = reportTickOverload;
		this.deleteTickOverloadMarkers = deleteTickOverloadMarkers;
	}
}

