/*
*  copyright 2012 James Ingram
*  http://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  jiAPTracksControl.js
*  The JI_NAMESPACE.apTracksControl namespace deining the tracks control.
*  The tracks control enables tracks to be turned on and off for performances.
*  
*/

/*jslint bitwise: false, nomen: false, plusplus: true, white: true */

JI_NAMESPACE.namespace('JI_NAMESPACE.apTracksControl');

JI_NAMESPACE.apTracksControl = (function (document)
{
    "use strict";

    var 
    // button colours in this TracksControl 
    SOLOISTS_STROKECOLOR = "#0000FF",
    SOLOISTS_FILLCOLOR = "#CCCCFF", // "#8888FF" is css helpColor in top options dialog, and live performer's title color    
    ASSISTANTS_STROKECOLOR = "#000000",
    ASSISTANTS_FILLCOLOR = "#DDDDDD",
    ENABLED_STROKECOLOR = "#000000",
    ENABLED_FILLCOLOR = "#AAAAAA",
    DISABLED_STROKECOLOR = "#FF3333",
    DISABLED_FILLCOLOR = "#FFEEEE",
    disableLayerIDs = [],  // disableLayerIDs[0] is the disable layer id for the whole tracks control
    trackIsOnStatus = [],
    trackIsDisabledStatus = [],
    disabled = true,
    refreshScoreDisplay = null,
    livePerformersTrackIndex = -1,
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

    refreshDisplay = function ()
    {
        // Calling this callback, which is defined in Score, tells the score
        // which colours to paint the staves. The score may also have to update
        // the position of the start marker (which always starts on a chord).
        if (refreshScoreDisplay !== null)
        {
            refreshScoreDisplay(isAssistedPerformance, livePerformersTrackIndex);
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
                    elem.style.fill = SOLOISTS_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = true;
                }
                else if (trackIsOnStatus[trackIndex])
                {
                    elem.style.stroke = DISABLED_STROKECOLOR;
                    elem.style.fill = DISABLED_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = false;
                }
                else
                {
                    elem.style.stroke = ASSISTANTS_STROKECOLOR;
                    elem.style.fill = ASSISTANTS_FILLCOLOR;
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
                    elem.style.stroke = ENABLED_STROKECOLOR;
                    elem.style.fill = ENABLED_FILLCOLOR;
                    trackIsOnStatus[trackIndex] = true;
                }

            }
        }

        refreshDisplay();
    },


    // In an assisted performance, this function is called (in jiControls.startRuntime) when the Go or playLive/playScore buttons are clicked.
    setTrackOn = function (trackIndex)
    {
        var elemID = 'track' + (trackIndex + 1).toString() + 'Bullet',
            elem = document.getElementById(elemID);

        if (isAssistedPerformance)
        {
            if (trackIndex === livePerformersTrackIndex)
            {
                elem.style.stroke = SOLOISTS_STROKECOLOR;
                elem.style.fill = SOLOISTS_FILLCOLOR;
                trackIsOnStatus[trackIndex] = true;
            }
            else
            {
                elem.style.stroke = ASSISTANTS_STROKECOLOR;
                elem.style.fill = ASSISTANTS_FILLCOLOR;
                trackIsOnStatus[trackIndex] = true;
            }
        }
        else
        {
            elem.style.stroke = ENABLED_STROKECOLOR;
            elem.style.fill = ENABLED_FILLCOLOR;
            trackIsOnStatus[trackIndex] = true;
        }
    },

    setAllTracksOn = function ()
    {
        var i, nTracks = trackIsOnStatus.length;

        for (i = 0; i < nTracks; ++i)
        {
            setTrackOn(i);
        }
    },

    setTracksControlState = function (isAssisted, soloistsTrackIndex)
    {
        var i, nTracks = trackIsOnStatus.length;

        isAssistedPerformance = isAssisted;
        livePerformersTrackIndex = soloistsTrackIndex;

        for (i = 0; i < nTracks; ++i)
        {
            if (trackIsOn(i) || i === soloistsTrackIndex)
            {
                setTrackOn(i);
            }
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
                'onmouseover="JI_NAMESPACE.apControls.showOverRect(\'' + overBulletID + '\', \'' + disableFrameID + '\')"\n' +
                'onmouseout="JI_NAMESPACE.apControls.hideOverRect(\'' + overBulletID + '\')"\n' +
                'onmousedown="JI_NAMESPACE.apTracksControl.trackOnOff(\'' + bulletID + '\', \'' + disableControlID + '\', \'' + trackIndexStr + '\')" >\n' +
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

    init = function (nTracks)
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
        groupElem = svgElem('<g id="trackControls" transform="translate(0.5,5.5)" \\>');
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
        controlPanel.insertBefore(trackControlsSvgElem, firstControlPanelChild);
    },

    // the callback is score.refreshDisplay(isAssistedPerformance, livePerformersTrackIndex);
    getUpdateDisplayCallback = function (callback)
    {
        refreshScoreDisplay = callback;
    },

    publicAPI =
    {
        init: init,

        trackOnOff: trackOnOff,
        setDisabled: setDisabled,

        setTrackOn: setTrackOn,
        setAllTracksOn: setAllTracksOn,
        setTracksControlState: setTracksControlState,
        refreshDisplay: refreshDisplay,

        // Function which returns the (read only) boolean state of the track at trackIndex.
        // This function is used while setting options.
        trackIsOn: trackIsOn,

        // Function which returns an array containing the on/off status of each track.
        // The tracks' status cannot be set by changing values in the returned array.
        // The array is passed as an argument to the playSpan() functions.
        getTrackIsOnArray : getTrackIsOnArray,

        getUpdateDisplayCallback: getUpdateDisplayCallback
    };
    // end var

    return publicAPI;

} (document));
