/*
 *  copyright 2012 James Ingram
 *  http://james-ingram-act-two.de/
 *
 *  Code licensed under MIT
 *  https://github.com/notator/assistant-performer/blob/master/License.md
 *
 *  ap/Markers.js
 *  Defines the StartMarker, EndMarker and RunningMarker objects.
 *  The StartMarker and EndMarker are the objects in a score which determine
 *  where a performance begins and ends.
 *  The RunningMarker is the line which shows the current position in a
 *  performance while it is running.
 *  
 */

/*jslint white */
/*global WebMIDI, _AP,  window,  document */

_AP.namespace('_AP.markers');

_AP.markers = (function ()
{
    "use strict";

    var EXTRA_TOP_AND_BOTTOM = 45, // user html pixels
        CIRCLE_RADIUS = 5, // user html pixels
        RECT_WIDTH_AND_HEIGHT = 8, // user html pixels

    // markers are used to determine the start and end points of a performance
    // when playing a MIDI file

    // The argument is an svg group with class='startMarker'.
    // It contains an svg line and an svg circle element.
    // This constructor simply saves pointers to the line and circle.
    // Their parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    StartMarker = function (svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof StartMarker))
        {
            return new StartMarker();
        }

        var 
        i, groupChildren,
        viewBoxOriginY, viewBoxScale,
        line,
        circle,
        color = '#009900', disabledColor = '#AAFFAA',
        sysIndex, timObject,
        millisecondPosition, yCoordinates = {},

        moveTo = function (tObject)
        {
            var x = tObject.alignmentX;

            timObject = tObject;

            millisecondPosition = tObject.msPosition;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            circle.setAttribute('cx', x.toString());
        },

        msPosition = function ()
        {
            return millisecondPosition;
        },

        setParameters = function(system, systIndex)
        {
            var i, topY, bottomY;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);

            line.style.strokeWidth = 4; // 1/2 pixel
            line.style.stroke = color;

            circle.setAttribute('cy', topY);
            circle.setAttribute('r', (viewBoxScale * CIRCLE_RADIUS).toString());
            circle.style.strokeWidth = 0;
            circle.style.fill = color;

            yCoordinates.top = Math.round(parseFloat(topY) / vbScale) + viewBoxOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottomY) / vbScale) + viewBoxOriginY;

            sysIndex = systIndex;
            for(i = 0; i < system.staves.length; ++i)
            {
            	if(!isNaN(system.staves[i].voices[0].timeObjects[0].alignmentX))
            	{
            		moveTo(system.staves[i].voices[0].timeObjects[0]);
            		break;
            	}
            }         
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        timeObject = function ()
        {
            return timObject;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
                line.style.stroke = color;
                circle.style.fill = color;
            }
            else
            {
                line.style.stroke = disabledColor;
            	circle.style.fill = disabledColor;
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                line.style.visibility = 'visible';
                circle.style.visibility = 'visible';
            }
            else
            {
                line.style.visibility = 'hidden';
                circle.style.visibility = 'hidden';
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgStartMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if (groupChildren[i].nodeName === 'circle')
            {
                circle = groupChildren[i];
            }
        }

        setVisible(false);

        this.setParameters = setParameters;
        this.systemIndex = systemIndex;
        this.timeObject = timeObject;
        this.msPosition = msPosition;
        this.moveTo = moveTo;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // The argument is an svg group with id='endMarker'.
    // It contains an svg line and an svg rect element.
    // This constructor simply saves pointers to the line and rect.
    // Their parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    EndMarker = function (svgEndMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof EndMarker))
        {
            return new EndMarker();
        }

        var 
        i, groupChildren,
        viewBoxOriginY, viewBoxScale,
        line,
        rect,
        halfRectWidth,
        color = '#EE0000', disabledColor = '#FFC8C8',
        millisecondPosition,
		sysIndex,

        setParameters = function(system, systemIndex)
        {
        	var topY, bottomY, rectX, rectY, widthHeight;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();

            rectX = (viewBoxScale * (-RECT_WIDTH_AND_HEIGHT / 2)).toString(10);
            rectY = (topY - (viewBoxScale * (RECT_WIDTH_AND_HEIGHT / 2))).toString(10);

            halfRectWidth = (viewBoxScale * RECT_WIDTH_AND_HEIGHT) / 2;
            widthHeight = (viewBoxScale * RECT_WIDTH_AND_HEIGHT).toString(10);

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);

            line.style.strokeWidth = 4;
            line.style.stroke = color;

            rect.setAttribute('x', rectX);
            rect.setAttribute('y', rectY);
            rect.setAttribute('width', widthHeight);
            rect.setAttribute('height', widthHeight);

            rect.style.strokeWidth = 0;
            rect.style.fill = color;

            sysIndex = systemIndex;
        },

    	systemIndex = function()
    	{
    		return sysIndex;
    	},

        // the argument's alignmentX is in user html pixels
        moveTo = function (timeObject)
        {
            var x = timeObject.alignmentX;

            millisecondPosition = timeObject.msPosition;

            x *= viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
            rect.setAttribute('x', (x - halfRectWidth).toString());
        },

        msPosition = function ()
        {
            return millisecondPosition;
        },

        setEnabledColor = function (setToEnabledColor)
        {
            if (setToEnabledColor)
            {
            	rect.style.fill = color;
                line.style.stroke = color;
            }
            else
            {
                rect.style.fill = disabledColor;
                line.style.stroke = disabledColor;
            }
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
                rect.style.visibility = 'visible';
                line.style.visibility = 'visible';
            }
            else
            {
                rect.style.visibility = 'hidden';
                line.style.visibility = 'hidden';
            }
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgEndMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
            if (groupChildren[i].nodeName === 'rect')
            {
                rect = groupChildren[i];
            }
        }

        setVisible(false);

        this.setParameters = setParameters;
        this.moveTo = moveTo;
        this.msPosition = msPosition;
        this.setVisible = setVisible;
        this.setEnabledColor = setEnabledColor;
        this.systemIndex = systemIndex;

        return this;
    },

    // The argument is an svg group with id='runningMarker'.
    // The group contains a single svg line.
    // This constructor simply saves pointers to the line.
    // Its parameters are set later, using the setParameters() function,
    // when the system parameters are known.
    RunningMarker = function (svgStartMarkerGroup, vbOriginY, vbScale)
    {
        if (!(this instanceof RunningMarker))
        {
            return new RunningMarker();
        }

        var 
        // private variables ***********************************
        i, groupChildren, viewBoxOriginY, viewBoxScale,
        line, timeObjects, positionIndex,
        nextMillisecondPosition,
        sysIndex, yCoordinates = {},

        moveLineToAlignmentX = function (alignmentX)
        {
            var x = alignmentX * viewBoxScale;
            line.setAttribute('x1', x.toString());
            line.setAttribute('x2', x.toString());
        },

        setNextMsPosition = function (currentIndex)
        {
            if (currentIndex < (timeObjects.length - 1))
            {
                nextMillisecondPosition = timeObjects[currentIndex + 1].msPosition;
            }
            else
            {
                nextMillisecondPosition = undefined;
            }
        },

		// This function is necessary after changing systems, where the first position of the system needs to be skipped.
		// msPosition must be in the current system
		moveTo = function(msPosition)
		{
			var i;

			positionIndex = 0;
			while(timeObjects[positionIndex].msPosition !== msPosition)
			{
				positionIndex++;
			}

			moveLineToAlignmentX(timeObjects[positionIndex].alignmentX);
			nextMillisecondPosition = timeObjects[positionIndex + 1].msPosition; // may be system's end barline
		},

        // The startMarker argument is in the same system as this runningMarker
        // If the startMarker is on the system's end barline, nextMsPosition is set to undefined.
        // (The current runningMarker is changed to the following system's runningMarker,
        // if the sequencer's msTimeStamp > system.endMsPosition, so the undefined value for
        // the runningMarker.nextMsPosition should never be accessed.
        moveToStartMarker = function (startMarker)
        {
        	//moveTo(startMarker.timeObject().msPosition);
        	var i, msPosition = startMarker.timeObject().msPosition;

        	positionIndex = 0;
        	while(timeObjects[positionIndex].msPosition < msPosition)
        	{
        		positionIndex++;
        	}

        	moveLineToAlignmentX(timeObjects[positionIndex].alignmentX);
        	nextMillisecondPosition = timeObjects[positionIndex + 1].msPosition; // may be system's end barline
        },

        moveToStartOfSystem = function()
        {
        	moveTo(timeObjects[0].msPosition);
        },

        incrementPosition = function ()
        {
            //console.log("runningMarker: msPos before increment=%i, after increment=%i", timeObjects[positionIndex].msPosition, timeObjects[positionIndex + 1].msPosition);
            positionIndex++;
            setNextMsPosition(positionIndex);
            moveLineToAlignmentX(timeObjects[positionIndex].alignmentX);
        },

        systemIndex = function ()
        {
            return sysIndex;
        },

        nextMsPosition = function ()
        {
            return nextMillisecondPosition;
        },

        // The timeObjects array contains one timeObject per msPosition in the system.
        // It is ordered according to each timeObject msPosition.
		// If isLivePerformance === true, the timeObjects are inputObjects from inputVoices,
		// otherwise the timeObjects are midiObjects from outputVoices.
        setTimeObjects = function (system, isLivePerformance, trackIsOnArray)
        {
            var timeObject;

            function findFollowingTimeObject(system, msPosition, isLivePerformance, trackIsOnArray)
            {
                var nextTimeObject, staff, voice, i, k, voiceIndex, trackIndex = 0,
                        voiceTimeObjects = [];

                for (i = 0; i < system.staves.length; ++i)
                {
                	staff = system.staves[i];
                	if(staff.isVisible)
                	{
                		for(voiceIndex = 0; voiceIndex < staff.voices.length; ++voiceIndex)
                		{
                			if(trackIsOnArray[trackIndex] === true)
                			{
                				voice = staff.voices[voiceIndex];
                				if(voice.class === "outputVoice" && isLivePerformance === false)
                				{
                					for(k = 0; k < voice.timeObjects.length; ++k)
                					{
                						if(voice.timeObjects[k].msPosition > msPosition)
                						{
                							voiceTimeObjects.push(voice.timeObjects[k]);
                							break;
                						}
                					}
                				}
                				else if(voice.class === "inputVoice" && isLivePerformance === true)
                				{
                					for(k = 0; k < voice.timeObjects.length; ++k)
                					{
                						if(voice.timeObjects[k].msPosition > msPosition)
                						{
                							voiceTimeObjects.push(voice.timeObjects[k]);
                							break;
                						}
                					}
                				}
                			}
                			trackIndex++;
                		}
                	}
                }

                // voiceTimeObjects now contains the next timeObject in each active, visible voice.
                // Now find the one having the minimum msPosition.
                nextTimeObject = voiceTimeObjects[0];
                if (voiceTimeObjects.length > 1)
                {
                    for (i = 1; i < voiceTimeObjects.length; ++i)
                    {
                        if (voiceTimeObjects[i].msPosition < nextTimeObject.msPosition)
                        {
                            nextTimeObject = voiceTimeObjects[i];
                        }
                    }
                }
                return nextTimeObject;
            }

            timeObjects = [];
            timeObject = {};
            timeObject.msPosition = -1;
			timeObject.alignmentX = -1;
			while(timeObject.alignmentX < system.right)
            {
            	timeObject = findFollowingTimeObject(system, timeObject.msPosition, isLivePerformance, trackIsOnArray);
                timeObjects.push(timeObject);
            }
        },

		// The trackIsOnArray contains the boolean on/off state of eack track.
        setParameters = function(system, systIndex, isLivePerformance, trackIsOnArray)
        {
            var topY, bottomY, color = '#999999';

            sysIndex = systIndex;

            topY = (viewBoxScale * (system.topLineY - viewBoxOriginY - EXTRA_TOP_AND_BOTTOM)).toString();
            bottomY = (viewBoxScale * (system.bottomLineY - viewBoxOriginY + EXTRA_TOP_AND_BOTTOM)).toString();

            line.setAttribute('x1', '0');
            line.setAttribute('y1', topY);
            line.setAttribute('x2', '0');
            line.setAttribute('y2', bottomY);

            line.style.strokeWidth = 8; // 1 pixel
            line.style.stroke = color;

            yCoordinates.top = Math.round(parseFloat(topY) / vbScale) + viewBoxOriginY;
            yCoordinates.bottom = Math.round(parseFloat(bottomY) / vbScale) + viewBoxOriginY;

            setTimeObjects(system, isLivePerformance, trackIsOnArray);

            moveToStartOfSystem();
        },

        setVisible = function (setToVisible)
        {
            if (setToVisible)
            {
            	line.style.visibility = 'visible';
            }
            else
            {
            	line.style.visibility = 'hidden';
            }
        },

        getYCoordinates = function ()
        {
            var val = {};
            val.top = yCoordinates.top;
            val.bottom = yCoordinates.bottom;
            return val;
        };

        viewBoxOriginY = vbOriginY;
        viewBoxScale = vbScale;

        groupChildren = svgStartMarkerGroup.childNodes;
        for (i = 0; i < groupChildren.length; ++i)
        {
            if (groupChildren[i].nodeName === 'line')
            {
                line = groupChildren[i];
            }
        }

        setVisible(false);

        // public functions interface
        this.setParameters = setParameters;
        this.setTimeObjects = setTimeObjects;
        this.setVisible = setVisible;
        this.systemIndex = systemIndex;
        this.nextMsPosition = nextMsPosition;
        this.moveToStartOfSystem = moveToStartOfSystem;
        this.moveTo = moveTo;
        this.moveToStartMarker = moveToStartMarker;
        this.incrementPosition = incrementPosition;
        this.getYCoordinates = getYCoordinates;

        return this;
    },

    // public API
    publicAPI =
    {
        StartMarker: StartMarker,
        RunningMarker: RunningMarker,
        EndMarker: EndMarker
    };

    return publicAPI;

} ());

