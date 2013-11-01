/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/TracksControl.js
*  The _AP.tracksControl namespace deining the tracks control.
*  The tracks control enables tracks to be turned on and off for performances.
*  
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

_AP.namespace('_AP.tracksControl');

_AP.tracksControl = (function (document)
{
    "use strict";

    var
    BACKGROUND_GREEN = "#F5FFF5",
    // button colours in this tracksControl 
    SOLOISTS_STROKECOLOR = "#0000FF",
    SOLOISTS_FILLCOLOR_WHEN_SOUNDING = "#CCCCFF",
    SOLOISTS_FILLCOLOR_WHEN_SILENT = BACKGROUND_GREEN,
    NORMAL_STROKECOLOR = "#000000",
    NORMAL_FILLCOLOR = "#AAAAAA",
    DISABLED_STROKECOLOR = "#000000",
    DISABLED_FILLCOLOR = BACKGROUND_GREEN,

    disableLayerIDs = [],  // disableLayerIDs[0] is the disable layer id for the whole tracks control
    trackIsOnStatus = [],
    trackIsDisabledStatus = [],
    disabled = true,
    trackToggled = null,
    livePerformersTrackIndex = -1,
    livePerformerIsSilent = false,
    isAssistedPerformance = false,

    // Returns the (read only) boolean state of the track at trackIndex.
    // This function is used while setting options.
    trackIsOn = function (trackIndex)
    {
        var isOnStatus;
        if (trackIndex < trackIsOnStatus.length)
        {
            isOnStatus = trackIsOnStatus[trackIndex];
        }
        else
        {
            throw "illegal track index";
        }
        return isOnStatus;
    },

    // Returns an array containing the on/off status of each track.
    // The tracks' status cannot be set by changing values in the returned array.
    // This array is passed as an argument to the playSpan() functions.
    getTrackIsOnArray = function ()
    {
        var i, readOnlyArray = [];
        for (i = 0; i < trackIsOnStatus.length; ++i)
        {
            readOnlyArray.push(trackIsOn(i));
        }
        return readOnlyArray;
    },

    trackHasBeenToggled = function ()
    {
        // Calling this callback, which is defined in Controls, tells the score to redraw itself
        // using the appropriate colours.
        // If this is an assisted performance and the soloists silence status changes, the score
        // sets the soloist's track appropriately, and the assistant is reconstructed.
        if (trackToggled !== null)
        {
            trackToggled(livePerformerIsSilent);
        }
    },

    // called by user by clicking on screen
    trackOnOff = function (elemID, elemDisabledLayerID, trackIndexStr)
    {
        var elem = document.getElementById(elemID),
                elemDisabledLayer = document.getElementById(elemDisabledLayerID),
                trackIndex = parseInt(trackIndexStr, 10);

        disabled = (elemDisabledLayer.getAttribute("opacity") !== "0");

        if (!disabled && !trackIsDisabledStatus[trackIndex])
        {
            if (isAssistedPerformance)
            {
                if (trackIndex === livePerformersTrackIndex)
                {
                    elem.style.stroke = SOLOISTS_STROKECOLOR;
                    trackIsOnStatus[trackIndex] = true; // always
                    if(livePerformerIsSilent === true)
                    {
                        elem.style.fill = SOLOISTS_FILLCOLOR_WHEN_SOUNDING;
                        livePerformerIsSilent = false;
                    }
                    else
                    {
                        elem.style.fill = SOLOISTS_FILLCOLOR_WHEN_SILENT;
                        livePerformerIsSilent = true;
                    }
                }
                else if (trackIsOnStatus[trackIndex])
                {
                    elem.style.stroke = DISABLED_STROKECOLOR;
                    elem.style.fill = DISABLED_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = false;
                }
                else
                {
                    elem.style.stroke = NORMAL_STROKECOLOR;
                    elem.style.fill = NORMAL_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = true;
                }
            }
            else // score performance
            {
                if (trackIsOnStatus[trackIndex])
                {
                    elem.style.stroke = DISABLED_STROKECOLOR;
                    elem.style.fill = DISABLED_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = false;
                }
                else
                {
                    elem.style.stroke = NORMAL_STROKECOLOR;
                    elem.style.fill = NORMAL_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = true;
                }
            }
        }

        trackHasBeenToggled();
    },

    setTrackOn = function (trackIndex)
    {
        var elemID = 'track' + (trackIndex + 1).toString() + 'Bullet',
            elem = document.getElementById(elemID);

        if (isAssistedPerformance)
        {
            if (trackIndex === livePerformersTrackIndex)
            {
                elem.style.stroke = SOLOISTS_STROKECOLOR;
                trackIsOnStatus[trackIndex] = true; // always
                if(livePerformerIsSilent === false)
                {
                    elem.style.fill = SOLOISTS_FILLCOLOR_WHEN_SOUNDING;
                }
                else
                {
                    elem.style.fill = SOLOISTS_FILLCOLOR_WHEN_SILENT;
                }
            }
            else
            {
                elem.style.stroke = NORMAL_STROKECOLOR;
                elem.style.fill = NORMAL_FILLCOLOR;
                trackIsOnStatus[trackIndex] = true;
            }
        }
        else
        {
            elem.style.stroke = NORMAL_STROKECOLOR;
            elem.style.fill = NORMAL_FILLCOLOR;
            trackIsOnStatus[trackIndex] = true;
        }
    },

    setInitialTracksControlState = function(isAssisted, soloistsTrackIndex)
    {
        var i, nTracks = trackIsOnStatus.length;

        isAssistedPerformance = isAssisted;
        livePerformersTrackIndex = soloistsTrackIndex;
        livePerformerIsSilent = false;       

        for (i = 0; i < nTracks; ++i)
        {
            setTrackOn(i);
        }
    },

    // disable/enable the whole tracks control
    setDisabled = function (toDisabled)
    {
        var nLayers = disableLayerIDs.length,
                elem, i, opacity;

        opacity = toDisabled ? "0.7" : "0";
        for (i = 0; i < nLayers; ++i)
        {
            elem = document.getElementById(disableLayerIDs[i]);
            elem.setAttribute("opacity", opacity);
            if (i > 0) // disableLayerIDs[0] is the id of the whole tracks control
            {
                trackIsDisabledStatus[i] = toDisabled;
            }
        }

        disabled = toDisabled;
    },

    svgElem = function (s)
    {
        var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'),
                frag = document.createDocumentFragment();

        div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + s + '</svg>';
        frag.appendChild(div.firstChild.firstChild);

        return frag.firstChild;
    },

    // append the following child nodes to the trackControlsElem
    // <rect id="trackControlsFrame" x="0" y="0" width="' + width + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />
    // <rect id="trackControlsFrameDisabled" x="0" y="0" width="' + width + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity="0" />
    addFrames = function (trackControlsSvgElem, nTracks)
    {
        var width = ((nTracks * 16) + 6).toString(), // controls are 10 pixels wide, with 6px between them.
            frameElem, disabledFrameElem, disableLayerID = "trackControlsFrameDisabled";

        frameElem = svgElem('<rect id="trackControlsFrame" x="0" y="0" width="' + width + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />');
        disabledFrameElem = svgElem('<rect id="' + disableLayerID + '" x="0" y="0" width="' + width + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity="0.7" />');

        trackControlsSvgElem.appendChild(frameElem);
        trackControlsSvgElem.appendChild(disabledFrameElem);

        disableLayerIDs.push(disableLayerID);
    },

    addTrackControl = function (controlGroupElem, trackIndexStr)
    {
        var trackIndex = parseInt(trackIndexStr, 10),
            trackNumber = (trackIndex + 1).toString(),
            controlID = "track" + trackNumber + "Control",
            translateX = ((trackIndex * 16) + 6).toString(),
            bulletID = "track" + trackNumber + "Bullet",
            overBulletID = "over" + bulletID,
            disableFrameID = "trackControlsFrameDisabled",
            disableControlID = controlID + "Disabled",
            textTranslateX = (trackIndex < 9) ? "2.0" : "-2.0",
            html = '<g id="' + controlID + '" transform="translate(' + translateX + ',1)"\n' +
                'onmouseover="_AP.controls.showOverRect(\'' + overBulletID + '\', \'' + disableFrameID + '\')"\n' +
                'onmouseout="_AP.controls.hideOverRect(\'' + overBulletID + '\')"\n' +
                'onmousedown="_AP.tracksControl.trackOnOff(\'' + bulletID + '\', \'' + disableControlID + '\', \'' + trackIndexStr + '\')" >\n' +
                '    <text x="' + textTranslateX + '" y="10" font-size="10" font-family="Lucida Sans Unicode, Verdana, Arial, Geneva, Sans-Serif" fill="black">\n' +
                '        ' + trackNumber + '\n' +
                '    </text>\n' +
                '    <circle id="' + overBulletID + '" cx="5" cy="19" r="6.5" stroke="#00CE00" stroke-width="2" opacity="0"/> \n' +
                '    <circle id="' + bulletID + '" cx="5" cy="19" r="5" stroke="black" stroke-width="1" fill="#AAAAAA"/>\n' +
                '    <rect id="' + disableControlID + '" x="-1" y="1" width="12" height="28" stroke="#FFFFFF" stroke-width="0" fill="#FFFFFF" opacity="0.7" />\n' +
            '</g>\n',
            svgTrackControlElem = svgElem(html);

        controlGroupElem.appendChild(svgTrackControlElem);

        trackIsOnStatus.push(true);
        trackIsDisabledStatus.push(false);
        disableLayerIDs.push(disableControlID);
    },

    setNumberOfTracks = function (nTracks)
    {
        var trackControlsSvgElem,
            controlPanel = document.getElementById("controlPanel"),
            firstControlPanelChild,
            groupElem, i, parentElem;

        trackControlsSvgElem = document.getElementById("trackControlsSvgElem");
        if (trackControlsSvgElem !== null)
        {
            parentElem = trackControlsSvgElem.parentNode;
            parentElem.removeChild(trackControlsSvgElem);
            disableLayerIDs = [];
        }

        trackControlsSvgElem = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        trackControlsSvgElem.setAttribute("id", "trackControlsSvgElem");
        trackControlsSvgElem.setAttribute("width", "1042px");
        trackControlsSvgElem.setAttribute("height", "36px");
        trackControlsSvgElem.style.position = "absolute";
        trackControlsSvgElem.style.top = 0;
        trackControlsSvgElem.style.left = 0;
        groupElem = svgElem('<g id="trackControls" transform="translate(0.5,0.5)" \\>');
        trackControlsSvgElem.appendChild(groupElem);

        addFrames(groupElem, nTracks);

        trackIsOnStatus = [];
        trackIsDisabledStatus = [];
        disableLayerIDs = [];

        for (i = 0; i < nTracks; ++i)
        {
            addTrackControl(groupElem, i);
        }

        //controlPanel.appendChild(trackControlsSvgElem);
        firstControlPanelChild = controlPanel.firstChild;
        if(nTracks > 0)
        {
            controlPanel.insertBefore(trackControlsSvgElem, firstControlPanelChild);
        }
    },

    getTrackToggledCallback = function (callback)
    {
        trackToggled = callback;
    },

    publicAPI =
    {
        // Called after loading a particular score.
        setNumberOfTracks: setNumberOfTracks,

        // Called when the user clicks the start button in the upper options.
        setInitialTracksControlState: setInitialTracksControlState,

        // called if the user clicks a trackControl
        trackOnOff: trackOnOff,

        // used to disable the tracks control when changing it makes no sense.
        setDisabled: setDisabled,

        //setTrackOn: setTrackOn,
        //setAllTracksOn: setAllTracksOn,

        // Function which returns the (read only) boolean state of the track at trackIndex.
        // This function is used by the score when redrawing itself.
        trackIsOn: trackIsOn,

        // Function which returns an array containing the on/off status of each track.
        // The tracks' status cannot be set by changing values in the returned array.
        // The array is passed as an argument to the playSpan() functions.
        // In an assisted performance, the soloist's track is always ON, but it can be
        // either sounding or silent.
        getTrackIsOnArray : getTrackIsOnArray,

        getTrackToggledCallback: getTrackToggledCallback
    };
    // end var

    return publicAPI;

} (document));
