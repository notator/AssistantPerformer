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


/*jslint white */
/*global _AP,  window,  document, performance */

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

	// Returns the performing restDef or (in any performing input or output track, depending on findInput) midiChordDef or inputChordDef closest to alignmentX.
	// If trackIndex is defined, the returned timeObject will be in that track.
	// If there are no chordDefs matching the arguments (i.e. if all the timeObjects are restDefs), the returned timeObject will be null.
	findPerformingTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, findInput, alignmentX, trackIndex)
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
	                    if((!findInput)  // timeObject is a restDef or midiChordDef in an outputVoice
						|| (findInput &&
                            (timeObject.inputChordDef === undefined // a rest in an inputVoice
                            || (timeObject.inputChordDef !== undefined && hasPerformingTrack(timeObject.inputChordDef, trackIsOnArray)))))
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
        var i, system = systems[startMarker.systemIndex()],
        startMarkerAlignmentX = startMarker.timeObject().alignmentX,
        timeObjectsArray = getTimeObjectsArray(system), timeObject,
        nOutputTracks = outputTrackPerMidiChannel.length;

    	// This function sets the opacity of the visible OutputStaves.
    	// (there are no InputStaves in the system, when isLivePerformance === false)
    	// Staves have either one or two voices (=tracks).
        // The tracks are 0-indexed channels from top to bottom of the system.
    	// If trackIsOnArray[trackIndex] is true, its stafflines opacity is set to 1.
        // If trackIsOnArray[trackIndex] is false, its stafflines opacity is set to 0.3.
		// When the staff has one track, all its stafflines are set for the track.
        // When the staff has two tracks, the top three stafflines are set for the upper track,
        // and the lower two lines are set for the lower track. 
        function setOutputView(trackIsOnArray, isLivePerformance)
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
        			if(staff.class !== "outputStaff")
        			{
        				break;
        			}
        			nTracksPerStaff = staff.voices.length;
        			for(t = 0; t < nTracksPerStaff; ++t)
        			{
        				if(staff.isVisible)
        				{
        				    opacity = (trackIsOnArray[trackIndex]) ? 1 : 0.3;

        				    setStafflinesOpacity(staff.voices[t], trackIsOnArray, trackIndex, nTracksPerStaff, opacity);

        					voiceGraphicElements = staff.voices[t].graphicElements;
        					for(g = 0; g < voiceGraphicElements.length; ++g)
        					{
        						voiceGraphicElement = voiceGraphicElements[g];
        						voiceGraphicElement.style.opacity = opacity;                                    
        					}
        				}

        				++trackIndex;
        			}
        		}
        	}
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

        setOutputView(trackIsOnArray, isLivePerformance);

        if(isLivePerformance)
        {
        	timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignmentX);
        }
        else
        {
        	timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignmentX);
		}
    	// Move the start marker if necessary.
        // timeObject will be null if there are only rests to be found. In this case, the startMarker doesn't need to be moved.
        if(timeObject !== null && timeObject.alignmentX !== startMarkerAlignmentX)
        {
        	updateStartMarker(timeObjectsArray, timeObject);
        }
    },

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    svgPageClicked = function (e, state)
    {
        var frame = e.target,
            cursorX = e.pageX,
            cursorY = e.pageY + frame.originY,
            systemIndex, system,
            timeObjectsArray, timeObject, trackIndex, nOutputTracks = outputTrackPerMidiChannel.length;

        // cursorX and cursorY now use the <body> element as their frame of reference.
        // this is the same frame of reference as in the systems.
        // systems is a single global array (inside this namespace)of all systems.
        // This is important when identifying systems, and when performing.

        // Returns the system having stafflines closest to cursorY.
        function findSystemIndex(cursorY)
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
                    if (cursorY >= topLimit && cursorY < bottomLimit)
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

        // Returns the index of the staff having stafflines closest to cursorY
        function findStaffIndex(cursorY, staves)
        {
            var rStaffIndex, i, nStaves, topLimit, bottomLimit;

            if (cursorY <= staves[0].bottomLineY)
            {
                rStaffIndex = 0;
            }
            else if (cursorY >= staves[staves.length - 1].topLineY)
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
                    if (cursorY >= topLimit && cursorY <= bottomLimit)
                    {
                        rStaffIndex = ((cursorY - topLimit) < (bottomLimit - cursorY)) ? i - 1 : i;
                        break;
                    }

                    if (cursorY >= staves[i].topLineY && cursorY <= staves[i].bottomLineY)
                    {
                        rStaffIndex = i;
                        break;
                    }
                }
            }
            return rStaffIndex;
        }

        // Returns the index of the voice closest to cursorY
        function findVoiceIndex(cursorY, voices)
        {
            var index, nVoices = voices.length, midY;
            if (nVoices === 1)
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

        function getEndMarkerTimeObject(timeObject, cursorX, systems, systemIndex)
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

        	if(cursorX > rightBarlineTimeObject.alignmentX || ((rightBarlineTimeObject.alignmentX - cursorX) < (cursorX - timeObject.alignmentX)))
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

        systemIndex = findSystemIndex(cursorY);
        if (systemIndex !== undefined)
        {
        	system = systems[systemIndex];

        	timeObjectsArray = getTimeObjectsArray(system);

        	trackIndex = findTrackIndex(cursorY, system);

            if(isLivePerformance === true)
            {
            	timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex);
            }
            else
            {
            	timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, cursorX, trackIndex);
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
            			// returns the rightmost barline if that is closer to cursorX than the timeObject
            			// returns null if timeObject.alignmentX is the alignmentx of the first chord on the system.
            			timeObject = getEndMarkerTimeObject(timeObject, cursorX, systems, systemIndex);
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
    advanceRunningMarker = function(msPosition, systemIndex)
    {
    	if(systemIndex > runningMarker.systemIndex())
    	{
    		// Move runningMarker to msPosition in the next system.
    		runningMarker.setVisible(false);
    		if(runningMarker.systemIndex() < endMarker.systemIndex())
    		{
    			runningMarker = systems[runningMarker.systemIndex() + 1].runningMarker;
    			runningMarker.moveTo(msPosition);
    			runningMarker.setVisible(true);
    			// callback for auto scroll
    			runningMarkerHeightChanged(runningMarker.getYCoordinates());
    		}
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
    	function getVoiceObjects(speed)
    	{
    		var systemElem,
                i, systemIndex,
                lastSystemTimeObjects;

    		function getSystemVoiceObjects(systems, systemIndex, viewBoxScale1, systemElem)
    		{
    			var i, j,
					system = systems[systemIndex],
					systemChildren, systemChildClass,
                    staff, staffChildren, staffChildClass, staffChild,
                    voice,
                    staffIndex = 0,
                    voiceIndex = 0,
                    voiceIndexInStaff = 0;

    		    // There is a timeObject for every input and output chord or rest and the final barline in each voice.
    		    // All timeObjects are allocated alignmentX and msDuration fields.
    		    // Chord timeObjects are allocated either a midiChordDef or an inputChordDef field depending on whether they are input or output chords.
    			function getTimeObjects(systemIndex, noteObjectElems)
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
    			            timeObject.systemIndex = systemIndex;
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
    			            timeObject.systemIndex = systemIndex;
    			            timeObject.msDuration = parseFloat(noteObjectElem.getAttribute('score:msDuration'));
    			            timeObjects.push(timeObject);
    			        }
    			        else if(i === length - 1)
    			        {
    			            timeObject = {}; // the final barline in the voice (used when changing speed)
    			            timeObject.msDuration = 0;
    			            timeObject.systemIndex = systemIndex;
    			            // msPosition and alignmentX are set later
    			            // timeObject.msPosition = systems[systemIndex + 1].startMsPosition;
    			            // timeObject.alignmentX = system.right;
    			            timeObjects.push(timeObject);
    			        }
    			    }

    			    return timeObjects;
    			}

    		    // These are SVG elements in the voice that will have their opacity changed when the voice is disabled.
    			function getGraphicElements(systemIndex, noteObjectElems)
    			{
    				var graphicElements = [], type, i, length, noteObjectElem;

    				length = noteObjectElems.length;
    				for(i = 0; i < length; ++i)
    				{
    					noteObjectElem = noteObjectElems[i];
    					type = noteObjectElem.getAttribute('class');
    					if(type === 'outputChord' || type === 'inputChord' || type === 'cautionaryChord' || type === 'rest'
                        || type === 'clef' || type === 'barline' || type === 'staffName' || type === 'beamBlock' || type === 'clefChange'
                        || type === 'endBarlineLeft' || type === 'endBarlineRight')
    					{
    					    graphicElements.push(noteObjectElem);
    					}
    				}

    				return graphicElements;
    			}

    		    // The stafflines element that will have its opacity changed when the staff's voices are both disabled.
    			function getStaffLinesElem(staffChildren)
    			{
    			    var i, stafflinesElem;

    			    for(i = 0; i < staffChildren.length; ++i)
    			    {
    			        if(staffChildren[i].getAttribute('class') === "stafflines")
    			        {
    			            stafflinesElem = staffChildren[i];
    			            break;
    			        }
    			    }

    			    return stafflinesElem;
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
    						voiceIndexInStaff = 0;
    						if(staffChildClass === 'outputVoice' || staffChildClass === 'inputVoice')
    						{
    							voice = staff.voices[voiceIndex++];
    							voice.timeObjects = getTimeObjects(systemIndex, staffChild.children);
    							voice.graphicElements = getGraphicElements(systemIndex, staffChild.children); // will be used to set opacity when the voice is disabled
    							if(voiceIndexInStaff === 0)
    							{
    							    voice.staffLinesElem = getStaffLinesElem(staffChildren);
    							    voiceIndexInStaff++;
    							}
    						}
    					}
    					voiceIndex = 0;
    				}
    			}
    		}

    		// Sets the msPosition of each timeObject (input and output rests and chords, and each voice's final barline)
			// in the voice.timeObjectArrays.
    		function setMsPositions(systems)
    		{
    			var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
                    timeObjects, nTimeObjects, tIndex;

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
    					msPosition = 0;
    				}

    			}
    		}

			// The rightmost barlines all need an AlignmentX to which the EndMarker can be set.
    		function setRightmostBarlinesAlignmentX(systems)
    		{
    			var i, nSystems = systems.length, system,
				    j, nStaves, staff,
					k, nVoices, voice,
					finalBarline,
					rightmostAlignmentX = systems[0].right;

    			for(i = 0; i < nSystems; ++i)
    			{
    				system = systems[i];
    				nStaves = system.staves.length;
    				for(j = 0; j < nStaves; ++j)
    				{
    					staff = system.staves[j];
    					nVoices = staff.voices.length;
    					for(k = 0; k < nVoices; ++k)
    					{
    						voice = staff.voices[k];
    						finalBarline = voice.timeObjects[voice.timeObjects.length - 1];
    						finalBarline.alignmentX = rightmostAlignmentX;
    					}
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
    			getSystemVoiceObjects(systems, systemIndex, viewBoxScale, systemElem);
    			systemIndex++;
    		}

    		setMsPositions(systems);
    		setRightmostBarlinesAlignmentX(systems);

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
    			system.endMarker.setParameters(system, i);
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
            var track, trackIndex, midiObjectIndex, finalChordOffMessages, nextObjectMessages, i, previousMidiChord;

            for(trackIndex = 0; trackIndex < outputTracks.length; ++trackIndex)
            {
                track = outputTracks[trackIndex];
                if(track.midiObjects.length > 1)
                {
                    for(midiObjectIndex = 1; midiObjectIndex < track.midiObjects.length; ++midiObjectIndex)
                    {
                        if(track.midiObjects[midiObjectIndex - 1] instanceof MidiChord)
                        {
                        	previousMidiChord = track.midiObjects[midiObjectIndex - 1];
                        	console.assert(previousMidiChord.finalChordOffMoment !== undefined, "finalChordOffMoment must be defined (but it can be empty).");

                        	finalChordOffMessages = previousMidiChord.finalChordOffMoment.messages;
                            nextObjectMessages = track.midiObjects[midiObjectIndex].moments[0].messages;
                            for(i = 0; i < finalChordOffMessages.length; ++i)
                            {
                                nextObjectMessages.splice(0, 0, finalChordOffMessages[i]);
                            }
                            //previousMidiChord.finalChordOffMoment = undefined;
                            previousMidiChord.moments.length -= 1;	
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
						outputTracks[outputTrackIndex].isVisible = staff.isVisible;
        				outputTrackIndex++;
        			}
        			else // voice.class === "inputVoice" 
        			{
        				inputTracks.push(new Track());
        				inputTracks[inputTrackIndex].inputObjects = [];
        				inputTracks[inputTrackIndex].isVisible = staff.isVisible;
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

        getVoiceObjects(globalSpeed);

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

