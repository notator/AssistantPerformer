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

JI_NAMESPACE.namespace('JI_NAMESPACE.apTracksControl');

JI_NAMESPACE.apTracksControl = (function (document, window)
{
    "use strict";

    var disableLayerIDs = [],
        trackIsOnStatus = [],
        disabled = true,
        setRunningMarkers, // a callback: score.setRunningMarkers(tracksControl)

        trackIsOn = function (trackIndex)
        {
            var isOnStatus;
            if (trackIndex < trackIsOnStatus.length)
            {
                isOnStatus = (trackIsOnStatus[trackIndex] === true);
            }
            else
            {
                throw "illegal track index";
            }
            return isOnStatus;
        },

    trackOnOff = function (elemID, elemDisabledLayerID, trackIndexStr)
    {
        var elem = document.getElementById(elemID),
                elemDisabledLayer = document.getElementById(elemDisabledLayerID),
                trackIndex = parseInt(trackIndexStr);

        disabled = (elemDisabledLayer.getAttribute("opacity") !== "0");

        if (!disabled)
        {
            if (trackIsOnStatus[trackIndex])
            {
                //elem.setAttribute("fill", "white");
                elem.style.fill = "#FFFFFF";
                trackIsOnStatus[trackIndex] = false;
            }
            else
            {
                //elem.setAttribute("fill", "#AAAAAA");
                elem.style.fill = "#AAAAAA";
                trackIsOnStatus[trackIndex] = true;
            }
        }
    },

        setDisabled = function (toDisabled)
        {
            var nLayers = disableLayerIDs.length,
                elem, i, opacity;

            opacity = toDisabled ? "0.7" : "0";
            for (i = 0; i < nLayers; ++i)
            {
                elem = document.getElementById(disableLayerIDs[i]);
                elem.setAttribute("opacity", opacity);
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
            var trackIndex = parseInt(trackIndexStr),
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

            disableLayerIDs.push(disableControlID);
        },

    init = function (nTracks, options)
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

        for (i = 0; i < nTracks; ++i)
        {
            addTrackControl(groupElem, i);
        }

        //controlPanel.appendChild(trackControlsSvgElem);
        firstControlPanelChild = controlPanel.firstChild;
        controlPanel.insertBefore(trackControlsSvgElem, firstControlPanelChild);
    },

    publicAPI =
    {
        init: init,

        trackOnOff: trackOnOff,
        setDisabled: setDisabled,

        trackIsOn: trackIsOn
    };
    // end var

    return publicAPI;

} (document, window));
