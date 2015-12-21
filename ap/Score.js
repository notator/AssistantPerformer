/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/Score.js
*  The _AP.score namespace which defines the
*    Score(callback) constructor.
*  
*/


/*jslint bitwise: false, nomen: true, plusplus: true, white: true, maxerr: 100 */
/*global _AP: false,  window: false,  document: false, performance: false, console: false, alert: false, XMLHttpRequest: false */

_AP.namespace('_AP.score');

_AP.score = (function (document)
{
	"use strict";

	var
    CMD = _AP.constants.COMMAND,
    Message = _AP.message.Message,
    Track = _AP.track.Track,

    Markers = _AP.markers,
	InputChordDef = _AP.inputChordDef.InputChordDef,
	InputChord = _AP.inputChord.InputChord,
	InputRest = _AP.inputRest.InputRest,
	MidiChordDef = _AP.midiChordDef.MidiChordDef,
    MidiChord = _AP.midiChord.MidiChord,
    MidiRest = _AP.midiRest.MidiRest,

	BLACK_COLOR = "#000000",
	GREY_COLOR = "#7888A0",
	ENABLED_INPUT_TITLE_COLOR = "#3333EE",
	DISABLED_PINK_COLOR = "#FFBBBB",

    MAX_MIDI_CHANNELS = 16,
	outputTrackPerMidiChannel = [], // only output tracks

	// This array is initialized to all tracks on (=true) when the score is loaded,
	// and reset when the tracksControl calls refreshDisplay().
	trackIsOnArray = [], // all tracks, including input tracks

	viewBoxScale,

    // The frames around each svgPage
    markersLayers = [],

	systemElems = [], // all the SVG elements having class "system"

    // See comments in the publicAPI definition at the bottom of this file.
    systems = [], // an array of all the systems

    // This value is changed when the start runtime button is clicked.
	// It is used when setting the positions of the start and end markers.
	isLivePerformance = false,

    startMarker,
    runningMarker,
    endMarker,
    runningMarkerHeightChanged, // callback, called when runningMarker changes systems

    finalBarlineInScore,

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

    // Sends a noteOff to all notes on all channels on the midi output device.
    allNotesOff = function (midiOutputDevice)
    {
    	var 
        noteOffMessage, channelIndex, noteIndex,
		nOutputChannels = outputTrackPerMidiChannel.length,
        now = performance.now();

    	if (midiOutputDevice !== undefined && midiOutputDevice !== null)
    	{
    		for (channelIndex = 0; channelIndex < nOutputChannels; ++channelIndex)
    		{
    			for (noteIndex = 0; noteIndex < 128; ++noteIndex)
    			{
    				noteOffMessage = new Message(CMD.NOTE_OFF + channelIndex, noteIndex, 127);
    				midiOutputDevice.send(noteOffMessage.data, now);
    			}
    		}
    	}
    },

    hideStartMarkersExcept = function (startMarker)
    {
    	var i, sMarker;
    	for (i = 0; i < systems.length; ++i)
    	{
    		sMarker = systems[i].startMarker;
    		if (sMarker === startMarker)
    		{
    			sMarker.setVisible(true);
    		}
    		else
    		{
    			sMarker.setVisible(false);
    		}
    	}
    },

    hideEndMarkersExcept = function (endMarker)
    {
    	var i, eMarker;
    	for (i = 0; i < systems.length; ++i)
    	{
    		eMarker = systems[i].endMarker;
    		if (eMarker === endMarker)
    		{
    			eMarker.setVisible(true);
    		}
    		else
    		{
    			eMarker.setVisible(false);
    		}
    	}
    },

    getTimeObjectsArray = function (system)
    {
    	var i, nStaves = system.staves.length, j, voice, nVoices, timeObjects, timeObjectsArray = [];

    	for (i = 0; i < nStaves; ++i)
    	{
    		nVoices = system.staves[i].voices.length;
    		for (j = 0; j < nVoices; ++j)
    		{
    			voice = system.staves[i].voices[j];
    			timeObjects = voice.timeObjects;
    			timeObjectsArray.push(timeObjects);
    		}
    	}
    	return timeObjectsArray;
    },

	// Returns the performing timeObject closest to alignmentX (in any performing input or output track, depending on findInput).
	// If trackIndex is defined, the returned timeObject will be in that track.
	findPerformingTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, findInput, alignmentX, trackIndex)
	{
		var i, j, timeObjects, timeObject = null, timeObjectBefore = null, timeObjectAfter = null, returnTimeObject = null, nTimeObjects,
			nAllTracks = timeObjectsArray.length, deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE, startIndex, endIndex;

		function hasPerformingTrack(inputChordDef, trackIsOnArray)
		{
			var i, j, outputTrackFound = false, outputTrackIndices;

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
						if((!findInput && timeObject.midiChordDef !== undefined)
						|| (findInput && timeObject.inputChordDef !== undefined 
							&& hasPerformingTrack(timeObject.inputChordDef, trackIsOnArray)))
						{
							if(alignmentX === timeObject.alignmentX)
							{
								returnTimeObject = timeObject;
								break;
							}
							if(alignmentX > timeObject.alignmentX && (deltaBefore > (alignmentX - timeObject.alignmentX)))
							{
								timeObjectBefore = timeObject;
								deltaBefore = alignmentX - timeObject.alignmentX;
							}
							if(alignmentX < timeObject.alignmentX && (deltaAfter > (timeObject.alignmentX - alignmentX)))
							{
								timeObjectAfter = timeObject;
								deltaAfter = timeObject.alignmentX - alignmentX;
							}
						}
					}
				}
			}
		}
		if(returnTimeObject === null && (timeObjectBefore !== null || timeObjectAfter !== null))
		{
			returnTimeObject = (deltaBefore > deltaAfter) ? timeObjectAfter : timeObjectBefore;
		}
		return returnTimeObject;
	},
	 
	findPerformingInputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignmentX, trackIndex)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, true, alignmentX, trackIndex);
		return returnTimeObject;
	},

	findPerformingOutputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignmentX, trackIndex)
	{
		var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, false, alignmentX, trackIndex);
		return returnTimeObject;
	},

	updateStartMarker = function(timeObjectsArray, timeObject)
	{
		var nOutputTracks = outputTrackPerMidiChannel.length;

		if(isLivePerformance === false)
		{
			timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignmentX);
		}
		else
		{
			timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignmentX);
		}

		if(timeObject.msPosition < endMarker.msPosition())
		{
			startMarker.moveTo(timeObject);
		}
	},

    // This function is called by the tracksControl whenever a track's on/off state is toggled.
    // It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
    refreshDisplay = function(trackIsOnArrayArg)
    {
        var system = systems[startMarker.systemIndex()],
        startMarkerAlignmentX = startMarker.timeObject().alignmentX,
        timeObjectsArray = getTimeObjectsArray(system), timeObject,
        nOutputTracks = outputTrackPerMidiChannel.length;

    	// This function sets the colours of the visible OutputStaves.
    	// (there are no InputStaves in the system, when isLivePerformance === false)
    	// Staves have either one or two voices (=tracks).
        // The tracks are 0-indexed channels from top to bottom of the system.
    	// If trackIsOnArray[trackIndex] is true, its stafflines are coloured black.
    	// If trackIsOnArray[trackIndex] is false, its stafflines are coloured pink.
		// When the staff has one track, all its stafflines are coloured for the track.
        // When the staff has two tracks, the top three stafflines are coloured for the upper track,
        // and the lower two lines are coloured for the lower track. 
        function setOutputView(trackIsOnArray, isLivePerformance)
        {
        	function getColor(trackIsOnArray, trackIndex, isLivePerformance)
        	{
        		var color;

        		if(trackIsOnArray[trackIndex])
        		{
        			if(isLivePerformance === false)
        			{
        				color = BLACK_COLOR;
        			}
        			else
        			{
        				color = GREY_COLOR;
        			}
        		}
        		else
        		{
        			color = DISABLED_PINK_COLOR;
        		}
        		return color;
        	}

        	function setColors(trackIsOnArray, isLivePerformance)
        	{
        		var i, nSystems = systems.length, j, nStaves = systems[0].staves.length,
                k, staff, trackIndex, m, nLines,
                stafflineColor;

        		for(i = 0; i < nSystems; ++i)
        		{
        			trackIndex = 0;
        			for(j = 0; j < nStaves; ++j)
        			{
        				staff = systems[i].staves[j];
        				if(staff.class !== "outputStaff")
        				{
        					break;
        				}
        				if(staff.isVisible)
        				{
        					stafflineColor = getColor(trackIsOnArray, trackIndex, isLivePerformance);
        					staff.nameElem.style.fill = stafflineColor;

        					if(staff.voices.length === 1)
        					{
        						nLines = staff.svgStafflines.length;
        						for(m = 0; m < nLines; ++m) // could be any number of lines
        						{
        							staff.svgStafflines[m].style.stroke = stafflineColor;
        						}
        						++trackIndex;
        					}
        					else if(staff.voices.length === 2 && staff.svgStafflines.length === 5) // the staff has two voices
        					{
        						for(k = 0; k < 2; ++k)
        						{
        							if(k === 0)
        							{
        								staff.svgStafflines[0].style.stroke = stafflineColor;
        								staff.svgStafflines[1].style.stroke = stafflineColor;
        								staff.svgStafflines[2].style.stroke = stafflineColor;
        							}
        							if(k === 1)
        							{
        								staff.svgStafflines[3].style.stroke = stafflineColor;
        								staff.svgStafflines[4].style.stroke = stafflineColor;
        							}
        							++trackIndex;
        						}
        					}
        					else
        					{
        						throw "Error: staff cannot have more than two voices!\n" +
										"Two voice staves must have five lines.";
        					}
        				}
        			}
        		}
        	}

        	setColors(trackIsOnArray, isLivePerformance);
        }

        if(trackIsOnArrayArg !== undefined)
        {
        	trackIsOnArray = trackIsOnArrayArg; // reset by track control
        }

        setOutputView(trackIsOnArray, isLivePerformance);

        if(isLivePerformance)
        {
        	timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignmentX);
        }
        else
        {
        	timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignmentX);
		}
        // move the start marker if necessary
        if(timeObject.alignmentX !== startMarkerAlignmentX)
        {
        	updateStartMarker(timeObjectsArray, timeObject);
        }
    },

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    svgPageClicked = function (e, state)
    {
        var frame = e.target,
            x = e.pageX,
            y = e.pageY + frame.originY,
            systemIndex, system,
            timeObjectsArray, timeObject, trackIndex, nOutputTracks = outputTrackPerMidiChannel.length;

        // x and y now use the <body> element as their frame of reference.
        // this is the same frame of reference as in the systems.
        // systems is a single global array (inside this namespace)of all systems.
        // This is important when identifying systems, and when performing.

        // Returns the system having stafflines closest to y.
        function findSystemIndex(y)
        {
            var i, topLimit, bottomLimit, systemIndex1;

            if (systems.length === 1)
            {
                systemIndex1 = 0;
            }
            else
            {
                topLimit = -1;
                for (i = 0; i < systems.length - 1; ++i)
                {
                    bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
                    if (y >= topLimit && y < bottomLimit)
                    {
                        systemIndex1 = i;
                        break;
                    }
                    topLimit = bottomLimit;
                }

                if (systemIndex1 === undefined)
                {
                    systemIndex1 = systems.length - 1; // last system
                }
            }
            return systemIndex1;
        }

        // Returns the index of the staff having stafflines closest to y
        function findStaffIndex(y, staves)
        {
            var rStaffIndex, i, nStaves, topLimit, bottomLimit;

            if (y <= staves[0].bottomLineY)
            {
                rStaffIndex = 0;
            }
            else if (y >= staves[staves.length - 1].topLineY)
            {
                rStaffIndex = staves.length - 1;
            }
            else
            {
                nStaves = staves.length;
                for (i = 1; i < nStaves; ++i)
                {
                    topLimit = staves[i - 1].bottomLineY;
                    bottomLimit = staves[i].topLineY;
                    if (y >= topLimit && y <= bottomLimit)
                    {
                        rStaffIndex = ((y - topLimit) < (bottomLimit - y)) ? i - 1 : i;
                        break;
                    }

                    if (y >= staves[i].topLineY && y <= staves[i].bottomLineY)
                    {
                        rStaffIndex = i;
                        break;
                    }
                }
            }
            return rStaffIndex;
        }

        // Returns the index of the voice closest to y
        function findVoiceIndex(y, voices)
        {
            var index, nVoices = voices.length, midY;
            if (nVoices === 1)
            {
                index = 0;
            }
            else
            {
                midY = (voices[0].centreY + voices[1].centreY) / 2;
                index = (y < midY) ? 0 : 1;
            }
            return index;
        }

        function findTrackIndex(y, system)
        {
        	var i, j, staff, staffIndex = findStaffIndex(y, system.staves),
			voiceIndex = findVoiceIndex(y, system.staves[staffIndex].voices),
			trackIndex = 0, found = false;

        	for(i= 0; i < system.staves.length;++i)
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

        function getEndMarkerTimeObject(timeObject, x, systems, systemIndex)
        {
        	var returnObject,
				voiceTimeObjects = systems[systemIndex].staves[0].voices[0].timeObjects,
        		rightBarlineTimeObject = voiceTimeObjects[voiceTimeObjects.length - 1],
				earliestAlignmentX;

        	function findEarliestChordAlignmentX(system)
        	{
        		var i, j, k, staff, earliestAlignmentX = Number.MAX_VALUE, timeObjects, timeObject;

        		for(i = 0; i < system.staves.length; ++i)
        		{
        			staff = system.staves[i];
        			for(j = 0; j < staff.voices.length; ++j)
        			{
        				timeObjects = staff.voices[j].timeObjects;
        				for(k = 0; k < timeObjects.length; ++k)
        				{
        					timeObject = timeObjects[k];
        					if(timeObject.midiChordDef !== undefined || timeObject.inputChordDef !== undefined)
        					{
        						break;
        					}
        				}
        				earliestAlignmentX = (earliestAlignmentX < timeObject.alignmentX) ? earliestAlignmentX : timeObject.alignmentX;
        			}
        		}
        		return earliestAlignmentX;
        	}

        	earliestAlignmentX = findEarliestChordAlignmentX(systems[systemIndex]);

        	if(x > rightBarlineTimeObject.alignmentX || ((rightBarlineTimeObject.alignmentX - x) < (x - timeObject.alignmentX)))
        	{
        		returnObject = rightBarlineTimeObject;
        	}
        	else if(timeObject.alignmentX === earliestAlignmentX)
        	{
        		returnObject = null;
        	}
			else
        	{
        		returnObject = timeObject;
        	}
        	return returnObject;
        }

        systemIndex = findSystemIndex(y);
        if (systemIndex !== undefined)
        {
        	system = systems[systemIndex];

        	timeObjectsArray = getTimeObjectsArray(system);

        	trackIndex = findTrackIndex(y, system);

            if(isLivePerformance === true)
            {
            	timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, x, trackIndex);
            }
            else
            {
            	timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, x, trackIndex);
            }

            // timeObject is now the nearest performing chord to the click,
            // either in a live performers voice (if there is one and it is performing) or in a performing output voice.
            if(timeObject !== null)
            {
            	switch(state)
            	{
            		case 'settingStart':
            			if(timeObject.msPosition < endMarker.msPosition())
            			{
            				startMarker = system.startMarker;
            				hideStartMarkersExcept(startMarker);
            				updateStartMarker(timeObjectsArray, timeObject);
            			}
            			break;
            		case 'settingEnd':
            			// returns the rightmost barline if that is closer to x than the timeObject
            			// returns null if timeObject.alignmentX is the alignmentx of the first chord on the system.
            			timeObject = getEndMarkerTimeObject(timeObject, x, systems, systemIndex);
            			if(timeObject !== null && startMarker.msPosition() < timeObject.msPosition)
            			{
            				endMarker = system.endMarker;
            				hideEndMarkersExcept(endMarker);
            				endMarker.moveTo(timeObject);
            			}
            			break;
            		default:
            			break;
            	}
            }
        }
    },

    showRunningMarker = function ()
    {
        runningMarker.setVisible(true);
    },

    hideRunningMarkers = function ()
    {
        var i, nSystems = systems.length;
        for (i = 0; i < nSystems; ++i)
        {
            systems[i].runningMarker.setVisible(false);
        }
    },

    moveRunningMarkerToStartMarker = function ()
    {
        hideRunningMarkers();
        runningMarker = systems[startMarker.systemIndex()].runningMarker;
        runningMarker.moveToStartMarker(startMarker);
    },

    // Called when the go button is clicked.
    setRunningMarkers = function ()
    {
        var sysIndex, nSystems = systems.length, system;

        for (sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
        }
        moveRunningMarkerToStartMarker();
        showRunningMarker();
    },

    // The svg argument contains pointers to functions that work on the SVG score.
    // Constructs all pages, complete except for the timeObjects.
    // Each page has a frame and the correct number of empty systems.
    // Each system has the correct number of empty staves and barlines, it also has
    // a startMarker, a runningMarker and an endMarker.
    // Each staff has empty voices, each voice has an empty timeObjects array.
    // If these objects have graphic parameters, they are set.
	// the score's trackIsOnArray is initialized to all tracks on (=true).
	// If isLivePerformance === true, then outputStaves are grey, inputStaves are black.
	// If isLivePerformance === false, then outputStaves are black, inputStaves are pink.
    getEmptyPagesAndSystems = function (isLivePerformanceArg)
    {
    	var system, sysElems, svgPageEmbeds, viewBox, nPages, runningViewBoxOriginY, scoreLayerElem,
            i, j, k,
            svgPage, svgElem, svgChildren, layerName, markersLayer,
            pageHeight, pageSystems;

        function resetContent(isLivePerformanceArg)
        {
            while (markersLayers.length > 0)
            {
                markersLayers.pop();
            }
            while (systems.length > 0)
            {
            	systems.pop();
				systemElems.pop();
            }

            isLivePerformance = isLivePerformanceArg;
            outputTrackPerMidiChannel = []; // reset global
            trackIsOnArray = []; // reset global
        }

        function getEmptySystem(viewBoxOriginY, viewBoxScale, systemElem, isLivePerformance)
        {
        	var i, j,
				systemDy, staffDy,
				staffElems, staffElem, stafflinesElems,
				outputVoiceElem, outputVoiceElems, inputVoiceElem, inputVoiceElems,				
                staff, stafflineInfo,
                voice, midiChannelPerOutputTrack = [];

        	function getStaffElems(systemElem)
        	{
        		var staffElemsNodeList, staffElems = [];

        		staffElemsNodeList = systemElem.getElementsByClassName("outputStaff");
        		for(i = 0; i < staffElemsNodeList.length; ++i)
        		{
        			staffElems.push(staffElemsNodeList[i]);
        		}
        		staffElemsNodeList = systemElem.getElementsByClassName("inputStaff");
        		for(i = 0; i < staffElemsNodeList.length; ++i)
        		{
        			staffElems.push(staffElemsNodeList[i]);
        		}
        		return staffElems;
        	}

        	// returns an info object containing left, right and stafflineYs
        	function getStafflineInfo(stafflinesElem, dy)
        	{
        		var i, rStafflineInfo = {}, stafflineYs = [], left, right, stafflineY,
                lineElem, svgStafflines = [], staffLinesElemChildren = stafflinesElem.children;

        		for (i = 0; i < staffLinesElemChildren.length; ++i)
        		{
        			console.assert(staffLinesElemChildren[i].nodeName === "line");
        			lineElem = staffLinesElemChildren[i];
        			svgStafflines.push(lineElem);
        			stafflineY = parseFloat(lineElem.getAttribute('y1')) + dy;
        			stafflineYs.push((stafflineY / viewBoxScale) + viewBoxOriginY);
        			left = parseFloat(lineElem.getAttribute('x1'));
        			left /= viewBoxScale;
        			right = parseFloat(lineElem.getAttribute('x2'));
        			right /= viewBoxScale;
        		}
        		rStafflineInfo.left = left;
        		rStafflineInfo.right = right;
        		rStafflineInfo.stafflineYs = stafflineYs;
        		rStafflineInfo.svgStafflines = svgStafflines;

        		return rStafflineInfo;
        	}

        	function setVoiceCentreYs(staffTopY, staffBottomY, voices)
        	{
        		if (voices.length === 1)
        		{
        			voices[0].centreY = (staffTopY + staffBottomY) / 2;
        		}
        		else // voices.length === 2
        		{
        			voices[0].centreY = staffTopY;
        			voices[1].centreY = staffBottomY;
        		}
        	}
			
        	function getOutputVoiceAttributes(outputVoice, voiceNode)
        	{
        		var
				midiChannel = voiceNode.getAttribute('score:midiChannel'),
				masterVolume = voiceNode.getAttribute('score:masterVolume');

        		// This condition will only be true in the first bar of the piece.
        		if(midiChannel !== null && masterVolume !== null)
        		{
        			outputVoice.midiChannel = parseInt(midiChannel, 10);
        			outputVoice.masterVolume = parseInt(masterVolume, 10);
        		}
        	}

        	function setStaffColours(staff, isLivePerformance)
        	{
        		function setTitle(staff, titleColor)
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

        		function setStafflines(staff, colour)
        		{
        			var i, nLines = staff.svgStafflines.length;
        			for(i = 0; i < nLines; ++i) // could be any number of lines
        			{
        				staff.svgStafflines[i].style.stroke = colour;
        			}
        		}

        		function setGreyDisplay(staff)
        		{
        			setTitle(staff, GREY_COLOR);
        			setStafflines(staff, GREY_COLOR);
        		}

        		function setBlackDisplay(staff)
        		{
        			setTitle(staff, BLACK_COLOR);
        			setStafflines(staff, BLACK_COLOR);
        		}

        		function setLiveInputDisplay(staff)
        		{
        			setTitle(staff, ENABLED_INPUT_TITLE_COLOR);
        			setStafflines(staff, BLACK_COLOR);
        		}

        		function setDisabledInputDisplay(staff)
        		{
        			setTitle(staff, DISABLED_PINK_COLOR);
        			setStafflines(staff, DISABLED_PINK_COLOR);
        		}

        		if(staff.class === 'outputStaff')
        		{
        			if(isLivePerformance)
        			{
        				setGreyDisplay(staff);
        			}
        			else
        			{
        				setBlackDisplay(staff);
        			}
        		}
        		if(staff.class === 'inputStaff')
        		{
        			if(isLivePerformance)
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

        	function getInverseArray(midiChannelPerOutputTrack)
        	{
        		var midiChannel, n = midiChannelPerOutputTrack.length, rval = [];
        		for(midiChannel = 0; midiChannel < n; ++midiChannel)
        		{
        			rval.push(midiChannelPerOutputTrack.indexOf(midiChannel));
        		}
        		return rval;
        	}

        	system = {};
        	systemDy = getDy(systemElem);
            system.staves = [];

            staffElems = getStaffElems(systemElem);

            for(i = 0; i < staffElems.length; ++i)
            {
            	staffElem = staffElems[i];
            	staff = {};
            	staffDy = systemDy + getDy(staffElem);
            	staff.class = staffElem.getAttribute("class");
            	staff.isVisible = !(staffElem.getAttribute("score:invisible") === "1");
            	staff.voices = [];
            	system.staves.push(staff);

            	switch(staff.class)
            	{
            		case "outputStaff":
            			outputVoiceElems = staffElem.getElementsByClassName("outputVoice");
            			for(j = 0; j < outputVoiceElems.length; ++j)
            			{
            				outputVoiceElem = outputVoiceElems[j];
            				staff.nameElem = getNameElem(outputVoiceElem);
            				voice = {};
            				voice.class = "outputVoice";
            				// the attributes are only defined in the first bar of the piece
            				getOutputVoiceAttributes(voice, outputVoiceElem);
            				midiChannelPerOutputTrack.push(voice.midiChannel);
            				staff.voices.push(voice);
            			}
            			break;
            		case "inputStaff":
            			inputVoiceElems = staffElem.getElementsByClassName("inputVoice");
            			for(j = 0; j < inputVoiceElems.length; ++j)
            			{
            				inputVoiceElem = inputVoiceElems[j];
            				staff.nameElem = getNameElem(inputVoiceElem);
            				voice = {};
            				voice.class = "inputVoice";
            				staff.voices.push(voice);
            			}
            			break;
            	}

            	if(staff.isVisible)
            	{
            		stafflinesElems = staffElem.getElementsByClassName("stafflines");
            		stafflineInfo = getStafflineInfo(stafflinesElems[0], staffDy);
            		system.left = stafflineInfo.left;
            		system.right = stafflineInfo.right;

            		staff.topLineY = stafflineInfo.stafflineYs[0];
            		staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];
            		staff.svgStafflines = stafflineInfo.svgStafflines; // top down

            		setStaffColours(staff, isLivePerformance);
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

            if(midiChannelPerOutputTrack[0] !== undefined) // is undefined on systems after the first.
            {
            	// score variable: outputTrackPerMidiChannel[] is used
            	//    1. with trackIsOnArray[] when checking that inputNotes have at least one performing track.
            	//    2. For quickly finding the number of outputTracks in the score.
            	outputTrackPerMidiChannel = getInverseArray(midiChannelPerOutputTrack);
            }

            return system;
        }

    	// Creates a new "g" element at the top level of the svg page.
    	// The element contains the transparent, clickable rect and the start-, running- and
        // end-markers for each system on the page.
        function createMarkersLayer(svgElem, viewBox, runningViewBoxOriginY, pageSystems)
        {
        	var i, markersLayer = document.createElementNS("http://www.w3.org/2000/svg", "g"),
				rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

        	function createMarkers(markersLayer, viewBox, system)
        	{
        		var startMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					runningMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					endMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
					startMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
					startMarkerCircle = document.createElementNS("http://www.w3.org/2000/svg", 'circle'),
					runningMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
					endMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
					endMarkerRect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

        		startMarkerLine.setAttribute("x1", "0");
        		startMarkerLine.setAttribute("y1", "0");
        		startMarkerLine.setAttribute("x2", "0");
        		startMarkerLine.setAttribute("y2", "0");
        		startMarkerLine.setAttribute("style", "stroke-width:1px");

        		startMarkerCircle.setAttribute("cx", "0");
        		startMarkerCircle.setAttribute("cy", "0");
        		startMarkerCircle.setAttribute("r", "0");
        		startMarkerCircle.setAttribute("style", "stroke-width:1px");

        		runningMarkerLine.setAttribute("x1", "0");
        		runningMarkerLine.setAttribute("y1", "0");
        		runningMarkerLine.setAttribute("x2", "0");
        		runningMarkerLine.setAttribute("y2", "0");
        		runningMarkerLine.setAttribute("style", "stroke-width:1px");

        		endMarkerLine.setAttribute("x1", "0");
        		endMarkerLine.setAttribute("y1", "0");
        		endMarkerLine.setAttribute("x2", "0");
        		endMarkerLine.setAttribute("y2", "0");
        		endMarkerLine.setAttribute("style", "stroke-width:1px");

        		endMarkerRect.setAttribute("x", "0");
        		endMarkerRect.setAttribute("y", "0");
        		endMarkerRect.setAttribute("width", "0");
        		endMarkerRect.setAttribute("height", "0");
        		endMarkerRect.setAttribute("style", "stroke-width:1px");

        		startMarkerElem.appendChild(startMarkerLine);
        		startMarkerElem.appendChild(startMarkerCircle);
        		runningMarkerElem.appendChild(runningMarkerLine);
        		endMarkerElem.appendChild(endMarkerLine);
        		endMarkerElem.appendChild(endMarkerRect);

        		markersLayer.appendChild(startMarkerElem);
        		markersLayer.appendChild(runningMarkerElem);
        		markersLayer.appendChild(endMarkerElem);

				system.startMarker = new Markers.StartMarker(startMarkerElem, markersLayer.rect.originY, viewBox.scale);
        		system.runningMarker = new Markers.RunningMarker(runningMarkerElem, markersLayer.rect.originY, viewBox.scale);
        		system.endMarker = new Markers.EndMarker(endMarkerElem, markersLayer.rect.originY, viewBox.scale);
        	}

        	markersLayer.setAttribute("style", "display:inline");

        	rect.setAttribute("x", viewBox.x.toString());
        	rect.setAttribute("y", viewBox.y.toString());
        	rect.setAttribute("width", viewBox.width.toString());
        	rect.setAttribute("height", viewBox.height.toString());
        	rect.setAttribute("style", "stroke:none; fill:#ffffff; fill-opacity:0");
        	rect.originY = runningViewBoxOriginY;
        	markersLayer.appendChild(rect);
        	markersLayer.rect = rect;

        	for(i = 0; i < pageSystems.length; i++)
        	{
        		createMarkers(markersLayer, viewBox, pageSystems[i]);
        	}

        	svgElem.appendChild(markersLayer);

        	return markersLayer;
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
        			if(staff.voices[j].class === "inputVoice" && isLivePerformance === false)
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

        function getSVGElem(svgPage)
        {
        	var i, children = svgPage.children, svgElem;

        	for(i = 0; i < children.length; ++i)
        	{
        		if(children[i].nodeName === 'svg')
        		{
        			svgElem = children[i];
        			break;
        		}
        	}

        	return svgElem;
        }

    	// Sets the global viewBox object and the sizes and positions of the objects on page 2 (the div that is originally invisible)
		// Returns the viewBox in the final page of the score.
        function setGraphics()
        {
        	var
			i, svgPage, embedsWidth, viewBox, pagesFrameWidth,
        	svgRuntimeControlsElem = document.getElementById("svgRuntimeControls"),
			svgPagesFrameElem = document.getElementById("svgPagesFrame"),
        	svgPageEmbeds = document.getElementsByClassName("svgPage"),
			nPages = svgPageEmbeds.length;

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

        	svgRuntimeControlsElem.style.left = ((window.innerWidth - parseInt(svgRuntimeControlsElem.style.width, 10)) / 2).toString();

        	for(i = 0; i < nPages; ++i)
        	{
        		svgPage = svgPageEmbeds[i].getSVGDocument();
        		svgElem = getSVGElem(svgPage);
        		viewBox = getViewBox(svgElem); // global
        		embedsWidth = Math.ceil(viewBox.width / viewBox.scale);
        		svgPageEmbeds[i].style.width = embedsWidth.toString();
        		svgPageEmbeds[i].style.height = (Math.ceil(viewBox.height / viewBox.scale)).toString();
        	}

			pagesFrameWidth = embedsWidth + 17; 
			svgPagesFrameElem.style.width = pagesFrameWidth.toString();
        	svgPagesFrameElem.style.height = (window.innerHeight - parseInt(svgPagesFrameElem.style.top, 10) -2).toString();
        	svgPagesFrameElem.style.left = (Math.ceil((window.innerWidth - pagesFrameWidth) / 2)).toString();

        	viewBoxScale = viewBox.scale;
			
        	return viewBox;
        }

        /*************** end of getEmptyPagesAndSystems function definitions *****************************/

        resetContent(isLivePerformanceArg);

        viewBox = setGraphics();

        svgPageEmbeds = document.getElementsByClassName("svgPage");
        nPages = svgPageEmbeds.length;
        runningViewBoxOriginY = 0; // absolute coordinates
        for(i = 0; i < nPages; ++i)
        {
        	svgPage = svgPageEmbeds[i].getSVGDocument();
        	svgElem = getSVGElem(svgPage);

        	svgChildren = svgElem.children;
			pageSystems = [];
        	for(j = 0; j < svgChildren.length; ++j)
        	{
        		layerName = svgChildren[j].getAttribute("inkscape:label");
        		if(layerName === "score")
        		{
        			scoreLayerElem = svgChildren[j];
        			sysElems = scoreLayerElem.getElementsByClassName("system");
				
        			for(k = 0; k < sysElems.length; ++k)
        			{
        				system = getEmptySystem(runningViewBoxOriginY, viewBox.scale, sysElems[k], isLivePerformance);
        				systems.push(system); // systems is global inside this namespace
        				systemElems.push(sysElems[k]); // used when creating timeObjects...
        				pageSystems.push(system);
        			}
        		}
        	}

        	markersLayer = createMarkersLayer(svgElem, viewBox, runningViewBoxOriginY, pageSystems);
        	markersLayers.push(markersLayer);

            pageHeight = parseInt(svgElem.getAttribute('height'), 10);
            runningViewBoxOriginY += pageHeight;
        }
        initializeTrackIsOnArray(systems[0]);
    },

    setEndMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingEnd');
    },

    setStartMarkerClick = function (e)
    {
        svgPageClicked(e, 'settingStart');
    },

    sendStartMarkerToStart = function ()
    {
        startMarker = systems[0].startMarker;
        hideStartMarkersExcept(startMarker);
        startMarker.moveTo(systems[0].staves[0].voices[0].timeObjects[0]);
    },

    sendEndMarkerToEnd = function ()
    {
        var lastTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;

        endMarker = systems[systems.length - 1].endMarker;
        hideEndMarkersExcept(endMarker);
        endMarker.moveTo(lastTimeObjects[lastTimeObjects.length - 1]);
    },

    startMarkerMsPosition = function ()
    {
        return startMarker.msPosition();
    },

    endMarkerMsPosition = function ()
    {
        return endMarker.msPosition();
    },

    // Called when the start button is clicked in the top options panel,
    // and when setOptions button is clicked at the top of the score.
    // If the startMarker is not fully visible in the svgPagesDiv, move
    // it to the top of the div.
    moveStartMarkerToTop = function (svgPagesDiv)
    {
        var height = Math.round(parseFloat(svgPagesDiv.style.height)),
        scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

        startMarkerYCoordinates = startMarker.getYCoordinates();

        if ((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
        {
            if (startMarker.systemIndex() === 0)
            {
                svgPagesDiv.scrollTop = 0;
            }
            else
            {
                svgPagesDiv.scrollTop = startMarkerYCoordinates.top - 10;
            }
        }
    },

    // Advances the running marker to msPosition (in any channel)
    // if msPosition is >= that object's msPosition. Otherwise does nothing.
    // Also does nothing when the end of the score is reached.
    advanceRunningMarker = function(msPosition)
    {
    	if(msPosition >= systems[runningMarker.systemIndex()].endMsPosition)
    	{
    		// Move runningMarker to msPosition in the next system.
    		runningMarker.setVisible(false);
    		if(runningMarker.systemIndex() < (systems.length - 1) && endMarkerMsPosition() > systems[runningMarker.systemIndex()].endMsPosition)
    		{
    			runningMarker = systems[runningMarker.systemIndex() + 1].runningMarker;
    			runningMarker.moveTo(msPosition);
    			runningMarker.setVisible(true);
    		}
    		// callback for auto scroll
    		runningMarkerHeightChanged(runningMarker.getYCoordinates());
    	}
    	else
    	{
    		while(msPosition >= runningMarker.nextMsPosition())
    		{
    			// this function can assume that the runningMarker's currentPosition can simply be incremented
    			runningMarker.incrementPosition();
    		}
    	}
    },


    // Returns a tracksData object having the following defined attributes:
    //		inputTracks[] - an array of tracks containing inputChords and inputRests
    //		outputTracks[] - an array of tracks containing outputChords and outputRests
    //		if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
    //			inputKeyRange.bottomKey
    //			inputKeyRange.topKey
	getTracksData = function(globalSpeed)
    {
    	// systems->staves->voices->timeObjects
    	var
        tracksData = {}, inputTracks = [], outputTracks = [],
		outputTrackIndex = 0, inputTrackIndex = 0, inputTrack, outputTrack,
        timeObjectIndex, nTimeObjects, timeObject,
        voiceIndex, nVoices, voice,
        staffIndex, nStaves, staff,
        sysIndex, nSystems = systems.length, system,
        midiChordDef, midiChord, midiRest,
		inputChord, inputRest;

    	// Gets the timeObjects for both input and output voices. 
    	// msDurations are retrieved from the score (not changed by the current speed option).
    	function getOutputAndInputTimeObjects(speed)
    	{
    		var systemElem,
                i, systemIndex,
                lastSystemTimeObjects, finalBarlineMsPosition;

    		function getSystemTimeObjects(system, viewBoxScale1, systemElem)
    		{
    			var i, j, systemChildren, systemChildClass,
                    staff, staffChildren, staffChildClass, staffChild,
                    voice,
                    staffIndex = 0,
                    voiceIndex = 0;

    			// There is a timeObject for every input and output chord or rest.
    			// All timeObjects are allocated alignmentX and msDuration fields.
				// Chord timeObjects are allocated either a midiChordDef or an inputChordDef field depending on whether they are input or output chords.
    			function getTimeObjects(noteObjectElems)
    			{
    				var timeObjects = [], noteObjectClass,
                        timeObject, i, j, length, noteObjectElem, chordChildElems, otpmc = outputTrackPerMidiChannel;

    				function getMsDuration(midiChordDef)
    				{
    					var i,
                            msDuration = 0,
                            basicChordsArray = midiChordDef.basicChordsArray;

    					for(i = 0; i < basicChordsArray.length; ++i)
    					{
    						msDuration += basicChordsArray[i].msDuration;
    					}

    					return msDuration;
    				}

    				length = noteObjectElems.length;
    				for(i = 0; i < length; ++i)
    				{
    					noteObjectElem = noteObjectElems[i];
    					noteObjectClass = noteObjectElem.getAttribute('class');
    					if(noteObjectClass === 'outputChord' || noteObjectClass === 'inputChord')
    					{
    						timeObject = {};
    						timeObject.alignmentX = parseFloat(noteObjectElem.getAttribute('score:alignmentX')) / viewBoxScale1;
    						chordChildElems = noteObjectElem.children;
    						for(j = 0; j < chordChildElems.length; ++j)
    						{
    							switch(chordChildElems[j].nodeName)
    							{
    								case 'score:midiChord':
    									timeObject.midiChordDef = new MidiChordDef(chordChildElems[j]);
    									timeObject.msDuration = getMsDuration(timeObject.midiChordDef);
    									break;
    								case 'score:inputNotes':
    									timeObject.inputChordDef = new InputChordDef(noteObjectElem, otpmc);
    									timeObject.msDuration = parseInt(noteObjectElem.getAttribute('score:msDuration'), 10);
    									break;
    							}
    						}
    						if(timeObject.msDuration < 1)
    						{
    							throw "Error: The score contains chords having zero duration!";
    						}
    						timeObjects.push(timeObject);
    					}
    					else if(noteObjectClass === 'rest')
    					{
    						timeObject = {};
    						timeObject.alignmentX = parseFloat(noteObjectElem.getAttribute('score:alignmentX') / viewBoxScale1);
    						timeObject.msDuration = parseFloat(noteObjectElem.getAttribute('score:msDuration'));
    						timeObjects.push(timeObject);
    					}
    				}

    				return timeObjects;
    			}

    			systemChildren = systemElem.children;
    			for(i = 0; i < systemChildren.length; ++i)
    			{
    				systemChildClass = systemChildren[i].getAttribute("class");
    				if(systemChildClass === 'outputStaff' || systemChildClass === 'inputStaff')
    				{
    					staff = system.staves[staffIndex++];
    					staffChildren = systemChildren[i].children;
    					for(j = 0; j < staffChildren.length; ++j)
    					{
    						staffChild = staffChildren[j];
    						staffChildClass = staffChild.getAttribute('class');
    						if(staffChildClass === 'outputVoice' || staffChildClass === 'inputVoice')
    						{
    							voice = staff.voices[voiceIndex++];
    							voice.timeObjects = getTimeObjects(staffChild.children);
    						}
    					}
    					voiceIndex = 0;
    				}
    			}
    		}

    		// Sets the msPosition of each timeObject (input and output rests and chords) in the voice.timeObjectArrays
    		// Returns the msPosition of the final barline in the score.
    		function setMsPositions(systems)
    		{
    			var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
                    timeObjects, nTimeObjects, tIndex, finalMsPosition;

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
    						nTimeObjects = timeObjects.length;
    						for(tIndex = 0; tIndex < nTimeObjects; ++tIndex)
    						{
    							timeObjects[tIndex].msPosition = msPosition;
    							msPosition += timeObjects[tIndex].msDuration;
    						}
    					}
    					finalMsPosition = msPosition;
    					msPosition = 0;
    				}
    			}
    			return finalMsPosition;
    		}

    		// Sets system.startMsPosition and system.endMsPosition. These values are needed for selecting
    		// runningMarkers.
    		// Except in the final system, system.endMsPosition is equal to  the startMsPosition of
    		// the following system. The final system's endMsPosition is set to the finalBarlineMsPosition
    		// argument.
    		// To be precise: system.StartMsPosition is the earliest msPosition of any timeObject
    		// in any voice.timeObjects. This allows for the "tied notes" which Moritz now supports...
    		//
    		// This function also adds a finalBarline (having msDuration=0, msPosition and alignmentX)
    		// to the end of each voice.timeObjects array. These values are used by endMarkers.
    		function setSystemMsPositionsAndAddFinalBarlineToEachVoice(systems, finalBarlineMsPosition)
    		{
    			var nSystems = systems.length,
                    nSystemsMinusOne = systems.length - 1,
                    nStaves = systems[0].staves.length,
                    nVoices,
                    systemIndex, staffIndex, voiceIndex,
                    system, voice, finalBarline;

    			function smallestMsPosition(system)
    			{
    				var staffIndex, voiceIndex,
                        nStaves = system.staves.length, nVoices,
                        minMsPosition = Infinity,
                        voice, voiceMsPosition;

    				for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
    				{
    					nVoices = system.staves[staffIndex].voices.length;
    					for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
    					{
    						voice = system.staves[staffIndex].voices[voiceIndex];
    						voiceMsPosition = voice.timeObjects[0].msPosition;
    						minMsPosition = (minMsPosition < voiceMsPosition) ? minMsPosition : voiceMsPosition;
    					}
    				}
    				return minMsPosition;
    			}

    			systems[0].startMsPosition = 0;
    			if(nSystems > 1) // set all but last system
    			{
    				for(systemIndex = 0; systemIndex < nSystemsMinusOne; ++systemIndex)
    				{
    					system = systems[systemIndex];
    					system.endMsPosition = smallestMsPosition(systems[systemIndex + 1]);
    					systems[systemIndex + 1].startMsPosition = system.endMsPosition;
    					for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
    					{
    						nVoices = system.staves[staffIndex].voices.length;
    						for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
    						{
    							voice = system.staves[staffIndex].voices[voiceIndex];
    							finalBarline = {};
    							finalBarline.msDuration = 0;
    							finalBarline.msPosition = systems[systemIndex + 1].startMsPosition;
    							finalBarline.alignmentX = system.right;
    							voice.timeObjects.push(finalBarline);
    						}
    					}
    				}
    			}

    			// set final system's final barline
    			system = systems[systems.length - 1];
    			system.endMsPosition = finalBarlineMsPosition;
    			for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
    			{
    				nVoices = system.staves[staffIndex].voices.length;
    				for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
    				{
    					voice = system.staves[staffIndex].voices[voiceIndex];
    					finalBarline = {};
    					finalBarline.msDuration = 0;
    					finalBarline.msPosition = finalBarlineMsPosition;
    					finalBarline.alignmentX = system.right;
    					voice.timeObjects.push(finalBarline);
    				}
    			}
    		}

    		// voice.timeObjects is an array of timeObject.
    		// speed is a floating point number, greater than zero.
    		// timeObject.msPosition and timeObject.msDuration have the values set in the score (speed === 1).
    		function changeSpeed(systems, speed)
    		{
    			var i, j, k, nSystems = systems.length, system, staff, voice;

    			// adjust the top level msDuration of each timeObject
				// the final timeObject is the final barline (msDuration = 0).
    			function adjustTotalDurations(timeObjects, speed)
    			{
    				var i, msDuration, nTimeObjects = timeObjects.length;

    				for(i = 0; i < nTimeObjects; ++i)
    				{
    					timeObjects[i].msPosition = Math.round(timeObjects[i].msPosition / speed);
    				}

    				// the final timeObject is the final barline (msDuration = 0).
    				for(i = 1; i < nTimeObjects; ++i)
    				{
    					msDuration = timeObjects[i].msPosition - timeObjects[i-1].msPosition;
    					if(msDuration < 1)
    					{
    						throw "Error: The speed has been set too high!\n\n" +
								  "(Attempt to create a chord or rest having no duration.)";
    					}
    					timeObjects[i - 1].msDuration = msDuration;
    				}
    			}

    			// Adjust the msDuration of each object in each timeObject.midiChordDef.basicChordsArray,
    			// correcting rounding errors to ensure that the sum of the durations of the
    			// basicChords is exactly equal to the containing timeObject.msDuration (which has
    			// already been adjusted).
    			function adjustBasicChordDurations(timeObjects, speed)
    			{
    				var i, nTimeObjects = timeObjects.length;

    				function adjustDurations(basicChords, speed, chordMsDuration)
    				{
    					var i, nBasicChords = basicChords.length, msFPDuration,
						msFPPositions = [], totalBasicMsDurations = 0,
						excessDuration;

    					function correctRoundingError(basicChords, excessDuration)
    					{
    						var changed;

    						while(excessDuration !== 0)
    						{
    							changed = false;

    							for(i = basicChords.length - 1; i >= 0; --i)
    							{
    								if(excessDuration > 0)
    								{
    									if(basicChords[i].msDuration > 1)
    									{
    										basicChords[i].msDuration -= 1;
    										excessDuration -= 1;
    										changed = true;
    									}
    								}
    								else if(excessDuration < 0)
    								{
    									basicChords[nBasicChords - 1].msDuration += 1;
    									excessDuration += 1;
    									changed = true;
    								}
    								else
    								{
    									break;
    								}
    							}

    							if(excessDuration !== 0 && !changed)
    							{
    								throw "Error: The speed has been set too high!\n\n" +
											"(Can't adjust the duration of a set of basicChords.)";
    							}
    						}
    					}

    					// get the speed changed (floating point) basic chord positions re start of chord.
    					msFPPositions.push(0);
    					for(i = 0; i < nBasicChords; ++i)
    					{
    						msFPDuration = basicChords[i].msDuration / speed;
    						msFPPositions.push(msFPDuration + msFPPositions[i]);
    					}

    					// get the (integer) msDuration of each basic chord (possibly with rounding errors)
    					// nMsPositions = nBasicChords + 1;
    					for(i = 0; i < nBasicChords; ++i)
    					{
    						basicChords[i].msDuration = Math.round(msFPPositions[i + 1] - msFPPositions[i]);
    						if(basicChords[i].msDuration < 1)
    						{
    							throw "Error: The speed has been set too high!\n\n" +
									  "(Attempt to create a basicChord with no duration.)";
    						}
    						totalBasicMsDurations += basicChords[i].msDuration;
    					}

    					// if there is a rounding error, correct it.
    					excessDuration = totalBasicMsDurations - chordMsDuration;
    					if(excessDuration !== 0)
    					{
    						correctRoundingError(basicChords, excessDuration);
    					}
    				}

    				for(i = 0; i < nTimeObjects; ++i)
    				{
    					if(timeObjects[i].midiChordDef !== undefined)
    					{
    						adjustDurations(timeObjects[i].midiChordDef.basicChordsArray, speed, timeObjects[i].msDuration);
    					}
    				}
    			}

    			for(i = 0; i < nSystems; ++i)
    			{
    				system = systems[i];
    				system.endMsPosition = Math.round(system.endMsPosition / speed);
    				for(j = 0; j < system.staves.length; ++j)
    				{
    					staff = system.staves[j];
    					for(k = 0; k < staff.voices.length; ++k)
    					{
    						voice = staff.voices[k];
    						adjustTotalDurations(voice.timeObjects, speed);
    						if(voice.class === "outputVoice")
    						{
    							adjustBasicChordDurations(voice.timeObjects, speed);
    						}							
    					}
    				}
    			}
    		}

    		/*************** end of getTimeObjects function definitions *****************************/

    		systemIndex = 0;
    		for(i = 0; i < systemElems.length; ++i)
    		{
    			systemElem = systemElems[i];
    			if(systems[systemIndex].msDuration !== undefined)
    			{
    				delete systems[systemIndex].msDuration; // is reset in the following function
    			}
    			getSystemTimeObjects(systems[systemIndex], viewBoxScale, systemElem);
    			systemIndex++;
    		}

    		finalBarlineMsPosition = setMsPositions(systems);
    		setSystemMsPositionsAndAddFinalBarlineToEachVoice(systems, finalBarlineMsPosition);

    		if(speed !== 1)
    		{
    			changeSpeed(systems, speed); // can throw an exception
    		}

    		lastSystemTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;
    		finalBarlineInScore = lastSystemTimeObjects[lastSystemTimeObjects.length - 1]; // 'global' object
    	}

    	function setSystemMarkerParameters(systems, isLivePerformance)
    	{
    		var i, nSystems = systems.length, system;
    		for(i = 0; i < nSystems; ++i)
    		{
    			system = systems[i];
    			system.startMarker.setParameters(system, i);
    			system.startMarker.setVisible(false);
    			system.runningMarker.setParameters(system, i, isLivePerformance, trackIsOnArray);
    			system.runningMarker.setVisible(false);
    			system.endMarker.setParameters(system);
    			system.endMarker.setVisible(false);
    		}

    		startMarker = systems[0].startMarker;
    		startMarker.setVisible(true);

    		moveRunningMarkerToStartMarker(); // is only visible when playing...

    		endMarker = systems[systems.length - 1].endMarker;
    		endMarker.moveTo(finalBarlineInScore);
    		endMarker.setVisible(true);
    	}

        // inserts each midiChord's finalChordOffMoment.messages in the first moment in the following midiObject.
        function transferFinalChordOffMoments(outputTracks)
        {
            var track, trackIndex, midiObjectIndex, finalChordOffMessages, nextObjectMessages, i;

            for(trackIndex = 0; trackIndex < outputTracks.length; ++trackIndex)
            {
                track = outputTracks[trackIndex];
                if(track.midiObjects.length > 1)
                {
                    for(midiObjectIndex = 1; midiObjectIndex < track.midiObjects.length; ++midiObjectIndex)
                    {
                        if(track.midiObjects[midiObjectIndex - 1] instanceof MidiChord)
                        {
                        	console.assert(track.midiObjects[midiObjectIndex - 1].finalChordOffMoment !== undefined, "finalChordOffMoment must be defined (but it can be empty).");

                            finalChordOffMessages = track.midiObjects[midiObjectIndex - 1].finalChordOffMoment.messages;
                            nextObjectMessages = track.midiObjects[midiObjectIndex].moments[0].messages;
                            for(i = 0; i < finalChordOffMessages.length; ++i)
                            {
                                nextObjectMessages.splice(0, 0, finalChordOffMessages[i]);
                            }
                        }
                    }
                }
            }
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
        			if(voice.class === "outputVoice")
        			{
        				outputTracks.push(new Track());
        				outputTracks[outputTrackIndex].midiObjects = [];
        				outputTracks[outputTrackIndex].midiChannel = voice.midiChannel;
        				outputTracks[outputTrackIndex].masterVolume = voice.masterVolume;
        				outputTrackIndex++;
        			}
        			else // voice.class === "inputVoice" 
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

        getOutputAndInputTimeObjects(globalSpeed);

        setSystemMarkerParameters(systems, isLivePerformance);

        setTrackAttributes(outputTracks, inputTracks, systems[0].staves);

        nStaves = systems[0].staves.length;

        for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
        	system = systems[sysIndex];
        	outputTrackIndex = 0;
        	inputTrackIndex = 0;
            for(staffIndex = 0; staffIndex < nStaves; ++staffIndex)
            {
            	staff = system.staves[staffIndex];
            	nVoices = staff.voices.length;
            	for(voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
            	{
            		voice = staff.voices[voiceIndex];
            		nTimeObjects = voice.timeObjects.length;
            		if(voice.class === "outputVoice")
            		{
            			outputTrack = outputTracks[outputTrackIndex];
            			for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
            			{
            				timeObject = voice.timeObjects[timeObjectIndex];
            				if(timeObject.midiChordDef === undefined)
            				{
            					if(timeObjectIndex < (nTimeObjects - 1))
            					{
            						// A real rest. All barlines on the right ends of staves are ignored.
            						midiRest = new MidiRest(timeObject);
            						outputTrack.midiObjects.push(midiRest);
            					}
            				}
            				else
            				{
            					midiChordDef = timeObject.midiChordDef;
            					midiChord = new MidiChord(outputTrack.midiChannel, midiChordDef, timeObject);
            					outputTrack.midiObjects.push(midiChord);
            				}
            			}
            			++outputTrackIndex;
            		}
            		else // inputVoice
            		{
            			inputTrack = inputTracks[inputTrackIndex];
            			for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
            			{
            				timeObject = voice.timeObjects[timeObjectIndex];
            				if(timeObject.inputChordDef === undefined)
            				{
            					if(timeObjectIndex < (nTimeObjects - 1))
            					{
            						// A real rest. All barlines on the right ends of staves are ignored.
            						inputRest = new InputRest(timeObject);
            						inputTrack.inputObjects.push(inputRest);
            					}
            				}
            				else
            				{
            					inputChord = new InputChord(timeObject, outputTracks); // the outputTracks should already be complete here
            					inputTrack.inputObjects.push(inputChord);
            				}
            			}
            			++inputTrackIndex;
            		}
            	}
            }
        }

        transferFinalChordOffMoments(outputTracks);

        tracksData.inputTracks = inputTracks;
        tracksData.outputTracks = outputTracks;

		//	if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
		//		inputKeyRange.bottomKey
		//		inputKeyRange.topKey
        if(inputTracks.length > 0)
        {
        	tracksData.inputKeyRange = getInputKeyRange(inputTracks);			
        }

        return tracksData;
	},

    // an empty score
    Score = function (callback)
    {
        if (!(this instanceof Score))
        {
            return new Score(callback);
        }

        markersLayers = [];
        systems = [];

        runningMarkerHeightChanged = callback;

        // Sends a noteOff to all notes on all channels on the midi output device.
        this.allNotesOff = allNotesOff;

        // functions called when setting the start or end marker
        this.setStartMarkerClick = setStartMarkerClick;
        this.setEndMarkerClick = setEndMarkerClick;

        // functions called when clicking the sendStartMarkerToStart of senEndMarkerToEnd buttons
        this.sendStartMarkerToStart = sendStartMarkerToStart;
        this.sendEndMarkerToEnd = sendEndMarkerToEnd;

        // functions which return the current start and end times.
        this.startMarkerMsPosition = startMarkerMsPosition;
        this.endMarkerMsPosition = endMarkerMsPosition;
        this.getReadOnlyTrackIsOnArray = getReadOnlyTrackIsOnArray;

        // Called when the start button is clicked in the top options panel,
        // and when setOptions button is clicked at the top of the score.
        // If the startMarker is not fully visible in the svgPagesDiv, move
        // it to the top of the div.
        this.moveStartMarkerToTop = moveStartMarkerToTop;

        // Recalculates the timeObject lists for the runningMarkers (1 marker per system),
        // using trackIsOnArray (tracksControl.trackIsOnArray) to take into account which tracks are actually performing.
        // When the score is first read, all tracks perform by default.
        this.setRunningMarkers = setRunningMarkers;
        // Advances the running marker to the following timeObject (in any channel)
        // if the msPosition argument is >= that object's msPosition. Otherwise does nothing.
        this.advanceRunningMarker = advanceRunningMarker;
        this.hideRunningMarkers = hideRunningMarkers;
        this.moveRunningMarkerToStartMarker = moveRunningMarkerToStartMarker;

    	// markersLayers contains one markersLayer per page of the score.
    	// Each markersLayer contains the assistant performer's markers
    	// and the page-sized transparent, clickable surface used when
    	// setting them.
        this.markersLayers = markersLayers;

        this.getEmptyPagesAndSystems = getEmptyPagesAndSystems;

    	// Returns a tracksData object having the following defined attributes:
    	//		inputTracks[] - an array of tracks containing inputChords and inputRests
    	//		outputTracks[] - an array of tracks containing outputChords and outputRests
    	//		if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
    	//			inputKeyRange.bottomKey
    	//			inputKeyRange.topKey
        this.getTracksData = getTracksData;

        // The TracksControl controls the display, and should be the only module to call this function.
        this.refreshDisplay = refreshDisplay;
    },

    publicAPI =
    {
        // empty score constructor (access to GUI functions)
        Score: Score

    };
// end var

return publicAPI;

}(document));

