/*
*  copyright 2012 James Ingram
*  https://james-ingram-act-two.de/
*
*  Code licensed under MIT
*  https://github.com/notator/assistant-performer/blob/master/License.md
*
*  ap/TracksControl.js
*  The _AP.tracksControl namespace deining the tracks control.
*  The tracks control enables tracks to be turned on and off for performances.
*  
*/

_AP.namespace('_AP.tracksControl');

_AP.tracksControl = (function (document)
{
    "use strict";

    var
	DISABLED_FRAME_ID = "trackControlsFrameDisabled",

	// colours in this tracksControl
    BACKGROUND_GREEN = "#F5FFF5",
    TRACKOFF_FILLCOLOR = BACKGROUND_GREEN,
	DISABLED_BULLET_STROKECOLOR = "#FFFFFF", // used with opacity
	DISABLED_BULLET_FILLCOLOR = "#FFFFFF", // used with opacity

	OUTPUT_TRACKNUMBER_COLOR = "#000000",
    OUTPUT_BULLET_STROKECOLOR = "#000000",
	OUTPUT_BULLET_FILLCOLOR = "#AAAAAA",
	OUTPUT_OVERBULLET_STROKECOLOR = "#00CE00", // mouseover ring

	INPUT_TRACKNUMBER_COLOR = "#0000FF",
	INPUT_BULLET_STROKECOLOR = "#0000FF",
	INPUT_BULLET_FILLCOLOR = "#BBBBFF",
	INPUT_OVERBULLET_STROKECOLOR = "#7777FF", // mouseover ring

	// constants for track control opacity values
    METAL = "1", // control layer is completely opaque
	SMOKE = "0.7", // control layer is fairly opaque
    GLASS = "0", // control layer is completely transparent

	isLivePerformance, // set in init()

	trackCtlElems = [], // the controls for individual tracks

    scoreRefresh = null, // a callback that tells the score to redraw itself

	setTrackCtlState = function(trackIndex, state)
	{
	    var
		offLayer = document.getElementById("bullet" + (trackIndex + 1).toString() + "Off"),
		disabledLayer = document.getElementById("bullet" + (trackIndex + 1).toString() + "Disabled");
	    trackCtlElems[trackIndex].previousState = trackCtlElems[trackIndex].state;

	    switch(state)
	    {
	        case "on":
	            offLayer.setAttribute("opacity", GLASS);
	            disabledLayer.setAttribute("opacity", GLASS);
	            trackCtlElems[trackIndex].state = "on";
	            break;
	        case "off":
	            offLayer.setAttribute("opacity", METAL);
	            disabledLayer.setAttribute("opacity", GLASS);
	            trackCtlElems[trackIndex].state = "off";
	            break;
	        case "disabled":
	            disabledLayer.setAttribute("opacity", SMOKE);
	            trackCtlElems[trackIndex].state = "disabled";
	            break;
	    }
	},

    bbWidth = 0, // the width of the bounding box. Set in init()

    width = function()
    {
        return bbWidth;
    },

	init = function(outputTracks, inputTracks, isLivePerf, scoreRefreshCallback)
	{
		var nOutputTracks = outputTracks.length, nInputTracks = inputTracks.length,
			trackControlsMainElem, svgTrackControlsElem, trackCtlElem,
			controlPanel = document.getElementById("svgRuntimeControls"),
			firstControlPanelChild,
			i, parentElem,
			nTrackControls, inputIndex,
			trackControlsWidth;

	    function getTrackControlsMainElem(trackControlsWidth)
	    {
	    	var trackControlsMainElem = document.getElementById("trackControlsMainElem");
	    	if(trackControlsMainElem !== null)
	    	{
	    		parentElem = trackControlsMainElem.parentNode;
	    		parentElem.removeChild(trackControlsMainElem);
	    	}
	    	bbWidth = parseInt(trackControlsWidth, 10) + 2;
	    	trackControlsMainElem = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
	    	trackControlsMainElem.setAttribute("id", "trackControlsMainElem");
	    	trackControlsMainElem.setAttribute("width", bbWidth);
	    	trackControlsMainElem.setAttribute("height", "36px");
	    	trackControlsMainElem.style.position = "absolute";
	    	trackControlsMainElem.style.top = 0;
	    	trackControlsMainElem.style.left = 0;

	    	return trackControlsMainElem;
	    }

	    function svgElem(contentString)
	    {
	    	var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'),
					frag = document.createDocumentFragment();

	    	div.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + contentString + '</svg>';
	    	frag.appendChild(div.firstChild.firstChild);

	    	return frag.firstChild;
	    }

	    // append the following child nodes to the trackControlsMainElem
	    // <rect id="trackControlsFrame" x="0" y="0" width="' + width + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />
	    // <rect id="trackControlsFrameDisabled" x="0" y="0" width="' + width + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity="0" />
	    function addFrames(trackControlsMainElem, trackControlsWidth)
	    {
	    	var frameElem, disabledFrameElem;

	    	frameElem = svgElem('<rect id="trackControlsFrame" x="0" y="0" width="' + trackControlsWidth + '" height="30" stroke="#008000" stroke-width="1" fill="#F5FFF5" />');
	    	disabledFrameElem = svgElem('<rect id="' + DISABLED_FRAME_ID + '" x="0" y="0" width="' + trackControlsWidth + '" height="30" stroke="#FFFFFF" stroke-width="1" fill="#FFFFFF" opacity=' + GLASS + ' />');

	    	trackControlsMainElem.appendChild(frameElem);
	    	trackControlsMainElem.appendChild(disabledFrameElem);
	    }

	    function trackControlElem(trackIndexStr, isOutputTrackControl)
	    {
	    	var trackIndex = parseInt(trackIndexStr, 10),
				trackNumberColor = isOutputTrackControl ? OUTPUT_TRACKNUMBER_COLOR : INPUT_TRACKNUMBER_COLOR,
				overBulletStrokeColor = isOutputTrackControl ? OUTPUT_OVERBULLET_STROKECOLOR : INPUT_OVERBULLET_STROKECOLOR,
				bulletOnStrokeColor = isOutputTrackControl ? OUTPUT_BULLET_STROKECOLOR : INPUT_BULLET_STROKECOLOR,
				bulletOnFillColor = isOutputTrackControl ? OUTPUT_BULLET_FILLCOLOR : INPUT_BULLET_FILLCOLOR,
				bulletOffStrokeColor = isOutputTrackControl ? OUTPUT_BULLET_STROKECOLOR : INPUT_BULLET_STROKECOLOR,
				bulletOffFillColor = TRACKOFF_FILLCOLOR,
				bulletDisabledStrokeColor = DISABLED_BULLET_STROKECOLOR,
				bulletDisabledFillColor = DISABLED_BULLET_FILLCOLOR,

				trackNumber = (trackIndex + 1).toString(),
				controlID = "track" + trackNumber + "Control",
				translateX = ((trackIndex * 16) + 6).toString(),

				overBulletID = 'overBullet' + trackNumber,
				bulletOnID = 'bullet' + trackNumber + 'On',
				bulletOffID = 'bullet' + trackNumber + 'Off',
				bulletDisabledID = 'bullet' + trackNumber + 'Disabled',

				textTranslateX = (trackIndex < 9) ? "2.0" : "-2.0",
				html = '<g id="' + controlID + '" transform="translate(' + translateX + ',1)"\n' +
					'onmouseover="_AP.controls.showOverRect(\'' + overBulletID + '\', \'' + bulletDisabledID + '\')"\n' +
					'onmouseout="_AP.controls.hideOverRect(\'' + overBulletID + '\')"\n' +
					'onmousedown="_AP.tracksControl.trackOnOff(\'' + trackIndex + '\', \'' + bulletOffID + '\')" >\n' +
					'    <text x="' + textTranslateX + '" y="10" font-size="10" font-family="Lucida Sans Unicode, Verdana, Arial, Geneva, Sans-Serif"' +
							'fill="' + trackNumberColor + '">\n' +
							trackNumber + '\n' +
					'    </text>\n' +
					'    <circle id="' + overBulletID + '" cx="5" cy="19" r="6.5" stroke="' + overBulletStrokeColor + '" stroke-width="2" opacity="' + GLASS + '"/> \n' +
					'    <circle id="' + bulletOnID + '" cx="5" cy="19" r="5" stroke="' + bulletOnStrokeColor + '" stroke-width="1" fill="' + bulletOnFillColor + '" opacity="' + METAL + '"/>\n' +
					'    <circle id="' + bulletOffID + '" cx="5" cy="19" r="5" stroke="' + bulletOffStrokeColor + '" stroke-width="1" fill="' + bulletOffFillColor + '" opacity="' + GLASS + '"/>\n' +
					'    <circle id="' + bulletDisabledID + '" cx="5" cy="19" r="5" stroke="' + bulletDisabledStrokeColor + '" stroke-width="1" fill="' + bulletDisabledFillColor + '" opacity="' + GLASS + '"/>\n' +
				'</g>\n';

	    	return svgElem(html);
	    }

	    // Called if this is not a live performance 
	    function disableTrkOptions()
	    {
	    	var i;

	    	for(i = 0; i < trackCtlElems.length; ++i)
	    	{
	    		if(trackCtlElems[i].isOutput === false)
	    		{
	    			trackCtlElems[i].onmouseover = null;
	    			trackCtlElems[i].onmouseout = null;
	    			trackCtlElems[i].onmousedown = null;

	    			setTrackCtlState(i, "disabled");
	    			trackCtlElems[i].previousState = "disabled";
	    		}
	    	}
	    }

	    isLivePerformance = isLivePerf;
	    scoreRefresh = scoreRefreshCallback;

	    nTrackControls = nOutputTracks + nInputTracks;
	    trackControlsWidth = ((nTrackControls * 16) + 6).toString(); // individual controls are 10 pixels wide, with 6px between them.

	    trackControlsMainElem = getTrackControlsMainElem(trackControlsWidth);

	    firstControlPanelChild = controlPanel.firstChild;
	    controlPanel.insertBefore(trackControlsMainElem, firstControlPanelChild);

	    svgTrackControlsElem = svgElem('<g id="trackControls" transform="translate(0.5,0.5)" \\>');
	    trackControlsMainElem.appendChild(svgTrackControlsElem);

	    addFrames(svgTrackControlsElem, trackControlsWidth);

	    trackCtlElems = [];

	    for(i = 0; i < nTrackControls; ++i)
	    {
	    	if(i < nOutputTracks)
	    	{
	    		trackCtlElem = trackControlElem(i, true); // an output track control
	    	}
	    	else
	    	{
	    		trackCtlElem = trackControlElem(i, false); // an input track control
	    	}

	    	svgTrackControlsElem.appendChild(trackCtlElem);

	    	trackCtlElems.push(trackCtlElem);
	    	trackCtlElems[i].isOutput = (i < nOutputTracks);

	    	setTrackCtlState(i, "on");
	    	trackCtlElems[i].previousState = "on";
	    }

	    if(isLivePerformance === false)
	    {
	    	disableTrkOptions();
	    }
	},

	// Pushes the track on/off states as booleans into the argument (which is an empty array).
	// The tracks' state cannot be set by changing values in the returned array.
    // This function is called by the trackOnOff function below.
	getReadOnlyTrackIsOnArray = function(readOnlyArray)
	{
		var i;
		for(i = 0; i < trackCtlElems.length; ++i)
		{
			readOnlyArray.push(trackCtlElems[i].state === "on"); // "disabled" and "off" are both "off" here
		}
	},

    // called by user by clicking on screen.
    trackOnOff = function (trackNumberStr, bulletOffID)
    {
    	var
		trackIndex = parseInt(trackNumberStr, 10),
    	bulletOffLayer = document.getElementById(bulletOffID),
        thisIsTheLastPlayingInputOrOutputTrack,
    	readOnlyTrackIsOnArray = [],
		disabledFrame = document.getElementById(DISABLED_FRAME_ID),
        isCurrentlyDisabled = (disabledFrame.getAttribute("opacity") === SMOKE);

        function isTheLastPlayingInputOrOutputTrack(trackIndex)
        {
        	var i, rVal = true, isOutput = trackCtlElems[trackIndex].isOutput;

            if(trackCtlElems[trackIndex].state === "on") // about to toggle it off
            {
            	for(i = 0; i < trackCtlElems.length; ++i)
                {

            		if(i !== trackIndex && trackCtlElems[i].isOutput === isOutput && trackCtlElems[i].state === "on")
                    {
                        rVal = false;
                        break;
                    }
                }
            }
            else // about to toggle it on
            {
                rVal = false;
            }

            if(rVal === true)
            {
            	if(trackCtlElems[trackIndex].isOutput)
            	{
            		alert("Can't turn off the last output track!");
            	}
            	else
            	{
            		alert("Can't turn off the last input track!");
            	}
            }

            return rVal;
        }

        if(!isCurrentlyDisabled)
        {
        	thisIsTheLastPlayingInputOrOutputTrack = isTheLastPlayingInputOrOutputTrack(trackIndex);

        	if(!thisIsTheLastPlayingInputOrOutputTrack)
        	{
        		if(trackCtlElems[trackIndex].state === "on")
        		{
        			bulletOffLayer.setAttribute("opacity", METAL);
        			trackCtlElems[trackIndex].state = "off";
        		}
        		else if(trackCtlElems[trackIndex].state === "off")
        		{
        			bulletOffLayer.setAttribute("opacity", GLASS);
        			trackCtlElems[trackIndex].state = "on";
        		}

        		// scoreRefresh is a callback that tells the score to redraw itself
        		if(scoreRefresh !== null)
        		{
        			getReadOnlyTrackIsOnArray(readOnlyTrackIsOnArray);
        			scoreRefresh(readOnlyTrackIsOnArray);
        		}
        	}
        }
    },

    // disable/re-enable the whole tracks control
    setDisabled = function (toDisabled)
    {
    	var i,
		disabledFrame = document.getElementById(DISABLED_FRAME_ID),
		isCurrentlyDisabled = (disabledFrame.getAttribute("opacity") === SMOKE);

    	if(toDisabled)
    	{
    		disabledFrame.setAttribute("opacity", SMOKE);
    	}
    	else
    	{
    		disabledFrame.setAttribute("opacity", GLASS);
    	}

    	for(i = 0; i < trackCtlElems.length; ++i)
    	{
    		if(toDisabled)
    		{
    			setTrackCtlState(i, "disabled");
    		}
    		else if(isCurrentlyDisabled)
    		{
    			setTrackCtlState(i, trackCtlElems[i].previousState);
    		}
    	}
    },

    publicAPI =
    {
        // Called after loading a particular score.
        init: init,

        // the width of the bounding box (set by init())
        width: width,

    	// used to disable the whole tracks control when changing it makes no sense.
    	setDisabled: setDisabled,

    	// Called if the user clicks a trackControl.
    	// This function calls the scoreRefresh(isLivePerformance, trackIsOnArray)
    	// callback which tells the score to redraw itself.
        trackOnOff: trackOnOff
    };
    // end var

    return publicAPI;

} (document));
