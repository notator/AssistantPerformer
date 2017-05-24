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

_AP.namespace('_AP.score');

_AP.score = (function (document)
{
    "use strict";

    var
    StartMarker = _AP.startMarker.StartMarker,
    RunningMarker = _AP.runningMarker.RunningMarker,
    EndMarker = _AP.endMarker.EndMarker,
    TimePointer = _AP.timePointer.TimePointer,
    Conductor = _AP.conductor.Conductor,

    MidiChord = _AP.midiObject.MidiChord,
    MidiRest = _AP.midiObject.MidiRest,
    Track = _AP.track.Track,

    InputChordDef = _AP.inputObjectDef.InputChordDef,
    InputRestDef = _AP.inputObjectDef.InputRestDef,
    InputChord = _AP.inputChord.InputChord,

    BLACK_COLOR = "#000000",
    GREY_COLOR = "#7888A0",
    ENABLED_INPUT_TITLE_COLOR = "#3333EE",
    DISABLED_PINK_COLOR = "#FFBBBB",

    midiChannelPerOutputTrack = [], // only output tracks

    tracksData = {},
    // This array is initialized to all tracks on (=true) when the score is loaded,
    // and reset when the tracksControl calls refreshDisplay().
    trackIsOnArray = [], // all tracks, including input tracks

    viewBoxScale,

    // The frames around each svgPage
    markersLayers = [],

    // See comments in the publicAPI definition at the bottom of this file.
    systemElems = [], // an array of all the systemElems
    systems = [], // an array of all the systems

    // This value is changed when the start runtime button is clicked.
    // It is used when setting the positions of the start and end markers.
    isLivePerformance = false,
    // This value is toggled on or off by the conducting performance button.
    isConducting = false,

    startMarker,
    runningMarker,
    endMarker,
    conductor, // an object that has a now() function).
    runningMarkerHeightChanged, // callback, called when runningMarker changes systems

    finalBarlineInScore,

    getConductor = function(speed)
    {
        conductor.setSpeed(speed);
        return conductor;
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

    // Returns null or the performing midiChord, midiRest, inputChord or voice end TimeObject closest to alignment
    // (in any performing input or output track, depending on findInput).
    // If trackIndex is defined, the returned timeObject will be in that track.
    // Returns null if no timeObject can be found that matches the arguments.
    findPerformingTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, findInput, alignment, trackIndex)
    {
        var i, j, timeObjects, timeObject = null, timeObjectBefore = null, timeObjectAfter = null, returnTimeObject = null, nTimeObjects,
            nAllTracks = timeObjectsArray.length, deltaBefore = Number.MAX_VALUE, deltaAfter = Number.MAX_VALUE, startIndex, endIndex;

        function hasPerformingTrack(inputChord, trackIsOnArray)
        {
            var i, outputTrackFound = false, outputTrackIndices;

            console.assert(inputChord !== undefined, "inputChord must be defined.");

            outputTrackIndices = inputChord.referencedOutputTrackIndices();
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
                           (timeObject.inputChord !== undefined && hasPerformingTrack(timeObject.inputChord, trackIsOnArray))))
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
        if(returnTimeObject === null && (timeObjectBefore !== null || timeObjectAfter !== null))
        {
            returnTimeObject = (deltaBefore > deltaAfter) ? timeObjectAfter : timeObjectBefore;
        }
        return returnTimeObject;
    },

    findPerformingInputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex)
    {
        var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, true, alignment, trackIndex);
        return returnTimeObject;
    },

    findPerformingOutputTimeObject = function(timeObjectsArray, nOutputTracks, trackIsOnArray, alignment, trackIndex)
    {
        var returnTimeObject = findPerformingTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, false, alignment, trackIndex);
        return returnTimeObject;
    },

    updateStartMarker = function(timeObjectsArray, timeObject)
    {
        var nOutputTracks = midiChannelPerOutputTrack.length;

        if(isLivePerformance === false)
        {
            timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
        }
        else
        {
            timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, timeObject.alignment);
        }

        if(timeObject.msPositionInScore < endMarker.msPositionInScore)
        {
            startMarker.moveTo(timeObject);
        }
    },

    // This function is called by the tracksControl whenever a track's on/off state is toggled.
    // It draws the staves with the right colours and, if necessary, moves the start marker to a chord.
    refreshDisplay = function(trackIsOnArrayArg)
    {
        var i, system = systems[startMarker.systemIndex],
        startMarkerAlignment = startMarker.alignment,
        timeObjectsArray = getTimeObjectsArray(system), timeObject,
        nOutputTracks = midiChannelPerOutputTrack.length;

        // This function sets the opacity of the visible OutputStaves.
        // (there are no InputStaves in the system, when isLivePerformance === false)
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

        setOutputView(trackIsOnArray);

        if(isLivePerformance)
        {
            timeObject = findPerformingInputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment);
        }
        else
        {
            timeObject = findPerformingOutputTimeObject(timeObjectsArray, nOutputTracks, trackIsOnArray, startMarkerAlignment);
        }
        // Move the start marker if necessary.
        // timeObject will be null if there are only rests to be found. In this case, the startMarker doesn't need to be moved.
        if(timeObject !== null && timeObject.alignment !== startMarkerAlignment)
        {
            updateStartMarker(timeObjectsArray, timeObject);
        }
    },

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    svgPageClicked = function(e, state)
    {
        var target = e.target,
            cursorX = e.pageX,
            cursorY = e.pageY,
            systemIndex, system,
            pageIndex,
            timeObjectsArray, timeObject, trackIndex, nOutputTracks = midiChannelPerOutputTrack.length;

        // cursorX and cursorY now use the <body> element as their frame of reference.
        // this is the same frame of reference as in the systems.
        // systems is a single global array (inside this namespace)of all systems.
        // This is important when identifying systems, and when performing.

        // returns the index of the page that has been clicked
        function findPageIndex(target)
        {
            var i, pageIndex = 0, rect;

            for(i = 0; i < markersLayers.length; ++i)
            {
                rect = markersLayers[i].childNodes[0];
                if(rect.nodeName !== 'rect')
                {
                    throw "error";
                }
                if(rect === target)
                {
                    pageIndex = i;
                    break;
                }
            }

            return pageIndex;
        }

        // Returns the system having stafflines closest to cursorY on the target page.
        function findSystemIndex(cursorY, pageIndex)
        {
            var i, topLimit, bottomLimit, system, systemIndex;

            if(systems.length === 1)
            {
                systemIndex = 0;
            }
            else
            {
                topLimit = -1;
                for(i = 0; i < systems.length - 1; ++i)
                {
                    system = systems[i];
                    if(system.pageIndex === pageIndex)
                    {
                        bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
                        if(cursorY >= topLimit && cursorY < bottomLimit)
                        {
                            systemIndex = i;
                            break;
                        }
                        topLimit = bottomLimit;
                    }
                }

                if(systemIndex === undefined)
                {
                    for(i = 0; i < systems.length; ++i)
                    {
                        system = systems[i];
                        if(system.pageIndex === pageIndex)
                        {
                            systemIndex = i; // last system on page
                        }
                    }
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

        pageIndex = findPageIndex(target);
        systemIndex = findSystemIndex(cursorY, pageIndex);
        if(systemIndex !== undefined)
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

            // timeObject is either null (if the track has been disabled) or is now the nearest performing chord to the click,
            // either in a live performers voice (if there is one and it is performing) or in a performing output voice.
            if(timeObject !== null)
            {
                switch(state)
                {
                    case 'settingStart':
                        if(timeObject.msPositionInScore < endMarker.msPositionInScore)
                        {
                            startMarker = system.startMarker;
                            hideStartMarkersExcept(startMarker);
                            updateStartMarker(timeObjectsArray, timeObject);
                        }
                        break;
                    case 'settingEnd':
                        if(startMarker.msPositionInScore < timeObject.msPositionInScore)
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

    hideRunningMarkers = function()
    {
        var i, nSystems = systems.length;

        for(i = 0; i < nSystems; ++i)
        {
            systems[i].runningMarker.setVisible(false);
            if(isConducting)
            {
                systems[i].timePointer.setVisible(false);
            }
        }
    },

    moveRunningMarkersToStartMarkers = function()
    {
        var i, nSystems = systems.length;

        for(i = 0; i < nSystems; ++i)
        {
            systems[i].runningMarker.moveTo(systems[i].startMarker.msPositionInScore);
        }
    },

    // Called when the go button or the startConducting button is clicked.
    setRunningMarkers = function()
    {
        var sysIndex, nSystems = systems.length, system;

        for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
        }
        hideRunningMarkers();
        moveRunningMarkersToStartMarkers();
        runningMarker = systems[startMarker.systemIndex].runningMarker;
        runningMarker.setVisible(true);
    },

    // Called when the start conducting button is clicked on or off.
    setConducting = function(boolean)
    {
        var sysIndex, nSystems = systems.length, system, timePointers = [], endOfSystemTimeObject;

        function getEndOfSystemTimeObject(system)
        {
            var
            finalIndex = system.staves[0].voices[0].timeObjects.length - 1,
            endOfSystemTimeObject;
        
            endOfSystemTimeObject = system.staves[0].voices[0].timeObjects[finalIndex];

            return endOfSystemTimeObject;
        }

        setRunningMarkers();

        isConducting = boolean; // score.isConducting!
        if(isConducting)
        {
            for(sysIndex = 0; sysIndex < nSystems; ++sysIndex)
            {
                system = systems[sysIndex];

                endOfSystemTimeObject = getEndOfSystemTimeObject(system);
                system.timePointer.init(system.startMarker, system.runningMarker, endOfSystemTimeObject);

                timePointers.push(system.timePointer);

                if(sysIndex === startMarker.systemIndex)
                {
                    conductor.setTimePointer(system.timePointer);
                }
            }
        }
        else
        {
            conductor.setTimePointer(undefined);
        }
    },

    conduct = function(e)
    {
        conductor.conduct(e);
    },

    // Constructs empty systems for all the pages.
    // Each page has a frame and the correct number of empty systems.
    // Each system has a startMarker, a runningMarker and an endMarker, but these are left
    // on the left edge of the page.
    // Each system has the correct number of staves containing the correct number of voices.
    // The staves have set boolean isOutput and isVisible attributes.
    // The voices have a set boolean isOutput attribute, but as yet no timeObject arrays.
    // The score's trackIsOnArray is initialized to all tracks on (=true).
    // If isLivePerformance === true, then outputStaves are grey, inputStaves are black.
    // If isLivePerformance === false, then outputStaves are black, inputStaves are pink.
    getEmptySystems = function (isLivePerformanceArg, startPlayingFunction)
    {
        var system, svgPageEmbeds, viewBox, nPages,
            svgPage, svgElem, pageSystemsElem, pageSystemElems, systemElem,
            i, j, markersLayer, pageSystems;

        function resetContent(isLivePerformanceArg)
        {
            isLivePerformance = isLivePerformanceArg;
            markersLayers.length = 0;
            systemElems.length = 0;
            systems.length = 0;
            midiChannelPerOutputTrack.length = 0;
            trackIsOnArray.length = 0;
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

        function getEmptySystem(viewBoxScale, systemElem)
        {
            var i, j,
                systemDy, staffDy,
                staffElems, staffElem, stafflinesElems,
                outputVoiceElem, outputVoiceElems, inputVoiceElem, inputVoiceElems,                
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
                lineElem, svgStafflines = [], staffLinesElemChildren = stafflinesElem.children;

                for (i = 0; i < staffLinesElemChildren.length; ++i)
                {
                    console.assert(staffLinesElemChildren[i].nodeName === "line");
                    lineElem = staffLinesElemChildren[i];
                    svgStafflines.push(lineElem);
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
                rStafflineInfo.svgStafflines = svgStafflines;

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

                if(staff.isOutput === true)
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
                if(staff.isOutput === false)
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

            function getSystemMarkerLimits(system, systemElem, systemDY)
            {
                var i, sysElemChildren, leftToRightElem, topToBottomElem,
                    minPixelsAbove = -20 * viewBoxScale, markersTopDY;
                
                sysElemChildren = systemElem.children;
                for(i = 0; i < sysElemChildren.length; ++i)
                {
                    if(sysElemChildren[i].nodeName === "score:leftToRight")
                    {
                        leftToRightElem = sysElemChildren[i];
                        markersTopDY = (minPixelsAbove < systemDY) ? minPixelsAbove : systemDY;
                        system.markersTop = markersTopDY + parseInt(leftToRightElem.getAttribute("systemTop"), 10);
                        system.markersBottom = systemDY + parseInt(leftToRightElem.getAttribute("systemBottom"), 10);
                        break;
                    }
                    if(sysElemChildren[i].nodeName === "score:topToBottom")
                    {
                        topToBottomElem = sysElemChildren[i];
                        system.markersLeft = parseInt(topToBottomElem.getAttribute("systemLeft"), 10);
                        system.markersRight = parseInt(topToBottomElem.getAttribute("systemRight"), 10);
                        break;
                    }
                }
            }

            system = {};
            systemDy = getDy(systemElem);

            getSystemMarkerLimits(system, systemElem, systemDy);

            system.staves = [];

            staffElems = getElems(systemElem, "outputStaff", "inputStaff");

            for(i = 0; i < staffElems.length; ++i)
            {
                staffElem = staffElems[i];
                staff = {};
                staffDy = systemDy + getDy(staffElem);
                staff.isOutput = (staffElem.getAttribute("class") === "outputStaff");
                staff.isVisible = ((staffElem.getAttribute("score:invisible") === "1") === false);
                staff.voices = [];
                system.staves.push(staff);

                if(staff.isOutput === true)
                {
                    outputVoiceElems = staffElem.getElementsByClassName("outputVoice");
                    for(j = 0; j < outputVoiceElems.length; ++j)
                    {
                        outputVoiceElem = outputVoiceElems[j];
                        staff.nameElem = getNameElem(outputVoiceElem);
                        voice = {};
                        voice.isOutput = true;
                        staff.voices.push(voice);
                    }
                }
                else // input staff
                {
                    inputVoiceElems = staffElem.getElementsByClassName("inputVoice");
                    for(j = 0; j < inputVoiceElems.length; ++j)
                    {
                        inputVoiceElem = inputVoiceElems[j];
                        staff.nameElem = getNameElem(inputVoiceElem);
                        voice = {};
                        voice.isOutput = false;
                        staff.voices.push(voice);
                    }
                }

                if(staff.isVisible)
                {
                    stafflinesElems = staffElem.getElementsByClassName("stafflines");
                    if(stafflinesElems !== undefined && stafflinesElems.length > 0)
                    {
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
            }

            return system;
        }

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

        // Appends the markers and timePointers to the markerslayer.
        function createMarkers(conductor, markersLayer, viewBoxScale, system, systIndex)
        {
            var startMarkerElem, runningMarkerElem, endMarkerElem, runningMarkerHeight;

            function newStartMarkerElem()
            {
                var startMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                    startMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
                    startMarkerDisk = document.createElementNS("http://www.w3.org/2000/svg", 'circle');

                startMarkerLine.setAttribute("x1", "0");
                startMarkerLine.setAttribute("y1", "0");
                startMarkerLine.setAttribute("x2", "0");
                startMarkerLine.setAttribute("y2", "0");
                startMarkerLine.setAttribute("style", "stroke-width:1px");

                startMarkerDisk.setAttribute("cx", "0");
                startMarkerDisk.setAttribute("cy", "0");
                startMarkerDisk.setAttribute("r", "0");
                startMarkerDisk.setAttribute("style", "stroke-width:1px");

                startMarkerElem.appendChild(startMarkerLine);
                startMarkerElem.appendChild(startMarkerDisk);

                return startMarkerElem;
            }

            function newRunningMarkerElem()
            {
                var runningMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                runningMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line');

                runningMarkerLine.setAttribute("x1", "0");
                runningMarkerLine.setAttribute("y1", "0");
                runningMarkerLine.setAttribute("x2", "0");
                runningMarkerLine.setAttribute("y2", "0");
                runningMarkerLine.setAttribute("style", "stroke-width:1px");

                runningMarkerElem.appendChild(runningMarkerLine);

                return runningMarkerElem;
            }

            function newEndMarkerElem()
            {
                var endMarkerElem = document.createElementNS("http://www.w3.org/2000/svg", "g"),
                endMarkerLine = document.createElementNS("http://www.w3.org/2000/svg", 'line'),
                endMarkerRect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');

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

                endMarkerElem.appendChild(endMarkerLine);
                endMarkerElem.appendChild(endMarkerRect);

                return endMarkerElem;
            }

            startMarkerElem = newStartMarkerElem();
            runningMarkerElem = newRunningMarkerElem();
            endMarkerElem = newEndMarkerElem();

            markersLayer.appendChild(startMarkerElem);
            markersLayer.appendChild(runningMarkerElem);
            markersLayer.appendChild(endMarkerElem);

            system.startMarker = new StartMarker(system, systIndex, startMarkerElem, viewBoxScale);
            system.runningMarker = new RunningMarker(system, systIndex, runningMarkerElem, viewBoxScale);
            system.endMarker = new EndMarker(system, systIndex, endMarkerElem, viewBoxScale);

            runningMarkerHeight = system.runningMarker.yCoordinates.bottom - system.runningMarker.yCoordinates.top;

            system.timePointer = new TimePointer(system.runningMarker.yCoordinates.top, runningMarkerHeight, viewBoxScale, advanceRunningMarker);

            markersLayer.appendChild(system.timePointer.graphicElement);
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
                    if(staff.voices[j].isOutput === false && isLivePerformance === false)
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
            i, svgPage, embedsWidth, viewBox, pagesFrameWidth,
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
                svgPage = svgPageEmbeds[i].contentDocument;
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

        function setConductingLayer()
        {
            var
            svgPagesFrame = document.getElementById("svgPagesFrame"),
            conductingLayer = document.getElementById("conductingLayer"),
            pfLeft = parseInt(svgPagesFrame.style.left, 10),
            pfWidth = parseInt(svgPagesFrame.style.width, 10);

            conductingLayer.style.top = svgPagesFrame.style.top;
            conductingLayer.style.left = "0";
            conductingLayer.style.width = (pfLeft + pfWidth + pfLeft).toString(10) + "px";
            conductingLayer.style.height = svgPagesFrame.style.height;
        }

        /*************** end of getEmptySystems function definitions *****************************/

        resetContent(isLivePerformanceArg);

        conductor = new Conductor(startPlayingFunction);

        viewBox = setGraphics();

        svgPageEmbeds = document.getElementsByClassName("svgPage");

        nPages = svgPageEmbeds.length;
        for(i = 0; i < nPages; ++i)
        {
            svgPage = svgPageEmbeds[i].contentDocument;
            svgElem = getSVGElem(svgPage);
            pageSystemsElem = svgElem.getElementsByClassName("systems")[0];
            pageSystemElems = pageSystemsElem.getElementsByClassName("system");

            markersLayer = createMarkersLayer(svgElem);
            markersLayers.push(markersLayer);

            pageSystems = [];
            for(j = 0; j < pageSystemElems.length; ++j)
            {
                systemElem = pageSystemElems[j];
                systemElems.push(systemElem);

                system = getEmptySystem(viewBox.scale, systemElem);
                system.pageIndex = i;
                systems.push(system); // systems is global inside this namespace
                pageSystems.push(system);

                createMarkers(conductor, markersLayer, viewBox.scale, system, j);
            }
        }

        setConductingLayer(); // just sets its dimensions

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
        return startMarker.msPositionInScore;
    },

    endMarkerMsPosition = function ()
    {
        return endMarker.msPositionInScore;
    },

    // Called when the start button is clicked in the top options panel,
    // and when setOptions button is clicked at the top of the score.
    // If the startMarker is not fully visible in the svgPagesDiv, move
    // it to the top of the div.
    moveStartMarkerToTop = function (svgPagesDiv)
    {
        var height = Math.round(parseFloat(svgPagesDiv.style.height)),
        scrollTop = svgPagesDiv.scrollTop, startMarkerYCoordinates;

        startMarkerYCoordinates = startMarker.yCoordinates;

        if ((startMarkerYCoordinates.top < scrollTop) || (startMarkerYCoordinates.bottom > (scrollTop + height)))
        {
            if (startMarker.systemIndex === 0)
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
    // if msPosition is >= that object's msPosition.
    // If isConducting is true, and the runningMarker is moved to
    // the next system, the timePointer is also moved to the next system.
    // Does nothing when the end of the score is reached.
    advanceRunningMarker = function(msPosition, systemIndex)
    {
        if(systemIndex > runningMarker.systemIndex)
        {
            systemIndex = runningMarker.systemIndex + 1; // just to be sure!

            // Move runningMarker and timePointer to msPosition in the next system.
            runningMarker.setVisible(false);
            if(runningMarker.systemIndex < endMarker.systemIndex)
            {
                runningMarker = systems[systemIndex].runningMarker;
                runningMarker.moveTo(msPosition);
                runningMarker.setVisible(true);
                if(isConducting)
                {
                    conductor.setTimePointer(systems[systemIndex].timePointer);
                }
                // callback for auto scroll
                runningMarkerHeightChanged(runningMarker.yCoordinates);
            }
        }
        else
        {
            while(msPosition >= runningMarker.nextMsPosition)
            {
                // this function can assume that the runningMarker's currentPosition can simply be incremented
                runningMarker.incrementPosition();
            }
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
        sysIndex, nSystems = systems.length, system,
        inputChord;

        // Gets the timeObjects for both input and output voices. 
        function getVoiceObjects()
        {
            var i, lastSystemTimeObjects;

            function getStaffElems(systemElem)
            {
                var outputStaffElems = systemElem.getElementsByClassName("outputStaff"),
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
                    timeObjects = [], noteObjectAlignment,
                    timeObject, i, j, noteObjectElem, noteObjectChildren,
                    scoreMidiElem;

                noteObjectElems = voiceElem.children;
                for(i = 0; i < noteObjectElems.length; ++i)
                {
                    noteObjectElem = noteObjectElems[i];
                    noteObjectClass = noteObjectElem.getAttribute('class');
                                               
                    if(noteObjectClass === 'outputChord' || noteObjectClass === 'outputRest')
                    {
                        noteObjectChildren = noteObjectElem.children;
                        for(j = 0; j < noteObjectChildren.length; ++j)
                        {
                            if(noteObjectChildren[j].nodeName === "score:midi")
                            {
                                scoreMidiElem = noteObjectChildren[j];
                                if(noteObjectClass === 'outputChord')
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

                        noteObjectAlignment = noteObjectElem.getAttribute('score:alignment'); // null if this is not a chord or rest
                        timeObject.alignment = parseFloat(noteObjectAlignment, 10) / viewBoxScale1;

                        timeObjects.push(timeObject);
                    }
                    else if(noteObjectClass === 'inputChord' || noteObjectClass === 'inputRest')
                    {
                        if(noteObjectClass === 'inputChord')
                        {
                            timeObject = new InputChordDef(noteObjectElem, midiChannelPerOutputTrack);
                        }
                        else
                        {
                            timeObject = new InputRestDef(timeObject.msDurationInScore);
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
                    if(type === 'outputChord' || type === 'inputChord' || type === 'cautionaryChord'
                    || type === 'inputRest' || type === 'outputRest'
                    || type === 'clef' || type === 'barline' || type === 'staffName' || type === 'beamBlock' || type === 'clefChange'
                    || type === 'endBarlineLeft' || type === 'endBarlineRight')
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
                    voice.graphicElements = getGraphicElements(systemIndex, voiceElem); // will be used to set opacity when the voice is disabled
                    if(isFirstVoiceInStaff === true)
                    {
                        voice.staffLinesElem = staffElem.getElementsByClassName("staffLines");
                        isFirstVoiceInStaff = false;
                    }
                }
            }

            function getMidiChannelPerOutputTrack(systems)
            {
                var i, staves, systemIndex, timeObjectIndex, nTracks, channel,
                voice, timeObject, messages, flatOutputVoicesPerSystem;

                function getFlatOutputVoicesPerSystem(systems)
                {
                    var i, j, k, voices, flatOutputVoices, flatOutputVoicesPerSystem = [];

                    for(i = 0; i < systems.length; ++i)
                    {
                        staves = systems[i].staves;
                        flatOutputVoices = [];
                        for(j = 0; j < staves.length; ++j)
                        {
                            if(staves[j].isOutput === false)
                            {
                                break;
                            }
                            voices = staves[j].voices;
                            for(k = 0; k < voices.length; ++k)
                            {
                                flatOutputVoices.push(voices[k]);
                            }
                        }
                        flatOutputVoicesPerSystem.push(flatOutputVoices);
                    }
                    return flatOutputVoicesPerSystem;
                }
                    
                midiChannelPerOutputTrack.length = 0; // global array
                flatOutputVoicesPerSystem = getFlatOutputVoicesPerSystem(systems);

                systemIndex = 0;
                timeObjectIndex = 0;
                nTracks = flatOutputVoicesPerSystem[0].length; 
                for(i = 0; i < nTracks; ++i)
                {
                    channel = -1;
                    while(channel < 0 && systemIndex < systems.length)
                    {
                        voice = flatOutputVoicesPerSystem[systemIndex][i];
                        timeObject = voice.timeObjects[timeObjectIndex];
                        messages = timeObject.moments[0].messages;
                        if(messages.length > 0)
                        {
                            channel = messages[0].channel();
                        }
                        else
                        {
                            timeObjectIndex++;
                            if(timeObjectIndex === voice.timeObjects.length)
                            {
                                timeObjectIndex = 0;
                                systemIndex++;
                            }
                        }
                    }
                    midiChannelPerOutputTrack.push(channel);
                }
            }

            function getSystemOutputVoiceObjects(systemElems, systems, systemIndex, viewBoxScale1)
            {
                var systemElem, system, staffElems, staffElem,
                    staff,
                    staffIndex;

                systemElem = systemElems[systemIndex];
                system = systems[systemIndex];
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
                    setVoices(systemIndex, staff, staffElem, "outputVoice", viewBoxScale1);
                    staffIndex++;
                }
            }

            function getSystemInputVoiceObjects(systemElems, systems, systemIndex, viewBoxScale1)
            {
                var systemElem, system, staffElems, staffElem,
                    staff,
                    staffIndex,
                    nOutputTracks = midiChannelPerOutputTrack.length;

                systemElem = systemElems[systemIndex];
                system = systems[systemIndex];
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
                            if(voice.timeObjects[0].alignment === undefined)
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
                            firstMsPos = staff.voices[j].timeObjects[0].msPositionInScore;
                            minMsPos = (minMsPos < firstMsPos) ? minMsPos : firstMsPos;
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

            /*************** end of getVoiceObjects function definitions *****************************/

            for(i = 0; i < systemElems.length; ++i)
            {
                getSystemOutputVoiceObjects(systemElems, systems, i, viewBoxScale);
            }

            getMidiChannelPerOutputTrack(systems);

            for(i = 0; i < systemElems.length; ++i)
            {
                getSystemInputVoiceObjects(systemElems, systems, i, viewBoxScale);
            }

            setMsPositions(systems);
            setFirstTimeObjectAlignment(systems);
            appendVoiceEndTimeObjects(systems);

            lastSystemTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;
            finalBarlineInScore = lastSystemTimeObjects[lastSystemTimeObjects.length - 1]; // 'global' object
        }

        function setMarkers(systems, isLivePerformance)
        {
            var i, j, nSystems = systems.length, system;
            for(i = 0; i < nSystems; ++i)
            {
                system = systems[i];
                system.startMarker.setVisible(false);
                system.runningMarker.setVisible(false);
                system.endMarker.setVisible(false);
                system.timePointer.setVisible(false);

                system.runningMarker.setTimeObjects(system, isLivePerformance, trackIsOnArray);
                for(j = 0; j < system.staves.length; ++j)
                {
                    if(!isNaN(system.staves[j].voices[0].timeObjects[0].alignment))
                    {
                        system.startMarker.moveTo(system.staves[j].voices[0].timeObjects[0]);
                        break;
                    }
                }

                system.runningMarker.moveTo(system.startMarker.msPositionInScore); // system.startMarker is system.runningMarker.startMarker 
            }

            startMarker = systems[0].startMarker;
            startMarker.setVisible(true);

            runningMarker = systems[0].runningMarker;
            // runningMarker (and maybe timePointer) will be set visible later.

            endMarker = systems[systems.length - 1].endMarker;
            endMarker.moveTo(finalBarlineInScore);
            endMarker.setVisible(true);
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
                        outputTracks[outputTrackIndex].isVisible = staff.isVisible;
                        outputTrackIndex++;
                    }
                    else // voice.isOutput === false 
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

        getVoiceObjects();

        setMarkers(systems, isLivePerformance);

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
                    if(voice.isOutput === true)
                    {
                        outputTrack = outputTracks[outputTrackIndex];
                        for(timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
                        {
                            timeObject = voice.timeObjects[timeObjectIndex];
                            if(timeObject instanceof MidiChord || timeObject instanceof MidiRest)
                            {
                                outputTrack.midiObjects.push(timeObject);
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
                            if(timeObject instanceof InputChordDef)
                            {
                                inputChord = new InputChord(timeObject, outputTracks); // the outputTracks should already be complete here
                                inputTrack.inputObjects.push(inputChord);
                            }
                            // inputRestDefs have been used to calculate inputChordDef.msPositionInScore, but are no longer needed.
                        }
                        ++inputTrackIndex;
                    }
                }
            }
        }

        tracksData.inputTracks = inputTracks;
        tracksData.outputTracks = outputTracks;

        //    if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
        //        inputKeyRange.bottomKey
        //        inputKeyRange.topKey
        if(inputTracks.length > 0)
        {
            tracksData.inputKeyRange = getInputKeyRange(inputTracks);            
        }
    },

    getTracksData = function()
    {
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
        this.moveRunningMarkersToStartMarkers = moveRunningMarkersToStartMarkers;

        this.setConducting = setConducting;
        this.getConductor = getConductor;
        this.conduct = conduct;

        // markersLayers contains one markersLayer per page of the score.
        // Each markersLayer contains the assistant performer's markers
        // and the page-sized transparent, clickable surface used when
        // setting them.
        this.markersLayers = markersLayers;

        this.getEmptySystems = getEmptySystems;

        // tracksData is an object having the following defined attributes:
        //        inputTracks[] - an array of tracks containing inputChords
        //        outputTracks[] - an array of tracks containing outputChords and outputRests
        //        if inputTracks contains one or more tracks, the following attributes are also defined (on tracksData):
        //            inputKeyRange.bottomKey
        //            inputKeyRange.topKey
        this.setTracksData = setTracksData;
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

