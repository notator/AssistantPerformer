/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  jiScore.js
 *  The JI_NAMESPACE.score namespace which defines the
 *    Score() constructor.
 *  
 */

JI_NAMESPACE.namespace('JI_NAMESPACE.score');

JI_NAMESPACE.score = (function (document)
{
    "use strict";
    // begin var
    var jiFile = JI_NAMESPACE.file,
        jiMarkers = JI_NAMESPACE.markers,
        jiPalettes = JI_NAMESPACE.palettes,
        jiSequence = JI_NAMESPACE.sequence,
        jiTrack = JI_NAMESPACE.track,
        jiMIDIChord = JI_NAMESPACE.midiChord,

    MAX_MIDI_CHANNELS = 16,

    // private variable, used when resetting main performance options
    _previousSpeed = -1,

    // The frames around each svgPage
    svgFrames = [],

    palettes = [],

    // See comments in the publicAPI definition at the bottom of this file.
    systems = [], // an array of all the systems

    startMarker,
    runningMarker,
    endMarker,
    runningMarkerHeightChanged, // callback, called when runningMarker changes systems

    finalBarlineInScore,

    // Sends a noteOff to all notes on all channels on the midi output device.
    allNotesOff = function (midiOutputDevice)
    {
        var noteOffMessage, channelIndex, noteIndex;

        if (midiOutputDevice !== undefined && midiOutputDevice !== null)
        {
            for (channelIndex = 0; channelIndex < MAX_MIDI_CHANNELS; ++channelIndex)
            {
                for (noteIndex = 0; noteIndex < 128; ++noteIndex)
                {
                    noteOffMessage = jiMIDIChord.newNoteOffMessage(channelIndex, noteIndex);
                    midiOutputDevice.sendMIDIMessage(noteOffMessage);
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

    // this function is called only when state is 'settingStart' or 'settingEnd'.
    svgPageClicked = function (e, state)
    {
        var frame = e.target,
            x = e.pageX,
            y = e.pageY + frame.originY,
            systemIndex, system,
            staffIndex, voiceIndex, timeObject;

        // x and y now use the <body> element as their frame of reference.
        // this is the same frame of reference as in the systems.
        // systems is a single global array (inside this namespace)of all systems.
        // This is important when identifying systems, and when performing.

        // Returns the system having stafflines closest to y, and for which
        //    (firstBarlineX <= x && lastBarlineX >= x)
        // otherwise undefined.
        function findSystemIndex(x, y)
        {
            var i, topLimit, bottomLimit, systemIndex, lastSystem;

            if (systems.length === 1)
            {
                if (systems[0].firstBarlineX <= x && x <= systems[0].right)
                {
                    systemIndex = 0;
                }
            }
            else
            {
                topLimit = -1;
                for (i = 0; i < systems.length - 1; ++i)
                {
                    if (systems[i].firstBarlineX <= x && x <= systems[i].right)
                    {
                        bottomLimit = (systems[i].bottomLineY + systems[i + 1].topLineY) / 2;
                        if (y >= topLimit && y < bottomLimit)
                        {
                            systemIndex = i;
                            break;
                        }
                        topLimit = bottomLimit;
                    }
                }

                if (systemIndex === undefined)
                {
                    lastSystem = systems[systems.length - 1];
                    if (lastSystem.firstBarlineX <= x && x <= lastSystem.right)
                    {
                        systemIndex = systems.length - 1;
                    }

                }
            }
            return systemIndex;
        }

        // Returns the index of the staff having stafflines closest to y
        function findStaffIndex(y, staves)
        {
            var staffIndex, i, nStaves, topLimit, bottomLimit;

            if (y <= staves[0].bottomLineY)
            {
                staffIndex = 0;
            }
            else if (y >= staves[staves.length - 1].topLineY)
            {
                staffIndex = staves.length - 1;
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
                        staffIndex = ((y - topLimit) < (bottomLimit - y)) ? i - 1 : i;
                        break;
                    }
                    else // in staff
                    {
                        if (y >= staves[i].topLineY && y <= staves[i].bottomLineY)
                        {
                            staffIndex = i;
                            break;
                        }
                    }
                }
            }
            return staffIndex;
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

        // Returns the index of the first chord or rest or final barline whose alignmentX is >= x
        // if x is greater than all alignmentXs, returns undefined
        function findTimeObject(x, timeObjects)
        {
            var i, timeObject, nTimeObjects = timeObjects.length;
            for (i = 0; i < nTimeObjects; ++i)
            {
                if (timeObjects[i].alignmentX >= x)
                {
                    timeObject = timeObjects[i];
                    break;
                }
            }

            return timeObject;
        }

        systemIndex = findSystemIndex(x, y);
        if (systemIndex !== undefined)
        {
            system = systems[systemIndex];
            staffIndex = findStaffIndex(y, system.staves);
            voiceIndex = findVoiceIndex(y, system.staves[staffIndex].voices);
            timeObject = findTimeObject(x, system.staves[staffIndex].voices[voiceIndex].timeObjects);

            switch (state)
            {
                case 'settingStart':
                    if (timeObject.msPosition < endMarker.msPosition())
                    {
                        startMarker = system.startMarker;
                        hideStartMarkersExcept(startMarker);
                        startMarker.moveTo(timeObject);
                    }
                    break;
                case 'settingEnd':
                    if (startMarker.msPosition() < timeObject.msPosition)
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
    setRunningMarkers = function (tracksControl)
    {
        var sysIndex, nSystems = systems.length, system;

        for (sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            system.runningMarker.setTimeObjects(system, tracksControl);
        }
        moveRunningMarkerToStartMarker();
        showRunningMarker();
    },

    // Constructs all pages, complete except for the timeObjects.
    // Palettes are also loaded.
    // Each page has a frame and the correct number of empty systems.
    // Each system has the correct number of empty staves and barlines, it also has
    // a startMarker, a runningMarker and an endMarker.
    // Each staff has empty voices, each voice has an empty timeObjects array.
    // If these objects have graphic parameters, they are set.
    getEmptyPagesAndSystems = function ()
    {
        var system, embeddedSvgPages, nPages, totalSysNumber, viewBoxOriginY,
            i, j,
            sysNumber, svgPage, svgElem, viewBoxScale, svgChildren, systemID,
            childID, currentFrame, pageHeight;

        function resetContent()
        {
            while (svgFrames.length > 0)
            {
                svgFrames.pop();
            }
            while (systems.length > 0)
            {
                systems.pop();
            }
            while (palettes.length > 0)
            {
                palettes.pop();
            }
        }

        function getPalettes()
        {
            var i, pals;

            pals = new jiPalettes.Palettes();
            for (i = 0; i < pals.length; ++i)
            {
                palettes.push(pals[i]);
            }
        }

        function getEmptySystem(viewBoxOriginY, viewBoxScale, systemNode)
        {
            var i, j, systemChildren, systemChildID,
                staff, staffChildren, staffChildID, stafflineInfo,
                markersChildren, barlinesChildren, voice;
            // returns an info object containing left, right and stafflineYs
            function getStafflineInfo(stafflines)
            {
                var i, stafflineInfo = {}, stafflineYs = [], left, right, stafflineY;
                for (i = 0; i < stafflines.length; ++i)
                {
                    if (stafflines[i].nodeName !== '#text')
                    {
                        stafflineY = parseFloat(stafflines[i].getAttribute('y1'));
                        stafflineYs.push((stafflineY / viewBoxScale) + viewBoxOriginY);
                        left = parseFloat(stafflines[i].getAttribute('x1'));
                        left /= viewBoxScale;
                        right = parseFloat(stafflines[i].getAttribute('x2'));
                        right /= viewBoxScale;
                    }
                }
                stafflineInfo.left = left;
                stafflineInfo.right = right;
                stafflineInfo.stafflineYs = stafflineYs;
                return stafflineInfo;
            }

            function getGap(gap, stafflineYs)
            {
                var newGap = gap;
                if (newGap === undefined && stafflineYs.length > 1)
                {
                    newGap = stafflineYs[1] - stafflineYs[0];
                    if (newGap < 0)
                    {
                        newGap *= -1;
                    }
                }
                return newGap;
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

            system = {};
            system.staves = [];
            systemChildren = systemNode.childNodes;
            for (i = 0; i < systemChildren.length; ++i)
            {
                if (systemChildren[i].nodeName !== '#text')
                {
                    systemChildID = systemChildren[i].getAttribute("id");
                    if (systemChildID.indexOf('markers') !== -1)
                    {
                        markersChildren = systemChildren[i].childNodes;
                        for (j = 0; j < markersChildren.length; ++j)
                        {
                            if (markersChildren[j].nodeName !== '#text')
                            {
                                switch (markersChildren[j].getAttribute('id'))
                                {
                                    case 'startMarker':
                                        system.startMarker = new jiMarkers.StartMarker(markersChildren[j], viewBoxOriginY, viewBoxScale);
                                        break;
                                    case 'runningMarker':
                                        system.runningMarker = new jiMarkers.RunningMarker(markersChildren[j], viewBoxOriginY, viewBoxScale);
                                        break;
                                    case 'endMarker':
                                        system.endMarker = new jiMarkers.EndMarker(markersChildren[j], viewBoxOriginY, viewBoxScale);
                                        break;
                                }
                            }
                        }
                    }
                    else if (systemChildID.indexOf('staff') !== -1)
                    {
                        staff = {};
                        staff.voices = [];
                        system.staves.push(staff);

                        staffChildren = systemChildren[i].childNodes;
                        for (j = 0; j < staffChildren.length; ++j)
                        {
                            if (staffChildren[j].nodeName !== '#text')
                            {
                                staffChildID = staffChildren[j].getAttribute('id');
                                if (staffChildID.indexOf('stafflines') !== -1)
                                {
                                    stafflineInfo = getStafflineInfo(staffChildren[j].childNodes);
                                    system.left = stafflineInfo.left;
                                    system.right = stafflineInfo.right;
                                    system.gap = getGap(system.gap, stafflineInfo.stafflineYs);

                                    staff.topLineY = stafflineInfo.stafflineYs[0];
                                    staff.bottomLineY = stafflineInfo.stafflineYs[stafflineInfo.stafflineYs.length - 1];
                                }
                                if (staffChildID.indexOf('voice') !== -1)
                                {
                                    voice = {};
                                    staff.voices.push(voice);
                                }
                            }
                        }
                        setVoiceCentreYs(staff.topLineY, staff.bottomLineY, staff.voices);
                    }
                    else if (systemChildID.indexOf('barlines') !== -1)
                    {
                        barlinesChildren = systemChildren[i].childNodes;
                        for (j = 0; j < barlinesChildren.length; ++j)
                        {
                            if (barlinesChildren[j].nodeName !== '#text')
                            {
                                system.firstBarlineX = parseFloat(barlinesChildren[j].getAttribute("x1"));
                                system.firstBarlineX /= viewBoxScale;
                                break;
                            }
                        }
                    }
                }
            }

            system.topLineY = system.staves[0].topLineY;
            system.bottomLineY = system.staves[system.staves.length - 1].bottomLineY;
            if (system.gap === undefined)
            {
                system.gap = 4; // default value, when all staves have one line.
            }

            return system;
        }

        function getViewBoxScale(svgElem)
        {
            var width, viewBox, viewBoxStrings, viewBoxWidth, scale;

            width = parseFloat(svgElem.getAttribute('width'));
            viewBox = svgElem.getAttribute('viewBox');
            viewBoxStrings = viewBox.split(' ');
            viewBoxWidth = parseFloat(viewBoxStrings[2]);

            scale = viewBoxWidth / width;
            return scale;
        }

        /*************** end of getEmptyPagesAndSystems function definitions *****************************/

        resetContent();

        getPalettes();

        embeddedSvgPages = document.querySelectorAll(".svgPage");
        nPages = embeddedSvgPages.length;
        totalSysNumber = 1;
        viewBoxOriginY = 0; // absolute coordinates
        for (i = 0; i < nPages; ++i)
        {
            sysNumber = 1;
            svgPage = jiFile.getSubDocument(embeddedSvgPages[i]);

            svgElem = svgPage.childNodes[1];
            viewBoxScale = getViewBoxScale(svgElem); // a float >= 1 (currently, usually 8.0)
            svgChildren = svgElem.childNodes;
            systemID = "page" + (i + 1).toString() + "_system" + (sysNumber++).toString();
            for (j = 0; j < svgChildren.length; ++j)
            {
                if (svgChildren[j].nodeName !== '#text')
                {
                    childID = svgChildren[j].getAttribute("id");
                    if (childID === "frame")
                    {
                        currentFrame = svgChildren[j];
                        currentFrame.originY = viewBoxOriginY;
                        svgFrames.push(currentFrame);
                    }
                    if (childID === systemID)
                    {
                        system = getEmptySystem(viewBoxOriginY, viewBoxScale, svgChildren[j]);
                        systems.push(system); // systems is global inside this namespace

                        systemID = "page" + (i + 1).toString() + "_system" + (sysNumber++).toString();
                    }
                }
            }
            pageHeight = parseInt(svgElem.getAttribute('height'));
            viewBoxOriginY += pageHeight;
        }
    },

    // Gets the timeObjects. 
    // speed is a floating point number, greater than zero.
    // msDurations stored in the score are divided by speed.
    // Rounding errors are corrected, so that all voices in
    // a system continue to have the same msDuration.
    getTimeObjects = function (speed)
    {
        var embeddedSvgPages, nPages, totalSysNumber, viewBoxOriginY,
            i, j,
            systemIndex, sysNumber, svgPage, svgElem, viewBoxScale, svgChildren, systemID,
            childID, pageHeight,
            lastSystemTimeObjects, finalBarlineMsPosition;

        function getSystemTimeObjects(system, viewBoxScale, systemNode, speed)
        {
            var i, j, systemChildren, systemChildID,
                staff, staffChildren, staffChildID,
                voice,
                staffIndex = 0,
                voiceIndex = 0;

            // A timeObject is either a chord or a rest.
            // Both chords and rests have alignmentX and msDuration fields.
            // Chords additionally have paletteIndex and chordIndex fields for retrieving
            // a chord definition.
            // Chords might, at some time, contain the chord definitions themselves (when
            // they have no 'use' element).
            // Later in this program (as soon as all systems have been read), the msPosition
            // of all timeObjects will appended to them.
            function getTimeObjects(system, noteObjects, speed)
            {
                var timeObjects = [], id,
                    timeObject, i, j, k, length, noteObject, chordChildren, midiChildren,
                    chordAddressString, subStrings, voiceMsDuration;

                // timeObjects is an array of timeObject.
                // speed is a floating point number, greater than zero.
                // returns the new length of the voice in integer milliseconds
                function changeSpeed(timeObjects, speed)
                {
                    var i, nTimeObjects = timeObjects.length, msFPDuration,
                    msFPPositions = [], msPositions = [], nMsPositions;

                    msFPPositions.push(0);
                    for (i = 0; i < nTimeObjects; ++i)
                    {
                        msFPDuration = timeObjects[i].msDuration / speed;
                        msFPPositions.push(msFPDuration + msFPPositions[i]);
                    }
                    nMsPositions = nTimeObjects + 1;
                    for (i = 0; i < nMsPositions; ++i)
                    {
                        msPositions.push(Math.round(msFPPositions[i]));
                    }
                    for (i = 0; i < nTimeObjects; ++i)
                    {
                        timeObjects[i].msDuration = msPositions[i + 1] - msPositions[i];
                    }

                    return msPositions[nMsPositions - 1];
                }

                length = noteObjects.length;
                for (i = 0; i < length; ++i)
                {
                    noteObject = noteObjects[i];
                    if (noteObject.nodeName === 'g')
                    {
                        id = noteObject.getAttribute('id');
                        if (id.indexOf('chord') >= 0)
                        {
                            //console.log("*** chord found, i= " + i);
                            timeObject = {};
                            timeObject.alignmentX = parseFloat(noteObject.getAttribute('score:alignmentX')) / viewBoxScale;
                            timeObject.msDuration = parseFloat(noteObject.getAttribute('score:msDuration'));
                            chordChildren = noteObject.childNodes;
                            for (j = 0; j < chordChildren.length; ++j)
                            {
                                if (chordChildren[j].nodeName !== '#text')
                                {
                                    id = chordChildren[j].getAttribute('id');
                                    if (id.indexOf('midi') >= 0)
                                    {
                                        midiChildren = chordChildren[j].childNodes;
                                        for (k = 0; k < midiChildren.length; ++k)
                                        {
                                            if (midiChildren[k].nodeName === 'use')
                                            {
                                                chordAddressString = midiChildren[k].getAttribute('xlink:href');
                                                // chordAddressString is of the form '#palette3_chord9'
                                                subStrings = chordAddressString.split('_');
                                                subStrings[0] = subStrings[0].substr(8);
                                                timeObject.paletteIndex = parseInt(subStrings[0]) - 1;

                                                subStrings[1] = subStrings[1].substr(5);
                                                timeObject.chordIndex = parseInt(subStrings[1]) - 1;
                                                break;
                                            }
                                            else if (midiChildren[k].nodeName === 'score:basicChords')
                                            {
                                                timeObject.chordDef = new jiPalettes.ChordDef(chordChildren[j]);
                                                break;
                                            }
                                        }
                                        break;
                                    }
                                }

                            }
                            timeObjects.push(timeObject);
                        }
                        else if (id.indexOf('rest') >= 0)
                        {
                            timeObject = {};
                            timeObject.alignmentX = parseFloat(noteObject.getAttribute('score:alignmentX') / viewBoxScale);
                            timeObject.msDuration = parseFloat(noteObject.getAttribute('score:msDuration'));
                            timeObjects.push(timeObject);
                        }
                    }
                }

                if (speed !== 1)
                {
                    voiceMsDuration = changeSpeed(timeObjects, speed);
                    if (system.msDuration === undefined)
                    {
                        system.msDuration = voiceMsDuration;
                    }
                    else if (system.msDuration !== voiceMsDuration)
                    {
                        throw "Error in changing speed calculation.";
                    }
                }

                return timeObjects;
            }

            systemChildren = systemNode.childNodes;
            for (i = 0; i < systemChildren.length; ++i)
            {
                if (systemChildren[i].nodeName !== '#text')
                {
                    systemChildID = systemChildren[i].getAttribute("id");
                    if (systemChildID.indexOf('staff') !== -1)
                    {
                        staff = system.staves[staffIndex++];
                        staffChildren = systemChildren[i].childNodes;
                        for (j = 0; j < staffChildren.length; ++j)
                        {
                            if (staffChildren[j].nodeName !== '#text')
                            {
                                staffChildID = staffChildren[j].getAttribute('id');
                                if (staffChildID.indexOf('voice') !== -1)
                                {
                                    voice = staff.voices[voiceIndex++];
                                    voice.timeObjects = getTimeObjects(system, staffChildren[j].childNodes, speed);
                                }
                            }
                        }
                        voiceIndex = 0;
                    }
                }
            }
        }

        function getViewBoxScale(svgElem)
        {
            var width, viewBox, viewBoxStrings, viewBoxWidth, scale;

            width = parseFloat(svgElem.getAttribute('width'));
            viewBox = svgElem.getAttribute('viewBox');
            viewBoxStrings = viewBox.split(' ');
            viewBoxWidth = parseFloat(viewBoxStrings[2]);

            scale = viewBoxWidth / width;
            return scale;
        }

        // Sets the msPosition of each timeObject (rests and chords) in the voice.timeObjectArrays
        // Returns the msPosition of the final barline in the score.
        function setMsPositions(systems)
        {
            var nStaves, staffIndex, nVoices, voiceIndex, nSystems, systemIndex, msPosition,
                timeObjects, nTimeObjects, tIndex, finalMsPosition;

            nSystems = systems.length;
            nStaves = systems[0].staves.length;
            msPosition = 0;
            for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
            {
                nVoices = systems[0].staves[staffIndex].voices.length;
                for (voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                {
                    for (systemIndex = 0; systemIndex < nSystems; ++systemIndex)
                    {
                        timeObjects = systems[systemIndex].staves[staffIndex].voices[voiceIndex].timeObjects;
                        nTimeObjects = timeObjects.length;
                        for (tIndex = 0; tIndex < nTimeObjects; ++tIndex)
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

                for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                {
                    nVoices = system.staves[staffIndex].voices.length;
                    for (voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                    {
                        voice = system.staves[staffIndex].voices[voiceIndex];
                        voiceMsPosition = voice.timeObjects[0].msPosition;
                        minMsPosition = (minMsPosition < voiceMsPosition) ? minMsPosition : voiceMsPosition;
                    }
                }
                return minMsPosition;
            }

            systems[0].startMsPosition = 0;
            if (nSystems > 1) // set all but last system
            {
                for (systemIndex = 0; systemIndex < nSystemsMinusOne; ++systemIndex)
                {
                    system = systems[systemIndex];
                    system.endMsPosition = smallestMsPosition(systems[systemIndex + 1]);
                    systems[systemIndex + 1].startMsPosition = system.endMsPosition;
                    for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                    {
                        nVoices = system.staves[staffIndex].voices.length;
                        for (voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
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
            for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
            {
                nVoices = system.staves[staffIndex].voices.length;
                for (voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
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

        function setSystemMarkerParameters(systems)
        {
            var i, nSystems = systems.length, system;
            for (i = 0; i < nSystems; ++i)
            {
                system = systems[i];
                system.startMarker.setParameters(system, i);
                system.runningMarker.setParameters(system, i);
                system.endMarker.setParameters(system);
            }

            startMarker = systems[0].startMarker;
            startMarker.setVisible(true);

            moveRunningMarkerToStartMarker(); // is only visible when playing...

            endMarker = systems[systems.length - 1].endMarker;
            endMarker.moveTo(finalBarlineInScore);
            endMarker.setVisible(true);
        }

        /*************** end of getTimeObjects function definitions *****************************/

        embeddedSvgPages = document.querySelectorAll(".svgPage");
        nPages = embeddedSvgPages.length;
        totalSysNumber = 1;
        viewBoxOriginY = 0; // absolute coordinates
        systemIndex = 0;
        for (i = 0; i < nPages; ++i)
        {
            sysNumber = 1;
            svgPage = jiFile.getSubDocument(embeddedSvgPages[i]);

            svgElem = svgPage.childNodes[1];
            viewBoxScale = getViewBoxScale(svgElem); // a float >= 1 (currently, usually 8.0)
            svgChildren = svgElem.childNodes;
            systemID = "page" + (i + 1).toString() + "_system" + (sysNumber++).toString();
            for (j = 0; j < svgChildren.length; ++j)
            {
                if (svgChildren[j].nodeName !== '#text')
                {
                    childID = svgChildren[j].getAttribute("id");
                    if (childID === systemID)
                    {
                        getSystemTimeObjects(systems[systemIndex], viewBoxScale, svgChildren[j], speed);
                        systemIndex++;
                        systemID = "page" + (i + 1).toString() + "_system" + (sysNumber++).toString();
                    }
                }
            }
            pageHeight = parseInt(svgElem.getAttribute('height'));

        }

        finalBarlineMsPosition = setMsPositions(systems);
        setSystemMsPositionsAndAddFinalBarlineToEachVoice(systems, finalBarlineMsPosition);

        lastSystemTimeObjects = systems[systems.length - 1].staves[0].voices[0].timeObjects;
        finalBarlineInScore = lastSystemTimeObjects[lastSystemTimeObjects.length - 1]; // 'global' object

        if (speed !== _previousSpeed)
        {
            _previousSpeed = speed;
            setSystemMarkerParameters(systems);
        }
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

    // Advances the running marker to the following timeObject (in any channel)
    // if msPosition is >= that object's msPosition. Otherwise does nothing.
    // Also does nothing when the end of the score is reached.
    advanceRunningMarker = function (msPosition)
    {
        if (msPosition >= systems[runningMarker.systemIndex()].endMsPosition)
        {
            //console.log("score:advanceRunningMarker: moving runningMarker to the beginning of the next system., msPosition=" + msPosition);
            // Move runningMarker to the beginning of the next system.
            runningMarker.setVisible(false);
            if (runningMarker.systemIndex() < (systems.length - 1))
            {
                runningMarker = systems[runningMarker.systemIndex() + 1].runningMarker;
                runningMarker.moveToStartOfSystem();
                runningMarker.setVisible(true);
            }
            // callback for auto scroll
            runningMarkerHeightChanged(runningMarker.getYCoordinates());
        }
        else while (msPosition >= runningMarker.nextMsPosition())
        {
            //console.log("score:advanceRunningMarker: calling runningMarker.incrementPosition(), msPosition=" + msPosition);
            // this function can assume that the runningMarker's currentPosition can simply be incremented
            runningMarker.incrementPosition();
        }
    },

    // In a completed Sequence, the tracks array contains one track per channel (ordered by channel).
    // Each track is an array of midiMoments ordered in time (see jiTrack.js && jiMIDIMoment.js).
    // Note that Sequences do not contain rests!
    getSequence = function (speed)
    {
        // systems->staves->voices->timeObjects
        var sequence = new jiSequence.Sequence(0),
            trackIndex, track,
            tracks = [], // a local array -- tracks can't be indexed in a sequence
            timeObjectIndex, nTimeObjects, timeObject,
            voiceIndex, nVoices, voice,
            staffIndex, nStaves, staff,
            sysIndex, nSystems = systems.length, system,
            channel, chordDef, midiChord, midiRest;

        function addEmptyTracks(sequence)
        {
            var trackIndex, nTracks;

            // returns the number of voices
            function numberOfTracks(system0)
            {
                var nVoices = 0,
                staffIndex, nStaves = system0.staves.length;

                for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
                {
                    nVoices += system0.staves[staffIndex].voices.length;
                }
                return nVoices;
            }

            nTracks = numberOfTracks(systems[0]);
            for (trackIndex = 0; trackIndex < nTracks; ++trackIndex)
            {
                track = new jiTrack.Track();
                sequence.addTrack(track);
                tracks.push(track);
            }
        }

        addEmptyTracks(sequence);

        nStaves = systems[0].staves.length;

        for (sysIndex = 0; sysIndex < nSystems; ++sysIndex)
        {
            system = systems[sysIndex];
            trackIndex = 0;
            for (staffIndex = 0; staffIndex < nStaves; ++staffIndex)
            {
                staff = system.staves[staffIndex];
                nVoices = staff.voices.length;
                for (voiceIndex = 0; voiceIndex < nVoices; ++voiceIndex)
                {
                    voice = staff.voices[voiceIndex];
                    nTimeObjects = voice.timeObjects.length;
                    track = tracks[trackIndex];
                    channel = trackIndex;
                    for (timeObjectIndex = 0; timeObjectIndex < nTimeObjects; ++timeObjectIndex)
                    {
                        timeObject = voice.timeObjects[timeObjectIndex];

                        if (timeObject.paletteIndex === undefined && timeObject.chordDef === undefined)
                        {
                            if (timeObjectIndex < (nTimeObjects - 1) || sysIndex === (nSystems - 1))
                            {
                                // A rest. A barline on the right end of a staff is ignored, except on the final system.
                                // The final barline on the final staff is a 'rest'.
                                midiRest = new jiMIDIChord.MIDIRest(timeObject);
                                midiRest.addToTrack(track);
                                //console.log("midiRest added at sysIndex=", +sysIndex + ", staffIndex=", +staffIndex + ", timeObjectIndex=" + timeObjectIndex);
                            }
                        }
                        else
                        {
                            // A chord
                            if (timeObject.paletteIndex !== undefined)
                            {
                                chordDef = palettes[timeObject.paletteIndex][timeObject.chordIndex];
                            }
                            else
                            {
                                chordDef = timeObject.chordDef;
                            }
                            midiChord = new jiMIDIChord.MIDIChord(channel, chordDef, timeObject, speed);
                            midiChord.addToTrack(track);
                            //console.log("midiChord added at sysIndex=", +sysIndex + ", staffIndex=", +staffIndex + ", timeObjectIndex=" + timeObjectIndex);
                        }
                    }
                    ++trackIndex;
                }
            }
        }

        return sequence;
    },

    // an empty score
    Score = function (callback)
    {
        if (!(this instanceof Score))
        {
            return new Score(callback);
        }

        svgFrames = [];
        palettes = [];
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

        // Called when the start button is clicked in the top options panel,
        // and when setOptions button is clicked at the top of the score.
        // If the startMarker is not fully visible in the svgPagesDiv, move
        // it to the top of the div.
        this.moveStartMarkerToTop = moveStartMarkerToTop;

        // Recalculates the timeObject lists for the runningMarkers (1 marker per system),
        // using the tracksControl to take into account which tracks are actually performing.
        // When the score is first read, all tracks perform by default.
        this.setRunningMarkers = setRunningMarkers;
        // Advances the running marker to the following timeObject (in any channel)
        // if the msPosition argument is >= that object's msPosition. Otherwise does nothing.
        this.advanceRunningMarker = advanceRunningMarker;
        this.hideRunningMarkers = hideRunningMarkers;
        this.moveRunningMarkerToStartMarker = moveRunningMarkerToStartMarker;

        // The frames in the GUI
        this.svgFrames = svgFrames;

        this.getEmptyPagesAndSystems = getEmptyPagesAndSystems;

        // loads timeObjects
        this.getTimeObjects = getTimeObjects;

        // Returns the score's content as a midi sequence
        this.getSequence = getSequence;
    },


    publicAPI =
    {
        // empty score constructor (access to GUI functions)
        Score: Score

        /***
        // The svgFrames object is an array containing each page's frame object.
        // There is one frame per page.
        svgFrames: svgFrames,

        // The palettes defined in the "midiDefs" element in the first SVG page embedded in the HTML.
        // Palettes is an array of palette. Each palette is an array of ChordDef and RestDef.
        palettes: palettes,

        // The systems object is an array, containing the following array hierarchy:
        //      systems->staves->voices->timeObjects
        // Each timeObject (=chord or rest) contains the following info:
        //          alignmentX  (chords and rests)
        //          msPosition  (chords and rests)
        //          msDuration  (chords and rests)
        // and, for chords only:
        //          either:
        //              palletIndex and
        //              chordIndex
        //          or:
        //              chordDef
        systems: systems,
        ***/


    };
    // end var

    return publicAPI;

} (document));
